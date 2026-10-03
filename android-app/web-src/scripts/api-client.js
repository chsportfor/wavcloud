// The API contract lives here instead of inside the compressed view runtime.
const z = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const B = z ? 'http://localhost:3000' : window.location.origin;

class WavCloudApi {
  constructor() { this.token = localStorage.getItem('cm_token'); }
  isAuthenticated() { return !!this.token; }
  logout() { this.token = null; localStorage.removeItem('cm_token'); }

  async fetchWithAuth(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (this.token) headers.set('Authorization', `Bearer ${this.token}`);
    const response = await fetch(`${B}${path}`, { ...options, headers });
    if (response.status === 401) {
      this.logout();
      window.location.reload();
      throw new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.');
    }
    return response;
  }

  async requestJson(path, options = {}, authenticated = true) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const request = { ...options, signal: controller.signal };
      const response = authenticated
        ? await this.fetchWithAuth(path, request)
        : await fetch(`${B}${path}`, request);
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || `요청에 실패했습니다. (${response.status})`);
      if (body === null) throw new Error('서버 응답을 읽지 못했습니다. 다시 시도해 주세요.');
      return body;
    } catch (error) {
      if (controller.signal.aborted) throw new Error('서버 응답이 늦어지고 있습니다. 다시 시도해 주세요.');
      throw error;
    } finally { clearTimeout(timer); }
  }

  async login(username, password) {
    const body = await this.requestJson('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    }, false);
    if (typeof body.token !== 'string' || !body.token) throw new Error('로그인 응답에 오류가 있습니다.');
    localStorage.setItem('cm_token', body.token);
    this.token = body.token;
    return body;
  }

  async getTracks() {
    const body = await this.requestJson(`/api/tracks?_t=${Date.now()}`, { cache: 'no-store' });
    const tracks = Array.isArray(body) ? body : body.tracks;
    if (!Array.isArray(tracks) || !tracks.every(uiIsTrack)) throw new Error('곡 목록 응답에 오류가 있습니다.');
    return tracks;
  }
  async scanTracks() {
    // The UI uses background scan jobs; retained for older callers.
    const response = await this.fetchWithAuth('/api/tracks/scan', { method: 'POST' });
    if (!response.ok) throw new Error('라이브러리 스캔에 실패했습니다.');
    const body = await response.json();
    return body.tracks || body;
  }
  mediaUrl(route, id) { return `${B}/api/${route}/${encodeURIComponent(id)}?token=${encodeURIComponent(this.token || '')}`; }
  getStreamUrl(id) { return this.mediaUrl('stream', id); }
  getDownloadUrl(id) { return this.mediaUrl('download', id); }
  getArtworkUrl(id) { return this.mediaUrl('tracks', id).replace('?token=', '/artwork?token='); }
  getFolders() { return this.requestJson('/api/upload/folders'); }
  createFolder(category, album) {
    return this.requestJson('/api/upload/folder', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, album })
    });
  }
  uploadTrack(file, category, album, progress) {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('POST', `${B}/api/upload`);
      request.timeout = 15 * 60 * 1000;
      if (this.token) request.setRequestHeader('Authorization', `Bearer ${this.token}`);
      request.upload.onprogress = event => {
        if (event.lengthComputable && progress) progress(event.loaded, event.total);
      };
      request.onload = () => {
        if (request.status === 401) {
          this.logout(); window.location.reload();
          reject(new Error('로그인이 만료되었습니다.')); return;
        }
        try {
          const body = JSON.parse(request.responseText);
          if (request.status >= 200 && request.status < 300) resolve(body);
          else reject(new Error(body.error || '업로드에 실패했습니다.'));
        } catch { reject(new Error('업로드 응답을 읽지 못했습니다.')); }
      };
      request.onerror = () => reject(new Error('서버에 연결하지 못했습니다.'));
      request.ontimeout = () => reject(new Error('업로드 시간이 초과되었습니다.'));
      request.onabort = () => reject(new Error('업로드가 취소되었습니다.'));
      const body = new FormData();
      body.append('category', category); body.append('album', album); body.append('file', file);
      request.send(body);
    });
  }
}
const w = new WavCloudApi();
