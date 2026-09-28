const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('android-app/web-src/scripts/artwork.js', 'utf8');
const setup = source.slice(source.indexOf('let uiRemoteArtworkLoaded'), source.indexOf('const uiHighResArtwork ='));

async function run() {
  let abortCount = 0;
  let deadline;
  const stalled = {
    uiVerifiedArtwork: { 'Album///known': 'https://example.test/bundled.jpg' },
    fetch: () => new Promise(() => {}),
    localStorage: { getItem: () => null, setItem() {} },
    setTimeout(callback, delay) { deadline = { callback, delay }; return 1; },
    clearTimeout() {},
    AbortController: class { constructor() { this.signal = {}; } abort() { abortCount++; } }
  };
  vm.createContext(stalled);
  vm.runInContext(setup, stalled);
  assert.equal(deadline.delay, 2500);
  deadline.callback();
  await vm.runInContext('uiRemoteArtworkReady', stalled);
  assert.equal(vm.runInContext('uiRemoteArtworkLoaded', stalled), true);
  assert.equal(abortCount, 1);
  assert.equal(stalled.uiVerifiedArtwork['Album///known'], 'https://example.test/bundled.jpg');

  const loaded = {
    uiVerifiedArtwork: { 'Album///known': 'https://example.test/bundled.jpg' },
    fetch: async () => ({ ok: true, json: async () => ({ 'Album///known': 'https://example.test/new.jpg' }) }),
    localStorage: { getItem: () => null, setItem(key, value) { this.saved = [key, value]; } },
    setTimeout: () => 1,
    clearTimeout() {}
  };
  vm.createContext(loaded);
  vm.runInContext(setup, loaded);
  await vm.runInContext('uiRemoteArtworkReady', loaded);
  assert.equal(loaded.uiVerifiedArtwork['Album///known'], 'https://example.test/new.jpg');
  assert.equal(loaded.localStorage.saved[0], 'wavcloud_artwork_catalog');
  console.log('PASS: artwork catalog falls back after 2.5s and applies a successful remote update');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
