const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const dist = path.resolve('web-app/dist');
const htmlPath = path.join(dist, 'index.html');
const audio = Buffer.alloc(44 + 8000 * 2 * 30);
audio.write('RIFF', 0); audio.writeUInt32LE(audio.length - 8, 4); audio.write('WAVEfmt ', 8);
audio.writeUInt32LE(16, 16); audio.writeUInt16LE(1, 20); audio.writeUInt16LE(1, 22);
audio.writeUInt32LE(8000, 24); audio.writeUInt32LE(16000, 28); audio.writeUInt16LE(2, 32);
audio.writeUInt16LE(16, 34); audio.write('data', 36); audio.writeUInt32LE(audio.length - 44, 40);
const tracks = [
  ['a', '한국어・日本語 Song', '검증 앨범', 1],
  ['b', 'Long song title with <img src=x onerror=alert(1)> & quotes', '검증 앨범', 2],
  ['c', '다른 앨범의 곡', '두 번째 앨범', 1]
].map(([id, title, album, trackNumber]) => ({ id, title, album, artist: '테스트 아티스트',
  filePath: `/mnt/music/audit/음악 앨범/UI 검사/${album}/${trackNumber}.wav`,
  duration: 30, fileSize: audio.length, trackNumber, hasArtwork: true }));
let scanPoll = 0, scenario = 'normal';
const folders = { 'UI 검사': ['검증 앨범', '두 번째 앨범'] };
function json(response, body, status = 200) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}
http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost:3000');
  const route = url.pathname;
  if (route === '/' || route === '/index.html') {
    scenario = url.searchParams.get('scenario') || 'normal'; scanPoll = 0;
    const initial = `<script>if (location.search.includes('scenario=login')) localStorage.removeItem('cm_token');if (!localStorage.getItem('cm_token')) localStorage.setItem('cm_playlists', ${scenario === 'corrupt' ? "'{broken'" : "'[]'"});${scenario !== 'login' ? "localStorage.setItem('cm_token','local-audit');" : ''}</script>`;
    response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
    response.end(fs.readFileSync(htmlPath, 'utf8').replace('</head>', initial + '</head>'));
  } else if (route === '/api/auth/login') {
    let body = ''; for await (const chunk of request) body += chunk;
    const credentials = JSON.parse(body);
    json(response, credentials.username === 'audit' && credentials.password === 'demo'
      ? { token: 'local-audit' } : { error: '아이디 또는 비밀번호가 올바르지 않습니다.' },
    credentials.username === 'audit' && credentials.password === 'demo' ? 200 : 401);
  } else if (route === '/api/tracks') {
    json(response, scenario === 'empty' ? [] : tracks);
  } else if (route === '/api/upload/folders') json(response, folders);
  else if (route === '/api/upload/folder') {
    let body = ''; for await (const chunk of request) body += chunk;
    const { category, album } = JSON.parse(body);
    if (!folders[category]) folders[category] = [];
    if (album) folders[category].push(album);
    json(response, { success: true });
  } else if (route === '/api/upload') {
    for await (const chunk of request) { /* Local test bytes are discarded. */ }
    json(response, { success: true, uploaded: 1, files: ['audit.wav'] });
  } else if (route === '/api/tracks/scan/start') {
    scanPoll = 1;
    json(response, { id: 'audit-scan', status: 'running', phase: 'discovering', discovered: 3 }, 202);
  } else if (route === '/api/tracks/scan/status') {
    json(response, !scanPoll ? { status: 'idle' } : ++scanPoll < 6
      ? { id: 'audit-scan', status: 'running', phase: 'indexing', total: 3, processed: 1, found: 1 }
      : { id: 'audit-scan', status: 'completed', phase: 'completed', total: 3, processed: 3, found: 3 });
  } else if (route.endsWith('/artwork')) {
    response.writeHead(200, { 'Content-Type': 'image/svg+xml' });
    response.end('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="#334a65"/><circle cx="300" cy="300" r="130" fill="#182638"/><text x="300" y="322" text-anchor="middle" font-size="62" fill="white">♪</text></svg>');
  } else if (route.startsWith('/api/stream/') || route.startsWith('/api/download/')) {
    const match = /^bytes=(\d+)-(\d*)/.exec(request.headers.range || '');
    const start = match ? Number(match[1]) : 0;
    const end = match?.[2] ? Math.min(Number(match[2]), audio.length - 1) : audio.length - 1;
    response.writeHead(match ? 206 : 200, { 'Content-Type': 'audio/wav',
      'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes',
      ...(match ? { 'Content-Range': `bytes ${start}-${end}/${audio.length}` } : {}) });
    response.end(audio.subarray(start, end + 1));
  } else if (route === '/artwork-catalog.json') json(response, {});
  else if (JSON.parse(fs.readFileSync(path.join(dist, 'build.json'), 'utf8')).files.includes(route.slice(1))) { const file = path.join(dist, route.slice(1)); const type = route.endsWith('.js') ? 'text/javascript' : route.endsWith('.css') ? 'text/css' : route.endsWith('.svg') ? 'image/svg+xml' : route.endsWith('.png') ? 'image/png' : 'application/json'; response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }); response.end(fs.readFileSync(file)); } else { response.writeHead(404); response.end(); }
}).listen(3000, '127.0.0.1', () => console.log('Audit preview: http://localhost:3000 (local fixtures only)'));
