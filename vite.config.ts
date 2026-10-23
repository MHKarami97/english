import { copyFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { APP_DESCRIPTION, APP_NAME } from './src/config/app';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8')) as { version: string };

function htmlAppName(): Plugin {
  return {
    name: 'html-app-name',
    transformIndexHtml: (html) =>
      html.replaceAll('%APP_NAME%', APP_NAME).replaceAll('%APP_DESCRIPTION%', APP_DESCRIPTION),
  };
}

// GitHub Pages serves 404.html for unknown paths, which lets deep links reach the SPA router.
function spaFallback404(): Plugin {
  let outDir = 'dist';
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html'));
    },
  };
}

const mediaCache = (cacheName: string, pattern: RegExp, maxEntries: number) => ({
  urlPattern: ({ url, sameOrigin }: { url: URL; sameOrigin: boolean }) =>
    sameOrigin && pattern.test(url.pathname),
  handler: 'CacheFirst' as const,
  options: {
    cacheName,
    cacheableResponse: { statuses: [200] },
    expiration: { maxEntries, maxAgeSeconds: 60 * 60 * 24 * 90, purgeOnQuotaError: true },
  },
});

export default defineConfig({
  base: '/',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { target: 'es2022' },
  plugins: [
    vue(),
    tailwindcss(),
    htmlAppName(),
    spaFallback404(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        id: '/',
        name: APP_NAME,
        short_name: APP_NAME,
        description: APP_DESCRIPTION,
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f6f1e7',
        theme_color: '#f6f1e7',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,svg}', 'icons/*.png'],
        globIgnores: ['data/**'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/data\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }: { url: URL; sameOrigin: boolean }) =>
              sameOrigin && /\/data\/(books|[^/]+\/data)\.json$/.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'lexi-content-json',
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 32 },
            },
          },
          {
            ...mediaCache('lexi-audio', /\/audio\/.+\.(mp3|ogg|m4a|wav)$/i, 1500),
            options: {
              ...mediaCache('lexi-audio', /x/, 1500).options,
              rangeRequests: true,
            },
          },
          mediaCache('lexi-images', /\/images\/.+\.(jpe?g|png|webp|avif|gif)$/i, 2500),
        ],
      },
    }),
  ],
});
