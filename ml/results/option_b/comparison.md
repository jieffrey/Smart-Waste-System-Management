# Current model vs Option B (same 701-image test set)

| Metric | Current model | Option B | Δ (B − current) | Better |
|---|---|---|---|---|
| Test accuracy | 0.9772 | 0.9829 | +0.0057 | higher |
| Test loss | 0.0800 | 0.0611 | -0.0189 | lower |
| Macro F1 | 0.9769 | 0.9818 | +0.0050 | higher |
| Macro recall | 0.9760 | 0.9827 | +0.0067 | higher |
| Recall `organic` | 0.9667 | 0.9800 | +0.0133 | higher |
| Recall `paper` | 0.9881 | 0.9881 | 0.0000 | higher |
| Recall `plastic` | 0.9732 | 0.9799 | +0.0067 | higher |
| Precision `organic` | 0.9864 | 0.9735 | -0.0129 | higher |
| Precision `paper` | 0.9579 | 0.9766 | +0.0187 | higher |
| Precision `plastic` | 0.9898 | 0.9932 | +0.0034 | higher |
| Errors (of 701) | 16 | 12 | -4 | lower |
| `plastic` → `paper` errors | 8 | 5 | -3 | lower |

## Confusion matrix — current model

| True \ Predicted | `organic` | `paper` | `plastic` |
|---|---|---|---|
| `organic` | 145 | 3 | 2 |
| `paper` | 2 | 250 | 1 |
| `plastic` | 0 | 8 | 290 |

## Confusion matrix — Option B

| True \ Predicted | `organic` | `paper` | `plastic` |
|---|---|---|---|
| `organic` | 147 | 1 | 2 |
| `paper` | 3 | 250 | 0 |
| `plastic` | 1 | 5 | 292 |

Baseline reproduced in this run: **True**
