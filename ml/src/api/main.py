from contextlib import asynccontextmanager
from io import BytesIO

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from PIL import Image, UnidentifiedImageError
from starlette.exceptions import HTTPException as StarletteHTTPException

from src.api.schema import ErrorBody, ErrorDetail, ErrorResponse, HealthResponse, PredictionResponse
from src.inference.predictor import MODEL_VERSION, load_model, predict

MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}

model = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the model once at startup; the app fails to start if the model file is missing.
    global model
    model = load_model()
    yield


app = FastAPI(title="SWMS Waste Classifier", lifespan=lifespan)

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

    try:
        image = Image.open(BytesIO(data))
    except UnidentifiedImageError:
        raise HTTPException(status_code=415, detail="Unsupported file type. Upload a JPEG, PNG or WebP image")
    except Image.DecompressionBombError:
        raise HTTPException(status_code=400, detail="Image dimensions are too large")

    if image.format not in ALLOWED_FORMATS:
        raise HTTPException(status_code=415, detail="Unsupported file type. Upload a JPEG, PNG or WebP image")

    try:
        image.load()  # Fully decode now so corrupt or truncated files are caught here
    except (OSError, SyntaxError, ValueError):
        raise HTTPException(status_code=400, detail="Image file is corrupt or cannot be read")

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
