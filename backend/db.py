# /root/products/shadow-seven-publisher/backend/db.py
"""
SHADOW-7 Publisher — Database Connection Pool
Uses asyncpg for async PostgreSQL operations
"""

import asyncpg
import json
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional
from config import settings
import logging

logger = logging.getLogger(__name__)

# Global connection pool
_pool: Optional[asyncpg.Pool] = None


async def init_db() -> asyncpg.Pool:
    """Initialize the database connection pool"""
    global _pool
    
    if _pool is not None:
        return _pool
    
    try:
        _pool = await asyncpg.create_pool(
            settings.DATABASE_URL,
            min_size=settings.DB_POOL_MIN,
            max_size=settings.DB_POOL_MAX,
            command_timeout=60
        )
        logger.info("✅ Database pool initialized")
        return _pool
    except Exception as e:
        logger.error(f"❌ Database connection failed: {e}")
        raise


async def close_db():
    """Close the database connection pool"""
    global _pool
    
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("Database pool closed")


async def get_pool() -> asyncpg.Pool:
    """Get the connection pool, initializing if needed"""
    global _pool
    
    if _pool is None:
        _pool = await init_db()
    
    return _pool


@asynccontextmanager
async def get_connection() -> AsyncGenerator[asyncpg.Connection, None]:
    """Context manager for database connections"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        yield conn


class DatabaseService:
    """
    Database operations for Shadow-7 tables
    All methods are async and use connection pooling
    """
    
    @staticmethod
    async def get_pool() -> asyncpg.Pool:
        """Get the connection pool"""
        return await get_pool()
    
    # ─────────────────────────────────────────────────────────
    # REQUESTS
    # ─────────────────────────────────────────────────────────
    
    @staticmethod
    async def create_request(data: dict) -> dict:
        """Create a new publishing request"""
        async with get_connection() as conn:
            row = await conn.fetchrow("""
                INSERT INTO shadow7_requests (
                    tracking_id, user_email, user_name, raw_text, 
                    word_count_in, file_name, target_audience,
                    book_genre, tone_of_voice, platform, language,
                    ip_address, user_agent
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                RETURNING *
            """, 
                data['tracking_id'], data['user_email'], data.get('user_name'),
                data['raw_text'], data['word_count_in'], data.get('file_name'),
                data.get('target_audience'), data.get('book_genre'),
                data.get('tone_of_voice'), data.get('platform', 'kindle'),
                data.get('language', 'ar'), data.get('ip_address'),
                data.get('user_agent')
            )
            return dict(row)
    
    @staticmethod
    async def get_request_by_tracking(tracking_id: str) -> Optional[dict]:
        """Get request by tracking ID"""
        async with get_connection() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM shadow7_requests WHERE tracking_id = $1",
                tracking_id
            )
            return dict(row) if row else None
    
    @staticmethod
    async def update_request_status(
        tracking_id: str, 
        status: str, 
        progress: int = None,
        current_step: str = None,
        error_message: str = None
    ) -> bool:
        """Update request status and progress"""
        async with get_connection() as conn:
            updates = ["status = $2"]
            params = [tracking_id, status]
            idx = 3
            
            if progress is not None:
                updates.append(f"progress = ${idx}")
                params.append(progress)
                idx += 1
            
            if current_step:
                updates.append(f"current_step = ${idx}")
                params.append(current_step)
                idx += 1
            
            if error_message:
                updates.append(f"error_message = ${idx}")
                params.append(error_message)
                idx += 1
            
            if status == 'completed':
                updates.append("completed_at = NOW()")
            elif status not in ('pending', 'failed'):
                updates.append("started_at = COALESCE(started_at, NOW())")
            
            query = f"UPDATE shadow7_requests SET {', '.join(updates)} WHERE tracking_id = $1"
            result = await conn.execute(query, *params)
            return result == "UPDATE 1"
    
    # ─────────────────────────────────────────────────────────
    # OUTLINES
    # ─────────────────────────────────────────────────────────
    
    @staticmethod
    async def create_outline(data: dict) -> dict:
        """Create book outline"""
        async with get_connection() as conn:
            import json
            row = await conn.fetchrow("""
                INSERT INTO shadow7_outlines (
                    request_id, book_title, book_summary, chapters,
                    chapter_count, model_used, generation_time_ms
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            """,
                data['request_id'], data['book_title'], data.get('book_summary'),
                json.dumps(data.get('chapters', [])), data.get('chapter_count', 10),
                data.get('model_used'), data.get('generation_time_ms')
            )
            return dict(row)
    
    @staticmethod
    async def get_outline_by_request(request_id: str) -> Optional[dict]:
        """Get outline for a request"""
        async with get_connection() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM shadow7_outlines WHERE request_id = $1",
                request_id
            )
            return dict(row) if row else None
    
    # ─────────────────────────────────────────────────────────
    # CHAPTERS
    # ─────────────────────────────────────────────────────────
    
    @staticmethod
    async def create_chapter(data: dict) -> dict:
        """Create a chapter record"""
        async with get_connection() as conn:
            row = await conn.fetchrow("""
                INSERT INTO shadow7_chapters (
                    request_id, outline_id, chapter_number, chapter_title,
                    status
                ) VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            """,
                data['request_id'], data['outline_id'], data['chapter_number'],
                data['chapter_title'], 'pending'
            )
            return dict(row)
    
    @staticmethod
    async def update_chapter_content(
        chapter_id: str,
        content: str,
        word_count: int,
        ending_summary: str = None,
        model_used: str = None,
        generation_time_ms: int = None
    ) -> bool:
        """Update chapter with generated content"""
        async with get_connection() as conn:
            result = await conn.execute("""
                UPDATE shadow7_chapters SET
                    content = $2, word_count = $3, ending_summary = $4,
                    status = 'completed', model_used = $5,
                    generation_time_ms = $6, completed_at = NOW()
                WHERE id = $1
            """, chapter_id, content, word_count, ending_summary, 
                model_used, generation_time_ms)
            return result == "UPDATE 1"
    
    @staticmethod
    async def get_chapters_by_request(request_id: str) -> list:
        """Get all chapters for a request"""
        async with get_connection() as conn:
            rows = await conn.fetch(
                "SELECT * FROM shadow7_chapters WHERE request_id = $1 ORDER BY chapter_number",
                request_id
            )
            return [dict(row) for row in rows]
    
    # ─────────────────────────────────────────────────────────
    # MEDIA
    # ─────────────────────────────────────────────────────────
    
    @staticmethod
    async def create_media(data: dict) -> dict:
        """Create media record"""
        async with get_connection() as conn:
            import json
            row = await conn.fetchrow("""
                INSERT INTO shadow7_media (
                    request_id, media_type, prompt_used, 
                    style_params, dimensions, status
                ) VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            """,
                data['request_id'], data['media_type'], data.get('prompt_used'),
                json.dumps(data.get('style_params', {})), data.get('dimensions'),
                'pending'
            )
            return dict(row)
    
    @staticmethod
    async def update_media_file(
        media_id: str, 
        file_path: str, 
        file_url: str,
        file_size: int,
        mime_type: str
    ) -> bool:
        """Update media with generated file info"""
        async with get_connection() as conn:
            result = await conn.execute("""
                UPDATE shadow7_media SET
                    file_path = $2, file_url = $3, file_size_bytes = $4,
                    mime_type = $5, status = 'completed'
                WHERE id = $1
            """, media_id, file_path, file_url, file_size, mime_type)
            return result == "UPDATE 1"
    
    # ─────────────────────────────────────────────────────────
    # REPORTS
    # ─────────────────────────────────────────────────────────
    
    @staticmethod
    async def create_report(data: dict) -> dict:
        """Create consulting report"""
        async with get_connection() as conn:
            import json
            row = await conn.fetchrow("""
                INSERT INTO shadow7_reports (
                    request_id, report_type, title, content,
                    scores, overall_score
                ) VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            """,
                data['request_id'], data['report_type'], data.get('title'),
                json.dumps(data.get('content', {})),
                json.dumps(data.get('scores', {})) if data.get('scores') else None,
                data.get('overall_score')
            )
            return dict(row)
    
    # ─────────────────────────────────────────────────────────
    # DELIVERIES
    # ─────────────────────────────────────────────────────────
    
    @staticmethod
    async def create_delivery(data: dict) -> dict:
        """Create delivery record"""
        async with get_connection() as conn:
            row = await conn.fetchrow("""
                INSERT INTO shadow7_deliveries (
                    request_id, zip_file_path, zip_file_url,
                    zip_file_size, internal_isbn, expires_at
                ) VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '14 days')
                RETURNING *
            """,
                data['request_id'], data.get('zip_file_path'),
                data.get('zip_file_url'), data.get('zip_file_size'),
                data.get('internal_isbn')
            )
            return dict(row)
    
    @staticmethod
    async def mark_email_sent(request_id: str) -> bool:
        """Mark email as sent"""
        async with get_connection() as conn:
            result = await conn.execute("""
                UPDATE shadow7_deliveries SET
                    email_sent = TRUE, email_sent_at = NOW()
                WHERE request_id = $1
            """, request_id)
            return result == "UPDATE 1"
    
    @staticmethod
    async def increment_download(request_id: str) -> bool:
        """Increment download counter"""
        async with get_connection() as conn:
            result = await conn.execute("""
                UPDATE shadow7_deliveries SET
                    download_count = download_count + 1,
                    last_downloaded = NOW()
                WHERE request_id = $1
            """, request_id)
            return result == "UPDATE 1"
    
    # ─────────────────────────────────────────────────────────
    # MANUSCRIPTS (PostgreSQL + تخزين محلي)
    # ─────────────────────────────────────────────────────────

    @staticmethod
    async def ensure_manuscripts_table(conn) -> None:
        """Create manuscripts table if not exists (local-only schema, no auth.users FK)"""
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS public.manuscripts (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                title TEXT NOT NULL,
                author TEXT,
                content TEXT,
                chapters JSONB,
                word_count INTEGER,
                status TEXT DEFAULT 'draft',
                file_path TEXT,
                cover_url TEXT,
                metadata JSONB,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                user_id UUID
            )
        """)
        # Migration: add metadata if table existed before
        await conn.execute("""
            ALTER TABLE public.manuscripts ADD COLUMN IF NOT EXISTS metadata JSONB
        """)

    @staticmethod
    async def create_manuscript(data: dict) -> dict:
        """Create manuscript record (local upload flow)"""
        async with get_connection() as conn:
            await DatabaseService.ensure_manuscripts_table(conn)
            row = await conn.fetchrow("""
                INSERT INTO public.manuscripts (
                    title, author, content, chapters, word_count,
                    status, file_path, metadata, user_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            """,
                data.get('title', 'Untitled'),
                data.get('author'),
                data.get('content'),
                json.dumps(data.get('chapters', [])) if data.get('chapters') else None,
                data.get('word_count', 0),
                data.get('status', 'draft'),
                data.get('file_path'),
                json.dumps(data.get('metadata', {})) if data.get('metadata') else None,
                data.get('user_id')
            )
            return dict(row)

    @staticmethod
    async def list_manuscripts(order_by: str = '-created_at', limit: int = 100) -> list:
        """List manuscripts (PostgreSQL)"""
        async with get_connection() as conn:
            await DatabaseService.ensure_manuscripts_table(conn)
            col = 'created_at' if not order_by else (order_by.lstrip('-') or 'created_at')
            desc = order_by.startswith('-') if order_by else True
            safe_cols = {'created_at', 'updated_at', 'title', 'word_count'}
            col = col if col in safe_cols else 'created_at'
            order = 'DESC' if desc else 'ASC'
            rows = await conn.fetch(
                f'SELECT * FROM public.manuscripts ORDER BY "{col}" {order} LIMIT $1',
                limit
            )
            return [dict(r) for r in rows]

    @staticmethod
    async def get_manuscript(id: str) -> Optional[dict]:
        """Get single manuscript by id"""
        async with get_connection() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM public.manuscripts WHERE id = $1",
                id
            )
            return dict(row) if row else None

    @staticmethod
    async def update_manuscript(id: str, data: dict) -> Optional[dict]:
        """Update manuscript"""
        async with get_connection() as conn:
            updates = []
            vals = []
            idx = 1
            for k, v in data.items():
                if k in ('title', 'author', 'content', 'chapters', 'word_count', 'status', 'file_path', 'metadata'):
                    updates.append(f'"{k}" = ${idx}')
                    vals.append(json.dumps(v) if k in ('chapters', 'metadata') and v is not None else v)
                    idx += 1
            if not updates:
                return await DatabaseService.get_manuscript(id)
            updates.append('"updated_at" = NOW()')
            vals.append(id)
            row = await conn.fetchrow(
                f"UPDATE public.manuscripts SET {', '.join(updates)} WHERE id = ${idx} RETURNING *",
                *vals
            )
            return dict(row) if row else None

    @staticmethod
    async def delete_manuscript(id: str) -> bool:
        """Delete manuscript"""
        async with get_connection() as conn:
            await conn.execute("DELETE FROM public.manuscripts WHERE id = $1", id)
            return True

    # ─────────────────────────────────────────────────────────
    # LOGS
    # ─────────────────────────────────────────────────────────
    
    @staticmethod
    async def log(
        request_id: str,
        level: str,
        module: str,
        message: str,
        details: dict = None
    ):
        """Add execution log"""
        async with get_connection() as conn:
            import json
            await conn.execute("""
                INSERT INTO shadow7_logs (request_id, level, module, message, details)
                VALUES ($1, $2, $3, $4, $5)
            """, request_id, level, module, message, 
                json.dumps(details) if details else None)


# Shortcut instance
db = DatabaseService()
