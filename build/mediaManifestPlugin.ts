import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import { buildMediaManifest, type BuildResult } from './mediaManifest';

interface BookEntry {
  id: string;
  path: string;
}

interface Generated {
  readonly book: BookEntry;
  readonly result: BuildResult | null;
}

const MANIFEST_FILE = 'media-manifest.json';

/**
 * A Vite plugin (not a prebuild script) because it needs the resolved publicDir and outDir, and
 * because the same code can answer the dev server on the fly. The manifest is generated, never
 * committed, so it cannot go stale.
 */
export function mediaManifest(): Plugin {
  let config: ResolvedConfig;

  async function generate(): Promise<Generated[]> {
    const publicDir = config.publicDir;
    if (!publicDir) return [];
    let books: BookEntry[];
    try {
      books = JSON.parse(await readFile(join(publicDir, 'data', 'books.json'), 'utf8')) as BookEntry[];
    } catch {
      return [];
    }
    return Promise.all(
      books.map(async (book) => {
        const bookDir = join(publicDir, book.path);
        try {
          const text = await readFile(join(bookDir, 'data.json'), 'utf8');
          return { book, result: await buildMediaManifest(book.id, text, bookDir) };
        } catch {
          return { book, result: null };
        }
      }),
    );
  }

  return {
    name: 'lexi-media-manifest',
    configResolved(resolved) {
      config = resolved;
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = (request.url ?? '').split('?')[0] ?? '';
        if (!pathname.endsWith(`/${MANIFEST_FILE}`)) return next();
        const match = (await generate()).find(({ book }) => pathname === `/${book.path}/${MANIFEST_FILE}`);
        if (!match?.result) return next();
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify(match.result.manifest));
      });
    },
    async closeBundle() {
      if (config.command !== 'build') return;
      const outDir = resolve(config.root, config.build.outDir);
      for (const { book, result } of await generate()) {
        if (!result) {
          console.warn(`[media-manifest] ${book.id}: ${book.path}/data.json was not found, no manifest written.`);
          continue;
        }
        for (const path of result.missing) {
          console.warn(`[media-manifest] ${book.id}: data.json references ${path}, but the file does not exist.`);
        }
        const target = join(outDir, book.path, MANIFEST_FILE);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, JSON.stringify(result.manifest));
        const { files, bytes } = result.manifest.totals;
        console.info(`[media-manifest] ${book.id}: ${files} files, ${(bytes / 1024 / 1024).toFixed(1)} MB, version ${result.manifest.contentVersion}`);
      }
    },
  };
}
