# /root/products/shadow-seven-publisher/backend/config.py
"""
SHADOW-7 Publisher — Configuration
All settings centralized here for easy modification
"""

from pydantic_settings import BaseSettings
from functools import lru_cache
import os

class Settings(BaseSettings):
    # Application
    APP_NAME: str = "SHADOW-7 Publisher API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8002  # ISOLATED PORT — no conflict
    
    # Database
    DATABASE_URL: str = "postgresql://postgres:nexus_mrf_password_2026@nexus_db:5432/nexus_db"
    DB_POOL_MIN: int = 5
    DB_POOL_MAX: int = 20
    
    # Ollama AI
    OLLAMA_URL: str = "http://nexus_ollama:11434"
    OLLAMA_MODEL: str = "llama3.2:3b"
    # Gemini (for Omni-Publisher Purge)
    GEMINI_API_KEY: str = ""
    OLLAMA_TIMEOUT: int = 300  # 5 minutes for long generations
    
    # n8n Webhook
    N8N_WEBHOOK_URL: str = "http://localhost:5678/webhook/shadow7-generate"
    N8N_API_KEY: str = ""  # Optional authentication
    
    # File Storage
    STORAGE_PATH: str = "/var/www/shadow7/storage"
    EXPORTS_PATH: str = "/var/www/shadow7/exports"
    MANUSCRIPTS_PATH: str = "/var/www/shadow7/storage/manuscripts"
    MAX_UPLOAD_SIZE: int = 100 * 1024 * 1024  # 100MB (unified with manuscripts for 200k words)
    MAX_MANUSCRIPT_UPLOAD: int = 100 * 1024 * 1024  # 100MB for 100k-word docs + ZIP
    MAX_MULTIPART_PART_SIZE: int = 100 * 1024 * 1024  # 100MB — overrides Starlette 1MB default
    
    # Limits (unified: Upload + Submit honor 200k max)
    MIN_WORDS: int = 500
    MAX_WORDS: int = 200000
    TARGET_WORD_COUNT: int = 15000  # Output target
    CHAPTER_COUNT: int = 10
    
    # Email (for delivery notifications)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    FROM_EMAIL: str = "publisher@mrf103.com"
    
    # Security
    API_KEY_HEADER: str = "X-API-Key"
    CORS_ORIGINS: list = ["https://publisher.mrf103.com", "http://localhost:5173"]
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
