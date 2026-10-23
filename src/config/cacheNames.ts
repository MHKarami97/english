export const CacheName = {
  /** Explicitly downloaded audio and images. Never touched by an expiration plugin. */
  media: 'lexi-media-v1',
  /** Images that were viewed but not downloaded. Bounded. */
  imagesOpportunistic: 'lexi-img-opportunistic-v1',
  /** books.json, data.json and media manifests. */
  content: 'lexi-content-v1',
} as const;

/** Every cache this app owns starts with this prefix; anything else with it that is not listed is obsolete. */
export const APP_CACHE_PREFIX = 'lexi-';

export const CURRENT_CACHES: readonly string[] = Object.values(CacheName);

/** Stored on every downloaded response so a file can be checked without reading its body. */
export const MEDIA_HASH_HEADER = 'x-lexi-hash';
export const MEDIA_BYTES_HEADER = 'x-lexi-bytes';

/** Marks the app's own download requests so the service worker sends them straight to the network. */
export const DOWNLOAD_REQUEST_HEADER = 'x-lexi-download';
