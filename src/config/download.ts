export const DOWNLOAD_CONCURRENCY = 4;

/** Part of the free space that is never planned for, because navigator.storage.estimate() is only an estimate. */
export const STORAGE_SAFETY_MARGIN = 0.2;

/** Downloads larger than this ask for confirmation first. */
export const CONFIRM_THRESHOLD_BYTES = 50 * 1024 * 1024;

/** The UI never needs more than about ten progress updates per second. */
export const UI_THROTTLE_MS = 100;

/** Unit records are written in batches, not per file. */
export const RECORD_FLUSH_MS = 1000;

export const BACKUP_REMINDER_DAYS = 14;
