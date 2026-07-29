import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { ToolPageShell } from '@/features/tools/ToolPageShell';
import { FormsTool } from '@/features/tools/forms/FormsTool';

export const metadata: Metadata = pageMetadata({
  title: 'Create PDF Form Online — Add AcroForm Fields Locally',
  description:
    'Add text, checkbox, dropdown, and button AcroForm fields by page and rectangle. Export a fillable PDF processed in your browser — coordinates are manual.',
  path: '/create-pdf-form',
});

export default function Page() {
  return (
    <ToolPageShell
      title="Create PDF form"
      description="Add AcroForm fields (text, checkbox, dropdown, button) by name, page, and rectangle. Coordinates use PDF points with a bottom-left origin."
      path="/create-pdf-form"
      howItWorks={[
        'Upload a PDF that should become fillable.',
        'Add fields with type, name, page, and geometry.',
        'Export a PDF with AcroForm fields embedded locally.',
      ]}
      privacyNote="This tool runs in your browser. Your file is not uploaded to process it."
      limits={[
        'Field placement is manual (no click-to-place canvas yet).',
        'Existing form fields are not listed or edited in this version.',
        'Viewer support for buttons and dropdowns varies by PDF reader.',
      ]}
      faqs={[
        {
          question: 'Can I redesign an existing form?',
          answer:
            'You can add new fields. This tool does not extract or rewrite an existing form layout.',
        },
        {
          question: 'Are coordinates from the top-left?',
          answer:
            'No. PDF user space uses a bottom-left origin. Y increases upward.',
        },
      ]}
      related={[
        { href: '/flatten-pdf', label: 'Flatten PDF' },
        { href: '/edit-links-pdf', label: 'Edit links' },
        { href: '/protect-pdf', label: 'Protect PDF' },
      ]}
    >
      <FormsTool />
    </ToolPageShell>
  );
}
