import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { ToolPageShell } from '@/features/tools/ToolPageShell';
import { PdfToHtmlTool } from '@/features/tools/pdf-to-html/PdfToHtmlTool';

export const metadata: Metadata = pageMetadata({
  title: 'PDF to HTML Online — Extract Text Layer to HTML',
  description:
    'Convert a PDF text layer into a simple HTML document for reading or further editing. Not a pixel-perfect layout clone. Runs locally in your browser.',
  path: '/pdf-to-html',
});

export default function Page() {
  return (
    <ToolPageShell
      title="PDF to HTML"
      description="Extract the PDF text layer into a readable HTML document. Layout is simplified — not a faithful visual recreation of every page."
      path="/pdf-to-html"
      howItWorks={[
        'Upload a PDF with a selectable text layer.',
        'Convert to HTML in your browser.',
        'Preview and download the .html file.',
      ]}
      privacyNote="This tool runs in your browser. Your file is not uploaded to process it."
      limits={[
        'Scanned PDFs without text will produce empty or sparse HTML.',
        'Columns, headers, and absolute positioning are not preserved as in the PDF.',
        'Images and vector graphics are not fully reconstructed in this export.',
      ]}
      faqs={[
        {
          question: 'Will the HTML look like the PDF?',
          answer:
            'It prioritizes readable text structure over exact layout. Expect reflow, not a print-perfect clone.',
        },
        {
          question: 'Can I use this for SEO scraping?',
          answer:
            'It extracts local text for your own documents. It is not a site crawler.',
        },
      ]}
      related={[
        { href: '/pdf-to-excel', label: 'PDF to Excel' },
        { href: '/pdf-to-jpg', label: 'PDF to JPG' },
        { href: '/extract-pdf-pages', label: 'Extract pages' },
      ]}
    >
      <PdfToHtmlTool />
    </ToolPageShell>
  );
}
