'use strict';

exports.default = trackRoutes;
const authModule = require('../middleware/auth');
const metadataModule = require('../services/metadata');
const configModule = require('../config');
const pathModule = require('path');
const { scanJobs, libraryStatus } = require('../services/library-manager');
async function trackRoutes(fastify) {
  fastify.addHook('preHandler', authModule.authMiddleware);
  fastify.get('/', async (request, reply) => {
    const username = request.user.username;
    const status = libraryStatus(username);
    if (!status.libraryReady) {
      return reply.header('Retry-After', '2').code(503).send({
        code: status.status === 'failed' ? 'LIBRARY_UNAVAILABLE' : 'LIBRARY_NOT_READY',
        error: status.status === 'failed' ? '라이브러리를 읽지 못했습니다. 서버 스캔 상태를 확인해 주세요.' : '서버에서 라이브러리를 준비하고 있습니다.',
      });
    }
    const tracks = metadataModule.getCachedTracks(username);
    return reply.send(tracks);
  });
  fastify.post('/scan', async (request, reply) => {
    try {
      const username = request.user.username;
      const userMusicDir = pathModule.join(configModule.config.MUSIC_DIR, username);
      const tracks = await scanJobs.start(username, userMusicDir).promise;
      return reply.send(tracks);
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Failed to rescan directory' });
    }
  });
  fastify.post('/scan/start', async (request, reply) => {
    const username = request.user.username;
    const directory = pathModule.join(configModule.config.MUSIC_DIR, username);
    reply.header('Cache-Control', 'no-store');
    return reply.code(202).send(scanJobs.start(username, directory).snapshot());
  });
  fastify.get('/scan/status', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    return reply.send(libraryStatus(request.user.username));
  });
  fastify.get('/:id', async (request, reply) => {
    const username = request.user.username;
    const { id } = request.params;
    const track = metadataModule.getTrackById(username, id);
    if (!track) {
      return reply.status(404).send({ error: 'Track not found' });
    }
    return reply.send(track);
  });
  fastify.get('/:id/artwork', async (request, reply) => {
    const username = request.user.username;
    const { id } = request.params;
    const artwork = await metadataModule.getArtwork(username, id);
    if (artwork) {
      return reply.type(artwork.format).send(artwork.data);
    } else {
      const placeholder = `
        <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
          <defs>
            <linearGradient id="purpleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#8b5cf6" />
              <stop offset="100%" stop-color="#4c1d95" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#purpleGrad)"/>
          <path d="M192 384V112c0-8.8 7.2-16 16-16h160c8.8 0 16 7.2 16 16v80c0 8.8-7.2 16-16 16h-96v176c0 44.2-35.8 80-80 80s-80-35.8-80-80 35.8-80 80-80z" fill="white" fill-opacity="0.85"/>
        </svg>
      `;
      return reply.type('image/svg+xml').send(placeholder.trim());
    }
  });
}
