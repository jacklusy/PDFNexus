# Phase 5 / 7 — Accessibility & manual QA checklist

Automated smoke exists for consent, processingMode, cloud limits, EPUB packaging, and cert honesty constants. **Items below stay unchecked until manually verified.**

## Drive / cloud security honesty
- [ ] “Pick PDF from Drive” opens Google Picker (or shows honest fallback copy)
- [ ] OAuth reconnect after disconnect works; session_mismatch if cookie missing mid-flow
- [ ] Export requires consent checkbox
- [ ] Oversized (>50MB) import/export shows clear error
- [ ] Dropbox / OneDrive connect from `/cloud` without making cloud mandatory

## Copy / transparency
- [ ] About + home (`page.tsx`): local downloads ungated; email optional
- [ ] Privacy illustration aria-label does not require email for local use
- [ ] `dropHint` matches processing mode
- [ ] Excel / Redact / Protect / Batch / CertSign failures use `ToolError`

## Batch
- [ ] Progress shows File i / n for queue jobs
- [ ] Cancel stops after current job; remaining stay pending
- [ ] Keyboard reaches Cancel on `ToolProgress`

## Workers / cleanup
- [ ] Structural compress (rasterize off) can cancel via worker terminate
- [ ] PDF→images / compress JPEG path clears canvas dimensions after encode

## Out of scope
- Full text editing (§9)
- Adobe ByteRange CMS / TSA / LTV
- Multi-op DAG
