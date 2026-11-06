# API key on /predict (SEC-09) and the docs switch. Run from ml/:  .venv\Scripts\python -m pytest
import asyncio

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import src.api.main as main
from src.api.security import ApiKeyMiddleware, api_key_from_env, docs_disabled_from_env, docs_settings

KEY = "test-key-0123456789abcdef"


def make_app(api_key):
    app = FastAPI()

    @app.post("/predict")
    async def predict():
        return {"ok": True}

    @app.get("/health")
    def health():
        return {"status": "ok"}

    app.add_middleware(ApiKeyMiddleware, api_key=api_key)
    return app


@pytest.fixture
def client():
    return TestClient(make_app(KEY))


def test_predict_without_key_returns_401(client):
    res = client.post("/predict")

    assert res.status_code == 401
    assert res.json() == {"error": {"message": "Invalid or missing API key"}}


def test_predict_with_wrong_key_returns_401(client):
    res = client.post("/predict", headers={"X-API-Key": KEY + "x"})

    assert res.status_code == 401


def test_predict_with_right_key_passes(client):
    res = client.post("/predict", headers={"X-API-Key": KEY})

    assert res.status_code == 200


def test_health_needs_no_key(client):
    assert client.get("/health").status_code == 200


def test_body_is_not_read_without_key():
    received = []

    async def app(scope, receive, send):
        received.append(await receive())

    sent = []

    async def receive():
        return {"type": "http.request", "body": b"x" * 10, "more_body": False}

    async def send(message):
        sent.append(message)

    scope = {"type": "http", "path": "/predict", "headers": []}
    asyncio.run(ApiKeyMiddleware(app, KEY)(scope, receive, send))

    assert received == []
    assert sent[0]["status"] == 401


def test_no_key_configured_lets_everything_through():
    res = TestClient(make_app(None)).post("/predict")

    assert res.status_code == 200


@pytest.mark.parametrize("value, expected", [(None, None), ("", None), ("  ", None), (" abc ", "abc")])
def test_api_key_from_env(monkeypatch, value, expected):
    if value is None:
        monkeypatch.delenv("ML_API_KEY", raising=False)
    else:
        monkeypatch.setenv("ML_API_KEY", value)

    assert api_key_from_env() == expected


@pytest.mark.parametrize("value, expected", [(None, False), ("0", False), ("1", True), ("true", True)])
def test_docs_disabled_from_env(monkeypatch, value, expected):
    if value is None:
        monkeypatch.delenv("ML_DISABLE_DOCS", raising=False)
    else:
        monkeypatch.setenv("ML_DISABLE_DOCS", value)

    assert docs_disabled_from_env() is expected


def test_docs_settings_removes_all_doc_routes():
    app = FastAPI(**docs_settings(True))
    client = TestClient(app)

    for path in ["/docs", "/redoc", "/openapi.json"]:
        assert client.get(path).status_code == 404


def test_main_app_uses_the_api_key_middleware():
    assert any(m.cls is ApiKeyMiddleware for m in main.app.user_middleware)
