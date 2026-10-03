"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { recoverLegacyFlacArtist } = require("../dist/services/legacy-tags");

function taggedFlac(value) {
    const vendor = Buffer.from("test", "ascii");
    const comment = Buffer.concat([Buffer.from("ARTIST=", "ascii"), value]);
    const block = Buffer.alloc(4 + vendor.length + 4 + 4 + comment.length);
    let offset = 0;
    block.writeUInt32LE(vendor.length, offset); offset += 4;
    vendor.copy(block, offset); offset += vendor.length;
    block.writeUInt32LE(1, offset); offset += 4;
    block.writeUInt32LE(comment.length, offset); offset += 4;
    comment.copy(block, offset);
    const header = Buffer.from([0x84, block.length >> 16, block.length >> 8, block.length]);
    return Buffer.concat([Buffer.from("fLaC", "ascii"), header, block]);
}

test("recovers CP949 encoded Japanese composer from malformed FLAC comment", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "wavcloud-tag-test-"));
    try {
        const file = path.join(directory, "song.flac");
        await fs.writeFile(file, taggedFlac(Buffer.from("636f734d6f40f8ecf1cb50", "hex")));
        assert.equal(await recoverLegacyFlacArtist(file), "cosMo@暴走P");
        await fs.writeFile(file, taggedFlac(Buffer.from("cosMo@暴走P", "utf8")));
        assert.equal(await recoverLegacyFlacArtist(file), null);
    }
    finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test("malformed or unrelated files do not produce a guessed artist", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "wavcloud-tag-test-"));
    try {
        const file = path.join(directory, "song.flac");
        await fs.writeFile(file, Buffer.from("fLaC\x84\x00\x00\x10bad", "binary"));
        assert.equal(await recoverLegacyFlacArtist(file), null);
        assert.equal(await recoverLegacyFlacArtist(path.join(directory, "song.mp3")), null);
    }
    finally { await fs.rm(directory, { recursive: true, force: true }); }
});
