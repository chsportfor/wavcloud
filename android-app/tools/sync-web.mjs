import fs from 'node:fs';
import path from 'node:path';
import { buildWebSource, readArtworkCatalog } from './web-source.mjs';

const project = path.resolve(import.meta.dirname, '..');
const sourceRoot = path.join(project, 'web-src');
const output = path.join(project, 'app', 'src', 'main', 'assets', 'app.html');

const STYLE_TOKEN = '<!-- WAVCLOUD_STYLES -->';
const SCRIPT_TOKEN = '/* WAVCLOUD_SCRIPTS */';

function build() {
  const template = fs.readFileSync(path.join(sourceRoot, 'document.html'), 'utf8');
  if (!template.includes(STYLE_TOKEN) || !template.includes(SCRIPT_TOKEN)) {
    throw new Error('web-src/document.html is missing a build token');
  }
  const { css, js: shared, bootstrap } = buildWebSource('android');
  const js = shared + bootstrap;
  return template.replace(STYLE_TOKEN, css).replace(SCRIPT_TOKEN, js);
}

const command = process.argv[2] || '--write';
if (command === '--export-catalog') {
  const destination = process.argv[3] || path.resolve(project, '..', 'outputs', 'artwork-catalog.json');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, `${JSON.stringify(readArtworkCatalog(), null, 2)}\n`);
  console.log(`Exported artwork catalog to ${destination}`);
  process.exit(0);
}

const generated = build();
if (command === '--check') {
  const current = fs.readFileSync(output, 'utf8');
  if (current !== generated) {
    console.error('app.html is stale. Run: node android-app/tools/sync-web.mjs');
    process.exit(1);
  }
  console.log('app.html matches web-src exactly');
  process.exit(0);
}

if (command !== '--write') throw new Error(`Unknown option: ${command}`);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, generated);
console.log(`Generated ${path.relative(project, output)} from web-src`);
