'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { generateId } = require('../utils/hash');
const pendingWrites = new Map();
const MAX_BYTES = 64 * 1024 * 1024;

function snapshotPath(cacheDirectory, username) {
  return path.join(cacheDirectory, createHash('sha256').update(username).digest('hex') + '.json');
}
function validEntry(entry, directory) {
  const track = entry?.track;
  if (!track || typeof track.filePath !== 'string' || typeof track.title !== 'string' ||
      typeof track.id !== 'string' || track.id !== generateId(track.filePath) ||
      (track.artist != null && typeof track.artist !== 'string') ||
      (track.album != null && typeof track.album !== 'string') ||
      typeof track.hasArtwork !== 'boolean' || !Number.isFinite(entry.size) || entry.size < 0 ||
      !Number.isFinite(entry.mtimeMs) || track.fileSize !== entry.size) return false;
  const relative = path.relative(directory, track.filePath);
  return relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}
async function readSnapshot(cacheDirectory, username, directory) {
  const file = snapshotPath(cacheDirectory, username);
  try {
    const stat = await fs.stat(file);
    if (stat.size > MAX_BYTES) throw new Error('Metadata snapshot is too large');
    const snapshot = JSON.parse(await fs.readFile(file, 'utf8'));
    if (snapshot.version !== 1 || snapshot.username !== username ||
        snapshot.directory !== path.resolve(directory) || !Array.isArray(snapshot.entries) ||
        !snapshot.entries.every(entry => validEntry(entry, snapshot.directory))) {
      throw new Error('Invalid metadata snapshot');
    }
    if (new Set(snapshot.entries.map(entry => entry.track.id)).size !== snapshot.entries.length) throw new Error('Duplicate snapshot track');
    return snapshot;
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn('Metadata snapshot could not be restored:', error.message);
    return null;
  }
}
function writeSnapshot(cacheDirectory, username, directory, entries) {
  const file = snapshotPath(cacheDirectory, username);
  const payload = JSON.stringify({ version: 1, username, directory: path.resolve(directory), entries });
  const task = (pendingWrites.get(file) || Promise.resolve()).catch(() => {}).then(async () => {
    await fs.mkdir(cacheDirectory, { recursive: true });
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporary, payload, { mode: 0o600, flag: 'wx' });
      await fs.rename(temporary, file);
    } finally { await fs.rm(temporary, { force: true }); }
  });
  pendingWrites.set(file, task);
  const cleanup = () => { if (pendingWrites.get(file) === task) pendingWrites.delete(file); };
  task.then(cleanup, cleanup);
  return task;
}
module.exports = { readSnapshot, writeSnapshot, snapshotPath };
