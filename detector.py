import os
import re
from collections import Counter
from functools import lru_cache

import cv2
import numpy as np
from PIL import ExifTags, Image, UnidentifiedImageError


MODEL_INPUT_SIZE = (224, 224)
LOW_FAKE_THRESHOLD = 0.4
HIGH_FAKE_THRESHOLD = 0.6
MAX_FALLBACK_CONFIDENCE = 0.40
MAX_DOCUMENT_BYTES = 2_000_000


def _clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return max(minimum, min(maximum, float(value)))


def _percent(value: float) -> str:
    return f"{_clamp(value) * 100:.2f}%"


def _risk_level(fake_score: float) -> str:
    if fake_score >= 0.75:
        return "High"
    if fake_score >= 0.5:
        return "Medium"
    if fake_score >= 0.25:
        return "Low"
    return "Minimal"


def _classify_fake_score(fake_score: float, model_loaded: bool) -> str:
    if not model_loaded:
        return "Uncertain"
    if fake_score < LOW_FAKE_THRESHOLD:
        return "Likely Real"
    if fake_score > HIGH_FAKE_THRESHOLD:
        return "Likely Fake"
    return "Uncertain"


def _prediction_confidence(fake_score: float, prediction: str, source: str) -> float:
    if source != "model":
        return MAX_FALLBACK_CONFIDENCE
    return 1.0 - fake_score


@lru_cache(maxsize=1)
def load_model() -> dict:
    model_path = os.getenv("IMAGE_MODEL_PATH", "").strip()
    print(f"Model path: {model_path or 'not set'}", flush=True)

    if not model_path:
        print("Model loaded status: false", flush=True)
        print("Model load error: IMAGE_MODEL_PATH is not set", flush=True)
        return {
            "model": None,
            "model_loaded": False,
            "model_path": "",
            "error": "IMAGE_MODEL_PATH is not set",
        }

    if not os.path.exists(model_path):
        print("Model loaded status: false", flush=True)
        print(f"Model load error: IMAGE_MODEL_PATH does not exist: {model_path}", flush=True)
        return {
            "model": None,
            "model_loaded": False,
            "model_path": model_path,
            "error": f"IMAGE_MODEL_PATH does not exist: {model_path}",
        }

    try:
        from tensorflow.keras.models import load_model as keras_load_model

        model = keras_load_model(model_path)
    except Exception as exc:
        print("Model loaded status: false", flush=True)
        print(f"Model load error: {exc}", flush=True)
        return {
            "model": None,
            "model_loaded": False,
            "model_path": model_path,
            "error": str(exc),
        }

    print("Model loaded status: true", flush=True)
    return {
        "model": model,
        "model_loaded": True,
        "model_path": model_path,
        "error": "",
    }


def _open_image(image_path: str) -> Image.Image:
    try:
        return Image.open(image_path).convert("RGB")
    except (OSError, UnidentifiedImageError, ValueError) as exc:
        raise ValueError("Invalid image file") from exc


def preprocess_image(image: Image.Image) -> np.ndarray:
    image = image.convert("RGB").resize(MODEL_INPUT_SIZE, Image.Resampling.LANCZOS)
    image_array = np.asarray(image, dtype=np.float32) / 255.0

    expected_shape = (MODEL_INPUT_SIZE[1], MODEL_INPUT_SIZE[0], 3)
    if image_array.shape != expected_shape:
        raise ValueError(f"Invalid preprocessed image shape: {image_array.shape}")

    model_input = np.expand_dims(image_array, axis=0)
    expected_input_shape = (1, MODEL_INPUT_SIZE[1], MODEL_INPUT_SIZE[0], 3)
    if model_input.shape != expected_input_shape:
        raise ValueError(f"Invalid model input shape: {model_input.shape}")

    return model_input


def _extract_probability(raw_prediction) -> float:
    prediction_array = np.asarray(raw_prediction, dtype=np.float32)

    if prediction_array.size == 1:
        probability = float(prediction_array.reshape(-1)[0])
    else:
        probability_index = int(os.getenv("MODEL_PROBABILITY_INDEX", "1"))
        flat_prediction = prediction_array.reshape(-1)
        if probability_index < 0 or probability_index >= flat_prediction.size:
            raise RuntimeError(
                f"MODEL_PROBABILITY_INDEX {probability_index} is out of range "
                f"for prediction shape {prediction_array.shape}"
            )
        probability = float(flat_prediction[probability_index])

    if not np.isfinite(probability):
        raise RuntimeError(f"Model returned a non-finite probability: {probability}")
    if probability < -1e-6 or probability > 1 + 1e-6:
        raise RuntimeError(f"Model returned probability outside [0, 1]: {probability}")

    return _clamp(probability)


def _normalize_model_probability(probability: float) -> float:
    high_value_label = os.getenv("MODEL_HIGH_VALUE_LABEL", "fake").strip().lower()
    if high_value_label not in {"fake", "real"}:
        raise RuntimeError('MODEL_HIGH_VALUE_LABEL must be either "fake" or "real"')
    return probability if high_value_label == "fake" else 1.0 - probability


def predict_image(image: Image.Image) -> dict:
    model_state = load_model()
    if not model_state["model_loaded"]:
        print("Prediction source: fallback", flush=True)
        return {
            "source": "fallback",
            "model_loaded": False,
            "model_path": model_state["model_path"],
            "raw_prediction": None,
            "fake_probability": None,
            "fallback_reason": model_state["error"],
            "reliability_score": 0.0,
        }

    try:
        model_input = preprocess_image(image)
        raw_prediction = _extract_probability(model_state["model"].predict(model_input, verbose=0))
        fake_probability = _normalize_model_probability(raw_prediction)
    except Exception as exc:
        print("Prediction source: fallback", flush=True)
        print(f"Model prediction error: {exc}", flush=True)
        return {
            "source": "fallback",
            "model_loaded": False,
            "model_path": model_state["model_path"],
            "raw_prediction": None,
            "fake_probability": None,
            "fallback_reason": f"model prediction failed: {exc}",
            "reliability_score": 0.0,
        }

    print("Prediction source: model", flush=True)
    print(f"Raw prediction value: {raw_prediction:.8f}", flush=True)

    return {
        "source": "model",
        "model_loaded": True,
        "model_path": model_state["model_path"],
        "raw_prediction": raw_prediction,
        "fake_probability": fake_probability,
        "model_high_value_label": os.getenv("MODEL_HIGH_VALUE_LABEL", "fake").strip().lower(),
        "input_shape": [1, MODEL_INPUT_SIZE[1], MODEL_INPUT_SIZE[0], 3],
        "fallback_reason": "",
        "reliability_score": 0.92,
    }


def analyze_metadata(image_path: str) -> dict:
    try:
        image = Image.open(image_path)
        exif = image.getexif()
    except (OSError, UnidentifiedImageError, ValueError):
        return {
            "metadata_status": "unreadable",
            "metadata_score": 0.20,
            "fields": {},
            "flags": ["metadata_unreadable"],
        }

    if not exif:
        return {
            "metadata_status": "missing",
            "metadata_score": 0.15,
            "fields": {},
            "flags": ["exif_missing"],
        }

    fields = {}
    for tag_id, value in exif.items():
        tag_name = ExifTags.TAGS.get(tag_id, str(tag_id))
        fields[tag_name] = str(value)[:300]

    metadata_text = " ".join(fields.values()).lower()
    generated_markers = ["stable diffusion", "midjourney", "dall-e", "dalle", "ai generated", "comfyui", "automatic1111"]
    editing_markers = ["photoshop", "lightroom", "gimp", "canva"]

    flags = []
    metadata_score = 0.0
    if any(marker in metadata_text for marker in generated_markers):
        flags.append("ai_generator_metadata")
        metadata_score = max(metadata_score, 0.85)
    if any(marker in metadata_text for marker in editing_markers):
        flags.append("editing_software_metadata")
        metadata_score = max(metadata_score, 0.35)

    return {
        "metadata_status": "suspicious" if flags else "present",
        "metadata_score": metadata_score,
        "field_count": len(fields),
        "fields": fields,
        "flags": flags,
    }


def analyze_heuristics(image: Image.Image) -> dict:
    rgb = np.asarray(image.convert("RGB"), dtype=np.float32)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    noise = float(np.std(gray - blur))

    height, width = gray.shape
    dct_gray = gray[: height - (height % 2), : width - (width % 2)]
    if dct_gray.size == 0:
        raise ValueError("Image is too small to analyze")

    dct = cv2.dct(dct_gray / 255.0)
    high_freq = dct[32:, 32:]
    high_frequency_energy = float(np.mean(np.abs(high_freq))) if high_freq.size else 0.0
    channel_std = float(np.std(rgb[:, :, 0]))

    heuristic_score = 0.0
    if noise < 2.5:
        heuristic_score += 0.35
    if high_frequency_energy < 0.001:
        heuristic_score += 0.35
    if channel_std < 30:
        heuristic_score += 0.30

    return {
        "heuristic_score": _clamp(heuristic_score),
        "noise": noise,
        "dct_high_freq_energy": high_frequency_energy,
        "channel_std": channel_std,
    }


def fuse_results(model_result: dict, metadata_result: dict, heuristic_result: dict) -> dict:
    source = model_result["source"]
    model_loaded = bool(model_result["model_loaded"])
    metadata_score = metadata_result["metadata_score"]
    heuristic_score = heuristic_result["heuristic_score"]

    if model_loaded:
        model_score = model_result["fake_probability"]
        metadata_plus_heuristics_score = _clamp((metadata_score * 0.70) + (heuristic_score * 0.30))
        final_fake_score = _clamp((model_score * 0.80) + (metadata_plus_heuristics_score * 0.20))
        reliability_score = _clamp(0.86 + (0.06 if metadata_result["metadata_status"] == "present" else 0.0))
    else:
        model_score = None
        final_fake_score = _clamp((metadata_score * 0.50) + (heuristic_score * 0.50))
        reliability_score = 0.25

    prediction = _classify_fake_score(final_fake_score, model_loaded)
    confidence = _prediction_confidence(final_fake_score, prediction, source)

    if source == "fallback":
        confidence = min(confidence, MAX_FALLBACK_CONFIDENCE)

    print(f"Final fake score: {final_fake_score:.8f}", flush=True)
    print(f"Final label: {prediction}", flush=True)

    return {
        "prediction": prediction,
        "confidence": _percent(confidence),
        "source": source,
        "model_loaded": model_loaded,
        "reliability_score": round(reliability_score, 4),
        "fake_probability": final_fake_score,
        "metadata_status": metadata_result["metadata_status"],
        "risk_level": _risk_level(final_fake_score),
        "risk_score": int(round(final_fake_score * 100)),
        "verdict": prediction if prediction == "Uncertain" else prediction.upper(),
        "details": {
            "fake_probability": final_fake_score,
            "model_score": model_score,
            "metadata_score": metadata_score,
            "heuristic_score": heuristic_score,
            "metadata_status": metadata_result["metadata_status"],
            "model": model_result,
            "metadata": metadata_result,
            "heuristics": heuristic_result,
            "fusion": {
                "model_weight": 0.80 if model_loaded else 0.0,
                "metadata_plus_heuristics_weight": 0.20 if model_loaded else 1.0,
                "metadata_weight_inside_secondary_score": 0.70,
                "heuristic_weight_inside_secondary_score": 0.30,
                "final_fake_score": final_fake_score,
            },
        },
    }


def _format_image_result(fused: dict) -> dict:
    return {
        "type": "image",
        "prediction": fused["prediction"],
        "confidence": fused["confidence"],
        "source": fused["source"],
        "model_loaded": fused["model_loaded"],
        "reliability_score": fused["reliability_score"],
        "metadata_status": fused["metadata_status"],
        "risk_level": fused["risk_level"],
        "details": fused["details"],
        "risk_score": fused["risk_score"],
        "verdict": fused["verdict"],
        "signals": {
            "fake_score": fused["fake_probability"],
            "source": fused["source"],
            "model_loaded": fused["model_loaded"],
            "reliability_score": fused["reliability_score"],
            "metadata_status": fused["metadata_status"],
            "model_score": fused["details"]["model_score"],
            "metadata_score": fused["details"]["metadata_score"],
            "heuristic_score": fused["details"]["heuristic_score"],
        },
    }


def analyze_image(image_path: str) -> dict:
    image = _open_image(image_path)
    model_result = predict_image(image)
    metadata_result = analyze_metadata(image_path)
    heuristic_result = analyze_heuristics(image)
    fused = fuse_results(model_result, metadata_result, heuristic_result)
    return _format_image_result(fused)


def _finalize_fallback_result(asset_type: str, fake_score: float, details: dict, reliability_score: float) -> dict:
    fake_score = _clamp(fake_score)
    confidence = min(reliability_score, MAX_FALLBACK_CONFIDENCE)

    print(f"Final fake score: {fake_score:.8f}", flush=True)
    print("Prediction source: fallback", flush=True)
    print("Final label: Uncertain", flush=True)

    return {
        "type": asset_type,
        "prediction": "Uncertain",
        "confidence": _percent(confidence),
        "source": "fallback",
        "model_loaded": False,
        "reliability_score": round(_clamp(reliability_score), 4),
        "metadata_status": details.get("metadata_status", "not_applicable"),
        "risk_level": _risk_level(fake_score),
        "details": details,
        "risk_score": int(round(fake_score * 100)),
        "verdict": "Uncertain",
        "signals": {
            "fake_score": fake_score,
            "source": "fallback",
            "model_loaded": False,
            "reliability_score": round(_clamp(reliability_score), 4),
            "risk_level": _risk_level(fake_score),
            "metadata_status": details.get("metadata_status", "not_applicable"),
        },
    }


def _extract_document_text(document_path: str) -> dict:
    with open(document_path, "rb") as document_file:
        raw_bytes = document_file.read(MAX_DOCUMENT_BYTES + 1)

    truncated = len(raw_bytes) > MAX_DOCUMENT_BYTES
    raw_bytes = raw_bytes[:MAX_DOCUMENT_BYTES]

    if not raw_bytes:
        raise ValueError("Document is empty")

    if raw_bytes.startswith(b"%PDF"):
        text = raw_bytes.decode("latin-1", errors="ignore")
        text = re.sub(r"[^A-Za-z0-9.,!?;:'\"()\\s-]+", " ", text)
        extraction_method = "basic_pdf_text_scan"
    else:
        text = raw_bytes.decode("utf-8", errors="ignore")
        if not text.strip():
            text = raw_bytes.decode("latin-1", errors="ignore")
        extraction_method = "plain_text_decode"

    text = re.sub(r"\s+", " ", text).strip()
    return {"text": text, "byte_count": len(raw_bytes), "truncated": truncated, "extraction_method": extraction_method}


def _document_text_analysis(text: str) -> dict:
    if not text:
        raise ValueError("No readable document text found")

    words = re.findall(r"[A-Za-z0-9']+", text.lower())
    sentences = [sentence.strip() for sentence in re.split(r"[.!?]+", text) if sentence.strip()]
    word_count = len(words)
    unique_words = len(set(words))
    unique_word_ratio = unique_words / word_count if word_count else 0.0
    repeated_words = sum(count - 1 for count in Counter(words).values() if count > 3)
    repetition_ratio = repeated_words / word_count if word_count else 0.0
    sentence_lengths = [len(re.findall(r"[A-Za-z0-9']+", sentence)) for sentence in sentences]
    avg_sentence_length = float(np.mean(sentence_lengths)) if sentence_lengths else 0.0
    sentence_length_std = float(np.std(sentence_lengths)) if sentence_lengths else 0.0
    repeated_phrases = Counter(" ".join(words[index : index + 4]) for index in range(max(0, len(words) - 3)))
    repeated_phrase_count = sum(1 for count in repeated_phrases.values() if count >= 3)

    unnatural_patterns = []
    if word_count < 40:
        unnatural_patterns.append("too_short_for_reliable_detection")
    if word_count >= 80 and unique_word_ratio < 0.35:
        unnatural_patterns.append("low_vocabulary_diversity")
    if repetition_ratio > 0.18:
        unnatural_patterns.append("high_word_repetition")
    if repeated_phrase_count > 2:
        unnatural_patterns.append("repeated_phrase_blocks")
    if len(sentences) >= 5 and sentence_length_std < 3:
        unnatural_patterns.append("overly_uniform_sentence_lengths")

    fake_score = 0.0
    fake_score += 0.20 if word_count < 40 else 0.0
    fake_score += 0.30 if unique_word_ratio < 0.35 and word_count >= 80 else 0.0
    fake_score += min(repetition_ratio * 1.4, 0.30)
    fake_score += min(repeated_phrase_count * 0.08, 0.20)
    fake_score += 0.15 if len(sentences) >= 5 and sentence_length_std < 3 else 0.0

    return {
        "fake_probability": _clamp(fake_score),
        "metrics": {
            "character_count": len(text),
            "word_count": word_count,
            "sentence_count": len(sentences),
            "unique_word_ratio": unique_word_ratio,
            "repetition_ratio": repetition_ratio,
            "avg_sentence_length": avg_sentence_length,
            "sentence_length_std": sentence_length_std,
            "repeated_phrase_count": repeated_phrase_count,
        },
        "unnatural_patterns": unnatural_patterns,
    }


def analyze_document(document_path: str) -> dict:
    extracted = _extract_document_text(document_path)
    text_analysis = _document_text_analysis(extracted["text"])
    details = {
        "fake_probability": text_analysis["fake_probability"],
        "metadata_status": "not_applicable",
        "fallback_reason": "document ML detector is not configured; using local text heuristics",
        "metadata": {
            "byte_count": extracted["byte_count"],
            "truncated": extracted["truncated"],
            "extraction_method": extracted["extraction_method"],
        },
        "text_analysis": text_analysis,
        "external_api": {
            "enabled": False,
            "provider": None,
            "score": None,
            "note": "Hook external AI document detection APIs here.",
            "text_preview_chars": min(len(extracted["text"]), 500),
        },
    }
    result = _finalize_fallback_result("document", text_analysis["fake_probability"], details, 0.40)
    result["signals"].update(text_analysis["metrics"])
    return result


def _sample_video_frames(video_path: str) -> dict:
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Could not open video: {video_path}")

    max_frames = max(1, int(os.getenv("VIDEO_MAX_FRAMES", "12")))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    fps = float(cap.get(cv2.CAP_PROP_FPS) or 0.0)

    if total_frames > 0:
        frame_indexes = np.linspace(0, max(total_frames - 1, 0), num=min(max_frames, total_frames), dtype=int)
    else:
        frame_indexes = np.arange(max_frames, dtype=int) * 30

    frames = []
    try:
        for frame_index in frame_indexes:
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(frame_index))
            ok, frame = cap.read()
            if not ok:
                continue
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            frames.append({"frame_index": int(frame_index), "image": Image.fromarray(rgb_frame)})
    finally:
        cap.release()

    if not frames:
        raise ValueError("No readable video frames found")

    return {"frames": frames, "total_frames": total_frames, "fps": fps, "sampled_frames": len(frames)}


def analyze_video(video_path: str) -> dict:
    sampled = _sample_video_frames(video_path)
    frame_results = []

    for frame in sampled["frames"]:
        model_result = predict_image(frame["image"])
        heuristic_result = analyze_heuristics(frame["image"])
        frame_score = model_result["fake_probability"] if model_result["model_loaded"] else heuristic_result["heuristic_score"]
        frame_results.append(
            {
                "frame_index": frame["frame_index"],
                "fake_probability": frame_score,
                "source": model_result["source"],
                "model_loaded": model_result["model_loaded"],
                "raw_prediction": model_result["raw_prediction"],
                "heuristics": heuristic_result,
            }
        )

    model_frames = [frame for frame in frame_results if frame["model_loaded"]]
    frame_scores = [frame["fake_probability"] for frame in frame_results]
    aggregate_score = float(np.mean(frame_scores))
    model_loaded = bool(model_frames)
    source = "model" if model_loaded else "fallback"

    details = {
        "fake_probability": aggregate_score,
        "metadata_status": "not_applicable",
        "metadata": {
            "total_frames": sampled["total_frames"],
            "fps": sampled["fps"],
            "sampled_frames": sampled["sampled_frames"],
        },
        "frame_analysis": {
            "aggregate_score": aggregate_score,
            "model_frame_count": len(model_frames),
            "fallback_frame_count": len(frame_results) - len(model_frames),
            "min_score": float(np.min(frame_scores)),
            "max_score": float(np.max(frame_scores)),
            "score_std": float(np.std(frame_scores)),
            "frames": frame_results,
        },
    }

    if not model_loaded:
        result = _finalize_fallback_result("video", aggregate_score, details, 0.30)
    else:
        prediction = _classify_fake_score(aggregate_score, True)
        confidence = _prediction_confidence(aggregate_score, prediction, "model")
        result = {
            "type": "video",
            "prediction": prediction,
            "confidence": _percent(confidence),
            "source": source,
            "model_loaded": True,
            "reliability_score": round(len(model_frames) / len(frame_results), 4),
            "metadata_status": "not_applicable",
            "risk_level": _risk_level(aggregate_score),
            "details": details,
            "risk_score": int(round(aggregate_score * 100)),
            "verdict": prediction if prediction == "Uncertain" else prediction.upper(),
            "signals": {
                "fake_score": aggregate_score,
                "source": source,
                "model_loaded": True,
                "sampled_frames": sampled["sampled_frames"],
                "model_frame_count": len(model_frames),
                "fallback_frame_count": len(frame_results) - len(model_frames),
            },
        }

    return result


analyze_photo = analyze_image
