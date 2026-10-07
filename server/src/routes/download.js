'use strict';

exports.default = downloadRoutes;
const fsModule = require('fs');
const metadataModule = require('../services/metadata');
const authModule = require('../middleware/auth');
const { getAudioFormat, downloadDisposition } = require('../utils/audio-format');
async function downloadRoutes(fastify) {
  fastify.addHook('preHandler', authModule.authMiddleware);
  fastify.get('/:id', async (request, reply) => {
    const username = request.user.username;
    const { id } = request.params;
    const track = metadataModule.getTrackById(username, id);
    if (!track) {
      return reply.status(404).send({ error: 'Track not found' });
    }
    try {
      const stat = await fsModule.promises.stat(track.filePath);
      const contentType = getAudioFormat(track.filePath).mime;
      const disposition = downloadDisposition(track.filePath, track.title);
      if (process.env.USE_X_ACCEL === 'true') {
        const path = require('path');
        const musicDir = process.env.MUSIC_DIR || '/mnt/music';
        const relativePath = path.relative(musicDir, track.filePath);
        const encodedPath = relativePath.split(path.sep).map(encodeURIComponent).join('/');
        return reply
          .header('X-Accel-Redirect', `/internal-media/${encodedPath}`)
          .header('Content-Type', contentType)
          .header('Content-Disposition', disposition)
          .send();
      }
      const stream = fsModule.createReadStream(track.filePath);
      return reply
        .header('Content-Type', contentType)
        .header('Content-Disposition', disposition)
        .header('Content-Length', stat.size)
        .send(stream);
    } catch (error) {
      fastify.log.error(`Error downloading track ${id}: ${String(error)}`);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
