"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { selectTrackTitle } = require("../dist/services/title");

test("a valid TITLE tag preserves the complete title when the filename has artist separators", () => {
    assert.equal(selectTrackTitle("The Lamia 170 - Resurrection", "Resurrection"), "The Lamia 170 - Resurrection");
    assert.equal(selectTrackTitle("The Lamia 170 - Resurrection (ANOTHER Ver.)", "Resurrection (ANOTHER Ver.)"), "The Lamia 170 - Resurrection (ANOTHER Ver.)");
});

test("missing or damaged TITLE tags retain the filename-derived title", () => {
    for (const tag of [undefined, "", "   ", "Track �", "Bad\u0000Title", "???+"]) {
        assert.equal(selectTrackTitle(tag, "Filename Title"), "Filename Title");
    }
});
