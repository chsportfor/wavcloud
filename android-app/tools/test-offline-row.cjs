const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('android-app/web-src/scripts/library-view.js', 'utf8');
const start = source.indexOf('async function uiRefreshOfflineBadge(');
const end = source.indexOf('const uiOriginalRows =', start);
assert.ok(start >= 0 && end > start);

const saved = new Set(['song']);
const listeners = new Map();
const badge = { hidden: true };
const download = { title: '' };
const row = {
  dataset: { id: 'song' },
  querySelector: selector => selector === '.ui-offline-badge' ? badge :
    selector === '.download-btn' ? download : null
};
const context = {
  A: { isTrackCached: async id => saved.has(id) },
  window: { addEventListener: (name, listener) => listeners.set(name, listener) },
  document: { querySelectorAll: () => [row] }
};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);

async function run() {
  await context.uiRefreshOfflineBadge(row);
  assert.equal(badge.hidden, false, 'saved albums must show the offline badge');
  assert.equal(download.title, '오프라인 저장 삭제');

  saved.delete('song');
  listeners.get('offline:removed')({ detail: 'song' });
  await new Promise(setImmediate);
  assert.equal(badge.hidden, true, 'removing a download must hide the badge');
  assert.equal(download.title, '오프라인으로 저장');

  saved.add('song');
  listeners.get('offline:downloaded')({ detail: 'song' });
  await new Promise(setImmediate);
  assert.equal(badge.hidden, false, 'downloading again must restore the badge');
  console.log('PASS: album offline badges update after download and removal');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
