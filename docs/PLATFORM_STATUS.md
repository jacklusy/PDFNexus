# PDFNexus — Platform status (Phases 5–8)

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
| Optional cloud | Drive / Dropbox / OneDrive | Only on explicit import/export + consent |

Local downloads remain ungated. Email verification is optional delivery only. Live marketing copy: [`apps/web/src/app/page.tsx`](../apps/web/src/app/page.tsx) (unused `MarketingHero` removed in Phase 7).

## Phase 5–6 (shipped)

- Google Picker import, 50MB caps, sanitized Drive errors, single Redis token key
- Dropbox + OneDrive OAuth, EPUB `/pdf-to-epub`, experimental cert-sign with detached `.p7s`
- See also [PHASE5_STATUS.md](./PHASE5_STATUS.md)

## Phase 7 (review fixes)

- OAuth login CSRF: callback requires cookie session === OAuth `state` session
- Shared encryption key resolver (`CLOUD_TOKEN_ENCRYPTION_KEY` preferred, else `GOOGLE_*`)
- Fail-closed: reject plaintext Redis tokens when encryption key is set
- Dropbox: metadata size gate before download; PDF-only export
- OneDrive: `Files.ReadWrite.AppFolder` + approot list/upload; PDF-only export
- Drive: session cookie only (no verified-email shortcut)
- About metadata/principles honesty; cert `.p7s` covers **original** bytes only
- Security unit tests: token-crypto, CSRF guard, PDF/size gates, env fail-closed

## Phase 8 (closeout)

- `/cloud` in sitemap; CertSign uses `ToolError`
- Real EPUB smoke (`pdfToEpub` with mocked HTML); cert parse/honesty Vitest
- Manual a11y checklist remains unchecked until humans run it

## §19 Performance notes

- Prefer local tools; workers for structural compress / split where feasible
- Raster JPEG compress and PDF→images use main-thread canvas (cleared after encode)
- Cloud imports/exports capped at **50MB**
- Batch cancel stops before the next pending job (not mid-runner AbortSignal)

## §20 Browser / device matrix (manual QA — not CI-validated)

| Browser | Desktop | Notes |
| --- | --- | --- |
| Chromium (Chrome/Edge) | Primary target | Run smoke here first |
| Firefox | Manual | Confirm downloads + workers |
| Safari | Manual | Confirm download quirks |
| Mobile | Best-effort | Large PDFs may OOM |

## Known limitations / out of scope

- Full existing-text editing (§9) — evaluation only; not implemented
- Adobe-validated /ByteRange CMS, TSA, LTV — cert-sign stays experimental
- In-workspace multi-op DAG
- Claiming healthcare/legal/regulatory compliance
- Drive still needs Google Picker under `drive.file` for arbitrary library files

## Env vars (cloud)

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` / `SECRET` / `REDIRECT_URI` | Drive |
| `GOOGLE_API_KEY` | Optional Picker developer key |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` or `CLOUD_TOKEN_ENCRYPTION_KEY` | AES-GCM at rest (32+, required in prod if any cloud enabled) |
| `DROPBOX_CLIENT_ID` / `SECRET` / `REDIRECT_URI` | Dropbox |
| `MICROSOFT_CLIENT_ID` / `SECRET` / `TENANT` / `REDIRECT_URI` | OneDrive AppFolder |

## Test commands

```bash
cd apps/web && npm test && npm run typecheck
cd apps/api && npm test && npm run typecheck
```
