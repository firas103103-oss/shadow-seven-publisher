"""
Google Gemini API Client for Omni-Publisher Purge (Stage 2).
Uses gemini-1.5-pro for long-context (up to 2M tokens).
"""

import os
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Lazy import to avoid failure when key is missing
_gen_model = None


def _get_model():
    global _gen_model
    if _gen_model is not None:
        return _gen_model
    try:
        from config import settings
        api_key = getattr(settings, 'GEMINI_API_KEY', None) or ''
    except ImportError:
        api_key = ''
    api_key = api_key or os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_AI_API_KEY')
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY or GOOGLE_AI_API_KEY environment variable is required for purge service"
        )
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        _gen_model = genai.GenerativeModel('gemini-1.5-pro')
        return _gen_model
    except ImportError:
        raise RuntimeError(
            "google-generativeai package not installed. Run: pip install google-generativeai"
        )


def analyze_purge(text: str) -> dict:
    """
    Send merged text to Gemini for semantic purge analysis.
    Returns JSON with: duplicates, outliers, thematic_shifts, purged_word_count, purged_content (optional).
    """
    model = _get_model()

    prompt = """أنت محلل نصوص عربية متخصص. مهمتك تحليل المخطوطة التالية وتحديد:
1. **تكرارات (duplicates)**: عدد الجمل أو الفقرات المكررة أو شبه المكررة
2. **شذوذ (outliers)**: عدد الفقرات أو الأقسام التي تخرج عن الموضوع الرئيسي
3. **تحولات موضوعية (thematic_shifts)**: عدد النقاط التي يتحول فيها الخطاب بشكل مفاجئ أو غير متناسق

أرجع الإجابة بصيغة JSON فقط، بدون أي نص إضافي قبل أو بعد. الصيغة المطلوبة:
{
  "duplicates": <عدد صحيح>,
  "outliers": <عدد صحيح>,
  "thematic_shifts": <عدد صحيح>,
  "word_count_after": <عدد الكلمات بعد التنظيف المقترح - تقدير>,
  "anomalies_fixed": <عدد الإصلاحات المقترحة - duplicates + outliers + thematic_shifts>
}

المخطوطة:
"""
    full_prompt = prompt + text[:1_000_000]  # Cap at ~1M chars to stay within context

    try:
        response = model.generate_content(
            full_prompt,
            generation_config={
                "temperature": 0.2,
                "max_output_tokens": 1024,
            }
        )
        out_text = (response.text or "").strip()
        # Extract JSON (handle markdown code blocks)
        if '```' in out_text:
            start = out_text.find('{')
            end = out_text.rfind('}') + 1
            if start >= 0 and end > start:
                out_text = out_text[start:end]
        data = json.loads(out_text)
        # Ensure required keys
        data.setdefault('duplicates', 0)
        data.setdefault('outliers', 0)
        data.setdefault('thematic_shifts', 0)
        data.setdefault('word_count_after', 0)
        data.setdefault('anomalies_fixed', 0)
        return data
    except json.JSONDecodeError as e:
        logger.warning(f"Gemini returned non-JSON: {e}")
        # Fallback: return estimated values
        wc = len(text.split())
        return {
            "duplicates": 0,
            "outliers": 0,
            "thematic_shifts": 0,
            "word_count_after": int(wc * 0.98),
            "anomalies_fixed": 0,
        }
    except Exception as e:
        logger.error(f"Gemini purge analysis error: {e}")
        raise
