import { cp, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.join(root, 'dist');
await stat(path.join(root, 'index.html'));
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const name of ['index.html', 'src', 'assets']) await cp(path.join(root, name), path.join(destination, name), { recursive: true });
console.log('Built self-contained static application in dist/. No external services required.');
