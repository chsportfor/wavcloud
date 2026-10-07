'use strict';

exports.authMiddleware = authMiddleware;
const jsonwebtokenModule = require('jsonwebtoken');
const configModule = require('../config');
async function authMiddleware(request, reply) {
  let token = '';
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (request.query && typeof request.query === 'object' && 'token' in request.query) {
    token = request.query.token;
  }
  if (typeof token !== 'string' || !token) {
    reply.status(401).send({ error: 'Unauthorized: No token provided' });
    return;
  }
  try {
    const decoded = jsonwebtokenModule.verify(token, configModule.config.JWT_SECRET, {
      algorithms: ['HS256'],
    });
    if (decoded && decoded.username === 'admin') {
      decoded.username = configModule.config.AUTH_USERNAME;
    }
    if (
      !decoded ||
      typeof decoded !== 'object' ||
      ![configModule.config.AUTH_USERNAME, configModule.config.AUTH_TEST_USERNAME].includes(
        decoded.username,
      )
    ) {
      throw new Error('Invalid token user');
    }
    request.user = decoded;
  } catch (error) {
    reply.status(401).send({ error: 'Unauthorized: Invalid token' });
  }
}
