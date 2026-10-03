"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
const jwt = require("jsonwebtoken");
const root = process.env.WAVCLOUD_SERVER_ROOT || path.join(__dirname, "..");
const { config } = require(path.join(root, "dist/config"));

async function main() {
    const token = jwt.sign({ username: config.AUTH_USERNAME }, config.JWT_SECRET, { expiresIn: "10m" });
    const request = async (suffix, method = "GET") => {
        const response = await fetch(`http://127.0.0.1:3000/api/tracks${suffix}`, {
            method, headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000)
        });
        assert.equal(response.status, method === "POST" ? 202 : 200);
        return response.json();
    };
    const previousTracks = await request("/");
    const started = await request("/scan/start", "POST");
    assert.equal(started.status, "running");
    const duplicate = await request("/scan/start", "POST");
    assert.equal(duplicate.id, started.id, "repeated starts must reuse the active scan");
    let intermediate = false;
    let previousProcessed = 0;
    let previousStep = -1;
    let job = started;
    const deadline = Date.now() + 300000;
    while (job.status === "running" && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        job = await request("/scan/status");
        assert.equal(job.id, started.id);
        assert.ok(job.processed >= previousProcessed);
        previousProcessed = job.processed;
        if (job.total && job.processed > 0 && job.processed < job.total) intermediate = true;
        const step = job.total ? Math.floor(job.processed / job.total * 10) : -1;
        if (step > previousStep) {
            previousStep = step;
            console.log(`Scan progress: ${job.processed}/${job.total}, found ${job.found}`);
        }
    }
    assert.equal(job.status, "completed", job.error || "Scan did not complete");
    assert.equal(job.processed, job.total);
    assert.ok(Number.isInteger(job.failed) && job.failed >= 0, "read failures must be counted");
    assert.ok(job.found >= 1000);
    assert.ok(intermediate, "live intermediate progress must be observable");
    const tracks = await request("/");
    assert.equal(tracks.length, job.found);
    const ids = new Set(tracks.map(track => track.id));
    assert.ok(previousTracks.every(track => ids.has(track.id)), "the scan must preserve previously indexed tracks");
    assert.ok(tracks.some(track => track.title === "The Lamia 170 - Resurrection"));
    assert.equal(tracks.filter(track => track.artist?.includes("\ufffd")).length, 0);
    console.log(`PASS: live incremental progress, deduplicated jobs, completed index (${tracks.length} tracks, ${job.failed} unreadable files), title/composer preservation`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
