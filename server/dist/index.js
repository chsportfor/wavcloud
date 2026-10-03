"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const multipart_1 = __importDefault(require("@fastify/multipart"));
const config_1 = require("./config");
const auth_1 = __importDefault(require("./routes/auth"));
const tracks_1 = __importDefault(require("./routes/tracks"));
const stream_1 = __importDefault(require("./routes/stream"));
const download_1 = __importDefault(require("./routes/download"));
const upload_1 = __importDefault(require("./routes/upload"));
const metadata_1 = require("./services/metadata");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const server = (0, fastify_1.default)({ logger: true });
async function start() {
    try {
        await server.register(cors_1.default, {
            origin: true,
            credentials: true
        });
        await server.register(multipart_1.default, {
            limits: {
                fileSize: 500 * 1024 * 1024 // 500MB max
            }
        });
        server.register(auth_1.default, { prefix: '/api/auth' });
        server.register(tracks_1.default, { prefix: '/api/tracks' });
        server.register(stream_1.default, { prefix: '/api/stream' });
        server.register(download_1.default, { prefix: '/api/download' });
        server.register(upload_1.default, { prefix: '/api/upload' });
        if (!fs_1.default.existsSync(config_1.config.MUSIC_DIR)) {
            server.log.info(`Creating music directory at ${config_1.config.MUSIC_DIR}`);
            fs_1.default.mkdirSync(config_1.config.MUSIC_DIR, { recursive: true });
        }
        // Scan music directory for each user
        const users = [config_1.config.AUTH_USERNAME, config_1.config.AUTH_TEST_USERNAME];
        for (const username of users) {
            const userMusicDir = path_1.default.join(config_1.config.MUSIC_DIR, username);
            if (!fs_1.default.existsSync(userMusicDir)) {
                fs_1.default.mkdirSync(userMusicDir, { recursive: true });
            }
            await (0, metadata_1.scanMusicDirectory)(username, userMusicDir);
        }
        await server.listen({ port: config_1.config.PORT, host: '0.0.0.0' });
        server.log.info(`Server running at http://localhost:${config_1.config.PORT}`);
    }
    catch (err) {
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
