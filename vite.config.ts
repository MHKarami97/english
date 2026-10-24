import { copyFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { APP_DESCRIPTION, APP_NAME } from './src/config/app';
import { mediaManifest } from './build/mediaManifestPlugin';

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

export default defineConfig({
  base: '/',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { target: 'es2022' },
  plugins: [
    vue(),
    tailwindcss(),
    // Precompiles the catalogs so the runtime-only vue-i18n build ships (no message compiler in the bundle).
    VueI18nPlugin({ include: [fileURLToPath(new URL('./src/locales/**', import.meta.url))] }),
    htmlAppName(),
    spaFallback404(),
    mediaManifest(),
    VitePWA({
      // injectManifest: the media routes need a two-cache lookup, a never-evict download cache and
      // cache cleanup on activation, which generateSW cannot express.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        id: '/',
        name: APP_NAME,
        short_name: APP_NAME,
        description: APP_DESCRIPTION,
        lang: 'fa',
        dir: 'rtl',
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
      injectManifest: {
        rollupFormat: 'iife',
        globPatterns: ['**/*.{js,css,html,woff2,svg}', 'icons/*.png'],
        globIgnores: ['data/**'],
      },
    }),
  ],
});
