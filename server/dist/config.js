"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    PORT: parseInt(process.env.PORT || '3000', 10),
    MUSIC_DIR: process.env.MUSIC_DIR || './music',
    JWT_SECRET: process.env.JWT_SECRET || 'change-this-to-a-random-string',
    AUTH_USERNAME: process.env.AUTH_USERNAME || 'admin',
    AUTH_PASSWORD: process.env.AUTH_PASSWORD || 'changeme',
    AUTH_TEST_USERNAME: process.env.AUTH_TEST_USERNAME || 'test',
    AUTH_TEST_PASSWORD: process.env.AUTH_TEST_PASSWORD || 'test1234',
};
