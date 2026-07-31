# PDFNexus — Platform status (Phases 5–30)

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

## Phase 5–27 (summary)

Workers, cancel honesty, Bates continuity, nested pdf.js `disableWorker`, OCR Cancel, text-layer highlight, URI link extract, forms polish, typed callouts, soft Cancel on Merge/Rotate/JpgToPdf + annotate/links/forms/overlay.

## Phase 28 (Links High fixes)

- Links export uses `writeLinkAnnotationsOnly` (no burned `(link:` chrome)
- Empty link list export allowed (strip-only)
- URI edits update on keystroke; validate on blur / Add / Export

## Phase 29 (Medium harden + coverage)

- Forms page `/Tabs` `/A`; duplicate name rejected in UI; mailto CRLF rejected
- Strip preserves non-dict Annots; `uint8ToBlob` / `uint8ToArrayBuffer` shared helper
- Annotate Retry matches error kind (export vs text highlight)
- New tests: createFormFields, writeLinkAnnotationsOnly, callout flatten, splitPdf, mailto injection

## Phase 30 (QA evidence)

Automated suite green (web vitest + typecheck; api vitest + typecheck). Honest matrix below — **do not invent Passed for unexecuted manual cells**.

### QA matrix

| Area | Status | Evidence |
| --- | --- | --- |
| Worker cancel / Bates deliver / OCR abort | Passed (auto) | vitest: runInWorker, deliverBatesOutputs, ocrTables.abort |
| Links extract / annotations-only / empty export | Passed (auto) | writeLinkAnnotationsOnly, extractLinkAnnotations |
| Forms validation + Tabs | Passed (auto) | createFormFields.test |
| Split plan + smoke | Passed (auto) | splitPdf.test |
| Callout flatten | Passed (auto) | flattenOverlays.test |
| mailto CRLF / scheme allowlist | Passed (auto) | linkUri.test |
| Phase 1 Merge/Rotate/Jpg soft cancel | Passed (code review + unit wiring) | SimpleTools ToolProgress Cancel |
| Browser matrix (Firefox/Safari/mobile) | Manual | §20 `_not recorded_` |
| Full a11y PHASE checklists | Manual | tool a11y docs |
| Live cloud OAuth / Picker | Manual | provider-dependent |
| Measured perf / §13 ETA | Manual / OOS | templates only |
| §9 text edit / Adobe CMS/TSA/LTV / multi-op DAG / full-library cloud | OOS | unchanged |

### Spot-check notes (manual — fill in during QA)

| Check | Result |
| --- | --- |
| Cancel after worker start does not orphan-reject | _not recorded_ |
| Bates download then Cancel still advances next number | _not recorded_ |
| Text-layer highlight on text PDF | _not recorded_ |
| Existing URI links listed; export has no burned chrome | _not recorded_ |
| Export after deleting all links | _not recorded_ |
| Typed callout exports as one overlay | _not recorded_ |

## §19 Performance notes (templates / known limits)

Numbers below are **design limits and patterns**, not measured CI benchmarks collected in-repo.

- Workers: structural compress, JPEG raster compress, split, extract, merge, PDF→images
- Inside module workers, pdf.js runs with **`disableWorker: true`**
- Soft UI hint around **80MB+** local PDFs
- Cloud imports/exports capped at **50MB**
- Soft Cancel finishes the current await step, then stops

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
