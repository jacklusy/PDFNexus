# PDFNexus — Platform status (Phases 5–19)

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

## Phase 5–16 (summary)

See earlier sections / prior docs. Highlights through 16: cloud harden, ToolError, extract + PDF→images workers, Bates continuity after deliver, ToolProgress rollout, soft size hint, honest manual QA templates.

## Phase 17 (cancel + OCR abort)

- `runWorkerTask` Cancel **settles immediately** with `WorkerCancelledError` (no 180s timeout-as-cancel)
- Split / Extract / PDF→images / Compress: cancel wired before worker await; skip zip/download if cancelled after worker
- Bates: `deliverBatesOutputs` respects `isCancelled` before `writeNext`
- PdfToExcel OCR: `AbortSignal` on `fetch`; abort on file change / new OCR / unmount; always clear `ocrBusy`

## Phase 18 (harden + JPEG raster worker)

- Detect vs OCR share generation guard (neither overwrites the other when stale)
- Cloud Retry: export requires consent (keeps error if unchecked); disconnect Retry re-runs disconnect
- PDF→images: scale/edge clamps, `page.cleanup()`, slim `ensurePdfJsWorker` (no pdf-lib in worker import)
- Soft-cancel tools: “Cancelling after current step…” honesty copy
- EPUB/HTML: 1-based `currentPage` in ToolProgress
- Workspace: removed absolute “No quality loss” claim
- Compress JPEG raster: `compress-raster.worker.ts` (OffscreenCanvas); structural path remains `compress.worker.ts`

## Phase 19 (evidence)

- Targeted tests: `runInWorker` prompt cancel, OCR abort stops fetch, Bates cancel-during-zip, images scale clamps
- §19 / §20 remain **templates / manual QA** — no invented pass rates
- Still documented limits: soft tools lack mid-op AbortSignal; §9 / CMS / DAG / full-library cloud OOS; measured perf/a11y manual only

## §19 Performance notes (templates / known limits)

Numbers below are **design limits and patterns**, not measured CI benchmarks collected in-repo.

- Workers: structural compress, JPEG raster compress, split, extract, merge, PDF→images
- Soft UI hint around **80MB+** local PDFs (guidance only; shows approximate MB)
- Cloud imports/exports capped at **50MB**
- Soft Cancel on Flatten/Protect/Unlock/Crop/Resize finishes the current await step, then stops

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
| Worker Cancel settles immediately (no timeout error) | _not recorded_ |
| OCR abort on file change (no further uploads) | _not recorded_ |
| JPEG compress raster worker | _not recorded_ |
| Cloud export Retry without consent keeps error | _not recorded_ |

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
