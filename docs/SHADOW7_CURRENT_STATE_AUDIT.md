# Shadow-7 Publisher — Current State Audit

**Authority:** Senior Sovereign Systems Auditor & Reverse Engineer  
**Date:** February 27, 2026  
**Scope:** Full codebase audit of `/root/products/shadow-seven-publisher`  
**Classification:** Brutally Honest — No Sugarcoating

---

## Executive Summary

| Metric | Status |
|--------|--------|
| **Code Quality** | 🟡 Mixed — Solid core, significant technical debt |
| **Documentation vs Reality** | ❌ **Severe Drift** — Some docs reference obsolete integrations; code uses PostgreSQL + Ollama |
| **Feature Completeness** | 🟡 Partial — Two parallel flows (Upload vs Submit) with different limits; Export uses demo data |
| **Production Readiness** | 🟡 Conditional — Works if n8n + Ollama + PostgreSQL are configured; several broken/misleading paths |

---

## 1. Architectural X-Ray

### 1.1 Tech Stack (What Is Actually Here)

| Layer | Technology | Version / Notes |
|-------|------------|-----------------|
| **Frontend** | React | 18.3.1 |
| **Build** | Vite | 7.3.1 |
| **UI** | Radix UI, Tailwind, Framer Motion | shadcn-style components |
| **State** | TanStack Query, React Context | Auth, Collaboration |
| **Backend** | FastAPI | 0.115+ |
| **Database** | PostgreSQL (asyncpg) | via nexus_db |
| **AI/LLM** | **Ollama** (OpenAI-compatible API) | `/ai` proxy → `llama3.2:3b` |
| **File Processing** | mammoth (DOCX), jsPDF, docx, epub-gen-memory, jszip | Client-side export |

### 1.2 External APIs & Integrations (Explicitly in Code)

| Integration | Location | Status |
|-------------|----------|--------|
| **Ollama** | `api/geminiClient.js` → `OLLAMA_BASE_URL/v1/chat/completions` | ✅ Active — All "Gemini" calls go here |
| **Backend API** | `api/backendClient.js` → `VITE_API_URL/api/shadow7/*` | ✅ Active |
| **n8n Webhook** | `backend/main.py` → `N8N_WEBHOOK_URL` | ✅ Triggered on submit |
| **Google Gemini** | `package.json` has `@google/generative-ai` | ❌ **NOT USED** — Dead dependency |
| **Legacy integrations** | Old docs | ❌ **REMOVED** — PostgreSQL + FastAPI only |

### 1.3 Naming Lie: "Gemini" Is Ollama

The file `api/geminiClient.js` is **misleadingly named**. It contains:

```javascript
// Ollama AI Client — يحل محل Google Gemini
const OLLAMA_BASE_URL = import.meta.env.VITE_OLLAMA_BASE_URL || '/ai'
```

All exports (`gemini`, `geminiPro`, `GeminiClient`) call **Ollama**, not Google Gemini. The package `@google/generative-ai` is installed but never imported.

### 1.4 Database Schemas

**Primary tables (in `nexus_db_schema.sql`):**

| Table | Purpose |
|-------|---------|
| `shadow7_requests` | Submit flow — tracking_id, raw_text, status, n8n |
| `shadow7_outlines` | Book outlines from n8n |
| `shadow7_chapters` | Generated chapters |
| `shadow7_media` | Media records (covers, etc.) |
| `shadow7_reports` | Consulting reports |
| `shadow7_deliveries` | ZIP download links |
| `shadow7_logs` | Execution logs |
| `manuscripts` | **Separate flow** — Upload page, local storage |

**Critical:** `manuscripts` and `shadow7_requests` are **disconnected**. Upload saves to `manuscripts`; Submit creates `shadow7_requests` and triggers n8n. No shared pipeline.

---

## 2. Workflow Extraction

### 2.1 Flow A: Upload Page (`/upload`)

```
User drops TXT/DOCX
    → validateFile (50MB max, TXT/DOCX only)
    → readFileContent (UTF-8 for TXT, mammoth for DOCX)
    → analyzeAndCleanText (TextAnalyzerEnhanced)
        ├─ Local NLP: arabicTokenizer, patternExtractor, contentClassifier, duplicateDetector, chapterDivider
        ├─ ChunkProcessor (if >50k words)
        ├─ LLM (Ollama): cleaning, chapter split, content compensation
        └─ CacheManager (IndexedDB)
    → uploadToBackend (POST /api/shadow7/manuscripts/upload)
        → Backend saves file to disk + inserts into manuscripts
    → Success
```

**Limitations (Upload flow):**
- File types: TXT, DOCX only (HTML in FileService but not in UploadPage)
- Max size: 50MB (frontend) vs 100MB (backend `MAX_MANUSCRIPT_UPLOAD`)
- Word limit: **200,000** in TextAnalyzerEnhanced (throws if exceeded)
- Backend manuscripts/upload: accepts `.txt`, `.docx`, `.pdf` — **PDF allowed in backend but not in UploadPage UI**

### 2.2 Flow B: Submit Wizard (`/submit`)

```
User pastes text or uploads file
    → Validation: 500–5000 words (validator says 5000, error message says 3000 — BUG)
    → POST /api/shadow7/submit
        → scrub_text, count_words
        → db.create_request (shadow7_requests)
        → background_tasks: trigger_n8n_workflow
    → Returns tracking_id
    → User can track via /api/shadow7/track/{id}
```

**Limitations (Submit flow):**
- **Backend config:** `MIN_WORDS=500`, `MAX_WORDS=3000`
- **Pydantic model:** `max_length=50000` chars; validator rejects if words > 5000 (message says 3000)
- **Inconsistency:** Config 3000, validator 5000, message 3000

### 2.3 Hardcoded Limits Summary

| Limit | Upload Flow | Submit Flow | Backend Config |
|-------|-------------|-------------|----------------|
| Min words | 0 (no check) | 500 | 500 |
| Max words | 200,000 | 5,000 (msg: 3,000) | 3,000 |
| Max file size | 50MB | N/A | 10MB (submit), 100MB (manuscripts) |
| File types | TXT, DOCX | Inferred from paste | TXT, DOCX (upload), TXT, DOCX, PDF (manuscripts) |

### 2.4 RTL Handling

| Component | RTL Support |
|-----------|-------------|
| `scrub_text` (backend) | Normalizes Alef/Yaa/Taa — **bug:** `'ي':'ي'` and `'ة':'ة'` are no-ops (same char) |
| `arabicTokenizer.js` | `normalizeArabic` — normalizes ي, ة, همزات |
| PDFGenerator (jsPDF) | `rtl: true` option — **jsPDF has limited Arabic support**; comment says "يجب تضمين خط عربي" |
| DOCXGenerator | `rtl: true` option |
| CoverDesignerPage | Canvas `textAlign: 'center'` — **no RTL**; `wrapText` splits by space (breaks Arabic word order) |

### 2.5 NLP & Text-Processing Libraries

| Library | Location | Purpose |
|---------|----------|---------|
| `arabicTokenizer.js` | utils/nlp | normalizeArabic, tokenize, wordCount, sentenceSplit |
| `patternExtractor.js` | utils/nlp | quickAnalyze, extractChapters, extractPageNumbers, extractTableOfContents |
| `contentClassifier.js` | utils/nlp | classifyContent, classifyParagraphs, detectIrrelevant |
| `duplicateDetector.js` | utils/nlp | detectDuplicates, generateDuplicateReport, removeDuplicates (Shingling) |
| `chapterDivider.js` | utils/nlp | smartDivideChapters |
| `ChunkProcessor.js` | utils | Chunk text for >50k words, parallel processing |
| `LanguageValidator.js` | utils | validateLanguageIntegrity |
| `CacheManager` | lib/cache | Memory + IndexedDB, TTL 24h |

---

## 3. The "Mess" Identification

### 3.1 Dead Code & Stale References

| Item | Location | Issue |
|------|----------|-------|
| `@google/generative-ai` | package.json | Installed, never used |
| Legacy client files | N/A | Old docs reference non-existent files |
| `VITE_API_URL` | .env | Backend URL for FastAPI |
| `api.entities.ComplianceRule` | api/index.js | Returns `[]` — stub, no backend |
| `api.entities.CoverDesign.create` | api/index.js | Returns `{}` — stub |
| `api.entities.ProcessingJob.filter` | api/index.js | Returns `[]` — stub |
| `FileService.extractDataFromFile` | api/fileService | Uses gemini for metadata — only called from `api.integrations.Core.ExtractDataFromUploadedFile`; **UploadPage does NOT use FileService** |

### 3.2 Broken / Inconsistent Logic

| Issue | Details |
|-------|---------|
| **ExportPage manuscript** | Uses `demoManuscript` hardcoded — `selectedManuscript` is always null; never loads from manuscripts API |
| **Submit validator** | `if words > 5000` raises error with message "الحد الأقصى 3000 كلمة" — wrong number |
| **scrub_text** | `'ي':'ي'` and `'ة':'ة'` — replacing with same character; likely meant to normalize Unicode variants (e.g. U+064A vs U+06CC) |
| **CoverDesignerPage** | Claims "بالذكاء الاصطناعي" but uses **Canvas 2D** only — no AI image generation; DesignCoverAgent generates **text prompts** for Midjourney/DALL-E, not images |
| **Two disjoint flows** | Upload → manuscripts; Submit → shadow7_requests + n8n. No connection. |

### 3.3 Bottlenecks & Failing Points

| Point | Risk |
|-------|------|
| **Ollama timeout** | TextAnalyzerEnhanced sends up to 80k chars for cleaning, 100k for chapter split — llama3.2:3b may timeout or OOM |
| **n8n webhook** | `callback_url: "http://shadow7_api:8002"` — requires Docker network; fails if n8n not configured |
| **jsPDF Arabic** | No Arabic font embedded — Arabic text may render as boxes or fail |
| **ChunkProcessor** | 10k-word chunks, concurrency 3 — for 200k words = 20 chunks; LLM calls in TextAnalyzer can still hit 80k+ char prompts |
| **IndexedDB** | CacheManager uses IndexedDB — fails in Node/test env (happy-dom); tests note this |

### 3.4 Documentation Drift

| Doc | Claims | Reality |
|-----|--------|---------|
| MIGRATION_TO_SUPABASE.md | Obsolete (قديم) | PostgreSQL + Ollama |
| SYSTEM_VERIFICATION_REPORT.md | Obsolete | Not applicable |
| API_DOCUMENTATION.md | FileService.uploadFile, getManuscripts | FileService has uploadFile → uploadManuscriptFile; getManuscripts is manuscriptsApi.list |
| FINAL_REPORT.md | Obsolete | CollaborationContext is local-only |
| RAILWAY_DEPLOYMENT.md | Obsolete | Use VITE_API_URL |

---

## 4. Hidden Gems

### 4.1 Advanced Features (Underutilized)

| Feature | Location | Description |
|---------|----------|-------------|
| **AgentCoordinator** | utils/SpecializedAgents.js | Orchestrates MarketingAgent, MediaScriptAgent, SocialMediaAgent, DesignCoverAgent — generates full Agency package |
| **DesignCoverAgent** | utils/agents/DesignCoverAgent.js | Produces JSON with color palettes, AI prompts for Midjourney/DALL-E, typography, print specs — **rich output, not used by CoverDesignerPage** |
| **ChunkProcessor** | utils/ChunkProcessor.js | Parallel chunk processing for 50k+ word docs |
| **CacheManager** | lib/cache/CacheManager.js | 24h TTL, reduces repeat analysis |
| **LanguageValidator** | utils/LanguageValidator.js | Post-cleaning language integrity check |
| **useChunkProcessor** | hooks/useChunkProcessor.js | Hook for chunked processing — not used in UploadPage (uses analyzeAndCleanText directly) |
| **quickFileAnalysis** | TextAnalyzerEnhanced.js | Lightweight analysis without full cleaning — exported but not wired to UI |

### 4.2 Backend Capabilities (n8n Pipeline)

The backend exposes endpoints for n8n:

- `POST /api/shadow7/outline` — Save outline
- `POST /api/shadow7/chapter` — Save chapter
- `POST /api/shadow7/progress` — Update progress
- `POST /api/shadow7/reports` — Save reports
- `POST /api/shadow7/callback` — Completion callback
- `GET /api/shadow7/download/{tracking_id}` — Download ZIP

**These work only if n8n workflow is configured and populates shadow7_* tables.**

### 4.3 Export Pipeline (Client-Side)

- **ExportModule** — PDF (jsPDF), EPUB (epub-gen-memory), DOCX (docx lib), ZIP (jszip)
- **AgentCoordinator.generateAgencyPackage** — Marketing copy, cover design ideas, social posts
- **RTL options** — `rtl: true` in PDF/DOCX generators

### 4.4 Entities (JSON Schemas)

- `Entities/ComplianceRule.jsx` — JSON schema for compliance rules
- `Entities/CoverDesign.jsx` — JSON schema
- `Entities/ProcessingJob.jsx` — JSON schema

Used for type definitions; API stubs return empty data.

---

## 5. Exact Current Capabilities

### What Works Today (If Configured)

1. **Auth** — Login/register via backend PostgreSQL (nexus_auth or shadow7 auth routes)
2. **Manuscript upload** — TXT/DOCX → analyze → save to manuscripts table + disk
3. **Manuscript CRUD** — List, get, update, delete via `/api/shadow7/manuscripts`
4. **Submit wizard** — Paste text → create shadow7_request → trigger n8n (if URL set)
5. **Track** — `/api/shadow7/track/{id}` for submit flow
6. **Export (client)** — PDF, EPUB, DOCX, ZIP from manuscript object — **but ExportPage uses demo data**
7. **Cover designer** — Canvas-based cover with title/author/subtitle — no AI images
8. **Book merger** — Merge multiple manuscripts (sequential/interleaved)
9. **Analytics dashboard** — Stats from manuscripts (processing, completed, etc.)

### What Does NOT Work or Is Misleading

1. **Export with real manuscripts** — ExportPage ignores manuscripts list; uses `demoManuscript`
2. **AI cover generation** — DesignCoverAgent produces prompts; CoverDesignerPage uses Canvas only
3. **Submit flow for large texts** — 3k–5k word limit; Upload flow supports 200k
4. **Legacy integrations** — All obsolete references removed
5. **Google Gemini** — Package present, never used
6. **ComplianceRule, CoverDesign, ProcessingJob** — Stubs only

---

## 6. Recommendations (Audit Only — No Implementation)

1. **Rename `geminiClient.js`** → `ollamaClient.js` to avoid confusion.
2. **Remove `@google/generative-ai`** or wire it if Gemini is desired.
3. **Unify word limits** — Align Submit (3k/5k), Upload (200k), and config.
4. **Fix ExportPage** — Connect to manuscripts list; allow selecting a manuscript to export.
5. **Fix scrub_text** — Use correct Unicode normalization (e.g. `unicodedata.normalize('NFC')` or proper ي/ة variants).
6. **Documentation purge** — Remove or update all obsolete integration references.
7. **Connect flows** — Either merge Upload and Submit or document the two paths clearly.
8. **jsPDF Arabic** — Embed Amiri or Noto Naskh; or switch to backend PDF (ReportLab/WeasyPrint).

---

**End of Audit**
