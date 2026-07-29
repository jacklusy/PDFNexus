import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { ToolPageShell } from '@/features/tools/ToolPageShell';
import { SplitTool } from '@/features/tools/split/SplitTool';

export const metadata: Metadata = pageMetadata({
  title: 'Split PDF Online — Separate Pages into New Files',
  description:
    'Split a PDF into individual pages or custom ranges. Extract chapters, invoices, or sections as separate downloads — processed locally, no upload.',
  path: '/split-pdf',
});

export default function Page() {
  return (
    <ToolPageShell
      title="Split PDF"
      description="Divide one PDF into multiple files by page range, every page, or selected sections. Download a ZIP of split files instantly."
      path="/split-pdf"
      howItWorks={[
        'Upload the PDF you want to split.',
        'Choose a split mode: every page, fixed ranges, or custom page groups.',
        'Run split and download the resulting PDFs as a ZIP archive.',
      ]}
      privacyNote="This tool runs in your browser. Your file is not uploaded to process it."
      limits={[
        'One source PDF at a time.',
        'Password-protected PDFs must be unlocked before splitting.',
        'Splitting hundreds of pages may take longer on low-memory devices.',
      ]}
      faqs={[
        {
          question: 'Can I split only certain pages?',
          answer:
            'Yes. Use custom ranges like 1-3, 5, 8-10 to create separate PDFs for each group you define.',
        },
        {
          question: 'How are split files delivered?',
          answer:
            'Multiple outputs are bundled into a ZIP file so you can download everything in one click.',
        },
        {
          question: 'Does splitting affect image quality?',
          answer:
            'Split copies pages as-is without re-encoding, so visual quality matches the original PDF.',
        },
      ]}
      related={[
        { href: '/merge-pdf', label: 'Merge PDF' },
        { href: '/extract-pdf-pages', label: 'Extract pages' },
        { href: '/rotate-pdf', label: 'Rotate PDF' },
      ]}
    >
      <SplitTool />
    </ToolPageShell>
  );
}
