const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');

const runtimeSource = fs.readFileSync('android-app/web-src/scripts/runtime.js', 'utf8');
const classStart = runtimeSource.indexOf('class _{constructor(){');
const constructorEnd = runtimeSource.indexOf('setupNetworkWatch(){', classStart);
assert.ok(classStart >= 0 && constructorEnd > classStart, 'native player constructor must be found');
const probeContext = {
  window: { WavCloudAndroid: {} },
  localStorage: { getItem: () => null },
  Audio: class { constructor() { throw new Error('Browser audio must not start in Android'); } },
  v: (object, key, value) => { object[key] = value; }
};
vm.createContext(probeContext);
vm.runInContext(runtimeSource.slice(classStart, constructorEnd) +
  'setupNetworkWatch(){throw Error("Browser network watcher started")}'+
  'setupListeners(){throw Error("Browser audio listeners started")}'+
  'setupMediaSession(){throw Error("Browser media session started")}}'+
  'globalThis.NativeRuntimeProbe=_;', probeContext);
assert.equal(new probeContext.NativeRuntimeProbe().audios.length, 0);

const calls = [];
const listeners = new Map();
let spectrumLevel = 72;
let clock = 100;
const initialTrack = { id: 'one', title: 'First', artist: 'Artist', album: 'Album' };
const p = {
  queue: [initialTrack],
  state: {
    currentTrack: initialTrack,
    currentTime: 1,
    duration: 120,
    isPlaying: false,
    isLoading: false,
    volume: 0.5,
    repeat: 'none',
    shuffle: false
  },
  getQueue() { return [...this.queue]; },
  getState() { return this.state; },
  updateState(next) { this.state = { ...this.state, ...next }; },
  emitQueueChange() { context.window.dispatchEvent({ type: 'player:queue-changed' }); },
  setQueue(tracks) { this.queue = [...tracks]; this.emitQueueChange(); },
  addToQueue(tracks) { this.queue.push(...(Array.isArray(tracks) ? tracks : [tracks])); this.emitQueueChange(); },
  playNextInQueue(tracks) { this.queue.splice(1, 0, ...(Array.isArray(tracks) ? tracks : [tracks])); this.emitQueueChange(); },
  removeFromQueue(index) { this.queue.splice(index, 1); this.emitQueueChange(); },
  reorderQueue(from, to) { this.queue.splice(to, 0, this.queue.splice(from, 1)[0]); this.emitQueueChange(); },
  clearQueue() { this.queue = []; this.emitQueueChange(); }
};
const native = new Proxy({}, {
  get(_target, method) {
    if (method === 'getSpectrum') return () => JSON.stringify(new Array(64).fill(spectrumLevel));
    return (...args) => calls.push([method, ...args]);
  }
});
const context = {
  window: {
    WavCloudAndroid: native,
    addEventListener(type, listener) { listeners.set(type, listener); },
    dispatchEvent(event) { listeners.get(event.type)?.(event); }
  },
  p,
  w: { isAuthenticated: () => true, getStreamUrl: id => `/stream/${id}`, getArtworkUrl: id => `/art/${id}` },
  uiResolvedArtworkUrl: track => track.id === 'hq' ? 'https://example.test/hq.jpg' : '',
  localStorage: { setItem() {} },
  performance: { now: () => clock },
  CustomEvent: class { constructor(type) { this.type = type; } },
  P() {}
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('android-app/tools/native-bridge.js', 'utf8'), context);
const startupOrder = [];
vm.runInNewContext(fs.readFileSync('android-app/web-src/scripts/bootstrap.js', 'utf8'), {
  document: { readyState: 'complete' },
  K: class { constructor() { startupOrder.push('ui'); } },
  window: { WavCloudAndroid: { requestState() { startupOrder.push('state'); } } }
});
assert.deepEqual(startupOrder, ['ui', 'state'], 'restore must be requested after the player UI exists');

async function run() {
const originalQueue = p.queue;
context.window.__wavcloudNativeProgress(JSON.stringify({
  trackId: 'one',
  currentTime: 42,
  duration: 120,
  isPlaying: true,
  isLoading: false
}));
assert.equal(p.state.currentTrack, initialTrack, 'progress must preserve current track');
assert.equal(p.queue, originalQueue, 'progress must not rebuild the queue');
assert.equal(p.state.currentTime, 42);
assert.equal(p.state.isPlaying, true);
context.window.__wavcloudNativeProgress(JSON.stringify({
  trackId: 'another', currentTime: 99, duration: 100, isPlaying: true, isLoading: false
}));
assert.equal(p.state.currentTime, 42, 'late progress for another track must be ignored');

context.window.__wavcloudNativeState(JSON.stringify({
  trackId: 'hq',
  isPlaying: true,
  isLoading: false,
  currentTime: 3,
  duration: 180,
  volume: 0.7,
  repeat: 'all',
  shuffle: true,
  queue: [{ id: 'hq', title: 'HQ', artist: 'Artist', album: 'Album', artworkUri: 'https://example.test/hq.jpg' }]
}));
assert.equal(p.queue.length, 1);
assert.equal(p.state.currentTrack.id, 'hq');
assert.equal(p.state.volume, 0.7);
assert.equal(p.state.repeat, 'all', 'native repeat mode must be restored');
assert.equal(p.state.shuffle, true, 'native shuffle mode must be restored');

context.window.__wavcloudNativeState(JSON.stringify({
  trackId: 'hq', isPlaying: false, isLoading: false, currentTime: 4,
  duration: 180, volume: 0.7, repeat: 'one', shuffle: false
}));
assert.equal(p.queue.length, 1, 'state-only event must preserve the queue');
assert.equal(p.state.repeat, 'one');
assert.equal(p.state.shuffle, false);

context.window.__wavcloudNativeState(JSON.stringify({
  trackId: 'restored', isPlaying: false, isLoading: false, currentTime: 12, duration: 180, volume: 0.7,
  queue: [{ id: 'restored', title: 'Restored', artist: 'Artist', album: 'Album', artworkUri: 'https://example.test/restored.jpg' }]
}));
assert.equal(p.queue[0].artworkUri, 'https://example.test/restored.jpg');
assert.equal(p.state.currentTrack.id, 'restored');
await Promise.resolve();
assert.equal(calls.filter(call => call[0] === 'syncQueue').length, 0,
  'restoring the native queue must not echo an incomplete queue back to Android');

p.play(p.queue[0]);
const setQueue = calls.find(call => call[0] === 'setQueue');
assert.ok(setQueue, 'playing a track must send the native queue');
assert.equal(JSON.parse(setQueue[1])[0].artworkUri, 'https://example.test/restored.jpg', 'restored covers must survive a replay');
const spectrum = new Uint8Array(64);
p.getByteFrequencyData(spectrum);
assert.ok(spectrum.every(value => value === 72), 'playing spectrum must use native audio data');
spectrumLevel = 0;
clock += 100;
p.getByteFrequencyData(spectrum);
assert.ok(spectrum.every(value => value === 0), 'silence must not create a synthetic spectrum');
p.state.isPlaying = false;
spectrumLevel = 90;
clock += 100;
p.getByteFrequencyData(spectrum);
assert.ok(spectrum.every(value => value === 0), 'paused playback must hide stale spectrum');
await Promise.resolve();
assert.equal(calls.filter(call => call[0] === 'syncQueue').length, 0, 'playing after setQueue should not sync twice');

const syncsBeforeArtwork = calls.filter(call => call[0] === 'syncQueue').length;
p.queue[0].artworkUri = 'https://example.test/new-cover.jpg';
p.emitQueueChange();
await Promise.resolve();
assert.equal(calls.filter(call => call[0] === 'syncQueue').length, syncsBeforeArtwork + 1,
  'updated artwork must sync even when track IDs are unchanged');
context.window.dispatchEvent({ type: 'offline:downloaded' });
await Promise.resolve();
assert.equal(calls.filter(call => call[0] === 'syncQueue').length, syncsBeforeArtwork + 2,
  'a downloaded file must refresh the native queue URI');

const next = { id: 'next', title: 'Next', artist: 'Artist', album: 'Album' };
p.playNextInQueue(next);
await Promise.resolve();
assert.deepEqual(JSON.parse(calls.at(-1)[1]).map(item => item.id), ['restored', 'next'], 'play next must reach Android');
p.reorderQueue(1, 0);
await Promise.resolve();
assert.deepEqual(JSON.parse(calls.at(-1)[1]).map(item => item.id), ['next', 'restored'], 'reordering must reach Android');
p.clearQueue();
await Promise.resolve();
assert.equal(calls.at(-1)[1], '[]', 'clearing must reach Android');

context.window.__wavcloudNativeState(JSON.stringify({
  trackId: '', isPlaying: false, isLoading: false, currentTime: 0, duration: 0, volume: 0.7, queue: []
}));
assert.equal(p.state.currentTrack, null, 'empty native session must clear the current track');
console.log('PASS: native progress, queue insertion/reorder/clear, restored artwork, and spectrum');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
