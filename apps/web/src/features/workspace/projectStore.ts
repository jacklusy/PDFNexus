/**
 * IndexedDB wrapper for continuous workspace sessions (`pdfnexus-project` DB).
 */

const DB_NAME = 'pdfnexus-project';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_SETTINGS = 'settings';
const STORE_BLOBS = 'blobs';

/** Soft cap for stored file blobs (bytes). */
export const MAX_PROJECT_BLOB_BYTES = 50 * 1024 * 1024;

export interface ProjectRecord {
  id: string;
  name: string;
  settings: Record<string, unknown>;
  updatedAt: number;
}

export class ProjectStoreQuotaWarning extends Error {
  readonly totalBytes: number;
  constructor(totalBytes: number) {
    super(
      `Project storage would exceed ${Math.round(MAX_PROJECT_BLOB_BYTES / (1024 * 1024))}MB (currently ~${Math.round(totalBytes / (1024 * 1024))}MB).`
    );
    this.name = 'ProjectStoreQuotaWarning';
    this.totalBytes = totalBytes;
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open project DB'));
  });
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

export async function saveProject(project: ProjectRecord): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_PROJECTS, 'readwrite');
    tx.objectStore(STORE_PROJECTS).put({
      ...project,
      updatedAt: project.updatedAt || Date.now(),
    });
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function loadProject(id: string): Promise<ProjectRecord | null> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_PROJECTS, 'readonly');
    const row = await idbReq<ProjectRecord | undefined>(
      tx.objectStore(STORE_PROJECTS).get(id)
    );
    await txDone(tx);
    return row ?? null;
  } finally {
    db.close();
  }
}

export async function clearProject(id?: string): Promise<void> {
  const db = await openDb();
  try {
    if (!id) {
      const tx = db.transaction(
        [STORE_PROJECTS, STORE_SETTINGS, STORE_BLOBS],
        'readwrite'
      );
      tx.objectStore(STORE_PROJECTS).clear();
      tx.objectStore(STORE_SETTINGS).clear();
      tx.objectStore(STORE_BLOBS).clear();
      await txDone(tx);
      return;
    }

    // Load blob ids first (separate readonly tx), then delete.
    const readTx = db.transaction([STORE_PROJECTS, STORE_BLOBS], 'readonly');
    const blobs = await idbReq<Array<{ id: string; projectId?: string }>>(
      readTx.objectStore(STORE_BLOBS).getAll()
    );
    await txDone(readTx);

    const toDelete = blobs
      .filter((row) => row.projectId === id || row.id.startsWith(`${id}:`))
      .map((row) => row.id);

    const writeTx = db.transaction([STORE_PROJECTS, STORE_BLOBS], 'readwrite');
    writeTx.objectStore(STORE_PROJECTS).delete(id);
    for (const blobId of toDelete) {
      writeTx.objectStore(STORE_BLOBS).delete(blobId);
    }
    await txDone(writeTx);
  } finally {
    db.close();
  }
}

export async function saveSetting(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_SETTINGS, 'readwrite');
    tx.objectStore(STORE_SETTINGS).put({ key, value });
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function loadSetting<T = unknown>(key: string): Promise<T | null> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_SETTINGS, 'readonly');
    const row = await idbReq<{ key: string; value: T } | undefined>(
      tx.objectStore(STORE_SETTINGS).get(key)
    );
    await txDone(tx);
    return row ? row.value : null;
  } finally {
    db.close();
  }
}

export async function totalBlobBytes(): Promise<number> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_BLOBS, 'readonly');
    const all = await idbReq<Array<{ size?: number; blob?: Blob }>>(
      tx.objectStore(STORE_BLOBS).getAll()
    );
    await txDone(tx);
    return all.reduce((sum, row) => {
      if (typeof row.size === 'number') return sum + row.size;
      if (row.blob) return sum + row.blob.size;
      return sum;
    }, 0);
  } finally {
    db.close();
  }
}

/**
 * Store a file blob. Throws ProjectStoreQuotaWarning if total would exceed 50MB.
 */
export async function saveFileBlob(
  id: string,
  blob: Blob,
  projectId?: string
): Promise<void> {
  const db = await openDb();
  try {
    // Subtract existing row size so re-persisting the same id does not double-count.
    const readTx = db.transaction(STORE_BLOBS, 'readonly');
    const existing = await idbReq<{ size?: number } | undefined>(
      readTx.objectStore(STORE_BLOBS).get(id)
    );
    await txDone(readTx);
    const oldSize = existing?.size ?? 0;

    const current = await totalBlobBytes();
    const next = current - oldSize + blob.size;
    if (next > MAX_PROJECT_BLOB_BYTES) {
      throw new ProjectStoreQuotaWarning(next);
    }

    const writeTx = db.transaction(STORE_BLOBS, 'readwrite');
    writeTx.objectStore(STORE_BLOBS).put({
      id,
      projectId,
      blob,
      size: blob.size,
      updatedAt: Date.now(),
    });
    await txDone(writeTx);
  } finally {
    db.close();
  }
}

export async function loadFileBlob(id: string): Promise<Blob | null> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_BLOBS, 'readonly');
    const row = await idbReq<{ blob?: Blob } | undefined>(
      tx.objectStore(STORE_BLOBS).get(id)
    );
    await txDone(tx);
    return row?.blob ?? null;
  } finally {
    db.close();
  }
}
