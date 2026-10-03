"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = authRoutes;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const auth_1 = require("../middleware/auth");
const { validCredentials } = require("../utils/request-validation");
async function authRoutes(fastify) {
    fastify.post('/login', async (request, reply) => {
        if (!validCredentials(request.body)) {
            return reply.status(400).send({ error: 'Username and password are required' });
        }
        const { username, password } = request.body;
        const checkUsername = username.toLowerCase();
        const isValidAdmin = (checkUsername === config_1.config.AUTH_USERNAME.toLowerCase() && password === config_1.config.AUTH_PASSWORD);
        const isValidTest = (checkUsername === config_1.config.AUTH_TEST_USERNAME.toLowerCase() && password === config_1.config.AUTH_TEST_PASSWORD);
        if (!isValidAdmin && !isValidTest) {
            return reply.status(401).send({ error: 'Invalid credentials' });
        }
        const normalizedUsername = isValidAdmin ? config_1.config.AUTH_USERNAME : config_1.config.AUTH_TEST_USERNAME;
        const token = jsonwebtoken_1.default.sign({ username: normalizedUsername }, config_1.config.JWT_SECRET, { expiresIn: '3650d' });
        fastify.log.info(`User ${username} logged in successfully`);
        return reply.send({ token });
    });
    fastify.get('/verify', { preHandler: [auth_1.authMiddleware] }, async (request, reply) => {
        const user = request.user;
        return reply.send({ valid: true, username: user.username });
    });
}
