import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const outDir = 'public/fonts';
await mkdir(outDir, { recursive: true });

async function find(packageDir, test) {
  const entries = await readdir(packageDir, { recursive: true });
  const match = entries.find(test);
  if (!match) throw new Error(`No matching file in ${packageDir}`);
  return join(packageDir, match);
}

async function copy(packageDir, test, target) {
  await copyFile(await find(packageDir, test), join(outDir, target));
  console.log(`copied -> ${join(outDir, target)}`);
}

const vazirmatn = 'node_modules/vazirmatn';
await copy(vazirmatn, (f) => /Vazirmatn.*\[wght\]\.woff2$/.test(f), 'Vazirmatn-Variable.woff2');
await copy(vazirmatn, (f) => /(^|[\\/])(OFL|LICENSE)(\.txt|\.md)?$/i.test(f), 'Vazirmatn-LICENSE.txt');

const serif = 'node_modules/@fontsource-variable/source-serif-4';
await copy(serif, (f) => /source-serif-4-latin-wght-normal\.woff2$/.test(f), 'SourceSerif4-latin.woff2');
await copy(serif, (f) => /source-serif-4-latin-ext-wght-normal\.woff2$/.test(f), 'SourceSerif4-latin-ext.woff2');
await copy(serif, (f) => /^LICENSE(\.txt|\.md)?$/i.test(f), 'SourceSerif4-LICENSE.txt');
