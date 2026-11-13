'use strict';
const path = require('node:path');

function isXAccelEnabled() {
  return process.env.USE_X_ACCEL === 'true';
}

function sendAccelRedirect(reply, filePath, contentType, disposition) {
  const musicDir = process.env.MUSIC_DIR || '/mnt/music';
  const relativePath = path.relative(musicDir, filePath);
  const encodedPath = relativePath.split(path.sep).map(encodeURIComponent).join('/');
  reply
    .header('X-Accel-Redirect', `/internal-media/${encodedPath}`)
    .header('Content-Type', contentType);
  if (disposition) {
    reply.header('Content-Disposition', disposition);
  }
  return reply.send();
}

module.exports = { isXAccelEnabled, sendAccelRedirect };
