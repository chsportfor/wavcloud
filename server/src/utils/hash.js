'use strict';

exports.generateId = generateId;
const cryptoModule = require('crypto');
function generateId(filePath) {
  return cryptoModule.createHash('sha256').update(filePath).digest('hex').substring(0, 12);
}
