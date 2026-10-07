const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('android-app/web-src/scripts/library-ui.js', 'utf8');
const start = source.indexOf('async function uiRefreshOfflineBadge(');
const end = source.length;
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
const otherRows = ['search', 'playlist', 'offline'].map(view => ({
  view,
  dataset: { id: 'song' },
  badge: { hidden: true },
  querySelector(selector) { return selector === '.ui-offline-badge' ? this.badge : null; }
}));
const context = {
  A: { isTrackCached: async id => saved.has(id) },
  window: { addEventListener: (name, listener) => listeners.set(name, listener) },
  document: { querySelectorAll: selector => selector.startsWith('.library-view ')
    ? [row, ...otherRows] : [row] }
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
  for (const item of otherRows) assert.equal(item.badge.hidden, true);
  assert.equal(download.title, '오프라인으로 저장');

  saved.add('song');
  listeners.get('offline:downloaded')({ detail: 'song' });
  await new Promise(setImmediate);
  assert.equal(badge.hidden, false, 'downloading again must restore the badge');
  for (const item of otherRows) assert.equal(item.badge.hidden, false, `${item.view} badges must also update`);
  console.log('PASS: album, search, playlist and offline badges update after download and removal');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
