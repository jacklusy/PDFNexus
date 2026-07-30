# Phase 4 — Accessibility & manual QA checklist

## Wave 0 — Honesty / processing modes
- [ ] Home + layout copy: local downloads ungated; email/Drive optional
- [ ] Tool badges show Task.md modes (Processed locally / Cloud processing required / Cloud-assisted)
- [ ] Excel badge switches to Cloud-assisted when OCR consent checked
- [ ] Office→PDF shows Cloud processing required
- [ ] Cert-sign shows Processed locally · experimental

## Wave 1 — Progress / batch
- [ ] Compress / PDF→images / PPTX / Redact / Bates show stage + elapsed (no fake %)
- [ ] Batch panel: watermark, page numbers, protect, PDF→JPG, Bates available
- [ ] Batch settings persist across reopen
- [ ] Flatten still requires confirm; annotation failure fails job

## Wave 2 — Google Drive
- [ ] Connect Drive only with explicit OAuth
- [ ] Import PDF into tool without making Drive mandatory
- [ ] Export requires consent checkbox (“document leaves the browser”)
- [ ] Empty GOOGLE_CLIENT_ID → clear 503 / disabled UI
- [ ] Local download remains primary CTA

## Wave 3 — SEO / errors
- [ ] `/tools` and category pages indexable
- [ ] Tool pages show breadcrumb UI + BreadcrumbList JSON-LD
- [ ] Compress / Unlock / Office errors use ToolError (original safe + retry)
- [ ] Keyboard: Tools nav link reaches `/tools`
- [ ] Focus visible on category cards and Drive consent checkbox

## Keyboard / screen reader
- [ ] Progress cancel button labeled
- [ ] Processing mode badge not the only status (privacy note present)
- [ ] Error alerts announced (`role="alert"`)

## Out of scope (do not fail Phase 4)
- Dropbox / OneDrive → see Phase 5/6
- Full CMS certificate signing → Phase 6 honesty upgrade
- EPUB / full text editing

## Phase 5 follow-ups
See [PHASE5_A11Y_CHECKLIST.md](./PHASE5_A11Y_CHECKLIST.md) and `docs/PHASE5_STATUS.md`.
