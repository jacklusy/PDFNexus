import { loadReadablePdf, assertPdfReadable } from '../assertPdfReadable';
import { getPdfToolkit } from '../protect/pdfToolkit';

/** Shown in UI before the user confirms flatten. */
export const FLATTEN_WARNING =
  'Flattening permanently merges form fields and annotations into page content. The result is no longer editable as forms or annotations. This cannot be undone.';

export interface FlattenPdfResult {
  bytes: Uint8Array;
  formsFlattened: boolean;
  annotationsFlattened: boolean;
  warning: string;
  /** Set when annotation flatten was attempted but failed. */
  annotationError?: string;
}

/** Fail-closed: refuse download unless user opts into forms-only partial export. */
export function shouldRefuseFlattenDownload(
  result: Pick<FlattenPdfResult, 'annotationError' | 'annotationsFlattened'>,
  allowPartialFormsOnly: boolean
): boolean {
  return (
    Boolean(result.annotationError) &&
    !result.annotationsFlattened &&
    !allowPartialFormsOnly
  );
}

/**
 * Flatten AcroForm fields (pdf-lib) then annotations (pdfstudio / qpdf) when available.
 * Encrypted inputs are refused via loadReadablePdf / assertPdfReadable.
 */
export async function flattenPdf(bytes: ArrayBuffer): Promise<FlattenPdfResult> {
  const doc = await loadReadablePdf(bytes);
  let formsFlattened = false;
  try {
    const form = doc.getForm();
    if (form.getFields().length > 0) {
      form.flatten();
      formsFlattened = true;
    }
  } catch {
    // No AcroForm or flatten unsupported — continue to annotation pass
  }
  let working = await doc.save();

  let annotationsFlattened = false;
  let annotationError: string | undefined;
  try {
    const ab = working.buffer.slice(
      working.byteOffset,
      working.byteOffset + working.byteLength
    ) as ArrayBuffer;
    await assertPdfReadable(ab);
    const toolkit = await getPdfToolkit();
    working = await toolkit.flatten(working, { annotations: 'all' });
    annotationsFlattened = true;
  } catch (err) {
    annotationError =
      err instanceof Error ? err.message : 'Annotation flatten failed';
  }

  return {
    bytes: working,
    formsFlattened,
    annotationsFlattened,
    warning: FLATTEN_WARNING,
    annotationError,
  };
}
