# CYCLONEX AI/ML Models Directory

This directory stores PyTorch model weights for the CYCLONEX AI Cyclone Analysis Layer.

## Expected Models

1. **`cyclone_detection_model.pt`**: Binary/Presence classification model for cyclone identification in satellite image patches.
2. **`cyclone_pattern_model.pt`**: Multi-class pattern classifier for Dvorak/satellite lifecycle patterns (`curved_band`, `central_dense_overcast`, `eye_formation`, `mature_eye`, `sheared_system`, `weakening_system`).
3. **`cyclone_intensity_model.pt`**: Temporal CNN+LSTM regressor for predicting intensity (+6h, +12h, +24h wind speed and central pressure) and track displacement coordinates.

## Status

If these model files are absent, the CYCLONEX inference engine automatically reports `status: "MODEL_NOT_TRAINED"` and falls back cleanly to physics-based baseline estimates without generating fake predictions.

To train these models, run the scripts in `training/`:
- `python training/train_pattern_classifier.py`
- `python training/train_intensity_model.py`
