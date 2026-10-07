const SERVICE_URL = 'https://wavcloud.duckdns.org/';
const APP_ID = 'org.wavcloud.desktop';
function isServiceUrl(value) {
  try {
    const url = new URL(value);
    return url.origin === new URL(SERVICE_URL).origin && !url.username && !url.password;
  } catch { return false; }
}
function canGrantPermission(permission, origin) {
  return isServiceUrl(origin) && ['persistent-storage', 'fullscreen'].includes(permission);
}
function windowBounds(state, displays) {
  const primary = displays[0].workArea;
  const width = Math.min(Math.max(Number.isFinite(state.width) ? state.width : 1280, 600), primary.width);
  const height = Math.min(Math.max(Number.isFinite(state.height) ? state.height : 820, 480), primary.height);
  const saved = Number.isFinite(state.x) && Number.isFinite(state.y) && displays.some(({ workArea: area }) =>
    state.x >= area.x && state.y >= area.y && state.x + width <= area.x + area.width && state.y + height <= area.y + area.height);
  return { width: Math.round(width), height: Math.round(height), ...(saved ? { x: Math.round(state.x), y: Math.round(state.y) } : {}) };
}
module.exports = { SERVICE_URL, APP_ID, isServiceUrl, canGrantPermission, windowBounds };
