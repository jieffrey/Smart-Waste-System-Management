# Demo photos: attribution and license

The 48 photos in this folder are used by `scripts/seed-demo.js` for the production demo data.

| | |
|---|---|
| Dataset | **Garbage Classification V2** |
| Author | **sumn2u** (Kaggle) |
| Source | <https://www.kaggle.com/datasets/sumn2u/garbage-classification-v2> |
| Version used | **8** (the version the SWMS model was trained on) |
| License | **MIT**, as labelled on the dataset's Kaggle page |

**Changes made to the images:** each one was taken from the `biological`, `paper` or `plastic` folder,
rotated upright by its EXIF orientation, converted to RGB, resized so the longest side is at most **1024 px**,
and saved as JPEG (quality 85) **with all metadata removed** (no EXIF, GPS, XMP or ICC data). File names were
changed to the demo keys below.

**Which split:** the photos come from the ML model's **test** split, so the model never saw them in training:
- "test (confirmed)": images the Colab evaluation of the current model lists as misclassified test images
  (Option B notebook run, `ml/results/option_b/current_model/metrics/misclassified.csv`), plus the 3 parity
  samples in `ml/tests/samples/`.
- "test (local split re-run)": picked from a local re-run of `ml/scripts/split_dataset.py`. The Colab split can't
  be rebuilt exactly (it depends on file-system order), so these may have been training images in the Colab run.

The dataset is partly made of images collected from the web, so the MIT label is the dataset author's claim and
couldn't be checked image by image. If an
image needs to be removed, replace it here (or point `DEMO_PHOTOS_DIR` at another folder with the same file names).

## License (MIT)

Kaggle shows the license as "MIT" without a copyright line. The standard MIT License text follows, with the
dataset author as the copyright holder.

```
MIT License

Copyright (c) sumn2u

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Files

| Photo | Original file (dataset v8) | Split |
|---|---|---|
| `org-01.jpg` | `biological/biological_773.jpg` | test (confirmed) |
| `org-02.jpg` | `biological/biological_239.jpg` | test (confirmed) |
| `org-03.jpg` | `biological/biological_102.jpg` | test (confirmed) |
| `org-04.jpg` | `biological/biological_265.jpg` | test (local split re-run) |
| `org-05.jpg` | `biological/biological_301.jpg` | test (local split re-run) |
| `org-06.jpg` | `biological/biological_850.jpg` | test (local split re-run) |
| `org-07.jpg` | `biological/biological_83.jpg` | test (local split re-run) |
| `org-08.jpg` | `biological/biological_584.jpg` | test (local split re-run) |
| `org-09.jpg` | `biological/biological_806.jpg` | test (local split re-run) |
| `org-10.jpg` | `biological/biological_905.jpg` | test (local split re-run) |
| `org-11.jpg` | `biological/biological_557.jpg` | test (local split re-run) |
| `org-12.jpg` | `biological/biological_37.jpg` | test (local split re-run) |
| `org-13.jpg` | `biological/biological_431.jpg` | test (local split re-run) |
| `org-14.jpg` | `biological/biological_623.jpg` | test (local split re-run) |
| `org-15.jpg` | `biological/biological_211.jpg` | test (local split re-run) |
| `org-16.jpg` | `biological/biological_518.jpg` | test (local split re-run) |
| `pap-01.jpg` | `paper/paper_2183.jpg` | test (confirmed) |
| `pap-02.jpg` | `paper/paper_2576.jpg` | test (confirmed) |
| `pap-03.jpg` | `paper/paper_1000.jpg` | test (confirmed) |
| `pap-04.jpg` | `paper/paper_981.jpg` | test (local split re-run) |
| `pap-05.jpg` | `paper/paper_1978.jpg` | test (local split re-run) |
| `pap-06.jpg` | `paper/paper_2289.jpg` | test (local split re-run) |
| `pap-07.jpg` | `paper/paper_2670.jpg` | test (local split re-run) |
| `pap-08.jpg` | `paper/paper_656.jpg` | test (local split re-run) |
| `pap-09.jpg` | `paper/paper_795.jpg` | test (local split re-run) |
| `pap-10.jpg` | `paper/paper_1819.jpg` | test (local split re-run) |
| `pap-11.jpg` | `paper/paper_2768.jpg` | test (local split re-run) |
| `pap-12.jpg` | `paper/paper_2511.jpg` | test (local split re-run) |
| `pap-13.jpg` | `paper/paper_992.jpg` | test (local split re-run) |
| `pap-14.jpg` | `paper/paper_2470.jpg` | test (local split re-run) |
| `pap-15.jpg` | `paper/paper_2873.jpg` | test (local split re-run) |
| `pap-16.jpg` | `paper/paper_1972.jpg` | test (local split re-run) |
| `pla-01.jpg` | `plastic/plastic_1864.jpg` | test (confirmed) |
| `pla-02.jpg` | `plastic/plastic_615.jpg` | test (confirmed) |
| `pla-03.jpg` | `plastic/plastic_101.jpg` | test (confirmed) |
| `pla-04.jpg` | `plastic/plastic_925.jpg` | test (local split re-run) |
| `pla-05.jpg` | `plastic/plastic_269.jpg` | test (local split re-run) |
| `pla-06.jpg` | `plastic/plastic_948.jpg` | test (local split re-run) |
| `pla-07.jpg` | `plastic/plastic_908.jpg` | test (local split re-run) |
| `pla-08.jpg` | `plastic/plastic_2184.jpg` | test (local split re-run) |
| `pla-09.jpg` | `plastic/plastic_496.jpg` | test (local split re-run) |
| `pla-10.jpg` | `plastic/plastic_268.jpg` | test (local split re-run) |
| `pla-11.jpg` | `plastic/plastic_1828.jpg` | test (local split re-run) |
| `pla-12.jpg` | `plastic/plastic_722.jpg` | test (local split re-run) |
| `pla-13.jpg` | `plastic/plastic_1875.jpg` | test (local split re-run) |
| `pla-14.jpg` | `plastic/plastic_1916.jpg` | test (local split re-run) |
| `pla-15.jpg` | `plastic/plastic_184.jpg` | test (local split re-run) |
| `pla-16.jpg` | `plastic/plastic_393.jpg` | test (local split re-run) |
