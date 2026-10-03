"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const run = promisify(execFile);

async function exists(filePath) {
    try {
        await fs.stat(filePath);
        return true;
    }
    catch (error) {
        if (error.code === "ENOENT") return false;
        throw error;
    }
}

function collision(filePath) {
    const error = new Error(`File already exists: ${path.basename(filePath)}`);
    error.code = "EEXIST";
    return error;
}

async function publishNoReplace(temporary, destination) {
    // Both paths are in the same directory. link() publishes without replacing an
    // existing file; rename() would silently overwrite one on Linux.
    await fs.link(temporary, destination);
    await fs.unlink(temporary);
}

async function convertWavToFlac(wavPath, flacPath, command = run) {
    if (await exists(flacPath)) throw collision(flacPath);
    const temporary = path.join(path.dirname(flacPath),
        `.${path.basename(flacPath)}.${randomUUID()}.tmp`);
    try {
        await command("ffmpeg", ["-nostdin", "-n", "-v", "error", "-i", wavPath,
            "-c:a", "flac", "-compression_level", "5", "-f", "flac", temporary]);
        const stat = await fs.stat(temporary);
        if (stat.size <= 1000) throw new Error("Converted FLAC is unexpectedly small");
        const { stdout } = await command("ffprobe", ["-v", "error", "-select_streams", "a:0",
            "-show_entries", "stream=codec_name", "-of", "default=noprint_wrappers=1:nokey=1", temporary]);
        if (String(stdout).trim() !== "flac") throw new Error("Converted file is not FLAC audio");
        await publishNoReplace(temporary, flacPath);
        // The WAV is removed only after a complete FLAC has been published.
        await fs.unlink(wavPath).catch(error => {
            console.warn(`Converted FLAC saved, but WAV could not be removed: ${error.message}`);
        });
        return flacPath;
    }
    finally {
        await fs.unlink(temporary).catch(error => {
            if (error.code !== "ENOENT") console.warn(`Could not remove conversion temp file: ${error.message}`);
        });
    }
}

async function ensureFlacForScan(filePath, command = run) {
    if (path.extname(filePath).toLowerCase() !== ".wav") return filePath;
    const flacPath = path.join(path.dirname(filePath), `${path.basename(filePath, path.extname(filePath))}.flac`);
    try {
        return await convertWavToFlac(filePath, flacPath, command);
    }
    catch (error) {
        // A same-named FLAC could be unrelated. Keep both files for review.
        if (error.code !== "EEXIST") console.error(`[Scan] WAV conversion failed for ${filePath}:`, error);
        return filePath;
    }
}

async function publishUpload(temporary, destination, command = run) {
    if (await exists(destination)) throw collision(destination);
    if (path.extname(destination).toLowerCase() === ".wav") {
        const flacPath = path.join(path.dirname(destination),
            `${path.basename(destination, path.extname(destination))}.flac`);
        if (await exists(flacPath)) throw collision(flacPath);
        try {
            return await convertWavToFlac(temporary, flacPath, command);
        }
        catch (error) {
            if (error.code === "EEXIST") throw error;
            console.error(`[Upload] WAV conversion failed for ${destination}; keeping WAV:`, error);
        }
    }
    await publishNoReplace(temporary, destination);
    return destination;
}

module.exports = { convertWavToFlac, ensureFlacForScan, publishUpload };
