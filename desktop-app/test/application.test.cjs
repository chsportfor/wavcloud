const assert = require('node:assert/strict');
const { test } = require('node:test');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { SERVICE_URL, isServiceUrl, canGrantPermission, windowBounds } = require('../src/policy.cjs');
const { readState, writeState } = require('../src/state.cjs');
const { createApplication } = require('../src/application.cjs');

function harness(t, state = {}, failTray = false) {
  const testRoot = path.resolve(__dirname, '../dist/test-state');
  fs.mkdirSync(testRoot, { recursive: true });
  const dir = fs.mkdtempSync(path.join(testRoot, 'case-'));
  t.after(() => {
    if (path.dirname(fs.realpathSync(dir)) !== fs.realpathSync(testRoot)) throw new Error('Unexpected cleanup path');
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const stateFile = path.join(dir, 'window-state.json');
  writeState(stateFile, state);
  const app = Object.assign(new EventEmitter(), { quitCount: 0, quit() { this.quitCount++; }, getVersion: () => '0.1.0' });
  const session = Object.assign(new EventEmitter(), {
    setPermissionRequestHandler(callback) { this.requestPermission = callback; },
    setPermissionCheckHandler(callback) { this.checkPermission = callback; }
  });
  const web = Object.assign(new EventEmitter(), { session, setWindowOpenHandler(callback) { this.openWindow = callback; } });
  class Window extends EventEmitter {
    constructor(options) { super(); this.options = options; this.webContents = web; this.urls = []; this.files = []; this.hidden = false; this.minimized = false; this.maximized = false; }
    loadURL(url) { this.urls.push(url); return Promise.resolve(); }
    loadFile(file) { this.files.push(file); return Promise.resolve(); }
    getNormalBounds() { return { x: 30, y: 40, width: 1280, height: 820 }; }
    isDestroyed() { return false; }
    isMinimized() { return this.minimized; }
    isMaximized() { return this.maximized; }
    maximize() { this.maximized = true; }
    restore() { this.minimized = false; }
    show() { this.hidden = false; }
    hide() { this.hidden = true; }
    focus() { this.focused = true; }
    setTitle(title) { this.title = title; }
  }
  const icon = { resize() { return this; } };
  let tray;
  class Tray extends EventEmitter {
    constructor() { super(); if (failTray) throw new Error('No tray'); tray = this; }
    setToolTip(text) { this.tooltip = text; }
    setContextMenu(menu) { this.menu = menu; }
    displayBalloon() { this.balloon = true; }
    destroy() { this.destroyed = true; }
  }
  const menu = { buildFromTemplate: value => value, setApplicationMenu(value) { this.items = value; } };
  const power = { starts: [], stops: [], start(type) { this.starts.push(type); return this.starts.length; }, stop(id) { this.stops.push(id); } };
  const display = { id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1040 } };
  const electron = { app, BrowserWindow: Window, Menu: menu, Tray, nativeImage: { createFromPath: () => icon },
    screen: { getPrimaryDisplay: () => display, getAllDisplays: () => [display] },
    shell: { openExternal: async () => {} }, dialog: { showMessageBox: async () => {} }, powerSaveBlocker: power };
  const window = createApplication(electron, stateFile).start();
  return { app, window, web, session, menu, power, tray, stateFile };
}

test('service policy rejects lookalike hosts, custom schemes, credentials and alternate ports', () => {
  assert.equal(isServiceUrl(SERVICE_URL), true);
  assert.equal(isServiceUrl(SERVICE_URL + 'index.html'), true);
  for (const url of ['http://wavcloud.duckdns.org/', 'https://wavcloud.duckdns.org.evil.test/', 'https://wavcloud.duckdns.org:444/', 'https://user:password@wavcloud.duckdns.org/', 'file:///C:/test.html', 'javascript:alert(1)', 'not a URL']) assert.equal(isServiceUrl(url), false);
  assert.equal(canGrantPermission('persistent-storage', SERVICE_URL), true);
  for (const permission of ['media', 'clipboard-read', 'fileSystem', 'display-capture', 'notifications', 'openExternal']) assert.equal(canGrantPermission(permission, SERVICE_URL), false);
  assert.equal(canGrantPermission('fullscreen', 'https://evil.test'), false);
});

test('removed monitors and malformed saved sizes cannot strand the window off screen', () => {
  const displays = [{ workArea: { x: 0, y: 0, width: 1366, height: 768 } }, { workArea: { x: -1920, y: 0, width: 1920, height: 1080 } }];
  assert.deepEqual(windowBounds({ x: 8000, y: -9999, width: -1, height: Infinity }, displays), { width: 600, height: 768 });
  assert.deepEqual(windowBounds({ x: -1500, y: 20, width: 1000, height: 600 }, displays), { x: -1500, y: 20, width: 1000, height: 600 });
  assert.deepEqual(windowBounds({ width: '1000', height: null }, displays), { width: 1280, height: 768 });
});

test('damaged state recovers and persistence writes only window settings', t => {
  const app = harness(t);
  fs.writeFileSync(app.stateFile, '{broken');
  assert.deepEqual(readState(app.stateFile), {});
  assert.equal(writeState(app.stateFile, { width: 900.7, token: 'must-not-be-saved', closeToTray: false }), true);
  assert.deepEqual(readState(app.stateFile), { closeToTray: false, maximized: false, width: 901 });
});

test('real application configuration isolates the persistent web renderer and rejects navigation', t => {
  const { window, web, session } = harness(t);
  const prefs = window.options.webPreferences;
  assert.equal(prefs.partition, 'persist:wavcloud');
  assert.equal(prefs.sandbox, true);
  assert.equal(prefs.contextIsolation, true);
  assert.equal(prefs.nodeIntegration, false);
  assert.equal(prefs.webSecurity, true);
  assert.equal(prefs.webviewTag, false);
  assert.deepEqual(window.urls, [SERVICE_URL]);
  let blocked = 0;
  const event = { preventDefault: () => { blocked++; } };
  web.emit('will-navigate', event, 'https://evil.test');
  web.emit('will-redirect', event, 'file:///C:/private.txt');
  web.emit('will-attach-webview', event);
  web.emit('will-navigate', event, SERVICE_URL);
  assert.equal(blocked, 3);
  assert.deepEqual(web.openWindow({ url: SERVICE_URL }), { action: 'deny' });
  let allowed;
  session.requestPermission(null, 'media', value => { allowed = value; }, { requestingUrl: SERVICE_URL });
  assert.equal(allowed, false);
  session.requestPermission(null, 'persistent-storage', value => { allowed = value; });
  assert.equal(allowed, false);
  assert.equal(session.checkPermission(null, 'persistent-storage', SERVICE_URL), true);
});

test('close keeps the player alive in the tray; explicit quit saves state and exits', t => {
  const { window, app, tray, stateFile } = harness(t);
  let prevented = false;
  window.emit('close', { preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(window.hidden, true);
  assert.equal(app.quitCount, 0);
  assert.equal(readState(stateFile).width, 1280);
  window.minimized = true;
  app.emit('second-instance');
  assert.equal(window.minimized, false);
  assert.equal(window.hidden, false);
  assert.equal(window.focused, true);
  tray.menu.at(-1).click();
  assert.equal(app.quitCount, 1);
  app.emit('before-quit');
  window.emit('close', { preventDefault: () => { throw new Error('Quit must not be prevented'); } });
  app.emit('will-quit');
  assert.equal(tray.destroyed, true);
});

test('closing exits when tray is disabled or unavailable instead of creating an invisible app', t => {
  for (const [state, noTray] of [[{ closeToTray: false }, false], [{}, true]]) {
    const { window, app } = harness(t, state, noTray);
    window.emit('close', { preventDefault: () => { throw new Error('Close must proceed'); } });
    window.emit('closed');
    assert.equal(app.quitCount, 1);
  }
});

test('only main-frame connection failures and renderer crashes open recovery once', t => {
  const { window, web, menu } = harness(t);
  web.emit('did-fail-load', {}, -105, 'DNS', SERVICE_URL, false);
  web.emit('did-fail-load', {}, -3, 'Cancelled', SERVICE_URL, true);
  assert.equal(window.files.length, 0);
  web.emit('did-fail-load', {}, -105, 'DNS', SERVICE_URL, true);
  web.emit('did-fail-load', {}, -105, 'DNS', SERVICE_URL, true);
  assert.equal(window.files.length, 1);
  assert.equal(path.basename(window.files[0]), 'recovery.html');
  menu.items.find(item => item.label === '보기').submenu[0].click();
  assert.equal(window.urls.length, 2);
  web.emit('render-process-gone', {}, { reason: 'crashed' });
  assert.equal(window.files.length, 2);
});

test('playback alone prevents automatic sleep and pause, crash, or quit releases it', t => {
  const { web, app, power } = harness(t);
  web.emit('media-started-playing');
  web.emit('media-started-playing');
  assert.deepEqual(power.starts, ['prevent-app-suspension']);
  web.emit('media-paused');
  assert.deepEqual(power.stops, [1]);
  web.emit('media-started-playing');
  web.emit('render-process-gone');
  assert.deepEqual(power.stops, [1, 2]);
  web.emit('media-started-playing');
  app.emit('before-quit');
  assert.deepEqual(power.stops, [1, 2, 3]);
});

test('a second process quits before creating any window', async () => {
  for (const ownsLock of [false, true]) {
    let starts = 0, quits = 0;
    const app = Object.assign(new EventEmitter(), { setName() {}, setAppUserModelId() {}, enableSandbox() {},
      requestSingleInstanceLock: () => ownsLock, quit: () => { quits++; }, whenReady: async () => {}, getPath: () => os.tmpdir(), exit() {} });
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/main.cjs'), 'utf8'), {
      require: name => name === 'electron' ? { app } : name === './application.cjs' ? { createApplication: () => ({ start: () => { starts++; } }) } : name === './policy.cjs' ? { APP_ID: 'org.wavcloud.desktop' } : require(name), console
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(starts, ownsLock ? 1 : 0);
    assert.equal(quits, ownsLock ? 0 : 1);
  }
});
