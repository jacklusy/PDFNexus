import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { ToolPageShell } from '@/features/tools/ToolPageShell';
import { PdfToImagesTool } from '@/features/tools/pdf-to-images/PdfToImagesTool';

export const metadata: Metadata = pageMetadata({
  title: 'PDF to JPG — Convert PDF Pages to Images Online',
  description:
    'Export PDF pages as JPG or PNG images. Select page ranges, set quality and scale, download a ZIP — conversion runs locally with no upload.',
  path: '/pdf-to-jpg',
});

export default function Page() {
  return (
    <ToolPageShell
      title="PDF to JPG"
      description="Turn PDF pages into high-quality JPG or PNG images. Choose which pages to export, adjust resolution and compression, then download as a ZIP."
      path="/pdf-to-jpg"
      howItWorks={[
        'Upload the PDF you want to convert.',
        'Select page range, image format (JPG or PNG), scale, and quality.',
        'Convert and download images packaged in a ZIP file.',
      ]}
      privacyNote="This tool runs in your browser. Your file is not uploaded to process it."
      limits={[
        'PNG exports are lossless but larger; JPG supports quality tuning.',
        'Higher scale increases resolution and processing time.',
        'Encrypted PDFs may need to be unlocked before conversion.',
      ]}
      faqs={[
        {
          question: 'JPG or PNG — which should I use?',
          answer:
            'Use JPG for photos and smaller files. Use PNG when you need sharp text, transparency, or lossless output.',
        },
        {
          question: 'Can I convert only one page?',
          answer:
            'Yes. Enter a single page number or a range like 3-3 in the page range field.',
        },
        {
          question: 'What resolution will I get?',
          answer:
            'Scale multiplies the default render size. Scale 2 is roughly double the base pixel dimensions for sharper output.',
        },
      ]}
      related={[
        { href: '/jpg-to-pdf', label: 'JPG to PDF' },
        { href: '/compress-pdf', label: 'Compress PDF' },
        { href: '/rotate-pdf', label: 'Rotate PDF' },
      ]}
    >
      <PdfToImagesTool />
    </ToolPageShell>
  );
}
