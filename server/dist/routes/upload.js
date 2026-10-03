"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = uploadRoutes;
const auth_1 = require("../middleware/auth");
const config_1 = require("../config");
const metadata_1 = require("../services/metadata");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const promises_1 = require("stream/promises");
const { randomUUID } = require("node:crypto");
const { publishUpload } = require("../services/audio-files");
const { validFolderName } = require("../utils/request-validation");
// Root music directory: /mnt/music/<username>/음악 앨범
function getMusicRoot(username) {
    const root = path_1.default.join(config_1.config.MUSIC_DIR, username, '음악 앨범');
    if (!fs_1.default.existsSync(root)) {
        fs_1.default.mkdirSync(root, { recursive: true });
    }
    return root;
}
// Helper to prevent path traversal and escaping the music root
function isSafeSubPath(parent, child) {
    const relative = path_1.default.relative(parent, child);
    return !!(relative && !relative.startsWith('..') && !path_1.default.isAbsolute(relative));
}
async function uploadRoutes(fastify) {
    fastify.addHook('preHandler', auth_1.authMiddleware);
    // GET /api/upload/folders — Return folder structure as JSON
    fastify.get('/folders', async (request, reply) => {
        try {
            const username = request.user.username;
            const root = getMusicRoot(username);
            const categories = fs_1.default.readdirSync(root, { withFileTypes: true })
                .filter(d => d.isDirectory())
                .map(d => d.name)
                .sort();
            const structure = {};
            for (const cat of categories) {
                const catPath = path_1.default.join(root, cat);
                const albums = fs_1.default.readdirSync(catPath, { withFileTypes: true })
                    .filter(d => d.isDirectory())
                    .map(d => d.name)
                    .sort();
                structure[cat] = albums;
            }
            return reply.send(structure);
        }
        catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: 'Failed to read folder structure' });
        }
    });
    // POST /api/upload/folder — Create a new folder
    fastify.post('/folder', async (request, reply) => {
        try {
            const username = request.user.username;
            const { category, album } = request.body || {};
            if (!validFolderName(category) || !validFolderName(album, true)) {
                return reply.status(400).send({ error: 'Invalid category or album name' });
            }
            const root = getMusicRoot(username);
            const targetPath = path_1.default.resolve(root, category.trim(), album ? album.trim() : '');
            if (!isSafeSubPath(root, targetPath)) {
                return reply.status(400).send({ error: 'Path traversal detected or invalid directory' });
            }
            if (fs_1.default.existsSync(targetPath)) {
                return reply.status(409).send({ error: 'Folder already exists' });
            }
            fs_1.default.mkdirSync(targetPath, { recursive: true });
            return reply.send({ success: true, path: targetPath });
        }
        catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: 'Failed to create folder' });
        }
    });
    // POST /api/upload — Upload music file(s)
    fastify.post('/', async (request, reply) => {
        try {
            const username = request.user.username;
            const parts = request.parts();
            let category = '';
            let album = '';
            const uploadedFiles = [];
            for await (const part of parts) {
                if (part.type === 'field') {
                    if (part.fieldname === 'category' || part.fieldname === 'album') {
                        if (!validFolderName(part.value, part.fieldname === 'album')) {
                            return reply.status(400).send({ error: 'Invalid category or album name' });
                        }
                        if (part.fieldname === 'category') category = part.value.trim();
                        else album = part.value.trim();
                    }
                }
                else if (part.type === 'file') {
                    if (!category) {
                        return reply.status(400).send({ error: 'Category is required' });
                    }
                    const root = getMusicRoot(username);
                    const targetDir = path_1.default.resolve(root, category, album);
                    if (!isSafeSubPath(root, targetDir)) {
                        return reply.status(400).send({ error: 'Invalid upload directory' });
                    }
                    // Ensure directory exists
                    if (!fs_1.default.existsSync(targetDir)) {
                        fs_1.default.mkdirSync(targetDir, { recursive: true });
                    }
                    const safeFilename = path_1.default.basename(String(part.filename || '').replace(/\\/g, '/'));
                    if (!safeFilename || safeFilename === '.' || safeFilename === '..') {
                        return reply.status(400).send({ error: 'Invalid filename' });
                    }
                    if (!['.wav', '.mp3', '.flac', '.ogg', '.m4a'].includes(path_1.default.extname(safeFilename).toLowerCase())) {
                        return reply.status(415).send({ error: 'Unsupported audio format' });
                    }
                    const filePath = path_1.default.join(targetDir, safeFilename);
                    const temporary = path_1.default.join(targetDir, `.${randomUUID()}.upload`);
                    try {
                        const writeStream = fs_1.default.createWriteStream(temporary, { flags: 'wx', mode: 0o600 });
                        await (0, promises_1.pipeline)(part.file, writeStream);
                        if (part.file.truncated) {
                            throw Object.assign(new Error('Upload exceeds the file size limit'), { statusCode: 413 });
                        }
                        if ((await fs_1.default.promises.stat(temporary)).size === 0) {
                            throw Object.assign(new Error('Uploaded audio is empty'), { statusCode: 400 });
                        }
                        const finalFilePath = await publishUpload(temporary, filePath);
                        uploadedFiles.push(finalFilePath);
                        await (0, metadata_1.indexUploadedTracks)(username, [finalFilePath]);
                    }
                    finally {
                        await fs_1.default.promises.unlink(temporary).catch(error => {
                            if (error.code !== 'ENOENT') fastify.log.warn(error, 'Could not remove upload temp file');
                        });
                    }
                }
            }
            if (uploadedFiles.length === 0) {
                return reply.status(400).send({ error: 'No files uploaded' });
            }
            return reply.send({
                success: true,
                uploaded: uploadedFiles.length,
                files: uploadedFiles.map(f => path_1.default.basename(f))
            });
        }
        catch (err) {
            if (err.statusCode === 400 || err.statusCode === 413) {
                return reply.status(err.statusCode).send({ error: err.message });
            }
            if (err.code === 'FST_REQ_FILE_TOO_LARGE') {
                return reply.status(413).send({ error: 'Upload exceeds the file size limit' });
            }
            if (err.code === 'EEXIST') {
                return reply.status(409).send({ error: 'A file with that name already exists' });
            }
            fastify.log.error(err);
            return reply.status(500).send({ error: 'Upload failed' });
        }
    });
}
