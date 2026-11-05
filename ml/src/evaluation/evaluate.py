"""Step 3 — evaluate the saved model on the test set (from notebooks/garbage_classification.ipynb).

Run from ml/:
    python -m src.evaluation.evaluate

Writes the same files as ml/results/:
    RESULTS_DIR/metrics/test_metrics.json
    RESULTS_DIR/metrics/classification_report.json
    RESULTS_DIR/metrics/confusion_matrix.csv
    RESULTS_DIR/figures/confusion_matrix.png
(training_history.csv and training_curves.png are written by src/training/train.py.)

The functions are reused by src/training/train_option_b.py, which also saves a grid of the
misclassified test images (save_misclassified).
"""

import csv
import json
import math
from pathlib import Path

import keras
import matplotlib.pyplot as plt
import numpy as np
import tensorflow as tf
from PIL import Image
from sklearn.metrics import ConfusionMatrixDisplay, classification_report, confusion_matrix

# Paths used in Colab — change these to run somewhere else.
DATASET_DIR = "/content/drive/MyDrive/SWMS/dataset_split"  # output of scripts/split_dataset.py
MODEL_PATH = "/content/drive/MyDrive/SWMS/models/swms_mobilenetv2_best.keras"
RESULTS_DIR = "/content/drive/MyDrive/SWMS/results"

IMG_SIZE = (224, 224)
BATCH_SIZE = 32


def load_test_dataset(dataset_dir=DATASET_DIR):
    # shuffle=False keeps the label order (and .file_paths) the same as the prediction order
    return tf.keras.utils.image_dataset_from_directory(
        f"{dataset_dir}/test", image_size=IMG_SIZE, batch_size=BATCH_SIZE, shuffle=False
    )


def write_json(path: Path, data: dict):
    with open(path, "w") as f:
        json.dump(data, f, indent=4)


def write_confusion_matrix(cm, class_names, metrics_dir: Path, figures_dir: Path, title="Confusion Matrix — Test Set"):
    with open(metrics_dir / "confusion_matrix.csv", "w", newline="") as f:
        writer = csv.writer(f, lineterminator="\n")
        writer.writerow(["", *(f"pred_{name}" for name in class_names)])
        for name, row in zip(class_names, cm):
            writer.writerow([f"true_{name}", *row])

    ConfusionMatrixDisplay(cm, display_labels=class_names).plot(cmap="Blues", values_format="d")
    plt.title(title)
    plt.savefig(figures_dir / "confusion_matrix.png", dpi=150, bbox_inches="tight")
    plt.close()


def predict_test_set(model, test_ds) -> dict:
    """One pass over the test set. Loss and accuracy are computed from the same probabilities
    (mean sparse categorical cross-entropy, and argmax == label), as model.evaluate would."""
    y_true = np.concatenate([labels.numpy() for _, labels in test_ds])
    y_prob = model.predict(test_ds, verbose=0)
    y_pred = np.argmax(y_prob, axis=1)
    loss = float(np.mean(keras.losses.sparse_categorical_crossentropy(y_true, y_prob)))
    accuracy = float(np.mean(y_true == y_pred))
    return {"y_true": y_true, "y_prob": y_prob, "y_pred": y_pred, "loss": loss, "accuracy": accuracy}


def evaluate_and_save(model, test_ds, class_names, results_dir, title="Confusion Matrix — Test Set") -> dict:
    """Predict the test set once and write test_metrics.json, classification_report.json and the
    confusion matrix (csv + png) under results_dir/metrics and results_dir/figures."""
    metrics_dir = Path(results_dir) / "metrics"
    figures_dir = Path(results_dir) / "figures"
    metrics_dir.mkdir(parents=True, exist_ok=True)
    figures_dir.mkdir(parents=True, exist_ok=True)

    result = predict_test_set(model, test_ds)
    y_true, y_pred = result["y_true"], result["y_pred"]
    print(f"Test accuracy: {result['accuracy']:.4f}, loss: {result['loss']:.4f}")

    write_json(metrics_dir / "test_metrics.json", {
        "test_loss": round(result["loss"], 4),
        "test_accuracy": round(result["accuracy"], 4),
        "test_images": int(len(y_true)),
        "correct_predictions": int(np.sum(y_true == y_pred)),
        "incorrect_predictions": int(np.sum(y_true != y_pred)),
        "classes": class_names,
    })

    report = classification_report(y_true, y_pred, target_names=class_names, output_dict=True, digits=4)
    write_json(metrics_dir / "classification_report.json", report)

    cm = confusion_matrix(y_true, y_pred, labels=range(len(class_names)))
    write_confusion_matrix(cm, class_names, metrics_dir, figures_dir, title)

    return {**result, "report": report, "confusion_matrix": cm}


def save_misclassified(file_paths, result, class_names, png_path: Path, csv_path: Path, title: str, max_images=48):
    """Grid of the misclassified test images (true → predicted, confidence) plus a CSV listing all of them.
    file_paths must be test_ds.file_paths of the same unshuffled test dataset that was predicted."""
    y_true, y_pred, y_prob = result["y_true"], result["y_pred"], result["y_prob"]
    wrong = np.where(y_true != y_pred)[0]
    # Most confident mistakes first: those are the most informative ones
    wrong = wrong[np.argsort(-y_prob[wrong].max(axis=1))]

    with open(csv_path, "w", newline="") as f:
        writer = csv.writer(f, lineterminator="\n")
        writer.writerow(["file", "true", "predicted", "confidence", *(f"p_{name}" for name in class_names)])
        for i in wrong:
            writer.writerow([
                "/".join(Path(file_paths[i]).parts[-2:]), class_names[y_true[i]], class_names[y_pred[i]],
                round(float(y_prob[i].max()), 4), *(round(float(p), 4) for p in y_prob[i]),
            ])

    shown = wrong[:max_images]
    if len(shown) == 0:
        print("No misclassified test images.")
        return wrong

    cols = min(6, len(shown))
    rows = math.ceil(len(shown) / cols)
    fig = plt.figure(figsize=(cols * 2.6, rows * 2.9))
    for n, i in enumerate(shown):
        ax = fig.add_subplot(rows, cols, n + 1)
        with Image.open(file_paths[i]) as image:
            ax.imshow(image.convert("RGB"))
        ax.set_title(
            f"{class_names[y_true[i]]} → {class_names[y_pred[i]]} ({y_prob[i].max():.2f})\n{Path(file_paths[i]).name}",
            fontsize=8,
        )
        ax.axis("off")
    extra = f" (showing {len(shown)} of {len(wrong)})" if len(wrong) > len(shown) else ""
    fig.suptitle(f"{title}: {len(wrong)} misclassified test images{extra}", fontsize=11)
    fig.tight_layout()
    fig.savefig(png_path, dpi=110, bbox_inches="tight")
    plt.close(fig)
    return wrong


def main():
    test_ds = load_test_dataset()
    model = keras.models.load_model(MODEL_PATH)
    evaluate_and_save(model, test_ds, test_ds.class_names, RESULTS_DIR)
    print("Evaluation results saved to:", RESULTS_DIR)


if __name__ == "__main__":
    main()
