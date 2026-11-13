'use strict';

exports.default = streamRoutes;
const fsModule = require('fs');
const metadataModule = require('../services/metadata');
const authModule = require('../middleware/auth');
const { getAudioFormat } = require('../utils/audio-format');
const { parseByteRange } = require('../utils/byte-range');
const { isXAccelEnabled, sendAccelRedirect } = require('../utils/x-accel');
async function streamRoutes(fastify) {
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
      if (!stat.isFile()) return reply.status(404).send({ error: 'Track file not found' });
      const fileSize = stat.size;
      const range = request.headers.range;
      const contentType = getAudioFormat(track.filePath).mime;
      fastify.log.info(`Stream requested for track ${id}, range: ${range}`);
      if (isXAccelEnabled()) {
        fastify.log.info(`Redirecting via X-Accel-Redirect for track ${id}`);
        return sendAccelRedirect(reply, track.filePath, contentType);
      }
      const parsed = parseByteRange(range, fileSize);
      if (parsed) {
        if (parsed.invalid) {
          return reply.status(416).header('Content-Range', `bytes */${fileSize}`).send();
        }
        const { start, end, length: chunksize } = parsed;
        const file = fsModule.createReadStream(track.filePath, { start, end });
        return reply
          .code(206)
          .header('Content-Range', `bytes ${start}-${end}/${fileSize}`)
          .header('Accept-Ranges', 'bytes')
          .header('Content-Length', chunksize)
          .type(contentType)
          .send(file);
      } else {
        const file = fsModule.createReadStream(track.filePath);
        return reply
          .header('Content-Length', fileSize)
          .header('Accept-Ranges', 'bytes')
          .type(contentType)
          .send(file);
      }
    } catch (error) {
      if (error.code === 'ENOENT') return reply.status(404).send({ error: 'Track file not found' });
      fastify.log.error(`Error streaming track ${id}: ${String(error)}`);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
