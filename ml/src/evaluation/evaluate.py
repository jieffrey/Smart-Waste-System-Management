"""Step 3 — evaluate the saved model on the test set (from notebooks/garbage_classification.ipynb).

Run from ml/:
    python -m src.evaluation.evaluate

Writes the same files as ml/results/:
    RESULTS_DIR/metrics/test_metrics.json
    RESULTS_DIR/metrics/classification_report.json
    RESULTS_DIR/metrics/confusion_matrix.csv
    RESULTS_DIR/figures/confusion_matrix.png
(training_history.csv and training_curves.png are written by src/training/train.py.)
"""

import csv
import json
from pathlib import Path

import keras
import matplotlib.pyplot as plt
import numpy as np
import tensorflow as tf
from sklearn.metrics import ConfusionMatrixDisplay, classification_report, confusion_matrix

# Paths used in Colab — change these to run somewhere else.
DATASET_DIR = "/content/drive/MyDrive/SWMS/dataset_split"  # output of scripts/split_dataset.py
MODEL_PATH = "/content/drive/MyDrive/SWMS/models/swms_mobilenetv2_best.keras"
RESULTS_DIR = "/content/drive/MyDrive/SWMS/results"

IMG_SIZE = (224, 224)
BATCH_SIZE = 32


def load_test_dataset():
    # shuffle=False keeps the label order the same as the prediction order
    return tf.keras.utils.image_dataset_from_directory(
        f"{DATASET_DIR}/test", image_size=IMG_SIZE, batch_size=BATCH_SIZE, shuffle=False
    )


def write_json(path: Path, data: dict):
    with open(path, "w") as f:
        json.dump(data, f, indent=4)


def write_confusion_matrix(cm, class_names, metrics_dir: Path, figures_dir: Path):
    with open(metrics_dir / "confusion_matrix.csv", "w", newline="") as f:
        writer = csv.writer(f, lineterminator="\n")
        writer.writerow(["", *(f"pred_{name}" for name in class_names)])
        for name, row in zip(class_names, cm):
            writer.writerow([f"true_{name}", *row])

    ConfusionMatrixDisplay(cm, display_labels=class_names).plot(cmap="Blues", values_format="d")
    plt.title("Confusion Matrix — Test Set")
    plt.savefig(figures_dir / "confusion_matrix.png", dpi=150, bbox_inches="tight")
    plt.close()


def main():
    metrics_dir = Path(RESULTS_DIR) / "metrics"
    figures_dir = Path(RESULTS_DIR) / "figures"
    metrics_dir.mkdir(parents=True, exist_ok=True)
    figures_dir.mkdir(parents=True, exist_ok=True)

    test_ds = load_test_dataset()
    class_names = test_ds.class_names
    model = keras.models.load_model(MODEL_PATH)

    loss, accuracy = model.evaluate(test_ds, verbose=0)
    y_true = np.concatenate([labels.numpy() for _, labels in test_ds])
    y_pred = np.argmax(model.predict(test_ds, verbose=0), axis=1)
    print(f"Test accuracy: {accuracy:.4f}, loss: {loss:.4f}")

    write_json(metrics_dir / "test_metrics.json", {
        "test_loss": round(loss, 4),
        "test_accuracy": round(accuracy, 4),
        "test_images": int(len(y_true)),
        "correct_predictions": int(np.sum(y_true == y_pred)),
        "incorrect_predictions": int(np.sum(y_true != y_pred)),
        "classes": class_names,
    })

    report = classification_report(y_true, y_pred, target_names=class_names, output_dict=True, digits=4)
    write_json(metrics_dir / "classification_report.json", report)

    write_confusion_matrix(confusion_matrix(y_true, y_pred), class_names, metrics_dir, figures_dir)

    print("Evaluation results saved to:", RESULTS_DIR)


if __name__ == "__main__":
    main()
