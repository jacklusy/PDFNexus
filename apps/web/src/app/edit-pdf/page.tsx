import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { ToolPageShell } from '@/features/tools/ToolPageShell';
import { OverlayTool } from '@/features/tools/overlays/OverlayTool';

export const metadata: Metadata = pageMetadata({
  title: 'Edit PDF Online — Add Text and Shapes to PDF',
  description:
    'Annotate PDFs with text boxes and rectangles. Position elements via coordinates, then export overlays into a flattened copy — free, local, no upload.',
  path: '/edit-pdf',
});

export default function Page() {
  return (
    <ToolPageShell
      title="Edit PDF"
      description="Add text labels, rectangles, and basic shapes on top of your PDF pages. Place tools with coordinate controls, then export overlays into the document."
      path="/edit-pdf"
      howItWorks={[
        'Upload the PDF you want to annotate.',
        'Select text or shape tools and set position via coordinates.',
        'Place tools, then download the edited PDF with overlays exported into the pages.',
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
            'This tool overlays new text on the page. It does not modify text already embedded in the PDF by the original author.',
        },
        {
          question: 'Which shapes are supported?',
          answer:
            'You can add text boxes and rectangular shapes. Use the workspace for a broader set of editing tools.',
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
