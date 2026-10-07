'use strict';
const { createScanJobs } = require('./scan-jobs');
const metadata = require('./metadata');
// Startup scans and HTTP requests share the same running job and status.
const scanJobs = createScanJobs((...args) => metadata.scanMusicDirectory(...args));
function libraryStatus(username) {
  return { ...scanJobs.get(username), ...metadata.getLibraryState(username) };
}
async function restoreLibraries(users, musicDirectory) {
  const path = require('node:path');
  for (const username of users) await metadata.restoreLibrary(username, path.join(musicDirectory, username));
}
async function refreshLibraries(users, musicDirectory) {
  const path = require('node:path');
  for (const username of users) {
    try { await scanJobs.start(username, path.join(musicDirectory, username)).promise; }
    catch { /* A failed refresh leaves restored tracks available. */ }
  }
}
module.exports = { scanJobs, libraryStatus, restoreLibraries, refreshLibraries };
