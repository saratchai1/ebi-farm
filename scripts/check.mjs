import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const walk = async directory => (await Promise.all((await readdir(directory, { withFileTypes: true })).map(async item => item.isDirectory() ? walk(path.join(directory, item.name)) : path.join(directory, item.name)))).flat();
const files = (await Promise.all(['src', 'scripts', 'tests'].map(directory => walk(path.join(root, directory))))).flat();
let checked = 0;
for (const file of files.filter(file => /\.(m?js)$/.test(file))) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  const text = await readFile(file, 'utf8');
  for (const match of text.matchAll(/(?:from\s+|import\s*)['"](\.\.?\/[^'"]+)['"]/g)) await access(path.resolve(path.dirname(file), match[1]));
  checked++;
}
const html = await readFile(path.join(root, 'index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) if (!/^(https?:|data:)/.test(match[1])) await access(path.resolve(root, match[1]));
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
if (new Set(ids).size !== ids.length) throw new Error('Duplicate HTML IDs');
const app = await readFile(path.join(root, 'src/app.js'), 'utf8');
for (const match of app.matchAll(/\$\(['"]#([^'" ]+)['"]\)/g)) if (!ids.includes(match[1])) throw new Error(`Missing app element: ${match[1]}`);
console.log(`Checked ${checked} JavaScript modules, local imports, HTML resources, and app element IDs.`);
