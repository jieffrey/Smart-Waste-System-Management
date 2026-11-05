"""Loads the classifier and turns one image into a prediction.

ML_RUNTIME picks how the model is run:
- tf   (default): the trained .keras file with TensorFlow/Keras; resizing with tf.image.resize. Same code
       path as training and the Colab parity values, for local development.
- lite: the exported .onnx copy of the same model (scripts/export_lite.py) with ONNX Runtime; resizing with
       the NumPy copy of tf.image.resize. No TensorFlow needed: used in production (requirements-lite.txt).

TensorFlow and ONNX Runtime are only imported by the runtime that needs them.
"""

import os
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

# Same order as training (image_dataset_from_directory, alphabetical folders)
CLASS_NAMES = ["organic", "paper", "plastic"]
IMAGE_SIZE = (224, 224)
RUNTIMES = ("tf", "lite")

MODELS_DIR = Path(__file__).resolve().parents[2] / "models"
MODEL_STEM = "swms_mobilenetv2_best"


def runtime_from_env() -> str:
    runtime = os.environ.get("ML_RUNTIME", "tf").strip().lower() or "tf"
    if runtime not in RUNTIMES:
        raise ValueError(f"ML_RUNTIME must be one of: {', '.join(RUNTIMES)} (got {runtime!r})")
    return runtime


def default_model_path(runtime: str) -> Path:
    return MODELS_DIR / f"{MODEL_STEM}{'.keras' if runtime == 'tf' else '.onnx'}"


RUNTIME = runtime_from_env()
MODEL_PATH = Path(os.environ.get("MODEL_PATH") or default_model_path(RUNTIME))
# The version names the trained model, not the file format: the .keras and its .onnx export report the same.
MODEL_VERSION = MODEL_PATH.stem


class TfModel:
    runtime = "tf"

    def __init__(self, path: Path):
        import keras

        self.model = keras.models.load_model(path)

    def resize(self, pixels: np.ndarray) -> np.ndarray:
        import tensorflow as tf

        return tf.image.resize(pixels, IMAGE_SIZE, method="bilinear", antialias=False).numpy()

    def __call__(self, batch: np.ndarray) -> np.ndarray:
        return self.model(batch, training=False).numpy()


class LiteModel:
    runtime = "lite"

    def __init__(self, path: Path, threads: int = 1):
        import onnxruntime as ort

        options = ort.SessionOptions()
        # One request is one image; a single thread keeps memory and CPU use small and predictable.
        options.intra_op_num_threads = threads
        options.inter_op_num_threads = 1
        self.session = ort.InferenceSession(str(path), sess_options=options, providers=["CPUExecutionProvider"])
        self.input_name = self.session.get_inputs()[0].name

    def resize(self, pixels: np.ndarray) -> np.ndarray:
        from src.inference.resize import resize_bilinear

        return resize_bilinear(pixels, IMAGE_SIZE)

    def __call__(self, batch: np.ndarray) -> np.ndarray:
        return self.session.run(None, {self.input_name: batch.astype(np.float32)})[0]


def load_model(runtime: str = RUNTIME, path: Path = MODEL_PATH):
    return TfModel(path) if runtime == "tf" else LiteModel(path)


def image_to_pixels(image: Image.Image) -> np.ndarray:
    # The model already contains MobileNetV2 preprocessing, so pixels stay in the 0-255 range.
    image = ImageOps.exif_transpose(image)
    image = image.convert("RGB")
    return np.asarray(image, dtype=np.float32)


def preprocess_image(model, image: Image.Image) -> np.ndarray:
    return np.expand_dims(model.resize(image_to_pixels(image)), axis=0)


def predict(model, image: Image.Image) -> dict:
    probabilities = model(preprocess_image(model, image))[0]
    best_index = int(np.argmax(probabilities))

    return {
        "category": CLASS_NAMES[best_index],
        "confidence": round(float(probabilities[best_index]), 4),
        "probabilities": {
            name: round(float(probability), 4) for name, probability in zip(CLASS_NAMES, probabilities)
        },
        "model_version": MODEL_VERSION,
    }
