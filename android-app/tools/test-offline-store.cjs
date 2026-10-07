const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const browserSource = fs.readFileSync('android-app/web-src/scripts/offline-store.js', 'utf8');
const nativeSource = fs.readFileSync('android-app/web-src/scripts/native-offline.js', 'utf8');
const turn = () => new Promise(setImmediate);
const track = id => ({ id, title: id });
const url = id => `https://wavcloud.duckdns.org/api/stream/${id}`;

function fixture(native = null) {
  const storage = new Map(), audio = new Map(), events = [];
  const cache = {
    match: async key => audio.get(key),
    put: async (key, response) => audio.set(key, response),
    delete: async key => audio.delete(key)
  };
  const context = {
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    caches: { open: async () => cache },
    window: { caches: {}, dispatchEvent: event => events.push(event) },
    navigator: { onLine: true },
    w: { getStreamUrl: id => `${url(id)}?token=fixture` },
    fetch: async () => new Response('audio', { headers: { 'Content-Type': 'audio/flac', 'Content-Length': '5' } }),
    Response, Blob, AbortController, setTimeout, clearTimeout, btoa,
    console: { warn() {} },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } }
  };
  if (native) context.window.WavCloudOffline = native;
  vm.createContext(context);
  vm.runInContext(browserSource + '\nglobalThis.store = A;', context);
  return { context, store: context.store, storage, audio, cache, events,
    enableNative: () => vm.runInContext(nativeSource, context) };
}

async function browserChecks() {
  const f = fixture();
  for (const raw of ['null', '{}', '42', '{broken']) {
    f.storage.set('cm_manual_downloads', raw);
    assert.deepEqual([...f.store.getManualDownloads()], []);
  }
  f.storage.set('cm_manual_downloads', '["a","a",42,"",null]');
  assert.deepEqual([...f.store.getManualDownloads()], ['a']);

  let finish, calls = 0;
  f.context.fetch = () => { calls++; return new Promise(resolve => { finish = resolve; }); };
  const automatic = f.store.autoCacheTrack(track('shared'));
  const manual = f.store.downloadTrack(track('shared'));
  assert.equal(f.store.downloadTrack(track('shared')), manual);
  await turn(); assert.equal(calls, 1);
  finish(new Response('audio', { headers: { 'Content-Type': 'audio/flac', 'Content-Length': '5' } }));
  await Promise.all([automatic, manual]);
  assert.equal(await f.store.isTrackCached('shared'), true);
  assert.ok(f.store.getManualDownloads().includes('shared'));

  const badResponses = [
    new Response('partial', { status: 206, headers: { 'Content-Type': 'audio/flac' } }),
    new Response('', { headers: { 'Content-Type': 'audio/flac' } }),
    new Response('<html>error</html>', { headers: { 'Content-Type': 'text/html' } }),
    new Response('short', { headers: { 'Content-Type': 'audio/flac', 'Content-Length': '99' } })
  ];
  for (const response of badResponses) {
    f.context.fetch = async () => response;
    await assert.rejects(f.store.downloadTrack(track('bad')));
    assert.equal(f.audio.has(url('bad')), false);
    assert.equal(f.store.pendingDownloads.size, 0);
  }
  f.context.fetch = async () => new Response('audio', { headers: { 'Content-Type': 'audio/flac' } });
  await f.store.downloadTrack(track('bad'));
  assert.equal(await f.store.isTrackCached('bad'), true, 'failed download must be retryable');

  const pinned = Array.from({ length: 45 }, (_, i) => `pin-${i}`);
  const automaticIds = Array.from({ length: 42 }, (_, i) => `auto-${i}`);
  f.store.saveManualDownloads(pinned);
  f.store.saveAutoCacheList([...pinned, ...automaticIds]);
  for (const id of [...pinned, ...automaticIds]) f.audio.set(url(id), {});
  await f.store.purgeOldAutoCache();
  for (const id of pinned) assert.ok(f.audio.has(url(id)), 'manual downloads must stay pinned');
  assert.equal(automaticIds.filter(id => f.audio.has(url(id))).length, 40);

  const previousEvents = f.events.length;
  f.cache.delete = async () => { throw new Error('Storage unavailable'); };
  await assert.rejects(f.store.removeTrack(pinned[0]), /Storage unavailable/);
  assert.equal(f.events.length, previousEvents, 'failed removal must not announce success');

  const timeoutFixture = fixture();
  let deadline;
  timeoutFixture.context.setTimeout = callback => { deadline = callback; return 1; };
  timeoutFixture.context.clearTimeout = () => {};
  timeoutFixture.context.fetch = (key, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('aborted')));
  });
  const stalled = timeoutFixture.store.downloadTrack(track('stalled'));
  await turn(); deadline();
  await assert.rejects(stalled, /aborted/);
  assert.equal(timeoutFixture.store.manualDownloads.size, 0);
}

async function nativeChecks() {
  const saved = new Set(), requests = [], operations = [];
  let activeImport = null, failImport = false;
  const native = {
    isCached: id => saved.has(id),
    download: (requestId, id) => requests.push({ requestId, id }),
    remove(id) { operations.push(`remove:${id}`); saved.delete(id); return true; },
    beginImport(id) {
      assert.equal(activeImport, null, 'native imports must never overlap');
      activeImport = id; operations.push(`begin:${id}`); return true;
    },
    appendImport: () => !failImport,
    finishImport(id) { assert.equal(activeImport, id); saved.add(id); activeImport = null; return true; },
    abortImport() { activeImport = null; }
  };
  const f = fixture(native);
  f.storage.set('cm_manual_downloads', '["legacy-a","legacy-b","retry","removed"]');
  for (const id of ['legacy-a', 'legacy-b', 'retry', 'removed']) {
    f.audio.set(url(id), { blob: async () => new Blob(['legacy audio']) });
  }
  f.enableNative();
  assert.deepEqual(await Promise.all([
    f.store.isTrackCached('legacy-a'), f.store.isTrackCached('legacy-a'), f.store.isTrackCached('legacy-b')
  ]), [true, true, true]);
  assert.equal(operations.filter(item => item === 'begin:legacy-a').length, 1);
  assert.equal(f.audio.has(url('legacy-a')), false);

  failImport = true;
  assert.equal(await f.store.isTrackCached('retry'), false);
  assert.equal(f.audio.has(url('retry')), true, 'failed migration must preserve the old audio');
  failImport = false;
  assert.equal(await f.store.isTrackCached('retry'), true, 'migration failure must be retryable');

  const first = f.store.downloadTrack(track('download'));
  assert.equal(f.store.downloadTrack(track('download')), first);
  await turn(); assert.equal(requests.length, 1);
  const remove = f.store.removeTrack('download');
  await turn(); assert.equal(operations.includes('remove:download'), false);
  saved.add('download');
  f.context.window.__wavcloudOfflineResult(JSON.stringify({ requestId: requests[0].requestId, error: '' }));
  await Promise.all([first, remove]);
  assert.equal(saved.has('download'), false, 'download completion must not resurrect a removed file');

  const invalid = f.store.downloadTrack(track('invalid'));
  await turn();
  f.context.window.__wavcloudOfflineResult('{broken');
  f.context.window.__wavcloudOfflineResult(JSON.stringify({ requestId: requests.at(-1).requestId, error: 42 }));
  await assert.rejects(invalid, /Invalid download result/);
  const retry = f.store.downloadTrack(track('invalid'));
  await turn(); saved.add('invalid');
  f.context.window.__wavcloudOfflineResult(JSON.stringify({ requestId: requests.at(-1).requestId, error: '' }));
  await retry;

  await f.store.removeTrack('removed');
  assert.equal(f.audio.has(url('removed')), false, 'removal must also remove unmigrated legacy audio');
  assert.equal(await f.store.isTrackCached('removed'), false);
}

(async () => {
  await browserChecks();
  await nativeChecks();
  console.log('PASS: shared/validated downloads, pinned retention, serialized/retryable native migration and ordered removal');
})().catch(error => { console.error(error); process.exitCode = 1; });
