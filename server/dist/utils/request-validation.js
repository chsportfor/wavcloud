"use strict";

function validCredentials(body) {
    return body !== null && typeof body === 'object' &&
        typeof body.username === 'string' && body.username.length > 0 && body.username.length <= 128 &&
        typeof body.password === 'string' && body.password.length > 0 && body.password.length <= 1024;
}

function validFolderName(value, optional = false) {
    if (optional && (value === undefined || value === '')) return true;
    return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 200 &&
        value.trim() !== '.' && value.trim() !== '..' && !/[/\\\x00-\x1f]/.test(value);
}

module.exports = { validCredentials, validFolderName };
