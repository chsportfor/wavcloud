'use strict';

const fastifyModule = require('fastify');
const corsModule = require('@fastify/cors');
const multipartModule = require('@fastify/multipart');
const configModule = require('./config');
const authModule = require('./routes/auth').default;
const tracksModule = require('./routes/tracks').default;
const streamModule = require('./routes/stream').default;
const downloadModule = require('./routes/download').default;
const uploadModule = require('./routes/upload').default;
const { restoreLibraries, refreshLibraries } = require('./services/library-manager');
const server = fastifyModule({ logger: true });
function isAllowedOrigin(origin) {
  // Native/Android WebView (file:// sends 'null') and non-browser clients omit or send null Origin.
  if (!origin || origin === 'null') return true;
  if (configModule.config.CORS_ORIGINS.includes(origin)) return true;
  try {
    const { protocol, hostname } = new URL(origin);
    return (
      (protocol === 'http:' || protocol === 'https:') &&
      (hostname === 'localhost' || hostname === '127.0.0.1')
    );
  } catch {
    return false;
  }
}

async function start() {
  try {
    await server.register(corsModule, {
      origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
      credentials: true,
    });
    await server.register(multipartModule, {
      limits: {
        fileSize: 500 * 1024 * 1024, // 500MB max
      },
    });
    server.register(authModule, { prefix: '/api/auth' });
    server.register(tracksModule, { prefix: '/api/tracks' });
    server.register(streamModule, { prefix: '/api/stream' });
    server.register(downloadModule, { prefix: '/api/download' });
    server.register(uploadModule, { prefix: '/api/upload' });
    const users = [...new Set([configModule.config.AUTH_USERNAME, configModule.config.AUTH_TEST_USERNAME])];
    await restoreLibraries(users, configModule.config.MUSIC_DIR);
    await server.listen({ port: configModule.config.PORT, host: '0.0.0.0' });
    server.log.info(`Server running at http://localhost:${configModule.config.PORT}`);
    // Do not create missing music directories: a missing mount must preserve the snapshot.
    void refreshLibraries(users, configModule.config.MUSIC_DIR);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}
const shutdown = async () => {
  server.log.info('Graceful shutdown initiated');
  await server.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
start();
