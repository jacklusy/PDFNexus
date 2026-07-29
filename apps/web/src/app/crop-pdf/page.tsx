import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { ToolPageShell } from '@/features/tools/ToolPageShell';
import { CropTool } from '@/features/tools/crop/CropTool';

export const metadata: Metadata = pageMetadata({
  title: 'Crop PDF Online — Trim PDF Page Margins Free',
  description:
    'Hard-crop PDF pages by removing content outside your margins. Preview the crop box, apply to all or selected pages, and download — processed locally.',
  path: '/crop-pdf',
});

export default function Page() {
  return (
    <ToolPageShell
      title="Crop PDF"
      description="Hard-crop page margins with presets or custom values. Content outside the crop is removed from the exported PDF (not just hidden)."
      path="/crop-pdf"
      howItWorks={[
        'Upload the PDF you want to crop.',
        'Adjust margins with presets or custom values and preview the crop box on the active page.',
        'Choose all pages or a page range, then download the hard-cropped PDF.',
      ]}
      privacyNote="This tool runs in your browser. Your file is not uploaded to process it."
      limits={[
        'Hard crop permanently removes content outside the crop rectangle from the exported file.',
        'To undo, re-upload your original PDF — restore only resets margins before export.',
        'Large files are limited by available browser memory.',
      ]}
      faqs={[
        {
          question: 'Does crop permanently delete content?',
          answer:
            'Yes. Export rebuilds each page so only the cropped region remains. Keep a copy of the original if you may need the full page later.',
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
