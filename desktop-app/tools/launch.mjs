import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
await import('./assets.mjs');
const require = createRequire(import.meta.url);
const child = spawn(require('electron'), [path.resolve(import.meta.dirname, '..')], { stdio: 'inherit' });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
