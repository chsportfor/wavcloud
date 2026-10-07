import fs from 'node:fs';
import path from 'node:path';

export const project = path.resolve(import.meta.dirname, '..');
const sourceRoot = path.join(project, 'web-src');
const styleFiles = ['base.css', 'clean-ui.css', 'cloud-dark.css', 'library-feedback.css'];
const sharedScripts = [
  'dom-safety.js', 'library-data.js', 'api-client.js', 'offline-store.js',
  'runtime-support.js', 'audio-player.js', 'login-view.js', 'ui-primitives.js',
  'artwork.js', 'artwork-view.js', 'library-ui.js', 'library-view.js',
  'player-view.js', 'mini-player-view.js', 'cloud-dark.js', 'library-feedback.js',
  'upload-dialog.js'
];

export function readArtworkCatalog() {
  const entries = JSON.parse(fs.readFileSync(path.join(project, 'artwork-catalog.json'), 'utf8'));
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

export function buildWebSource(target = 'android') {
  if (!['android', 'web'].includes(target)) throw new Error(`Unknown target: ${target}`);
  const scripts = [...sharedScripts];
  if (target === 'android') scripts.push('android-player.js');
  scripts.push('playback-runtime.js', 'app-controller.js');
  if (target === 'android') scripts.push('native-offline.js');
  let js = scripts.map(file => fs.readFileSync(path.join(sourceRoot, 'scripts', file), 'utf8')).join('');
  const token = '__WAVCLOUD_ARTWORK_CATALOG__';
  if (!js.includes(token)) throw new Error('Artwork catalog token is missing');
  js = js.replace(token, JSON.stringify(readArtworkCatalog(), null, 2));
  return {
    css: styleFiles.map(file => fs.readFileSync(path.join(sourceRoot, 'styles', file), 'utf8')).join(''),
    js,
    bootstrap: fs.readFileSync(path.join(sourceRoot, 'scripts', 'bootstrap.js'), 'utf8')
  };
}
