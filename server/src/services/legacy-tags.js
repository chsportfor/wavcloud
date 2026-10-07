'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');

const utf8 = new TextDecoder('utf-8', { fatal: true });
const cp949 = new TextDecoder('euc-kr', { fatal: true });
const MAX_COMMENT_BYTES = 1024 * 1024;

async function readExactly(handle, length, position) {
  const buffer = Buffer.alloc(length);
  let read = 0;
  while (read < length) {
    const result = await handle.read(buffer, read, length - read, position + read);
    if (result.bytesRead === 0) return null;
    read += result.bytesRead;
  }
  return buffer;
}

function recoverArtistFromVorbisComments(block) {
  if (block.length < 8) return null;
  let position = 0;
  const vendorLength = block.readUInt32LE(position);
  position += 4 + vendorLength;
  if (position + 4 > block.length) return null;
  const count = block.readUInt32LE(position);
  position += 4;
  for (let index = 0; index < count && position + 4 <= block.length; index++) {
    const length = block.readUInt32LE(position);
    position += 4;
    if (length > block.length - position) return null;
    const comment = block.subarray(position, position + length);
    position += length;
    const separator = comment.indexOf(61);
    if (separator < 0 || comment.subarray(0, separator).toString('ascii').toLowerCase() !== 'artist')
      continue;
    const value = comment.subarray(separator + 1);
    try {
      utf8.decode(value);
      return null; // Valid UTF-8 should be handled by music-metadata.
    } catch {
      /* This library contains legacy encoded Vorbis comments. */
    }
    try {
      const recovered = cp949.decode(value).trim();
      if (recovered && !/[\u0000-\u001f\u007f\ufffd\ue000-\uf8ff]/u.test(recovered))
        return recovered;
    } catch {
      /* Keep the normal filename/folder fallback. */
    }
    return null;
  }
  return null;
}

async function recoverLegacyFlacArtist(filePath) {
  if (path.extname(filePath).toLowerCase() !== '.flac') return null;
  let handle;
  try {
    handle = await fs.open(filePath, 'r');
    const magic = await readExactly(handle, 4, 0);
    if (!magic || magic.toString('ascii') !== 'fLaC') return null;
    let position = 4;
    while (true) {
      const header = await readExactly(handle, 4, position);
      if (!header) return null;
      const isLast = !!(header[0] & 0x80);
      const type = header[0] & 0x7f;
      const length = header.readUIntBE(1, 3);
      position += 4;
      if (type === 4) {
        if (length > MAX_COMMENT_BYTES) return null;
        const block = await readExactly(handle, length, position);
        return block ? recoverArtistFromVorbisComments(block) : null;
      }
      if (isLast) return null;
      position += length;
    }
  } catch (error) {
    console.warn(`Could not inspect legacy artist tag in ${filePath}: ${error.message}`);
    return null;
  } finally {
    if (handle) await handle.close();
  }
}

module.exports = { recoverLegacyFlacArtist };
