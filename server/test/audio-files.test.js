"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { ensureFlacForScan, publishUpload } = require("../dist/services/audio-files");
const { getAudioFormat, downloadDisposition } = require("../dist/utils/audio-format");

async function withDirectory(action) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "wavcloud-server-test-"));
    try { await action(directory); }
    finally { await fs.rm(directory, { recursive: true, force: true }); }
}

async function conversionCommand(command, args) {
    if (command === "ffmpeg") {
        await fs.writeFile(args.at(-1), Buffer.alloc(2048, 1));
        return { stdout: "" };
    }
    if (command === "ffprobe") return { stdout: "flac\n" };
    throw new Error(`Unexpected command: ${command}`);
}

test("scan preserves WAV when an unrelated same-name FLAC already exists", async () => {
    await withDirectory(async directory => {
        const wav = path.join(directory, "song.wav");
        const flac = path.join(directory, "song.flac");
        await fs.writeFile(wav, "new recording");
        await fs.writeFile(flac, "older recording");
        assert.equal(await ensureFlacForScan(wav, conversionCommand), wav);
        assert.equal(await fs.readFile(wav, "utf8"), "new recording");
        assert.equal(await fs.readFile(flac, "utf8"), "older recording");
    });
});

test("successful conversion publishes FLAC before removing WAV", async () => {
    await withDirectory(async directory => {
        const wav = path.join(directory, "song.wav");
        const flac = path.join(directory, "song.flac");
        await fs.writeFile(wav, "source audio");
        assert.equal(await ensureFlacForScan(wav, conversionCommand), flac);
        assert.equal((await fs.stat(flac)).size, 2048);
        await assert.rejects(fs.stat(wav), { code: "ENOENT" });
    });
});

test("failed conversion leaves the WAV and removes partial output", async () => {
    await withDirectory(async directory => {
        const wav = path.join(directory, "song.wav");
        await fs.writeFile(wav, "source audio");
        const fail = async (_command, args) => {
            await fs.writeFile(args.at(-1), "partial");
            throw new Error("ffmpeg failed");
        };
        assert.equal(await ensureFlacForScan(wav, fail), wav);
        assert.equal(await fs.readFile(wav, "utf8"), "source audio");
        assert.deepEqual(await fs.readdir(directory), ["song.wav"]);
    });
});

test("upload never replaces an existing file and retains WAV if conversion fails", async () => {
    await withDirectory(async directory => {
        const existing = path.join(directory, "song.mp3");
        const temporary = path.join(directory, ".upload.tmp");
        await fs.writeFile(existing, "existing audio");
        await fs.writeFile(temporary, "new audio");
        await assert.rejects(publishUpload(temporary, existing), { code: "EEXIST" });
        assert.equal(await fs.readFile(existing, "utf8"), "existing audio");
        const wav = path.join(directory, "song.wav");
        const fail = async () => { throw new Error("ffmpeg failed"); };
        assert.equal(await publishUpload(temporary, wav, fail), wav);
        assert.equal(await fs.readFile(wav, "utf8"), "new audio");
    });
});

test("download advertises the source file's real audio format", () => {
    assert.deepEqual(getAudioFormat("song.flac"), { extension: ".flac", mime: "audio/flac" });
    assert.deepEqual(getAudioFormat("song.mp3"), { extension: ".mp3", mime: "audio/mpeg" });
    assert.match(downloadDisposition("song.flac", "한글 앨범"), /filename\*=UTF-8''[^;]+\.flac/);
});
