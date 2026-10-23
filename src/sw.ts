/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import type { RouteHandlerCallback } from 'workbox-core';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { RangeRequestsPlugin } from 'workbox-range-requests';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, NetworkOnly } from 'workbox-strategies';
import { APP_CACHE_PREFIX, CURRENT_CACHES, CacheName, DOWNLOAD_REQUEST_HEADER } from './config/cacheNames';

declare let self: ServiceWorkerGlobalScope;

const AUDIO_PATH = /\/data\/[^/]+\/audio\/.+\.(mp3|ogg|m4a|wav)$/i;
const IMAGE_PATH = /\/data\/[^/]+\/images\/.+\.(jpe?g|png|webp|avif|gif|svg)$/i;
const CONTENT_PATH = /\/data\/(books\.json|[^/]+\/(data|media-manifest)\.json)$/;
const THIRTY_DAYS = 60 * 60 * 24 * 30;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
clientsClaim();

// The update prompt asks the waiting worker to take over; nothing activates behind the user's back.
self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | undefined)?.type === 'SKIP_WAITING') void self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(deleteObsoleteCaches());
});

async function deleteObsoleteCaches(): Promise<void> {
  const keep = new Set<string>(CURRENT_CACHES);
  const names = await caches.keys();
  await Promise.all(names.filter((name) => name.startsWith(APP_CACHE_PREFIX) && !keep.has(name)).map((name) => caches.delete(name)));
}

// 1. The app's own downloads fetch straight from the network. Without this, every downloaded image
//    would also be written to the opportunistic cache.
registerRoute(({ request }) => request.headers.has(DOWNLOAD_REQUEST_HEADER), new NetworkOnly());

// 2. Audio: answered from the download cache, including Range requests (needed for seeking in
//    Safari and Chrome). A miss goes to the network and is never written to any cache, because
//    audio streamed at runtime arrives as partial content.
registerRoute(
  ({ url, sameOrigin }) => sameOrigin && AUDIO_PATH.test(url.pathname),
  new CacheFirst({
    cacheName: CacheName.media,
    plugins: [new RangeRequestsPlugin(), { cacheWillUpdate: async () => null }],
  }),
);

// 3. Images: the download cache first, then a bounded cache for images that were only viewed.
const viewedImages = new CacheFirst({
  cacheName: CacheName.imagesOpportunistic,
  plugins: [
    new CacheableResponsePlugin({ statuses: [200] }),
    new ExpirationPlugin({ maxEntries: 400, maxAgeSeconds: THIRTY_DAYS, purgeOnQuotaError: true }),
  ],
});

const imageHandler: RouteHandlerCallback = async (options) => {
  const downloads = await caches.open(CacheName.media);
  return (await downloads.match(options.request.url)) ?? viewedImages.handle(options);
};

registerRoute(({ url, sameOrigin }) => sameOrigin && IMAGE_PATH.test(url.pathname), imageHandler);

// 4. books.json, data.json and the media manifests: network first, so version checks and content
//    updates see fresh bytes, and the cached copy answers offline.
registerRoute(
  ({ url, sameOrigin }) => sameOrigin && CONTENT_PATH.test(url.pathname),
  new NetworkFirst({
    cacheName: CacheName.content,
    networkTimeoutSeconds: 4,
    plugins: [new CacheableResponsePlugin({ statuses: [200] })],
  }),
);

// 5. Deep links offline: every navigation gets the app shell, except /data/ and file requests.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/data\//, /\/[^/?]+\.[a-z0-9]+$/i],
  }),
);
