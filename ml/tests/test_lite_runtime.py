# The lite runtime (ML_RUNTIME=lite, ONNX Runtime) must give the same predictions as the Keras model.
# Run from ml/:  .venv\Scripts\python -m pytest
import json
import os
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from src.inference import predictor

pytest.importorskip("onnxruntime")

ML_DIR = Path(__file__).resolve().parents[1]
SAMPLES_DIR = ML_DIR / "tests" / "samples"
EXPECTED = json.loads((SAMPLES_DIR / "expected.json").read_text())
ONNX_PATH = predictor.default_model_path("lite")
PROBABILITY_TOLERANCE = 0.01  # same as test_predict.py

pytestmark = pytest.mark.skipif(not ONNX_PATH.exists(), reason=f"{ONNX_PATH.name} not exported")


@pytest.fixture(scope="module")
def lite_model():
    return predictor.load_model("lite", ONNX_PATH)


def open_sample(name):
    image = Image.open(SAMPLES_DIR / name)
    image.load()
    return image


@pytest.mark.parametrize("file_name", sorted(EXPECTED))
def test_lite_matches_colab_values(lite_model, file_name):
    result = predictor.predict(lite_model, open_sample(file_name))

    assert result["category"] == EXPECTED[file_name]["category"]
    for name, expected in EXPECTED[file_name]["probabilities"].items():
        assert result["probabilities"][name] == pytest.approx(expected, abs=PROBABILITY_TOLERANCE)


def test_lite_matches_keras_on_the_samples(lite_model):
    pytest.importorskip("tensorflow")
    keras_model = predictor.load_model("tf", predictor.default_model_path("tf"))

    for file_name in sorted(EXPECTED):
        image = open_sample(file_name)
        expected = keras_model(predictor.preprocess_image(keras_model, image))
        actual = lite_model(predictor.preprocess_image(lite_model, image))
        assert np.abs(expected - actual).max() < 1e-4, file_name


def test_export_report_matches_the_committed_files():
    report = json.loads(ONNX_PATH.with_name(ONNX_PATH.name + ".json").read_text())

    assert report["onnx_bytes"] == ONNX_PATH.stat().st_size
    for stats in report["parity"].values():
        assert stats["label_flips"] == 0
        assert stats["max_abs_prob_diff"] <= report["tolerance"]


@pytest.mark.parametrize("value, expected", [(None, "tf"), ("", "tf"), ("lite", "lite"), (" TF ", "tf")])
def test_runtime_from_env(monkeypatch, value, expected):
    if value is None:
        monkeypatch.delenv("ML_RUNTIME", raising=False)
    else:
        monkeypatch.setenv("ML_RUNTIME", value)

    assert predictor.runtime_from_env() == expected


def test_unknown_runtime_is_refused(monkeypatch):
    monkeypatch.setenv("ML_RUNTIME", "onnx")

    with pytest.raises(ValueError, match="ML_RUNTIME must be one of"):
        predictor.runtime_from_env()


@pytest.mark.skipif(predictor.RUNTIME == "lite", reason="already running the whole suite with ML_RUNTIME=lite")
def test_api_suite_passes_with_the_lite_runtime():
    # The runtime is chosen when the app is imported, so the API tests run again in a fresh process.
    env = {**os.environ, "ML_RUNTIME": "lite", "TF_CPP_MIN_LOG_LEVEL": "3"}
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider", "tests/test_predict.py", "tests/test_limits.py",
         "tests/test_security.py"],
        cwd=ML_DIR, env=env, capture_output=True, text=True,
    )

    assert result.returncode == 0, result.stdout[-3000:] + result.stderr[-2000:]
