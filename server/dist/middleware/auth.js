"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
async function authMiddleware(request, reply) {
    let token = '';
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    }
    else if (request.query && typeof request.query === 'object' && 'token' in request.query) {
        token = request.query.token;
    }
    if (typeof token !== 'string' || !token) {
        reply.status(401).send({ error: 'Unauthorized: No token provided' });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, config_1.config.JWT_SECRET, { algorithms: ['HS256'] });
        if (decoded && decoded.username === 'admin') {
            decoded.username = config_1.config.AUTH_USERNAME;
        }
        if (!decoded || typeof decoded !== 'object' ||
            ![config_1.config.AUTH_USERNAME, config_1.config.AUTH_TEST_USERNAME].includes(decoded.username)) {
            throw new Error('Invalid token user');
        }
        request.user = decoded;
    }
    catch (error) {
        reply.status(401).send({ error: 'Unauthorized: Invalid token' });
    }
}
