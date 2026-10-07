const SHELL_CACHE = 'wavcloud-shell-__VERSION__';
const SHELL_FILES = __SHELL_FILES__;

self.addEventListener('message', event => {
  if (event.data?.type === 'WAVCLOUD_BUILD') {
    event.source?.postMessage({ type: 'WAVCLOUD_BUILD', script: SHELL_FILES.find(file => file.endsWith('.js')), style: SHELL_FILES.find(file => file.endsWith('.css')) });
  }
});

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(SHELL_FILES);
    // Replaces the legacy precache worker without reloading a playing page.
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name !== SHELL_CACHE && (
      name.startsWith('wavcloud-shell-') || name.startsWith('workbox-precache-')
    )).map(name => caches.delete(name)));
    // audio-cache, artwork-cache and user storage are intentionally preserved.
    await self.clients.claim();
  })());
});

function parseAudioRange(range, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(range || '');
  if (!match || (!match[1] && !match[2]) || !size) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size || Number(match[2]) === 0 && !match[1]) return null;
  return { start, end };
}

async function savedAudio(request, url) {
  const id = url.pathname.split('/')[3];
  const cache = await caches.open('audio-cache');
  const response = await cache.match(`${url.origin}/api/stream/${id}`, { ignoreSearch: true });
  if (!response) return fetch(request);
  const headers = new Headers(response.headers);
  headers.delete('Content-Encoding');
  headers.delete('Content-Range');
  headers.set('Accept-Ranges', 'bytes');
  const range = request.headers.get('Range');
  if (!range) {
    if (request.method === 'HEAD') return new Response(null, { headers });
    return new Response(response.body, { headers });
  }
  const blob = await response.blob();
  const parsed = parseAudioRange(range, blob.size);
  if (!parsed) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${blob.size}` } });
  headers.set('Content-Range', `bytes ${parsed.start}-${parsed.end}/${blob.size}`);
  headers.set('Content-Length', String(parsed.end - parsed.start + 1));
  return new Response(request.method === 'HEAD' ? null : blob.slice(parsed.start, parsed.end + 1), { status: 206, headers });
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !['GET', 'HEAD'].includes(request.method)) return;
  if (/^\/api\/(stream|download)\/[^/]+$/.test(url.pathname)) {
    event.respondWith(savedAudio(request, url));
  } else if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(SHELL_CACHE);
      return await cache.match('/index.html') || Response.error();
    }));
  } else if (SHELL_FILES.includes(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      return await cache.match(url.pathname) || fetch(request);
    })());
  } else if (/^\/api\/tracks\/[^/]+\/artwork$/.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open('artwork-cache');
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return await cache.match(request, { ignoreSearch: true }) || Response.error();
      }
    })());
  }
});
