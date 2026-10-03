"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseByteRange } = require('../dist/utils/byte-range');

test('byte ranges support suffixes, open ends and clipping', () => {
    assert.deepEqual(parseByteRange('bytes=2-5', 10), { start: 2, end: 5, length: 4 });
    assert.deepEqual(parseByteRange('bytes=2-', 10), { start: 2, end: 9, length: 8 });
    assert.deepEqual(parseByteRange('bytes=-3', 10), { start: 7, end: 9, length: 3 });
    assert.deepEqual(parseByteRange('bytes=-20', 10), { start: 0, end: 9, length: 10 });
    assert.deepEqual(parseByteRange('bytes=5-99', 10), { start: 5, end: 9, length: 5 });
});

test('invalid ranges cannot create invalid streams or content lengths', () => {
    for (const header of ['bytes=10-', 'bytes=5-2', 'bytes=abc-2', 'bytes=-0', 'bytes=-', 'bytes=9007199254740993-']) {
        assert.deepEqual(parseByteRange(header, 10), { invalid: true }, header);
    }
    assert.deepEqual(parseByteRange('bytes=0-', 0), { invalid: true });
    for (const header of [undefined, 'items=0-1', 'bytes=0-1,5-6']) assert.equal(parseByteRange(header, 10), null);
});
