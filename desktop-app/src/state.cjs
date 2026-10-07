const fs = require('node:fs');
const path = require('node:path');
function readState(file) {
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}
function writeState(file, state) {
  const safe = { closeToTray: state.closeToTray !== false, maximized: state.maximized === true };
  for (const key of ['x', 'y', 'width', 'height']) if (Number.isFinite(state[key])) safe[key] = Math.round(state[key]);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file + '.next', JSON.stringify(safe, null, 2) + '\n', { mode: 0o600 });
    fs.renameSync(file + '.next', file);
    return true;
  } catch { return false; }
}
module.exports = { readState, writeState };
