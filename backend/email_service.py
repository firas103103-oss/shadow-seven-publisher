# /root/products/shadow-seven-publisher/backend/email_service.py
"""
SHADOW-7 Publisher — Email Service
Handles SMTP sending, templating, and email_log DB entries.
Works with PostgREST email_log table and direct SMTP.
"""

import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from datetime import datetime
from typing import Optional, List, Dict
import json
import uuid

from config import settings

logger = logging.getLogger("shadow7.email")


# ─────────────────────────────────────────────────────
# EMAIL TEMPLATES
# ─────────────────────────────────────────────────────

TEMPLATES = {
    "welcome": {
        "subject": "مرحباً بك في SHADOW-7 Publisher | Welcome to SHADOW-7",
        "html": """
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 100%); color: #e0e0e0; padding: 40px; border-radius: 12px; border: 1px solid #6c2bd9;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #a855f7; margin: 0; font-size: 28px;">SHADOW-7</h1>
                <p style="color: #6c2bd9; margin: 5px 0 0 0; font-size: 14px;">PUBLISHER</p>
            </div>
            <h2 style="color: #f0abfc; text-align: center;">مرحباً بك، {name}!</h2>
            <p style="line-height: 1.8; text-align: center;">تم إنشاء حسابك بنجاح في منصة SHADOW-7 للنشر الذكي.</p>
            <div style="background: rgba(168, 85, 247, 0.1); border-radius: 8px; padding: 20px; margin: 20px 0; border-right: 4px solid #a855f7;">
                <p style="margin: 0;"><strong>البريد الإلكتروني:</strong> {email}</p>
                <p style="margin: 10px 0 0 0;"><strong>نوع الحساب:</strong> {subscription}</p>
            </div>
            <p style="text-align: center; margin-top: 30px;">
                <a href="https://publisher.mrf103.com" style="background: linear-gradient(135deg, #a855f7, #6c2bd9); color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">ابدأ النشر الآن</a>
            </p>
            <hr style="border: none; border-top: 1px solid #333; margin: 30px 0;">
            <p style="text-align: center; color: #666; font-size: 12px;">SHADOW-7 Publisher © 2026 | MrF103</p>
        </div>
        """
    },
    "manuscript_submitted": {
        "subject": "تم استلام مخطوطتك | Manuscript Received — {tracking_id}",
        "html": """
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 100%); color: #e0e0e0; padding: 40px; border-radius: 12px; border: 1px solid #6c2bd9;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #a855f7; margin: 0; font-size: 28px;">SHADOW-7</h1>
            </div>
            <h2 style="color: #f0abfc; text-align: center;">📖 تم استلام المخطوطة</h2>
            <div style="background: rgba(168, 85, 247, 0.1); border-radius: 8px; padding: 20px; margin: 20px 0; border-right: 4px solid #a855f7;">
                <p><strong>العنوان:</strong> {title}</p>
                <p><strong>رقم التتبع:</strong> <code style="background: #1a1a2e; padding: 2px 8px; border-radius: 4px; color: #a855f7;">{tracking_id}</code></p>
                <p><strong>الحالة:</strong> قيد المعالجة</p>
            </div>
            <p style="line-height: 1.8;">سيتم معالجة مخطوطتك عبر نظام SHADOW-7 المكون من 7 وحدات ذكية. ستتلقى إشعاراً عند اكتمال المعالجة.</p>
            <p style="text-align: center; margin-top: 20px;">
                <a href="https://publisher.mrf103.com/manuscripts" style="background: linear-gradient(135deg, #a855f7, #6c2bd9); color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none;">تتبع المخطوطة</a>
            </p>
            <hr style="border: none; border-top: 1px solid #333; margin: 30px 0;">
            <p style="text-align: center; color: #666; font-size: 12px;">SHADOW-7 Publisher © 2026 | MrF103</p>
        </div>
        """
    },
    "manuscript_complete": {
        "subject": "مخطوطتك جاهزة! | Your Book is Ready — {tracking_id}",
        "html": """
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #0a0a1a 0%, #0a1a0a 100%); color: #e0e0e0; padding: 40px; border-radius: 12px; border: 1px solid #22c55e;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #22c55e; margin: 0; font-size: 28px;">✅ SHADOW-7</h1>
            </div>
            <h2 style="color: #86efac; text-align: center;">كتابك جاهز للتحميل!</h2>
            <div style="background: rgba(34, 197, 94, 0.1); border-radius: 8px; padding: 20px; margin: 20px 0; border-right: 4px solid #22c55e;">
                <p><strong>العنوان:</strong> {title}</p>
                <p><strong>رقم التتبع:</strong> <code style="background: #1a1a2e; padding: 2px 8px; border-radius: 4px; color: #22c55e;">{tracking_id}</code></p>
                <p><strong>الحالة:</strong> ✅ مكتمل</p>
            </div>
            <p style="text-align: center; margin-top: 20px;">
                <a href="{download_url}" style="background: linear-gradient(135deg, #22c55e, #16a34a); color: white; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">⬇️ تحميل الكتاب</a>
            </p>
            <hr style="border: none; border-top: 1px solid #333; margin: 30px 0;">
            <p style="text-align: center; color: #666; font-size: 12px;">SHADOW-7 Publisher © 2026 | MrF103</p>
        </div>
        """
    },
    "report": {
        "subject": "تقرير {report_type} | SHADOW-7 Report",
        "html": """
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 100%); color: #e0e0e0; padding: 40px; border-radius: 12px; border: 1px solid #6c2bd9;">
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #a855f7; margin: 0; font-size: 28px;">SHADOW-7</h1>
                <p style="color: #6c2bd9; margin: 5px 0 0 0;">📊 {report_type}</p>
            </div>
            <div style="background: rgba(168, 85, 247, 0.1); border-radius: 8px; padding: 20px; margin: 20px 0;">
                {report_content}
            </div>
            <p style="text-align: center; color: #666; font-size: 12px; margin-top: 30px;">SHADOW-7 Publisher © 2026 | MrF103</p>
        </div>
        """
    }
}


# ─────────────────────────────────────────────────────
# EMAIL SERVICE CLASS
# ─────────────────────────────────────────────────────

class EmailService:
    """Handles all email operations for SHADOW-7"""
    
    def __init__(self, db_pool=None):
        self.db_pool = db_pool
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_user = settings.SMTP_USER
        self.smtp_password = settings.SMTP_PASSWORD
        self.from_email = settings.FROM_EMAIL
    
    def is_configured(self) -> bool:
        """Check if SMTP is properly configured"""
        return bool(self.smtp_host and self.smtp_user and self.smtp_password)
    
    async def log_email(self, user_id: Optional[str], to_email: str, subject: str,
                        body_html: str, template: str = None, attachments: list = None,
                        status: str = "pending", error_message: str = None):
        """Log email to database"""
        if not self.db_pool:
            return None
        
        email_id = str(uuid.uuid4())
        try:
            async with self.db_pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO email_log (id, user_id, to_email, subject, body_html, 
                                          template, attachments, status, error_message)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                """, email_id, 
                    uuid.UUID(user_id) if user_id else None,
                    to_email, subject, body_html, template,
                    json.dumps(attachments) if attachments else None,
                    status, error_message)
            return email_id
        except Exception as e:
            logger.error(f"Failed to log email: {e}")
            return None
    
    async def update_email_status(self, email_id: str, status: str, error: str = None):
        """Update email status in DB"""
        if not self.db_pool:
            return
        try:
            async with self.db_pool.acquire() as conn:
                if status == "sent":
                    await conn.execute("""
                        UPDATE email_log SET status = $1, sent_at = NOW(), error_message = NULL
                        WHERE id = $2
                    """, status, uuid.UUID(email_id))
                else:
                    await conn.execute("""
                        UPDATE email_log SET status = $1, error_message = $2
                        WHERE id = $3
                    """, status, error, uuid.UUID(email_id))
        except Exception as e:
            logger.error(f"Failed to update email status: {e}")
    
    def render_template(self, template_name: str, **kwargs) -> tuple:
        """Render an email template with variables"""
        template = TEMPLATES.get(template_name)
        if not template:
            raise ValueError(f"Unknown template: {template_name}")
        
        subject = template["subject"].format(**kwargs)
        html = template["html"].format(**kwargs)
        return subject, html
    
    async def send_email(self, to_email: str, subject: str, body_html: str,
                         user_id: str = None, template: str = None,
                         attachments: List[Dict] = None) -> dict:
        """Send an email via SMTP and log it"""
        
        # Log the email first
        email_id = await self.log_email(
            user_id=user_id, to_email=to_email, subject=subject,
            body_html=body_html, template=template, attachments=attachments
        )
        
        if not self.is_configured():
            logger.warning("SMTP not configured — email logged but not sent")
            if email_id:
                await self.update_email_status(email_id, "logged", "SMTP not configured")
            return {"status": "logged", "email_id": email_id, "message": "SMTP not configured, email logged only"}
        
        try:
            msg = MIMEMultipart("alternative")
            msg["From"] = f"SHADOW-7 Publisher <{self.from_email}>"
            msg["To"] = to_email
            msg["Subject"] = subject
            
            # Attach HTML body
            msg.attach(MIMEText(body_html, "html", "utf-8"))
            
            # Handle file attachments
            if attachments:
                for att in attachments:
                    filepath = att.get("path")
                    filename = att.get("name", "attachment")
                    if filepath and os.path.exists(filepath):
                        with open(filepath, "rb") as f:
                            part = MIMEBase("application", "octet-stream")
                            part.set_payload(f.read())
                            encoders.encode_base64(part)
                            part.add_header("Content-Disposition", f"attachment; filename=\"{filename}\"")
                            msg.attach(part)
            
            # Send via SMTP
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)
            
            if email_id:
                await self.update_email_status(email_id, "sent")
            
            logger.info(f"✅ Email sent to {to_email}: {subject}")
            return {"status": "sent", "email_id": email_id}
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"❌ Email send failed to {to_email}: {error_msg}")
            if email_id:
                await self.update_email_status(email_id, "failed", error_msg)
            return {"status": "failed", "email_id": email_id, "error": error_msg}
    
    async def send_template(self, to_email: str, template_name: str,
                            user_id: str = None, **kwargs) -> dict:
        """Send a templated email"""
        subject, html = self.render_template(template_name, **kwargs)
        return await self.send_email(
            to_email=to_email, subject=subject, body_html=html,
            user_id=user_id, template=template_name
        )
    
    async def send_welcome(self, to_email: str, name: str, subscription: str = "free", user_id: str = None) -> dict:
        return await self.send_template(to_email, "welcome", user_id=user_id,
                                        name=name, email=to_email, subscription=subscription)
    
    async def send_manuscript_received(self, to_email: str, title: str, tracking_id: str, user_id: str = None) -> dict:
        return await self.send_template(to_email, "manuscript_submitted", user_id=user_id,
                                        title=title, tracking_id=tracking_id)
    
    async def send_manuscript_complete(self, to_email: str, title: str, tracking_id: str,
                                       download_url: str, user_id: str = None) -> dict:
        return await self.send_template(to_email, "manuscript_complete", user_id=user_id,
                                        title=title, tracking_id=tracking_id, download_url=download_url)
    
    async def send_report(self, to_email: str, report_type: str, report_content: str,
                          attachments: list = None, user_id: str = None) -> dict:
        return await self.send_template(to_email, "report", user_id=user_id,
                                        report_type=report_type, report_content=report_content)


# Singleton instance (initialized when DB pool is ready)
email_service: Optional[EmailService] = None

def init_email_service(db_pool):
    global email_service
    email_service = EmailService(db_pool=db_pool)
    logger.info(f"📧 Email service initialized (SMTP configured: {email_service.is_configured()})")
    return email_service

def get_email_service() -> EmailService:
    if email_service is None:
        return EmailService()  # Return without DB if not initialized
    return email_service
