"""Asli — Multilingual Gemini explainer.

Replaces the old "Gemini-as-classifier" role. The detection ensemble is now
authoritative for the verdict and confidence score; this module's job is to
explain that verdict in plain language (English + a target Indian language)
with concrete observed artifacts and a media-literacy tip.

Public API:
    generate_explanation(image_bytes, fake_prob, features, target_language="hi") -> dict

Always returns a dict matching the strict schema below. Never raises.

Schema:
    {
      "verdict": "Asli" | "Nakli" | "Shak hai",
      "confidence_pct": int 0-100,
      "explanation_en": str (3-4 sentences),
      "explanation_local": str (same content in target_language),
      "red_flags": list[str] (specific artifacts),
      "learn_more_tip": str (one tip in target_language),
      "source": "gemini" | "template",
    }
"""

from __future__ import annotations

import copy
import hashlib
import io
import json
import os
import re
from collections import OrderedDict
from typing import Any, Optional


VALID_LANGUAGES = ("hi", "gu", "en")
DEFAULT_LANGUAGE = "hi"

LANGUAGE_NAMES = {
    "hi": "Hindi (Devanagari script)",
    "gu": "Gujarati (Gujarati script)",
    "en": "English",
}

CACHE_MAX_SIZE = 1000
_CACHE: "OrderedDict[str, dict]" = OrderedDict()


# ───────────────────────── verdict mapping ─────────────────────────

def _verdict_and_confidence(fake_prob: float) -> tuple[str, int]:
    """Map ensemble fake_probability → (verdict_label, confidence_pct).

    Bands match the existing detector thresholds: <0.35 = Asli,
    >0.68 = Nakli, in-between = Shak hai (uncertain).
    """
    if fake_prob >= 0.68:
        return "Nakli", min(99, max(65, int(round(fake_prob * 100))))
    if fake_prob <= 0.35:
        return "Asli", min(99, max(65, int(round((1.0 - fake_prob) * 100))))
    return "Shak hai", 50


# ───────────────────────── cache ─────────────────────────

def _cache_key(image_bytes: bytes, target_language: str, fake_prob: float) -> str:
    h = hashlib.sha256()
    h.update(image_bytes)
    h.update(b"|")
    h.update(target_language.encode("utf-8"))
    h.update(b"|")
    h.update(f"{round(fake_prob, 3)}".encode("utf-8"))
    return h.hexdigest()


def _cache_get(key: str) -> Optional[dict]:
    if key in _CACHE:
        _CACHE.move_to_end(key)
        return copy.deepcopy(_CACHE[key])
    return None


def _cache_set(key: str, value: dict) -> None:
    _CACHE[key] = copy.deepcopy(value)
    _CACHE.move_to_end(key)
    while len(_CACHE) > CACHE_MAX_SIZE:
        _CACHE.popitem(last=False)


def cache_clear() -> None:
    _CACHE.clear()


def cache_size() -> int:
    return len(_CACHE)


# ───────────────────────── prompt ─────────────────────────

PROMPT_TEMPLATE = """You are Asli, an AI-content verification expert who helps Indian users
spot AI-generated and manipulated images. Your audience is non-technical:
think WhatsApp forwards, election-season imagery, celebrity deepfakes,
Instagram influencer photos.

Our detection ensemble has already produced a verdict. Your job is NOT to
overrule it — your job is to EXPLAIN it in plain language (English + {language_name})
by pointing to specific visual artifacts you observe in the image.

ENSEMBLE VERDICT
- Verdict: {verdict}
- Confidence: {confidence_pct}%
- Raw fake_probability: {fake_prob:.4f}

UNDERLYING SIGNAL SCORES
{features_json}

INSTRUCTIONS
1. Look at the image carefully.
2. Decide what SPECIFIC visual artifacts are present. Look for:
   skin texture (pore detail, sheen, smoothness),
   eye and pupil consistency, hair edges and stray strands,
   ear shape and earring symmetry, jewelry and clothing fabric weave,
   hand / finger / nail anatomy and count, shadow direction and softness,
   background coherence (signs, text, doorways, furniture continuity),
   reflections (mirrors, sunglasses, water).
3. Write a 3-4 sentence explanation in plain English that connects the
   verdict to the SPECIFIC artifacts you see. If verdict is "Asli", explain
   what photographic qualities suggest authenticity. If "Nakli", point to
   the concrete AI tells. If "Shak hai", say what makes it ambiguous.
4. Translate the SAME explanation into {language_name}, preserving meaning
   and tone. Use natural conversational phrasing, not literal word-for-word.
5. List 2-4 SPECIFIC red flags (or supporting signals if Asli) as short
   phrases. Each MUST name a concrete observation, not a category.
   GOOD: "uneven pupil sizes", "skin lacks visible pores",
         "earring asymmetric between left and right ear",
         "fingers blend into the dumbbell handle".
   BAD : "AI artifacts", "looks synthetic", "lighting issue",
         "image appears manipulated".
6. Provide ONE media-literacy tip in {language_name} that helps the user
   spot similar fakes in the future. Keep it practical and culturally
   relevant to an Indian audience.

OUTPUT
Respond with ONLY valid JSON matching this exact schema. No prose, no
markdown fences, no extra keys:
{{
  "explanation_en": "<3-4 sentences>",
  "explanation_local": "<same explanation in {language_name}>",
  "red_flags": ["<phrase 1>", "<phrase 2>", "<phrase 3>"],
  "learn_more_tip": "<one tip in {language_name}>"
}}"""


# ───────────────────────── Gemini call ─────────────────────────

def _log(msg: str) -> None:
    print(f"[Asli Gemini Explainer] {msg}", flush=True)


def _strip_json_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _extract_response_text(response: Any) -> str:
    text = getattr(response, "text", "") or ""
    if text:
        return text
    for cand in (getattr(response, "candidates", None) or []):
        content = getattr(cand, "content", None)
        parts = getattr(content, "parts", None) if content else None
        if not parts:
            continue
        joined = "".join(str(getattr(p, "text", "") or "") for p in parts)
        if joined:
            return joined
    return ""


def _call_gemini(
    image_bytes: bytes,
    fake_prob: float,
    features: dict,
    target_language: str,
    verdict: str,
    confidence_pct: int,
) -> Optional[dict]:
    """Try to get a structured explanation from Gemini. Returns the partial
    payload (without verdict/confidence — those come from the ensemble) or
    None on any failure. Never raises."""
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None

    try:
        import google.generativeai as genai
        from PIL import Image
    except Exception as exc:
        _log(f"import failed: {exc}")
        return None

    try:
        genai.configure(api_key=api_key)
        model_name = (os.getenv("GEMINI_MODEL_NAME", "gemini-2.5-flash").strip()
                      or "gemini-2.5-flash")
        model = genai.GenerativeModel(model_name)

        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        prompt = PROMPT_TEMPLATE.format(
            language_name=LANGUAGE_NAMES[target_language],
            verdict=verdict,
            confidence_pct=confidence_pct,
            fake_prob=fake_prob,
            features_json=json.dumps(features, indent=2, default=str),
        )
        response = model.generate_content([prompt, image])

        text = _strip_json_fences(_extract_response_text(response))
        if not text:
            return None

        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end <= start:
            return None
        payload = json.loads(text[start : end + 1])

        for key in ("explanation_en", "explanation_local", "red_flags", "learn_more_tip"):
            if key not in payload:
                return None
        if not isinstance(payload["red_flags"], list):
            payload["red_flags"] = [str(payload["red_flags"])]

        return payload
    except Exception as exc:
        _log(f"call failed: {type(exc).__name__}: {exc}")
        return None


# ───────────────────────── deterministic fallback ─────────────────────────

TEMPLATES = {
    "Asli": {
        "en": (
            "The image shows photographic qualities consistent with a real camera capture: "
            "natural sensor noise, coherent lighting, and realistic micro-detail in textures. "
            "Our detection ensemble found no strong AI signatures across {n_models} models. "
            "While no detector is perfect, the available evidence supports authenticity."
        ),
        "hi": (
            "तस्वीर में असली कैमरे से ली गई फ़ोटो जैसी विशेषताएँ दिख रही हैं — "
            "स्वाभाविक sensor noise, संगत प्रकाश, और बारीक texture डिटेल। "
            "हमारे {n_models} models में से किसी ने भी कोई मज़बूत AI-जनित संकेत नहीं पाया। "
            "कोई भी detector पूरी तरह सटीक नहीं होता, फिर भी उपलब्ध सबूत असली होने की पुष्टि करते हैं।"
        ),
        "gu": (
            "તસવીરમાં સાચા કેમેરાથી લીધેલા ફોટા જેવી લાક્ષણિકતાઓ દેખાય છે — "
            "કુદરતી sensor noise, સુસંગત પ્રકાશ, અને ઝીણી texture વિગતો. "
            "અમારા {n_models} models માંથી કોઈએ મજબૂત AI-જનરેટ સંકેત જોયો નથી. "
            "કોઈ ડિટેક્ટર સંપૂર્ણ નથી, પણ ઉપલબ્ધ પુરાવા અસલીપણાનું સમર્થન કરે છે."
        ),
    },
    "Nakli": {
        "en": (
            "Our detection ensemble flagged this image as likely AI-generated with high confidence. "
            "Multiple signals — model probability scores and texture analysis — pointed to artificial origin. "
            "Modern AI image generators often leave subtle artifacts in skin smoothness, hand anatomy, "
            "or background details that pixel-level detectors can pick up."
        ),
        "hi": (
            "हमारे detection ensemble ने इस तस्वीर को उच्च आत्मविश्वास के साथ AI-जनित बताया है। "
            "कई संकेतों — मॉडल scores और texture विश्लेषण — ने कृत्रिम मूल की ओर इशारा किया। "
            "आधुनिक AI image generators अक्सर त्वचा की चिकनाई, हाथों की संरचना, या पृष्ठभूमि "
            "विवरण में सूक्ष्म artifacts छोड़ते हैं जिन्हें हमारे detectors पकड़ लेते हैं।"
        ),
        "gu": (
            "અમારા detection ensemble એ આ તસવીરને ઉચ્ચ આત્મવિશ્વાસ સાથે AI-જનરેટ તરીકે ફ્લેગ કરી છે. "
            "મોડેલ સ્કોર્સ અને texture વિશ્લેષણ — અનેક સંકેતો કૃત્રિમ મૂળ તરફ ઈશારો કરે છે. "
            "આધુનિક AI જનરેટરો ત્વચા, હાથ અથવા પૃષ્ઠભૂમિમાં સૂક્ષ્મ artifacts છોડે છે "
            "જે અમારા ડિટેક્ટરો પકડી શકે છે."
        ),
    },
    "Shak hai": {
        "en": (
            "Our detection ensemble could not confidently classify this image. "
            "Some models leaned real, others were uncertain — a pattern often seen with high-quality "
            "AI images, heavy photo-edits, or unusual but authentic photography. "
            "We recommend cross-checking the source before sharing."
        ),
        "hi": (
            "हमारा detection ensemble इस तस्वीर को निश्चित रूप से वर्गीकृत नहीं कर सका। "
            "कुछ मॉडल इसे असली बता रहे हैं, कुछ अनिश्चित हैं — यह स्थिति high-quality AI images, "
            "भारी photo-editing, या असामान्य लेकिन असली फ़ोटोग्राफ़ी में अक्सर होती है। "
            "हम share करने से पहले स्रोत की पुष्टि करने की सलाह देते हैं।"
        ),
        "gu": (
            "અમારા detection ensemble આ તસવીરને નિશ્ચિતપણે વર્ગીકૃત કરી શક્યું નથી. "
            "કેટલાક મોડેલે અસલી ગણાવ્યું, કેટલાક અનિશ્ચિત રહ્યા — ઉચ્ચ-ગુણવત્તાવાળી AI તસવીરો, "
            "ભારે ફોટો-એડિટિંગ અથવા અસામાન્ય પણ સાચી ફોટોગ્રાફીમાં આ સામાન્ય છે. "
            "share કરતા પહેલાં સ્ત્રોત ચકાસવાની અમે ભલામણ કરીએ છીએ."
        ),
    },
}

LEARN_MORE_TIPS = {
    "hi": (
        "WhatsApp या social media से आई किसी भी तस्वीर पर भरोसा करने से पहले — "
        "उसका स्रोत खोजें (Google reverse image search), तारीख देखें, और चेहरे/हाथों की "
        "बारीक डिटेल पर ध्यान दें।"
    ),
    "gu": (
        "WhatsApp અથવા સોશિયલ મીડિયાથી આવેલી તસવીર પર વિશ્વાસ કરતા પહેલાં — "
        "તેનો સ્ત્રોત શોધો (Google reverse image search), તારીખ તપાસો, અને ચહેરા/હાથની "
        "ઝીણી વિગતો પર ધ્યાન આપો."
    ),
    "en": (
        "Before trusting any image from WhatsApp or social media — find the source via "
        "Google reverse image search, check the date, and look closely at hands, ears, "
        "and small text in the background."
    ),
}

RED_FLAG_BANK = {
    "high_smoothness": {
        "en": "skin texture is unnaturally smooth (no visible pores)",
        "hi": "त्वचा की बनावट अप्राकृतिक रूप से चिकनी है (कोई pores नहीं दिख रहे)",
        "gu": "ત્વચાની બનાવટ અકુદરતી રીતે સરળ છે (કોઈ pores દેખાતા નથી)",
    },
    "low_noise": {
        "en": "missing the camera-sensor noise present in real photographs",
        "hi": "असली तस्वीरों में मिलने वाला camera-sensor noise अनुपस्थित है",
        "gu": "વાસ્તવિક ફોટામાં હોતો camera-sensor noise ગાયબ છે",
    },
    "low_high_freq": {
        "en": "lacks the fine high-frequency detail of real photographs",
        "hi": "असली तस्वीरों जैसी बारीक उच्च-आवृत्ति डिटेल नहीं है",
        "gu": "વાસ્તવિક ફોટા જેવી ઝીણી ઉચ્ચ-આવૃત્તિ વિગતો નથી",
    },
    "uniform_local_var": {
        "en": "texture is overly uniform across the entire image",
        "hi": "पूरी तस्वीर में texture अत्यधिक एकसमान है",
        "gu": "સમગ્ર તસવીરમાં texture વધુ પડતી એકસરખી છે",
    },
    "low_channel_std": {
        "en": "limited natural color variation",
        "hi": "रंगों में सीमित प्राकृतिक भिन्नता",
        "gu": "રંગોમાં મર્યાદિત કુદરતી ભિન્નતા",
    },
    "model_high_fake": {
        "en": "AI detector model flagged probable synthesis",
        "hi": "AI detector मॉडल ने संभावित कृत्रिम निर्माण का संकेत दिया",
        "gu": "AI ડિટેક્ટર મોડેલે સંભવિત કૃત્રિમતા દર્શાવી",
    },
    "metadata_ai_marker": {
        "en": "image metadata contains an AI-generator signature",
        "hi": "तस्वीर के metadata में AI generator का चिन्ह मिला",
        "gu": "તસવીરના મેટાડેટામાં AI જનરેટરનું ચિહ્ન મળ્યું",
    },
    "supporting_natural_noise": {
        "en": "natural sensor noise consistent with a real camera",
        "hi": "असली कैमरे जैसा स्वाभाविक sensor noise मौजूद है",
        "gu": "સાચા કેમેરા જેવો કુદરતી sensor noise હાજર છે",
    },
    "supporting_no_signatures": {
        "en": "no clear AI generator signatures detected",
        "hi": "कोई स्पष्ट AI generator संकेत नहीं मिला",
        "gu": "કોઈ સ્પષ્ટ AI જનરેટર સંકેત મળ્યો નથી",
    },
}


def _select_red_flags(features: dict, target_language: str, verdict: str) -> list[str]:
    flags: list[str] = []
    heur = features.get("heuristics") or {}

    if heur.get("laplacian_var", 1e9) < 400:
        flags.append(RED_FLAG_BANK["high_smoothness"][target_language])
    if heur.get("noise", 1e9) < 6.0:
        flags.append(RED_FLAG_BANK["low_noise"][target_language])
    if heur.get("dct_high_freq_energy", 1.0) < 0.008:
        flags.append(RED_FLAG_BANK["low_high_freq"][target_language])
    if heur.get("local_var_cv", 1.0) < 0.75:
        flags.append(RED_FLAG_BANK["uniform_local_var"][target_language])
    if heur.get("channel_std", 1e9) < 30:
        flags.append(RED_FLAG_BANK["low_channel_std"][target_language])

    individual = features.get("individual_scores") or {}
    if any((s or 0) > 0.5 for s in individual.values()):
        flags.append(RED_FLAG_BANK["model_high_fake"][target_language])

    if features.get("metadata_status") == "suspicious":
        flags.append(RED_FLAG_BANK["metadata_ai_marker"][target_language])

    if verdict == "Asli" and not flags:
        flags.append(RED_FLAG_BANK["supporting_no_signatures"][target_language])
        if heur.get("noise", 0) >= 6.0:
            flags.append(RED_FLAG_BANK["supporting_natural_noise"][target_language])
    elif not flags:
        flags.append(RED_FLAG_BANK["supporting_no_signatures"][target_language])

    return flags[:4]


def _fallback_explanation(
    fake_prob: float,
    features: dict,
    target_language: str,
    verdict: str,
    confidence_pct: int,
) -> dict:
    n_models = len(features.get("models_used") or []) or 3
    template = TEMPLATES[verdict]
    return {
        "verdict": verdict,
        "confidence_pct": confidence_pct,
        "explanation_en": template["en"].format(n_models=n_models),
        "explanation_local": template[target_language].format(n_models=n_models),
        "red_flags": _select_red_flags(features, target_language, verdict),
        "learn_more_tip": LEARN_MORE_TIPS[target_language],
        "source": "template",
    }


# ───────────────────────── public API ─────────────────────────

def generate_explanation(
    image_bytes: bytes,
    fake_prob: float,
    features: Optional[dict] = None,
    target_language: str = DEFAULT_LANGUAGE,
) -> dict:
    """Return a structured explanation matching the strict schema.

    Never raises. On Gemini failure, returns a deterministic template.
    Caches successful results (keyed on image+language+verdict-bucket).
    """
    if target_language not in VALID_LANGUAGES:
        target_language = DEFAULT_LANGUAGE
    if features is None:
        features = {}
    fake_prob = max(0.0, min(1.0, float(fake_prob)))

    verdict, confidence_pct = _verdict_and_confidence(fake_prob)

    key = _cache_key(image_bytes, target_language, fake_prob)
    cached = _cache_get(key)
    if cached is not None:
        cached["cache_hit"] = True
        return cached

    gemini_payload = _call_gemini(
        image_bytes=image_bytes,
        fake_prob=fake_prob,
        features=features,
        target_language=target_language,
        verdict=verdict,
        confidence_pct=confidence_pct,
    )

    if gemini_payload is not None:
        result = {
            "verdict": verdict,
            "confidence_pct": confidence_pct,
            "explanation_en": str(gemini_payload["explanation_en"]).strip(),
            "explanation_local": str(gemini_payload["explanation_local"]).strip(),
            "red_flags": [str(x).strip() for x in gemini_payload["red_flags"] if str(x).strip()][:6],
            "learn_more_tip": str(gemini_payload["learn_more_tip"]).strip(),
            "source": "gemini",
            "cache_hit": False,
        }
    else:
        result = _fallback_explanation(
            fake_prob, features, target_language, verdict, confidence_pct,
        )
        result["cache_hit"] = False

    _cache_set(key, result)
    return copy.deepcopy(result)
