# The NumPy resize used by the lite runtime must equal tf.image.resize (bilinear, no antialias).
# Skipped where TensorFlow isn't installed (the production image).
import numpy as np
import pytest

from src.inference.resize import resize_bilinear

tf = pytest.importorskip("tensorflow")

SHAPES = [(224, 224, 3), (1, 1, 3), (225, 223, 3), (100, 700, 3), (1600, 1200, 3), (5, 224, 3), (2000, 1500, 3)]


@pytest.mark.parametrize("shape", SHAPES)
def test_resize_matches_tensorflow(shape):
    pixels = np.random.default_rng(len(shape) * shape[0]).uniform(0, 255, shape).astype(np.float32)

    expected = tf.image.resize(pixels, (224, 224), method="bilinear", antialias=False).numpy()
    actual = resize_bilinear(pixels, (224, 224))

    assert actual.dtype == np.float32
    assert actual.shape == (224, 224, 3)
    np.testing.assert_allclose(actual, expected, rtol=0, atol=1e-3)
