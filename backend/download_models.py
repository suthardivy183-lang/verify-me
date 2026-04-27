from transformers import pipeline, CLIPModel, CLIPProcessor

print("-> haywoodsloan/ai-image-detector-deploy (EfficientNet)", flush=True)
pipeline("image-classification", model="haywoodsloan/ai-image-detector-deploy")

print("-> umm-maybe/AI-image-detector (ResNet50)", flush=True)
pipeline("image-classification", model="umm-maybe/AI-image-detector")

print("-> openai/clip-vit-base-patch32 (CLIP fallback)", flush=True)
CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

print("All model weights cached.", flush=True)
