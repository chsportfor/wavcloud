// Browser audio storage. Android replaces the public methods in native-offline.js.
function uiReadStoredTrackIds(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value)
      ? [...new Set(value.filter((id) => typeof id === 'string' && id.length > 0))]
      : [];
  } catch {
    return [];
  }
}

class BrowserOfflineStore {
  constructor() {
    this.cacheName = 'audio-cache';
    this.manualDownloadsKey = 'cm_manual_downloads';
    this.autoCacheListKey = 'cm_auto_cache_list';
    this.maxAutoCacheCount = 40;
    this.pendingDownloads = new Map();
    this.manualDownloads = new Map();
    this.manualRequests = new Set();
  }

  getManualDownloads() {
    return uiReadStoredTrackIds(this.manualDownloadsKey);
  }
  getAutoCacheList() {
    return uiReadStoredTrackIds(this.autoCacheListKey);
  }
  saveManualDownloads(ids) {
    localStorage.setItem(this.manualDownloadsKey, JSON.stringify(ids));
  }
  saveAutoCacheList(ids) {
    localStorage.setItem(this.autoCacheListKey, JSON.stringify(ids));
  }
  cacheUrl(id) {
    return w.getStreamUrl(id).split('?')[0];
  }

  async isTrackCached(id) {
    try {
      const cache = await caches.open(this.cacheName);
      return !!(await cache.match(this.cacheUrl(id), { ignoreSearch: true }));
    } catch {
      return false;
    }
  }

  ensureCached(track) {
    if (!track || typeof track.id !== 'string' || !track.id)
      return Promise.reject(new Error('Missing track ID'));
    if (this.pendingDownloads.has(track.id)) return this.pendingDownloads.get(track.id);
    const task = Promise.resolve()
      .then(async () => {
        const cache = await caches.open(this.cacheName);
        const url = this.cacheUrl(track.id);
        if (await cache.match(url, { ignoreSearch: true })) return;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15 * 60 * 1000);
        try {
          const response = await fetch(w.getStreamUrl(track.id), { signal: controller.signal });
          if (response.status !== 200) throw new Error(`Download failed: HTTP ${response.status}`);
          const type = response.headers.get('Content-Type') || 'audio/mpeg';
          if (!/^(audio\/|application\/octet-stream(?:;|$))/i.test(type))
            throw new Error('Response is not audio');
          const length = response.headers.get('Content-Length');
          const expected = length === null ? null : Number(length);
          if (
            expected !== null &&
            (!Number.isSafeInteger(expected) || expected < 0 || expected > 1024 ** 3)
          ) {
            throw new Error('Invalid audio size');
          }
          const audio = await response.blob();
          const encoding = response.headers.get('Content-Encoding');
          if (!audio.size || audio.size > 1024 ** 3)
            throw new Error('Downloaded audio is empty or too large');
          if (
            expected !== null &&
            (!encoding || encoding.toLowerCase() === 'identity') &&
            expected !== audio.size
          ) {
            throw new Error('Audio download is incomplete');
          }
          await cache.put(
            url,
            new Response(audio, {
              status: 200,
              headers: {
                'Content-Type': type,
                'Content-Length': String(audio.size),
                'Accept-Ranges': 'bytes',
              },
            }),
          );
        } finally {
          clearTimeout(timer);
        }
      })
      .finally(() => {
        this.pendingDownloads.delete(track.id);
      });
    this.pendingDownloads.set(track.id, task);
    return task;
  }

  touchAutoCache(id) {
    const ids = this.getAutoCacheList().filter((item) => item !== id);
    ids.push(id);
    this.saveAutoCacheList(ids);
  }

  async autoCacheTrack(track) {
    if (!track?.id || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
    try {
      await this.ensureCached(track);
      this.touchAutoCache(track.id);
      await this.purgeOldAutoCache();
      window.dispatchEvent(new CustomEvent('offline:downloaded', { detail: track.id }));
    } catch (error) {
      console.warn('[OfflineManager] Auto-cache failed:', error);
    }
  }

  downloadTrack(track) {
    if (!track || typeof track.id !== 'string' || !track.id)
      return Promise.reject(new Error('Missing track ID'));
    if (this.manualDownloads.has(track.id)) return this.manualDownloads.get(track.id);
    this.manualRequests.add(track.id);
    const task = Promise.resolve()
      .then(async () => {
        await this.ensureCached(track);
        const ids = this.getManualDownloads();
        if (!ids.includes(track.id)) {
          ids.push(track.id);
          this.saveManualDownloads(ids);
        }
        this.touchAutoCache(track.id);
        window.dispatchEvent(new CustomEvent('offline:downloaded', { detail: track.id }));
      })
      .finally(() => {
        this.manualRequests.delete(track.id);
        this.manualDownloads.delete(track.id);
      });
    this.manualDownloads.set(track.id, task);
    return task;
  }

  async purgeOldAutoCache() {
    const pinned = new Set([...this.getManualDownloads(), ...this.manualRequests]);
    const ids = this.getAutoCacheList();
    const automatic = ids.filter((id) => !pinned.has(id));
    const victims = automatic.slice(0, Math.max(0, automatic.length - this.maxAutoCacheCount));
    if (!victims.length) return;
    const cache = await caches.open(this.cacheName);
    const removed = new Set();
    for (const id of victims) {
      // A manual request can arrive while an earlier cache deletion is awaiting.
      if (this.manualRequests.has(id) || this.getManualDownloads().includes(id)) continue;
      await cache.delete(this.cacheUrl(id), { ignoreSearch: true });
      removed.add(id);
    }
    // Preserve entries added by downloads while the cache deletion was pending.
    this.saveAutoCacheList(this.getAutoCacheList().filter((id) => !removed.has(id)));
  }

  async removeTrack(id) {
    await this.manualDownloads.get(id)?.catch(() => {});
    await this.pendingDownloads.get(id)?.catch(() => {});
    const cache = await caches.open(this.cacheName);
    await cache.delete(this.cacheUrl(id), { ignoreSearch: true });
    this.saveManualDownloads(this.getManualDownloads().filter((item) => item !== id));
    this.saveAutoCacheList(this.getAutoCacheList().filter((item) => item !== id));
    window.dispatchEvent(new CustomEvent('offline:removed', { detail: id }));
  }
}

const A = new BrowserOfflineStore();
