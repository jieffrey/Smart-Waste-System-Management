# Sample images for the optional Colab comparison test

`test_predict_matches_colab` runs once per entry in `expected.json`. When `expected.json`
is missing, the test is skipped automatically.

For each entry it calls `/predict` with the image of that name in this folder and checks that:

- the predicted `category` matches, and
- every class probability is within ±0.01 of the Colab value (`PROBABILITY_TOLERANCE` in
  `test_predict.py`).

Format (keys are file names; probabilities from Colab using `tf.io.decode_image` + `tf.image.resize`):

```json
{
  "plastic_101.jpg": {
    "category": "plastic",
    "probabilities": { "organic": 0.001, "paper": 0.0007, "plastic": 0.9983 }
  }
}
```

All three classes (`organic`, `paper`, `plastic`) must be present in `probabilities`.
