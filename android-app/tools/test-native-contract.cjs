const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');

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
  w: { getStreamUrl: id => `/stream/${id}`, getArtworkUrl: id => `/art/${id}` },
  uiResolvedArtworkUrl: track => track.id === 'hq' ? 'https://example.test/hq.jpg' : '',
  localStorage: { setItem() {} },
  performance: { now: () => clock },
  CustomEvent: class { constructor(type) { this.type = type; } },
  P() {}
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('android-app/tools/native-bridge.js', 'utf8'), context);

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
  queue: [{ id: 'hq', title: 'HQ', artist: 'Artist', album: 'Album', artworkUri: 'https://example.test/hq.jpg' }]
}));
assert.equal(p.queue.length, 1);
assert.equal(p.state.currentTrack.id, 'hq');
assert.equal(p.state.volume, 0.7);

context.window.__wavcloudNativeState(JSON.stringify({
  trackId: 'restored', isPlaying: false, isLoading: false, currentTime: 12, duration: 180, volume: 0.7,
  queue: [{ id: 'restored', title: 'Restored', artist: 'Artist', album: 'Album', artworkUri: 'https://example.test/restored.jpg' }]
}));
assert.equal(p.queue[0].artworkUri, 'https://example.test/restored.jpg');
assert.equal(p.state.currentTrack.id, 'restored');

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
