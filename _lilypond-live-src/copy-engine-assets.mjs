import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const source = resolve(root, 'node_modules/@sightread/lilypond-wasm/dist');
const destination = resolve(root, 'dist/engine');
await mkdir(destination, { recursive: true });
await Promise.all([
  copyFile(resolve(source, 'lilypond.wasm'), resolve(destination, 'lilypond.wasm')),
  copyFile(resolve(source, 'runtime.data.bin'), resolve(destination, 'runtime.data.bin')),
]);