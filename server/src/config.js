'use strict';

exports.config = void 0;
const dotenvModule = require('dotenv');
dotenvModule.config();
exports.config = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  MUSIC_DIR: process.env.MUSIC_DIR || './music',
  LIBRARY_CACHE_DIR: process.env.LIBRARY_CACHE_DIR || require('node:path').resolve('.library-cache'),
  JWT_SECRET: process.env.JWT_SECRET || 'change-this-to-a-random-string',
  AUTH_USERNAME: process.env.AUTH_USERNAME || 'admin',
  AUTH_PASSWORD: process.env.AUTH_PASSWORD || 'changeme',
  AUTH_TEST_USERNAME: process.env.AUTH_TEST_USERNAME || 'test',
  AUTH_TEST_PASSWORD: process.env.AUTH_TEST_PASSWORD || 'test1234',
};
