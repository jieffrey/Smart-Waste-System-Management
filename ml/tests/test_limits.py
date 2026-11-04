# Size and dimension limits (SEC-03, SEC-08). Run from ml/:  .venv\Scripts\python -m pytest
# Only tiny inputs are used: "huge" images are simulated with a header that claims huge dimensions,
# or by lowering the limit for one test. No real multi-GB decompression bomb is ever created.
import asyncio
import json
import struct
import zlib
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from starlette.exceptions import HTTPException as StarletteHTTPException

import src.api.main as main
from src.api.limits import BodySizeLimitMiddleware
from src.api.main import MAX_BODY_BYTES, MAX_IMAGE_PIXELS, app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


def png_chunk(kind: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))


def png_claiming(width: int, height: int) -> bytes:
    """A ~60-byte PNG whose header claims width x height pixels (the pixel data is not really there)."""
    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)  # 8-bit RGB
    return b"\x89PNG\r\n\x1a\n" + png_chunk(b"IHDR", header) + png_chunk(b"IDAT", zlib.compress(b"")) + png_chunk(b"IEND", b"")


def image_bytes(image_format: str, size=(320, 240), mode="RGB") -> bytes:
    buffer = BytesIO()
    Image.new(mode, size, color=90 if mode in ("L", "I;16") else (90, 140, 60)).save(buffer, format=image_format)
    return buffer.getvalue()


def post_file(client, data: bytes, name="photo.png", content_type="image/png"):
    return client.post("/predict", files={"file": (name, data, content_type)})


# ---- Declared dimensions are checked before decoding ----


def test_header_claiming_huge_dimensions_is_rejected_before_decoding(client):
    bomb = png_claiming(30_000, 30_000)  # 900 million pixels declared in a file of a few dozen bytes
    assert len(bomb) < 100

    res = post_file(client, bomb)

    assert res.status_code == 400
    assert res.json() == {"error": {"message": "Image dimensions are too large"}}


def test_dimensions_just_over_the_limit_are_rejected(client):
    # Between the limit and twice the limit, Pillow alone would only warn; our check still refuses it.
    width = 6_000
    height = MAX_IMAGE_PIXELS // width + 1
    res = post_file(client, png_claiming(width, height))

    assert res.status_code == 400
    assert res.json()["error"]["message"] == "Image dimensions are too large"


def test_a_real_image_over_a_lowered_limit_is_rejected(client, monkeypatch):
    # Simulates "too many pixels" with a small real image by lowering the limit for this test only.
    monkeypatch.setattr(main, "MAX_IMAGE_PIXELS", 10_000)

    res = post_file(client, image_bytes("PNG", size=(320, 240)))

    assert res.status_code == 400
    assert res.json()["error"]["message"] == "Image dimensions are too large"


def test_pillow_decompression_bomb_protection_is_set_explicitly():
    assert Image.MAX_IMAGE_PIXELS == MAX_IMAGE_PIXELS


def test_an_image_within_the_limit_is_still_classified(client):
    res = post_file(client, image_bytes("JPEG", size=(1600, 1200)), name="photo.jpg", content_type="image/jpeg")

    assert res.status_code == 200
    assert res.json()["category"] in {"organic", "paper", "plastic"}


# ---- Broken or unusual files get a clean 4xx, never a 500 ----


@pytest.mark.parametrize(
    "data",
    [
        b"\x89PNG\r\n\x1a\n" + b"\x00" * 40,  # PNG signature followed by junk
        b"\x89PNG\r\n\x1a\n",  # signature only
        png_claiming(0, 0),  # zero-sized
        png_claiming(320, 240),  # valid header, no pixel data
        b"\xff\xd8\xff" + b"\x00" * 64,  # JPEG marker followed by junk
        b"RIFF\x10\x00\x00\x00WEBPVP8 " + b"\x00" * 16,  # broken WebP
        b"<svg xmlns='http://www.w3.org/2000/svg'></svg>",
    ],
    ids=["png-junk", "png-signature-only", "png-zero-size", "png-no-data", "jpeg-junk", "webp-broken", "svg"],
)
def test_broken_or_non_image_files_return_a_clean_4xx(client, data):
    res = post_file(client, data)

    assert res.status_code in (400, 415), res.text
    assert set(res.json()) == {"error"}


def test_empty_file_returns_400(client):
    res = post_file(client, b"")

    assert res.status_code == 400
    assert res.json()["error"]["message"] == "Uploaded file is empty"


@pytest.mark.parametrize("mode", ["L", "RGBA", "P", "I;16"])
def test_unusual_png_color_modes_are_classified(client, mode):
    res = post_file(client, image_bytes("PNG", mode=mode))

    assert res.status_code == 200, res.text


# ---- The body size is limited before the whole body is read ----


def test_a_chunked_multipart_upload_over_the_limit_gets_413(client):
    def body():
        # A multipart upload without Content-Length (a generator is sent chunked), so the size is only
        # known while it streams in. (Starlette's TestClient buffers the body itself, so how early the
        # server stops is proven by the middleware test below, not here.)
        yield (
            b"--XBOUNDARY\r\n"
            b'Content-Disposition: form-data; name="file"; filename="big.png"\r\n'
            b"Content-Type: image/png\r\n\r\n"
        )
        for _ in range(30):  # about 7.5 MB
            yield b"\x00" * (256 * 1024)
        yield b"\r\n--XBOUNDARY--\r\n"

    res = client.post("/predict", content=body(), headers={"Content-Type": "multipart/form-data; boundary=XBOUNDARY"})

    assert res.status_code == 413
    assert res.json() == {"error": {"message": "Image must be 5 MB or smaller"}}


def test_the_middleware_stops_reading_a_streamed_body_soon_after_the_limit():
    chunk_size = 256 * 1024
    chunks_read = {"count": 0}

    async def receive():  # an endless stream of chunks, like a client uploading 1 GB
        chunks_read["count"] += 1
        return {"type": "http.request", "body": b"\x00" * chunk_size, "more_body": True}

    async def downstream_app(scope, receive, send):  # reads the whole body, like the form parser does
        while (await receive())["more_body"]:
            pass

    async def send(message):
        pass

    middleware = BodySizeLimitMiddleware(downstream_app, max_body_bytes=MAX_BODY_BYTES)
    scope = {"type": "http", "method": "POST", "path": "/predict", "headers": []}
    with pytest.raises(StarletteHTTPException) as raised:
        asyncio.run(middleware(scope, receive, send))

    assert raised.value.status_code == 413
    assert chunks_read["count"] == MAX_BODY_BYTES // chunk_size + 1  # stopped at the first chunk past 5 MB


def run_middleware(headers: list[tuple[bytes, bytes]]):
    """Runs only the middleware with a fake request; reports whether the app or the body was touched."""
    calls = {"app": False, "receive": False}
    sent = []

    async def downstream_app(scope, receive, send):
        calls["app"] = True

    async def receive():
        calls["receive"] = True
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message):
        sent.append(message)

    middleware = BodySizeLimitMiddleware(downstream_app, max_body_bytes=MAX_BODY_BYTES)
    scope = {"type": "http", "method": "POST", "path": "/predict", "headers": headers}
    asyncio.run(middleware(scope, receive, send))
    return calls, sent


def test_a_too_large_content_length_is_rejected_without_reading_the_body():
    calls, sent = run_middleware([(b"content-length", str(MAX_BODY_BYTES + 1).encode())])

    assert calls == {"app": False, "receive": False}
    assert sent[0]["status"] == 413
    assert json.loads(sent[1]["body"]) == {"error": {"message": "Image must be 5 MB or smaller"}}


def test_an_invalid_content_length_is_rejected():
    calls, sent = run_middleware([(b"content-length", b"not-a-number")])

    assert calls["app"] is False
    assert sent[0]["status"] == 400


def test_a_content_length_within_the_limit_reaches_the_app():
    calls, sent = run_middleware([(b"content-length", b"1024")])

    assert calls["app"] is True
    assert sent == []
