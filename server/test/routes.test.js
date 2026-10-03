"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

let fastify;
let multipart;
try {
    fastify = require("fastify");
    multipart = require("@fastify/multipart");
}
catch { /* Route tests run on the server or after npm ci. */ }

function multipartBody(filename, contents) {
    const boundary = "wavcloud-test-boundary";
    const body = Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="category"\r\n\r\nCategory\r\n` +
        `--${boundary}\r\nContent-Disposition: form-data; name="album"\r\n\r\nAlbum\r\n` +
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
        `Content-Type: audio/mpeg\r\n\r\n${contents}\r\n--${boundary}--\r\n`
    );
    return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

test("scan start returns promptly and status reports progress without starting another scan", { skip: !fastify }, async () => {
    const auth = require("../dist/middleware/auth");
    const metadata = require("../dist/services/metadata");
    const previousAuth = auth.authMiddleware;
    const previousScan = metadata.scanMusicDirectory;
    let finish;
    let calls = 0;
    auth.authMiddleware = async request => { request.user = { username: "scan-route-user" }; };
    metadata.scanMusicDirectory = async (username, directory, progress) => {
        calls++;
        progress({ phase: "indexing", total: 2, processed: 1, found: 1 });
        await new Promise(resolve => { finish = resolve; });
        progress({ processed: 2, found: 2 });
        return [{ id: "a" }, { id: "b" }];
    };
    const app = fastify();
    try {
        await app.register(require("../dist/routes/tracks").default, { prefix: "/api/tracks" });
        const start = await app.inject({ method: "POST", url: "/api/tracks/scan/start" });
        assert.equal(start.statusCode, 202);
        const second = await app.inject({ method: "POST", url: "/api/tracks/scan/start" });
        assert.equal(second.json().id, start.json().id);
        assert.equal(calls, 1);
        const status = await app.inject({ url: "/api/tracks/scan/status" });
        assert.equal(status.headers["cache-control"], "no-store");
        assert.equal(status.json().processed, 1);
        finish();
        await new Promise(resolve => setImmediate(resolve));
        const done = await app.inject({ url: "/api/tracks/scan/status" });
        assert.equal(done.json().status, "completed");
        assert.equal(done.json().found, 2);
    } finally {
        finish?.();
        await app.close();
        auth.authMiddleware = previousAuth;
        metadata.scanMusicDirectory = previousScan;
    }
});

test("upload publishes complete files and refuses to replace existing audio", { skip: !fastify }, async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "wavcloud-route-test-"));
    const auth = require("../dist/middleware/auth");
    const metadata = require("../dist/services/metadata");
    const config = require("../dist/config");
    const previousAuth = auth.authMiddleware;
    const previousIndex = metadata.indexUploadedTracks;
    const previousMusic = config.config.MUSIC_DIR;
    auth.authMiddleware = async request => { request.user = { username: "test-user" }; };
    metadata.indexUploadedTracks = async () => [];
    config.config.MUSIC_DIR = directory;
    const app = fastify();
    try {
        await app.register(multipart);
        await app.register(require("../dist/routes/upload").default, { prefix: "/api/upload" });
        const first = multipartBody("song.mp3", "complete audio");
        const firstResponse = await app.inject({ method: "POST", url: "/api/upload", payload: first.body,
            headers: { "content-type": first.contentType } });
        assert.equal(firstResponse.statusCode, 200, firstResponse.body);
        const saved = path.join(directory, "test-user", "음악 앨범", "Category", "Album", "song.mp3");
        assert.equal(await fs.readFile(saved, "utf8"), "complete audio");
        const second = multipartBody("song.mp3", "different audio");
        const secondResponse = await app.inject({ method: "POST", url: "/api/upload", payload: second.body,
            headers: { "content-type": second.contentType } });
        assert.equal(secondResponse.statusCode, 409, secondResponse.body);
        assert.equal(await fs.readFile(saved, "utf8"), "complete audio");
    }
    finally {
        await app.close();
        auth.authMiddleware = previousAuth;
        metadata.indexUploadedTracks = previousIndex;
        config.config.MUSIC_DIR = previousMusic;
        await fs.rm(directory, { recursive: true, force: true });
    }
});

test("FLAC download responds with FLAC MIME type and extension", { skip: !fastify }, async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "wavcloud-download-test-"));
    const file = path.join(directory, "song.flac");
    await fs.writeFile(file, "audio");
    const auth = require("../dist/middleware/auth");
    const metadata = require("../dist/services/metadata");
    const previousAuth = auth.authMiddleware;
    const previousLookup = metadata.getTrackById;
    const previousAccel = process.env.USE_X_ACCEL;
    auth.authMiddleware = async request => { request.user = { username: "test-user" }; };
    metadata.getTrackById = () => ({ filePath: file, title: "한글 제목" });
    process.env.USE_X_ACCEL = "true";
    const app = fastify();
    try {
        await app.register(require("../dist/routes/download").default, { prefix: "/api/download" });
        const response = await app.inject({ method: "GET", url: "/api/download/test" });
        assert.equal(response.statusCode, 200, response.body);
        assert.equal(response.headers["content-type"], "audio/flac");
        assert.match(response.headers["content-disposition"], /filename\*=UTF-8''[^;]+\.flac/);
    }
    finally {
        await app.close();
        auth.authMiddleware = previousAuth;
        metadata.getTrackById = previousLookup;
        if (previousAccel === undefined) delete process.env.USE_X_ACCEL;
        else process.env.USE_X_ACCEL = previousAccel;
        await fs.rm(directory, { recursive: true, force: true });
    }
});
