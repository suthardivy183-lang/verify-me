# Models

Place model weight files here. They are gitignored (*.h5) due to file size.

## xception_5o.h5

- **Architecture**: Xception (fine-tuned on FaceForensics++)
- **Size**: ~143 MB
- **Purpose**: Model 1 in the ensemble — face-swap deepfake detection (10% weight)
- **Set path in .env**: `IMAGE_MODEL_PATH=/absolute/path/to/models/xception_5o.h5`

The two primary models (`haywoodsloan/ai-image-detector-deploy` and `umm-maybe/AI-image-detector`)
are downloaded automatically from HuggingFace on first run — no manual setup needed.
