"""Step 1 — prepare the dataset (from notebooks/garbage_classification.ipynb).

1. Copy the 3 Kaggle classes we use (biological, paper, plastic) into one folder per class.
2. Split each class 70% train / 15% validation / 15% test, renaming biological -> organic.

Before running, download "Garbage Classification V2" (version 8) from Kaggle:
    kaggle datasets download sumn2u/garbage-classification-v2/8 -p /content/kaggle_raw --unzip

Run from ml/:
    python scripts/split_dataset.py

Notebook result: organic train=697 validation=150 test=150, paper 1175/252/253, plastic 1388/298/298.
"""

import os
import shutil
from collections import Counter
from pathlib import Path

from sklearn.model_selection import train_test_split

# Paths used in Colab — change these to run somewhere else.
KAGGLE_DIR = Path("/content/kaggle_raw")  # unzipped Kaggle download
FILTERED_DIR = Path("/content/garbage_dataset")  # biological/, paper/, plastic/
OUTPUT_DIR = Path("/content/drive/MyDrive/SWMS/dataset_split")  # train/, validation/, test/

# Kaggle folder name -> label used by the model
CLASS_MAPPING = {
    "biological": "organic",
    "paper": "paper",
    "plastic": "plastic",
}

IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp")
TRAIN_SIZE = 0.70  # the remaining 30% is split in half: 15% validation, 15% test
RANDOM_STATE = 42


def filter_categories() -> Counter:
    """Copy every image of the 3 classes into FILTERED_DIR/<kaggle class>/."""
    if FILTERED_DIR.exists():
        shutil.rmtree(FILTERED_DIR)

    for category in CLASS_MAPPING:
        (FILTERED_DIR / category).mkdir(parents=True, exist_ok=True)

    counts = Counter()

    for image_path in KAGGLE_DIR.rglob("*"):
        if not image_path.is_file() or image_path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue

        # The class is the nearest parent folder named biological, paper or plastic
        folders = image_path.relative_to(KAGGLE_DIR).parts[:-1]
        category = next((part.lower() for part in reversed(folders) if part.lower() in CLASS_MAPPING), None)
        if category is None:
            continue

        # Avoid overwriting files that have the same name
        destination = FILTERED_DIR / category / image_path.name
        counter = 1
        while destination.exists():
            destination = FILTERED_DIR / category / f"{image_path.stem}_{counter}{image_path.suffix}"
            counter += 1

        shutil.copy2(image_path, destination)
        counts[category] += 1

    return counts


def split_class(kaggle_class: str, model_class: str) -> dict:
    """Split one class into train/validation/test folders under OUTPUT_DIR."""
    source_dir = FILTERED_DIR / kaggle_class

    # Note: like the notebook, this uses os.listdir order. The counts per split are always the same,
    # but which files land in which split can differ on another file system.
    images = [name for name in os.listdir(source_dir) if name.lower().endswith(IMAGE_EXTENSIONS)]

    train_images, temporary_images = train_test_split(
        images, test_size=(1 - TRAIN_SIZE), random_state=RANDOM_STATE, shuffle=True
    )
    val_images, test_images = train_test_split(
        temporary_images, test_size=0.5, random_state=RANDOM_STATE, shuffle=True
    )

    splits = {"train": train_images, "validation": val_images, "test": test_images}

    for split_name, filenames in splits.items():
        destination_dir = OUTPUT_DIR / split_name / model_class
        destination_dir.mkdir(parents=True, exist_ok=True)

        for filename in filenames:
            shutil.copy2(source_dir / filename, destination_dir / filename)

    return splits


def main():
    counts = filter_categories()
    total = sum(counts.values())
    if total == 0:
        raise ValueError(f"No images found in {KAGGLE_DIR}. Check the Kaggle download.")

    print("Filtered images:")
    for category in CLASS_MAPPING:
        print(f"  {category}: {counts[category]}")
    print(f"  total: {total}")

    print("\nSplit:")
    for kaggle_class, model_class in CLASS_MAPPING.items():
        splits = split_class(kaggle_class, model_class)
        print(
            f"  {model_class}: train={len(splits['train'])}, "
            f"validation={len(splits['validation'])}, test={len(splits['test'])}"
        )

    print("\nDataset saved to:", OUTPUT_DIR)


if __name__ == "__main__":
    main()
