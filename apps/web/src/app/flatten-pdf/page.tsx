import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { ToolPageShell } from '@/features/tools/ToolPageShell';
import { FlattenTool } from '@/features/tools/flatten/FlattenTool';

export const metadata: Metadata = pageMetadata({
  title: 'Flatten PDF Online — Flatten Forms and Annotations',
  description:
    'Flatten fillable form fields and annotations into page content so they can no longer be edited. Runs locally in your browser with a clear irreversible warning.',
  path: '/flatten-pdf',
});

export default function Page() {
  return (
    <ToolPageShell
      title="Flatten PDF"
      description="Merge form fields and annotations into page content. The result is no longer editable as forms or annotations — confirm before you proceed."
      path="/flatten-pdf"
      howItWorks={[
        'Upload a PDF that contains forms or annotations.',
        'Read the irreversible flatten warning and confirm you understand it.',
        'Download the flattened PDF processed in your browser.',
      ]}
      privacyNote="This tool runs in your browser. Your file is not uploaded to process it."
      limits={[
        'Flattening cannot be undone; keep a copy of the original if you need editable fields later.',
        'Annotation flatten depends on available local toolkit support; forms use pdf-lib.',
        'Encrypted PDFs must be unlocked first.',
      ]}
      faqs={[
        {
          question: 'Will filled form values remain visible?',
          answer:
            'Yes. Flattening burns field appearances into page content so values stay visible but are no longer editable fields.',
        },
        {
          question: 'Is this the same as flattening annotation overlays from Add text & shapes?',
          answer:
            'Related idea, different scope. This tool targets AcroForm fields and native annotations; Add text & shapes burns its own overlay stamps into content.',
        },
      ]}
      related={[
        { href: '/protect-pdf', label: 'Protect PDF' },
        { href: '/annotate-pdf', label: 'Annotate PDF' },
        { href: '/edit-pdf', label: 'Add text & shapes' },
      ]}
    >
      <FlattenTool />
    </ToolPageShell>
  );
}
