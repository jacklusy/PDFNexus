# PDFNexus — Platform status (Phases 5–16)

**No healthcare or legal compliance claims.** Browser/a11y rows below are a **manual QA checklist**, not a claim that every cell was validated in CI.

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
| Optional cloud | Drive / Dropbox App Folder / OneDrive AppFolder | Only on explicit import/export + consent |

Local downloads remain ungated. Email verification is optional delivery only.

## Phase 5–13 (summary)

See earlier sections in git history / prior docs. Highlights: cloud OAuth harden, ToolError rollout, extract worker, Add text & shapes honesty, capped cloud reads + `%PDF-` magic, CertSign/Protect clear-on-success, Bates load Retry, OneDrive basename.

## Phase 14 (workers + leftovers)

- Bates continuity: next number persisted **only after** successful single download or zip
- PdfToExcel OCR: generation guard ignores stale results after file change; `cloud_assisted` only while OCR busy
- Cloud specs: `application/x-pdf` + direct `cloudAppFolderBasename` cases
- Extract worker posts via shared `extractWorkerOkMessage` / `extractWorkerErrMessage`
- PDF→images: module worker (`pdf-to-images.worker.ts`) with OffscreenCanvas; ZIP/download on main thread
- Soft large-PDF hint (≥~80MB) guidance helper introduced

## Phase 15 (progress / cancel / copy)

- `ToolProgress` (+ elapsed / Cancel where feasible) on Split, Extract, Flatten, Protect, Unlock, Crop, Resize, EPUB, HTML (plus existing Bates/images/compress paths)
- Cancel flag checked **after** `arrayBuffer` before worker start (Split / Extract / PDF→images parity)
- Workspace empty-state copy softened (no absolute “100% locally”)
- Bates Apply disabled when `pageCount === 0` after failed load
- Protect primary disabled when password empty/mismatch
- Drive / Dropbox / OneDrive panels: ToolError **Retry** re-runs last connect/list/import/export (or picker)

## Phase 16 (evidence)

- Targeted automated tests: Bates zip-fail continuity, OCR generation ignore, pdf-to-images worker ok/err contract, soft size hint
- §19 / §20 remain **templates / manual QA** — no invented pass rates or CI-validated a11y/browser matrices
- Still documented limits: JPEG raster compress **main-thread**; mid-batch AbortSignal not wired; §9 / CMS / DAG / full-library cloud OOS

## §19 Performance notes (templates / known limits)

Numbers below are **design limits and patterns**, not measured CI benchmarks collected in-repo.

- Prefer local tools; workers for structural compress / split / extract / merge / PDF→images where wired
- Raster JPEG compress still uses main-thread canvas (cleared after encode) — **no new worker in 14–16**
- Cloud imports/exports capped at **50MB** (enforced while reading the response body)
- Soft UI hint around **80MB+** local PDFs (guidance only)
- Batch cancel stops before the next pending job / after read before worker (not mid-runner AbortSignal)

## §20 Browser / device matrix (manual QA — not CI-validated)

| Browser | Desktop | Notes |
| --- | --- | --- |
| Chromium (Chrome/Edge) | Primary target | Run smoke here first |
| Firefox | Manual | Confirm downloads + workers |
| Safari | Manual | Confirm download quirks |
| Mobile | Best-effort | Large PDFs may OOM |

### Spot-check notes (manual — fill in during QA)

| Check | Result |
| --- | --- |
| Split / Extract cancel after read | _not recorded_ |
| PDF→images worker + zip | _not recorded_ |
| Bates Apply disabled on bad load | _not recorded_ |
| Cloud panel Retry | _not recorded_ |

## Known limitations / remaining gaps

- Full existing-text editing (§9) — evaluation only; not implemented
- Adobe-validated /ByteRange CMS, TSA, LTV — cert-sign stays experimental
- In-workspace multi-op DAG
- Claiming healthcare/legal/regulatory compliance
- Drive still needs Google Picker under `drive.file` for arbitrary library files
- Expanding OneDrive/Dropbox back to full library scopes — intentionally out of scope
- JPEG-compress raster path remains main-thread
- Measured perf / full a11y pass — manual only

## Env vars (cloud)

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` / `SECRET` / `REDIRECT_URI` | Drive |
| `GOOGLE_API_KEY` | Optional Picker developer key |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` or `CLOUD_TOKEN_ENCRYPTION_KEY` | AES-GCM at rest (32+, required in prod if any cloud enabled) |
| `DROPBOX_CLIENT_ID` / `SECRET` / `REDIRECT_URI` | Dropbox App Folder |
| `MICROSOFT_CLIENT_ID` / `SECRET` / `TENANT` / `REDIRECT_URI` | OneDrive AppFolder |

## Test commands

```bash
cd apps/web && npm test && npm run typecheck
cd apps/api && npm test && npm run typecheck
```
