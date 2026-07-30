# PDFNexus — Platform status (Phases 5–6)

Supersedes the remaining-work list in [PHASE5_STATUS.md](./PHASE5_STATUS.md) with Phase 6 completion notes. **No healthcare or legal compliance claims.**

## Architecture

| Layer | Stack | Role |
| --- | --- | --- |
| Web | Next.js | Local PDF tools, SEO tool pages, optional cloud UI |
| API | NestJS | OCR assist, Office→PDF (Gotenberg), cloud OAuth proxies |
| Storage | Redis + optional S3 | OAuth tokens (encrypted), optional delivery |

## Privacy matrix

| Mode | Examples | Leaves device? |
| --- | --- | --- |
| Local | Merge, compress, redact, EPUB, cert-sign MVP | No |
| Partial | Excel without OCR | No until optional OCR |
| Cloud-assisted | Excel OCR | Page images after consent |
| Server | Office→PDF | Document after consent |
| Optional cloud | Drive / Dropbox / OneDrive | Only on explicit import/export + consent |

Local downloads remain ungated. Email verification is optional delivery only.

## Phase 5 completed

- Google Picker import (`drive.file`), 50MB caps, sanitized errors, single Redis token key
- Production encryption required when any cloud provider is enabled
- Copy honesty (About / MarketingHero / `dropHint`)
- ToolError + batch cancel / file progress labels
- Structural compress worker + canvas cleanup
- Docs: `PHASE5_STATUS.md`, `PHASE5_A11Y_CHECKLIST.md`

## Phase 6 completed

- **Dropbox + OneDrive** OAuth import/export (`/api/cloud/dropbox/*`, `/api/cloud/onedrive/*`), consent UI, `/cloud` page
- **EPUB** `/pdf-to-epub` via HTML export packaging (reflowable; layout limits labeled)
- **Cert-sign** detached PKCS#7 (`.p7s`) + PEM attachments; still **experimental** — not Adobe ByteRange CMS
- Browser matrix + performance notes below

## §19 Performance notes

- Prefer local tools for interactive editing; workers used for structural compress / split where feasible
- Raster JPEG compress and PDF→images use main-thread canvas (GPU memory cleared after encode)
- Cloud imports/exports capped at **50MB**
- Batch queue runs jobs sequentially; cancel stops before the next pending job

## §20 Browser / device matrix (manual QA)

| Browser | Desktop | Notes |
| --- | --- | --- |
| Chromium (Chrome/Edge) | Primary | pdf.js + Offscreen/canvas paths tested here first |
| Firefox | Supported | Confirm file download + workers |
| Safari | Supported | Confirm File System / download quirks |
| Mobile Safari / Chrome | Best-effort | Large PDFs may be memory-limited; batch less practical |

## Known limitations / out of scope

- Full existing-text editing (§9)
- Adobe-validated /ByteRange CMS, TSA, LTV
- In-workspace multi-op DAG
- Claiming healthcare/legal/regulatory compliance
- Drive still cannot browse the full library without Google Picker under `drive.file`

## Env vars (cloud)

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` / `SECRET` / `REDIRECT_URI` | Drive |
| `GOOGLE_API_KEY` | Optional Picker developer key |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` or `CLOUD_TOKEN_ENCRYPTION_KEY` | AES-GCM at rest (32+, required in prod if any cloud enabled) |
| `DROPBOX_CLIENT_ID` / `SECRET` / `REDIRECT_URI` | Dropbox |
| `MICROSOFT_CLIENT_ID` / `SECRET` / `TENANT` / `REDIRECT_URI` | OneDrive |

## Test commands

```bash
cd apps/web && npm test
cd apps/api && npm test
cd apps/web && npm run typecheck
cd apps/api && npm run typecheck
```
