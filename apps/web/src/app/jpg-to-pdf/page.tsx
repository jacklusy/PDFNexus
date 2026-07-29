import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { ToolPageShell } from '@/features/tools/ToolPageShell';
import { JpgToPdfTool } from '@/features/tools/simple/SimpleTools';

export const metadata: Metadata = pageMetadata({
  title: 'JPG to PDF — Convert Images to PDF Online Free',
  description:
    'Combine JPG, PNG, and other images into one PDF. Reorder photos, one page per image, and download — local conversion with no upload.',
  path: '/jpg-to-pdf',
});

export default function Page() {
  return (
    <ToolPageShell
      title="JPG to PDF"
      description="Convert one or more images into a single PDF document. Each image becomes a page — perfect for scans, photos, and screenshots."
      path="/jpg-to-pdf"
      howItWorks={[
        'Add JPG, PNG, or other supported image files.',
        'Reorder images to set page sequence in the final PDF.',
        'Create PDF and download the combined document.',
      ]}
      privacyNote="This tool runs in your browser. Your file is not uploaded to process it."
      limits={[
        'Each image becomes one PDF page sized to fit the image dimensions.',
        'Very large images increase output file size and memory use.',
        'For mixed documents, merge the resulting PDF with others using Merge PDF.',
      ]}
      faqs={[
        {
          question: 'Which image formats are supported?',
          answer:
            'Common formats including JPEG and PNG are supported. Each file is embedded as its own PDF page.',
        },
        {
          question: 'Can I combine images and existing PDFs?',
          answer:
            'This tool accepts images only. Convert images to PDF here, then use Merge PDF to combine with other PDFs.',
        },
        {
          question: 'Will image quality be preserved?',
          answer:
            'Images are embedded at their source resolution without extra compression unless the source is already compressed.',
        },
      ]}
      related={[
        { href: '/pdf-to-jpg', label: 'PDF to JPG' },
        { href: '/merge-pdf', label: 'Merge PDF' },
        { href: '/compress-pdf', label: 'Compress PDF' },
      ]}
    >
      <JpgToPdfTool />
    </ToolPageShell>
  );
}
