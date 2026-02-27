# الظل السابع — إعداد البيئة (PostgreSQL)

## أخطاء تسجيل الدخول؟

إذا ظهرت أخطاء عند التسجيل أو الدخول، تأكد أن `VITE_API_URL` يشير إلى الـ Backend (مثال: `https://publisher.mrf103.com`).

---

## المتغيرات المطلوبة

| المتغير | مطلوب | الوصف |
|--------|-------|-------|
| `VITE_API_URL` | فارغ أو URL | Base URL للـ API. فارغ = same-origin |
| `VITE_OLLAMA_BASE_URL` | اختياري | نقطة نهاية AI (افتراضي: `/ai`) |
| `VITE_OLLAMA_MODEL` | اختياري | اسم النموذج (افتراضي: `llama3.2:3b`) |

---

## متطلبات الـ Backend

- **shadow7_api** (منفذ 8002) — FastAPI + PostgreSQL
- **nexus_db** — PostgreSQL مع:
  - دوال: `register`, `login`, `validate_session`, `logout`, `update_profile`
  - جداول: `users`, `sessions`, `user_profiles`, `manuscripts`

راجع `NEXUS_PRIME_UNIFIED/scripts/db/auth_schema.sql` لمخطط المصادقة.
