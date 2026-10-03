"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTrackMetadata = parseTrackMetadata;
exports.scanMusicDirectory = scanMusicDirectory;
exports.indexUploadedTracks = indexUploadedTracks;
exports.getCachedTracks = getCachedTracks;
exports.getTrackById = getTrackById;
exports.getArtwork = getArtwork;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const mm = __importStar(require("music-metadata"));
const sharp_1 = __importDefault(require("sharp"));
const hash_1 = require("../utils/hash");
const { ensureFlacForScan } = require("./audio-files");
const { recoverLegacyFlacArtist } = require("./legacy-tags");
const { selectTrackTitle } = require("./title");
const { createLibraryStore } = require('./library-store');
const libraryStore = createLibraryStore();
const AUDIO_EXTENSIONS = ['.wav', '.mp3', '.flac', '.ogg', '.m4a'];
async function walkDir(dir, onFile = () => {}) {
    let results = [];
    try {
        const list = await fs_1.default.promises.readdir(dir);
        for (const file of list) {
            const fullPath = path_1.default.resolve(dir, file);
            const stat = await fs_1.default.promises.stat(fullPath);
            const ext = path_1.default.extname(file).toLowerCase();
            if (stat && stat.isDirectory()) {
                results = results.concat(await walkDir(fullPath, onFile));
            }
            else if (AUDIO_EXTENSIONS.includes(ext)) {
                results.push(fullPath);
                onFile();
            }
        }
    }
    catch (err) {
        console.error(`Error walking directory ${dir}:`, err);
        throw err;
    }
    return results;
}
function isCorruptString(str) {
    if (str.includes('\ufffd') || str.includes('+++') || str.includes('&&&'))
        return true;
    const plusCount = (str.match(/\+/g) || []).length;
    const questionCount = (str.match(/\?/g) || []).length;
    return plusCount >= 3 || (plusCount + questionCount) >= 4;
}
async function parseTrackMetadata(filePath) {
    try {
        const stat = await fs_1.default.promises.stat(filePath);
        const metadata = await mm.parseFile(filePath, { duration: true, skipCovers: false });
        const id = (0, hash_1.generateId)(filePath);
        // Always parse Title and Artist from the filename first
        const basename = path_1.default.basename(filePath, path_1.default.extname(filePath));
        // Remove track number prefixes like "01 ", "01. ", "01-", "01 - "
        const cleanFilename = basename.replace(/^\d+[\s.-]+/, '').replace(/^\d+\s+/, '').trim();
        let title = '';
        let artist = '';
        // Check if filename contains separator like " - "
        const parts = cleanFilename.split(/\s+-\s+/);
        if (parts.length > 1) {
            if (parts.length > 2) {
                // e.g. "Artist - Album - 01 TrackTitle"
                artist = parts[0].trim();
                const rawTitle = parts[parts.length - 1].trim();
                title = rawTitle.replace(/^\d+[\s.-]+/, '').replace(/^\d+\s+/, '').trim();
            }
            else {
                // e.g. "Artist - TrackTitle"
                artist = parts[0].trim();
                title = parts[1].trim();
            }
        }
        else {
            title = cleanFilename;
        }
        title = selectTrackTitle(metadata.common.title, title);
        // Determine final artist
        let finalArtist = '';
        const metaArtist = metadata.common.artist;
        if (artist) {
            // Filename had "Artist - Title" format
            finalArtist = artist;
        }
        else {
            // Filename had just "Title" format
            // Clean metadata artist if present and valid
            let cleanMetaArtist = metaArtist || '';
            if (cleanMetaArtist.includes('\ufffd')) {
                cleanMetaArtist = await recoverLegacyFlacArtist(filePath) || cleanMetaArtist;
            }
            if (cleanMetaArtist && isCorruptString(cleanMetaArtist)) {
                const featIdx = cleanMetaArtist.toLowerCase().indexOf('feat.');
                if (featIdx !== -1) {
                    const prefix = cleanMetaArtist.substring(0, featIdx).replace(/[\s&,-]+$/, '').trim();
                    if (!isCorruptString(prefix)) {
                        cleanMetaArtist = prefix;
                    }
                    else {
                        cleanMetaArtist = '';
                    }
                }
                else {
                    cleanMetaArtist = '';
                }
            }
            // Check if metadata artist is clean and not a track number prefix (like "02 City People")
            if (cleanMetaArtist && !/^\d+/.test(cleanMetaArtist.trim()) && cleanMetaArtist.trim() !== cleanFilename) {
                finalArtist = cleanMetaArtist.trim();
            }
            else {
                // Fallback to parent folder prefix (e.g. "Cosmograph" from "Cosmograph - WE ALIVE")
                const parentName = path_1.default.basename(path_1.default.dirname(filePath));
                const folderParts = parentName.split(/\s+-\s+/);
                if (folderParts.length > 1) {
                    finalArtist = folderParts[0].trim();
                }
            }
        }
        let hasArtwork = metadata.common.picture && metadata.common.picture.length > 0;
        if (!hasArtwork) {
            try {
                const dir = path_1.default.dirname(filePath);
                const files = fs_1.default.readdirSync(dir);
                const coverNames = ['cover', 'folder', 'album', 'artwork'];
                hasArtwork = files.some(file => {
                    const ext = path_1.default.extname(file).toLowerCase();
                    const name = path_1.default.basename(file, ext).toLowerCase();
                    return (ext === '.jpg' || ext === '.jpeg' || ext === '.png') && coverNames.includes(name);
                });
            }
            catch (err) {
                // Ignore errors
            }
        }
        return {
            id,
            title: title || cleanFilename,
            artist: finalArtist || null,
            album: metadata.common.album || path_1.default.basename(path_1.default.dirname(filePath)),
            duration: metadata.format.duration || null,
            sampleRate: metadata.format.sampleRate || null,
            bitsPerSample: metadata.format.bitsPerSample || null,
            channels: metadata.format.numberOfChannels || null,
            filePath,
            fileSize: stat.size,
            hasArtwork: !!hasArtwork
        };
    }
    catch (error) {
        console.error(`Error parsing metadata for ${filePath}:`, error);
        return null;
    }
}
async function scanMusicDirectory(username, dir, onProgress = () => {}) {
    const scan = libraryStore.beginScan(username);
    try {
    console.log(`Scanning music directory for ${username}: ${dir}`);
    let discovered = 0;
    const files = [...new Set(await walkDir(dir, () => {
        onProgress({ phase: 'discovering', discovered: ++discovered });
    }))];
    const tracks = [];
    const seen = new Set();
    let processed = 0;
    let failed = 0;
    onProgress({ phase: 'indexing', total: files.length, processed, found: 0, failed });
    for (const file of files) {
        const isWav = path_1.default.extname(file).toLowerCase() === '.wav';
        onProgress({ phase: isWav ? 'converting' : 'indexing', currentFile: path_1.default.basename(file) });
        const finalFile = isWav ? await ensureFlacForScan(file) : file;
        const track = await parseTrackMetadata(finalFile);
        if (track && !seen.has(track.id)) {
            tracks.push(track);
            seen.add(track.id);
        }
        if (!track) failed++;
        onProgress({ processed: ++processed, found: tracks.length, failed });
    }
    const committed = libraryStore.commitScan(scan, tracks);
    artworkCache.clear();
    console.log(`Scan complete for ${username}. Found ${committed.length} tracks.`);
    return committed;
    } catch (error) {
        libraryStore.cancelScan(scan);
        throw error;
    }
}
async function indexUploadedTracks(username, files) {
    const tracks = [];
    for (const file of files) {
        const track = await parseTrackMetadata(file);
        if (!track) continue;
        tracks.push(track);
        artworkCache.delete(`${username}:${track.id}`);
    }
    return libraryStore.upsert(username, tracks);
}
function getCachedTracks(username) {
    return libraryStore.tracks(username);
}
function getTrackById(username, id) {
    return libraryStore.track(username, id);
}
const artworkCache = new Map();
const MAX_ARTWORK_CACHE_ENTRIES = 256;
async function getArtwork(username, id) {
    const track = getTrackById(username, id);
    if (!track || !track.hasArtwork)
        return null;
    const cacheKey = `${username}:${id}`;
    if (artworkCache.has(cacheKey)) {
        const cached = artworkCache.get(cacheKey);
        artworkCache.delete(cacheKey);
        artworkCache.set(cacheKey, cached);
        return cached;
    }
    try {
        let rawBuffer = null;
        // 1. Try directory cover file first (extremely fast, no audio parsing!)
        const dir = path_1.default.dirname(track.filePath);
        const files = await fs_1.default.promises.readdir(dir);
        const coverNames = ['cover', 'folder', 'album', 'artwork'];
        for (const file of files) {
            const ext = path_1.default.extname(file).toLowerCase();
            const name = path_1.default.basename(file, ext).toLowerCase();
            if ((ext === '.jpg' || ext === '.jpeg' || ext === '.png') && coverNames.includes(name)) {
                const filePath = path_1.default.join(dir, file);
                const stat = await fs_1.default.promises.stat(filePath);
                if (stat.size > 0) {
                    rawBuffer = await fs_1.default.promises.readFile(filePath);
                    break;
                }
            }
        }
        // 2. Fallback to embedded artwork
        if (!rawBuffer) {
            const metadata = await mm.parseFile(track.filePath);
            const picture = metadata.common.picture?.[0];
            if (picture) {
                rawBuffer = Buffer.from(picture.data);
            }
        }
        if (rawBuffer) {
            try {
                const resized = await (0, sharp_1.default)(rawBuffer)
                    .resize(300, 300, { fit: 'cover' })
                    .jpeg({ quality: 80 })
                    .toBuffer();
                const result = { data: resized, format: 'image/jpeg' };
                artworkCache.set(cacheKey, result);
                if (artworkCache.size > MAX_ARTWORK_CACHE_ENTRIES) artworkCache.delete(artworkCache.keys().next().value);
                return result;
            }
            catch (err) {
                const result = { data: rawBuffer, format: 'image/jpeg' };
                artworkCache.set(cacheKey, result);
                if (artworkCache.size > MAX_ARTWORK_CACHE_ENTRIES) artworkCache.delete(artworkCache.keys().next().value);
                return result;
            }
        }
    }
    catch (error) {
        console.error(`Error extracting artwork for ${track.filePath}:`, error);
    }
    return null;
}
