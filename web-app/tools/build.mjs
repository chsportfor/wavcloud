import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { buildWebSource, readArtworkCatalog } from '../../android-app/tools/web-source.mjs';
import { createIcon } from './icons.mjs';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const hash = value => crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const shared = buildWebSource('web');
const css = shared.css + '\n' + read('styles/desktop.css');
const js = shared.js + '\n' + read('scripts/desktop.js') + '\n' + shared.bootstrap + '\n' + read('scripts/pwa.js');
const jsPath = `/assets/wavcloud-${hash(js)}.js`;
const cssPath = `/assets/wavcloud-${hash(css)}.css`;
const html = read('document.html').replace('__WAVCLOUD_CSS__', cssPath).replace('__WAVCLOUD_JS__', jsPath);
const manifest = read('manifest.webmanifest');
const icon = read('icons/icon.svg');
const swTemplate = read('service-worker.js');
const icon192 = createIcon(192), icon512 = createIcon(512);
const version = hash(Buffer.concat([Buffer.from(html + js + css + manifest + icon + swTemplate), icon192, icon512]));
const shellFiles = ['/index.html', jsPath, cssPath, '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png'];
const sw = swTemplate.replace('__VERSION__', version).replace('__SHELL_FILES__', JSON.stringify(shellFiles));
const files = {
  'index.html': html, [jsPath.slice(1)]: js, [cssPath.slice(1)]: css,
  'manifest.webmanifest': manifest, 'icons/icon.svg': icon, 'sw.js': sw,
  'artwork-catalog.json': JSON.stringify(readArtworkCatalog(), null, 2) + '\n',
  'icons/icon-192.png': icon192, 'icons/icon-512.png': icon512
};
for (const [file, content] of Object.entries(files)) {
  const output = path.join(dist, file);
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(output) || !fs.readFileSync(output).equals(Buffer.from(content))) throw new Error(`Stale web output: ${file}`);
  } else {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, content);
  }
}
if (!process.argv.includes('--check')) fs.writeFileSync(path.join(dist, 'build.json'), JSON.stringify({ version, files: Object.keys(files) }, null, 2) + '\n');
console.log(`${process.argv.includes('--check') ? 'Checked' : 'Built'} WavCloud web ${version}`);
