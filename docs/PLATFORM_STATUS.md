# PDFNexus — Platform status (Phases 5–22)

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

## Phase 5–19 (summary)

See earlier docs. Through 19: workers (split/extract/images/compress raster), cancel settle-on-cancel, Bates continuity, ToolProgress, soft size hint, honest manual QA templates.

## Phase 20 (cancel races)

- `cancelAndAwait`: cancel + await so worker rejections are never orphaned (Split / Extract / PDF→images / Compress)
- OCR `finally` clears `busy`/`ocrBusy` only when generation is still current
- Bates: after successful download, **always** `writeNext` (cancel only blocks before download starts)

## Phase 21 (nested workers + OCR cancel UX)

- Module workers use `pdfJsGetDocumentInit` → `disableWorker: true` (no nested pdf.js worker)
- OCR passes `AbortSignal` into page render (`pdfToImages`); Excel OCR has `ToolProgress` Cancel
- Sidebar “No quality loss” softened; HTML `processingMode="local"`; EPUB/HTML single `arrayBuffer`
- Real `downloadWorkerOutputs` gate (replaces stub cancel-before-zip “test”)

## Phase 22 (evidence)

- Tests: `cancelAndAwait`, Bates download-then-cancel still persists, OCR abort exact fetch counts, `downloadWorkerOutputs`, OCR finally gen-gate, `disableWorker` init
- §19 / §20 remain **templates / manual QA** — no invented pass rates
- Remaining: soft-tool mid-op AbortSignal, §9 / CMS / DAG / full-library cloud, measured perf/a11y manual only

## §19 Performance notes (templates / known limits)

Numbers below are **design limits and patterns**, not measured CI benchmarks collected in-repo.

- Workers: structural compress, JPEG raster compress, split, extract, merge, PDF→images
- Inside module workers, pdf.js runs with **`disableWorker: true`** (avoids nested workers)
- Soft UI hint around **80MB+** local PDFs (guidance only)
- Cloud imports/exports capped at **50MB**
- Soft Cancel on Flatten/Protect/Unlock/Crop/Resize finishes the current await step, then stops

## §20 Browser / device matrix (manual QA — not CI-validated)

| Browser | Desktop | Notes |
| --- | --- | --- |
| Chromium (Chrome/Edge) | Primary target | Run smoke here first |
| Firefox | Manual | Confirm downloads + workers |
| Safari | Manual | Confirm download quirks; nested-worker avoidance helps |
| Mobile | Best-effort | Large PDFs may OOM |

### Spot-check notes (manual — fill in during QA)

| Check | Result |
| --- | --- |
| Cancel after worker start does not orphan-reject | _not recorded_ |
| Bates download then Cancel still advances next number | _not recorded_ |
| Excel OCR Cancel stops further uploads | _not recorded_ |
| JPEG raster worker (disableWorker) | _not recorded_ |

## Known limitations / remaining gaps

- Full existing-text editing (§9) — evaluation only; not implemented
- Adobe-validated /ByteRange CMS, TSA, LTV — cert-sign stays experimental
- In-workspace multi-op DAG / full batch queue
- Claiming healthcare/legal/regulatory compliance
- Drive still needs Google Picker under `drive.file` for arbitrary library files
- Expanding OneDrive/Dropbox back to full library scopes — intentionally out of scope
- Mid-operation AbortSignal for soft-cancel tools (Flatten/Protect/etc.)
- Full §13 ETA / output-size telemetry
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
