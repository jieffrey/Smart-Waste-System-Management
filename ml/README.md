# SWMS ML — Waste Image Classifier API

FastAPI service that classifies a waste photo as **organic**, **paper** or **plastic** using a
MobileNetV2 transfer-learning model. The Express backend calls this service; it is not meant to be
exposed publicly.

## Model

| | |
|---|---|
| Architecture | MobileNetV2 (transfer learning) |
| File | `models/swms_mobilenetv2_best.keras` (Keras 3.13.2) |
| Input | 224×224 RGB |
| Classes (in order) | `organic`, `paper`, `plastic` |
| Test accuracy | **97.72%** |
| Test loss | **0.0800** |

**Dataset:** the training data and the 3 sample images in `tests/samples/` (taken from the test split)
come from the Kaggle [Garbage Classification V2](https://www.kaggle.com/datasets/sumn2u/garbage-classification-v2)
dataset (version 8). Its `biological` class is used as **organic**. See
[Training & Evaluation](#training--evaluation).

**Preprocessing is inside the model.** The model already contains MobileNetV2's preprocessing
(`x / 127.5 − 1`), so the API sends **raw 0–255 RGB pixels**. Do not divide by 255 or call
`preprocess_input` — that would apply it twice and give wrong predictions.

The API resizes images the same way as training (`image_dataset_from_directory`):
`tf.image.resize` to 224×224, bilinear, no antialias, no crop. It additionally applies EXIF
rotation so phone photos are upright (training did not): decode with Pillow → EXIF rotation →
RGB → float32 → resize.

## Setup

Requires [uv](https://docs.astral.sh/uv/). TensorFlow needs Python 3.12 (it does not support 3.14).
Run from the `ml/` folder:

```bash
uv venv .venv --python 3.12
uv pip install -r requirements-dev.txt
```

`requirements.txt` has the runtime packages; `requirements-dev.txt` adds `pytest` and `httpx` for tests.

## Run the API

From `ml/`:

```bash
# Windows
.venv\Scripts\python -m uvicorn src.api.main:app --port 8000

# macOS / Linux
.venv/bin/python -m uvicorn src.api.main:app --port 8000
```

(Or activate the venv first and run `uvicorn src.api.main:app --port 8000`.)
Interactive docs: http://localhost:8000/docs

## Run the tests

From `ml/`:

```bash
.venv\Scripts\python -m pytest        # Windows
.venv/bin/python -m pytest            # macOS / Linux
```

The Colab comparison test checks every image listed in `tests/samples/expected.json`
(see `tests/samples/README.md`) and is skipped if that file is missing.

## Endpoints

### `GET /health`

```bash
curl http://localhost:8000/health
```

```json
{ "status": "ok", "model_loaded": true, "model_version": "swms_mobilenetv2_best" }
```

### `POST /predict`

Send the image as `multipart/form-data` in a field named `file`.
Accepted: **JPEG, PNG, WebP**, up to **5 MB**. The type is checked by decoding the image,
not by trusting the file name or content type.

```bash
curl -F "file=@tests/samples/plastic_101.jpg" http://localhost:8000/predict
```

```json
{
  "category": "plastic",
  "confidence": 0.9981,
  "probabilities": { "organic": 0.0011, "paper": 0.0008, "plastic": 0.9981 },
  "model_version": "swms_mobilenetv2_best"
}
```

`confidence` is the probability of the predicted `category`. Values are rounded to 4 decimals
(matching the database column `ai_confidence NUMERIC(5,4)`).

### Errors

All errors use the same format as the Express backend:

```json
{ "error": { "message": "Validation failed", "details": [{ "field": "file", "message": "Field required" }] } }
```

| Status | When |
|---|---|
| `400` | No `file` field, empty file, corrupt/truncated image, or image dimensions too large |
| `413` | File larger than 5 MB |
| `415` | Not a JPEG, PNG or WebP image (e.g. a text file or GIF) |
| `404` / `405` | Unknown route or wrong HTTP method |
| `500` | Unexpected server error (no internal details are returned) |

## Training & Evaluation

The model was trained in Google Colab (Python 3.13, GPU T4). The API runs on Python 3.12; both use
**tensorflow 2.21.0** and **keras 3.13.2**, so the saved model is compatible. The full run, with outputs, is in
[`notebooks/garbage_classification.ipynb`](notebooks/garbage_classification.ipynb). The same code is
also split into three plain scripts (see [Reproduce](#reproduce)). All numbers below come from
the notebook output and the files in [`results/`](results/).

### Dataset split

From Kaggle [Garbage Classification V2](https://www.kaggle.com/datasets/sumn2u/garbage-classification-v2)
(version 8), only the `biological` (→ `organic`), `paper` and `plastic` classes are used: 997 + 1,680 + 1,984
= 4,661 images, all of which opened without errors. Each class is split 70 / 15 / 15
(`train_test_split`, `random_state=42`):

| Class | Train | Validation | Test | Total |
|---|---|---|---|---|
| `organic` | 697 | 150 | 150 | 997 |
| `paper` | 1,175 | 252 | 253 | 1,680 |
| `plastic` | 1,388 | 298 | 298 | 1,984 |
| **Total** | **3,260** | **700** | **701** | **4,661** |

### Training

- MobileNetV2 with ImageNet weights, **frozen**; new head: `GlobalAveragePooling2D` → `Dropout(0.2)` →
  `Dense(3, softmax)` (3,843 trainable of 2,261,827 parameters)
- Adam (learning rate 0.001), `sparse_categorical_crossentropy`, batch size 32, 224×224 input
- 3 epochs, `ModelCheckpoint` on `val_loss` (best only), `EarlyStopping(patience=2, restore_best_weights=True)`

From [`results/metrics/training_history.csv`](results/metrics/training_history.csv):

| Epoch | Train accuracy | Train loss | Val accuracy | Val loss |
|---|---|---|---|---|
| 1 | 0.8899 | 0.2797 | 0.9757 | 0.0903 |
| 2 | 0.9678 | 0.0949 | 0.9743 | 0.0743 |
| 3 | 0.9801 | 0.0676 | 0.9857 | 0.0645 |

Validation loss improved every epoch, so the saved model is the one from epoch 3.

![Training curves](results/figures/training_curves.png)

### Test results

On the 701 test images: **accuracy 97.72%**, **loss 0.0800** — 685 correct, 16 wrong
([`results/metrics/test_metrics.json`](results/metrics/test_metrics.json)).

From [`results/metrics/classification_report.json`](results/metrics/classification_report.json):

| Class | Precision | Recall | F1-score | Support |
|---|---|---|---|---|
| `organic` | 0.9864 | 0.9667 | 0.9764 | 150 |
| `paper` | 0.9579 | 0.9881 | 0.9728 | 253 |
| `plastic` | 0.9898 | 0.9732 | 0.9814 | 298 |
| macro avg | 0.9780 | 0.9760 | 0.9769 | 701 |
| weighted avg | 0.9775 | 0.9772 | 0.9772 | 701 |

The most common mistake is plastic predicted as paper (8 of 298 plastic images),
see [`results/metrics/confusion_matrix.csv`](results/metrics/confusion_matrix.csv):

![Confusion matrix](results/figures/confusion_matrix.png)

### Reproduce

The scripts contain the notebook's code (without the earlier, abandoned 5-epoch experiment). Paths are
the Colab/Google Drive paths used in the notebook and are set as constants at the top of each script —
change them to run elsewhere. A GPU is recommended for training.

1. Install the training packages (from `ml/`): `pip install -r requirements-train.txt`.
   These are the versions from the Colab training runtime (Python 3.13). Use a separate environment
   from the API's `.venv` — the numpy version differs.
2. Download the dataset (needs a Kaggle API token in `~/.kaggle/kaggle.json`):
   ```bash
   kaggle datasets download sumn2u/garbage-classification-v2/8 -p /content/kaggle_raw --unzip
   ```
3. Run the three steps from `ml/`:
   ```bash
   python scripts/split_dataset.py        # filter 3 classes + 70/15/15 split
   python -m src.training.train           # train, save best model + training history/curves
   python -m src.evaluation.evaluate      # test metrics, classification report, confusion matrix
   ```

Results can differ slightly from the ones above: no global random seed was set for training, and the
split uses the file system's file order (the number of images per split is always the same).
Do not commit the downloaded dataset — `ml/dataset/` is gitignored.
