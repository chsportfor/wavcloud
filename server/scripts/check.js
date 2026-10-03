"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

function check(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const location = path.join(directory, entry.name);
        if (entry.isDirectory()) check(location);
        else if (entry.name.endsWith(".js")) execFileSync(process.execPath, ["--check", location]);
    }
}

check(path.join(__dirname, "..", "dist"));
console.log("Server JavaScript syntax is valid");
