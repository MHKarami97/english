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

// دامنه هدف برای فایل‌های استاتیک
const ASSET_DOMAIN = 'mhkarami97.github.io';

// Regex ها را برای هماهنگی با مسیرهای جدید روی دامنه گیت‌هاب آپدیت می‌کنیم
const AUDIO_PATH = /\/data\/old-books\/[^/]+\/audio\/.+\.(mp3|ogg|m4a|wav)$/i;
const IMAGE_PATH = /\/data\/old-books\/[^/]+\/images\/.+\.(jpe?g|png|webp|avif|gif|svg)$/i;
// فرض می‌کنیم books.json همچنان روی دامنه اصلی سرو می‌شود (sameOrigin) 
// و data.json / media-manifest.json از گیت‌هاب می‌آیند. 
// برای تفکیک بهتر، Regex را برای هر دو سناریو تنظیم می‌کنیم.
const LOCAL_CONTENT_PATH = /\/data\/books\.json$/;
const EXTERNAL_CONTENT_PATH = /\/data\/old-books\/[^/]+\/(data|media-manifest)\.json$/;

const THIRTY_DAYS = 60 * 60 * 24 * 30;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
clientsClaim();

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

// 1. Network Only for downloads
registerRoute(({ request }) => request.headers.has(DOWNLOAD_REQUEST_HEADER), new NetworkOnly());

// 2. Audio Cache (Cross-Origin Support)
registerRoute(
  // بررسی می‌کنیم که آیا درخواست به دامنه گیت‌هاب است و مسیر با الگو مطابقت دارد
  ({ url }) => url.hostname === ASSET_DOMAIN && AUDIO_PATH.test(url.pathname),
  new CacheFirst({
    cacheName: CacheName.media,
    plugins: [
      new RangeRequestsPlugin(), 
      // اضافه کردن status 0 برای پشتیبانی از پاسخ‌های Opaque در درخواست‌های Cross-Origin
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      { cacheWillUpdate: async () => null }
    ],
  }),
);

// 3. Images Cache (Cross-Origin Support)
const viewedImages = new CacheFirst({
  cacheName: CacheName.imagesOpportunistic,
  plugins: [
    // پشتیبانی از status 0 برای تصاویر Cross-Origin
    new CacheableResponsePlugin({ statuses: [0, 200] }),
    new ExpirationPlugin({ maxEntries: 400, maxAgeSeconds: THIRTY_DAYS, purgeOnQuotaError: true }),
  ],
});

const imageHandler: RouteHandlerCallback = async (options) => {
  const downloads = await caches.open(CacheName.media);
  return (await downloads.match(options.request.url)) ?? viewedImages.handle(options);
};

registerRoute(
  ({ url }) => url.hostname === ASSET_DOMAIN && IMAGE_PATH.test(url.pathname), 
  imageHandler
);

// 4. Content (JSON) Cache
// 4.1 local books.json
registerRoute(
  ({ url, sameOrigin }) => sameOrigin && LOCAL_CONTENT_PATH.test(url.pathname),
  new NetworkFirst({
    cacheName: CacheName.content,
    networkTimeoutSeconds: 4,
    plugins: [new CacheableResponsePlugin({ statuses: [200] })],
  }),
);

// 4.2 External data.json & media-manifest.json
registerRoute(
  ({ url }) => url.hostname === ASSET_DOMAIN && EXTERNAL_CONTENT_PATH.test(url.pathname),
  new NetworkFirst({
    cacheName: CacheName.content,
    networkTimeoutSeconds: 4,
    // در درخواست‌های CORS مبتنی بر fetch که با mode: 'cors' ارسال می‌شوند، وضعیت 200 برمی‌گردد
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
  }),
);

// 5. App Shell Navigation
registerRoute(
new NavigationRoute(createHandlerBoundToURL('/index.html'), {
  denylist: [
    /^\/data\//,
    /^\/\.well-known\//,
    /\/[^/?]+\.[a-z0-9]+$/i,
  ],
}),
);