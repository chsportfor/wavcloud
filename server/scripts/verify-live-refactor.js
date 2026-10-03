"use strict";
const assert = require('node:assert/strict');
require('dotenv').config({ path: '/opt/cloudmusic/server/.env' });
const { config } = require('/opt/cloudmusic/server/dist/config');
const jwt = require('jsonwebtoken');

async function verify() {
    const token = jwt.sign({ username: config.AUTH_USERNAME }, config.JWT_SECRET, { expiresIn: '60s' });
    const headers = { Authorization: `Bearer ${token}` };
    const origin = 'https://wavcloud.duckdns.org';
    const request = (route, options = {}) => fetch(origin + route, { ...options, signal: AbortSignal.timeout(15000) });
    assert.equal((await request('/api/tracks')).status, 401);
    const malformed = await request('/api/auth/login', { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 42, password: 'x' }) });
    const expected = process.argv.includes('--baseline') ? 500 : 400;
    assert.equal(malformed.status, expected);
    const response = await request('/api/tracks', { headers });
    assert.equal(response.status, 200);
    const tracks = await response.json();
    assert.ok(Array.isArray(tracks) && tracks.length > 0);
    const formats = {};
    for (const track of tracks) {
        const extension = require('node:path').extname(track.filePath).toLowerCase();
        formats[extension] = (formats[extension] || 0) + 1;
    }
    const scan = await request('/api/tracks/scan/status', { headers });
    assert.equal(scan.status, 200);
    const job = await scan.json();
    for (const range of ['bytes=0-31', 'bytes=-32']) {
        const media = await request(`/api/stream/${encodeURIComponent(tracks[0].id)}`, { headers: { ...headers, Range: range } });
        assert.equal(media.status, 206);
        assert.equal((await media.arrayBuffer()).byteLength, 32);
    }
    const download = await request(`/api/download/${encodeURIComponent(tracks[0].id)}`, { headers, method: 'HEAD' });
    assert.equal(download.status, 200);
    assert.ok(download.headers.get('content-disposition')?.includes('attachment'));
    console.log(JSON.stringify({ unauthorized: 401, malformedLogin: malformed.status, tracks: tracks.length,
        formats, scanStatus: job.status, streamRanges: '206 / 32 bytes', download: download.status }));
    if (job.status === 'running') throw new Error('A live library scan is running; defer deployment');
}
verify().catch(error => { console.error(error.message); process.exitCode = 1; });
