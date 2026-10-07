// Media3 owns playback on Android; the shared model owns queue commands and UI state.
class AndroidAudioPlayer extends AudioPlayer {
  constructor() {
    super();
    this.native = window.WavCloudAndroid;
    this.lastQueueSignature = '';
    this.queueSyncPending = false;
    this.applyingNativeState = false;
    this.lastNativeTrackId = '';
    this.refreshedRestoredQueue = false;
    this.spectrum = new Array(64).fill(0);
    this.spectrumReadAt = 0;
    window.addEventListener('player:queue-changed', () => this.syncNativeQueue());
    for (const event of ['offline:downloaded', 'offline:removed', 'wavcloud:artwork-resolved']) {
      window.addEventListener(event, () => {
        this.lastQueueSignature = '';
        this.emitQueueChange();
      });
    }
    window.__wavcloudNativeProgress = (raw) => this.receiveProgress(JSON.parse(raw));
    window.__wavcloudNativeState = (raw) => this.receiveState(JSON.parse(raw));
    window.__wavcloudNativeError = (code) => {
      this.shouldBePlaying = false;
      this.updateState({ isPlaying: false, isLoading: false });
      P(`재생 오류: ${code}`);
    };
  }

  nativeQueue() {
    return this.getQueue().map((track) => ({
      id: String(track.id),
      title: track.title || 'Unknown title',
      artist: track.artist || 'Unknown artist',
      album: track.album || 'WavCloud',
      streamUri: w.getStreamUrl(track.id),
      artworkUri:
        uiResolvedArtworkUrl(track) ||
        track.artworkUri ||
        (track.hasArtwork ? w.getArtworkUrl(track.id) : ''),
    }));
  }

  queueSignature() {
    return JSON.stringify(this.nativeQueue());
  }

  syncNativeQueue() {
    if (this.applyingNativeState || !w.isAuthenticated() || this.queueSyncPending) return;
    this.queueSyncPending = true;
    Promise.resolve().then(() => {
      this.queueSyncPending = false;
      const signature = this.queueSignature();
      if (signature === this.lastQueueSignature) return;
      this.lastQueueSignature = signature;
      this.native.syncQueue(signature);
    });
  }

  play(track) {
    if (!track) return;
    if (!this.queue.some((item) => item.id === track.id)) this.queue = [track, ...this.queue];
    this.shouldBePlaying = true;
    this.updateState({
      currentTrack: track,
      currentTime: 0,
      duration: track.duration || 0,
      isLoading: true,
      isPlaying: true,
    });
    this.lastQueueSignature = this.queueSignature();
    this.native.setQueue(this.lastQueueSignature, String(track.id), true);
  }
  pause() {
    this.shouldBePlaying = false;
    this.native.pause();
  }
  resume() {
    this.shouldBePlaying = true;
    this.native.play();
  }
  stop(preserveTrack = false) {
    this.shouldBePlaying = false;
    this.native.stop();
    this.updateState({
      isPlaying: false,
      isLoading: false,
      currentTime: 0,
      currentTrack: preserveTrack ? this.state.currentTrack : null,
    });
  }
  seek(seconds) {
    this.native.seekTo(seconds);
  }
  setVolume(value) {
    this.native.setVolume(value);
    this.updateState({ volume: value });
    localStorage.setItem('cm_volume', String(value));
  }
  setRepeat(mode) {
    this.native.setRepeat(mode);
    this.updateState({ repeat: mode });
  }
  setShuffle(enabled) {
    this.native.setShuffle(enabled);
    this.updateState({ shuffle: enabled });
  }
  triggerPreload() {}
  cancelPreload() {}

  getByteFrequencyData(target) {
    const now = performance.now();
    if (this.state.isPlaying && now - this.spectrumReadAt > 45) {
      this.spectrumReadAt = now;
      try {
        this.spectrum = JSON.parse(this.native.getSpectrum());
      } catch {}
    }
    for (let index = 0; index < target.length; index++) {
      target[index] = this.state.isPlaying ? this.spectrum[index % this.spectrum.length] || 0 : 0;
    }
  }

  receiveProgress(state) {
    if (state.trackId && String(this.state.currentTrack?.id) !== String(state.trackId)) return;
    this.updateState({
      currentTime: state.currentTime,
      duration: state.duration || this.state.duration,
      isPlaying: state.isPlaying,
      isLoading: state.isLoading,
    });
  }

  receiveState(state) {
    const hasQueue = Array.isArray(state.queue);
    const firstQueue = !this.refreshedRestoredQueue && hasQueue && state.queue.length > 0;
    if (firstQueue) this.refreshedRestoredQueue = true;
    const previousSignature = hasQueue ? this.queueSignature() : this.lastQueueSignature;
    if (hasQueue) {
      const existing = new Map(this.queue.map((item) => [String(item.id), item]));
      this.queue = state.queue.map((item) => ({
        ...(existing.get(String(item.id)) || {}),
        id: item.id,
        title: item.title || 'Unknown title',
        artist: item.artist || 'Unknown artist',
        album: item.album || 'WavCloud',
        hasArtwork: Boolean(item.artworkUri),
        artworkUri: item.artworkUri || '',
      }));
      this.lastQueueSignature = this.queueSignature();
    }
    const track = this.queue.find((item) => String(item.id) === String(state.trackId));
    this.updateState({
      currentTrack: track || (state.trackId ? this.state.currentTrack : null),
      isPlaying: state.isPlaying,
      isLoading: state.isLoading,
      currentTime: state.currentTime,
      duration: state.duration || track?.duration || this.state.duration,
      volume: state.volume,
      repeat: state.repeat ?? this.state.repeat,
      shuffle: state.shuffle ?? this.state.shuffle,
    });
    const trackChanged = state.trackId !== this.lastNativeTrackId;
    this.lastNativeTrackId = state.trackId;
    if (firstQueue || trackChanged || (hasQueue && this.queueSignature() !== previousSignature)) {
      this.applyingNativeState = true;
      try {
        this.emitQueueChange();
      } finally {
        this.applyingNativeState = false;
      }
    }
  }
}
