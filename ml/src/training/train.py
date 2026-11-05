"""Step 2 — train the MobileNetV2 classifier (final run from notebooks/garbage_classification.ipynb).

The base MobileNetV2 (ImageNet weights) is frozen; only the new classification head is trained.
The best model by validation loss is saved to MODEL_PATH.

Run from ml/:
    python -m src.training.train

Writes:
    MODEL_PATH
    RESULTS_DIR/metrics/training_history.csv
    RESULTS_DIR/figures/training_curves.png
"""

import csv
from pathlib import Path

import matplotlib.pyplot as plt
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers

# Paths used in Colab — change these to run somewhere else.
DATASET_DIR = "/content/drive/MyDrive/SWMS/dataset_split"  # output of scripts/split_dataset.py
MODEL_PATH = "/content/drive/MyDrive/SWMS/models/swms_mobilenetv2_best.keras"
RESULTS_DIR = "/content/drive/MyDrive/SWMS/results"

IMG_SIZE = (224, 224)
BATCH_SIZE = 32
NUM_CLASSES = 3
SEED = 42
EPOCHS = 3
LEARNING_RATE = 0.001
DROPOUT_RATE = 0.2
EARLY_STOPPING_PATIENCE = 2


def load_datasets(dataset_dir=DATASET_DIR, return_raw=False):
    """Train (shuffled, seed=SEED) and validation datasets, prefetched.

    With return_raw=True the un-prefetched train dataset is returned as well, because only it
    has .file_paths and .class_names (used by Option B to count the training images per class).
    """
    # Class names come from the folder names in alphabetical order: organic, paper, plastic
    train_ds = tf.keras.utils.image_dataset_from_directory(
        f"{dataset_dir}/train", image_size=IMG_SIZE, batch_size=BATCH_SIZE, shuffle=True, seed=SEED
    )
    val_ds = tf.keras.utils.image_dataset_from_directory(
        f"{dataset_dir}/validation", image_size=IMG_SIZE, batch_size=BATCH_SIZE, shuffle=False
    )
    print("Class names:", train_ds.class_names)

    prefetched = (train_ds.prefetch(tf.data.AUTOTUNE), val_ds.prefetch(tf.data.AUTOTUNE))
    return (*prefetched, train_ds) if return_raw else prefetched


def build_model(learning_rate=LEARNING_RATE):
    base_model = tf.keras.applications.MobileNetV2(
        input_shape=(224, 224, 3), include_top=False, weights="imagenet"
    )
    base_model.trainable = False  # keep the pretrained weights frozen

    inputs = keras.Input(shape=(224, 224, 3))
    # MobileNetV2 preprocessing is part of the model, so it receives raw 0-255 pixels
    x = tf.keras.applications.mobilenet_v2.preprocess_input(inputs)
    x = base_model(x, training=False)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dropout(DROPOUT_RATE)(x)
    outputs = layers.Dense(NUM_CLASSES, activation="softmax")(x)

    model = keras.Model(inputs, outputs)
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=learning_rate),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    return model


def train(model, train_ds, val_ds):
    Path(MODEL_PATH).parent.mkdir(parents=True, exist_ok=True)

    checkpoint = keras.callbacks.ModelCheckpoint(
        filepath=MODEL_PATH, monitor="val_loss", save_best_only=True, verbose=1
    )
    early_stopping = keras.callbacks.EarlyStopping(
        monitor="val_loss", patience=EARLY_STOPPING_PATIENCE, restore_best_weights=True, verbose=1
    )

    return model.fit(train_ds, validation_data=val_ds, epochs=EPOCHS, callbacks=[checkpoint, early_stopping])


def write_history_csv(h: dict, path: Path):
    with open(path, "w", newline="") as f:
        writer = csv.writer(f, lineterminator="\n")
        writer.writerow(["epoch", *h.keys()])
        for epoch in range(len(h["loss"])):
            writer.writerow([epoch, *(h[key][epoch] for key in h)])


def save_history(history):
    metrics_dir = Path(RESULTS_DIR) / "metrics"
    figures_dir = Path(RESULTS_DIR) / "figures"
    metrics_dir.mkdir(parents=True, exist_ok=True)
    figures_dir.mkdir(parents=True, exist_ok=True)

    h = history.history  # keys: accuracy, loss, val_accuracy, val_loss
    write_history_csv(h, metrics_dir / "training_history.csv")

    fig, ax = plt.subplots(1, 2, figsize=(12, 4))
    ax[0].plot(h["accuracy"], label="train")
    ax[0].plot(h["val_accuracy"], label="val")
    ax[0].set_title("Accuracy")
    ax[0].legend()
    ax[1].plot(h["loss"], label="train")
    ax[1].plot(h["val_loss"], label="val")
    ax[1].set_title("Loss")
    ax[1].legend()
    fig.savefig(figures_dir / "training_curves.png", dpi=150, bbox_inches="tight")
    plt.close(fig)


def main():
    print("TensorFlow:", tf.__version__)
    print("GPU:", tf.config.list_physical_devices("GPU"))

    train_ds, val_ds = load_datasets()
    model = build_model()
    history = train(model, train_ds, val_ds)
    save_history(history)

    print("Best model saved to:", MODEL_PATH)


if __name__ == "__main__":
    main()
