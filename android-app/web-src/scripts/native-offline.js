// The Android player cannot read audio saved in WebView's Cache API.
if (window.WavCloudOffline) {
  let nextRequestId = 0;
  const pending = new Map();
  const downloads = new Map();
  const legacyImports = new Map();
  const legacyIds = new Set([
    ...uiReadStoredTrackIds('cm_manual_downloads'),
    ...uiReadStoredTrackIds('cm_auto_cache_list')
  ]);
  // OfflineAudioStore has one import stream: serialize different tracks as well.
  let importQueue = Promise.resolve();

  function importLegacyAudio(trackId) {
    if (!legacyIds.has(trackId) || !window.caches) return Promise.resolve();
    if (legacyImports.has(trackId)) return legacyImports.get(trackId);
    const task = importQueue.then(async () => {
      if (window.WavCloudOffline.isCached(trackId)) return;
      const cache = await caches.open('audio-cache');
      const streamUrl = w.getStreamUrl(trackId).split('?')[0];
      const response = await cache.match(streamUrl, { ignoreSearch: true });
      if (!response) { legacyIds.delete(trackId); return; }
      const audio = await response.blob();
      if (!audio.size) throw new Error('Legacy audio is empty');
      if (!window.WavCloudOffline.beginImport(trackId)) throw new Error('Audio import unavailable');
      try {
        for (let offset = 0; offset < audio.size; offset += 65536) {
          const bytes = new Uint8Array(await audio.slice(offset, offset + 65536).arrayBuffer());
          let binary = '';
          for (const byte of bytes) binary += String.fromCharCode(byte);
          if (!window.WavCloudOffline.appendImport(trackId, btoa(binary))) throw new Error('Audio import failed');
        }
        if (!window.WavCloudOffline.finishImport(trackId)) throw new Error('Audio import failed');
      } catch (error) {
        window.WavCloudOffline.abortImport();
        throw error;
      }
      // Retain the old audio until publication in native storage succeeds.
      await cache.delete(streamUrl, { ignoreSearch: true });
      legacyIds.delete(trackId);
      window.dispatchEvent(new CustomEvent('offline:downloaded', { detail: trackId }));
    }).finally(() => { legacyImports.delete(trackId); });
    legacyImports.set(trackId, task);
    importQueue = task.catch(() => {});
    return task;
  }

  window.__wavcloudOfflineResult = raw => {
    let result;
    try { result = JSON.parse(raw); }
    catch { console.warn('[OfflineManager] Invalid native callback'); return; }
    const request = pending.get(result?.requestId);
    if (!request) return;
    pending.delete(result.requestId);
    if (typeof result.error !== 'string') request.reject(new Error('Invalid download result'));
    else if (result.error) request.reject(new Error(result.error));
    else request.resolve();
  };

  A.isTrackCached = async trackId => {
    const id = String(trackId);
    if (!window.WavCloudOffline.isCached(id)) {
      try { await importLegacyAudio(id); }
      catch (error) { console.warn('[OfflineManager] Legacy audio import failed:', error); }
    }
    return window.WavCloudOffline.isCached(id);
  };

  A.downloadTrack = track => {
    if (!track || typeof track.id !== 'string' || !track.id) return Promise.reject(new Error('Missing track ID'));
    const trackId = track.id;
    if (downloads.has(trackId)) return downloads.get(trackId);
    const task = Promise.resolve().then(async () => {
      if (await A.isTrackCached(trackId)) return;
      const requestId = `offline-${++nextRequestId}`;
      await new Promise((resolve, reject) => {
        pending.set(requestId, { resolve, reject });
        try { window.WavCloudOffline.download(requestId, trackId, w.getStreamUrl(trackId)); }
        catch (error) { pending.delete(requestId); reject(error); }
      });
      window.dispatchEvent(new CustomEvent('offline:downloaded', { detail: trackId }));
    }).finally(() => { downloads.delete(trackId); });
    downloads.set(trackId, task);
    return task;
  };

  A.removeTrack = async trackId => {
    const id = String(trackId);
    await downloads.get(id)?.catch(() => {});
    await legacyImports.get(id)?.catch(() => {});
    if (legacyIds.has(id) && window.caches) {
      const cache = await caches.open('audio-cache');
      await cache.delete(w.getStreamUrl(id).split('?')[0], { ignoreSearch: true });
    }
    if (!window.WavCloudOffline.remove(id)) throw new Error('Could not remove downloaded audio');
    legacyIds.delete(id);
    window.dispatchEvent(new CustomEvent('offline:removed', { detail: id }));
  };
  // Native offline storage is explicit; background playback must not fill app storage.
  A.autoCacheTrack = async () => {};
}
