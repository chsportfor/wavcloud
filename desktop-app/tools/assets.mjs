import fs from 'node:fs';
import path from 'node:path';
import { createIcon } from '../../web-app/tools/icons.mjs';

const build = path.resolve(import.meta.dirname, '../build');
fs.mkdirSync(build, { recursive: true });
const png = createIcon(256);
// Windows ICO can contain PNG images; use a directory entry followed by its PNG.
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(header.length, 18);
fs.writeFileSync(path.join(build, 'icon.ico'), Buffer.concat([header, png]));
const assets = path.resolve(import.meta.dirname, '../src/assets');
fs.mkdirSync(assets, { recursive: true });
fs.writeFileSync(path.join(assets, 'icon.png'), createIcon(512));
console.log('Prepared WavCloud Windows icons');
