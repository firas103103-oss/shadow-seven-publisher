# Shadow-7 Omni-Publisher — Feasibility Report & Architecture

**Authority:** Senior AI System Architect & Sovereign Integrator  
**Project:** Shadow-7 Omni-Publisher (The Ultimate Ingestion & Publishing Pipeline)  
**Date:** February 27, 2026  
**Classification:** Feasibility Report + Microservices Map for Stages 1–2

---

## Executive Summary

| Criterion | Verdict | Notes |
|-----------|---------|-------|
| **Overall Feasibility** | ✅ **FEASIBLE** | All 7 pillars are technically achievable with existing or well-documented tooling |
| **RTL/Arabic Integrity** | ✅ **ACHIEVABLE** | ReportLab 4.4+, python-docx with bidi, LaTeX/XeLaTeX — all support Arabic RTL |
| **Long Context (200k words)** | ✅ **VIABLE** | Gemini 1.5 Pro (2M tokens) can ingest ~200k words; hybrid with local RAG recommended |
| **NEXUS PRIME Integration** | ✅ **ALIGNED** | Shadow-7 backend (8002), nexus_oracle, sovereign_dify_bridge, manuscripts DB already exist |
| **Risk Level** | 🟡 **MEDIUM** | Main risks: Arabic PDF edge cases, API cost at scale, thematic consistency for 16 images |

---

## 1. Input Specifications — Validation

| Input | Requirement | Status | Implementation Notes |
|-------|--------------|--------|----------------------|
| **Sources** | 1–7 TXT files | ✅ | Already supported: `.txt` + `.docx` in `main.py` upload; extend to multi-file merge |
| **Volume** | Up to 200,000 words | ✅ | `MAX_MANUSCRIPT_UPLOAD=100MB` exists; 200k words ≈ 1.2 MB — within limits |
| **RTL/RTS Integrity** | 100% throughout | ✅ | UTF-8 + `scrub_text` + `arabicTokenizer.js`; must enforce at every stage |

**Current Gaps:**  
- `MAX_WORDS=3000` in config is too low for 200k target — update to `MAX_WORDS=200000` or `MAX_WORDS=250000` for safety.  
- Multi-file (1–7 TXT) merge is not yet implemented — add in Stage 1.

---

## 2. The 7 Pillars — Feasibility Assessment

### Pillar 1: Intake & Validation

| Task | Feasibility | Notes |
|------|-------------|-------|
| Pre-processing TXT | ✅ | `scrub_text` + `arabicTokenizer.js`; add `encoding` detection (UTF-8, CP1256, ISO-8859-6) |
| Word count | ✅ | `count_words` in main.py; `wordCount` in arabicTokenizer.js |
| Language encoding | ✅ | `chardet` or `ftfy` for Arabic; validate Unicode normalization (NFC) |

**Recommendation:** Extend existing `/api/shadow7/upload` and `/api/shadow7/manuscripts/upload` to accept 1–7 files, merge content, validate total word count.

---

### Pillar 2: Semantic Purge

| Task | Feasibility | Notes |
|------|-------------|-------|
| Duplicate detection | ✅ | Semantic similarity (embeddings) or n-gram; use `sentence-transformers` or `faiss` |
| Thematic outliers | ✅ | Cluster analysis on embeddings; flag outliers beyond threshold |
| Content anomalies | ✅ | LLM-based anomaly detection (e.g., off-topic, mixed languages, spam) |

**Recommendation:** Use Gemini 1.5 Pro for long-context analysis (see Section 3 below) or local embeddings + clustering. Output: purge report + cleaned text.

---

### Pillar 3: Nuwa (Skeletal) Generation

| Task | Feasibility | Notes |
|------|-------------|-------|
| Cover placeholder | ✅ | Template with title, author, metadata |
| Table of Contents | ✅ | Extract headings from body; LLM or rule-based |
| Introduction | ✅ | LLM-generated from summary |
| Body structure | ✅ | Chapter/section extraction from purge output |
| Index | ✅ | Keyword extraction (arabicTokenizer + TF-IDF) |
| References | ✅ | Pattern matching for citations; BibTeX-style if needed |

**Recommendation:** Define JSON schema for skeleton; generate via LLM or hybrid rules. Output: structured JSON (Nuwa schema).

---

### Pillar 4: Sovereign Expansion

| Task | Feasibility | Notes |
|------|-------------|-------|
| 100k–200k target | ✅ | Chunked expansion with LLM; track word count per chunk |
| Gemini 1.5 Pro (analysis) | ✅ | 2M context window; ~200k words ≈ 250k tokens — fits |
| Local LLMs (generation) | ✅ | Ollama/LiteLLM already in NEXUS; llama3.2, mistral, etc. |

**Recommendation:**  
- **Analysis:** Gemini 1.5 Pro for full-document semantic analysis, outline extraction, theme mapping.  
- **Generation:** Local Ollama/LiteLLM for chunk-by-chunk expansion (cost control, privacy).  
- **RAG:** Optional — use for retrieval of relevant chunks during expansion; not required for analysis if Gemini can ingest full text.

---

### Pillar 5: Compliance & Market Scan

| Task | Feasibility | Notes |
|------|-------------|-------|
| Regional regulations | ✅ | LLM + curated knowledge base (e.g., Saudi, UAE, Egypt publishing rules) |
| User-country specific | ✅ | User profile or request param: `country_code` |
| Market entry strategy | ✅ | LLM-generated report from regulations + genre + audience |

**Recommendation:** Integrate with NEXUS PRIME Compliance Shield (see `IDENTITY_COMPLIANCE_PROTOCOL_KIER.md`). Add country-specific compliance rules to Dify or nexus_oracle.

---

### Pillar 6: Creative Suite

| Task | Feasibility | Notes |
|------|-------------|-------|
| 4 titles | ✅ | LLM generation |
| 3 professional covers | ✅ | DALL-E / Midjourney / Stable Diffusion API; RTL text overlay via image lib |
| 16 social assets (4×4) | ✅ | Same style via seed + style reference (see Section 3) |
| 2 promotional videos | ✅ | Text-to-video (Runway, Pika) or slideshow + audio |

**Thematic Consistency:**  
- Use **style reference** (Midjourney `--style reference` or `--cref`).  
- Generate **thematic brief** from manuscript (LLM): 5–10 core themes, visual style, mood.  
- Lock **seed** and **style parameters** across all 16 images.  
- Use **modular prompt template:** `[Scene]; [Location]; [Lighting]; [Art style]; [Parameters]` — vary only scene/location.

---

### Pillar 7: Encapsulation

| Task | Feasibility | Notes |
|------|-------------|-------|
| 25 distinct files | ✅ | ZIP via Python `zipfile` or `JSZip` (already in assets) |
| Word | ✅ | python-docx with RTL (see Section 3) |
| Print-ready PDF | ✅ | ReportLab 4.4+ or LaTeX/XeLaTeX |
| High-res images | ✅ | PNG/JPG from Pillar 6 |
| MP4 videos | ✅ | From Pillar 6 |

---

## 3. Technical Constraints — Answers

### 3.1 Long Context: Gemini 1.5 Pro vs Local RAG

| Approach | Pros | Cons |
|----------|------|------|
| **Gemini 1.5 Pro (2M context)** | Single-pass full-document analysis; >99% retrieval recall; no chunking loss | API cost; latency for 200k words ≈ 1–2 min |
| **Local RAG** | Cost-effective; privacy; incremental | Chunking can lose cross-chapter coherence; retrieval may miss distant context |

**Recommendation:**  
- **Analysis:** Gemini 1.5 Pro for semantic purge, outline extraction, theme mapping. One API call per document.  
- **Generation:** Local RAG + Ollama for chunk-by-chunk expansion. RAG retrieves relevant prior sections + outline for context.

---

### 3.2 Arabic PDF/Word Generation — Zero RTL Collapse

| Library | RTL Support | Recommendation |
|---------|-------------|----------------|
| **ReportLab 4.4+** | ✅ Experimental Arabic; HarfBuzz; `rlbidi`; `wordWrap="RTL"` | Use for programmatic PDF; validate with real Arabic text |
| **LaTeX/XeLaTeX** | ✅ `babel` + `polyglossia` + `arabtex`; industry standard for Arabic typography | Best for print-ready; requires `xelatex` + Arabic fonts |
| **python-docx** | ✅ `w:bidi` + `w:rtl` on run/paragraph; custom style | Use for Word; set `font.complex_script = True` |
| **Node.js (puppeteer + HTML)** | ✅ HTML `dir="rtl"` + CSS; render to PDF | Fallback; good for web-like layouts |

**Recommendation:**  
- **Word:** python-docx with bidi/rtl; Amiri or Noto Naskh Arabic font.  
- **PDF:** LaTeX/XeLaTeX for highest quality; ReportLab 4.4+ as fallback if LaTeX not desired.  
- **Fonts:** Amiri, Noto Naskh Arabic, or Tahoma — ensure embedded in PDF/Word.

---

### 3.3 NEXUS PRIME & Sovereign Master Context Integration

| Component | Role | Integration |
|-----------|------|-------------|
| **nexus_oracle** (8100) | RAG for Sovereign Encyclopedia | Query for compliance rules, governance axioms |
| **sovereign_dify_bridge** (8888) | Dify orchestration | Route expansion, compliance, creative prompts |
| **nexus_db** | PostgreSQL | manuscripts, requests, logs — already used by Shadow-7 |
| **shadow7_api** (8002) | FastAPI backend | Extend with new stages; keep `/api/shadow7/` prefix |
| **Sovereign Master Context** | ENTERPRISE_CODEX, SOVEREIGN_ENCYCLOPEDIA | Inject into Dify prompts for governance-aware decisions |

**Sync Points:**  
- Manuscript metadata → nexus_db.manuscripts  
- Compliance check → sovereign_dify_bridge + nexus_oracle  
- Status/logs → existing `db.log` and `request_status` flow

---

### 3.4 Thematic Consistency: 16 Images ↔ 200k Words

**Strategy:**

1. **Thematic Brief (LLM):** Extract from manuscript: 5 themes, 3 visual style keywords, mood, color palette.  
2. **Style Prompt Template:** Lock `[Art style]; [Lighting]; [Parameters]`; vary only `[Scene]` per platform.  
3. **Style Reference:** Generate 1 "master" image; use as `--cref` for remaining 15.  
4. **Seed Lock:** Same seed across batch when API supports it (Stable Diffusion, Midjourney).  

**Output:** 4 platforms × 4 images = 16 assets; each platform gets 4 variations of same scene/style.

---

## 4. Microservices Map — Stages 1 & 2

### 4.1 Stage 1: Intake & Validation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STAGE 1: INTAKE & VALIDATION                              │
└─────────────────────────────────────────────────────────────────────────────┘

  [Client]  ──►  POST /api/shadow7/omni/upload
                      │
                      ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  shadow7_intake (NEW)                                                    │
  │  • Accept 1–7 TXT/DOCX files (multipart/form-data)                       │
  │  • Merge content; preserve order (file_1, file_2, ...)                     │
  │  • Detect encoding: UTF-8, CP1256, ISO-8859-6                            │
  │  • Normalize: NFC, scrub_text, arabicTokenizer.normalizeArabic            │
  │  • Validate: 500 ≤ total_words ≤ 200,000                                 │
  │  • Store: manuscripts table + file_path(s)                               │
  │  • Return: { tracking_id, word_count, file_count, encoding }               │
  └─────────────────────────────────────────────────────────────────────────┘
                      │
                      ▼
  [nexus_db]  manuscripts, requests
```

**Microservices:**

| Service | Responsibility | Port |
|---------|----------------|------|
| **shadow7_api** (existing) | Add `/api/shadow7/omni/upload`; orchestrate intake | 8002 |
| **nexus_db** | manuscripts, requests, logs | 5432 |

**New Files to Create:**

- `backend/services/intake_service.py` — `IntakeService.merge_and_validate(files)`
- `backend/routes/omni_routes.py` — `/omni/upload` handler
- Update `config.py`: `MAX_WORDS=200000`, `MAX_OMNI_FILES=7`

---

### 4.2 Stage 2: Semantic Purge

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STAGE 2: SEMANTIC PURGE                                   │
└─────────────────────────────────────────────────────────────────────────────┘

  [Intake Output]  ──►  POST /api/shadow7/omni/purge
                              │
                              ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  shadow7_purge (NEW)                                                     │
  │  • Input: tracking_id, manuscript_id                                     │
  │  • Load: full text from manuscripts                                      │
  │  • Option A: Gemini 1.5 Pro API — full-doc analysis                      │
  │    - Prompt: "Identify duplicates, thematic outliers, anomalies"         │
  │    - Output: structured JSON (duplicates, outliers, purge_actions)       │
  │  • Option B: Local embeddings (sentence-transformers) + clustering       │
  │    - Embed paragraphs; cluster; flag outliers                            │
  │  • Apply purge: remove/merge per rules                                   │
  │  • Store: purge_report, purged_text in manuscripts or new table          │
  │  • Return: { purge_report, word_count_after, anomalies_fixed }            │
  └─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
  [nexus_db]  manuscripts.purge_report, manuscripts.purged_content
  [Gemini API]  (if Option A)
  [Ollama]  (if Option B — local embeddings)
```

**Microservices:**

| Service | Responsibility | Port |
|---------|----------------|------|
| **shadow7_api** | Add `/api/shadow7/omni/purge`; orchestrate purge | 8002 |
| **nexus_db** | purge_report, purged_content | 5432 |
| **Gemini 1.5 Pro** (external) | Full-doc analysis (Option A) | API |
| **nexus_ollama** | Local embeddings (Option B) | 11434 |

**New Files to Create:**

- `backend/services/purge_service.py` — `PurgeService.analyze(text)` and `PurgeService.apply(text, report)`
- `backend/services/gemini_client.py` — Gemini 1.5 Pro API client (if Option A)
- `backend/routes/omni_routes.py` — `/omni/purge` handler
- DB migration: `manuscripts.purge_report` (JSONB), `manuscripts.purged_content` (TEXT)

---

### 4.3 End-to-End Flow (Stages 1–2)

```
  [User]  ──►  Upload 1–7 TXT  ──►  Intake  ──►  Purge  ──►  [Purged Manuscript]
                │                    │              │
                │                    │              └──►  Gemini 1.5 Pro
                │                    │                    or Local Embeddings
                │                    │
                │                    └──►  nexus_db
                │
                └──►  manuscripts table
```

---

## 5. Implementation Roadmap

### Phase 1: Stage 1 (Intake) — 2–3 days

1. Add `IntakeService` with multi-file merge and encoding detection.  
2. Add `/api/shadow7/omni/upload` route.  
3. Update `config.py` limits.  
4. Add tests for 1–7 files, encoding edge cases.

### Phase 2: Stage 2 (Purge) — 3–5 days

1. Add `PurgeService` with Gemini 1.5 Pro client (Option A).  
2. Add `/api/shadow7/omni/purge` route.  
3. DB migration for purge_report, purged_content.  
4. Optional: Local embeddings path (Option B) for cost/privacy.  
5. Add tests for duplicate/outlier detection.

### Phase 3: NEXUS PRIME Wiring

1. Register omni routes in Shadow-7 main app.  
2. Add n8n workflow for omni pipeline (optional).  
3. Document sovereign_dify_bridge integration for future stages.

---

## 6. Appendix: Key File References

| File | Purpose |
|------|---------|
| `backend/main.py` | Gatekeeper, upload, manuscripts; scrub_text, count_words |
| `backend/config.py` | MIN_WORDS, MAX_WORDS, MAX_MANUSCRIPT_UPLOAD |
| `utils/nlp/arabicTokenizer.js` | normalizeArabic, tokenize, wordCount |
| `NEXUS_PRIME_UNIFIED/docs/IDENTITY_COMPLIANCE_PROTOCOL_KIER.md` | Compliance Shield |
| `NEXUS_PRIME_UNIFIED/docs/SOVEREIGN_ENCYCLOPEDIA.md` | RAG source for governance |
| `NEXUS_PRIME_UNIFIED/docker-compose.yml` | nexus_oracle, shadow7_api, nexus_db |

---

**End of Report**
