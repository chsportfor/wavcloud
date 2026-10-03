const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');

const saved = new Set();
const events = [];
const imports = [];
let legacyDeleted = false;
const audio = new Blob([Buffer.from('previously downloaded audio')]);
const cache = {
  async match() { return legacyDeleted ? null : { blob: async () => audio }; },
  async delete() { legacyDeleted = true; return true; }
};
const native = {
  isCached: id => saved.has(id),
  download(requestId, id) {
    saved.add(id);
    context.window.__wavcloudOfflineResult(JSON.stringify({ requestId, error: '' }));
  },
  remove(id) { saved.delete(id); return true; },
  beginImport(id) { imports.push(['begin', id]); return true; },
  appendImport(id, chunk) { imports.push(['append', id, chunk]); return true; },
  finishImport(id) { saved.add(id); imports.push(['finish', id]); return true; },
  abortImport() { throw new Error('Unexpected abort'); }
};
const context = {
  window: {
    WavCloudOffline: native,
    caches: { open: async () => cache },
    dispatchEvent: event => events.push(event.type)
  },
  caches: { open: async () => cache },
  localStorage: { getItem: key => key === 'cm_manual_downloads' ? '["legacy"]' : '[]' },
  w: { getStreamUrl: id => `https://wavcloud.duckdns.org/api/stream/${id}?token=test` },
  A: {},
  Blob,
  btoa,
  console,
  CustomEvent: class { constructor(type) { this.type = type; } }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('android-app/web-src/scripts/native-offline.js', 'utf8'), context);

async function run() {
  await context.A.downloadTrack({ id: 'new' });
  assert.equal(saved.has('new'), true);
  assert.equal(await context.A.isTrackCached('new'), true);
  assert.equal(events.at(-1), 'offline:downloaded');

  assert.equal(await context.A.isTrackCached('legacy'), true, 'legacy WebView audio should migrate');
  assert.deepEqual(imports.map(entry => entry[0]), ['begin', 'append', 'finish']);
  assert.equal(Buffer.from(imports[1][2], 'base64').toString(), 'previously downloaded audio');
  assert.equal(legacyDeleted, true);

  await context.A.removeTrack('new');
  assert.equal(await context.A.isTrackCached('new'), false);
  assert.equal(events.at(-1), 'offline:removed');
  console.log('PASS: native downloads, removal, and legacy WebView cache migration');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
