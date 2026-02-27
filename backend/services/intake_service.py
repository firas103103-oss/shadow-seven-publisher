"""
Omni-Publisher Stage 1: Intake Service
Merge and validate 1-7 TXT/DOCX files, detect encoding, preserve Arabic RTL.
"""

import io
import unicodedata
import re
from typing import List, Tuple, Optional
from fastapi import UploadFile, HTTPException

try:
    import mammoth
except ImportError:
    mammoth = None

# Limits - match config.settings
MIN_WORDS = 500
MAX_WORDS = 200_000
ALLOWED_EXTENSIONS = {'.txt', '.docx'}
ALLOWED_MIMES = {
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}


def count_words(text: str) -> int:
    """Count words (whitespace-separated, non-empty)."""
    return len([w for w in text.split() if w.strip()])


def detect_encoding(data: bytes) -> str:
    """Try UTF-8 first; fallback to windows-1256 (CP1256) for Arabic."""
    try:
        text = data.decode('utf-8')
        # Quick sanity: no replacement chars
        if '\ufffd' not in text[:1000]:
            return 'UTF-8'
    except (UnicodeDecodeError, UnicodeError):
        pass
    try:
        data.decode('windows-1256')
        return 'CP1256'
    except (UnicodeDecodeError, UnicodeError):
        pass
    return 'UTF-8'  # Default fallback


def decode_text(data: bytes, encoding: str) -> str:
    """Decode bytes to string using detected encoding."""
    return data.decode(encoding)


def normalize_arabic_rtl(text: str) -> str:
    """
    Preserve and normalize Arabic RTL.
    - Unicode NFC normalization
    - Normalize Arabic character variants (Farsi Yeh → Arabic Yeh, etc.)
    - Preserve RTL direction
    """
    text = unicodedata.normalize('NFC', text)
    # Normalize Arabic variants
    text = text.replace('\u06cc', '\u064a')  # Farsi Yeh → Arabic Yeh
    text = text.replace('\u06a9', '\u0643')  # Farsi Kaf → Arabic Kaf
    text = text.replace('\u0649', '\u064a')  # Alef Maksura → Yeh
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def read_file_content(file: UploadFile, content: bytes) -> Tuple[str, str]:
    """Extract text from TXT or DOCX. Returns (text, encoding)."""
    filename = file.filename or 'file'
    ext = '.' + (filename.split('.')[-1] if '.' in filename else 'txt').lower()

    if ext == '.docx':
        if not mammoth:
            raise HTTPException(status_code=500, detail="مكتبة mammoth غير متوفرة")
        result = mammoth.extract_raw_text(io.BytesIO(content))
        text = result.value or ''
        encoding = 'UTF-8'  # mammoth outputs UTF-8
    else:
        encoding = detect_encoding(content)
        text = decode_text(content, encoding)

    text = normalize_arabic_rtl(text)
    return text, encoding


async def merge_and_validate(files: List[UploadFile]) -> dict:
    """
    Accept 1-7 files from FormData, merge text in sequence, validate limits.
    Returns: {
        merged_text: str,
        word_count: int,
        file_count: int,
        encoding: str,  # primary encoding used
        encodings: List[str]  # per-file encodings
    }
    """
    if not files or len(files) > 7:
        raise HTTPException(
            status_code=400,
            detail="يجب رفع 1 إلى 7 ملفات TXT أو DOCX"
        )

    merged_parts = []
    encodings = []
    total_words = 0

    for f in files:
        filename = f.filename or 'file'
        ext = '.' + (filename.split('.')[-1] if '.' in filename else 'txt').lower()

        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"نوع الملف غير مدعوم: {filename}. المسموح: TXT, DOCX"
            )

        content = await f.read()
        if len(content) > 50 * 1024 * 1024:  # 50MB per file
            raise HTTPException(
                status_code=400,
                detail=f"الملف كبير جداً: {filename}. الحد الأقصى 50MB"
            )

        text, enc = read_file_content(f, content)
        encodings.append(enc)
        merged_parts.append(text)
        total_words += count_words(text)

    merged_text = '\n\n'.join(merged_parts)
    merged_text = normalize_arabic_rtl(merged_text)
    total_words = count_words(merged_text)

    if total_words < MIN_WORDS:
        raise HTTPException(
            status_code=400,
            detail=f"إجمالي الكلمات ({total_words}) أقل من الحد الأدنى ({MIN_WORDS})"
        )
    if total_words > MAX_WORDS:
        raise HTTPException(
            status_code=400,
            detail=f"إجمالي الكلمات ({total_words}) يتجاوز الحد الأقصى ({MAX_WORDS})"
        )

    primary_encoding = encodings[0] if encodings else 'UTF-8'
    if len(set(encodings)) > 1:
        primary_encoding = 'mixed'  # Multiple encodings detected

    return {
        "merged_text": merged_text,
        "word_count": total_words,
        "file_count": len(files),
        "encoding": primary_encoding,
        "encodings": encodings,
    }
