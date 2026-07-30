export const PHASE1_TOOL_ROUTES = [
  '/merge-pdf',
  '/split-pdf',
  '/extract-pdf-pages',
  '/compress-pdf',
  '/protect-pdf',
  '/unlock-pdf',
  '/sign-pdf',
  '/edit-pdf',
  '/watermark-pdf',
  '/page-numbers-pdf',
  '/pdf-to-jpg',
  '/jpg-to-pdf',
  '/rotate-pdf',
] as const;

export type Phase1ToolRoute = (typeof PHASE1_TOOL_ROUTES)[number];

export const PHASE2_TOOL_ROUTES = [
  '/crop-pdf',
  '/resize-pdf',
  '/flatten-pdf',
  '/annotate-pdf',
  '/edit-links-pdf',
] as const;

export type Phase2ToolRoute = (typeof PHASE2_TOOL_ROUTES)[number];

export const PHASE3_TOOL_ROUTES = [
  '/pdf-to-excel',
  '/pdf-to-pptx',
  '/bates-numbering',
  '/create-pdf-form',
  '/redact-pdf',
  '/pdf-to-html',
  '/pdf-to-epub',
  '/office-to-pdf',
  '/cert-sign-pdf',
] as const;

export type Phase3ToolRoute = (typeof PHASE3_TOOL_ROUTES)[number];

/** Task.md SEO aliases that redirect to primary tool routes. */
export const TOOL_ROUTE_ALIASES = ['/pdf-to-powerpoint'] as const;

export const TOOL_ROUTES = [
  ...PHASE1_TOOL_ROUTES,
  ...PHASE2_TOOL_ROUTES,
  ...PHASE3_TOOL_ROUTES,
] as const;

export const SITEMAP_TOOL_ROUTES = [
  ...TOOL_ROUTES,
  ...TOOL_ROUTE_ALIASES,
] as const;

export type ToolRoute = (typeof TOOL_ROUTES)[number];

export const TOOL_NAV = [
  { href: '/merge-pdf', label: 'Merge' },
  { href: '/split-pdf', label: 'Split' },
  { href: '/compress-pdf', label: 'Compress' },
  { href: '/protect-pdf', label: 'Protect' },
  { href: '/sign-pdf', label: 'Sign' },
  { href: '/pdf-to-jpg', label: 'PDF → JPG' },
  { href: '/crop-pdf', label: 'Crop' },
  { href: '/annotate-pdf', label: 'Annotate' },
  { href: '/pdf-to-excel', label: 'PDF → Excel' },
  { href: '/office-to-pdf', label: 'Office → PDF' },
  { href: '/redact-pdf', label: 'Redact' },
] as const;
