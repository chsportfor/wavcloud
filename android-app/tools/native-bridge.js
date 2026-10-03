if (window.WavCloudAndroid) {
  // The shared queue methods still call these browser-audio helpers.
  p.triggerPreload = () => {};
  p.cancelPreload = () => {};
  const nativeQueue = () => p.getQueue().map(track => ({
    id: String(track.id),
    title: track.title || 'Unknown title',
    artist: track.artist || 'Unknown artist',
    album: track.album || 'WavCloud',
    streamUri: w.getStreamUrl(track.id),
    artworkUri: uiResolvedArtworkUrl(track) || track.artworkUri || (track.hasArtwork ? w.getArtworkUrl(track.id) : '')
  }));

  const queueSignature = () => JSON.stringify(nativeQueue());
  let lastQueueSignature = '';
  let queueSyncPending = false;
  let applyingNativeState = false;
  window.addEventListener('player:queue-changed', () => {
    if (applyingNativeState || !w.isAuthenticated()) return;
    if (queueSyncPending) return;
    queueSyncPending = true;
    Promise.resolve().then(() => {
      queueSyncPending = false;
      const signature = queueSignature();
      if (signature === lastQueueSignature) return;
      lastQueueSignature = signature;
      window.WavCloudAndroid.syncQueue(JSON.stringify(nativeQueue()));
    });
  });
  for (const eventName of ['offline:downloaded', 'offline:removed', 'wavcloud:artwork-resolved']) {
    window.addEventListener(eventName, () => {
      lastQueueSignature = '';
      window.dispatchEvent(new CustomEvent('player:queue-changed'));
    });
  }

  p.play = function(track) {
    if (!track) return;
    if (!this.queue.some(item => item.id === track.id)) this.queue = [track, ...this.queue];
    this.shouldBePlaying = true;
    this.updateState({
      currentTrack: track,
      currentTime: 0,
      duration: track.duration || 0,
      isLoading: true,
      isPlaying: true
    });
    lastQueueSignature = queueSignature();
    window.WavCloudAndroid.setQueue(JSON.stringify(nativeQueue()), String(track.id), true);
  };
  p.pause = function() { this.shouldBePlaying = false; window.WavCloudAndroid.pause(); };
  p.resume = function() { this.shouldBePlaying = true; window.WavCloudAndroid.play(); };
  p.stop = function(preserveTrack = false) {
    this.shouldBePlaying = false;
    window.WavCloudAndroid.stop();
    this.updateState({ isPlaying: false, isLoading: false, currentTime: 0, currentTrack: preserveTrack ? this.state.currentTrack : null });
  };
  p.seek = seconds => window.WavCloudAndroid.seekTo(seconds);
  p.setVolume = function(value) {
    window.WavCloudAndroid.setVolume(value);
    this.updateState({ volume: value });
    localStorage.setItem('cm_volume', String(value));
  };
  p.setRepeat = function(mode) { window.WavCloudAndroid.setRepeat(mode); this.updateState({ repeat: mode }); };
  p.setShuffle = function(enabled) { window.WavCloudAndroid.setShuffle(enabled); this.updateState({ shuffle: enabled }); };

  let spectrum = new Array(64).fill(0);
  let spectrumReadAt = 0;
  p.getByteFrequencyData = target => {
    const now = performance.now();
    if (now - spectrumReadAt > 45) {
      spectrumReadAt = now;
      try { spectrum = JSON.parse(window.WavCloudAndroid.getSpectrum()); } catch { }
    }
    const nativeState = typeof p.getState === 'function' ? p.getState() : p.state;
    for (let index = 0; index < target.length; index++) {
      target[index] = nativeState.isPlaying
        ? (spectrum[index % spectrum.length] || 0) : 0;
    }
  };

  window.__wavcloudNativeError = code => {
    p.shouldBePlaying = false;
    p.updateState({ isPlaying: false, isLoading: false });
    if (typeof P === 'function') P(`재생 오류: ${code}`);
  };

  let lastNativeTrackId = '';
  let refreshedRestoredQueue = false;
  window.__wavcloudNativeProgress = raw => {
    const state = JSON.parse(raw);
    if (state.trackId && String(p.state.currentTrack?.id) !== String(state.trackId)) return;
    p.updateState({
      currentTime: state.currentTime,
      duration: state.duration || p.state.duration,
      isPlaying: state.isPlaying,
      isLoading: state.isLoading
    });
  };
  window.__wavcloudNativeState = raw => {
    const state = JSON.parse(raw);
    const firstStateWithQueue = !refreshedRestoredQueue && Array.isArray(state.queue) && state.queue.length > 0;
    if (firstStateWithQueue) refreshedRestoredQueue = true;
    const hasQueue = Array.isArray(state.queue);
    const previousQueueSignature = hasQueue ? queueSignature() : lastQueueSignature;
    if (hasQueue) {
      const existing = new Map(p.queue.map(item => [String(item.id), item]));
      p.queue = state.queue.map(item => ({
        ...(existing.get(String(item.id)) || {}),
        id: item.id,
        title: item.title || 'Unknown title',
        artist: item.artist || 'Unknown artist',
        album: item.album || 'WavCloud',
        hasArtwork: Boolean(item.artworkUri),
        artworkUri: item.artworkUri || ''
      }));
      lastQueueSignature = queueSignature();
    }
    const track = p.queue.find(item => String(item.id) === String(state.trackId));
    p.updateState({
      currentTrack: track || (state.trackId ? p.state.currentTrack : null),
      isPlaying: state.isPlaying,
      isLoading: state.isLoading,
      currentTime: state.currentTime,
      duration: state.duration || track?.duration || p.state.duration,
      volume: state.volume,
      repeat: state.repeat ?? p.state.repeat,
      shuffle: state.shuffle ?? p.state.shuffle
    });
    const trackChanged = state.trackId !== lastNativeTrackId;
    lastNativeTrackId = state.trackId;
    if (firstStateWithQueue || trackChanged || (hasQueue && queueSignature() !== previousQueueSignature)) {
      applyingNativeState = true;
      try {
        window.dispatchEvent(new CustomEvent('player:queue-changed', { detail: p.getQueue() }));
      } finally {
        applyingNativeState = false;
      }
    }
  };
}
