"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
// Integration tests must run with the pinned server dependencies installed.
const fastify = require('fastify');
const multipart = require('@fastify/multipart');

test('malformed login bodies produce a client error, never a server error', async () => {
    const app = fastify();
    await app.register(require('../dist/routes/auth').default);
    try {
        for (const payload of [undefined, null, {}, { username: 42, password: 'x' },
            { username: ['admin'], password: 'x' }, { username: 'a', password: {} }]) {
            const response = await app.inject({ method: 'POST', url: '/login', payload });
            assert.equal(response.statusCode, 400, response.body);
        }
    } finally { await app.close(); }
});

test('folder validation rejects traversal and malformed names before writing', async () => {
    const auth = require('../dist/middleware/auth');
    const previous = auth.authMiddleware;
    auth.authMiddleware = async request => { request.user = { username: 'test' }; };
    const app = fastify();
    try {
        await app.register(require('../dist/routes/upload').default);
        for (const payload of [null, { category: 1 }, { category: '../escape' },
            { category: 'a', album: '..' }, { category: 'a', album: 'b/c' }, { category: 'a\\b' }]) {
            const response = await app.inject({ method: 'POST', url: '/folder', payload });
            assert.equal(response.statusCode, 400, response.body);
        }
    } finally { auth.authMiddleware = previous; await app.close(); }
});

test('direct streaming returns correct suffix and clipped ranges and survives bad ranges', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'wavcloud-range-'));
    const file = path.join(directory, 'song.flac');
    await fs.writeFile(file, '0123456789');
    const auth = require('../dist/middleware/auth');
    const metadata = require('../dist/services/metadata');
    const originalAuth = auth.authMiddleware, originalLookup = metadata.getTrackById;
    const accel = process.env.USE_X_ACCEL;
    auth.authMiddleware = async request => { request.user = { username: 'test' }; };
    metadata.getTrackById = () => ({ filePath: file });
    process.env.USE_X_ACCEL = 'false';
    const app = fastify();
    try {
        await app.register(require('../dist/routes/stream').default);
        for (const [range, expected, contentRange] of [['bytes=-3', '789', 'bytes 7-9/10'],
            ['bytes=5-99', '56789', 'bytes 5-9/10'], ['bytes=2-', '23456789', 'bytes 2-9/10']]) {
            const response = await app.inject({ url: '/song', headers: { range } });
            assert.equal(response.statusCode, 206);
            assert.equal(response.body, expected);
            assert.equal(response.headers['content-range'], contentRange);
        }
        for (const range of ['bytes=bad-1', 'bytes=5-2', 'bytes=20-']) {
            assert.equal((await app.inject({ url: '/song', headers: { range } })).statusCode, 416);
        }
        assert.equal((await app.inject({ url: '/song' })).body, '0123456789');
        await fs.unlink(file);
        assert.equal((await app.inject({ url: '/song' })).statusCode, 404);
    } finally {
        auth.authMiddleware = originalAuth; metadata.getTrackById = originalLookup;
        if (accel === undefined) delete process.env.USE_X_ACCEL; else process.env.USE_X_ACCEL = accel;
        await app.close();
        await fs.rm(directory, { recursive: true, force: true });
    }
});

test('unsupported, empty and oversized uploads are rejected without publishing files', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'wavcloud-reject-'));
    const auth = require('../dist/middleware/auth');
    const config = require('../dist/config').config;
    const originalAuth = auth.authMiddleware, originalMusic = config.MUSIC_DIR;
    auth.authMiddleware = async request => { request.user = { username: 'test' }; };
    config.MUSIC_DIR = directory;
    const app = fastify();
    try {
        await app.register(multipart, { limits: { fileSize: 8 } });
        await app.register(require('../dist/routes/upload').default);
        for (const [name, content, status] of [['script.exe', 'bad', 415], ['empty.mp3', '', 400], ['large.mp3', '0123456789', 413]]) {
            const payload = `--b\r\nContent-Disposition: form-data; name="category"\r\n\r\nCategory\r\n` +
                `--b\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\n` +
                `Content-Type: audio/mpeg\r\n\r\n${content}\r\n--b--\r\n`;
            const response = await app.inject({ method: 'POST', url: '/', payload,
                headers: { 'content-type': 'multipart/form-data; boundary=b' } });
            assert.equal(response.statusCode, status, response.body);
        }
        assert.deepEqual(await fs.readdir(path.join(directory, 'test', '음악 앨범', 'Category')), []);
    } finally {
        auth.authMiddleware = originalAuth; config.MUSIC_DIR = originalMusic;
        await app.close();
        await fs.rm(directory, { recursive: true, force: true });
    }
});
