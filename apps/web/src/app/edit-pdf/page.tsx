import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { ToolPageShell } from '@/features/tools/ToolPageShell';
import { OverlayTool } from '@/features/tools/overlays/OverlayTool';

export const metadata: Metadata = pageMetadata({
  title: 'Edit PDF Online — Add Text and Shapes to PDF',
  description:
    'Annotate PDFs with text, shapes, callouts, and freehand. Position overlays, then export into a flattened copy — free, local, no upload.',
  path: '/edit-pdf',
});

export default function Page() {
  return (
    <ToolPageShell
      title="Edit PDF"
      description="Add text, rectangles, ellipses, lines, arrows, callouts, and freehand strokes on top of your PDF pages. Export overlays into the document."
      path="/edit-pdf"
      howItWorks={[
        'Upload the PDF you want to annotate.',
        'Add text, shapes, callouts, or freehand drawings on the active page.',
        'Download the edited PDF with overlays exported into the pages.',
      ]}
      privacyNote="This tool runs in your browser. Your file is not uploaded to process it."
      limits={[
        'Adds overlay content; it does not edit existing text inside the PDF structure.',
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
