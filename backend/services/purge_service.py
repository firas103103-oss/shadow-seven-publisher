"""
Omni-Publisher Stage 2: Semantic Purge Service
Uses Gemini 1.5 Pro to analyze text and produce purge report for PurgeReportModal.
"""

import json
import logging
from typing import Optional

from .gemini_client import analyze_purge

logger = logging.getLogger(__name__)


def run_purge(merged_text: str, word_count: int) -> dict:
    """
    Run semantic purge analysis via Gemini.
    Returns structure expected by frontend PurgeReportModal:
    {
        purge_report: { duplicates, outliers, thematic_shifts },
        word_count_after: int,
        anomalies_fixed: int,
        word_count: int  # original
    }
    """
    try:
        result = analyze_purge(merged_text)
    except RuntimeError as e:
        if 'GEMINI_API_KEY' in str(e) or 'GOOGLE_AI_API_KEY' in str(e):
            logger.warning("Gemini API key not configured; returning mock purge report")
            return {
                "purge_report": {
                    "duplicates": 0,
                    "outliers": 0,
                    "thematic_shifts": 0,
                },
                "word_count": word_count,
                "word_count_after": word_count,
                "anomalies_fixed": 0,
            }
        raise

    purge_report = {
        "duplicates": result.get("duplicates", 0),
        "outliers": result.get("outliers", 0),
        "thematic_shifts": result.get("thematic_shifts", 0),
    }
    word_count_after = result.get("word_count_after") or word_count
    anomalies_fixed = result.get("anomalies_fixed") or 0

    return {
        "purge_report": purge_report,
        "word_count": word_count,
        "word_count_after": word_count_after,
        "anomalies_fixed": anomalies_fixed,
    }
