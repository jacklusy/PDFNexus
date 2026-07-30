/**
 * Thin Google Picker wrapper for drive.file-scoped PDF selection.
 * Loads the gapi picker script once, then opens a PDF-only DocsView.
 */

export interface PickedDriveFile {
  id: string;
  name: string;
  mimeType?: string;
  sizeBytes?: number;
}

export interface OpenGooglePdfPickerOptions {
  clientId: string;
  accessToken: string;
  developerKey?: string;
}

declare global {
  interface Window {
    gapi?: {
      load: (name: string, cb: () => void) => void;
    };
    google?: {
      picker?: {
        PickerBuilder: new () => GooglePickerBuilder;
        DocsView: new (viewId?: string) => GoogleDocsView;
        ViewId: { DOCS: string; PDFS?: string };
        Feature: { NAV_HIDDEN: string; MULTISELECT_ENABLED: string };
        Action: { PICKED: string; CANCEL: string };
        Document?: { ID: string; NAME: string; MIME_TYPE: string; SIZE_BYTES: string };
      };
    };
  }
}

interface GoogleDocsView {
  setMimeTypes: (mime: string) => GoogleDocsView;
  setIncludeFolders: (v: boolean) => GoogleDocsView;
  setSelectFolderEnabled: (v: boolean) => GoogleDocsView;
}

interface GooglePickerBuilder {
  addView: (view: GoogleDocsView) => GooglePickerBuilder;
  setOAuthToken: (token: string) => GooglePickerBuilder;
  setDeveloperKey: (key: string) => GooglePickerBuilder;
  setAppId: (id: string) => GooglePickerBuilder;
  setCallback: (cb: (data: GooglePickerResponse) => void) => GooglePickerBuilder;
  setTitle: (title: string) => GooglePickerBuilder;
  build: () => { setVisible: (v: boolean) => void };
}

interface GooglePickerResponse {
  action: string;
  docs?: Array<{
    id: string;
    name: string;
    mimeType?: string;
    sizeBytes?: number;
  }>;
}

const PICKER_SCRIPT = 'https://apis.google.com/js/api.js';

let scriptPromise: Promise<void> | null = null;

function loadPickerScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Picker requires a browser'));
  }
  if (window.gapi?.load) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${PICKER_SCRIPT}"]`
    );
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () =>
        reject(new Error('Failed to load Google API script'))
      );
      if (window.gapi?.load) resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = PICKER_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error('Failed to load Google API script (CSP or network)'));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

function loadPickerApi(): Promise<void> {
  return loadPickerScript().then(
    () =>
      new Promise((resolve, reject) => {
        if (!window.gapi?.load) {
          reject(new Error('Google API failed to initialize'));
          return;
        }
        window.gapi.load('picker', () => resolve());
      })
  );
}

/**
 * Opens Google Picker for PDFs. Resolves with the first picked file, or null if cancelled.
 */
export async function openGooglePdfPicker(
  options: OpenGooglePdfPickerOptions
): Promise<PickedDriveFile | null> {
  await loadPickerApi();

  const pickerNs = window.google?.picker;
  if (!pickerNs) {
    throw new Error('Google Picker API unavailable');
  }

  return new Promise((resolve, reject) => {
    try {
      const view = new pickerNs.DocsView(pickerNs.ViewId.DOCS)
        .setMimeTypes('application/pdf')
        .setIncludeFolders(false)
        .setSelectFolderEnabled(false);

      const builder = new pickerNs.PickerBuilder()
        .addView(view)
        .setOAuthToken(options.accessToken)
        .setTitle('Select a PDF')
        .setCallback((data: GooglePickerResponse) => {
          if (data.action === pickerNs.Action.CANCEL) {
            resolve(null);
            return;
          }
          if (data.action === pickerNs.Action.PICKED) {
            const doc = data.docs?.[0];
            if (!doc?.id) {
              resolve(null);
              return;
            }
            resolve({
              id: doc.id,
              name: doc.name || 'document.pdf',
              mimeType: doc.mimeType,
              sizeBytes: doc.sizeBytes,
            });
          }
        });

      if (options.developerKey) {
        builder.setDeveloperKey(options.developerKey);
      }

      builder.build().setVisible(true);
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}
