"use strict";
const path = require("node:path");

const MIME_TYPES = {
    ".mp3": "audio/mpeg",
    ".flac": "audio/flac",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".wav": "audio/wav"
};

function getAudioFormat(filePath) {
    const extension = path.extname(filePath).toLowerCase();
    return { extension, mime: MIME_TYPES[extension] || "application/octet-stream" };
}

function downloadDisposition(filePath, title) {
    const { extension } = getAudioFormat(filePath);
    const stem = String(title || "track").replace(/[\u0000-\u001f\u007f/\\?%*:|"<>]/g, "-").trim() || "track";
    const filename = `${stem}${extension}`;
    const encoded = encodeURIComponent(filename).replace(/['()*]/g,
        character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
    return `attachment; filename="track${extension}"; filename*=UTF-8''${encoded}`;
}

module.exports = { getAudioFormat, downloadDisposition };
