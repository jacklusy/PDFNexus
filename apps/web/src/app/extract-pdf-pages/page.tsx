import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { ToolPageShell } from '@/features/tools/ToolPageShell';
import { ExtractTool } from '@/features/tools/extract/ExtractTool';

export const metadata: Metadata = pageMetadata({
  title: 'Extract PDF Pages — Save Selected Pages as New PDF',
  description:
    'Pull specific pages out of a PDF and save them as a new document. Enter page ranges like 2-5 or 1,3,7 — free, local, no upload.',
  path: '/extract-pdf-pages',
});

export default function Page() {
  return (
    <ToolPageShell
      title="Extract PDF pages"
      description="Select the pages you need and export them as a standalone PDF. Ideal for pulling out forms, chapters, or signed pages from a larger file."
      path="/extract-pdf-pages"
      howItWorks={[
        'Upload the PDF containing the pages you want.',
        'Enter page numbers or ranges (for example, 1-3, 5, 10-12).',
        'Extract and download a new PDF with only those pages.',
      ]}
      privacyNote="This tool runs in your browser. Your file is not uploaded to process it."
      limits={[
        'One source PDF per extraction.',
        'Page numbers must be within the document page count.',
        'Encrypted PDFs require unlocking first.',
      ]}
      faqs={[
        {
          question: 'What page range syntax is supported?',
          answer:
            'Use comma-separated values and dashes for ranges, such as 1-3, 5, 8-10. Pages are 1-indexed.',
        },
        {
          question: 'Is the original PDF modified?',
          answer:
            'No. Extract creates a new file; your uploaded source stays unchanged on your device.',
        },
        {
          question: 'How is extract different from split?',
          answer:
            'Extract produces one PDF with your chosen pages. Split can create multiple separate files or a ZIP of segments.',
        },
      ]}
      related={[
        { href: '/split-pdf', label: 'Split PDF' },
        { href: '/merge-pdf', label: 'Merge PDF' },
        { href: '/rotate-pdf', label: 'Rotate PDF' },
      ]}
    >
      <ExtractTool />
    </ToolPageShell>
  );
}
