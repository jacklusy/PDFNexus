import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { ToolPageShell } from '@/features/tools/ToolPageShell';
import { CompressTool } from '@/features/tools/compress/CompressTool';

export const metadata: Metadata = pageMetadata({
  title: 'Compress PDF Online — Reduce PDF File Size Free',
  description:
    'Shrink PDF file size for email and sharing. Choose a compression preset, see before/after size, and download — all in your browser with no upload.',
  path: '/compress-pdf',
});

export default function Page() {
  return (
    <ToolPageShell
      title="Compress PDF"
      description="Reduce PDF file size by re-rendering pages at lower resolution or quality. Pick a preset that balances size and readability for your use case."
      path="/compress-pdf"
      howItWorks={[
        'Upload the PDF you want to make smaller.',
        'Select a compression preset (balanced, smaller file, or smallest).',
        'Review the estimated size reduction, then download the compressed PDF.',
      ]}
      privacyNote="This tool runs in your browser. Your file is not uploaded to process it."
      limits={[
        'Compression re-renders page content; text-heavy PDFs shrink more than vector-only files.',
        'Scanned documents may show visible quality loss at aggressive presets.',
        'Large files are limited by available browser memory.',
      ]}
      faqs={[
        {
          question: 'Will compression make my PDF unreadable?',
          answer:
            'Balanced presets aim to keep text sharp while reducing image weight. Try a lighter preset first if quality matters.',
        },
        {
          question: 'Does this remove passwords or restrictions?',
          answer:
            'No. Compression changes page rendering only; encryption and permissions are not altered.',
        },
        {
          question: 'Can I compress multiple PDFs at once?',
          answer:
            'This page processes one PDF at a time. Use the workspace for batch workflows across several files.',
        },
      ]}
      related={[
        { href: '/protect-pdf', label: 'Protect PDF' },
        { href: '/merge-pdf', label: 'Merge PDF' },
        { href: '/pdf-to-jpg', label: 'PDF to JPG' },
      ]}
    >
      <CompressTool />
    </ToolPageShell>
  );
}
