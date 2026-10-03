"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const { createLibraryStore } = require('../dist/services/library-store');

test('uploads are visible immediately and survive a concurrent scan', () => {
    const store = createLibraryStore();
    store.upsert('a', [{ id: 'old' }, { id: 'deleted' }]);
    const scan = store.beginScan('a');
    store.upsert('a', [{ id: 'new' }, { id: 'old', title: 'updated' }]);
    assert.equal(store.track('a', 'new').id, 'new');
    store.commitScan(scan, [{ id: 'old', title: 'stale' }]);
    assert.deepEqual(store.tracks('a'), [{ id: 'old', title: 'updated' }, { id: 'new' }]);
    assert.equal(store.track('a', 'deleted'), undefined);
    assert.deepEqual(store.tracks('b'), []);
});

test('failed scans preserve the library and uploads and permit a new scan', () => {
    const store = createLibraryStore();
    store.upsert('a', [{ id: 'old' }]);
    const scan = store.beginScan('a');
    assert.throws(() => store.beginScan('a'));
    store.upsert('a', [{ id: 'new' }]);
    store.cancelScan(scan);
    const replacement = store.beginScan('a');
    assert.throws(() => store.commitScan(scan, []));
    assert.deepEqual(store.tracks('a').map(t => t.id), ['old', 'new']);
    store.cancelScan(replacement);
});
