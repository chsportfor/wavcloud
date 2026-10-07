// Native SDK smoke check: starts Electron without a BrowserWindow or login.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { app, nativeImage, session } = require('electron');
const root = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(root, 'dist/runtime-check-profile'), { recursive: true });
app.setPath('userData', path.join(root, 'dist/runtime-check-profile'));
app.enableSandbox();
app.whenReady().then(() => {
  const archive = path.join(root, 'dist/win-unpacked/resources/app.asar');
  const pkg = JSON.parse(fs.readFileSync(path.join(archive, 'package.json'), 'utf8'));
  const policy = require(path.join(archive, 'src/policy.cjs'));
  const application = require(path.join(archive, 'src/application.cjs'));
  const icon = nativeImage.createFromPath(path.join(archive, 'src/assets/icon.png'));
  assert.equal(icon.getSize().width, 512);
  assert.equal(policy.SERVICE_URL, 'https://wavcloud.duckdns.org/');
  assert.equal(typeof application.createApplication, 'function');
  assert.match(fs.readFileSync(path.join(archive, 'src/recovery.html'), 'utf8'), /assets\/icon\.png/);
  assert.ok(session.fromPartition('persist:runtime-check').isPersistent());
  assert.equal(process.versions.electron, JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).devDependencies.electron);
  fs.writeFileSync(path.join(root, 'dist/runtime-check.json'), JSON.stringify({ version: pkg.version, electron: process.versions.electron, packagedModules: true, icon: icon.getSize(), persistentSession: true }, null, 2));
  app.exit(0);
}).catch(error => {
  fs.writeFileSync(path.join(root, 'dist/runtime-check.json'), JSON.stringify({ error: error.message }));
  app.exit(1);
});
