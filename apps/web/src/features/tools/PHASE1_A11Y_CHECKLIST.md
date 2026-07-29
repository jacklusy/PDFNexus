# Phase 1 tools — manual a11y / QA checklist

Use this for local verification of Phase 1 tools only (Task.md §21).

## General (every tool page)

- [ ] Keyboard: Tab reaches file picker, controls, primary CTA, cancel (when busy)
- [ ] Escape closes mobile nav / dialogs without trapping focus
- [ ] Live progress text is announced or visible without relying on color alone
- [ ] Errors use `role="alert"` and clear guidance
- [ ] Mobile: tool panel usable at ~375px width; primary CTA not obscured
- [ ] After large PDF processing, cancel/stop leaves UI responsive; no stuck overlay

## Local downloads

- [ ] Merge / Split / Extract / Compress / Protect / Unlock / overlays / PDF→images download immediately without email OTP
- [ ] Optional “Email a copy” only appears after local success (workspace merge/Word)

## Split / Extract

- [ ] Invalid ranges show clear errors; overlaps rejected for split ranges
- [ ] Output file count preview matches ZIP/PDF results
- [ ] Extract select all / clear / invert + reorder works

## Compress

- [ ] Final size / % reduction / elapsed time shown after run (not fake estimates)
- [ ] Cancel or navigate away mid-run does not leave zombie canvases (spot-check memory)

## Protect / Unlock

- [ ] Password fields support show/hide; confirm mismatch blocked
- [ ] Invalid unlock password shows clear error (no crack attempt)
- [ ] Permissions note visible on Protect

## Overlays / Sign / Watermark / Page numbers

- [ ] Sign copy labels electronic/visual stamp (not cryptographic)
- [ ] Edit copy does not claim full text editing
- [ ] Signature save to localStorage only after consent checkbox

## PDF → images

- [ ] JPG / PNG / WebP export; multi-page → ZIP
- [ ] Name pattern `{n}` / `{name}` applied

## SEO pages

- [ ] Each Phase 1 route loads ToolPageShell + working tool
- [ ] Sitemap lists Phase 1 tool URLs
- [ ] Header Tools menu links to tools
