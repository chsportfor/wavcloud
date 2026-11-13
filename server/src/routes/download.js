'use strict';

exports.default = downloadRoutes;
const fsModule = require('fs');
const metadataModule = require('../services/metadata');
const authModule = require('../middleware/auth');
const { getAudioFormat, downloadDisposition } = require('../utils/audio-format');
const { isXAccelEnabled, sendAccelRedirect } = require('../utils/x-accel');
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
      if (isXAccelEnabled()) {
        return sendAccelRedirect(reply, track.filePath, contentType, disposition);
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
