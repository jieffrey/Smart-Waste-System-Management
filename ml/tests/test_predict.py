# Run from ml/:  .venv\Scripts\python -m pytest
import json
from io import BytesIO
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from src.api.main import MAX_UPLOAD_BYTES, app
from src.inference.predictor import MODEL_VERSION, RUNTIME

CATEGORIES = {"organic", "paper", "plastic"}
SAMPLES_DIR = Path(__file__).parent / "samples"
PROBABILITY_TOLERANCE = 0.01  # allows small decoder differences between Pillow and Colab (tf.io.decode_image)


@pytest.fixture(scope="module")
def client():
    # The `with` block runs the app's startup, which loads the model.
    with TestClient(app) as test_client:
        yield test_client


def make_image_bytes(image_format: str) -> bytes:
    image = Image.new("RGB", (320, 240), color=(90, 140, 60))
    buffer = BytesIO()
    image.save(buffer, format=image_format)
    return buffer.getvalue()


def assert_valid_prediction(body: dict):
    assert body["category"] in CATEGORIES
    assert 0 <= body["confidence"] <= 1
    assert set(body["probabilities"]) == CATEGORIES
    assert sum(body["probabilities"].values()) == pytest.approx(1, abs=0.001)
    assert body["probabilities"][body["category"]] == body["confidence"]
    assert body["model_version"] == MODEL_VERSION == "swms_mobilenetv2_option_b"


def test_health_returns_ok(client):
    res = client.get("/health")

    assert res.status_code == 200
    assert res.json() == {
        "status": "ok",
        "model_loaded": True,
        "model_version": "swms_mobilenetv2_option_b",
        "runtime": RUNTIME,
    }


def test_predict_valid_jpeg(client):
    res = client.post("/predict", files={"file": ("waste.jpg", make_image_bytes("JPEG"), "image/jpeg")})

    assert res.status_code == 200
    assert_valid_prediction(res.json())


def test_predict_valid_png(client):
    res = client.post("/predict", files={"file": ("waste.png", make_image_bytes("PNG"), "image/png")})

    assert res.status_code == 200
    assert_valid_prediction(res.json())


def test_predict_missing_file_returns_400(client):
    res = client.post("/predict")

    assert res.status_code == 400
    assert res.json() == {
        "error": {"message": "Validation failed", "details": [{"field": "file", "message": "Field required"}]}
    }


def test_predict_unsupported_type_returns_415(client):
    # Claims to be a JPEG, but the content is plain text: validation uses the decoded content, not the header.
    res = client.post("/predict", files={"file": ("notes.jpg", b"this is not an image", "image/jpeg")})

    assert res.status_code == 415
    assert res.json()["error"]["message"] == "Unsupported file type. Upload a JPEG, PNG or WebP image"


def test_predict_unsupported_image_format_returns_415(client):
    res = client.post("/predict", files={"file": ("waste.gif", make_image_bytes("GIF"), "image/gif")})

    assert res.status_code == 415


def test_predict_corrupt_image_returns_400(client):
    # A truncated JPEG (e.g. an interrupted upload): the headers are valid, so it is recognised
    # as a JPEG, but the image data is incomplete.
    jpeg = make_image_bytes("JPEG")
    corrupt = jpeg[: len(jpeg) // 2]
    res = client.post("/predict", files={"file": ("broken.jpg", corrupt, "image/jpeg")})

    assert res.status_code == 400
    assert res.json()["error"]["message"] == "Image file is corrupt or cannot be read"


def test_predict_oversized_upload_returns_413(client):
    too_big = b"\x00" * (MAX_UPLOAD_BYTES + 1)
    res = client.post("/predict", files={"file": ("big.jpg", too_big, "image/jpeg")})

    assert res.status_code == 413
    assert res.json()["error"]["message"] == "Image must be 5 MB or smaller"


# ---- Optional: real images vs Colab (skipped automatically when tests/samples/expected.json is missing) ----


def load_expected() -> dict:
    expected_path = SAMPLES_DIR / "expected.json"
    return json.loads(expected_path.read_text()) if expected_path.exists() else {}


EXPECTED = load_expected()


@pytest.mark.skipif(not EXPECTED, reason="No tests/samples/expected.json")
@pytest.mark.parametrize("file_name", sorted(EXPECTED))
def test_predict_matches_colab(client, file_name):
    expected = EXPECTED[file_name]
    image_path = SAMPLES_DIR / file_name
    assert image_path.exists(), f"{file_name} is listed in expected.json but not found in tests/samples/"

    res = client.post("/predict", files={"file": (file_name, image_path.read_bytes())})

    assert res.status_code == 200
    body = res.json()
    assert_valid_prediction(body)
    assert body["category"] == expected["category"]
    for name in sorted(CATEGORIES):
        assert body["probabilities"][name] == pytest.approx(
            expected["probabilities"][name], abs=PROBABILITY_TOLERANCE
        ), f"{name}: got {body['probabilities'][name]}, expected {expected['probabilities'][name]}"
