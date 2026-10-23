import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { MediaFile, MediaKind, MediaManifest, UnitMedia } from '../src/domain/download/models';

interface RawWord {
  image?: string;
  sound?: string;
}

interface RawUnit {
  image?: string;
  wordlist?: RawWord[];
}

interface RawBook {
  flashcard?: RawUnit[];
}

export interface FileInfo {
  readonly bytes: number;
  readonly hash: string;
}

/** Port: lets the generator be driven by a fake file system. */
export interface FileProbe {
  probe(absolutePath: string): Promise<FileInfo | null>;
}

export class DiskFileProbe implements FileProbe {
  async probe(absolutePath: string): Promise<FileInfo | null> {
    try {
      const info = await stat(absolutePath);
      if (!info.isFile()) return null;
      const hash = await new Promise<string>((resolve, reject) => {
        const digest = createHash('sha256');
        createReadStream(absolutePath)
          .on('data', (chunk) => digest.update(chunk))
          .on('end', () => resolve(digest.digest('hex').slice(0, 16)))
          .on('error', reject);
      });
      return { bytes: info.size, hash };
    } catch {
      return null;
    }
  }
}

export interface BuildResult {
  readonly manifest: MediaManifest;
  /** Files that data.json references but that do not exist on disk. */
  readonly missing: readonly string[];
}

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');
const byPath = (a: { path: string }, b: { path: string }): number => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

/**
 * data.json is the source of truth for which unit owns which file. The output has no timestamps,
 * so the same inputs always give the same manifest and the same content version.
 */
export async function buildMediaManifest(
  bookId: string,
  dataText: string,
  bookDir: string,
  probe: FileProbe = new DiskFileProbe(),
): Promise<BuildResult> {
  const text = dataText.replace(/^\uFEFF/, '');
  const raw = JSON.parse(text) as RawBook;
  const probed = new Map<string, Promise<FileInfo | null>>();
  const probeOnce = (path: string): Promise<FileInfo | null> => {
    let pending = probed.get(path);
    if (!pending) {
      pending = probe.probe(join(bookDir, path));
      probed.set(path, pending);
    }
    return pending;
  };

  const missing = new Set<string>();
  const unique = new Map<string, MediaFile>();
  const units: UnitMedia[] = [];

  for (const [index, unit] of (raw.flashcard ?? []).entries()) {
    const references = new Map<string, MediaKind>();
    const add = (folder: string, kind: MediaKind, name: string | undefined): void => {
      if (name) references.set(`${folder}/${name}`, kind);
    };
    add('images', 'image', unit.image);
    for (const word of unit.wordlist ?? []) {
      add('images', 'image', word.image);
      add('audio', 'audio', word.sound);
    }

    const resolved = await Promise.all(
      [...references].map(async ([path, kind]) => ({ path, kind, info: await probeOnce(path) })),
    );
    const files: MediaFile[] = [];
    for (const { path, kind, info } of resolved.sort(byPath)) {
      if (!info) {
        missing.add(path);
        continue;
      }
      const file: MediaFile = { path, kind, bytes: info.bytes, hash: info.hash };
      files.push(file);
      unique.set(path, file);
    }
    units.push({ unitId: `${bookId}:${index + 1}`, bytes: files.reduce((sum, file) => sum + file.bytes, 0), files });
  }

  const all = [...unique.values()].sort(byPath);
  const dataHash = sha256(text);
  const contentVersion = sha256([dataHash, ...all.map((file) => `${file.path}:${file.bytes}:${file.hash}`)].join('\n')).slice(0, 16);
  const manifest: MediaManifest = {
    bookId,
    contentVersion,
    dataHash,
    totals: { files: all.length, bytes: all.reduce((sum, file) => sum + file.bytes, 0) },
    units,
  };
  return { manifest, missing: [...missing].sort() };
}
