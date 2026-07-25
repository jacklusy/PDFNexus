export { COLOR_PALETTE, DEFAULT_SLATE_COLOR, getColorOption, assignDistinctColors } from './colorPalette';
export type { ColorOption } from './colorPalette';
export {
  parseUploadedFile,
  parsePDFFile,
  parseImageFile,
  renderPageThumbnail,
  renderPageThumbnailOnDemand,
  renderPageHighResPreview,
  renderThumbnailsForPages,
  mergePDFPages,
  getPDFDocumentProxy,
  ensurePdfWorker,
  evictFileCaches,
  clearAllPdfCaches,
  revokeObjectUrl,
  trackObjectUrl,
  onThumbnailCacheEvict,
} from './pdfHelpers';
export { convertPDFToDocx } from './pdfToDocx';
export type { ConvertOptions } from './pdfToDocx';
export {
  buildWorkspaceManifest,
  persistWorkspaceManifest,
  loadWorkspaceManifest,
  clearWorkspaceManifest,
  downloadManifestJson,
} from './workspaceRecovery';
export type {
  WorkspaceManifest,
  WorkspaceManifestFile,
  WorkspaceManifestPage,
} from './workspaceRecovery';
