"""Option B experiment: class weights + two-phase fine-tuning of MobileNetV2.

Reuses the current pipeline (src/training/train.py, src/evaluation/evaluate.py), so the split,
the preprocessing inside the model and the head are exactly the same as the served model:
    - same dataset_split/ folder on Google Drive (checked: counts per split and the 3 parity samples)
    - same image_dataset_from_directory loading (224x224 bilinear, batch 32, seed 42 shuffle)
    - same model graph (preprocess_input inside the model → raw 0-255 pixels, so the API is unchanged)

What is new:
    1. Global seeds (Python, NumPy, TensorFlow) set and logged.
    2. Class weights from the TRAIN split only (balanced: total / (classes × count)).
    3. Phase 1: frozen base, head trained with class weights, up to 20 epochs, EarlyStopping + checkpoint.
    4. Phase 2: top of the base unfrozen from FINE_TUNE_FROM (BatchNorm stays frozen), Adam 1e-5,
       class weights, up to 20 epochs, EarlyStopping + checkpoint.
    5. The final model is the phase checkpoint with the lowest VALIDATION loss.
    6. The test set is evaluated once, at the end. The current model is evaluated on the same test
       set only as the baseline for the comparison (it is not changed or retrained).

It never touches the served model: the result is a NEW file (OPTION_B_MODEL_NAME), and
models/swms_mobilenetv2_best.keras is only read.

Run from ml/ (Colab, GPU):
    python -m src.training.train_option_b
or step by step from notebooks/train_option_b.ipynb.

Everything is written under OUTPUT_ROOT with the same layout as ml/, so the zip unpacks into ml/:
    OUTPUT_ROOT/models/swms_mobilenetv2_option_b.keras
    OUTPUT_ROOT/results/option_b/...
"""

import json
import os
import platform
import random
import shutil
from collections import Counter
from pathlib import Path

import keras
import matplotlib.pyplot as plt
import numpy as np
import sklearn
import tensorflow as tf
from sklearn.utils.class_weight import compute_class_weight

from src.evaluation import evaluate
from src.training import train

# Paths used in Colab — change these to run somewhere else.
DATASET_DIR = train.DATASET_DIR  # the same dataset_split/ folder the current model used
OUTPUT_ROOT = Path("/content/drive/MyDrive/SWMS/option_b")  # mirrors ml/
ML_DIR = Path(__file__).resolve().parents[2]  # the cloned repo's ml/ folder
CURRENT_MODEL_PATH = ML_DIR / "models" / "swms_mobilenetv2_best.keras"  # read only (baseline)
SAMPLES_DIR = ML_DIR / "tests" / "samples"

OPTION_B_MODEL_NAME = "swms_mobilenetv2_option_b.keras"
MODEL_PATH = OUTPUT_ROOT / "models" / OPTION_B_MODEL_NAME
RESULTS_DIR = OUTPUT_ROOT / "results" / "option_b"
CHECKPOINT_DIR = OUTPUT_ROOT / "checkpoints"  # stays on Drive, not copied into the repo

SEED = train.SEED  # 42, also used for the training-set shuffle like before
DETERMINISTIC_OPS = False  # True = bit-for-bit reruns on GPU, but slower (and some ops may refuse)

PHASE1_EPOCHS = 20
PHASE1_LEARNING_RATE = train.LEARNING_RATE  # 0.001, as before
PHASE2_EPOCHS = 20
PHASE2_LEARNING_RATE = 1e-5  # 100× lower than phase 1, so the pretrained features change only gently
EARLY_STOPPING_PATIENCE = 3

# Fine-tuning cut point (see the notebook for the reasoning):
# block_13_expand is where MobileNetV2's last stage starts (stride 32, 7×7 feature maps).
# That stage (blocks 13–16 + Conv_1) holds the most ImageNet-specific, high-level features; the
# earlier stages (edges, textures, simple shapes) transfer well and stay frozen. Of the base's
# 154 layers this unfreezes the top 38 (layer index 116 onward); 13 of them are BatchNorm and stay
# frozen, leaving 25 trainable layers.
FINE_TUNE_FROM = "block_13_expand"

# Counts of the split the current model was trained/evaluated on (ml/README.md, section 1)
EXPECTED_COUNTS = {
    "train": {"organic": 697, "paper": 1175, "plastic": 1388},
    "validation": {"organic": 150, "paper": 252, "plastic": 298},
    "test": {"organic": 150, "paper": 253, "plastic": 298},
}
PARITY_SAMPLES = {"biological_102.jpg": "organic", "paper_1000.jpg": "paper", "plastic_101.jpg": "plastic"}

# Current model on the same test set (ml/results/metrics/confusion_matrix.csv), to check that the
# test set in Drive really is the one the baseline numbers came from.
BASELINE_CONFUSION_MATRIX = [[145, 3, 2], [2, 250, 1], [0, 8, 290]]

assert MODEL_PATH.resolve() != CURRENT_MODEL_PATH.resolve(), "Option B must never overwrite the served model"


# ---------------------------------------------------------------- setup

def set_global_seeds(seed=SEED) -> dict:
    os.environ["PYTHONHASHSEED"] = str(seed)
    random.seed(seed)
    np.random.seed(seed)
    tf.random.set_seed(seed)
    keras.utils.set_random_seed(seed)  # sets all three again; kept explicit above for readability
    if DETERMINISTIC_OPS:
        tf.config.experimental.enable_op_determinism()
    seeds = {
        "python_random": seed, "numpy": seed, "tensorflow": seed, "PYTHONHASHSEED": seed,
        "dataset_shuffle": train.SEED, "deterministic_ops": DETERMINISTIC_OPS,
    }
    print("Seeds:", seeds)
    if not DETERMINISTIC_OPS:
        print("Note: GPU kernels (cuDNN) can still be non-deterministic, so reruns may differ slightly.")
    return seeds


def environment_info() -> dict:
    info = {
        "python": platform.python_version(),
        "tensorflow": tf.__version__,
        "keras": keras.__version__,
        "numpy": np.__version__,
        "scikit_learn": sklearn.__version__,
        "gpus": [gpu.name for gpu in tf.config.list_physical_devices("GPU")],
    }
    try:
        info["gpu_name"] = tf.config.experimental.get_device_details(tf.config.list_physical_devices("GPU")[0]).get("device_name")
    except (IndexError, ValueError):
        info["gpu_name"] = None
    print("Environment:", info)
    return info


def check_split(dataset_dir) -> dict:
    """Fail fast if the split differs from the one the current model used."""
    # Same file types image_dataset_from_directory loads
    extensions = (".bmp", ".gif", ".jpeg", ".jpg", ".png")
    counts = {}
    for split, expected in EXPECTED_COUNTS.items():
        counts[split] = {
            name: sum(f.lower().endswith(extensions) for f in os.listdir(Path(dataset_dir) / split / name))
            for name in expected
        }
        print(f"{split:<10} {counts[split]}")
    assert counts == EXPECTED_COUNTS, f"Split counts differ from the current model's split: {counts}"

    for filename, class_name in PARITY_SAMPLES.items():
        path = Path(dataset_dir) / "test" / class_name / filename
        assert path.exists(), f"Parity sample missing from the test split: {path}"
    print("Split OK: same counts as the current model, and the 3 parity samples are in test/.")
    return counts


# ---------------------------------------------------------------- class weights

def compute_train_class_weights(raw_train_ds) -> dict:
    """Balanced weights from the TRAIN files only: total / (classes × count)."""
    class_names = raw_train_ds.class_names
    labels = np.array([class_names.index(Path(p).parent.name) for p in raw_train_ds.file_paths])
    classes = np.arange(len(class_names))
    weights = compute_class_weight("balanced", classes=classes, y=labels)
    counts = Counter(labels.tolist())

    print("Class weights (train split only, balanced = total / (classes × count)):")
    for i, name in enumerate(class_names):
        print(f"  {name:<8} count={counts[i]:>5}  weight={weights[i]:.4f}")
    return {int(i): float(w) for i, w in zip(classes, weights)}


# ---------------------------------------------------------------- model

def get_base_model(model):
    # The MobileNetV2 base is the only nested Model inside the graph built by train.build_model()
    return next(layer for layer in model.layers if isinstance(layer, keras.Model))


def trainable_param_count(model) -> int:
    return int(sum(np.prod(w.shape) for w in model.trainable_weights))


def unfreeze_top(model, from_layer=FINE_TUNE_FROM, learning_rate=PHASE2_LEARNING_RATE) -> dict:
    """Unfreeze the base from `from_layer` onward, keep every BatchNorm layer frozen, recompile."""
    base = get_base_model(model)
    names = [layer.name for layer in base.layers]
    cut = names.index(from_layer)

    base.trainable = True
    for i, layer in enumerate(base.layers):
        # BatchNorm stays frozen: its moving statistics come from ImageNet, and the batch statistics of
        # 32 waste photos would be too noisy. (train.build_model also calls the base with training=False,
        # so BatchNorm runs in inference mode either way.)
        layer.trainable = i >= cut and not isinstance(layer, keras.layers.BatchNormalization)

    # Recompiling is required for the trainable changes to take effect
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=learning_rate),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )

    top = base.layers[cut:]
    info = {
        "fine_tune_from": from_layer,
        "fine_tune_from_index": cut,
        "base_layers": len(base.layers),
        "unfrozen_layers": len(top),
        "batchnorm_kept_frozen": sum(isinstance(layer, keras.layers.BatchNormalization) for layer in top),
        "trainable_layers_in_base": sum(layer.trainable for layer in base.layers),
        "trainable_params": trainable_param_count(model),
        "learning_rate": learning_rate,
    }
    print("Phase 2 fine-tuning:", info)
    return info


def fit_phase(model, train_ds, val_ds, class_weight, epochs, checkpoint_path, initial_value_threshold=None):
    checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
    callbacks = [
        keras.callbacks.ModelCheckpoint(
            filepath=str(checkpoint_path), monitor="val_loss", save_best_only=True, verbose=1,
            # Phase 2 only saves a checkpoint if it beats phase 1's best validation loss
            initial_value_threshold=initial_value_threshold,
        ),
        keras.callbacks.EarlyStopping(
            monitor="val_loss", patience=EARLY_STOPPING_PATIENCE, restore_best_weights=True, verbose=1
        ),
    ]
    # class_weight only weights the TRAINING loss; val_loss stays the plain (unweighted) loss,
    # so model selection is comparable with the current model.
    return model.fit(train_ds, validation_data=val_ds, epochs=epochs, class_weight=class_weight, callbacks=callbacks)


def best_epoch(history) -> dict:
    h = history.history
    i = int(np.argmin(h["val_loss"]))
    return {"epoch": i + 1, "epochs_run": len(h["val_loss"]), "val_loss": float(h["val_loss"][i]),
            "val_accuracy": float(h["val_accuracy"][i])}


def select_final_model(phase1_history, phase2_history) -> dict:
    """Pick the phase with the lowest validation loss (the test set plays no part) and save it as MODEL_PATH."""
    p1, p2 = best_epoch(phase1_history), best_epoch(phase2_history)
    phase2_checkpoint = CHECKPOINT_DIR / "phase2_best.keras"
    use_phase2 = p2["val_loss"] < p1["val_loss"] and phase2_checkpoint.exists()
    chosen = phase2_checkpoint if use_phase2 else CHECKPOINT_DIR / "phase1_best.keras"

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(chosen, MODEL_PATH)
    selection = {"phase1_best": p1, "phase2_best": p2, "selected_phase": 2 if use_phase2 else 1,
                 "rule": "lowest validation loss"}
    print("Selection:", selection)
    print("Option B model saved to:", MODEL_PATH)
    return selection


# ---------------------------------------------------------------- results

def save_histories(phase1_history, phase2_history):
    metrics_dir = RESULTS_DIR / "metrics"
    figures_dir = RESULTS_DIR / "figures"
    metrics_dir.mkdir(parents=True, exist_ok=True)
    figures_dir.mkdir(parents=True, exist_ok=True)

    h1, h2 = phase1_history.history, phase2_history.history
    train.write_history_csv(h1, metrics_dir / "training_history_phase1.csv")
    train.write_history_csv(h2, metrics_dir / "training_history_phase2.csv")

    n1 = len(h1["loss"])
    x1 = np.arange(1, n1 + 1)
    x2 = np.arange(n1 + 1, n1 + len(h2["loss"]) + 1)
    fig, axes = plt.subplots(1, 2, figsize=(13, 4.2))
    for ax, key, title in [(axes[0], "accuracy", "Accuracy"), (axes[1], "loss", "Loss")]:
        ax.plot(x1, h1[key], "o-", color="tab:blue", label="phase 1 train")
        ax.plot(x1, h1[f"val_{key}"], "o--", color="tab:orange", label="phase 1 val")
        ax.plot(x2, h2[key], "s-", color="tab:green", label="phase 2 train")
        ax.plot(x2, h2[f"val_{key}"], "s--", color="tab:red", label="phase 2 val")
        ax.axvline(n1 + 0.5, color="grey", linestyle=":", linewidth=1)
        ax.set_title(f"{title} (phase 1: frozen base | phase 2: fine-tuning)")
        ax.set_xlabel("epoch (both phases)")
        ax.legend(fontsize=8)
    fig.tight_layout()
    fig.savefig(figures_dir / "training_curves.png", dpi=150, bbox_inches="tight")
    plt.show()
    plt.close(fig)


def colab_parity_samples(model) -> dict:
    """Same method as the original notebook (cell 28): tf.io.decode_image + tf.image.resize.
    Written in the format of tests/samples/expected.json, in case Option B becomes the served model."""
    expected = {}
    for filename, class_name in PARITY_SAMPLES.items():
        path = str(Path(DATASET_DIR) / "test" / class_name / filename)
        image = tf.io.decode_image(tf.io.read_file(path), channels=3, expand_animations=False)
        image = tf.image.resize(image, train.IMG_SIZE)
        probs = model.predict(tf.expand_dims(image, 0), verbose=0)[0]
        names = ["organic", "paper", "plastic"]
        expected[filename] = {
            "category": names[int(np.argmax(probs))],
            "probabilities": {name: round(float(p), 4) for name, p in zip(names, probs)},
        }
    evaluate.write_json(RESULTS_DIR / "metrics" / "expected_option_b.json", expected)
    print(json.dumps(expected, indent=2))
    return expected


def final_evaluation(test_ds, class_names) -> dict:
    """The single test-set evaluation of Option B, plus the current model as the baseline."""
    file_paths = test_ds.file_paths
    figures_dir = RESULTS_DIR / "figures"
    metrics_dir = RESULTS_DIR / "metrics"

    option_b = evaluate.evaluate_and_save(
        keras.models.load_model(MODEL_PATH), test_ds, class_names, RESULTS_DIR,
        title="Option B — Confusion Matrix (test set)",
    )
    evaluate.save_misclassified(
        file_paths, option_b, class_names, figures_dir / "misclassified.png", metrics_dir / "misclassified.csv",
        title="Option B",
    )

    # Baseline: the served model, read only, on the same test set. Its files go to a separate folder
    # so nothing in ml/results/ (the documented baseline) is overwritten.
    baseline_dir = RESULTS_DIR / "current_model"
    current = evaluate.evaluate_and_save(
        keras.models.load_model(CURRENT_MODEL_PATH), test_ds, class_names, baseline_dir,
        title="Current model — Confusion Matrix (test set)",
    )
    evaluate.save_misclassified(
        file_paths, current, class_names, baseline_dir / "figures" / "misclassified.png",
        baseline_dir / "metrics" / "misclassified.csv", title="Current model",
    )
    reproduced = current["confusion_matrix"].tolist() == BASELINE_CONFUSION_MATRIX
    if reproduced:
        print("Baseline reproduced: the current model gives the documented confusion matrix on this test set.")
    else:
        print("WARNING: the current model does NOT reproduce the documented confusion matrix "
              f"{BASELINE_CONFUSION_MATRIX}; got {current['confusion_matrix'].tolist()}. "
              "The test set or the TF/Keras versions differ — treat the comparison with care.")
    return {"option_b": option_b, "current": current, "baseline_reproduced": reproduced}


def comparison_table(evaluation: dict, class_names) -> str:
    rows = []

    def add(label, current, option_b, fmt="{:.4f}", better="higher"):
        delta = option_b - current
        sign = "+" if delta > 0 else ""
        rows.append((label, fmt.format(current), fmt.format(option_b), f"{sign}{fmt.format(delta)}", better))

    cur, ob = evaluation["current"], evaluation["option_b"]
    add("Test accuracy", cur["accuracy"], ob["accuracy"])
    add("Test loss", cur["loss"], ob["loss"], better="lower")
    add("Macro F1", cur["report"]["macro avg"]["f1-score"], ob["report"]["macro avg"]["f1-score"])
    add("Macro recall", cur["report"]["macro avg"]["recall"], ob["report"]["macro avg"]["recall"])
    for name in class_names:
        add(f"Recall `{name}`", cur["report"][name]["recall"], ob["report"][name]["recall"])
    for name in class_names:
        add(f"Precision `{name}`", cur["report"][name]["precision"], ob["report"][name]["precision"])
    add(f"Errors (of {len(cur['y_true'])})", int((cur["y_true"] != cur["y_pred"]).sum()), int((ob["y_true"] != ob["y_pred"]).sum()),
        fmt="{:d}", better="lower")
    i, j = class_names.index("plastic"), class_names.index("paper")
    add("`plastic` → `paper` errors", int(cur["confusion_matrix"][i, j]), int(ob["confusion_matrix"][i, j]),
        fmt="{:d}", better="lower")

    lines = ["| Metric | Current model | Option B | Δ (B − current) | Better |", "|---|---|---|---|---|"]
    lines += [f"| {' | '.join(row)} |" for row in rows]

    def matrix(cm):
        out = ["| True \\ Predicted | " + " | ".join(f"`{n}`" for n in class_names) + " |",
               "|---|" + "---|" * len(class_names)]
        out += [f"| `{n}` | " + " | ".join(str(v) for v in row) + " |" for n, row in zip(class_names, cm)]
        return out

    text = "\n".join([
        f"# Current model vs Option B (same {len(cur['y_true'])}-image test set)", "",
        *lines, "",
        "## Confusion matrix — current model", "", *matrix(cur["confusion_matrix"]), "",
        "## Confusion matrix — Option B", "", *matrix(ob["confusion_matrix"]), "",
        f"Baseline reproduced in this run: **{evaluation['baseline_reproduced']}**",
    ])
    (RESULTS_DIR / "comparison.md").write_text(text + "\n", encoding="utf-8")

    evaluate.write_json(RESULTS_DIR / "metrics" / "comparison.json", {
        "baseline_reproduced": evaluation["baseline_reproduced"],
        "rows": [dict(zip(["metric", "current", "option_b", "delta", "better"], row)) for row in rows],
        "confusion_matrix": {"current": cur["confusion_matrix"].tolist(), "option_b": ob["confusion_matrix"].tolist()},
    })
    return text


def write_run_config(**sections):
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    config = {
        "model_file": OPTION_B_MODEL_NAME,
        "dataset_dir": DATASET_DIR,
        "img_size": list(train.IMG_SIZE),
        "batch_size": train.BATCH_SIZE,
        "dropout": train.DROPOUT_RATE,
        "early_stopping_patience": EARLY_STOPPING_PATIENCE,
        "phase1": {"epochs_max": PHASE1_EPOCHS, "learning_rate": PHASE1_LEARNING_RATE, "base": "frozen"},
        "phase2": {"epochs_max": PHASE2_EPOCHS, "learning_rate": PHASE2_LEARNING_RATE},
        **sections,
    }
    evaluate.write_json(RESULTS_DIR / "run_config.json", config)


def make_zip() -> Path:
    """option_b_artifacts.zip next to OUTPUT_ROOT; unzip it inside ml/ (contains models/ and results/option_b/)."""
    staging = OUTPUT_ROOT.parent / "option_b_zip_staging"
    shutil.rmtree(staging, ignore_errors=True)
    (staging / "models").mkdir(parents=True)
    shutil.copyfile(MODEL_PATH, staging / "models" / OPTION_B_MODEL_NAME)
    shutil.copytree(RESULTS_DIR, staging / "results" / "option_b")
    archive = shutil.make_archive(str(OUTPUT_ROOT.parent / "option_b_artifacts"), "zip", staging)
    shutil.rmtree(staging)
    print("Download:", archive)
    return Path(archive)


# ---------------------------------------------------------------- full run

def main():
    seeds = set_global_seeds()
    env = environment_info()
    check_split(DATASET_DIR)

    train_ds, val_ds, raw_train_ds = train.load_datasets(DATASET_DIR, return_raw=True)
    class_names = raw_train_ds.class_names
    class_weight = compute_train_class_weights(raw_train_ds)

    model = train.build_model(learning_rate=PHASE1_LEARNING_RATE)
    phase1_params = trainable_param_count(model)
    h1 = fit_phase(model, train_ds, val_ds, class_weight, PHASE1_EPOCHS, CHECKPOINT_DIR / "phase1_best.keras")

    fine_tune = unfreeze_top(model)
    h2 = fit_phase(model, train_ds, val_ds, class_weight, PHASE2_EPOCHS, CHECKPOINT_DIR / "phase2_best.keras",
                   initial_value_threshold=best_epoch(h1)["val_loss"])

    selection = select_final_model(h1, h2)
    save_histories(h1, h2)
    write_run_config(seeds=seeds, environment=env, class_weight={class_names[k]: v for k, v in class_weight.items()},
                     phase1_trainable_params=phase1_params, fine_tuning=fine_tune, selection=selection)

    test_ds = evaluate.load_test_dataset(DATASET_DIR)
    colab_parity_samples(keras.models.load_model(MODEL_PATH))
    evaluation = final_evaluation(test_ds, class_names)
    print(comparison_table(evaluation, class_names))
    make_zip()


if __name__ == "__main__":
    main()
