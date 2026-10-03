const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('android-app/web-src/scripts/library-feedback.js', 'utf8');
new Function(source);

class Element {
  constructor(tag, className = '', textContent = '') { Object.assign(this, { tag, className, textContent, children: [], dataset: {}, attrs: {}, events: {}, isConnected: true, value: '' }); this.classList = { add() {} }; }
  append(...children) { this.children.push(...children); }
  setAttribute(key, value) { this.attrs[key] = value; }
  removeAttribute(key) { delete this.attrs[key]; }
  addEventListener(type, listener) { this.events[type] = listener; }
  focus() {}
  close() { this.closed = true; }
  showModal() { this.open = true; }
  remove() { this.isConnected = false; }
}
function harness() {
  const dialogs = [], messages = [], requests = [];
  const header = new Element('div'), button = new Element('button');
  const library = { playlists: [], tracks: [{ id: 't', title: '日本語の曲' }], el: { querySelector: selector => selector === '.library-fixed-header' ? header : button }, savePlaylists() { this.saved = true; }, render() {}, extractFolders() {} };
  const context = {
    uiText: (tag, cls, text) => new Element(tag, cls, text),
    uiButton: (text, cls, click) => { const button = new Element('button', cls, text); if (click) button.events.click = click; return button; },
    uiDialog: title => { const dialog = new Element('dialog'); dialogs.push(dialog); return dialog; },
    P: message => messages.push(message), localStorage: { setItem() {} }, AbortController,
    setTimeout: (fn, delay) => delay === 1000 ? setImmediate(fn) : null, clearTimeout() {},
    _trackSorter: (a, b) => a.id.localeCompare(b.id),
    w: { getTracks: async () => library.tracks }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, library, dialogs, messages, requests, header, button };
}
function find(root, cls) { if (root.className.split(' ').includes(cls)) return root; for (const child of root.children) { const result = find(child, cls); if (result) return result; } }

(async () => {
  const h = harness();
  const { context: c, library: lib } = h;
  c.uiCreatePlaylist(lib, 't');
  const d = h.dialogs[0], input = find(d, 'ui-name-input'), form = find(d, 'ui-playlist-form');
  input.value = '  日本語 · 즐겨 듣는 곡  ';
  form.events.submit({ preventDefault() {} });
  assert.equal(lib.playlists[0].name, '日本語 · 즐겨 듣는 곡');
  assert.equal(lib.playlists[0].trackIds[0], 't');
  c.uiCreatePlaylist(lib);
  const duplicate = h.dialogs[1];
  find(duplicate, 'ui-name-input').value = lib.playlists[0].name;
  find(duplicate, 'ui-playlist-form').events.submit({ preventDefault() {} });
  assert.match(find(duplicate, 'ui-form-error').textContent, /이미 사용 중/);
  assert.equal(lib.playlists.length, 1);
  lib.playlists.push({ name: '<img src=x> 일본어 暴走P', trackIds: [] });
  c.uiAddToPlaylist(lib, 't');
  const options = find(h.dialogs[2], 'ui-playlist-options').children;
  assert.equal(options[0].disabled, true, 'already added tracks must not be duplicated');
  assert.equal(options[1].children[0].textContent, '<img src=x> 일본어 暴走P');
  options[1].events.click();
  assert.equal(lib.playlists[1].trackIds.length, 1);

  let started = 0, polls = 0;
  c.w.fetchWithAuth = async (path, options) => {
    h.requests.push(path);
    let job;
    if (options.method === 'POST') { started++; job = { id: 'job', status: 'running', phase: 'discovering' }; }
    else if (!started) job = { status: 'idle' };
    else job = { id: 'job', status: ++polls >= 2 ? 'completed' : 'running', phase: 'indexing', processed: polls, total: 2, found: polls, currentFile: '日本語.flac' };
    return { ok: true, json: async () => job };
  };
  const first = c.uiStartLibraryScan(lib);
  assert.equal(c.uiStartLibraryScan(lib), first, 'repeated taps must share the active request');
  await first;
  assert.equal(started, 1);
  assert.equal(lib.scanCard.progress.value, 100);
  assert.equal(lib.scanCard.el.dataset.status, 'completed');
  assert.equal(h.button.disabled, false);
  assert.match(lib.scanCard.summary.textContent, /2곡 확인 완료/);

  const resumed = harness();
  let resumePosts = 0;
  resumed.context.w.fetchWithAuth = async (path, options) => {
    if (options.method === 'POST') resumePosts++;
    return { ok: true, json: async () => ({ id: 'live', status: resumed.library.scanPromise ? 'completed' : 'running', total: 1, processed: 1, found: 1 }) };
  };
  await resumed.context.uiResumeLibraryScan(resumed.library);
  await resumed.library.scanPromise;
  assert.equal(resumePosts, 0, 'reopening the app must attach to an existing scan');
  assert.equal(resumed.library.scanCard.el.dataset.status, 'completed');
  const retry = harness();
  let attempts = 0, disconnected = true;
  retry.context.w.fetchWithAuth = async (path, options) => {
    if (options.method === 'POST') { attempts++; return { ok: true, json: async () => ({ id: 'retry', status: 'running' }) }; }
    if (!attempts) return { ok: true, json: async () => ({ status: 'idle' }) };
    if (disconnected) throw new Error('연결 끊김');
    return { ok: true, json: async () => ({ id: 'retry', status: 'completed', processed: 1, total: 1, found: 1 }) };
  };
  await retry.context.uiStartLibraryScan(retry.library);
  assert.equal(retry.library.scanCard.el.dataset.status, 'failed');
  disconnected = false;
  await retry.context.uiStartLibraryScan(retry.library);
  assert.equal(attempts, 1, 'reconnecting after a completed scan must not launch another scan');
  assert.equal(retry.library.scanCard.el.dataset.status, 'completed');
  console.log('PASS: Unicode playlists, duplicate validation, scan progress/repeated taps, reconnection and network recovery');
})().catch(error => { console.error(error); process.exitCode = 1; });
