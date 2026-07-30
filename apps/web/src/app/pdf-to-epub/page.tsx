import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { ToolPageShell } from '@/features/tools/ToolPageShell';
import { PdfToEpubTool } from '@/features/tools/pdf-to-epub/PdfToEpubTool';

export const metadata: Metadata = pageMetadata({
  title: 'PDF to EPUB Online — Reflowable Ebook Export',
  description:
    'Convert PDF text into a reflowable EPUB ebook in your browser. Layout is simplified — not a pixel-perfect clone of the PDF.',
  path: '/pdf-to-epub',
});

export default function Page() {
  return (
    <ToolPageShell
      title="PDF to EPUB"
      description="Export reading-order text into an EPUB 3 package. Complex PDF layouts will reflow."
      path="/pdf-to-epub"
      howItWorks={[
        'Upload a PDF with a selectable text layer.',
        'We extract text via the same path as PDF→HTML.',
        'Download a .epub package for ebook readers.',
      ]}
      privacyNote="This tool runs in your browser. Your file is not uploaded to process it."
      limits={[
        'EPUB is reflowable — columns and absolute positioning are not preserved.',
        'Scanned PDFs without a text layer produce sparse books.',
        'Images are omitted by default to keep the EPUB small.',
      ]}
      faqs={[
        {
          question: 'Will the EPUB look like the PDF?',
          answer:
            'No. EPUB reflows text for ebook readers. Use PDF→images if you need visual page snapshots.',
        },
        {
          question: 'Is this Adobe InDesign quality?',
          answer:
            'No. This is a practical text packaging MVP, not a design-tool export.',
        },
      ]}
      related={[
        { href: '/pdf-to-html', label: 'PDF to HTML' },
        { href: '/pdf-to-jpg', label: 'PDF to JPG' },
        { href: '/pdf-to-excel', label: 'PDF to Excel' },
      ]}
    >
      <PdfToEpubTool />
    </ToolPageShell>
  );
}
