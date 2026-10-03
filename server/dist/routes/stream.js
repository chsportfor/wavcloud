"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = streamRoutes;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const metadata_1 = require("../services/metadata");
const auth_1 = require("../middleware/auth");
const { getAudioFormat } = require("../utils/audio-format");
const { parseByteRange } = require("../utils/byte-range");
async function streamRoutes(fastify) {
    fastify.addHook('preHandler', auth_1.authMiddleware);
    fastify.get('/:id', async (request, reply) => {
        const username = request.user.username;
        const { id } = request.params;
        const track = (0, metadata_1.getTrackById)(username, id);
        if (!track) {
            return reply.status(404).send({ error: 'Track not found' });
        }
        try {
            const stat = await fs_1.default.promises.stat(track.filePath);
            if (!stat.isFile()) return reply.status(404).send({ error: 'Track file not found' });
            const fileSize = stat.size;
            const range = request.headers.range;
            const contentType = getAudioFormat(track.filePath).mime;
            fastify.log.info(`Stream requested for track ${id}, range: ${range}`);
            if (process.env.USE_X_ACCEL === 'true') {
                const musicDir = process.env.MUSIC_DIR || '/mnt/music';
                const relativePath = path_1.default.relative(musicDir, track.filePath);
                const encodedPath = relativePath.split(path_1.default.sep).map(encodeURIComponent).join('/');
                fastify.log.info(`Redirecting via X-Accel-Redirect to /internal-media/${encodedPath}`);
                return reply
                    .header('X-Accel-Redirect', `/internal-media/${encodedPath}`)
                    .header('Content-Type', contentType)
                    .send();
            }
            const parsed = parseByteRange(range, fileSize);
            if (parsed) {
                if (parsed.invalid) {
                    return reply.status(416)
                        .header('Content-Range', `bytes */${fileSize}`)
                        .send();
                }
                const { start, end, length: chunksize } = parsed;
                const file = fs_1.default.createReadStream(track.filePath, { start, end });
                return reply.code(206)
                    .header('Content-Range', `bytes ${start}-${end}/${fileSize}`)
                    .header('Accept-Ranges', 'bytes')
                    .header('Content-Length', chunksize)
                    .type(contentType).send(file);
            }
            else {
                const file = fs_1.default.createReadStream(track.filePath);
                return reply.header('Content-Length', fileSize)
                    .header('Accept-Ranges', 'bytes').type(contentType).send(file);
            }
        }
        catch (error) {
            if (error.code === 'ENOENT') return reply.status(404).send({ error: 'Track file not found' });
            fastify.log.error(`Error streaming track ${id}: ${String(error)}`);
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });
}
