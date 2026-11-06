"""NumPy copy of tf.image.resize(..., method="bilinear", antialias=False), so serving doesn't need TensorFlow.

TensorFlow 2 resizes with half-pixel centres: output pixel i samples the input at (i + 0.5) * scale - 0.5,
using the two nearest input pixels on each axis (clamped to the image) and linear weights. This function does
exactly that, in float32 like TensorFlow, and is checked against tf.image.resize in tests/test_resize.py.
"""

import numpy as np


def _axis_weights(in_size: int, out_size: int):
    scale = np.float32(in_size) / np.float32(out_size)
    source = (np.arange(out_size, dtype=np.float32) + np.float32(0.5)) * scale - np.float32(0.5)
    floor = np.floor(source)
    lower = np.maximum(floor, 0).astype(np.int64)
    upper = np.minimum(np.ceil(source), in_size - 1).astype(np.int64)
    lerp = (source - floor).astype(np.float32)
    return lower, upper, lerp


def resize_bilinear(pixels: np.ndarray, size: tuple[int, int]) -> np.ndarray:
    """Resize an (H, W, C) image to size=(height, width). Returns float32, values not rounded or clipped."""
    pixels = np.asarray(pixels, dtype=np.float32)
    out_h, out_w = size
    top, bottom, y_lerp = _axis_weights(pixels.shape[0], out_h)
    left, right, x_lerp = _axis_weights(pixels.shape[1], out_w)

    x_lerp = x_lerp[None, :, None]
    top_rows, bottom_rows = pixels[top], pixels[bottom]
    top_values = top_rows[:, left] + (top_rows[:, right] - top_rows[:, left]) * x_lerp
    bottom_values = bottom_rows[:, left] + (bottom_rows[:, right] - bottom_rows[:, left]) * x_lerp
    return top_values + (bottom_values - top_values) * y_lerp[:, None, None]
