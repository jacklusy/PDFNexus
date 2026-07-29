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

export const TOOL_ROUTES = [
  ...PHASE1_TOOL_ROUTES,
  ...PHASE2_TOOL_ROUTES,
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
] as const;
