import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { ToolPageShell } from '@/features/tools/ToolPageShell';
import { MergeTool } from '@/features/tools/simple/SimpleTools';

export const metadata: Metadata = pageMetadata({
  title: 'Merge PDF Files Online — Combine PDFs Free',
  description:
    'Combine multiple PDF documents into one file in your browser. Reorder pages, merge up to 40 PDFs, and download instantly — no upload required.',
  path: '/merge-pdf',
});

export default function Page() {
  return (
    <ToolPageShell
      title="Merge PDF"
      description="Combine two or more PDF files into a single document. Drag to reorder, then download — all processing happens locally in your browser."
      path="/merge-pdf"
      howItWorks={[
        'Add the PDF files you want to combine (at least two).',
        'Drag files to set the order they appear in the merged document.',
        'Click Merge & download to create one PDF and save it to your device.',
      ]}
      privacyNote="This tool runs in your browser. Your file is not uploaded to process it."
      limits={[
        'Up to 40 PDF files per merge.',
        'Encrypted PDFs may need to be unlocked first.',
        'Very large files may be limited by available browser memory.',
      ]}
      faqs={[
        {
          question: 'Can I change the order of PDFs before merging?',
          answer:
            'Yes. Reorder files in the list before merging. Pages from each file are appended in that order.',
        },
        {
          question: 'Will merging reduce quality?',
          answer:
            'No. Merge combines existing page content without re-compressing images, so quality stays the same as your source files.',
        },
        {
          question: 'Do I need an account?',
          answer:
            'No. Merge is free and runs entirely in your browser with no sign-up required.',
        },
      ]}
      related={[
        { href: '/split-pdf', label: 'Split PDF' },
        { href: '/extract-pdf-pages', label: 'Extract pages' },
        { href: '/compress-pdf', label: 'Compress PDF' },
      ]}
    >
      <MergeTool />
    </ToolPageShell>
  );
}
