import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { ToolPageShell } from '@/features/tools/ToolPageShell';
import { OverlayTool } from '@/features/tools/overlays/OverlayTool';

export const metadata: Metadata = pageMetadata({
  title: 'Add Text & Shapes to PDF — Overlay Edit (Not Full Text Edit)',
  description:
    'Add text, shapes, callouts, and freehand overlays onto PDF pages. Does not rewrite existing PDF text. Free, local, no upload.',
  path: '/edit-pdf',
});

export default function Page() {
  return (
    <ToolPageShell
      title="Add text & shapes"
      description="Overlay text, rectangles, ellipses, lines, arrows, callouts, and freehand strokes on PDF pages. This is not full existing-text editing."
      path="/edit-pdf"
      howItWorks={[
        'Upload the PDF you want to mark up.',
        'Add text, shapes, callouts, or freehand drawings on the active page.',
        'Download a copy with overlays exported into the pages.',
      ]}
      privacyNote="This tool runs in your browser. Your file is not uploaded to process it."
      limits={[
        'Adds overlay content only; it does not edit existing text inside the PDF structure (§9 full text edit is out of scope).',
        'Best for labels, callouts, and simple markup — not full document rewriting.',
        'Complex layouts may need the full workspace for additional operations.',
      ]}
      faqs={[
        {
          question: 'Can I change existing PDF text?',
          answer:
            'No. Full in-place editing of existing PDF text is out of scope for this product phase (complex fonts, reflow, and layout). This tool overlays new content only. Keep using overlays for labels and markup.',
        },
        {
          question: 'Which shapes are supported?',
          answer:
            'Rectangle, ellipse, line, arrow, callout (box + text), and freehand strokes, plus text labels.',
        },
        {
          question: 'Are edits saved as separate layers?',
          answer:
            'On export, overlays are flattened into the page so viewers see a single merged result.',
        },
      ]}
      related={[
        { href: '/sign-pdf', label: 'Sign PDF' },
        { href: '/watermark-pdf', label: 'Watermark PDF' },
        { href: '/page-numbers-pdf', label: 'Page numbers' },
      ]}
    >
      <OverlayTool mode="edit" />
    </ToolPageShell>
  );
}
