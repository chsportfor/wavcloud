import fs from 'node:fs';
import path from 'node:path';

const project = path.resolve(import.meta.dirname, '..');
const sourceRoot = path.join(project, 'web-src');
const output = path.join(project, 'app', 'src', 'main', 'assets', 'app.html');
const catalogPath = path.join(project, 'artwork-catalog.json');

const styleFiles = [
  'styles/base.css',
  'styles/clean-ui.css',
  'styles/cloud-dark.css'
];

const scriptFiles = [
  'scripts/dom-safety.js',
  'scripts/runtime.js',
  'scripts/ui-primitives.js',
  'scripts/artwork.js',
  'scripts/library-view.js',
  'scripts/player-view.js',
  '../tools/native-bridge.js',
  'scripts/cloud-dark.js',
  'scripts/bootstrap.js'
];

const STYLE_TOKEN = '<!-- WAVCLOUD_STYLES -->';
const SCRIPT_TOKEN = '/* WAVCLOUD_SCRIPTS */';
const CATALOG_TOKEN = '__WAVCLOUD_ARTWORK_CATALOG__';

function readArtworkCatalog() {
  const entries = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  if (!Array.isArray(entries)) throw new Error('artwork-catalog.json must contain an array');
  const catalog = {};
  for (const entry of entries) {
    const key = `${entry.category}///${entry.album}`;
    if (!entry.category || !entry.album || typeof entry.url !== 'string' || !/^https:\/\//i.test(entry.url)) {
      throw new Error(`Invalid artwork catalog entry: ${key}`);
    }
    if (catalog[key]) throw new Error(`Duplicate artwork catalog entry: ${key}`);
    if (entry.width != null && entry.height != null && Math.min(entry.width, entry.height) < 600) {
      throw new Error(`Artwork is below 600px: ${key}`);
    }
    catalog[key] = entry.url;
  }
  return catalog;
}

function build() {
  const template = fs.readFileSync(path.join(sourceRoot, 'document.html'), 'utf8');
  if (!template.includes(STYLE_TOKEN) || !template.includes(SCRIPT_TOKEN)) {
    throw new Error('web-src/document.html is missing a build token');
  }
  const css = styleFiles.map(file => fs.readFileSync(path.join(sourceRoot, file), 'utf8')).join('');
  let js = scriptFiles.map(file => fs.readFileSync(path.join(sourceRoot, file), 'utf8')).join('');
  const catalog = readArtworkCatalog();
  if (!js.includes(CATALOG_TOKEN)) throw new Error('The artwork catalog token is missing from web-src');
  js = js.replace(CATALOG_TOKEN, JSON.stringify(catalog, null, 2));
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
fs.writeFileSync(output, generated);
console.log(`Generated ${path.relative(project, output)} from web-src`);
