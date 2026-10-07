'use strict';
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });

exports.parseTrackMetadata = parseTrackMetadata;
exports.scanMusicDirectory = scanMusicDirectory;
exports.indexUploadedTracks = indexUploadedTracks;
exports.getCachedTracks = getCachedTracks;
exports.getTrackById = getTrackById;
exports.getArtwork = getArtwork;
const fsModule = require('fs');
const pathModule = require('path');
const mm = require('music-metadata');
const sharpModule = require('sharp');
const hashModule = require('../utils/hash');
const { ensureFlacForScan } = require('./audio-files');
const { recoverLegacyFlacArtist } = require('./legacy-tags');
const { selectTrackTitle } = require('./title');
const { createLibraryStore } = require('./library-store');
const libraryStore = createLibraryStore();
const { config } = require('../config');
const { readSnapshot, writeSnapshot } = require('./metadata-snapshots');
const fingerprintLibraries = new Map();
const libraryStates = new Map();
exports.restoreLibrary = restoreLibrary;
exports.getLibraryState = getLibraryState;
function getLibraryState(username) {
  return libraryStates.get(username) || { libraryReady: false, fromSnapshot: false };
}
async function restoreLibrary(username, directory) {
  const snapshot = await readSnapshot(config.LIBRARY_CACHE_DIR, username, directory);
  if (!snapshot) return false;
  fingerprintLibraries.set(username, new Map(snapshot.entries.map(entry => [entry.track.filePath, entry])));
  libraryStore.upsert(username, snapshot.entries.map(entry => entry.track));
  libraryStates.set(username, { libraryReady: true, fromSnapshot: true });
  return true;
}
async function persistLibrary(username, directory) {
  const fingerprints = fingerprintLibraries.get(username) || new Map();
  const entries = libraryStore.tracks(username).map(track => fingerprints.get(track.filePath)).filter(Boolean);
  try { await writeSnapshot(config.LIBRARY_CACHE_DIR, username, directory, entries); }
  catch (error) { console.warn('Metadata snapshot could not be saved:', error.message); }
}
const AUDIO_EXTENSIONS = ['.wav', '.mp3', '.flac', '.ogg', '.m4a'];
async function artworkFingerprint(directory) {
  const names = (await fsModule.promises.readdir(directory))
    .filter(name => /^(cover|folder|album|artwork)\.(jpg|jpeg|png)$/i.test(name)).sort();
  return JSON.stringify(await Promise.all(names.map(async name => {
    const stat = await fsModule.promises.stat(pathModule.join(directory, name));
    return [name, stat.size, stat.mtimeMs];
  })));
}
async function walkDir(dir, onFile = () => {}) {
  let results = [];
  try {
    const list = await fsModule.promises.readdir(dir);
    for (const file of list) {
      const fullPath = pathModule.resolve(dir, file);
      const stat = await fsModule.promises.stat(fullPath);
      const ext = pathModule.extname(file).toLowerCase();
      if (stat && stat.isDirectory()) {
        results = results.concat(await walkDir(fullPath, onFile));
      } else if (AUDIO_EXTENSIONS.includes(ext)) {
        results.push(fullPath);
        onFile();
      }
    }
  } catch (err) {
    console.error(`Error walking directory ${dir}:`, err);
    throw err;
  }
  return results;
}
function isCorruptString(str) {
  if (str.includes('\ufffd') || str.includes('+++') || str.includes('&&&')) return true;
  const plusCount = (str.match(/\+/g) || []).length;
  const questionCount = (str.match(/\?/g) || []).length;
  return plusCount >= 3 || plusCount + questionCount >= 4;
}
async function parseTrackMetadata(filePath) {
  try {
    const stat = await fsModule.promises.stat(filePath);
    const metadata = await mm.parseFile(filePath, { duration: true, skipCovers: false });
    const id = hashModule.generateId(filePath);
    // Always parse Title and Artist from the filename first
    const basename = pathModule.basename(filePath, pathModule.extname(filePath));
    // Remove track number prefixes like "01 ", "01. ", "01-", "01 - "
    const cleanFilename = basename
      .replace(/^\d+[\s.-]+/, '')
      .replace(/^\d+\s+/, '')
      .trim();
    let title = '';
    let artist = '';
    // Check if filename contains separator like " - "
    const parts = cleanFilename.split(/\s+-\s+/);
    if (parts.length > 1) {
      if (parts.length > 2) {
        // e.g. "Artist - Album - 01 TrackTitle"
        artist = parts[0].trim();
        const rawTitle = parts[parts.length - 1].trim();
        title = rawTitle
          .replace(/^\d+[\s.-]+/, '')
          .replace(/^\d+\s+/, '')
          .trim();
      } else {
        // e.g. "Artist - TrackTitle"
        artist = parts[0].trim();
        title = parts[1].trim();
      }
    } else {
      title = cleanFilename;
    }
    title = selectTrackTitle(metadata.common.title, title);
    // Determine final artist
    let finalArtist = '';
    const metaArtist = metadata.common.artist;
    if (artist) {
      // Filename had "Artist - Title" format
      finalArtist = artist;
    } else {
      // Filename had just "Title" format
      // Clean metadata artist if present and valid
      let cleanMetaArtist = metaArtist || '';
      if (cleanMetaArtist.includes('\ufffd')) {
        cleanMetaArtist = (await recoverLegacyFlacArtist(filePath)) || cleanMetaArtist;
      }
      if (cleanMetaArtist && isCorruptString(cleanMetaArtist)) {
        const featIdx = cleanMetaArtist.toLowerCase().indexOf('feat.');
        if (featIdx !== -1) {
          const prefix = cleanMetaArtist.substring(0, featIdx).replace(/[\s&,-]+$/, '').trim();
          if (!isCorruptString(prefix)) {
            cleanMetaArtist = prefix;
          } else {
            cleanMetaArtist = '';
          }
        } else {
          cleanMetaArtist = '';
        }
      }
      // Check if metadata artist is clean and not a track number prefix (like "02 City People")
      if (
        cleanMetaArtist &&
        !/^\d+/.test(cleanMetaArtist.trim()) &&
        cleanMetaArtist.trim() !== cleanFilename
      ) {
        finalArtist = cleanMetaArtist.trim();
      } else {
        // Fallback to parent folder prefix (e.g. "Cosmograph" from "Cosmograph - WE ALIVE")
        const parentName = pathModule.basename(pathModule.dirname(filePath));
        const folderParts = parentName.split(/\s+-\s+/);
        if (folderParts.length > 1) {
          finalArtist = folderParts[0].trim();
        }
      }
    }
    let hasArtwork = metadata.common.picture && metadata.common.picture.length > 0;
    if (!hasArtwork) {
      try {
        const dir = pathModule.dirname(filePath);
        const files = fsModule.readdirSync(dir);
        const coverNames = ['cover', 'folder', 'album', 'artwork'];
        hasArtwork = files.some((file) => {
          const ext = pathModule.extname(file).toLowerCase();
          const name = pathModule.basename(file, ext).toLowerCase();
          return (ext === '.jpg' || ext === '.jpeg' || ext === '.png') && coverNames.includes(name);
        });
      } catch (err) {
        // Ignore errors
      }
    }
    return {
      id,
      title: title || cleanFilename,
      artist: finalArtist || null,
      album: metadata.common.album || pathModule.basename(pathModule.dirname(filePath)),
      duration: metadata.format.duration || null,
      sampleRate: metadata.format.sampleRate || null,
      bitsPerSample: metadata.format.bitsPerSample || null,
      channels: metadata.format.numberOfChannels || null,
      filePath,
      fileSize: stat.size,
      hasArtwork: !!hasArtwork,
    };
  } catch (error) {
    console.error(`Error parsing metadata for ${filePath}:`, error);
    return null;
  }
}
async function scanMusicDirectory(username, dir, onProgress = () => {}) {
  const scan = libraryStore.beginScan(username);
  try {
    console.log(`Scanning music directory for ${username}: ${dir}`);
    let discovered = 0;
    const files = [
      ...new Set(
        await walkDir(dir, () => {
          onProgress({ phase: 'discovering', discovered: ++discovered });
        }),
      ),
    ];
    const tracks = [];
    const seen = new Set();
    let processed = 0;
    let failed = 0;
    let reused = 0;
    const previous = fingerprintLibraries.get(username) || new Map();
    const indexed = new Map();
    const artworkDirectories = new Map();
    onProgress({ phase: 'indexing', total: files.length, processed, found: 0, failed });
    for (const file of files) {
      const isWav = pathModule.extname(file).toLowerCase() === '.wav';
      onProgress({
        phase: isWav ? 'converting' : 'indexing',
        currentFile: pathModule.basename(file),
      });
      const finalFile = isWav ? await ensureFlacForScan(file) : file;
      const stat = await fsModule.promises.stat(finalFile);
      const folder = pathModule.dirname(finalFile);
      if (!artworkDirectories.has(folder)) artworkDirectories.set(folder, artworkFingerprint(folder));
      const artwork = await artworkDirectories.get(folder);
      const cached = previous.get(finalFile);
      const unchanged = cached && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs && cached.artwork === artwork;
      const track = unchanged ? cached.track : await parseTrackMetadata(finalFile);
      if (unchanged) reused++;
      if (track) indexed.set(finalFile, { track, size: stat.size, mtimeMs: stat.mtimeMs, artwork });
      if (track && !seen.has(track.id)) {
        tracks.push(track);
        seen.add(track.id);
      }
      if (!track) failed++;
      onProgress({ processed: ++processed, found: tracks.length, failed, reused });
    }
    const committed = libraryStore.commitScan(scan, tracks);
    // Include uploads published while this scan was awaiting file IO.
    const current = fingerprintLibraries.get(username) || new Map();
    for (const track of committed) {
      if (!indexed.has(track.filePath) && current.has(track.filePath)) indexed.set(track.filePath, current.get(track.filePath));
    }
    fingerprintLibraries.set(username, indexed);
    libraryStates.set(username, { libraryReady: true, fromSnapshot: false });
    await persistLibrary(username, dir);
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
  const fingerprints = fingerprintLibraries.get(username) || new Map();
  fingerprintLibraries.set(username, fingerprints);
  for (const file of files) {
    const track = await parseTrackMetadata(file);
    if (!track) continue;
    tracks.push(track);
    const stat = await fsModule.promises.stat(file);
    fingerprints.set(file, { track, size: stat.size, mtimeMs: stat.mtimeMs,
      artwork: await artworkFingerprint(pathModule.dirname(file)) });
    artworkCache.delete(`${username}:${track.id}`);
  }
  const merged = libraryStore.upsert(username, tracks);
  await persistLibrary(username, pathModule.join(config.MUSIC_DIR, username));
  return merged;
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
  if (!track || !track.hasArtwork) return null;
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
    const dir = pathModule.dirname(track.filePath);
    const files = await fsModule.promises.readdir(dir);
    const coverNames = ['cover', 'folder', 'album', 'artwork'];
    for (const file of files) {
      const ext = pathModule.extname(file).toLowerCase();
      const name = pathModule.basename(file, ext).toLowerCase();
      if ((ext === '.jpg' || ext === '.jpeg' || ext === '.png') && coverNames.includes(name)) {
        const filePath = pathModule.join(dir, file);
        const stat = await fsModule.promises.stat(filePath);
        if (stat.size > 0) {
          rawBuffer = await fsModule.promises.readFile(filePath);
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
        const resized = await sharpModule(rawBuffer)
          .resize(300, 300, { fit: 'cover' })
          .jpeg({ quality: 80 })
          .toBuffer();
        const result = { data: resized, format: 'image/jpeg' };
        artworkCache.set(cacheKey, result);
        if (artworkCache.size > MAX_ARTWORK_CACHE_ENTRIES)
          artworkCache.delete(artworkCache.keys().next().value);
        return result;
      } catch (err) {
        const result = { data: rawBuffer, format: 'image/jpeg' };
        artworkCache.set(cacheKey, result);
        if (artworkCache.size > MAX_ARTWORK_CACHE_ENTRIES)
          artworkCache.delete(artworkCache.keys().next().value);
        return result;
      }
    }
  } catch (error) {
    console.error(`Error extracting artwork for ${track.filePath}:`, error);
  }
  return null;
}
