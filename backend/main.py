# /root/products/shadow-seven-publisher/backend/main.py
"""
SHADOW-7 Publisher — FastAPI Backend
Port: 8002 (isolated, no conflicts)
All routes: /api/shadow7/
"""

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from contextlib import asynccontextmanager
import httpx
import secrets
import re
import os
import json
import uuid
import logging
from datetime import datetime, timedelta
from typing import Optional

from config import settings
from db import init_db, close_db, db, get_connection
from models import (
    SubmitRequestInput, SubmitResponse, TrackingResponse,
    ErrorResponse, FileUploadInput, N8NCallbackPayload,
    RequestStatus
)
from email_service import init_email_service, get_email_service

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(name)s | %(message)s'
)
logger = logging.getLogger("shadow7")


# ─────────────────────────────────────────────────────────────
# LIFESPAN (Startup/Shutdown)
# ─────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    # Startup
    logger.info("🚀 Starting SHADOW-7 Publisher API...")
    await init_db()
    
    # Initialize email service with DB pool
    try:
        pool = await db.get_pool()
        init_email_service(pool)
    except Exception as e:
        logger.warning(f"Email service init without DB: {e}")
        init_email_service(None)
    
    # Create storage directories
    os.makedirs(settings.STORAGE_PATH, exist_ok=True)
    os.makedirs(settings.EXPORTS_PATH, exist_ok=True)
    manuscripts_dir = getattr(settings, 'MANUSCRIPTS_PATH', None) or os.path.join(settings.STORAGE_PATH, 'manuscripts')
    os.makedirs(manuscripts_dir, exist_ok=True)
    
    logger.info(f"✅ SHADOW-7 API ready on port {settings.PORT}")
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down SHADOW-7 API...")
    await close_db()


# ─────────────────────────────────────────────────────────────
# APP INITIALIZATION
# ─────────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="دار نشر ذكية في صندوق — AI-Powered Publishing House",
    docs_url="/api/shadow7/docs",
    redoc_url="/api/shadow7/redoc",
    openapi_url="/api/shadow7/openapi.json",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS + ["*"],  # Allow all for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Omni-Publisher routes (Stage 1 Intake, Stage 2 Purge)
from routes.omni_routes import router as omni_router
app.include_router(omni_router)


# ─────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────

def generate_tracking_id() -> str:
    """Generate unique tracking ID (S7-XXXXXXXX)"""
    return f"S7-{secrets.token_hex(4).upper()}"


def scrub_text(text: str) -> str:
    """
    Clean and normalize Arabic text
    - Unicode NFC normalization
    - Normalize Arabic character variants (Farsi Yeh → Arabic Yeh, etc.)
    - Remove extreme whitespace
    - Fix excessive punctuation
    """
    import unicodedata
    # Unicode NFC normalization
    text = unicodedata.normalize('NFC', text)
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()
    # Normalize Arabic character variants (different codepoints, same/similar glyph)
    # Farsi Yeh (U+06CC) → Arabic Yeh (U+064A)
    text = text.replace('\u06cc', '\u064a')
    # Farsi Kaf (U+06A9) → Arabic Kaf (U+0643)
    text = text.replace('\u06a9', '\u0643')
    # Alef Maksura (U+0649) → Yeh (U+064A) when used as final yaa
    text = text.replace('\u0649', '\u064a')
    # Taa Marbuta alternate (U+06C3) → Taa Marbuta (U+0629)
    text = text.replace('\u06c3', '\u0629')
    # Alef variants → standard Alef (U+0627)
    text = text.replace('\u0671', '\u0627')
    text = text.replace('\u0672', '\u0627')
    text = text.replace('\u0673', '\u0627')
    text = text.replace('\u0675', '\u0627')
    # Yeh barree (U+06D2) → standard Yeh (U+064A)
    text = text.replace('\u06d2', '\u064a')
    # Remove excessive punctuation
    text = re.sub(r'[.]{3,}', '...', text)
    text = re.sub(r'[!]{2,}', '!', text)
    text = re.sub(r'[?]{2,}', '?', text)
    return text


def count_words(text: str) -> int:
    """Count words in text"""
    return len(text.split())


async def trigger_n8n_workflow(tracking_id: str, request_data: dict):
    """Trigger n8n webhook to start generation pipeline"""
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            # n8n workflow expects top-level: target_audience, book_genre, tone, platform, language
            payload = {
                "tracking_id": tracking_id,
                "request_id": str(request_data['id']),
                "user_email": request_data['user_email'],
                "user_name": request_data.get('user_name'),
                "raw_text": request_data['raw_text'],
                "word_count": request_data['word_count_in'],
                "target_audience": request_data.get('target_audience', 'عام'),
                "book_genre": request_data.get('book_genre', 'آخر'),
                "tone": request_data.get('tone_of_voice', 'رسمي'),
                "platform": request_data.get('platform', 'kindle'),
                "language": request_data.get('language', 'ar'),
                "preferences": {
                    "target_audience": request_data.get('target_audience', 'عام'),
                    "book_genre": request_data.get('book_genre', 'آخر'),
                    "tone_of_voice": request_data.get('tone_of_voice', 'رسمي'),
                    "platform": request_data.get('platform', 'kindle'),
                    "language": request_data.get('language', 'ar')
                },
                "callback_url": "http://shadow7_api:8002/api/shadow7/callback"
            }
            
            response = await client.post(
                settings.N8N_WEBHOOK_URL,
                json=payload
            )
            
            if response.status_code == 200:
                logger.info(f"✅ n8n triggered for {tracking_id}")
                return True
            else:
                logger.error(f"❌ n8n trigger failed: {response.status_code}")
                return False
                
    except Exception as e:
        logger.error(f"❌ n8n trigger error: {e}")
        return False


# ─────────────────────────────────────────────────────────────
# AUTH ROUTES (PostgreSQL)
# ─────────────────────────────────────────────────────────────

from pydantic import BaseModel as PydanticBase

class AuthLoginInput(PydanticBase):
    email: str
    password: str

class AuthRegisterInput(PydanticBase):
    email: str
    password: str
    full_name: Optional[str] = "user"

class AuthValidateInput(PydanticBase):
    token: str

class AuthLogoutInput(PydanticBase):
    token: str

class AuthUpdateProfileInput(PydanticBase):
    token: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None

@app.post("/api/shadow7/auth/login")
async def auth_login(data: AuthLoginInput):
    """تسجيل الدخول — يستدعي دالة login في PostgreSQL"""
    try:
        async with get_connection() as conn:
            result = await conn.fetchval("SELECT login($1, $2)", data.email, data.password)
            if isinstance(result, dict):
                out = result
            else:
                import json
                out = json.loads(result) if isinstance(result, str) else result
            if out.get("error"):
                raise HTTPException(status_code=401, detail=out.get("error", "Invalid credentials"))
            return out
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Auth login error: {e}")
        raise HTTPException(status_code=500, detail="فشل تسجيل الدخول")

@app.post("/api/shadow7/auth/register")
async def auth_register(data: AuthRegisterInput):
    """التسجيل — يستدعي دالة register في PostgreSQL"""
    try:
        async with get_connection() as conn:
            result = await conn.fetchval(
                "SELECT register($1, $2, $3)",
                data.email, data.password, data.full_name or "user"
            )
            if isinstance(result, dict):
                out = result
            else:
                import json
                out = json.loads(result) if isinstance(result, str) else result
            if out.get("error"):
                raise HTTPException(status_code=400, detail=out.get("error", "Registration failed"))
            return out
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Auth register error: {e}")
        raise HTTPException(status_code=500, detail="فشل التسجيل")

@app.post("/api/shadow7/auth/validate")
async def auth_validate(data: AuthValidateInput):
    """التحقق من الجلسة"""
    try:
        async with get_connection() as conn:
            result = await conn.fetchval("SELECT validate_session($1)", data.token)
            if isinstance(result, dict):
                out = result
            else:
                import json
                out = json.loads(result) if isinstance(result, str) else result
            return out
    except Exception as e:
        logger.error(f"Auth validate error: {e}")
        return {"valid": False, "error": str(e)}

@app.post("/api/shadow7/auth/logout")
async def auth_logout(data: AuthLogoutInput):
    """تسجيل الخروج"""
    try:
        async with get_connection() as conn:
            await conn.fetchval("SELECT logout($1)", data.token)
        return {"success": True}
    except Exception:
        return {"success": True}

@app.post("/api/shadow7/auth/update-profile")
async def auth_update_profile(data: AuthUpdateProfileInput):
    """تحديث الملف الشخصي"""
    try:
        async with get_connection() as conn:
            result = await conn.fetchval(
                "SELECT update_profile($1, $2, $3)",
                data.token, data.full_name, data.avatar_url
            )
            if isinstance(result, dict):
                out = result
            else:
                import json
                out = json.loads(result) if isinstance(result, str) else result
            if out.get("error"):
                raise HTTPException(status_code=401, detail=out.get("error"))
            return out
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Auth update profile error: {e}")
        raise HTTPException(status_code=500, detail="فشل التحديث")


# ─────────────────────────────────────────────────────────────
# ROUTES: /api/shadow7/
# ─────────────────────────────────────────────────────────────

@app.get("/api/shadow7/health")
async def health_check():
    """Health check endpoint — verifies Postgres connection and manuscripts table"""
    result = {
        "status": "healthy",
        "service": "SHADOW-7 Publisher",
        "version": settings.APP_VERSION,
        "timestamp": datetime.utcnow().isoformat(),
        "postgres": "unknown",
        "manuscripts_table": False,
    }
    try:
        async with get_connection() as conn:
            row = await conn.fetchrow(
                "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'manuscripts')"
            )
            result["postgres"] = "connected"
            result["manuscripts_table"] = bool(row and row["exists"])
        if not result["manuscripts_table"]:
            result["status"] = "degraded"
    except Exception as e:
        result["status"] = "unhealthy"
        result["postgres"] = str(e)
    return result


@app.post(
    "/api/shadow7/submit",
    response_model=SubmitResponse,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}}
)
async def submit_manuscript(
    request: Request,
    data: SubmitRequestInput,
    background_tasks: BackgroundTasks
):
    """
    MODULE 1: The Gatekeeper
    Submit manuscript text for processing
    
    - Validates and scrubs input text
    - Creates DB record with tracking_id
    - Triggers n8n webhook asynchronously
    - Returns tracking_id for status checks
    """
    try:
        # Scrub and validate text
        cleaned_text = scrub_text(data.raw_text)
        word_count = count_words(cleaned_text)
        
        # Generate tracking ID
        tracking_id = generate_tracking_id()
        
        # Prepare data
        request_data = {
            "tracking_id": tracking_id,
            "user_email": data.user_email,
            "user_name": data.user_name,
            "raw_text": cleaned_text,
            "word_count_in": word_count,
            "file_name": data.file_name,
            "target_audience": data.target_audience.value,
            "book_genre": data.book_genre.value,
            "tone_of_voice": data.tone_of_voice.value,
            "platform": data.platform.value,
            "language": data.language,
            "ip_address": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent")
        }
        
        # Save to database
        saved = await db.create_request(request_data)
        
        # Log
        await db.log(
            str(saved['id']), "info", "gatekeeper",
            f"طلب جديد: {word_count} كلمة",
            {"email": data.user_email, "genre": data.book_genre.value}
        )
        
        # Trigger n8n in background
        background_tasks.add_task(
            trigger_n8n_workflow, 
            tracking_id, 
            {**request_data, 'id': saved['id']}
        )
        
        logger.info(f"📝 New request: {tracking_id} ({word_count} words)")
        
        return SubmitResponse(
            tracking_id=tracking_id,
            word_count=word_count,
            message=f"تم استلام مخطوطتك ({word_count} كلمة). رقم التتبع: {tracking_id}"
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Submit error: {e}")
        raise HTTPException(status_code=500, detail="حدث خطأ داخلي")


@app.post(
    "/api/shadow7/upload",
    response_model=SubmitResponse,
    responses={400: {"model": ErrorResponse}}
)
async def upload_file(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user_email: str = Form(...),
    user_name: Optional[str] = Form(None),
    target_audience: str = Form("عام"),
    book_genre: str = Form("آخر"),
    tone_of_voice: str = Form("رسمي"),
    platform: str = Form("kindle"),
    language: str = Form("ar")
):
    """
    MODULE 1: The Gatekeeper (File Upload)
    Upload .txt or .docx file
    """
    try:
        # Validate file type
        allowed_types = ['.txt', '.docx']
        file_ext = os.path.splitext(file.filename)[1].lower()
        
        if file_ext not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"نوع الملف غير مدعوم. الأنواع المسموحة: {', '.join(allowed_types)}"
            )
        
        # Read file content
        content = await file.read()
        
        if len(content) > settings.MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"حجم الملف كبير جداً. الحد الأقصى: {settings.MAX_UPLOAD_SIZE // (1024*1024)}MB"
            )
        
        # Extract text based on file type
        if file_ext == '.txt':
            try:
                text = content.decode('utf-8')
            except:
                text = content.decode('windows-1256')  # Try Arabic encoding
        
        elif file_ext == '.docx':
            import mammoth
            import io
            result = mammoth.extract_raw_text(io.BytesIO(content))
            text = result.value
        
        # Validate word count
        word_count = count_words(text)
        if word_count < settings.MIN_WORDS:
            raise HTTPException(
                status_code=400,
                detail=f"النص قصير جداً ({word_count} كلمة). الحد الأدنى: {settings.MIN_WORDS}"
            )
        if word_count > settings.MAX_WORDS:
            raise HTTPException(
                status_code=400,
                detail=f"النص طويل جداً ({word_count} كلمة). الحد الأقصى: {settings.MAX_WORDS}"
            )
        
        # Create SubmitRequestInput and process
        input_data = SubmitRequestInput(
            user_email=user_email,
            user_name=user_name,
            raw_text=text,
            target_audience=target_audience,
            book_genre=book_genre,
            tone_of_voice=tone_of_voice,
            platform=platform,
            language=language,
            file_name=file.filename
        )
        
        return await submit_manuscript(request, input_data, background_tasks)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail="خطأ في معالجة الملف")


async def _read_file_robust(upload_file, max_size: int) -> bytes:
    """
    Read upload file with chunked reading for stability.
    Handles incomplete reads and EOF gracefully — loops until empty chunk.
    """
    import io
    content = io.BytesIO()
    total_read = 0
    chunk_size = 1024 * 1024  # 1MB chunks

    while True:
        chunk = await upload_file.read(chunk_size)
        if not chunk:
            break
        content.write(chunk)
        total_read += len(chunk)
        if total_read > max_size:
            raise HTTPException(400, f"حجم الملف كبير جداً. الحد الأقصى: {max_size // (1024*1024)}MB")
    return content.getvalue()


@app.post("/api/shadow7/manuscripts/upload")
async def upload_manuscript(request: Request):
    """
    رفع مخطوطة محلي — PostgreSQL + تخزين ملفات.
    Saves file to disk and inserts into manuscripts table.
    Uses request.form(max_part_size=100MB) to avoid Starlette 1MB default.
    Robust read with retry and EOF handling for large files (100k-word docs).
    """
    try:
        max_part = getattr(settings, 'MAX_MULTIPART_PART_SIZE', 100 * 1024 * 1024)
        async with request.form(max_part_size=max_part) as form:
            file = form.get("file")
            if not file or not hasattr(file, 'read'):
                raise HTTPException(400, "الملف مطلوب")

            title = form.get("title") or "Untitled"
            content = form.get("content") or ""
            word_count = int(form.get("word_count") or 0)
            metadata_str = form.get("metadata")
            user_id = form.get("user_id")

            # Validate file type
            allowed = ['.txt', '.docx', '.pdf']
            filename = file.filename or "file"
            ext = os.path.splitext(filename)[-1].lower()
            if ext not in allowed:
                raise HTTPException(400, f"نوع الملف غير مدعوم. المسموح: {', '.join(allowed)}")

            max_size = getattr(settings, 'MAX_MANUSCRIPT_UPLOAD', 100 * 1024 * 1024)
            content_bytes = await _read_file_robust(file, max_size)
            if len(content_bytes) > max_size:
                raise HTTPException(400, f"حجم الملف كبير جداً. الحد الأقصى: {max_size // (1024*1024)}MB")

            # Save file locally
            manuscripts_dir = getattr(settings, 'MANUSCRIPTS_PATH', None) or os.path.join(settings.STORAGE_PATH, 'manuscripts')
            os.makedirs(manuscripts_dir, exist_ok=True)
            safe_name = re.sub(r'[^\w\-\.]', '_', filename)
            file_path = os.path.join(manuscripts_dir, f"{int(datetime.utcnow().timestamp())}-{safe_name}")
            with open(file_path, 'wb') as f:
                f.write(content_bytes)
            relative_path = f"manuscripts/{os.path.basename(file_path)}"

            # Parse metadata
            meta = {}
            if metadata_str:
                try:
                    meta = json.loads(metadata_str)
                except json.JSONDecodeError:
                    pass

            # Insert into DB
            manuscript_data = {
                'title': title,
                'content': content,
                'word_count': word_count,
                'file_path': relative_path,
                'metadata': meta,
                'user_id': uuid.UUID(user_id) if user_id else None,
                'chapters': meta.get('chapters') if isinstance(meta.get('chapters'), list) else None
            }

            created = await db.create_manuscript(manuscript_data)
            logger.info(f"Manuscript uploaded locally: {created['id']} ({len(content_bytes)} bytes)")

            return {
                "id": str(created['id']),
                "title": created['title'],
                "file_path": created['file_path'],
                "word_count": created['word_count'],
                "status": created['status']
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Manuscript upload error: {e}")
        raise HTTPException(500, "فشل رفع المخطوطة")


@app.post("/api/shadow7/manuscripts")
async def create_manuscript_json(request: Request):
    """Create manuscript from JSON (no file) — for editor/metadata-only flow"""
    try:
        data = await request.json()
        manuscript_data = {
            'title': data.get('title', 'Untitled'),
            'author': data.get('author'),
            'content': data.get('content', ''),
            'chapters': data.get('chapters'),
            'word_count': data.get('word_count', 0),
            'metadata': data.get('metadata', {}),
            'user_id': None
        }
        created = await db.create_manuscript(manuscript_data)
        return {
            "id": str(created['id']),
            "title": created['title'],
            "word_count": created['word_count'],
            "status": created.get('status', 'draft')
        }
    except Exception as e:
        logger.error(f"Create manuscript error: {e}")
        raise HTTPException(500, "فشل إنشاء المخطوطة")


@app.get("/api/shadow7/manuscripts")
async def list_manuscripts(order_by: str = "-created_at", limit: int = 100):
    """List manuscripts (PostgreSQL)"""
    try:
        rows = await db.list_manuscripts(order_by=order_by, limit=limit)
        return [{"id": str(r["id"]), "title": r["title"], "author": r.get("author"),
                 "content": r.get("content"), "chapters": r.get("chapters"),
                 "word_count": r.get("word_count"), "status": r.get("status", "draft"),
                 "genre": r.get("genre"), "file_path": r.get("file_path"),
                 "metadata": r.get("metadata"),
                 "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
                 "updated_at": r["updated_at"].isoformat() if r.get("updated_at") else None}
                for r in rows]
    except Exception as e:
        logger.error(f"List manuscripts error: {e}")
        raise HTTPException(500, "فشل جلب المخطوطات")


@app.get("/api/shadow7/manuscripts/{manuscript_id}")
async def get_manuscript(manuscript_id: str):
    """Get single manuscript by id"""
    try:
        row = await db.get_manuscript(manuscript_id)
        if not row:
            raise HTTPException(404, "المخطوطة غير موجودة")
        return {"id": str(row["id"]), "title": row["title"], "author": row.get("author"),
                "content": row.get("content"), "chapters": row.get("chapters"),
                "word_count": row.get("word_count"), "status": row.get("status", "draft"),
                "genre": row.get("genre"), "file_path": row.get("file_path"),
                "metadata": row.get("metadata"),
                "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
                "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get manuscript error: {e}")
        raise HTTPException(500, "فشل جلب المخطوطة")


@app.patch("/api/shadow7/manuscripts/{manuscript_id}")
async def update_manuscript(manuscript_id: str, request: Request):
    """Update manuscript"""
    try:
        data = await request.json()
        row = await db.update_manuscript(manuscript_id, data)
        if not row:
            raise HTTPException(404, "المخطوطة غير موجودة")
        return {"id": str(row["id"]), "title": row["title"], "status": row.get("status")}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update manuscript error: {e}")
        raise HTTPException(500, "فشل تحديث المخطوطة")


@app.delete("/api/shadow7/manuscripts/{manuscript_id}")
async def delete_manuscript(manuscript_id: str):
    """Delete manuscript"""
    try:
        await db.delete_manuscript(manuscript_id)
        return {"success": True}
    except Exception as e:
        logger.error(f"Delete manuscript error: {e}")
        raise HTTPException(500, "فشل حذف المخطوطة")


@app.get(
    "/api/shadow7/track/{tracking_id}",
    response_model=TrackingResponse,
    responses={404: {"model": ErrorResponse}}
)
async def track_request(tracking_id: str):
    """
    Track the status of a publishing request
    """
    try:
        request_data = await db.get_request_by_tracking(tracking_id)
        
        if not request_data:
            raise HTTPException(
                status_code=404,
                detail=f"لم يتم العثور على الطلب: {tracking_id}"
            )
        
        response = TrackingResponse(
            tracking_id=tracking_id,
            status=RequestStatus(request_data['status']),
            progress=request_data['progress'] or 0,
            current_step=request_data.get('current_step'),
            created_at=request_data['created_at'],
            started_at=request_data.get('started_at'),
            completed_at=request_data.get('completed_at'),
            error_message=request_data.get('error_message')
        )
        
        # Add download URL if completed
        if request_data['status'] == 'completed':
            # Get delivery info
            async with (await db.get_pool()).acquire() as conn:
                delivery = await conn.fetchrow(
                    "SELECT * FROM shadow7_deliveries WHERE request_id = $1",
                    request_data['id']
                )
                if delivery:
                    response.download_url = delivery['zip_file_url']
                    response.expires_at = delivery['expires_at']
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Track error: {e}")
        raise HTTPException(status_code=500, detail="خطأ في التتبع")


@app.post("/api/shadow7/callback")
async def n8n_callback(data: N8NCallbackPayload):
    """
    Callback endpoint for n8n to update status
    Called when generation completes or fails
    """
    try:
        if data.status == "completed":
            await db.update_request_status(
                data.tracking_id, 
                "completed",
                progress=100,
                current_step="اكتمل التوليد"
            )
            logger.info(f"✅ Completed: {data.tracking_id}")
            
        elif data.status == "failed":
            err = (data.get_error() or data.error_message or getattr(data, 'error', None)) or 'Unknown'
            await db.update_request_status(
                data.tracking_id,
                "failed",
                error_message=err
            )
            logger.error(f"❌ Failed: {data.tracking_id} - {err}")
        
        return {"received": True}
        
    except Exception as e:
        logger.error(f"Callback error: {e}")
        return {"received": False, "error": str(e)}


@app.get("/api/shadow7/download/{tracking_id}")
async def download_package(tracking_id: str):
    """
    Download the final ZIP package
    """
    try:
        request_data = await db.get_request_by_tracking(tracking_id)
        
        if not request_data:
            raise HTTPException(status_code=404, detail="الطلب غير موجود")
        
        if request_data['status'] != 'completed':
            raise HTTPException(status_code=400, detail="الطلب لم يكتمل بعد")
        
        # Get delivery info
        async with (await db.get_pool()).acquire() as conn:
            delivery = await conn.fetchrow(
                "SELECT * FROM shadow7_deliveries WHERE request_id = $1",
                request_data['id']
            )
        
        if not delivery or not delivery['zip_file_path']:
            raise HTTPException(status_code=404, detail="الملف غير متوفر")
        
        # Check expiry
        if delivery['expires_at'] and delivery['expires_at'] < datetime.utcnow():
            raise HTTPException(status_code=410, detail="انتهت صلاحية الرابط")
        
        # Increment download count
        await db.increment_download(str(request_data['id']))
        
        return FileResponse(
            delivery['zip_file_path'],
            media_type='application/zip',
            filename=f"Shadow7_{tracking_id}.zip"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Download error: {e}")
        raise HTTPException(status_code=500, detail="خطأ في التحميل")


# ─────────────────────────────────────────────────────────────
# N8N INTERNAL ENDPOINTS (Called by workflow)
# ─────────────────────────────────────────────────────────────

@app.post("/api/shadow7/outline")
async def save_outline(data: dict):
    """
    MODULE 2: The Architect
    Save generated book outline
    """
    try:
        tracking_id = data.get('tracking_id')
        outline = data.get('outline', {})
        
        request_data = await db.get_request_by_tracking(tracking_id)
        if not request_data:
            raise HTTPException(status_code=404, detail="Request not found")
        
        request_id = str(request_data['id'])
        
        # Save outline to DB (schema: book_title, book_summary, chapters, chapter_count)
        async with (await db.get_pool()).acquire() as conn:
            await conn.execute("""
                DELETE FROM shadow7_outlines WHERE request_id = $1
            """, request_id)
            await conn.execute("""
                INSERT INTO shadow7_outlines 
                (request_id, book_title, book_summary, chapters, chapter_count)
                VALUES ($1, $2, $3, $4, $5)
            """, 
                request_id,
                outline.get('book_title', 'Untitled'),
                outline.get('subtitle') or outline.get('book_summary'),
                json.dumps(outline.get('chapters', [])),
                outline.get('total_chapters') or outline.get('chapter_count', 0)
            )
        
        # Update request status
        await db.update_request_status(
            tracking_id, 
            'generating_chapters',
            progress=15,
            current_step='جاري توليد الفصول'
        )
        
        await db.log(request_id, "info", "architect", f"Outline saved: {outline.get('book_title')}")
        
        return {"success": True, "request_id": request_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Outline save error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/shadow7/chapter")
async def save_chapter(data: dict):
    """
    MODULE 3: Writers' Room
    Save a generated chapter
    """
    try:
        tracking_id = data.get('tracking_id')
        
        request_data = await db.get_request_by_tracking(tracking_id)
        if not request_data:
            raise HTTPException(status_code=404, detail="Request not found")
        
        request_id = str(request_data['id'])
        
        # Save chapter (schema: chapter_title — n8n قد يرسل title أو chapter_title)
        async with (await db.get_pool()).acquire() as conn:
            await conn.execute("""
                INSERT INTO shadow7_chapters 
                (request_id, chapter_number, chapter_title, content, word_count, ending_summary, status)
                VALUES ($1, $2, $3, $4, $5, $6, 'completed')
            """,
                request_id,
                data.get('chapter_number'),
                data.get('chapter_title') or data.get('title', 'Chapter'),
                data.get('content'),
                data.get('word_count', 0),
                data.get('ending_summary')
            )
        
        await db.log(
            request_id, "info", "writers_room", 
            f"Chapter {data.get('chapter_number')} saved: {data.get('word_count')} words"
        )
        
        return {"success": True, "chapter": data.get('chapter_number')}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chapter save error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/shadow7/progress")
async def update_progress(data: dict):
    """Update request progress"""
    try:
        tracking_id = data.get('tracking_id')
        progress = data.get('progress', 0)
        status = data.get('status', 'generating')
        current_step = data.get('current_step')
        
        await db.update_request_status(
            tracking_id,
            status,
            progress=progress,
            current_step=current_step
        )
        
        return {"success": True, "progress": progress}
        
    except Exception as e:
        logger.error(f"Progress update error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/shadow7/reports")
async def save_reports(data: dict):
    """
    MODULE 5: Consulting Suite
    Save generated consulting reports
    """
    try:
        tracking_id = data.get('tracking_id')
        reports = data.get('reports', {})
        
        request_data = await db.get_request_by_tracking(tracking_id)
        if not request_data:
            raise HTTPException(status_code=404, detail="Request not found")
        
        request_id = str(request_data['id'])
        
        # Save each report (no unique on request_id+report_type, so delete+insert)
        async with (await db.get_pool()).acquire() as conn:
            await conn.execute(
                "DELETE FROM shadow7_reports WHERE request_id = $1",
                request_id
            )
            for report_type, report_data in reports.items():
                await conn.execute("""
                    INSERT INTO shadow7_reports 
                    (request_id, report_type, title, content, scores)
                    VALUES ($1, $2, $3, $4, $5)
                """,
                    request_id,
                    report_type,
                    report_data.get('title', report_type),
                    json.dumps(report_data) if isinstance(report_data, dict) else json.dumps({"raw": str(report_data)}),
                    json.dumps({"score": report_data.get('score', 0)}) if isinstance(report_data, dict) else '{}'
                )
        
        # Update progress
        await db.update_request_status(
            tracking_id,
            'packaging',
            progress=85,
            current_step='جاري تجهيز الحزمة'
        )
        
        await db.log(request_id, "info", "consulting", f"Saved {len(reports)} reports")
        
        return {"success": True, "reports_count": len(reports)}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reports save error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/shadow7/package")
async def create_package(data: dict):
    """
    MODULE 6: Fulfillment & Delivery
    Create final ZIP package
    """
    import zipfile
    import shutil
    
    try:
        tracking_id = data.get('tracking_id')
        
        request_data = await db.get_request_by_tracking(tracking_id)
        if not request_data:
            raise HTTPException(status_code=404, detail="Request not found")
        
        request_id = str(request_data['id'])
        
        # Create package directory (ensure parent exists)
        packages_base = "/var/www/shadow7/packages"
        os.makedirs(packages_base, exist_ok=True)
        package_dir = f"{packages_base}/{tracking_id}"
        os.makedirs(package_dir, exist_ok=True)
        
        # Get outline
        async with (await db.get_pool()).acquire() as conn:
            outline = await conn.fetchrow(
                "SELECT * FROM shadow7_outlines WHERE request_id = $1",
                request_id
            )
            
            chapters = await conn.fetch(
                "SELECT * FROM shadow7_chapters WHERE request_id = $1 ORDER BY chapter_number",
                request_id
            )
            
            reports = await conn.fetch(
                "SELECT * FROM shadow7_reports WHERE request_id = $1",
                request_id
            )
        
        book_title = outline['book_title'] if outline else 'Generated Book'
        
        # Create manuscript file
        manuscript_path = f"{package_dir}/manuscript.txt"
        with open(manuscript_path, 'w', encoding='utf-8') as f:
            f.write(f"# {book_title}\n\n")
            if outline and (outline.get('book_summary') or outline.get('book_subtitle')):
                f.write(f"## {outline.get('book_summary') or outline.get('book_subtitle')}\n\n")
            f.write("---\n\n")
            
            total_words = 0
            for chapter in chapters:
                ch_title = chapter.get('chapter_title') or chapter.get('title', 'Chapter')
                f.write(f"\n\n## الفصل {chapter['chapter_number']}: {ch_title}\n\n")
                f.write(chapter.get('content') or '')
                f.write("\n")
                total_words += chapter.get('word_count') or 0
        
        # Create metadata JSON
        metadata = {
            "tracking_id": tracking_id,
            "book_title": book_title,
            "total_chapters": len(chapters),
            "total_words": total_words,
            "generated_at": datetime.utcnow().isoformat(),
            "internal_isbn": f"978-0-S7-{tracking_id[-6:]}-0"
        }
        
        with open(f"{package_dir}/metadata.json", 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        
        # Create reports directory
        reports_dir = f"{package_dir}/reports"
        os.makedirs(reports_dir, exist_ok=True)
        
        for report in reports:
            report_path = f"{reports_dir}/{report['report_type']}.json"
            rc = report.get('content')
            content = rc if isinstance(rc, dict) else (json.loads(rc) if isinstance(rc, str) and rc else {})
            with open(report_path, 'w', encoding='utf-8') as f:
                json.dump(content, f, ensure_ascii=False, indent=2)
        
        # Create ZIP
        zip_path = f"/var/www/shadow7/packages/Shadow7_{tracking_id}.zip"
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(package_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, package_dir)
                    zipf.write(file_path, arcname)
        
        # Cleanup temp directory
        shutil.rmtree(package_dir)
        
        # Calculate expiry (7 days)
        expires_at = datetime.utcnow() + timedelta(days=7)
        
        # Save delivery record (no unique on request_id, delete old then insert)
        download_url = f"https://publisher.mrf103.com/api/shadow7/download/{tracking_id}"
        
        async with (await db.get_pool()).acquire() as conn:
            await conn.execute(
                "DELETE FROM shadow7_deliveries WHERE request_id = $1",
                request_id
            )
            await conn.execute("""
                INSERT INTO shadow7_deliveries 
                (request_id, zip_file_path, zip_file_url, zip_file_size, internal_isbn, expires_at)
                VALUES ($1, $2, $3, $4, $5, $6)
            """,
                request_id,
                zip_path,
                download_url,
                os.path.getsize(zip_path) if os.path.exists(zip_path) else 0,
                metadata['internal_isbn'],
                expires_at
            )
        
        await db.log(request_id, "info", "fulfillment", f"Package created: {total_words} words")
        
        return {
            "success": True,
            "tracking_id": tracking_id,
            "download_url": download_url,
            "expires_at": expires_at.isoformat(),
            "total_words": total_words
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Package creation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────
# ADMIN / INTERNAL ROUTES
# ─────────────────────────────────────────────────────────────

@app.get("/api/shadow7/admin/stats")
async def admin_stats():
    """Admin statistics (internal use)"""
    try:
        async with (await db.get_pool()).acquire() as conn:
            total = await conn.fetchval(
                "SELECT COUNT(*) FROM shadow7_requests"
            )
            completed = await conn.fetchval(
                "SELECT COUNT(*) FROM shadow7_requests WHERE status = 'completed'"
            )
            pending = await conn.fetchval(
                "SELECT COUNT(*) FROM shadow7_requests WHERE status = 'pending'"
            )
            failed = await conn.fetchval(
                "SELECT COUNT(*) FROM shadow7_requests WHERE status = 'failed'"
            )
        
        return {
            "total_requests": total,
            "completed": completed,
            "pending": pending,
            "failed": failed,
            "success_rate": f"{(completed / max(total, 1) * 100):.1f}%"
        }
        
    except Exception as e:
        logger.error(f"Stats error: {e}")
        return {"error": str(e)}


# ─────────────────────────────────────────────────────────────
# EMAIL ROUTES
# ─────────────────────────────────────────────────────────────

from pydantic import BaseModel, EmailStr
from typing import List

class SendEmailRequest(BaseModel):
    to_email: str
    subject: str
    body_html: str
    user_id: Optional[str] = None
    template: Optional[str] = None

class SendTemplateRequest(BaseModel):
    to_email: str
    template_name: str
    user_id: Optional[str] = None
    variables: dict = {}


@app.post("/api/shadow7/email/send")
async def send_email(req: SendEmailRequest, background_tasks: BackgroundTasks):
    """Send a custom email (queued in background)"""
    svc = get_email_service()
    result = await svc.send_email(
        to_email=req.to_email, subject=req.subject,
        body_html=req.body_html, user_id=req.user_id, template=req.template
    )
    return result


@app.post("/api/shadow7/email/template")
async def send_template_email(req: SendTemplateRequest):
    """Send a templated email (welcome, manuscript_submitted, manuscript_complete, report)"""
    svc = get_email_service()
    try:
        result = await svc.send_template(
            to_email=req.to_email, template_name=req.template_name,
            user_id=req.user_id, **req.variables
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/shadow7/email/log")
async def get_email_log(user_id: Optional[str] = None, limit: int = 50):
    """Get email log entries"""
    try:
        async with (await db.get_pool()).acquire() as conn:
            if user_id:
                rows = await conn.fetch(
                    "SELECT id, to_email, subject, template, status, error_message, "
                    "sent_at, created_at FROM email_log WHERE user_id = $1 "
                    "ORDER BY created_at DESC LIMIT $2",
                    uuid.UUID(user_id), limit
                )
            else:
                rows = await conn.fetch(
                    "SELECT id, to_email, subject, template, status, error_message, "
                    "sent_at, created_at FROM email_log "
                    "ORDER BY created_at DESC LIMIT $1",
                    limit
                )
        return [{"id": str(r["id"]), "to_email": r["to_email"], "subject": r["subject"],
                 "template": r["template"], "status": r["status"],
                 "error_message": r["error_message"],
                 "sent_at": r["sent_at"].isoformat() if r["sent_at"] else None,
                 "created_at": r["created_at"].isoformat() if r["created_at"] else None}
                for r in rows]
    except Exception as e:
        logger.error(f"Email log error: {e}")
        return []


@app.get("/api/shadow7/email/status")
async def email_status():
    """Check email service configuration status"""
    svc = get_email_service()
    return {
        "smtp_configured": svc.is_configured(),
        "smtp_host": svc.smtp_host or "not set",
        "from_email": svc.from_email,
        "templates_available": list(TEMPLATES.keys()) if 'TEMPLATES' in dir() else ["welcome", "manuscript_submitted", "manuscript_complete", "report"]
    }


# ─────────────────────────────────────────────────────────────
# RUN
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info"
    )
