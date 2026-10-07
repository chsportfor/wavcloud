class AudioPlayer {
  constructor() {
    defineField(this, 'audios');
    defineField(this, 'activeIndex', 0);
    defineField(this, 'queue', []);
    defineField(this, 'state');
    defineField(this, 'listeners', []);
    defineField(this, 'preloadedTrackId', null);
    defineField(this, 'stallTimeout', null);
    defineField(this, 'lastProgressTime', 0);
    defineField(this, 'lastBufferedEnd', 0);
    defineField(this, 'recoveryTimeout', null);
    defineField(this, 'isRecovering', !1);
    defineField(this, 'retryAttempt', 0);
    defineField(this, 'lastPlayPosition', 0);
    defineField(this, 'shouldBePlaying', !1);
    defineField(this, 'audioCtx', null);
    defineField(this, 'analyser', null);
    this.audios = window.WavCloudAndroid ? [] : [new Audio(), new Audio()];
    this.audios.forEach((s) => {
      ((s.crossOrigin = 'anonymous'), (s.preload = 'auto'));
    });
    const e = localStorage.getItem('cm_volume'),
      t = e !== null ? parseFloat(e) : 0.5;
    this.audios.forEach((s) => {
      s.volume = t;
    });
    this.state = {
      currentTrack: null,
      isPlaying: !1,
      isLoading: !1,
      currentTime: 0,
      duration: 0,
      volume: t,
      repeat: 'none',
      shuffle: !1,
    };
    window.WavCloudAndroid ||
      (this.setupListeners(), this.setupMediaSession(), this.setupNetworkWatch());
  }
  setupNetworkWatch() {
    window.addEventListener('online', () => {
      console.log('[AudioPlayer] Network came back online!');
      this.shouldBePlaying &&
        (this.state.isLoading || this.activeAudio.paused) &&
        this.triggerRecovery();
    });
  }
  getBufferedEnd(e) {
    try {
      const t = e.buffered;
      if (!t || !t.length) return 0;
      const s = e.currentTime || 0;
      for (let i = 0; i < t.length; i++)
        if (s >= t.start(i) - 0.5 && s <= t.end(i) + 0.5) return t.end(i);
      return t.end(t.length - 1);
    } catch {
      return 0;
    }
  }
  bufferAhead(audio = this.activeAudio) {
    for (let i = 0; i < audio.buffered.length; i++) {
      if (
        audio.buffered.start(i) <= audio.currentTime + 0.05 &&
        audio.buffered.end(i) > audio.currentTime
      )
        return audio.buffered.end(i) - audio.currentTime;
    }
    return 0;
  }
  cancelPreload() {
    if (!this.preloadedTrackId) return;
    this.preloadedTrackId = null;
    this.preloadAudio.pause();
    this.preloadAudio.removeAttribute('src');
    this.preloadAudio.load();
  }
  clearStallWatchdog() {
    if (this.stallTimeout) {
      clearInterval(this.stallTimeout);
      this.stallTimeout = null;
    }
  }
  cancelRecovery() {
    this.recoveryGeneration = (this.recoveryGeneration || 0) + 1;
    if (this.recoveryTimeout) {
      clearTimeout(this.recoveryTimeout);
      this.recoveryTimeout = null;
    }
    if (this.recoveryCleanup) {
      this.recoveryCleanup();
      this.recoveryCleanup = null;
    }
    this.isRecovering = false;
  }
  startStallWatchdog() {
    if (this.stallTimeout || !this.shouldBePlaying || !this.state.currentTrack) return;
    const audio = this.activeAudio,
      track = this.state.currentTrack;
    let position = audio.currentTime,
      end = this.getBufferedEnd(audio),
      lastMotion = Date.now(),
      lastData = Date.now();
    this.stallTimeout = setInterval(() => {
      if (
        !this.shouldBePlaying ||
        audio !== this.activeAudio ||
        track !== this.state.currentTrack ||
        audio.ended
      ) {
        this.clearStallWatchdog();
        return;
      }
      const now = Date.now(),
        nextEnd = this.getBufferedEnd(audio);
      if (audio.currentTime > position + 0.01) {
        lastMotion = now;
        if (!audio.paused && audio.readyState >= 3) {
          this.clearStallWatchdog();
          return;
        }
      }
      if (nextEnd > end + 0.01) lastData = now;
      if (this.lastProgressTime > lastData) lastData = this.lastProgressTime;
      position = audio.currentTime;
      end = nextEnd;
      if (now - lastMotion >= 15000 && now - lastData >= 15000) {
        this.clearStallWatchdog();
        this.triggerRecovery();
      }
    }, 1000);
  }
  triggerRecovery() {
    if (!this.shouldBePlaying || !this.state.currentTrack || this.isRecovering) return;
    if (this.retryAttempt >= 3) {
      this.clearStallWatchdog();
      this.cancelRecovery();
      this.shouldBePlaying = false;
      this.updateState({ isLoading: false, isPlaying: false });
      return;
    }
    this.cancelRecovery();
    this.clearStallWatchdog();
    this.cancelPreload();
    this.isRecovering = true;
    const generation = this.recoveryGeneration,
      audio = this.activeAudio,
      track = this.state.currentTrack,
      position = audio.currentTime || this.lastPlayPosition || 0;
    const valid = () =>
      this.recoveryGeneration === generation &&
      this.activeAudio === audio &&
      this.state.currentTrack === track &&
      this.shouldBePlaying;
    this.updateState({ isLoading: true });
    if (!navigator.onLine) {
      const online = () => {
        if (!valid()) return;
        this.cancelRecovery();
        this.triggerRecovery();
      };
      window.addEventListener('online', online);
      this.recoveryCleanup = () => window.removeEventListener('online', online);
      return;
    }
    const delay = Math.min(1000 * Math.pow(2, this.retryAttempt), 4000);
    this.retryAttempt++;
    this.recoveryTimeout = setTimeout(() => {
      this.recoveryTimeout = null;
      if (!valid()) return;
      // Data may have resumed during the backoff. Preserve it instead of reloading.
      if (!audio.error && this.bufferAhead(audio) > 2 && audio.readyState >= 3) {
        this.cancelRecovery();
        audio.play().catch(() => {});
        this.startStallWatchdog();
        return;
      }
      const seek = () => {
        if (
          valid() &&
          position > 0 &&
          Number.isFinite(audio.duration) &&
          position < audio.duration
        ) {
          try {
            audio.currentTime = position;
          } catch (error) {
            console.warn('Recovery seek failed', error);
          }
        }
      };
      const ready = () => {
        if (!valid()) return;
        this.cancelRecovery();
        const resumedGeneration = this.recoveryGeneration;
        audio.play().catch((error) => {
          if (
            this.recoveryGeneration !== resumedGeneration ||
            this.activeAudio !== audio ||
            this.state.currentTrack !== track ||
            !this.shouldBePlaying
          )
            return;
          if (error.name !== 'AbortError') this.triggerRecovery();
        });
      };
      audio.addEventListener('loadedmetadata', seek, { once: true });
      audio.addEventListener('canplay', ready, { once: true });
      this.recoveryCleanup = () => {
        audio.removeEventListener('loadedmetadata', seek);
        audio.removeEventListener('canplay', ready);
      };
      audio.src = w.getStreamUrl(track.id);
      audio.load();
      this.lastProgressTime = Date.now();
      this.isRecovering = false;
      this.startStallWatchdog();
    }, delay);
  }
  initAudioContext() {
    if (!this.audioCtx)
      try {
        const e = window.AudioContext || window.webkitAudioContext;
        if (!e) return;
        this.audioCtx = new e();
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 128;
        this.analyser.smoothingTimeConstant = 0.8;
        this.audios.forEach((t) => {
          this.audioCtx.createMediaElementSource(t).connect(this.analyser);
        });
        this.analyser.connect(this.audioCtx.destination);
      } catch (e) {
        console.warn('Web Audio API init warning:', e);
      }
  }
  getByteFrequencyData(e) {
    this.audioCtx && this.audioCtx.state === 'suspended' && this.audioCtx.resume();
    this.analyser ? this.analyser.getByteFrequencyData(e) : e.fill(0);
  }
  get activeAudio() {
    return this.audios[this.activeIndex];
  }
  get preloadAudio() {
    return this.audios[1 - this.activeIndex];
  }
  getQueue() {
    return [...this.queue];
  }
  setQueue(e) {
    this.queue = [...e];
    this.emitQueueChange();
  }
  addToQueue(e) {
    const t = Array.isArray(e) ? e : [e];
    t.length !== 0 && (this.queue.push(...t), this.triggerPreload(), this.emitQueueChange());
  }
  playNextInQueue(e) {
    const t = Array.isArray(e) ? e : [e];
    if (t.length === 0) return;
    if (this.queue.length === 0 || !this.state.currentTrack) {
      this.setQueue(t);
      this.play(t[0]);
      return;
    }
    const s = this.queue.findIndex((i) => i.id === this.state.currentTrack.id);
    s === -1 ? this.queue.unshift(...t) : this.queue.splice(s + 1, 0, ...t);
    this.triggerPreload();
    this.emitQueueChange();
  }
  removeFromQueue(e) {
    if (e < 0 || e >= this.queue.length) return;
    const [t] = this.queue.splice(e, 1);
    if (this.state.currentTrack && t.id === this.state.currentTrack.id)
      if (this.queue.length > 0) {
        const s = e < this.queue.length ? e : 0;
        this.play(this.queue[s]);
      } else this.stop();
    else this.triggerPreload();
    this.emitQueueChange();
  }
  reorderQueue(e, t) {
    if (e < 0 || e >= this.queue.length || t < 0 || t >= this.queue.length) return;
    const [s] = this.queue.splice(e, 1);
    this.queue.splice(t, 0, s);
    this.triggerPreload();
    this.emitQueueChange();
  }
  clearQueue() {
    this.state.currentTrack ? (this.queue = [this.state.currentTrack]) : (this.queue = []);
    this.triggerPreload();
    this.emitQueueChange();
  }
  emitQueueChange() {
    window.dispatchEvent(new CustomEvent('player:queue-changed', { detail: [...this.queue] }));
  }
  setupListeners() {
    this.audios.forEach((e, t) => {
      e.addEventListener('loadstart', () => {
        t === this.activeIndex && this.updateState({ isLoading: !0 });
      });
      e.addEventListener('progress', () => {
        t === this.activeIndex && (this.lastProgressTime = Date.now());
      });
      e.addEventListener('waiting', () => {
        t === this.activeIndex &&
          this.shouldBePlaying &&
          (this.cancelPreload(), this.updateState({ isLoading: !0 }), this.startStallWatchdog());
      });
      e.addEventListener('stalled', () => {
        t === this.activeIndex &&
          this.shouldBePlaying &&
          !e.paused &&
          !e.ended &&
          (this.updateState({ isLoading: !0 }), this.startStallWatchdog());
      });
      e.addEventListener('playing', () => {
        t === this.activeIndex &&
          (this.clearStallWatchdog(),
          this.cancelRecovery(),
          (this.isRecovering = !1),
          (this.retryAttempt = 0),
          this.updateState({ isLoading: !1, isPlaying: !0 }),
          'mediaSession' in navigator && (navigator.mediaSession.playbackState = 'playing'));
      });
      e.addEventListener('canplay', () => {});
      e.addEventListener('play', () => {
        t === this.activeIndex &&
          (this.updateState({ isPlaying: !0 }),
          'mediaSession' in navigator && (navigator.mediaSession.playbackState = 'playing'));
      });
      e.addEventListener('pause', () => {
        t === this.activeIndex &&
          (this.clearStallWatchdog(),
          this.isRecovering ||
            this.recoveryCleanup ||
            ((this.shouldBePlaying = !1),
            this.updateState({ isPlaying: !1, isLoading: !1 }),
            'mediaSession' in navigator && (navigator.mediaSession.playbackState = 'paused')));
      });
      e.addEventListener('error', () => {
        t === this.activeIndex &&
          (console.warn('[AudioPlayer] Audio element encountered error:', e.error),
          this.shouldBePlaying && this.state.currentTrack
            ? this.triggerRecovery()
            : this.updateState({ isPlaying: !1, isLoading: !1 }));
      });
      e.addEventListener('abort', () => {
        t === this.activeIndex && this.updateState({ isLoading: !1 });
      });
      e.addEventListener('timeupdate', () => {
        t === this.activeIndex &&
          (e.currentTime > 0 &&
            (e.currentTime > this.lastPlayPosition + 0.01 &&
              !e.paused &&
              e.readyState >= 3 &&
              (this.clearStallWatchdog(), (this.isRecovering = !1), (this.retryAttempt = 0)),
            (this.lastPlayPosition = e.currentTime)),
          this.updateState({ currentTime: e.currentTime }),
          this.updateMediaSessionPositionState(),
          this.bufferAhead(e) < 3 && this.cancelPreload(),
          e.currentTime >= 2 && !this.preloadedTrackId && this.triggerPreload());
      });
      e.addEventListener('loadedmetadata', () => {
        t === this.activeIndex &&
          e.duration &&
          !isNaN(e.duration) &&
          e.duration > 0 &&
          this.updateState({ duration: e.duration });
      });
      e.addEventListener('durationchange', () => {
        t === this.activeIndex &&
          e.duration &&
          !isNaN(e.duration) &&
          e.duration > 0 &&
          this.updateState({ duration: e.duration });
      });
      e.addEventListener('ended', () => {
        t === this.activeIndex &&
          (this.clearStallWatchdog(), (this.shouldBePlaying = !1), this.handleEnded());
      });
    });
  }
  setupMediaSession() {
    'mediaSession' in navigator &&
      (navigator.mediaSession.setActionHandler('play', () => this.resume()),
      navigator.mediaSession.setActionHandler('pause', () => this.pause()),
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        window.dispatchEvent(new CustomEvent('player:prev'));
      }),
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        window.dispatchEvent(new CustomEvent('player:next'));
      }),
      navigator.mediaSession.setActionHandler('seekto', (e) => {
        e.seekTime !== void 0 && this.seek(e.seekTime);
      }),
      navigator.mediaSession.setActionHandler('seekbackward', (e) => {
        const t = e.seekOffset || 10;
        this.seek(Math.max(0, this.activeAudio.currentTime - t));
      }),
      navigator.mediaSession.setActionHandler('seekforward', (e) => {
        const t = e.seekOffset || 10;
        this.seek(Math.min(this.activeAudio.duration || 0, this.activeAudio.currentTime + t));
      }));
  }
  updateMediaSessionPositionState() {
    'mediaSession' in navigator &&
      this.activeAudio.duration > 0 &&
      navigator.mediaSession.setPositionState({
        duration: this.activeAudio.duration,
        playbackRate: this.activeAudio.playbackRate,
        position: this.activeAudio.currentTime,
      });
  }
  subscribe(e) {
    return (
      this.listeners.push(e),
      e(this.state),
      () => {
        this.listeners = this.listeners.filter((t) => t !== e);
      }
    );
  }
  updateState(e) {
    this.state = { ...this.state, ...e };
    this.listeners.forEach((t) => t(this.state));
  }
  play(e) {
    if (!e) return;
    this.cancelRecovery();
    const playGeneration = this.recoveryGeneration;
    const isPrepared =
      this.preloadedTrackId === e.id && Boolean(this.preloadAudio.src) && !this.preloadAudio.error;
    this.clearStallWatchdog();
    this.shouldBePlaying = true;
    this.isRecovering = false;
    this.retryAttempt = 0;
    this.lastPlayPosition = 0;
    let audio;
    if (isPrepared) {
      this.activeAudio.pause();
      this.activeAudio.src = '';
      this.activeIndex = 1 - this.activeIndex;
      this.preloadedTrackId = null;
      audio = this.activeAudio;
    } else {
      this.preloadAudio.pause();
      this.preloadAudio.src = '';
      this.preloadedTrackId = null;
      audio = this.activeAudio;
      audio.src = w.getStreamUrl(e.id);
    }
    const isReady = audio.readyState >= 3;
    this.updateState({
      currentTrack: e,
      currentTime: 0,
      duration: e.duration || 0,
      isLoading: !isReady,
      isPlaying: true,
    });
    try {
      audio.currentTime = 0;
    } catch (AudioPlayer) {}
    const result = audio.play();
    if (result && result.catch)
      result.catch((error) => {
        if (
          this.recoveryGeneration !== playGeneration ||
          this.activeAudio !== audio ||
          this.state.currentTrack !== e
        )
          return;
        console.warn('[AudioPlayer] Play rejected:', error);
        if (error && error.name === 'AbortError') return;
        if (this.shouldBePlaying) this.triggerRecovery();
        else this.updateState({ isLoading: false, isPlaying: false });
      });
    setTimeout(() => {
      this.initAudioContext();
      if (this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume();
    }, 0);
    this.updateMediaMetadata(e);
    this.lastProgressTime = Date.now();
    this.startStallWatchdog();
  }
  pause() {
    this.cancelRecovery();
    this.shouldBePlaying = !1;
    this.clearStallWatchdog();
    this.activeAudio.pause();
  }
  resume() {
    this.cancelRecovery();
    this.shouldBePlaying = !0;
    this.isRecovering = !1;
    this.retryAttempt = 0;
    this.clearStallWatchdog();
    this.activeAudio.play().catch((e) => {
      (console.warn('[AudioPlayer] Resume failed, initiating recovery...', e),
        this.triggerRecovery());
    });
    this.audioCtx && this.audioCtx.state === 'suspended' && this.audioCtx.resume();
  }
  stop(preserveTrack = false) {
    this.cancelRecovery();
    this.shouldBePlaying = !1;
    this.isRecovering = !1;
    this.retryAttempt = 0;
    this.clearStallWatchdog();
    this.activeAudio.pause();
    this.activeAudio.currentTime = 0;
    this.preloadAudio.pause();
    this.preloadAudio.src = '';
    this.preloadedTrackId = null;
    this.updateState({
      isPlaying: !1,
      isLoading: !1,
      currentTime: 0,
      currentTrack: preserveTrack ? this.state.currentTrack : null,
    });
  }
  seek(e) {
    this.cancelRecovery();
    this.clearStallWatchdog();
    e >= 0 &&
      e <= this.activeAudio.duration &&
      ((this.lastPlayPosition = e), (this.activeAudio.currentTime = e));
  }
  setVolume(e) {
    this.audios.forEach((t) => {
      t.volume = e;
    });
    this.updateState({ volume: e });
    localStorage.setItem('cm_volume', e.toString());
  }
  setRepeat(e) {
    this.updateState({ repeat: e });
    this.triggerPreload();
  }
  setShuffle(e) {
    this.updateState({ shuffle: e });
    this.triggerPreload();
  }
  getNextTrack() {
    if (this.queue.length === 0 || !this.state.currentTrack) return null;
    const e = this.queue.findIndex((i) => i.id === this.state.currentTrack.id);
    if (e === -1) return null;
    if (this.state.repeat === 'one') return this.state.currentTrack;
    if (this.state.shuffle) {
      const prepared = this.queue.find(
        (t) => t.id === this.preloadedTrackId && t.id !== this.state.currentTrack.id,
      );
      if (prepared) return prepared;
      if (this.queue.length === 1) return this.queue[0];
      let i = e;
      for (; i === e;) i = Math.floor(Math.random() * this.queue.length);
      return this.queue[i];
    }
    if (e === this.queue.length - 1 && this.state.repeat === 'none') return null;
    const s = (e + 1) % this.queue.length;
    return this.queue[s];
  }
  triggerPreload() {
    if (
      !this.state.currentTrack ||
      !this.queue.length ||
      !this.shouldBePlaying ||
      this.state.isLoading ||
      this.activeAudio.paused
    )
      return;
    const audio = this.activeAudio,
      ahead = this.bufferAhead(audio),
      remaining = audio.duration - audio.currentTime;
    const sufficient =
      ahead >= 20 || (Number.isFinite(remaining) && remaining > 0 && ahead >= remaining - 0.25);
    if (audio.readyState < 3 || !sufficient) return;
    const next = this.getNextTrack();
    if (!next || next.id === this.state.currentTrack.id) {
      this.cancelPreload();
      return;
    }
    if (this.preloadedTrackId === next.id) return;
    this.preloadedTrackId = next.id;
    this.preloadAudio.src = w.getStreamUrl(next.id);
    this.preloadAudio.load();
  }
  handleEnded() {
    this.clearStallWatchdog();
    if (this.state.repeat === 'one') {
      this.activeAudio.currentTime = 0;
      this.lastPlayPosition = 0;
      this.shouldBePlaying = true;
      this.activeAudio.play().catch(() => this.triggerRecovery());
      return;
    }
    const next = this.getNextTrack();
    if (next) this.play(next);
    else this.stop(true);
  }
  updateMediaMetadata(e) {
    'mediaSession' in navigator &&
      ((navigator.mediaSession.metadata = new MediaMetadata({
        title: e.title,
        artist: e.artist || 'Unknown Artist',
        album: e.album || 'CloudMusic',
        artwork: [
          { src: w.getArtworkUrl(e.id), sizes: '96x96', type: 'image/png' },
          { src: w.getArtworkUrl(e.id), sizes: '128x128', type: 'image/png' },
          { src: w.getArtworkUrl(e.id), sizes: '192x192', type: 'image/png' },
          { src: w.getArtworkUrl(e.id), sizes: '256x256', type: 'image/png' },
          { src: w.getArtworkUrl(e.id), sizes: '384x384', type: 'image/png' },
          { src: w.getArtworkUrl(e.id), sizes: '512x512', type: 'image/png' },
        ],
      })),
      this.setupMediaSession(),
      (navigator.mediaSession.playbackState = 'playing'));
  }
  formatTime(e) {
    if (isNaN(e)) return '0:00';
    const t = Math.floor(e / 60),
      s = Math.floor(e % 60);
    return `${t}:${s.toString().padStart(2, '0')}`;
  }
  getState() {
    return this.state;
  }
}
