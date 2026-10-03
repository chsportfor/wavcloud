"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
const jwt = require("jsonwebtoken");
const serverRoot = process.env.WAVCLOUD_SERVER_ROOT || path.join(__dirname, "..");
const { config } = require(path.join(serverRoot, "dist/config"));

async function main() {
    const token = jwt.sign({ username: config.AUTH_USERNAME }, config.JWT_SECRET, { expiresIn: "5m" });
    const response = await fetch("http://127.0.0.1:3000/api/tracks/", {
        headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(response.status, 200, `Track API returned ${response.status}`);
    const tracks = await response.json();
    assert.ok(tracks.length >= 1000, `Expected music library; found ${tracks.length} tracks`);
    const expected = new Map([
        ["01 w_tre - Mer - ESPITZ Gt.NeLiME - The Lamia 170 - Resurrection.flac", "The Lamia 170 - Resurrection"],
        ["06 w_tre - Mer - ESPITZ Gt.NeLiME - The Lamia 170 - Resurrection (ANOTHER Ver.).flac", "The Lamia 170 - Resurrection (ANOTHER Ver.)"]
    ]);
    for (const [filename, title] of expected) {
        const track = tracks.find(item => item.filePath.endsWith(`/${filename}`));
        assert.ok(track, `Missing track ${filename}`);
        assert.equal(track.title, title);
        console.log(`${filename}: ${track.title}`);
    }
    console.log(`Verified ${tracks.length} indexed tracks`);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
