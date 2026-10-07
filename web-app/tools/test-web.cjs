const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { test } = require('node:test');
const root = path.resolve(__dirname, '..');

function worker() {
  const handlers = new Map(), entries = new Map(), removed = [];
  let network = true, calls = 0, claimed = false;
  const cache = {
    async match(key) { const value = entries.get(typeof key === 'string' ? key : key.url); return value?.clone(); },
    async put(key, value) { entries.set(typeof key === 'string' ? key : key.url, value.clone()); },
    async addAll() {}
  };
  const context = vm.createContext({ URL, Headers, Request, Response, console,
    self: { location: { origin: 'https://wavcloud.test' }, addEventListener: (name, callback) => handlers.set(name, callback), skipWaiting: async () => {}, clients: { claim: async () => { claimed = true; } } },
    caches: { open: async () => cache, keys: async () => ['audio-cache', 'artwork-cache', 'api-cache', 'workbox-precache-v2-https://wavcloud.test/', 'wavcloud-shell-old', 'wavcloud-shell-test'], delete: async name => { removed.push(name); } },
    fetch: async () => { calls++; if (!network) throw new Error('offline'); return new Response('network'); }
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8').replace('__VERSION__', 'test').replace('__SHELL_FILES__', JSON.stringify(['/index.html', '/assets/test.js', '/assets/test.css'])), context);
  return {
    context, entries, removed, handlers,
    offline() { network = false; },
    get calls() { return calls; }, get claimed() { return claimed; },
    request(url, options = {}) {
      let result;
      const request = new Request(url, options);
      handlers.get('fetch')({ request, respondWith(value) { result = value; } });
      return result;
    }
  };
}

test('cached audio supports full playback, seeking, suffix and HEAD while offline', async () => {
  const app = worker();
  app.entries.set('https://wavcloud.test/api/stream/song', new Response(Uint8Array.from([0,1,2,3,4,5,6,7,8,9]), { headers: { 'Content-Type': 'audio/flac', 'Content-Length': '10' } }));
  app.offline();
  const url = 'https://wavcloud.test/api/stream/song?token=temporary';
  assert.equal((await app.request(url)).status, 200);
  for (const [range, expected] of [['bytes=2-4',[2,3,4]],['bytes=7-',[7,8,9]],['bytes=-3',[7,8,9]],['bytes=8-99',[8,9]]]) {
    const response = await app.request(url, { headers: { Range: range } });
    assert.equal(response.status, 206);
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], expected);
  }
  for (const range of ['bytes=9-2', 'bytes=10-', 'bytes=-0', 'bytes=1-2,4-5', 'bytes=9007199254740993-']) {
    assert.equal((await app.request(url, { headers: { Range: range } })).status, 416);
  }
  const head = await app.request(url, { method: 'HEAD', headers: { Range: 'bytes=2-4' } });
  assert.equal(head.headers.get('Content-Length'), '3');
  assert.equal((await head.arrayBuffer()).byteLength, 0);
  assert.equal((await app.request('https://wavcloud.test/api/download/song')).status, 200);
  assert.equal(app.calls, 0);
});

test('worker replaces old page caches and preserves all audio and local data caches', async () => {
  const app = worker();
  let task;
  app.handlers.get('activate')({ waitUntil(value) { task = value; } });
  await task;
  assert.deepEqual(app.removed, ['workbox-precache-v2-https://wavcloud.test/', 'wavcloud-shell-old']);
  assert.equal(app.claimed, true);
});

test('update notices compare running page assets and never force a reload during playback', () => {
  const app = worker();
  let build;
  app.handlers.get('message')({ data: { type: 'WAVCLOUD_BUILD' }, source: { postMessage: value => { build = value; } } });
  assert.equal(build.script, '/assets/test.js');
  assert.equal(build.style, '/assets/test.css');
  const handlers = new Map();
  let banners = 0, reloads = 0;
  const context = vm.createContext({ URL,
    navigator: { serviceWorker: { addEventListener: (name, callback) => handlers.set(name, callback), controller: { postMessage() {} } } },
    window: { addEventListener() {}, location: { reload() { reloads++; } } },
    document: { querySelector: selector => selector.startsWith('script') ? { src: 'https://wavcloud.test/assets/test.js' } : selector.startsWith('link') ? { href: 'https://wavcloud.test/assets/test.css' } : null, body: { append() { banners++; } } },
    uiText: () => ({ setAttribute() {}, addEventListener() {}, append() {} })
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'scripts/pwa.js'), 'utf8'), context);
  handlers.get('message')({ data: build });
  assert.equal(banners, 0);
  handlers.get('message')({ data: { ...build, script: '/assets/next.js' } });
  assert.equal(banners, 1);
  handlers.get('message')({ data: { ...build, style: '/assets/next.css' } });
  assert.equal(banners, 2);
  assert.equal(reloads, 0);
});

test('offline page and hashed assets load from shell; auth, uploads and track API are untouched', async () => {
  const app = worker();
  app.entries.set('/index.html', new Response('offline shell'));
  app.entries.set('/assets/test.js', new Response('shared code'));
  app.offline();
  let navigation;
  app.handlers.get('fetch')({ request: { url: 'https://wavcloud.test/', mode: 'navigate', method: 'GET' }, respondWith(value) { navigation = value; } });
  assert.equal(await (await navigation).text(), 'offline shell');
  assert.equal(await (await app.request('https://wavcloud.test/assets/test.js')).text(), 'shared code');
  assert.equal(app.request('https://wavcloud.test/api/tracks'), undefined);
  assert.equal(app.request('https://wavcloud.test/api/upload', { method: 'POST' }), undefined);
  assert.equal(app.request('https://other.test/assets/test.js'), undefined);
});

test('PC shortcuts preserve text entry, focused buttons, sliders and repeated keys', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(root, 'scripts/desktop.js'), 'utf8'), context);
  const state = { currentTrack: { id: 'a' } };
  assert.equal(context.uiBrowserShortcut({ key: ' ', target: { closest: () => null } }, state), 'toggle');
  for (const key of [' ', 'n', 'ArrowLeft']) {
    assert.equal(context.uiBrowserShortcut({ key, target: { closest: () => ({}) } }, state), null);
  }
  assert.equal(context.uiBrowserShortcut({ key: 'n', repeat: true }, state), null);
  assert.equal(context.uiBrowserShortcut({ key: ' ', target: null }, { currentTrack: null }), null);
  assert.equal(context.uiBrowserShortcut({ key: 'k', ctrlKey: true }, state), 'search');
});

test('corrupt stored volume cannot crash the browser player during initialization', () => {
  const source = fs.readFileSync(path.join(root, '../android-app/web-src/scripts/audio-player.js'), 'utf8');
  for (const [stored, expected] of [['oops',.5],['3',.5],['-1',.5],['0',0],['.75',.75],[null,.5]]) {
    class AudioStub {
      addEventListener() {}
      set volume(value) { assert.ok(Number.isFinite(value) && value >= 0 && value <= 1); this.value = value; }
    }
    const context = vm.createContext({ defineField: (object,key,value) => { object[key] = value; }, Audio: AudioStub, window: { addEventListener() {} }, navigator: {}, localStorage: { getItem: () => stored } });
    vm.runInContext(source + ';globalThis.player = new AudioPlayer();', context);
    assert.equal(context.player.state.volume, expected);
  }
});

test('album detail search filters tracks by Unicode title, artist and album', async () => {
  const context = vm.createContext({ defineField() {}, uiText: (tag, cls, text) => ({ text }), localStorage: {} });
  vm.runInContext(fs.readFileSync(path.join(root, '../android-app/web-src/scripts/library-data.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, '../android-app/web-src/scripts/library-view.js'), 'utf8') + ';globalThis.View = LibraryView;', context);
  const tracks = [{ id: 'a', title: '한국어・日本語', artist: '테스트', album: 'Album' }, { id: 'b', title: 'Other', artist: 'Else', album: 'Second' }];
  let rendered, empty;
  const view = { searchQuery: '日本語', renderTrackRows: async items => { rendered = items; return false; }, trackListEl: { replaceChildren: item => { empty = item.text; } } };
  await context.View.prototype.renderTrackItemsList.call(view, tracks);
  assert.deepEqual(rendered.map(track => track.id), ['a']);
  view.searchQuery = '不存在';
  await context.View.prototype.renderTrackItemsList.call(view, tracks);
  assert.equal(empty, '검색 결과가 없습니다.');
  assert.equal(context.uiTrackMatchesSearch(tracks[0], 'ALBUM'), true);
  assert.equal(context.uiTrackMatchesSearch(tracks[0], '테스트'), true);
});
