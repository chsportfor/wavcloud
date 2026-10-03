// The Android player cannot read audio saved in WebView's Cache API.
if (window.WavCloudOffline) {
  let nextRequestId = 0;
  const pending = new Map();
  const legacyIds = new Set();
  for (const key of ['cm_manual_downloads', 'cm_auto_cache_list']) {
    try {
      for (const id of JSON.parse(localStorage.getItem(key) || '[]')) legacyIds.add(String(id));
    } catch { /* Ignore damaged legacy metadata. */ }
  }
  const legacyAttempts = new Set();

  async function importLegacyAudio(trackId) {
    if (!legacyIds.has(trackId) || legacyAttempts.has(trackId) || !window.caches) return;
    legacyAttempts.add(trackId);
    const cache = await caches.open('audio-cache');
    const streamUrl = w.getStreamUrl(trackId).split('?')[0];
    const response = await cache.match(streamUrl, { ignoreSearch: true });
    if (!response) return;
    const audio = await response.blob();
    if (!window.WavCloudOffline.beginImport(trackId)) return;
    try {
      for (let offset = 0; offset < audio.size; offset += 65536) {
        const bytes = new Uint8Array(await audio.slice(offset, offset + 65536).arrayBuffer());
        let binary = '';
        for (const byte of bytes) binary += String.fromCharCode(byte);
        if (!window.WavCloudOffline.appendImport(trackId, btoa(binary))) throw new Error('Audio import failed');
      }
      if (!window.WavCloudOffline.finishImport(trackId)) throw new Error('Audio import failed');
      await cache.delete(streamUrl, { ignoreSearch: true });
      window.dispatchEvent(new CustomEvent('offline:downloaded', { detail: trackId }));
    } catch (error) {
      window.WavCloudOffline.abortImport();
      console.warn('[OfflineManager] Legacy audio import failed:', error);
    }
  }

  window.__wavcloudOfflineResult = raw => {
    const { requestId, error } = JSON.parse(raw);
    const request = pending.get(requestId);
    if (!request) return;
    pending.delete(requestId);
    error ? request.reject(new Error(error)) : request.resolve();
  };

  A.isTrackCached = async trackId => {
    const id = String(trackId);
    if (!window.WavCloudOffline.isCached(id)) await importLegacyAudio(id);
    return window.WavCloudOffline.isCached(id);
  };
  A.downloadTrack = async track => {
    if (!track?.id) throw new Error('Missing track ID');
    const trackId = String(track.id);
    if (window.WavCloudOffline.isCached(trackId)) return;
    const requestId = `offline-${++nextRequestId}`;
    await new Promise((resolve, reject) => {
      pending.set(requestId, { resolve, reject });
      try {
        window.WavCloudOffline.download(requestId, trackId, w.getStreamUrl(track.id));
      } catch (error) {
        pending.delete(requestId);
        reject(error);
      }
    });
    window.dispatchEvent(new CustomEvent('offline:downloaded', { detail: track.id }));
  };
  A.removeTrack = async trackId => {
    if (!window.WavCloudOffline.remove(String(trackId))) throw new Error('Could not remove downloaded audio');
    window.dispatchEvent(new CustomEvent('offline:removed', { detail: trackId }));
  };
  // Native offline storage is explicit; background playback must not fill app storage.
  A.autoCacheTrack = async () => {};
}
