# /root/products/shadow-seven-publisher/backend/models.py
"""
SHADOW-7 Publisher — Pydantic Models
Request/Response validation schemas
"""

from pydantic import BaseModel, Field, EmailStr, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
import re


class TargetAudience(str, Enum):
    CHILDREN = "أطفال"
    YOUTH = "شباب"
    ADULTS = "بالغين"
    SPECIALISTS = "متخصصين"
    GENERAL = "عام"


class BookGenre(str, Enum):
    SCIFI = "خيال علمي"
    ROMANCE = "رومانسي"
    THRILLER = "تشويق"
    ACADEMIC = "أكاديمي"
    MARKETING = "تسويقي"
    SELF_HELP = "تطوير ذات"
    BIOGRAPHY = "سيرة ذاتية"
    HISTORICAL = "تاريخي"
    RELIGIOUS = "ديني"
    OTHER = "آخر"


class ToneOfVoice(str, Enum):
    FORMAL = "رسمي"
    FRIENDLY = "ودي"
    ACADEMIC = "أكاديمي"
    SUSPENSEFUL = "تشويقي"
    INSPIRATIONAL = "إلهامي"
    HUMOROUS = "فكاهي"


class Platform(str, Enum):
    KINDLE = "kindle"
    PRINT_A5 = "print_a5"
    PRINT_A4 = "print_a4"
    EPUB_GENERIC = "epub_generic"


class RequestStatus(str, Enum):
    PENDING = "pending"
    OUTLINING = "outlining"
    WRITING = "writing"
    DESIGNING = "designing"
    EXPORTING = "exporting"
    COMPLETED = "completed"
    FAILED = "failed"


# ─────────────────────────────────────────────────────────────
# INPUT MODELS
# ─────────────────────────────────────────────────────────────

class SubmitRequestInput(BaseModel):
    """Input for submitting a new publishing request"""
    
    user_email: EmailStr = Field(..., description="User email for delivery")
    user_name: Optional[str] = Field(None, max_length=255)
    
    raw_text: str = Field(
        ..., 
        min_length=500,
        max_length=50000,
        description="Raw manuscript text (500-3000 words recommended)"
    )
    
    target_audience: TargetAudience = Field(
        default=TargetAudience.GENERAL,
        description="Target audience for the book"
    )
    
    book_genre: BookGenre = Field(
        default=BookGenre.OTHER,
        description="Book genre/category"
    )
    
    tone_of_voice: ToneOfVoice = Field(
        default=ToneOfVoice.FORMAL,
        description="Writing tone"
    )
    
    platform: Platform = Field(
        default=Platform.KINDLE,
        description="Target publishing platform"
    )
    
    language: str = Field(
        default="ar",
        pattern="^(ar|en)$",
        description="Primary language"
    )
    
    file_name: Optional[str] = Field(None, max_length=255)
    
    @validator('raw_text')
    def validate_text(cls, v):
        # Clean and validate
        v = v.strip()
        
        # Count words
        words = len(v.split())
        if words < 100:
            raise ValueError(f"النص قصير جداً ({words} كلمة). الحد الأدنى 500 كلمة.")
        if words > 5000:
            raise ValueError(f"النص طويل جداً ({words} كلمة). الحد الأقصى 3000 كلمة.")
        
        # Check for Arabic content
        arabic_chars = len(re.findall(r'[\u0600-\u06FF]', v))
        if arabic_chars / max(len(v.replace(' ', '')), 1) < 0.3:
            raise ValueError("النص يجب أن يحتوي على محتوى عربي كافٍ (30% على الأقل)")
        
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "user_email": "author@example.com",
                "user_name": "محمد الكاتب",
                "raw_text": "هذا نص المخطوطة الأولية التي سيتم توسيعها...",
                "target_audience": "بالغين",
                "book_genre": "خيال علمي",
                "tone_of_voice": "تشويقي",
                "platform": "kindle",
                "language": "ar"
            }
        }


class FileUploadInput(BaseModel):
    """Input for file-based submission"""
    
    user_email: EmailStr
    user_name: Optional[str] = None
    target_audience: TargetAudience = TargetAudience.GENERAL
    book_genre: BookGenre = BookGenre.OTHER
    tone_of_voice: ToneOfVoice = ToneOfVoice.FORMAL
    platform: Platform = Platform.KINDLE
    language: str = "ar"


# ─────────────────────────────────────────────────────────────
# OUTPUT MODELS
# ─────────────────────────────────────────────────────────────

class SubmitResponse(BaseModel):
    """Response after successful submission"""
    
    success: bool = True
    tracking_id: str = Field(..., description="Unique tracking ID (e.g., S7-A3B5C7)")
    message: str = Field(
        default="تم استلام مخطوطتك بنجاح. سنرسل لك رابط التحميل عبر البريد الإلكتروني."
    )
    estimated_time: str = Field(
        default="30-60 دقيقة",
        description="Estimated completion time"
    )
    word_count: int = Field(..., description="Input word count")
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "tracking_id": "S7-A3B5C7D9",
                "message": "تم استلام مخطوطتك بنجاح",
                "estimated_time": "30-60 دقيقة",
                "word_count": 1250
            }
        }


class TrackingResponse(BaseModel):
    """Response for tracking status"""
    
    tracking_id: str
    status: RequestStatus
    progress: int = Field(ge=0, le=100)
    current_step: Optional[str] = None
    
    # Timestamps
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    # Error info (only if failed)
    error_message: Optional[str] = None
    
    # Download link (only if completed)
    download_url: Optional[str] = None
    expires_at: Optional[datetime] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "tracking_id": "S7-A3B5C7D9",
                "status": "writing",
                "progress": 45,
                "current_step": "كتابة الفصل 5 من 10",
                "created_at": "2026-02-19T10:30:00Z",
                "started_at": "2026-02-19T10:31:00Z"
            }
        }


class ChapterInfo(BaseModel):
    """Chapter information in outline"""
    
    number: int
    title: str
    summary: str
    key_points: List[str] = []


class OutlineResponse(BaseModel):
    """Book outline response"""
    
    book_title: str
    book_summary: Optional[str] = None
    chapters: List[ChapterInfo]
    total_chapters: int
    model_used: str
    generation_time_ms: int


class ReportScore(BaseModel):
    """Text evaluation scores"""
    
    context: int = Field(ge=0, le=100)
    structure: int = Field(ge=0, le=100)
    language: int = Field(ge=0, le=100)
    appeal: int = Field(ge=0, le=100)
    logic: int = Field(ge=0, le=100)
    marketability: int = Field(ge=0, le=100)
    overall: int = Field(ge=0, le=100)


class DeliveryInfo(BaseModel):
    """Final delivery information"""
    
    tracking_id: str
    internal_isbn: str
    download_url: str
    expires_at: datetime
    contents: List[str] = Field(
        default=[
            "Book_Manuscript/ (PDF + DOCX)",
            "Cover_Design/ (JPG/PNG)",
            "Marketing_Kit/ (4 promo images + video script)",
            "Consulting_Reports/ (4 PDFs)"
        ]
    )
    download_count: int = 0


# ─────────────────────────────────────────────────────────────
# ERROR MODELS
# ─────────────────────────────────────────────────────────────

class ErrorResponse(BaseModel):
    """Standard error response"""
    
    success: bool = False
    error: str
    error_code: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": False,
                "error": "النص قصير جداً",
                "error_code": "VALIDATION_ERROR",
                "details": {"word_count": 150, "minimum": 500}
            }
        }


# ─────────────────────────────────────────────────────────────
# WEBHOOK MODELS (for n8n)
# ─────────────────────────────────────────────────────────────

class N8NWebhookPayload(BaseModel):
    """Payload sent to n8n webhook"""
    
    tracking_id: str
    request_id: str
    user_email: str
    user_name: Optional[str]
    raw_text: str
    word_count: int
    preferences: Dict[str, str]
    callback_url: str


class N8NCallbackPayload(BaseModel):
    """Payload received from n8n on completion"""
    
    tracking_id: str
    status: str  # "completed" or "failed"
    outline_id: Optional[str] = None
    error_message: Optional[str] = None
    error: Optional[str] = None  # n8n workflow sends "error"
    zip_file_path: Optional[str] = None
    zip_file_url: Optional[str] = None

    def get_error(self) -> Optional[str]:
        """Return error_message or error (workflow sends either)"""
        return self.error_message or self.error
