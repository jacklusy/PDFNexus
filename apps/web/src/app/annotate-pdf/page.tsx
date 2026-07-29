import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { ToolPageShell } from '@/features/tools/ToolPageShell';
import { AnnotateTool } from '@/features/tools/annotate/AnnotateTool';

export const metadata: Metadata = pageMetadata({
  title: 'Annotate PDF Online — Highlights, Sticky Notes, Comments',
  description:
    'Add area highlights, sticky notes, and page comments to a PDF, then flatten them into page content. Local processing — not a collaborative review platform.',
  path: '/annotate-pdf',
});

export default function Page() {
  return (
    <ToolPageShell
      title="Annotate PDF"
      description="Add highlights, sticky notes, and page comments. Phase 2 exports flatten annotations into page content so they travel with the file."
      path="/annotate-pdf"
      howItWorks={[
        'Upload the PDF you want to mark up.',
        'Choose highlight, sticky note, or page comment and add items on the active page.',
        'Edit or delete items in the sidebar, then flatten into content and download.',
      ]}
      privacyNote="This tool runs in your browser. Your file is not uploaded to process it."
      limits={[
        'Export mode is flatten-into-content only in Phase 2 (not a separate editable annotation layer).',
        'Highlight placement uses a default area rectangle; fine-grained text selection is not included yet.',
        'Not a real-time collaboration or review workflow tool.',
      ]}
      faqs={[
        {
          question: 'Can reviewers reply to comments?',
          answer:
            'No. This is a local markup tool. Comments are burned into the page on export.',
        },
        {
          question: 'Will highlights stay editable after download?',
          answer:
            'No. Flattened highlights become drawn rectangles in page content.',
        },
      ]}
      related={[
        { href: '/edit-pdf', label: 'Edit PDF' },
        { href: '/edit-links-pdf', label: 'Edit links' },
        { href: '/flatten-pdf', label: 'Flatten PDF' },
      ]}
    >
      <AnnotateTool />
    </ToolPageShell>
  );
}
