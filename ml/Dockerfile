# Production image for the ML API on Railway: lite runtime (ONNX Runtime), no TensorFlow.
# Build from ml/:  docker build -t swms-ml .
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ML_RUNTIME=lite \
    ML_DISABLE_DOCS=1 \
    PORT=8000

RUN useradd --create-home --uid 1000 app
WORKDIR /app

COPY requirements-lite.txt .
RUN pip install --no-cache-dir -r requirements-lite.txt

COPY src ./src
# Only exported .onnx models are copied (see .dockerignore); MODEL_PATH picks another one if needed.
COPY models ./models

USER app
EXPOSE 8000
# Dual-stack (IPv4 + IPv6) socket on $PORT, see src/api/serve.py
CMD ["python", "-m", "src.api.serve"]
