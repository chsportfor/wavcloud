import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
run(['--test', 'test/application.test.cjs']);
await import('./assets.mjs');
const directoryOnly = process.argv.includes('--dir');
run([require.resolve('electron-builder/out/cli/cli.js'), '--win', ...(directoryOnly ? ['--dir'] : ['nsis', 'portable']), '--x64', '--publish', 'never']);
if (!directoryOnly) await import('./release.mjs');
