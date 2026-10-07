import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const output = path.resolve(root, '../outputs');
const files = ['nsis', 'portable'].map(target => `WavCloud-PC-${pkg.version}-x64-${target}.exe`);
fs.mkdirSync(output, { recursive: true });
const checksums = [];
for (const file of files) {
  const source = path.join(root, 'dist', file);
  const bytes = fs.readFileSync(source);
  if (bytes.toString('ascii', 0, 2) !== 'MZ') throw new Error(`Invalid Windows executable: ${file}`);
  fs.copyFileSync(source, path.join(output, file));
  checksums.push(`${crypto.createHash('sha256').update(bytes).digest('hex')}  ${file}`);
  console.log(`${file}: ${(bytes.length / 1024 ** 2).toFixed(1)} MiB`);
}
fs.writeFileSync(path.join(output, `WavCloud-PC-${pkg.version}-SHA256.txt`), checksums.join('\n') + '\n');
