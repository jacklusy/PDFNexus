# PDFNexus — Platform status (Phases 5–27)

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

## Phase 5–24 (summary)

Workers, cancel honesty, Bates continuity, nested pdf.js `disableWorker`, OCR Cancel, download gates, honest manual QA templates.

## Phase 25 (soft cancel + evidence)

- ToolProgress + soft Cancel on Merge / Rotate / JpgToPdf and Annotate / Links / Forms / Overlay export
- Excel OCR abort early-return progress-clear regression test
- `downloadWorkerOutputs` comment covers Extract / Compress

## Phase 26 (annotate + links)

- Text-layer highlight via `textLayerQuads` (area highlight remains)
- Existing URI Link extract / list / edit / delete; export strips then re-adds
- Annotate / edit-links SEO copy updated

## Phase 27 (forms + callouts + status)

- Forms: list order = tab order (Up/Down), name/options validation, optional tooltip
- Typed `CalloutOverlay` (box + text + optional leader) in flatten + OverlayTool
- §19 / §20 remain **templates / manual QA** — no invented pass rates

## §19 Performance notes (templates / known limits)

Numbers below are **design limits and patterns**, not measured CI benchmarks collected in-repo.

- Workers: structural compress, JPEG raster compress, split, extract, merge, PDF→images
- Inside module workers, pdf.js runs with **`disableWorker: true`** (avoids nested workers)
- Soft UI hint around **80MB+** local PDFs (guidance only)
- Cloud imports/exports capped at **50MB**
- Soft Cancel finishes the current await step, then stops

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
| Bates download then Cancel still advances next number (storage + UI start) | _not recorded_ |
| Text-layer highlight on text PDF | _not recorded_ |
| Existing URI links listed on upload | _not recorded_ |
| Typed callout exports as one overlay | _not recorded_ |

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
- GoTo / internal link destinations (URI-only extract)
- Editable PPTX reconstruction beyond image slides

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
