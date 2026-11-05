import struct
import warnings
from contextlib import asynccontextmanager
from io import BytesIO

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from PIL import Image, UnidentifiedImageError
from starlette.exceptions import HTTPException as StarletteHTTPException

from src.api.limits import BodySizeLimitMiddleware
from src.api.schema import ErrorBody, ErrorDetail, ErrorResponse, HealthResponse, PredictionResponse
from src.api.security import ApiKeyMiddleware, api_key_from_env, docs_disabled_from_env, docs_settings
from src.inference.predictor import MODEL_VERSION, load_model, predict

MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB
# Room for the multipart boundary and part headers around the 5 MB file.
MAX_BODY_BYTES = MAX_UPLOAD_BYTES + 64 * 1024
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
# About 6000 x 4000 (a 24 MP camera photo). The mobile app sends at most 1600 px on the longest side.
# Decoding needs ~3 bytes per pixel, and preprocessing makes a float32 copy (12 bytes per pixel), so this
# caps one request at roughly 360 MB instead of several GB for a small, highly compressed "bomb" image.
MAX_IMAGE_PIXELS = 24_000_000

# Pillow's own decompression-bomb protection, set explicitly to the same limit: it warns above the limit
# and raises above twice the limit. Turning the warning into an error makes it a hard stop.
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS
warnings.simplefilter("error", Image.DecompressionBombWarning)

UNSUPPORTED_MESSAGE = "Unsupported file type. Upload a JPEG, PNG or WebP image"
TOO_LARGE_DIMENSIONS_MESSAGE = "Image dimensions are too large"
CORRUPT_MESSAGE = "Image file is corrupt or cannot be read"

model = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the model once at startup; the app fails to start if the model file is missing.
    global model
    model = load_model()
    yield


# ML_DISABLE_DOCS=1 (set in the production Dockerfile) removes /docs, /redoc and /openapi.json.
app = FastAPI(title="SWMS Waste Classifier", lifespan=lifespan, **docs_settings(docs_disabled_from_env()))
app.add_middleware(BodySizeLimitMiddleware, max_body_bytes=MAX_BODY_BYTES)
# Added last, so it runs first: a request without the right X-API-Key is refused before its body is read.
app.add_middleware(ApiKeyMiddleware, api_key=api_key_from_env())

ERROR_RESPONSES = {
    400: {"model": ErrorResponse},
    413: {"model": ErrorResponse},
    415: {"model": ErrorResponse},
}


def error_response(status_code: int, message: str, details: list[ErrorDetail] | None = None) -> JSONResponse:
    body = ErrorResponse(error=ErrorBody(message=message, details=details))
    return JSONResponse(status_code=status_code, content=body.model_dump(exclude_none=True))


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return error_response(exc.status_code, str(exc.detail))


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    details = [
        ErrorDetail(field=".".join(str(part) for part in error["loc"] if part != "body"), message=error["msg"])
        for error in exc.errors()
    ]
    return error_response(400, "Validation failed", details)


@app.exception_handler(Exception)
async def unexpected_exception_handler(request: Request, exc: Exception):
    return error_response(500, "Internal server error")


def open_image(data: bytes) -> Image.Image:
    if not data:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    # 1. Read only the header: format and declared dimensions. No pixel data is decoded yet.
    try:
        image = Image.open(BytesIO(data))
    except (Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(status_code=400, detail=TOO_LARGE_DIMENSIONS_MESSAGE)
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError, struct.error, EOFError):
        raise HTTPException(status_code=415, detail=UNSUPPORTED_MESSAGE)

    if image.format not in ALLOWED_FORMATS:
        raise HTTPException(status_code=415, detail=UNSUPPORTED_MESSAGE)

    # 2. Refuse huge images before decoding them (a small file can declare enormous dimensions).
    width, height = image.size
    if width <= 0 or height <= 0:
        raise HTTPException(status_code=400, detail=CORRUPT_MESSAGE)
    if width * height > MAX_IMAGE_PIXELS:
        raise HTTPException(status_code=400, detail=TOO_LARGE_DIMENSIONS_MESSAGE)

    # 3. Fully decode now, so corrupt or truncated files are caught here with a clean 4xx.
    try:
        image.load()
    except (Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(status_code=400, detail=TOO_LARGE_DIMENSIONS_MESSAGE)
    except (OSError, ValueError, SyntaxError, struct.error, EOFError, IndexError):
        raise HTTPException(status_code=400, detail=CORRUPT_MESSAGE)

    return image


@app.get("/health", response_model=HealthResponse)
def health():
    return {"status": "ok", "model_loaded": model is not None, "model_version": MODEL_VERSION}


# A plain `def` (not async) lets FastAPI run inference in a worker thread without blocking other requests.
@app.post("/predict", response_model=PredictionResponse, responses=ERROR_RESPONSES)
def predict_image(file: UploadFile = File(...)):
    data = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image must be 5 MB or smaller")

    image = open_image(data)
    return predict(model, image)
