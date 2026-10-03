"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createScanJobs } = require("../dist/services/scan-jobs");

test("scan jobs expose live progress, share active work, and isolate users", async () => {
    let finish;
    let report;
    let calls = 0;
    const jobs = createScanJobs(async (username, directory, progress) => {
        calls++;
        report = progress;
        await new Promise(resolve => { finish = resolve; });
        return [{ id: "song" }];
    });
    const job = jobs.start("alice", "/music/alice");
    await Promise.resolve();
    report({ phase: "indexing", processed: 1, total: 3, currentFile: "日本語.flac" });
    assert.equal(jobs.start("alice", "/music/alice").state.id, job.state.id);
    assert.equal(calls, 1);
    assert.deepEqual(jobs.get("bob"), { status: "idle" });
    const progress = jobs.get("alice");
    assert.equal(progress.processed, 1);
    progress.processed = 999;
    assert.equal(jobs.get("alice").processed, 1);
    finish();
    await job.promise;
    assert.equal(jobs.get("alice").status, "completed");
    assert.equal(jobs.get("alice").found, 1);
    assert.equal(jobs.get("alice").currentFile, "");
});

test("failed scans expose a safe failure and allow another attempt", async () => {
    const jobs = createScanJobs(async () => { throw new Error("private path"); });
    const job = jobs.start("alice", "/music/alice");
    await assert.rejects(job.promise, /private path/);
    assert.equal(jobs.get("alice").status, "failed");
    assert.doesNotMatch(jobs.get("alice").error, /private path/);
    const retry = jobs.start("alice", "/music/alice");
    assert.notEqual(retry.state.id, job.state.id);
    await assert.rejects(retry.promise);
});
