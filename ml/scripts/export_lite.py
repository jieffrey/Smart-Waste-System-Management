"""Export a trained .keras model to ONNX for the lite runtime (ML_RUNTIME=lite), and prove it predicts the same.

Training stays TensorFlow/Keras; only serving uses the exported copy. The MobileNetV2 preprocessing layers are
part of the model, so they are exported too: the .onnx file takes raw 0-255 pixels, like the .keras file.

The export is written ONLY if it matches the Keras model through the full API pipeline (Pillow decode → EXIF
rotation → RGB → resize → model; tf.image.resize for Keras, the NumPy copy for ONNX):
  - every class probability within --tolerance (default 0.01, the API parity-test tolerance), and
  - no label flips,
on random inputs, the images in tests/samples/, and (with --dataset) every image under that folder.

Run from ml/ in the training/dev environment (TensorFlow + requirements-export.txt):
    python -m scripts.export_lite                                    # the served model
    python -m scripts.export_lite --model models/swms_mobilenetv2_option_b.keras
    python -m scripts.export_lite --dataset /path/to/dataset_split/test

Writes <output>.onnx and <output>.onnx.json (versions, checksums, parity numbers).
"""

import argparse
import hashlib
import json
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image

from src.inference.predictor import CLASS_NAMES, MODELS_DIR, MODEL_STEM, LiteModel, TfModel, preprocess_image

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
SAMPLES_DIR = Path(__file__).resolve().parents[1] / "tests" / "samples"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


class ParityStats:
    def __init__(self, name: str):
        self.name, self.images, self.max_diff, self.flips, self.flipped = name, 0, 0.0, 0, []

    def add(self, label: str, expected: np.ndarray, actual: np.ndarray):
        for e, a in zip(np.atleast_2d(expected), np.atleast_2d(actual)):
            self.images += 1
            self.max_diff = max(self.max_diff, float(np.abs(e - a).max()))
            if int(np.argmax(e)) != int(np.argmax(a)):
                self.flips += 1
                self.flipped.append(label)

    def as_dict(self) -> dict:
        return {"images": self.images, "max_abs_prob_diff": self.max_diff, "label_flips": self.flips,
                "flipped": self.flipped[:20]}


def compare_images(paths, keras_model, lite_model, stats: ParityStats):
    for n, path in enumerate(paths, 1):
        with Image.open(path) as image:
            image.load()
            expected = keras_model(preprocess_image(keras_model, image))
            actual = lite_model(preprocess_image(lite_model, image))
        stats.add(path.name, expected, actual)
        if n % 500 == 0:
            print(f"  {stats.name}: {n} images", flush=True)


def image_files(folder: Path) -> list[Path]:
    return sorted(p for p in folder.rglob("*") if p.suffix.lower() in IMAGE_EXTENSIONS)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--model", type=Path, default=MODELS_DIR / f"{MODEL_STEM}.keras", help=".keras file to export")
    parser.add_argument("--output", type=Path, help="default: the model path with .onnx")
    parser.add_argument("--dataset", type=Path, help="optional folder of images (e.g. the test split) to check too")
    parser.add_argument("--tolerance", type=float, default=0.01, help="max allowed probability difference")
    args = parser.parse_args(argv)
    output = args.output or args.model.with_suffix(".onnx")

    import keras
    import onnxruntime
    import tensorflow as tf

    print(f"Exporting {args.model} → {output}")
    keras_model = TfModel(args.model)
    with tempfile.TemporaryDirectory() as tmp:
        tmp_onnx = Path(tmp) / "model.onnx"
        # Keras only exports a model that has been called once (a freshly loaded one hasn't).
        keras_model(np.zeros((1, *keras_model.model.input_shape[1:]), dtype=np.float32))
        keras_model.model.export(str(tmp_onnx), format="onnx", verbose=False)
        lite_model = LiteModel(tmp_onnx)

        checks = []
        random_stats = ParityStats("random inputs")
        batch = np.random.default_rng(0).uniform(0, 255, (8, *keras_model.model.input_shape[1:])).astype(np.float32)
        random_stats.add("random", keras_model(batch), np.concatenate([lite_model(x[None]) for x in batch]))
        checks.append(random_stats)

        sample_stats = ParityStats("tests/samples")
        compare_images(image_files(SAMPLES_DIR), keras_model, lite_model, sample_stats)
        checks.append(sample_stats)

        if args.dataset:
            dataset_stats = ParityStats(f"dataset {args.dataset.name}")
            compare_images(image_files(args.dataset), keras_model, lite_model, dataset_stats)
            checks.append(dataset_stats)

        ok = True
        for stats in checks:
            passed = stats.max_diff <= args.tolerance and stats.flips == 0
            ok &= passed
            print(f"  {'PASS' if passed else 'FAIL'} {stats.name}: {stats.images} images, "
                  f"max |Δp| = {stats.max_diff:.2e}, label flips = {stats.flips}")

        if not ok:
            print(f"Parity failed (tolerance {args.tolerance}, no label flips allowed): nothing written. "
                  "Keep serving this model with ML_RUNTIME=tf.")
            return 1

        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(tmp_onnx.read_bytes())

    report = {
        "source_model": args.model.name,
        "source_sha256": sha256(args.model),
        "onnx_model": output.name,
        "onnx_sha256": sha256(output),
        "onnx_bytes": output.stat().st_size,
        "classes": CLASS_NAMES,
        "input": "raw RGB pixels 0-255, float32, shape (N, 224, 224, 3); MobileNetV2 preprocessing is inside the model",
        "exported_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "versions": {"tensorflow": tf.__version__, "keras": keras.__version__, "onnxruntime": onnxruntime.__version__},
        "tolerance": args.tolerance,
        "parity": {stats.name: stats.as_dict() for stats in checks},
    }
    report_path = output.with_name(output.name + ".json")
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {output} ({report['onnx_bytes']:,} bytes) and {report_path.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
