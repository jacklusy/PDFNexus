/**
 * Tool category groupings for SEO category pages (§16).
 */

export type ToolCategoryId = 'convert' | 'edit' | 'secure' | 'organize';

export interface ToolCategoryEntry {
  href: string;
  label: string;
  blurb: string;
}

export interface ToolCategory {
  id: ToolCategoryId;
  path: string;
  title: string;
  description: string;
  tools: ToolCategoryEntry[];
}

export const TOOL_CATEGORIES: ToolCategory[] = [
  {
    id: 'organize',
    path: '/tools/organize',
    title: 'Organize PDF tools',
    description:
      'Merge, split, extract, rotate, and reorder PDF pages — processed locally in your browser.',
    tools: [
      { href: '/merge-pdf', label: 'Merge PDF', blurb: 'Combine multiple PDFs into one.' },
      { href: '/split-pdf', label: 'Split PDF', blurb: 'Split by ranges or every N pages.' },
      { href: '/extract-pdf-pages', label: 'Extract pages', blurb: 'Export selected pages.' },
      { href: '/rotate-pdf', label: 'Rotate PDF', blurb: 'Rotate pages by 90° steps.' },
      { href: '/workspace', label: 'Workspace', blurb: 'Multi-file page organizer.' },
    ],
  },
  {
    id: 'convert',
    path: '/tools/convert',
    title: 'Convert PDF tools',
    description:
      'Convert between PDF, images, Excel, PowerPoint, HTML, and Office formats.',
    tools: [
      { href: '/pdf-to-jpg', label: 'PDF to JPG', blurb: 'Export pages as images.' },
      { href: '/jpg-to-pdf', label: 'JPG to PDF', blurb: 'Build a PDF from images.' },
      { href: '/pdf-to-excel', label: 'PDF to Excel', blurb: 'Detect tables → .xlsx.' },
      { href: '/pdf-to-pptx', label: 'PDF to PPTX', blurb: 'Image-based slides.' },
      { href: '/pdf-to-html', label: 'PDF to HTML', blurb: 'Reading-order HTML export.' },
      { href: '/pdf-to-epub', label: 'PDF to EPUB', blurb: 'Reflowable EPUB from text layer.' },
      { href: '/office-to-pdf', label: 'Office to PDF', blurb: 'DOCX/XLSX/PPTX via server.' },
    ],
  },
  {
    id: 'edit',
    path: '/tools/edit',
    title: 'Edit & markup PDF tools',
    description:
      'Add text, shapes, watermarks, annotations, forms, Bates numbers, and redaction.',
    tools: [
      { href: '/edit-pdf', label: 'Edit PDF', blurb: 'Text, shapes, callouts, freehand.' },
      { href: '/annotate-pdf', label: 'Annotate', blurb: 'Highlights and comments.' },
      { href: '/watermark-pdf', label: 'Watermark', blurb: 'Stamp text across pages.' },
      { href: '/page-numbers-pdf', label: 'Page numbers', blurb: 'Header/footer numbers.' },
      { href: '/crop-pdf', label: 'Crop PDF', blurb: 'Hard-crop page margins.' },
      { href: '/resize-pdf', label: 'Resize PDF', blurb: 'Fit pages to paper sizes.' },
      { href: '/create-pdf-form', label: 'Create form', blurb: 'Fillable AcroForm fields.' },
      { href: '/bates-numbering', label: 'Bates numbering', blurb: 'Legal sequential IDs.' },
      { href: '/redact-pdf', label: 'Redact PDF', blurb: 'Permanent content removal.' },
      { href: '/edit-links-pdf', label: 'Edit links', blurb: 'Add http/https/mailto links.' },
      { href: '/flatten-pdf', label: 'Flatten PDF', blurb: 'Merge forms and annotations.' },
    ],
  },
  {
    id: 'secure',
    path: '/tools/secure',
    title: 'Secure PDF tools',
    description:
      'Protect, unlock, sign visually, or apply an experimental certificate appearance.',
    tools: [
      { href: '/protect-pdf', label: 'Protect PDF', blurb: 'Password-encrypt a PDF.' },
      { href: '/unlock-pdf', label: 'Unlock PDF', blurb: 'Remove a known password.' },
      { href: '/sign-pdf', label: 'Sign PDF', blurb: 'Visual electronic stamp.' },
      {
        href: '/cert-sign-pdf',
        label: 'Cert sign PDF',
        blurb: 'Experimental PKCS#12 + detached PKCS#7 (not Adobe-valid).',
      },
      { href: '/compress-pdf', label: 'Compress PDF', blurb: 'Reduce file size locally.' },
    ],
  },
];

export function getToolCategory(id: ToolCategoryId): ToolCategory | undefined {
  return TOOL_CATEGORIES.find((c) => c.id === id);
}
