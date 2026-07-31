export type OverlayKind =
  | 'signature'
  | 'text'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'freehand'
  | 'watermark'
  | 'pageNumber'
  | 'highlight'
  | 'stickyNote'
  | 'pageComment'
  | 'link'
  | 'callout';

/** Normalized page coords: origin bottom-left, units = PDF points. */
export interface OverlayBase {
  id: string;
  kind: OverlayKind;
  /** 1-based page; 0 = all pages for watermark/pageNumber */
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
}

export interface SignatureOverlay extends OverlayBase {
  kind: 'signature';
  /** data URL png/jpeg or empty when using textMode */
  imageDataUrl?: string;
  text?: string;
}

export interface TextOverlay extends OverlayBase {
  kind: 'text';
  text: string;
  fontSize: number;
  color: string;
}

export interface ShapeOverlay extends OverlayBase {
  kind: 'rect' | 'ellipse' | 'line' | 'arrow';
  stroke: string;
  fill?: string;
  strokeWidth: number;
}

export interface FreehandOverlay extends OverlayBase {
  kind: 'freehand';
  points: Array<{ x: number; y: number }>;
  stroke: string;
  strokeWidth: number;
}

export interface WatermarkOverlay extends OverlayBase {
  kind: 'watermark';
  text?: string;
  imageDataUrl?: string;
  fontSize: number;
  color: string;
  tile: boolean;
  belowContent: boolean;
  pageFrom: number;
  pageTo: number;
}

export interface PageNumberOverlay extends OverlayBase {
  kind: 'pageNumber';
  format: 'n' | 'n_of_N' | 'roman';
  prefix: string;
  suffix: string;
  startAt: number;
  fontSize: number;
  color: string;
  position: 'header' | 'footer';
  align: 'left' | 'center' | 'right';
}

export interface HighlightQuad {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HighlightOverlay extends OverlayBase {
  kind: 'highlight';
  color: string;
  /** Optional multi-quad highlight; otherwise use x,y,width,height. */
  quads?: HighlightQuad[];
}

export interface StickyNoteOverlay extends OverlayBase {
  kind: 'stickyNote';
  text: string;
  color: string;
  author?: string;
}

export interface PageCommentOverlay extends OverlayBase {
  kind: 'pageComment';
  text: string;
}

export interface LinkOverlay extends OverlayBase {
  kind: 'link';
  uri: string;
  /** Optional source marker: 'existing' for pre-existing PDF links, 'new' for user-added. */
  source?: 'existing' | 'new';
}

export interface CalloutOverlay extends OverlayBase {
  kind: 'callout';
  text: string;
  fontSize?: number;
  color?: string;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  /** Optional leader tip in page coords. */
  leaderX?: number;
  leaderY?: number;
}

export type OverlayItem =
  | SignatureOverlay
  | TextOverlay
  | ShapeOverlay
  | FreehandOverlay
  | WatermarkOverlay
  | PageNumberOverlay
  | HighlightOverlay
  | StickyNoteOverlay
  | PageCommentOverlay
  | LinkOverlay
  | CalloutOverlay;

export function createId(): string {
  return `ov-${Math.random().toString(36).slice(2, 10)}`;
}

export const WATERMARK_PRESETS = [
  'Confidential',
  'Draft',
  'Copy',
  'Approved',
] as const;

export function toRoman(n: number): string {
  const map: Array<[number, string]> = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let num = Math.max(1, Math.floor(n));
  let out = '';
  for (const [v, s] of map) {
    while (num >= v) {
      out += s;
      num -= v;
    }
  }
  return out;
}

export function formatPageNumber(
  overlay: PageNumberOverlay,
  pageIndex0: number,
  totalPages: number
): string {
  const n = overlay.startAt + pageIndex0;
  let body = String(n);
  if (overlay.format === 'n_of_N') body = `${n} of ${totalPages}`;
  if (overlay.format === 'roman') body = toRoman(n);
  return `${overlay.prefix}${body}${overlay.suffix}`;
}
