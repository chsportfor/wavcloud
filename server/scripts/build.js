'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const check = process.argv.includes('--check');
function build(directory, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const source = path.join(directory, entry.name);
    const target = path.join(destination, entry.name);
    if (entry.isDirectory()) { build(source, target); continue; }
    if (!entry.name.endsWith('.js')) continue;
    execFileSync(process.execPath, ['--check', source]);
    const text = fs.readFileSync(source);
    if (check) {
      if (!fs.existsSync(target) || !text.equals(fs.readFileSync(target))) throw new Error(`Stale generated file: ${target}`);
    } else fs.writeFileSync(target, text);
  }
}
build(path.join(root, 'src'), path.join(root, 'dist'));
console.log(check ? 'Server dist matches src' : 'Generated server dist from src');
