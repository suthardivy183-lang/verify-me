"""Unit tests for backend/gemini_explainer.py.

Tests never call the real Gemini API — they patch `_call_gemini` to control
the success/failure path deterministically.
"""

import gemini_explainer


REQUIRED_KEYS = {
    "verdict",
    "confidence_pct",
    "explanation_en",
    "explanation_local",
    "red_flags",
    "learn_more_tip",
    "source",
}


def _is_devanagari(text: str) -> bool:
    """At least one char in the Devanagari Unicode block."""
    return any(0x0900 <= ord(c) <= 0x097F for c in text)


def _is_gujarati(text: str) -> bool:
    return any(0x0A80 <= ord(c) <= 0x0AFF for c in text)


def _features_for_nakli():
    return {
        "models_used": ["xception", "efficientnet", "hf_detector"],
        "individual_scores": {"xception": 0.10, "efficientnet": 0.92, "hf_detector": 0.55},
        "heuristics": {
            "noise": 3.4,
            "dct_high_freq_energy": 0.004,
            "channel_std": 22.0,
            "laplacian_var": 180.0,
            "local_var_cv": 0.55,
        },
        "metadata_status": "missing",
    }


def _features_for_asli():
    return {
        "models_used": ["xception", "efficientnet", "hf_detector"],
        "individual_scores": {"xception": 0.05, "efficientnet": 0.04, "hf_detector": 0.10},
        "heuristics": {
            "noise": 12.5,
            "dct_high_freq_energy": 0.020,
            "channel_std": 55.0,
            "laplacian_var": 1200.0,
            "local_var_cv": 1.10,
        },
        "metadata_status": "present",
    }


# ───────────────────────── 1. successful Gemini call ─────────────────────────

def test_gemini_success_returns_full_schema(monkeypatch):
    fake_payload = {
        "explanation_en": (
            "The skin appears unnaturally smooth with no visible pores, and the earring "
            "shapes differ between the left and right ear. Background depth-of-field is "
            "inconsistent. The ensemble's high fake_probability is consistent with these "
            "observations, indicating an AI-generated image."
        ),
        "explanation_local": (
            "त्वचा पर pores नहीं दिख रहे और दोनों कानों की earrings अलग-अलग हैं। "
            "पृष्ठभूमि की depth-of-field असंगत है। ये सभी संकेत AI-जनित तस्वीर की पुष्टि करते हैं।"
        ),
        "red_flags": [
            "skin lacks visible pores",
            "earrings differ between ears",
            "inconsistent background depth-of-field",
        ],
        "learn_more_tip": (
            "WhatsApp पर आई किसी भी तस्वीर पर भरोसा करने से पहले Google reverse image search करें।"
        ),
    }
    monkeypatch.setattr(
        gemini_explainer, "_call_gemini",
        lambda **kw: fake_payload,
    )
    gemini_explainer.cache_clear()

    result = gemini_explainer.generate_explanation(
        image_bytes=b"fake-image-bytes-1",
        fake_prob=0.88,
        features=_features_for_nakli(),
        target_language="hi",
    )

    assert REQUIRED_KEYS.issubset(result.keys())
    assert result["source"] == "gemini"
    assert result["verdict"] == "Nakli"
    assert 65 <= result["confidence_pct"] <= 99
    assert result["explanation_en"].startswith("The skin appears")
    assert _is_devanagari(result["explanation_local"])
    assert isinstance(result["red_flags"], list)
    assert len(result["red_flags"]) >= 2
    assert all(isinstance(f, str) and f for f in result["red_flags"])


# ───────────────────────── 2. fallback path ─────────────────────────

def test_fallback_activates_when_gemini_returns_none(monkeypatch):
    monkeypatch.setattr(gemini_explainer, "_call_gemini", lambda **kw: None)
    gemini_explainer.cache_clear()

    result = gemini_explainer.generate_explanation(
        image_bytes=b"fake-image-bytes-2",
        fake_prob=0.90,
        features=_features_for_nakli(),
        target_language="hi",
    )

    assert REQUIRED_KEYS.issubset(result.keys())
    assert result["source"] == "template"
    assert result["verdict"] == "Nakli"
    assert _is_devanagari(result["explanation_local"])
    assert _is_devanagari(result["learn_more_tip"])
    # template fallback must populate at least one specific red flag from heuristics
    assert len(result["red_flags"]) >= 1


def test_fallback_works_for_asli_verdict(monkeypatch):
    monkeypatch.setattr(gemini_explainer, "_call_gemini", lambda **kw: None)
    gemini_explainer.cache_clear()

    result = gemini_explainer.generate_explanation(
        image_bytes=b"fake-image-bytes-asli",
        fake_prob=0.04,
        features=_features_for_asli(),
        target_language="hi",
    )

    assert result["source"] == "template"
    assert result["verdict"] == "Asli"
    assert result["confidence_pct"] >= 65


def test_fallback_returns_uncertain_for_borderline(monkeypatch):
    monkeypatch.setattr(gemini_explainer, "_call_gemini", lambda **kw: None)
    gemini_explainer.cache_clear()

    result = gemini_explainer.generate_explanation(
        image_bytes=b"borderline",
        fake_prob=0.50,
        features=_features_for_nakli(),
        target_language="hi",
    )

    assert result["verdict"] == "Shak hai"
    assert result["confidence_pct"] == 50


# ───────────────────────── 3. cache hit ─────────────────────────

def test_cache_hit_avoids_second_gemini_call(monkeypatch):
    call_counter = {"n": 0}

    def fake_gemini(**kw):
        call_counter["n"] += 1
        return {
            "explanation_en": "cached path test",
            "explanation_local": "cached हिन्दी पाठ",
            "red_flags": ["pore-free skin"],
            "learn_more_tip": "स्रोत हमेशा जाँचें।",
        }

    monkeypatch.setattr(gemini_explainer, "_call_gemini", fake_gemini)
    gemini_explainer.cache_clear()

    bytes_blob = b"identical-image-bytes"
    fake_prob = 0.85
    features = _features_for_nakli()

    first = gemini_explainer.generate_explanation(bytes_blob, fake_prob, features, "hi")
    second = gemini_explainer.generate_explanation(bytes_blob, fake_prob, features, "hi")

    assert call_counter["n"] == 1, "second call should be served from cache"
    # Cache_hit flag legitimately differs (False on first, True on second)
    assert first["cache_hit"] is False
    assert second["cache_hit"] is True
    # All other fields must be identical
    for k in ("verdict", "confidence_pct", "explanation_en", "explanation_local",
              "red_flags", "learn_more_tip", "source"):
        assert first[k] == second[k]
    assert gemini_explainer.cache_size() == 1


def test_cache_returns_independent_copies(monkeypatch):
    monkeypatch.setattr(gemini_explainer, "_call_gemini", lambda **kw: None)
    gemini_explainer.cache_clear()

    a = gemini_explainer.generate_explanation(b"img", 0.8, _features_for_nakli(), "hi")
    b = gemini_explainer.generate_explanation(b"img", 0.8, _features_for_nakli(), "hi")

    a["red_flags"].append("mutated")
    assert "mutated" not in b["red_flags"], "cache must hand back a defensive copy"


# ───────────────────────── 4. target_language affects output ─────────────────────────

def test_target_language_changes_explanation_local(monkeypatch):
    monkeypatch.setattr(gemini_explainer, "_call_gemini", lambda **kw: None)
    gemini_explainer.cache_clear()

    img = b"shared-image-bytes"
    features = _features_for_nakli()

    hi = gemini_explainer.generate_explanation(img, 0.85, features, "hi")
    gu = gemini_explainer.generate_explanation(img, 0.85, features, "gu")
    en = gemini_explainer.generate_explanation(img, 0.85, features, "en")

    assert hi["explanation_local"] != gu["explanation_local"]
    assert hi["explanation_local"] != en["explanation_local"]
    assert gu["explanation_local"] != en["explanation_local"]

    assert _is_devanagari(hi["explanation_local"])
    assert _is_gujarati(gu["explanation_local"])
    assert not _is_devanagari(en["explanation_local"])
    assert not _is_gujarati(en["explanation_local"])

    # learn_more_tip should also localize
    assert _is_devanagari(hi["learn_more_tip"])
    assert _is_gujarati(gu["learn_more_tip"])


def test_invalid_language_falls_back_to_default(monkeypatch):
    monkeypatch.setattr(gemini_explainer, "_call_gemini", lambda **kw: None)
    gemini_explainer.cache_clear()

    result = gemini_explainer.generate_explanation(
        b"img", 0.85, _features_for_nakli(), target_language="xx",
    )
    assert _is_devanagari(result["explanation_local"]), "default language should be Hindi"


# ───────────────────────── never raises ─────────────────────────

def test_never_raises_on_garbage_inputs(monkeypatch):
    monkeypatch.setattr(gemini_explainer, "_call_gemini", lambda **kw: None)
    gemini_explainer.cache_clear()

    result = gemini_explainer.generate_explanation(b"", -3.0, None, target_language="hi")
    assert REQUIRED_KEYS.issubset(result.keys())
    assert 0 <= result["confidence_pct"] <= 100
