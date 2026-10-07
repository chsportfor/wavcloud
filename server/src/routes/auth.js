'use strict';

exports.default = authRoutes;
const jsonwebtokenModule = require('jsonwebtoken');
const configModule = require('../config');
const authModule = require('../middleware/auth');
const { validCredentials } = require('../utils/request-validation');
async function authRoutes(fastify) {
  fastify.post('/login', async (request, reply) => {
    if (!validCredentials(request.body)) {
      return reply.status(400).send({ error: 'Username and password are required' });
    }
    const { username, password } = request.body;
    const checkUsername = username.toLowerCase();
    const isValidAdmin =
      checkUsername === configModule.config.AUTH_USERNAME.toLowerCase() &&
      password === configModule.config.AUTH_PASSWORD;
    const isValidTest =
      checkUsername === configModule.config.AUTH_TEST_USERNAME.toLowerCase() &&
      password === configModule.config.AUTH_TEST_PASSWORD;
    if (!isValidAdmin && !isValidTest) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }
    const normalizedUsername = isValidAdmin
      ? configModule.config.AUTH_USERNAME
      : configModule.config.AUTH_TEST_USERNAME;
    const token = jsonwebtokenModule.sign(
      { username: normalizedUsername },
      configModule.config.JWT_SECRET,
      { expiresIn: '3650d' },
    );
    fastify.log.info(`User ${username} logged in successfully`);
    return reply.send({ token });
  });
  fastify.get('/verify', { preHandler: [authModule.authMiddleware] }, async (request, reply) => {
    const user = request.user;
    return reply.send({ valid: true, username: user.username });
  });
}
