const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('android-app/web-src/scripts/cloud-dark.js', 'utf8');
const playerSource = fs.readFileSync('android-app/web-src/scripts/player-view.js', 'utf8');
const functionSource = source.slice(source.indexOf('function cloudUpcomingQueue('), source.indexOf('const cloudRenderPlayer ='));
const context = {};
vm.createContext(context);
vm.runInContext(functionSource, context);
const project = (queue, state) => {
  const result = context.cloudUpcomingQueue(queue.map(id => ({ id })), state);
  return {
    order: Array.from(result.indices, index => queue[index]),
    next: result.nextIndex < 0 ? null : queue[result.nextIndex],
    hint: result.hint
  };
};

assert.deepEqual(project(['a', 'b', 'c', 'd'], { currentTrack: { id: 'b' }, repeat: 'none', shuffle: false }).order, ['c', 'd']);
assert.equal(project(['a', 'b', 'c', 'd'], { currentTrack: { id: 'b' }, repeat: 'none', shuffle: false }).next, 'c');
assert.equal(project(['a', 'b', 'd', 'c'], { currentTrack: { id: 'b' }, repeat: 'none', shuffle: false }).next, 'd', 'reordering must update the next badge');
assert.deepEqual(project(['a', 'b', 'c'], { currentTrack: { id: 'b' }, repeat: 'all', shuffle: false }).order, ['c', 'a']);
assert.equal(project(['a', 'b'], { currentTrack: { id: 'b' }, repeat: 'none', shuffle: false }).next, null);
assert.equal(project(['a', 'b', 'c'], { currentTrack: { id: 'b' }, repeat: 'one', shuffle: false }).next, null);
assert.match(project(['a', 'b', 'c'], { currentTrack: { id: 'b' }, repeat: 'one', shuffle: false }).hint, /한 곡 반복/);
assert.equal(project(['a', 'b', 'c'], { currentTrack: { id: 'b' }, repeat: 'none', shuffle: true }).next, null);
assert.match(project(['a', 'b', 'c'], { currentTrack: { id: 'b' }, repeat: 'none', shuffle: true }).hint, /셔플/);
assert.equal(project(['a', 'b'], { currentTrack: null, repeat: 'none', shuffle: false }).next, 'a');
assert.match(playerSource, /\.queue-item\.cloud-next.*scrollIntoView/, 'opening the queue should reveal the next track');
console.log('PASS: queue display follows playback order, reorder, repeat, and shuffle');
