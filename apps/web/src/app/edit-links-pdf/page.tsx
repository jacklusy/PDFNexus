import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { ToolPageShell } from '@/features/tools/ToolPageShell';
import { LinksTool } from '@/features/tools/links/LinksTool';

export const metadata: Metadata = pageMetadata({
  title: 'Edit PDF Links Online — Add & Manage URI Annotations',
  description:
    'Extract existing URI links, add new clickable hyperlink annotations, edit or delete them, then export. Runs locally in your browser.',
  path: '/edit-links-pdf',
});

export default function Page() {
  return (
    <ToolPageShell
      title="Edit PDF links"
      description="Existing URI Link annotations are listed on upload. Add, edit, or delete links by page and rectangle, then export."
      path="/edit-links-pdf"
      howItWorks={[
        'Upload the PDF — existing http/https/mailto links are extracted into the list.',
        'Edit URIs and rectangles, or add new links.',
        'Export strips old Link annotations and writes the current list.',
      ]}
      privacyNote="This tool runs in your browser. Your file is not uploaded to process it."
      limits={[
        'Only URI actions are extracted (not GoTo / internal destinations).',
        'Coordinates are manual (PDF points); there is no click-to-place canvas yet.',
        'Link behavior depends on the PDF viewer; some readers may restrict external URIs.',
      ]}
      faqs={[
        {
          question: 'Can I edit links that are already in the PDF?',
          answer:
            'Yes for URI links. They appear in the list marked Existing. Edit or delete them, then export.',
        },
        {
          question: 'Are links just visual underlines?',
          answer:
            'Export draws a visual cue and also registers a real PDF Link annotation with a URI action.',
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
