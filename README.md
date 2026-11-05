# Smart-Waste-System-Management

Smart Waste Management System: a mobile app for reporting waste, an admin web panel, an Express API and an
ML image classifier.

| Folder | What it is |
|---|---|
| [`backend/`](backend/) | Express API (Neon PostgreSQL) |
| [`web/`](web/) | Admin web app (Next.js) |
| [`Mobile/`](Mobile/) | User mobile app (Expo) |
| [`ml/`](ml/) | Waste classifier (MobileNetV2 + FastAPI): see the [ML Development Process](ml/README.md#ml-development-process) |
| [`docs/`](docs/) | Documentation, including the [security audit](docs/security-audit.md) |

## Credits

- **Waste images:** [Garbage Classification V2](https://www.kaggle.com/datasets/sumn2u/garbage-classification-v2)
  by sumn2u on Kaggle (version 8), **MIT license**. The model was trained on its `biological`, `paper` and `plastic`
  images. The repository includes 3 test samples (`ml/tests/samples/`) and 48 resized, metadata-free demo photos
  (`backend/scripts/demo/photos/`, see [ATTRIBUTION.md](backend/scripts/demo/photos/ATTRIBUTION.md)).
- **Model base:** MobileNetV2 with ImageNet weights, from Keras Applications.
