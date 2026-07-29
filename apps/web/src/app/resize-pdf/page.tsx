import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { ToolPageShell } from '@/features/tools/ToolPageShell';
import { ResizeTool } from '@/features/tools/resize/ResizeTool';

export const metadata: Metadata = pageMetadata({
  title: 'Resize PDF Online — Change PDF Page Size Free',
  description:
    'Resize PDF pages to A4, Letter, or custom dimensions. Choose fit, fill, center, or stretch layout, then download — all in your browser.',
  path: '/resize-pdf',
});

export default function Page() {
  return (
    <ToolPageShell
      title="Resize PDF"
      description="Scale pages onto a new paper size. Pick a preset or custom dimensions and a layout mode (fit, fill, center, or stretch)."
      path="/resize-pdf"
      howItWorks={[
        'Upload the PDF whose pages you want to resize.',
        'Select a target paper size and layout mode (fit, fill, center, or stretch).',
        'Optionally limit to a page range, then download the resized PDF.',
      ]}
      privacyNote="This tool runs in your browser. Your file is not uploaded to process it."
      limits={[
        'Pages are embedded onto a new media size; extreme upscaling can look soft.',
        'Stretch mode may distort aspect ratio.',
      ]}
      faqs={[
        {
          question: 'Will text stay selectable?',
          answer:
            'Yes when the source page content is preserved via page embedding. Rasterized sources may lose text selection.',
        },
        {
          question: 'What is the difference between fit and fill?',
          answer:
            'Fit scales the page to stay fully visible inside the target. Fill covers the target and may crop overflow.',
        },
      ]}
      related={[
        { href: '/crop-pdf', label: 'Crop PDF' },
        { href: '/rotate-pdf', label: 'Rotate PDF' },
        { href: '/compress-pdf', label: 'Compress PDF' },
      ]}
    >
      <ResizeTool />
    </ToolPageShell>
  );
}
