'use strict';

exports.default = uploadRoutes;
const authModule = require('../middleware/auth');
const configModule = require('../config');
const metadataModule = require('../services/metadata');
const fsModule = require('fs');
const pathModule = require('path');
const promisesModule = require('stream/promises');
const { randomUUID } = require('node:crypto');
const { publishUpload } = require('../services/audio-files');
const { validFolderName } = require('../utils/request-validation');
// Root music directory: /mnt/music/<username>/음악 앨범
function getMusicRoot(username) {
  const root = pathModule.join(configModule.config.MUSIC_DIR, username, '음악 앨범');
  if (!fsModule.existsSync(root)) {
    fsModule.mkdirSync(root, { recursive: true });
  }
  return root;
}
// Helper to prevent path traversal and escaping the music root
function isSafeSubPath(parent, child) {
  const relative = pathModule.relative(parent, child);
  return !!(relative && !relative.startsWith('..') && !pathModule.isAbsolute(relative));
}
async function uploadRoutes(fastify) {
  fastify.addHook('preHandler', authModule.authMiddleware);
  // GET /api/upload/folders — Return folder structure as JSON
  fastify.get('/folders', async (request, reply) => {
    try {
      const username = request.user.username;
      const root = getMusicRoot(username);
      const categories = fsModule
        .readdirSync(root, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort();
      const structure = {};
      for (const cat of categories) {
        const catPath = pathModule.join(root, cat);
        const albums = fsModule
          .readdirSync(catPath, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name)
          .sort();
        structure[cat] = albums;
      }
      return reply.send(structure);
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Failed to read folder structure' });
    }
  });
  // POST /api/upload/folder — Create a new folder
  fastify.post('/folder', async (request, reply) => {
    try {
      const username = request.user.username;
      const { category, album } = request.body || {};
      if (!validFolderName(category) || !validFolderName(album, true)) {
        return reply.status(400).send({ error: 'Invalid category or album name' });
      }
      const root = getMusicRoot(username);
      const targetPath = pathModule.resolve(root, category.trim(), album ? album.trim() : '');
      if (!isSafeSubPath(root, targetPath)) {
        return reply.status(400).send({ error: 'Path traversal detected or invalid directory' });
      }
      if (fsModule.existsSync(targetPath)) {
        return reply.status(409).send({ error: 'Folder already exists' });
      }
      fsModule.mkdirSync(targetPath, { recursive: true });
      return reply.send({ success: true, path: targetPath });
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Failed to create folder' });
    }
  });
  // POST /api/upload — Upload music file(s)
  fastify.post('/', async (request, reply) => {
    try {
      const username = request.user.username;
      const parts = request.parts();
      let category = '';
      let album = '';
      const uploadedFiles = [];
      for await (const part of parts) {
        if (part.type === 'field') {
          if (part.fieldname === 'category' || part.fieldname === 'album') {
            if (!validFolderName(part.value, part.fieldname === 'album')) {
              return reply.status(400).send({ error: 'Invalid category or album name' });
            }
            if (part.fieldname === 'category') category = part.value.trim();
            else album = part.value.trim();
          }
        } else if (part.type === 'file') {
          if (!category) {
            return reply.status(400).send({ error: 'Category is required' });
          }
          const root = getMusicRoot(username);
          const targetDir = pathModule.resolve(root, category, album);
          if (!isSafeSubPath(root, targetDir)) {
            return reply.status(400).send({ error: 'Invalid upload directory' });
          }
          // Ensure directory exists
          if (!fsModule.existsSync(targetDir)) {
            fsModule.mkdirSync(targetDir, { recursive: true });
          }
          const safeFilename = pathModule.basename(String(part.filename || '').replace(/\\/g, '/'));
          if (!safeFilename || safeFilename === '.' || safeFilename === '..') {
            return reply.status(400).send({ error: 'Invalid filename' });
          }
          if (
            !['.wav', '.mp3', '.flac', '.ogg', '.m4a'].includes(
              pathModule.extname(safeFilename).toLowerCase(),
            )
          ) {
            return reply.status(415).send({ error: 'Unsupported audio format' });
          }
          const filePath = pathModule.join(targetDir, safeFilename);
          const temporary = pathModule.join(targetDir, `.${randomUUID()}.upload`);
          try {
            const writeStream = fsModule.createWriteStream(temporary, { flags: 'wx', mode: 0o600 });
            await promisesModule.pipeline(part.file, writeStream);
            if (part.file.truncated) {
              throw Object.assign(new Error('Upload exceeds the file size limit'), {
                statusCode: 413,
              });
            }
            if ((await fsModule.promises.stat(temporary)).size === 0) {
              throw Object.assign(new Error('Uploaded audio is empty'), { statusCode: 400 });
            }
            const finalFilePath = await publishUpload(temporary, filePath);
            uploadedFiles.push(finalFilePath);
            await metadataModule.indexUploadedTracks(username, [finalFilePath]);
          } finally {
            await fsModule.promises.unlink(temporary).catch((error) => {
              if (error.code !== 'ENOENT')
                fastify.log.warn(error, 'Could not remove upload temp file');
            });
          }
        }
      }
      if (uploadedFiles.length === 0) {
        return reply.status(400).send({ error: 'No files uploaded' });
      }
      return reply.send({
        success: true,
        uploaded: uploadedFiles.length,
        files: uploadedFiles.map((f) => pathModule.basename(f)),
      });
    } catch (err) {
      if (err.statusCode === 400 || err.statusCode === 413) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      if (err.code === 'FST_REQ_FILE_TOO_LARGE') {
        return reply.status(413).send({ error: 'Upload exceeds the file size limit' });
      }
      if (err.code === 'EEXIST') {
        return reply.status(409).send({ error: 'A file with that name already exists' });
      }
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Upload failed' });
    }
  });
}
