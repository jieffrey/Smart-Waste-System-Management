"""Request size limits that apply before FastAPI reads (and spools) the request body."""

import json

from starlette.exceptions import HTTPException as StarletteHTTPException

TOO_LARGE_MESSAGE = "Image must be 5 MB or smaller"


class BodySizeLimitMiddleware:
    """Rejects request bodies larger than `max_body_bytes` with 413, without reading the whole body.

    - With a Content-Length header: rejected before a single body byte is read.
    - Without one (chunked upload): bytes are counted while they arrive, and the request is stopped as
      soon as the limit is passed, so a huge upload is never fully received or written to disk.
    """

    def __init__(self, app, max_body_bytes: int):
        self.app = app
        self.max_body_bytes = max_body_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        content_length = dict(scope["headers"]).get(b"content-length")
        if content_length is not None:
            try:
                declared = int(content_length)
            except ValueError:
                declared = None
            if declared is None or declared > self.max_body_bytes:
                await send_error(send, 413 if declared is not None else 400,
                                 TOO_LARGE_MESSAGE if declared is not None else "Invalid Content-Length header")
                return

        received = 0

        async def limited_receive():
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_body_bytes:
                    # An HTTPException is turned into the usual JSON error by the app's exception handler.
                    raise StarletteHTTPException(status_code=413, detail=TOO_LARGE_MESSAGE)
            return message

        await self.app(scope, limited_receive, send)


async def send_error(send, status_code: int, message: str):
    body = json.dumps({"error": {"message": message}}).encode()
    await send({
        "type": "http.response.start",
        "status": status_code,
        "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())],
    })
    await send({"type": "http.response.body", "body": body})
