import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { ToolPageShell } from '@/features/tools/ToolPageShell';
import { LinksTool } from '@/features/tools/links/LinksTool';

export const metadata: Metadata = pageMetadata({
  title: 'Edit PDF Links Online — Add Clickable URI Annotations',
  description:
    'Add clickable hyperlink annotations to PDF pages by URI and rectangle. Export embeds Link annotations locally in your browser. Existing link extraction is not included in Phase 2.',
  path: '/edit-links-pdf',
});

export default function Page() {
  return (
    <ToolPageShell
      title="Edit PDF links"
      description="Add URI link annotations by page and rectangle (PDF points, bottom-left origin). Export writes Link annotations plus a visual indicator."
      path="/edit-links-pdf"
      howItWorks={[
        'Upload the PDF that needs links.',
        'Enter a URI, page number, and rectangle (x, y, width, height).',
        'Review the list, edit or delete entries, then export with link annotations.',
      ]}
      privacyNote="This tool runs in your browser. Your file is not uploaded to process it."
      limits={[
        'Phase 2 does not extract or list existing links from the uploaded PDF.',
        'Coordinates are manual (PDF points); there is no click-to-place canvas yet.',
        'Link behavior depends on the PDF viewer; some readers may restrict external URIs.',
      ]}
      faqs={[
        {
          question: 'Can I edit links that are already in the PDF?',
          answer:
            'Not in Phase 2. You can add new links and export them. Existing-link extraction is planned for a later phase.',
        },
        {
          question: 'Are links just visual underlines?',
          answer:
            'Export draws a visual cue and also attempts to register a real PDF Link annotation with a URI action.',
        },
      ]}
      related={[
        { href: '/annotate-pdf', label: 'Annotate PDF' },
        { href: '/edit-pdf', label: 'Add text & shapes' },
        { href: '/watermark-pdf', label: 'Watermark PDF' },
      ]}
    >
      <LinksTool />
    </ToolPageShell>
  );
}
