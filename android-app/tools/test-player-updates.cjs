const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const nodes = new Map();
const writes = new Map();
function node(selector) {
  if (!nodes.has(selector)) {
    let text = '';
    nodes.set(selector, {
      style: {}, dataset: {}, innerHTML: '', value: '',
      get textContent() { return text; },
      set textContent(value) { text = value; writes.set(selector, (writes.get(selector) || 0) + 1); },
      setAttribute(name, value) { this[name] = value; },
      classList: { add() {}, remove() {}, toggle() {} }, querySelectorAll: () => []
    });
  }
  return nodes.get(selector);
}
let state = { currentTrack: { id: 'a', title: 'First', artist: 'Artist', hasArtwork: false },
  currentTime: 0, duration: 300, volume: .5, isPlaying: true, isLoading: false,
  repeat: 'none', shuffle: false };
let lookups = 0;
let covers = 0;
const context = {
  p: { getState: () => state, getQueue: () => [], formatTime: t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2,'0')}` },
  A: { isTrackCached: async () => { lookups++; return true; } },
  uiEnsureArtwork() { covers++; }, cloudEnhancePlayerState() {}, console
};
vm.createContext(context);
vm.runInContext(['ui-primitives','player-view','mini-player-view'].map(name =>
  fs.readFileSync(`android-app/web-src/scripts/${name}.js`,'utf8')).join('\n') +
  '\nglobalThis.Views={PlayerView,MiniPlayerView};', context);
const full = Object.create(context.Views.PlayerView.prototype);
const mini = Object.create(context.Views.MiniPlayerView.prototype);
full.el = mini.el = { querySelector: node };
full.getQueue = () => [];
async function run() {
  for (let tick = 0; tick < 200; tick++) {
    state = { ...state, currentTime: tick / 2 };
    full.updateState(state);
    mini.updateState(state);
  }
  await new Promise(setImmediate);
  assert.equal(lookups, 1, '100 seconds of position updates must do one offline lookup');
  assert.equal(covers, 2, 'position updates must keep both existing covers');
  assert.equal(writes.get('#full-title'), 1);
  assert.equal(writes.get('#np-title'), 1);
  assert.equal(node('#full-current').textContent, '1:39');
  assert.ok(parseFloat(node('#full-progress-fill').style.width) > 33);
  assert.equal(node('#player-download-btn').title, 'Saved Offline');
  full.isDraggingProgress = true;
  const width = node('#full-progress-fill').style.width;
  full.updateState({ ...state, currentTime: 250 });
  assert.equal(node('#full-progress-fill').style.width, width, 'native progress must not overwrite a drag');
  full.isDraggingProgress = false;
  state = { ...state, isPlaying: false };
  full.updateState(state); mini.updateState(state);
  assert.equal(lookups, 1, 'pausing does not require another disk lookup');
  assert.equal(node('#np-play-btn')['aria-label'], '재생');

  const pending = new Map();
  context.A.isTrackCached = id => new Promise(resolve => pending.set(id,resolve));
  state = { ...state, currentTrack: { id: 'old', title: 'Old' } };
  const old = full.updateOfflineButton();
  state = { ...state, currentTrack: { id: 'new', title: 'New' } };
  const latest = full.updateOfflineButton();
  pending.get('new')(false); await latest;
  pending.get('old')(true); await old;
  assert.equal(node('#player-download-btn').title, 'Save Offline', 'a late result must not overwrite another song');
  const refresh = full.updateOfflineButton();
  pending.get('new')(true); await refresh;
  assert.equal(node('#player-download-btn').title, 'Saved Offline', 'a completed save must refresh the button');
  console.log('PASS: 200 playback ticks preserve metadata/artwork/offline state, seek dragging and stale result guards');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
