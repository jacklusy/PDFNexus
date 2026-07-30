/** Shared import/export size cap for all cloud providers (Drive, Dropbox, OneDrive). */
export const MAX_CLOUD_FILE_BYTES = 50 * 1024 * 1024;

/** @deprecated Prefer MAX_CLOUD_FILE_BYTES — kept for Drive call sites. */
export const MAX_DRIVE_FILE_BYTES = MAX_CLOUD_FILE_BYTES;
