import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, ['android-app/tools/sync-web.mjs'], {
  cwd: process.cwd(),
  stdio: 'inherit'
});
process.exitCode = result.status ?? 1;
