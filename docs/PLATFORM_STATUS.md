# PDFNexus — Platform status (Phases 5–13)

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

## Phase 5–11 (summary)

See earlier sections in git history / prior docs. Highlights: cloud OAuth harden, ToolError rollout, extract worker, Add text & shapes honesty, capped cloud reads + `%PDF-` magic.

## Phase 12 (review harden)

- CertSign / Protect: clear passwords only after **successful** download; Retry only when secrets still present
- PdfToExcel: Retry follows `lastAction` (`detect` / `ocr` / `export`)
- Bates: load failures set `errorFileName`; Retry reloads when pageCount is 0
- OneDrive export: shared basename sanitization (`cloudAppFolderBasename`)
- `isPdfMagic`: `%PDF-` within first **1024** bytes; approot path rooted at `/drive/root:/Apps/{name}`
- Cloud reader tests: stream oversize, empty body, Other/Apps false positive

## Phase 13 (quality closeout)

- Office oversize + Drive/Dropbox/OneDrive panels use `ToolError` (+ cloud notes)
- `isPdfUpload` accepts `application/x-pdf`
- Extract worker contract helpers + unit tests (`toTransferablePdfBytes`, ok/error messages)
- PDF→images / JPEG raster remain **main-thread** (known limit); pre-worker `arrayBuffer` cancel still known limit
- A11y / browser matrices stay **manual** — not CI-validated

## §19 Performance notes (templates / known limits)

Numbers below are **design limits and patterns**, not measured CI benchmarks collected in-repo.

- Prefer local tools; workers for structural compress / split / extract / merge where wired
- Raster JPEG compress and PDF→images use main-thread canvas (cleared after encode)
- Cloud imports/exports capped at **50MB** (enforced while reading the response body)
- Batch cancel stops before the next pending job (not mid-runner AbortSignal)

## §20 Browser / device matrix (manual QA — not CI-validated)

| Browser | Desktop | Notes |
| --- | --- | --- |
| Chromium (Chrome/Edge) | Primary target | Run smoke here first |
| Firefox | Manual | Confirm downloads + workers |
| Safari | Manual | Confirm download quirks |
| Mobile | Best-effort | Large PDFs may OOM |

## Known limitations / remaining gaps

- Full existing-text editing (§9) — evaluation only; not implemented
- Adobe-validated /ByteRange CMS, TSA, LTV — cert-sign stays experimental
- In-workspace multi-op DAG
- Claiming healthcare/legal/regulatory compliance
- Drive still needs Google Picker under `drive.file` for arbitrary library files
- Expanding OneDrive/Dropbox back to full library scopes — intentionally out of scope
- PDF→images worker not wired (main-thread)
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
