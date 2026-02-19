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
import logging
from datetime import datetime, timedelta
from typing import Optional

from config import settings
from db import init_db, close_db, db
from models import (
    SubmitRequestInput, SubmitResponse, TrackingResponse,
    ErrorResponse, FileUploadInput, N8NCallbackPayload,
    RequestStatus
)

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
    
    # Create storage directories
    os.makedirs(settings.STORAGE_PATH, exist_ok=True)
    os.makedirs(settings.EXPORTS_PATH, exist_ok=True)
    
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


# ─────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────

def generate_tracking_id() -> str:
    """Generate unique tracking ID (S7-XXXXXXXX)"""
    return f"S7-{secrets.token_hex(4).upper()}"


def scrub_text(text: str) -> str:
    """
    Clean and normalize Arabic text
    - Remove extreme whitespace
    - Fix common typos
    - Normalize Arabic characters
    """
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()
    
    # Normalize Arabic characters
    replacements = {
        'ي': 'ي',  # Normalize yaa
        'ة': 'ة',  # Normalize taa marbuta
        'أ': 'أ', 'إ': 'إ', 'آ': 'آ',  # Normalize alef variants
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    
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
            payload = {
                "tracking_id": tracking_id,
                "request_id": str(request_data['id']),
                "user_email": request_data['user_email'],
                "user_name": request_data.get('user_name'),
                "raw_text": request_data['raw_text'],
                "word_count": request_data['word_count_in'],
                "preferences": {
                    "target_audience": request_data.get('target_audience', 'عام'),
                    "book_genre": request_data.get('book_genre', 'آخر'),
                    "tone_of_voice": request_data.get('tone_of_voice', 'رسمي'),
                    "platform": request_data.get('platform', 'kindle'),
                    "language": request_data.get('language', 'ar')
                },
                "callback_url": f"http://localhost:{settings.PORT}/api/shadow7/callback"
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
# ROUTES: /api/shadow7/
# ─────────────────────────────────────────────────────────────

@app.get("/api/shadow7/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "SHADOW-7 Publisher",
        "version": settings.APP_VERSION,
        "timestamp": datetime.utcnow().isoformat()
    }


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
            await db.update_request_status(
                data.tracking_id,
                "failed",
                error_message=data.error_message
            )
            logger.error(f"❌ Failed: {data.tracking_id} - {data.error_message}")
        
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
        
        # Save outline to DB
        async with (await db.get_pool()).acquire() as conn:
            await conn.execute("""
                INSERT INTO shadow7_outlines 
                (request_id, book_title, book_subtitle, chapters, total_chapters)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (request_id) DO UPDATE SET
                    book_title = EXCLUDED.book_title,
                    chapters = EXCLUDED.chapters
            """, 
                request_id,
                outline.get('book_title', 'Untitled'),
                outline.get('subtitle'),
                json.dumps(outline.get('chapters', [])),
                outline.get('total_chapters', 0)
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
        
        # Save chapter
        async with (await db.get_pool()).acquire() as conn:
            await conn.execute("""
                INSERT INTO shadow7_chapters 
                (request_id, chapter_number, title, content, word_count, ending_summary)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (request_id, chapter_number) DO UPDATE SET
                    content = EXCLUDED.content,
                    word_count = EXCLUDED.word_count,
                    ending_summary = EXCLUDED.ending_summary
            """,
                request_id,
                data.get('chapter_number'),
                data.get('title'),
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
        
        # Save each report
        async with (await db.get_pool()).acquire() as conn:
            for report_type, report_data in reports.items():
                await conn.execute("""
                    INSERT INTO shadow7_reports 
                    (request_id, report_type, title, content, scores)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (request_id, report_type) DO UPDATE SET
                        content = EXCLUDED.content,
                        scores = EXCLUDED.scores
                """,
                    request_id,
                    report_type,
                    report_data.get('title', report_type),
                    json.dumps(report_data),
                    json.dumps({"score": report_data.get('score', 0)})
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
        
        # Create package directory
        package_dir = f"/var/www/shadow7/packages/{tracking_id}"
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
            if outline and outline['book_subtitle']:
                f.write(f"## {outline['book_subtitle']}\n\n")
            f.write("---\n\n")
            
            total_words = 0
            for chapter in chapters:
                f.write(f"\n\n## الفصل {chapter['chapter_number']}: {chapter['title']}\n\n")
                f.write(chapter['content'] or '')
                f.write("\n")
                total_words += chapter['word_count'] or 0
        
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
            content = json.loads(report['content']) if report['content'] else {}
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
        
        # Save delivery record
        download_url = f"https://publisher.mrf103.com/api/shadow7/download/{tracking_id}"
        
        async with (await db.get_pool()).acquire() as conn:
            await conn.execute("""
                INSERT INTO shadow7_deliveries 
                (request_id, zip_file_path, zip_file_url, internal_isbn, expires_at, word_count_final)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (request_id) DO UPDATE SET
                    zip_file_path = EXCLUDED.zip_file_path,
                    expires_at = EXCLUDED.expires_at
            """,
                request_id,
                zip_path,
                download_url,
                metadata['internal_isbn'],
                expires_at,
                total_words
            )
        
        await db.log(request_id, "info", "fulfillment", f"Package created: {total_words} words")
        
        return {
            "success": True,
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
