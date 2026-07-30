import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { ToolPageShell } from '@/features/tools/ToolPageShell';
import { OverlayTool } from '@/features/tools/overlays/OverlayTool';

export const metadata: Metadata = pageMetadata({
  title: 'Add Page Numbers to PDF — Number Pages Online Free',
  description:
    'Insert page numbers in the header or footer of every PDF page. Choose position and format, then download — processed locally in your browser.',
  path: '/page-numbers-pdf',
});

export default function Page() {
  return (
    <ToolPageShell
      title="Add page numbers to PDF"
      description="Automatically number every page of your PDF. Pick corner placement and numbering style, preview on the canvas, then export."
      path="/page-numbers-pdf"
      howItWorks={[
        'Upload the PDF that needs page numbers.',
        'Choose placement (for example bottom center) and starting number if applicable.',
        'Apply numbering to all pages and download the updated PDF.',
      ]}
      privacyNote="This tool runs in your browser. Your file is not uploaded to process it."
      limits={[
        'Numbers are added as flattened overlay text on each page.',
        'Roman numerals or section-based numbering may require manual setup in the workspace.',
        'Very small margins may cause overlap with existing footer content.',
      ]}
      faqs={[
        {
          question: 'Can I skip numbering the first page?',
          answer:
            'Standard mode numbers all pages. For cover sheets without numbers, extract or split the cover first, number the body, then merge.',
        },
        {
          question: 'Where can page numbers be placed?',
          answer:
            'Choose from common header and footer positions such as bottom center, bottom right, and top corners.',
        },
        {
          question: 'Will numbering update if I reorder pages later?',
          answer:
            'Numbers are baked into the exported file. Reordering pages afterward requires re-running the tool on the new order.',
        },
      ]}
      related={[
        { href: '/edit-pdf', label: 'Add text & shapes' },
        { href: '/watermark-pdf', label: 'Watermark PDF' },
        { href: '/merge-pdf', label: 'Merge PDF' },
      ]}
    >
      <OverlayTool mode="pageNumbers" />
    </ToolPageShell>
  );
}
