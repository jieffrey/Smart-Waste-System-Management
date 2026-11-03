import os
from pathlib import Path

import keras
import numpy as np
import tensorflow as tf
from PIL import Image, ImageOps

# Same order as training (image_dataset_from_directory, alphabetical folders)
CLASS_NAMES = ["organic", "paper", "plastic"]
IMAGE_SIZE = (224, 224)

DEFAULT_MODEL_PATH = Path(__file__).resolve().parents[2] / "models" / "swms_mobilenetv2_best.keras"
MODEL_PATH = Path(os.environ.get("MODEL_PATH", DEFAULT_MODEL_PATH))
MODEL_VERSION = MODEL_PATH.stem


def load_model():
    return keras.models.load_model(MODEL_PATH)


def preprocess_image(image: Image.Image) -> tf.Tensor:
    # The model already contains MobileNetV2 preprocessing, so pixels stay in the 0-255 range.
    image = ImageOps.exif_transpose(image)
    image = image.convert("RGB")
    pixels = np.asarray(image, dtype=np.float32)
    resized = tf.image.resize(pixels, IMAGE_SIZE, method="bilinear", antialias=False)
    return tf.expand_dims(resized, axis=0)


def predict(model, image: Image.Image) -> dict:
    batch = preprocess_image(image)
    probabilities = model(batch, training=False).numpy()[0]
    best_index = int(np.argmax(probabilities))

    return {
        "category": CLASS_NAMES[best_index],
        "confidence": round(float(probabilities[best_index]), 4),
        "probabilities": {
            name: round(float(probability), 4) for name, probability in zip(CLASS_NAMES, probabilities)
        },
        "model_version": MODEL_VERSION,
    }
