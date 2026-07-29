import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { ToolPageShell } from '@/features/tools/ToolPageShell';
import { CropTool } from '@/features/tools/crop/CropTool';

export const metadata: Metadata = pageMetadata({
  title: 'Crop PDF Online — Trim PDF Page Margins Free',
  description:
    'Crop PDF pages by setting margins or presets. Preview the crop box, apply to all or selected pages, and download — processed locally in your browser.',
  path: '/crop-pdf',
});

export default function Page() {
  return (
    <ToolPageShell
      title="Crop PDF"
      description="Trim page margins with presets or custom values. Preview the crop rectangle, apply to all pages or a range, then download the cropped PDF."
      path="/crop-pdf"
      howItWorks={[
        'Upload the PDF you want to crop.',
        'Adjust margins with presets or custom values and preview the crop box on the active page.',
        'Choose all pages or a page range, then download the cropped PDF.',
      ]}
      privacyNote="This tool runs in your browser. Your file is not uploaded to process it."
      limits={[
        'Cropping updates CropBox / MediaBox geometry; content outside the box may still exist until hard-cropped by a viewer.',
        'Large files are limited by available browser memory.',
      ]}
      faqs={[
        {
          question: 'Does crop permanently delete content?',
          answer:
            'This tool sets page crop geometry. Some viewers still allow viewing beyond CropBox unless content is flattened or re-exported.',
        },
        {
          question: 'Can I crop only some pages?',
          answer:
            'Yes. Switch to a page range and enter pages such as 1, 3–5 before exporting.',
        },
      ]}
      related={[
        { href: '/resize-pdf', label: 'Resize PDF' },
        { href: '/rotate-pdf', label: 'Rotate PDF' },
        { href: '/flatten-pdf', label: 'Flatten PDF' },
      ]}
    >
      <CropTool />
    </ToolPageShell>
  );
}
