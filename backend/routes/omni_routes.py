"""
Omni-Publisher API Routes — Stage 1 (Intake) & Stage 2 (Purge)
POST /api/shadow7/omni/upload
POST /api/shadow7/omni/purge
"""

import secrets
import logging
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel

from config import settings
from db import db
from services.intake_service import merge_and_validate
from services.purge_service import run_purge

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/shadow7/omni", tags=["omni"])


def _generate_tracking_id() -> str:
    return f"S7-{secrets.token_hex(4).upper()}"


@router.post("/upload")
async def omni_upload(request: Request):
    """
    Stage 1: Intake — Accept 1-7 TXT/DOCX files, merge, validate, store.
    FormData: file_1, file_2, ... file_7 (or files[] if sent as array)
    Returns: { tracking_id, word_count, file_count, encoding }
    """
    max_part = getattr(settings, 'MAX_MULTIPART_PART_SIZE', 100 * 1024 * 1024)
    try:
        form = await request.form(max_part_size=max_part)
    except Exception as e:
        logger.error(f"Form parse error: {e}")
        raise HTTPException(status_code=400, detail="فشل قراءة النموذج")

    files = []
    for i in range(1, 8):
        key = f"file_{i}"
        f = form.get(key)
        if f and hasattr(f, 'read'):
            files.append(f)

    # Also accept files[] if frontend sends array
    if not files:
        arr = form.getlist("files[]") if hasattr(form, 'getlist') else []
        for f in arr:
            if f and hasattr(f, 'read'):
                files.append(f)

    if not files:
        raise HTTPException(status_code=400, detail="لم يتم رفع أي ملفات. يرجى رفع 1 إلى 7 ملفات TXT أو DOCX")

    result = await merge_and_validate(files)
    tracking_id = _generate_tracking_id()

    await db.create_omni_intake({
        "tracking_id": tracking_id,
        "merged_content": result["merged_text"],
        "word_count": result["word_count"],
        "file_count": result["file_count"],
        "encoding": result["encoding"],
    })

    return {
        "tracking_id": tracking_id,
        "word_count": result["word_count"],
        "file_count": result["file_count"],
        "encoding": result["encoding"],
    }


class PurgeRequest(BaseModel):
    tracking_id: str


@router.post("/purge")
async def omni_purge(data: PurgeRequest):
    """
    Stage 2: Purge — Run semantic analysis via Gemini, return purge report.
    Request: { "tracking_id": "S7-..." }
    Returns: { purge_report, word_count_after, anomalies_fixed, word_count }
    """
    intake = await db.get_omni_intake(data.tracking_id)
    if not intake:
        raise HTTPException(status_code=404, detail="معرف التتبع غير موجود. يرجى إكمال مرحلة الاستقبال أولاً.")

    merged_text = intake.get("merged_content") or ""
    word_count = intake.get("word_count") or 0

    purge_result = run_purge(merged_text, word_count)
    purge_report = purge_result.get("purge_report", {})

    await db.update_omni_purge(data.tracking_id, purge_report)

    return {
        "purge_report": purge_report,
        "word_count": purge_result.get("word_count", word_count),
        "word_count_after": purge_result.get("word_count_after", word_count),
        "anomalies_fixed": purge_result.get("anomalies_fixed", 0),
    }
