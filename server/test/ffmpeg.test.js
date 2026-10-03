"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { ensureFlacForScan } = require("../dist/services/audio-files");

let available = true;
try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    execFileSync("ffprobe", ["-version"], { stdio: "ignore" });
}
catch { available = false; }
let metadataAvailable = true;
try { require.resolve("music-metadata"); require.resolve("sharp"); }
catch { metadataAvailable = false; }

test("real ffmpeg conversion creates decodable FLAC before WAV removal", { skip: !available }, async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "wavcloud-ffmpeg-test-"));
    try {
        const wav = path.join(directory, "tone.wav");
        const flac = path.join(directory, "tone.flac");
        execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-f", "lavfi", "-i",
            "sine=frequency=440:duration=1", wav]);
        assert.equal(await ensureFlacForScan(wav), flac);
        await assert.rejects(fs.stat(wav), { code: "ENOENT" });
        const codec = execFileSync("ffprobe", ["-v", "error", "-select_streams", "a:0",
            "-show_entries", "stream=codec_name", "-of", "default=noprint_wrappers=1:nokey=1", flac]);
        assert.equal(codec.toString().trim(), "flac");
    }
    finally {
        await fs.rm(directory, { recursive: true, force: true });
    }
});

test("uploaded tracks enter the in-memory index without a full rescan", {
    skip: !available || !metadataAvailable
}, async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "wavcloud-index-test-"));
    try {
        const metadata = require("../dist/services/metadata");
        const first = path.join(directory, "first.flac");
        const second = path.join(directory, "second.flac");
        const makeTone = file => execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-f", "lavfi",
            "-i", "sine=frequency=440:duration=0.2", "-c:a", "flac", file]);
        makeTone(first);
        const progress = [];
        const initial = await metadata.scanMusicDirectory("test-user", directory, state => progress.push(state));
        assert.equal(initial.length, 1);
        assert.ok(progress.some(state => state.phase === "discovering" && state.discovered === 1));
        assert.ok(progress.some(state => state.total === 1 && state.processed === 0));
        assert.ok(progress.some(state => state.processed === 1 && state.found === 1));
        await assert.rejects(metadata.scanMusicDirectory("test-user", path.join(directory, "missing")));
        assert.equal(metadata.getCachedTracks("test-user").length, 1, "a failed scan must preserve the old library");
        assert.equal(metadata.getTrackById("test-user", initial[0].id)?.filePath, first);
        makeTone(second);
        const updated = await metadata.indexUploadedTracks("test-user", [second]);
        assert.equal(updated.length, 2);
        assert.equal(metadata.getTrackById("test-user", updated[1].id)?.filePath, second);
    }
    finally {
        await fs.rm(directory, { recursive: true, force: true });
    }
});
