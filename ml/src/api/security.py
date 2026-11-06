"""API key check for /predict (audit SEC-09) and the switch that turns off the interactive docs."""

import hmac
import os

from src.api.limits import send_error

API_KEY_HEADER = b"x-api-key"
INVALID_KEY_MESSAGE = "Invalid or missing API key"
PROTECTED_PATHS = {"/predict"}  # /health stays open: it is the platform's healthcheck


def api_key_from_env() -> str | None:
    """ML_API_KEY, or None when unset/empty (local dev and tests run without a key)."""
    return os.environ.get("ML_API_KEY", "").strip() or None


def docs_disabled_from_env() -> bool:
    return os.environ.get("ML_DISABLE_DOCS", "").strip().lower() in {"1", "true", "yes"}


def docs_settings(disabled: bool) -> dict:
    """FastAPI keyword arguments: with docs disabled there is no /docs, /redoc or /openapi.json."""
    return {"docs_url": None, "redoc_url": None, "openapi_url": None} if disabled else {}


class ApiKeyMiddleware:
    """Requires header X-API-Key == api_key on PROTECTED_PATHS, compared in constant time.

    Runs before the request body is read, so a request without the key costs no upload or decoding.
    With api_key=None every request passes (no key configured).
    """

    def __init__(self, app, api_key: str | None):
        self.app = app
        self.api_key = api_key.encode() if api_key else None

    async def __call__(self, scope, receive, send):
        if self.api_key is None or scope["type"] != "http" or scope["path"] not in PROTECTED_PATHS:
            await self.app(scope, receive, send)
            return

        provided = dict(scope["headers"]).get(API_KEY_HEADER, b"")
        if not hmac.compare_digest(provided, self.api_key):
            await send_error(send, 401, INVALID_KEY_MESSAGE)
            return

        await self.app(scope, receive, send)
