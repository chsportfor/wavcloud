const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('android-app/web-src/scripts/api-client.js', 'utf8');
let reloads = 0, timeout, fetchImpl;
const context = {
  window: { location: { hostname: 'wavcloud.duckdns.org', origin: 'https://wavcloud.duckdns.org', reload: () => reloads++ } },
  localStorage: { getItem: () => 'saved-token', setItem() {}, removeItem() {} },
  Headers, AbortController, encodeURIComponent,
  setTimeout: callback => { timeout = callback; return 1; }, clearTimeout() {},
  fetch: (...args) => fetchImpl(...args),
  uiIsTrack: track => typeof track.id === 'string' && typeof track.title === 'string' && typeof track.filePath === 'string'
};
vm.createContext(context);
vm.runInContext(source + '\nglobalThis.api = w;', context);
for (const hostname of ['localhost', '127.0.0.1']) {
  const local = { ...context, window: { location: { hostname, origin: `http://${hostname}:5173` } } };
  vm.createContext(local);
  vm.runInContext(source + '\nglobalThis.api = w;', local);
  assert.equal(local.api.getStreamUrl('song'), `http://${hostname}:3000/api/stream/song?token=saved-token`);
}
(async () => {
  assert.equal(context.api.getArtworkUrl('a/b'), 'https://wavcloud.duckdns.org/api/tracks/a%2Fb/artwork?token=saved-token');
  fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ tracks: [{ id: 'a', title: '日本語', filePath: '/a.flac' }] }) });
  assert.equal((await context.api.getTracks())[0].title, '日本語');
  fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ tracks: null }) });
  await assert.rejects(context.api.getTracks(), /曲|곡 목록/);
  fetchImpl = async () => ({ ok: false, status: 401, json: async () => ({}) });
  await assert.rejects(context.api.getTracks(), /로그인/);
  assert.equal(reloads, 1); assert.equal(context.api.token, null);
  fetchImpl = (url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('aborted')));
  });
  const stalled = context.api.getFolders(); timeout();
  await assert.rejects(stalled, /응답이 늦어/);
  fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({}) });
  await assert.rejects(context.api.login('audit', 'demo'), /로그인 응답/);
  console.log('PASS: media URL encoding, API schema, expired login and stalled request recovery');
})().catch(error => { console.error(error); process.exitCode = 1; });
