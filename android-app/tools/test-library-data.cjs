const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('android-app/web-src/scripts/library-data.js', 'utf8');
let playlists = '{broken';
let cacheWrites = 0, requests = 0, finish;
const context = {
  localStorage: { getItem: key => key === 'cm_playlists' ? playlists : '[{"id":42}]',
    setItem: () => { cacheWrites++; throw new Error('QuotaExceededError'); } },
  w: { getTracks: () => { requests++; return new Promise(resolve => { finish = resolve; }); } },
  _trackSorter: () => 0, uiText: () => ({}), uiButton: () => ({}), P() {},
  A: {}, uiRefreshOfflineBadge: async () => {}
};
vm.createContext(context);
vm.runInContext(source, context);
assert.deepEqual(JSON.parse(JSON.stringify(context.uiLoadPlaylists())), []);
for (const raw of ['null', '{}', '[null,{"name":2,"trackIds":[]}]']) {
  playlists = raw;
  assert.equal(context.uiLoadPlaylists().length, 0);
}
playlists = '[{"name":"日本語·밤","trackIds":["a","a",null,42]}, {"name":"","trackIds":[]}]';
assert.deepEqual(JSON.parse(JSON.stringify(context.uiLoadPlaylists())), [{ name: '日本語·밤', trackIds: ['a'] }]);

(async () => {
  const library = { tracks: [], trackListEl: { replaceChildren() {} }, loadPlaylists() {},
    extractFolders() { this.extracted = true; }, render() { this.rendered = true; } };
  const first = context.uiLoadTracks(library);
  assert.equal(first, context.uiLoadTracks(library));
  await new Promise(setImmediate);
  assert.equal(requests, 1);
  const track = { id: 'a', title: '곡', filePath: '/music/a.flac' };
  finish([track]);
  await first;
  assert.equal(library.tracks[0].id, 'a');
  assert.ok(library.rendered && library.extracted);
  assert.equal(cacheWrites, 1);
  assert.equal(library.trackRequest, null);

  let downloads = 0, resolveDownload;
  const notices = [];
  context.P = message => notices.push(message);
  context.A = { isTrackCached: async () => false,
    downloadTrack: () => { downloads++; return new Promise(resolve => { resolveDownload = resolve; }); } };
  const button = { innerHTML: 'original', disabled: false };
  const row = { querySelector: () => button, isConnected: true };
  const action = context.uiToggleCache(library, track, row);
  context.uiToggleCache(library, track, row);
  await new Promise(setImmediate);
  assert.equal(downloads, 1);
  resolveDownload(); await action;
  context.A.downloadTrack = async () => { throw new Error('offline'); };
  await context.uiToggleCache(library, track, row);
  assert.equal(button.innerHTML, 'original'); assert.equal(button.disabled, false);
  assert.match(notices.at(-1), /다시 시도/);

  const viewSource = fs.readFileSync('android-app/web-src/scripts/library-view.js', 'utf8');
  context.W = function() {};
  context.uiTrackOrderContext = () => null;
  context.uiOriginalReorderTracks = () => { throw new Error('Filtered tracks must not replace the library'); };
  let start = viewSource.indexOf('W.prototype.reorderTracks = function');
  let end = viewSource.indexOf('\n};', start) + 3;
  vm.runInContext(viewSource.slice(start, end), context);
  context.W.prototype.reorderTracks.call({ searchQuery: 'song', currentMenuTab: 'tracks' }, [track], 0, 0);
  context.W.prototype.reorderTracks.call({ searchQuery: '', currentMenuTab: 'offline' }, [track], 0, 0);

  let finishLookup;
  context.A.isTrackCached = () => new Promise(resolve => { finishLookup = resolve; });
  start = viewSource.indexOf('W.prototype.renderOfflineList = async function');
  end = viewSource.indexOf('\n};', start) + 3;
  vm.runInContext(viewSource.slice(start, end), context);
  const list = { replaceChildren() {}, appendChild() { throw new Error('Stale offline rows overwrote the new tab'); } };
  const view = { trackRenderVersion: 1, tracks: [track], trackListEl: list, searchQuery: '' };
  const pendingRender = context.W.prototype.renderOfflineList.call(view);
  view.trackRenderVersion++;
  finishLookup(true);
  await pendingRender;
  console.log('PASS: damaged persistence, cache quota, shared loads and download failure recovery');
})().catch(error => { console.error(error); process.exitCode = 1; });
