class PlayerView {
  constructor(e, t, s, i) {
    defineField(this, 'el');
    defineField(this, 'isDraggingProgress', !1);
    defineField(this, 'animFrameId', null);
    defineField(this, 'freqData', new Uint8Array(64));
    defineField(this, 'autoMaxPeak', 120);
    defineField(this, 'decayData', new Float32Array(28));
    defineField(this, 'draggedQueueIndex', null);
    this.onMinimize = t;
    this.getQueue = s;
    this.onPlayQueueTrack = i;
    this.el = document.createElement('div');
    this.el.className = 'view player-view';
    e.appendChild(this.el);
    this.render();
    p.subscribe((r) => {
      this.updateState(r);
    });
    window.addEventListener('player:queue-changed', () => this.renderQueue());
    window.addEventListener('offline:downloaded', () => this.updateOfflineButton());
    window.addEventListener('offline:removed', () => this.updateOfflineButton());
  }
  show() {
    this.el.scrollTop = 0;
    this.el.scrollLeft = 0;
    this.showContent();
    requestAnimationFrame(() => {
      this.el.scrollTop = 0;
      this.el.scrollLeft = 0;
    });
  }
  hide() {
    this.el.classList.remove('show-queue');
    const trigger = this.el.querySelector('#queue-toggle-btn');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.style.color = '';
    this.el.querySelector('.player-header > div').textContent = '지금 재생 중';
    this.hideContent();
  }
  render() {
    this.renderLayout();
    const queue = this.el.querySelector('.player-queue-container');
    queue.setAttribute('aria-label', '재생 대기열');
    queue.querySelector('.queue-title-wrap span').textContent = '재생 대기열';
    const trigger = this.el.querySelector('#queue-toggle-btn');
    trigger.title = '재생 대기열';
    trigger.setAttribute('aria-label', '재생 대기열 보기');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.addEventListener('click', () => {
      const open = this.el.classList.contains('show-queue');
      trigger.setAttribute('aria-expanded', String(open));
      this.el.querySelector('.player-header > div').textContent = open
        ? '재생 대기열'
        : '지금 재생 중';
      if (open)
        this.el.querySelector('.queue-item.cloud-next')?.scrollIntoView({ block: 'nearest' });
    });
    this.el.querySelector('.player-header > div').textContent = '지금 재생 중';
    this.el.querySelector('#minimize-btn').setAttribute('aria-label', '플레이어 접기');
    for (const [id, label] of [
      ['player-prev-btn', '이전 곡'],
      ['player-next-btn', '다음 곡'],
      ['player-shuffle-btn', '셔플'],
      ['player-repeat-btn', '반복 재생'],
      ['player-download-btn', '오프라인 저장'],
    ])
      this.el.querySelector('#' + id).setAttribute('aria-label', label);
    const status = uiText('div', 'ui-playback-status', '');
    status.setAttribute('role', 'status');
    this.el.querySelector('.bar-left').append(status);
    cloudEnhancePlayerRender.call(this);
  }
  updateVolumeFill(e, t) {
    const s = t * 100;
    e.style.background = `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${s}%, rgba(255,255,255,0.1) ${s}%, rgba(255,255,255,0.1) 100%)`;
  }
  renderQueue() {
    if (!this.el.classList.contains('show-queue')) {
      cloudEnhanceQueue.call(this);
      return;
    }
    this.renderQueueRows();
    const queueTracks = this.getQueue();
    this.el.querySelectorAll('.queue-item[data-index]').forEach((row) => {
      const track = queueTracks[Number(row.dataset.index)];
      const artwork = row.querySelector('.queue-item-art');
      if (track && artwork) {
        artwork.dataset.artworkProbe = String(track.id);
        uiUpgradeArtworkBackground(artwork, track);
      }
    });
    cloudEnhanceQueue.call(this);
  }
  async updateOfflineButton() {
    const trackId = p.getState().currentTrack?.id;
    const button = this.el.querySelector('#player-download-btn');
    const version = (this.offlineRequestVersion = (this.offlineRequestVersion || 0) + 1);
    if (!button) return;
    let saved = false;
    try {
      if (trackId) saved = await A.isTrackCached(trackId);
    } catch (error) {
      console.warn('Offline state lookup failed', error);
    }
    if (version !== this.offlineRequestVersion || p.getState().currentTrack?.id !== trackId) return;
    button.style.color = saved ? '#1ed760' : '';
    button.setAttribute('title', saved ? 'Saved Offline' : 'Save Offline');
  }
  updateState(state) {
    uiUpdatePlaybackProgress(this, state, true);
    const key = uiPlaybackRenderKey(state);
    if (key === this.renderedStateKey) return;
    this.renderedStateKey = key;
    if (this.offlineTrackId !== state.currentTrack?.id) {
      this.offlineTrackId = state.currentTrack?.id;
      this.updateOfflineButton();
    }
    this.updateControls(state);
    const loading = state.isLoading
      ? '재생을 준비하고 있어요'
      : state.currentTrack
        ? state.isPlaying
          ? '재생 중'
          : '일시정지'
        : '';
    const status = this.el.querySelector('.ui-playback-status');
    if (status && status.textContent !== loading) status.textContent = loading;
    this.el
      .querySelector('#full-play-btn')
      .setAttribute('aria-label', state.isPlaying ? '일시정지' : '재생');
    this.el
      .querySelector('#player-repeat-btn')
      .setAttribute(
        'aria-label',
        `반복: ${state.repeat === 'all' ? '전체' : state.repeat === 'one' ? '한 곡' : '끔'}`,
      );
    uiEnsureArtwork(
      this.el.querySelector('#full-art'),
      state.currentTrack,
      this.el.querySelector('.player-bg-blur'),
    );
    cloudEnhancePlayerState.call(this, state);
  }
  startVisualizer() {
    if (this.animFrameId) return;
    const e = this.el.querySelector('#player-visualizer-canvas');
    if (!e) return;
    const t = e.getContext('2d');
    if (!t) return;
    const s = () => {
      if (((this.animFrameId = requestAnimationFrame(s)), !this.el.classList.contains('active')))
        return;
      const i = e.clientWidth || 280,
        r = e.clientHeight || 60;
      (e.width !== i || e.height !== r) && ((e.width = i), (e.height = r));
      p.getByteFrequencyData(this.freqData);
      t.clearRect(0, 0, i, r);
      const a = p.getState(),
        n = this.freqData.length;
      if (a.isPlaying) {
        let g = 10;
        for (let h = 0; h < n; h++) this.freqData[h] > g && (g = this.freqData[h]);
        g > this.autoMaxPeak
          ? (this.autoMaxPeak = this.autoMaxPeak * 0.7 + g * 0.3)
          : (this.autoMaxPeak = this.autoMaxPeak * 0.985 + g * 0.015);
        this.autoMaxPeak = Math.max(80, Math.min(245, this.autoMaxPeak));
      }
      const o = 28,
        l = 5,
        c = (o - 1) * l,
        f = Math.max(4, (i - c) / o),
        d = (i - (o * f + c)) / 2;
      for (let g = 0; g < o; g++) {
        let h = 0;
        if (a.isPlaying) {
          const q = g / (o - 1),
            y = Math.floor(Math.pow(q, 1.4) * (n * 0.85)),
            u = this.freqData[y] || 0,
            m = 0.85 + Math.sin(q * Math.PI * 0.5) * 0.57,
            b = u * m,
            M = Math.min(1, b / this.autoMaxPeak);
          h = Math.pow(M, 1.45);
          this.decayData[g] = h;
        } else this.decayData[g] *= 0.82;
        this.decayData[g] < 0.001 && (this.decayData[g] = 0);
        h = this.decayData[g];
        const L = Math.max(4, h * (r * 0.92)),
          S = d + g * (f + l),
          T = r - L,
          E = a.isPlaying ? 0.95 : Math.max(0.35, Math.min(0.95, h + 0.35)),
          C = t.createLinearGradient(0, T, 0, T + L);
        C.addColorStop(0, `rgba(168, 85, 247, ${E})`);
        C.addColorStop(0.5, `rgba(139, 92, 246, ${E * 0.9})`);
        C.addColorStop(1, `rgba(99, 102, 241, ${E * 0.5})`);
        t.fillStyle = C;
        t.beginPath();
        t.roundRect ? t.roundRect(S, T, f, L, [f / 2, f / 2, 0, 0]) : t.rect(S, T, f, L);
        t.fill();
      }
    };
    s();
  }
  stopVisualizer() {
    this.animFrameId && (cancelAnimationFrame(this.animFrameId), (this.animFrameId = null));
  }
  renderLayout() {
    var E, C, q;
    this.el.innerHTML = `
      <div class="player-bg-blur"></div>
      <div class="player-content">
        <!-- Top Header -->
        <div class="player-header">
          <button class="btn-icon" id="minimize-btn">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
          <div style="font-size: 0.875rem; font-weight: 500; letter-spacing: 2px;">NOW PLAYING</div>
          <div style="display: flex; gap: 12px; align-items: center;">
            <button class="btn-icon" id="queue-toggle-btn" title="Toggle Queue">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
            </button>
            <button class="btn-icon" id="player-download-btn" title="Offline Cache">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            </button>
          </div>
        </div>

        <!-- Main Area: Split Album Art (Left) and Play Queue (Right) -->
        <div class="player-main">
          <div class="player-art-container">
            <div class="player-art" id="full-art">
               <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
            </div>
            <div class="player-art-loader" id="art-loader">
               <svg class="spinner" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
                 <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.1)"></circle>
                 <path d="M12 2a10 10 0 0 1 10 10" stroke="#8b5cf6"></path>
               </svg>
            </div>
            <canvas id="player-visualizer-canvas" class="player-visualizer-canvas"></canvas>
          </div>

          <div class="player-queue-container">
            <div class="queue-header">
              <div class="queue-title-wrap">
                <span>Play Queue</span>
                <span class="queue-count-badge" id="queue-count">0</span>
              </div>
              <button class="queue-clear-btn" id="queue-clear-btn" title="대기열 비우기">비우기</button>
            </div>
            <div class="queue-list" id="player-queue-list"></div>
          </div>
        </div>

        <!-- Bottom Row: Music Bar -->
        <div class="player-bar">
          <div class="bar-left">
            <div class="bar-track-title" id="full-title">Select a track</div>
            <div class="bar-track-artist" id="full-artist">Unknown Artist</div>
          </div>

          <div class="bar-center">
            <div class="main-controls">
              <button class="btn-icon" id="player-shuffle-btn" title="Shuffle">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>
              </button>
              <button class="btn-icon" id="player-prev-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 20L9 12l10-8v16z"></path><line x1="5" y1="19" x2="5" y2="5"></line></svg></button>
              <button class="btn-play" id="full-play-btn">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              </button>
              <button class="btn-icon" id="player-next-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 4l10 8-10 8V4z"></path><line x1="19" y1="5" x2="19" y2="19"></line></svg></button>
              <button class="btn-icon" id="player-repeat-btn" title="Repeat">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
              </button>
            </div>

            <div class="progress-container">
              <div class="progress-time" id="full-current">0:00</div>
              <div class="progress-bar" id="full-progress-bar">
                <div class="progress-fill" id="full-progress-fill"></div>
              </div>
              <div class="progress-time" id="full-total">0:00</div>
            </div>
          </div>

          <div class="bar-right">
            <div class="volume-container">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
              <div class="volume-slider-wrapper">
                <div class="volume-tooltip" id="player-volume-tooltip">50%</div>
                <input type="range" id="player-volume-slider" min="0" max="1" step="0.01" value="0.5" style="width: 120px;" />
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    (E = this.el.querySelector('#minimize-btn')) == null ||
      E.addEventListener('click', () => this.onMinimize());
    const e = this.el.querySelector('#queue-toggle-btn');
    e.addEventListener('click', () => {
      (this.el.classList.toggle('show-queue'),
        this.renderQueue(),
        this.el.classList.contains('show-queue')
          ? (e.style.color = '#8b5cf6')
          : (e.style.color = ''));
    });
    (C = this.el.querySelector('#player-prev-btn')) == null ||
      C.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('player:prev'));
      });
    (q = this.el.querySelector('#player-next-btn')) == null ||
      q.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('player:next'));
      });
    (() => {
      const ac =
          this.el.querySelector('.player-art-container') || this.el.querySelector('#full-art'),
        fa = this.el.querySelector('#full-art');
      if (!ac || !fa) return;
      ((ac.style.touchAction = 'pan-y'),
        (fa.style.touchAction = 'pan-y'),
        (ac.style.userSelect = 'none'),
        (ac.style.webkitUserSelect = 'none'),
        (fa.style.userSelect = 'none'),
        (fa.style.webkitUserSelect = 'none'));
      let sx = 0,
        sy = 0,
        cx = 0,
        cy = 0,
        st = 0,
        sw = !1,
        animating = !1;
      const snapBack = () => {
          ((fa.style.transition =
            'transform 0.32s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.26s ease'),
            (fa.style.transform = 'translateX(0px) rotate(0deg)'),
            (fa.style.opacity = '1'));
        },
        executeTransition = (dir) => {
          if (animating) return;
          animating = !0;
          const isNext = dir === 'next',
            outX = isNext ? -130 : 130,
            outR = isNext ? -14 : 14,
            inX = isNext ? 100 : -100,
            inR = isNext ? 10 : -10;
          ((fa.style.transition =
            'transform 0.22s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.2s ease-out'),
            (fa.style.transform = `translateX(${outX}%) rotate(${outR}deg)`),
            (fa.style.opacity = '0'),
            setTimeout(() => {
              (window.dispatchEvent(new CustomEvent(isNext ? 'player:next' : 'player:prev')),
                (fa.style.transition = 'none'),
                (fa.style.transform = `translateX(${inX}%) rotate(${inR}deg)`),
                (fa.style.opacity = '0'),
                void fa.offsetWidth,
                requestAnimationFrame(() => {
                  ((fa.style.transition =
                    'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease-out'),
                    (fa.style.transform = 'translateX(0px) rotate(0deg)'),
                    (fa.style.opacity = '1'),
                    setTimeout(() => {
                      ((animating = !1), (fa.style.transition = ''));
                    }, 360));
                }));
            }, 210));
        },
        handleEnd = (x, y) => {
          if (animating) return;
          const nw = Date.now(),
            dt = nw - st,
            ax = Math.abs(x),
            ay = Math.abs(y),
            th = dt < 350 ? 25 : 35;
          ax >= th && ax > ay ? executeTransition(x < 0 ? 'next' : 'prev') : snapBack();
        };
      (ac.addEventListener(
        'touchstart',
        (e) => {
          if (animating || e.touches.length !== 1) return;
          ((sx = e.touches[0].clientX),
            (sy = e.touches[0].clientY),
            (cx = sx),
            (cy = sy),
            (st = Date.now()),
            (sw = !0),
            (fa.style.transition = 'none'));
        },
        { passive: !0 },
      ),
        ac.addEventListener(
          'touchmove',
          (e) => {
            if (!sw || animating || e.touches.length !== 1) return;
            ((cx = e.touches[0].clientX), (cy = e.touches[0].clientY));
            const x = cx - sx,
              y = cy - sy,
              ax = Math.abs(x),
              ay = Math.abs(y);
            if (ax > ay) {
              e.cancelable && e.preventDefault();
              const maxD = window.innerWidth ? window.innerWidth * 0.75 : 300,
                cl = Math.max(-maxD, Math.min(maxD, x));
              ((fa.style.transform = `translateX(${cl}px) rotate(${cl * 0.04}deg)`),
                (fa.style.opacity = `${Math.max(0.3, 1 - Math.abs(cl) / (maxD * 1.2))}`));
            }
          },
          { passive: !1 },
        ),
        ac.addEventListener(
          'touchend',
          (e) => {
            if (sw) {
              sw = !1;
              const t = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0] : null,
                x = (t ? t.clientX : cx) - sx,
                y = (t ? t.clientY : cy) - sy;
              handleEnd(x, y);
            }
          },
          { passive: !0 },
        ),
        ac.addEventListener(
          'touchcancel',
          () => {
            sw && ((sw = !1), snapBack());
          },
          { passive: !0 },
        ));
      let md = !1;
      ac.addEventListener('mousedown', (e) => {
        if (animating || e.button !== 0) return;
        ((sx = e.clientX),
          (sy = e.clientY),
          (cx = sx),
          (cy = sy),
          (st = Date.now()),
          (md = !0),
          (fa.style.transition = 'none'));
        const mm = (m) => {
            if (md && !animating) {
              ((cx = m.clientX), (cy = m.clientY));
              const x = cx - sx,
                y = cy - sy;
              if (Math.abs(x) > Math.abs(y)) {
                const maxD = window.innerWidth ? window.innerWidth * 0.75 : 300,
                  cl = Math.max(-maxD, Math.min(maxD, x));
                ((fa.style.transform = `translateX(${cl}px) rotate(${cl * 0.04}deg)`),
                  (fa.style.opacity = `${Math.max(0.3, 1 - Math.abs(cl) / (maxD * 1.2))}`));
              }
            }
          },
          mu = (m) => {
            if (md) {
              ((md = !1),
                window.removeEventListener('mousemove', mm),
                window.removeEventListener('mouseup', mu),
                handleEnd(m.clientX - sx, m.clientY - sy));
            }
          };
        (window.addEventListener('mousemove', mm), window.addEventListener('mouseup', mu));
      });
    })();
    this.el.querySelector('#full-play-btn').addEventListener('click', () => {
      p.getState().isPlaying ? p.pause() : p.resume();
    });
    this.el.querySelector('#player-shuffle-btn').addEventListener('click', () => {
      const y = p.getState();
      p.setShuffle(!y.shuffle);
    });
    this.el.querySelector('#player-repeat-btn').addEventListener('click', () => {
      const y = p.getState();
      let u = 'none';
      (y.repeat === 'none' ? (u = 'all') : y.repeat === 'all' && (u = 'one'), p.setRepeat(u));
    });
    const r = this.el.querySelector('#player-volume-slider'),
      a = this.el.querySelector('#player-volume-tooltip');
    let n = null;
    const o = (y) => {
        const u = Math.round(y * 100);
        a &&
          ((a.textContent = `${u}%`),
          (a.style.left = `calc(7px + (100% - 14px) * ${y})`),
          a.classList.add('visible'));
        n && clearTimeout(n);
      },
      l = () => {
        n && clearTimeout(n);
        n = window.setTimeout(() => {
          a && a.classList.remove('visible');
        }, 800);
      };
    r.addEventListener('input', (y) => {
      const u = parseFloat(y.target.value);
      (p.setVolume(u), this.updateVolumeFill(r, u), o(u), l());
    });
    r.addEventListener('mouseenter', () => {
      o(parseFloat(r.value));
    });
    r.addEventListener('mouseleave', () => {
      l();
    });
    r.addEventListener('pointerdown', () => {
      o(parseFloat(r.value));
    });
    r.addEventListener('pointerup', () => {
      l();
    });
    const c = this.el.querySelector('#full-progress-bar'),
      f = this.el.querySelector('#full-progress-fill'),
      d = this.el.querySelector('#full-current');
    let g = 0;
    const h = (y) => {
        const u = c.getBoundingClientRect();
        if (u.width <= 0) return;
        g = Math.max(0, Math.min(1, (y - u.left) / u.width));
        const m = p.getState();
        f && (f.style.width = `${g * 100}%`);
        d && m.duration && (d.textContent = p.formatTime(g * m.duration));
      },
      k = (y) => {
        this.isDraggingProgress = !0;
        c.classList.add('dragging');
        h(y);
      },
      L = (y) => {
        this.isDraggingProgress && h(y);
      },
      S = () => {
        if (!this.isDraggingProgress) return;
        this.isDraggingProgress = !1;
        c.classList.remove('dragging');
        const y = p.getState();
        y.duration && p.seek(g * y.duration);
      };
    c.addEventListener('mousedown', (y) => {
      (y.preventDefault(), k(y.clientX));
    });
    window.addEventListener('mousemove', (y) => {
      this.isDraggingProgress && L(y.clientX);
    });
    window.addEventListener('mouseup', () => {
      S();
    });
    c.addEventListener(
      'touchstart',
      (y) => {
        k(y.touches[0].clientX);
      },
      { passive: !0 },
    );
    window.addEventListener(
      'touchmove',
      (y) => {
        this.isDraggingProgress && L(y.touches[0].clientX);
      },
      { passive: !0 },
    );
    window.addEventListener('touchend', () => {
      S();
    });
    const T = this.el.querySelector('#player-download-btn');
    T.addEventListener('click', async () => {
      const y = p.getState();
      if (!y.currentTrack) return;
      const u = await A.isTrackCached(y.currentTrack.id);
      T.classList.add('loading');
      try {
        u ? await A.removeTrack(y.currentTrack.id) : await A.downloadTrack(y.currentTrack);
      } catch {
        alert('Offline storage failed');
      } finally {
        T.classList.remove('loading');
        this.updateOfflineButton();
      }
    });
  }
  showContent() {
    this.el.classList.add('active');
    this.updateOfflineButton();
    this.renderQueue();
    this.startVisualizer();
  }
  renderQueueRows() {
    const e = this.el.querySelector('#player-queue-list'),
      t = this.el.querySelector('#queue-count'),
      s = this.el.querySelector('#queue-clear-btn');
    if (!e) return;
    const i = p.getQueue(),
      a = p.getState().currentTrack;
    if (
      (t && (t.textContent = `${i.length}`),
      s &&
        (s.onclick = (n) => {
          if ((n.stopPropagation(), i.length <= 1)) {
            P('비울 대기열이 없습니다.');
            return;
          }
          p.clearQueue();
          P('현재 재생 곡을 제외한 대기열을 비웠습니다.');
        }),
      (e.innerHTML = ''),
      i.length === 0)
    ) {
      e.innerHTML =
        '<div style="text-align:center; padding: 40px 20px; color: var(--text-secondary); font-size: 0.9rem;">재생 대기열이 비어 있습니다.</div>';
      return;
    }
    i.forEach((n, o) => {
      var g;
      const l = a && n.id === a.id,
        c = document.createElement('div');
      c.className = 'queue-item';
      c.setAttribute('draggable', 'true');
      c.setAttribute('data-index', o.toString());
      l && c.classList.add('active');
      const f = n.hasArtwork
          ? `<div class="queue-item-art" style="background-image: url('${w.getArtworkUrl(n.id)}')"></div>`
          : '<div class="queue-item-art"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg></div>',
        d = l ? '<span class="queue-playing-icon">▶</span>' : `${o + 1}`;
      c.innerHTML = `
        <div class="queue-drag-handle" title="순서 변경">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </div>
        <div class="queue-item-index">${d}</div>
        ${f}
        <div class="queue-item-info">
          <div class="queue-item-title">${uiEscapeHtml(n.title)}</div>
          <div class="queue-item-artist">${uiEscapeHtml(n.artist || 'Unknown Artist')}</div>
        </div>
        <div class="queue-item-duration">${p.formatTime(n.duration || 0)}</div>
        <button class="queue-remove-btn" title="대기열에서 삭제">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      `;
      c.addEventListener('click', (h) => {
        const k = h.target;
        k.closest('.queue-remove-btn') ||
          k.closest('.queue-drag-handle') ||
          this.onPlayQueueTrack(n);
      });
      (g = c.querySelector('.queue-remove-btn')) == null ||
        g.addEventListener('click', (h) => {
          (h.stopPropagation(), p.removeFromQueue(o), P('대기열에서 제거되었습니다.'));
        });
      c.addEventListener('dragstart', (h) => {
        ((this.draggedQueueIndex = o),
          c.classList.add('dragging'),
          h.dataTransfer &&
            ((h.dataTransfer.effectAllowed = 'move'),
            h.dataTransfer.setData('text/plain', o.toString())));
      });
      c.addEventListener('dragend', () => {
        (c.classList.remove('dragging'),
          e.querySelectorAll('.queue-item').forEach((h) => h.classList.remove('drag-over')),
          (this.draggedQueueIndex = null));
      });
      c.addEventListener('dragover', (h) => {
        (h.preventDefault(), c.classList.add('drag-over'));
      });
      c.addEventListener('dragleave', () => {
        c.classList.remove('drag-over');
      });
      c.addEventListener('drop', (h) => {
        (h.preventDefault(),
          c.classList.remove('drag-over'),
          this.draggedQueueIndex !== null &&
            this.draggedQueueIndex !== o &&
            p.reorderQueue(this.draggedQueueIndex, o));
      });
      e.appendChild(c);
    });
  }
  hideContent() {
    this.el.classList.remove('active');
    this.stopVisualizer();
  }
  updateControls(e) {
    var c, f;
    if (e.currentTrack) {
      this.el.querySelector('#full-title').textContent = e.currentTrack.title;
      this.el.querySelector('#full-artist').textContent = e.currentTrack.artist || 'Unknown Artist';
      const d = this.el.querySelector('#full-art'),
        g = this.el.querySelector('.player-bg-blur');
      if (d)
        if (e.currentTrack.hasArtwork) {
          const h = w.getArtworkUrl(e.currentTrack.id);
          d.style.backgroundImage = `url(${h})`;
          d.style.backgroundSize = 'cover';
          d.style.backgroundPosition = 'center';
          d.innerHTML = '';
          g && (g.style.backgroundImage = `url(${h})`);
        } else d.style.backgroundImage = '';
      d.innerHTML =
        '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>';
      g && (g.style.backgroundImage = '');
    }
    const t = this.el.querySelector('.player-art-container');
    t && t.classList.toggle('loading', e.isLoading);
    const s = this.el.querySelector('#full-progress-bar');
    s && s.classList.toggle('loading', e.isLoading);
    const i = this.el.querySelector('#full-play-btn');
    e.isLoading
      ? (i.innerHTML =
          '<svg class="spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><circle cx="12" cy="12" r="10" stroke="rgba(0,0,0,0.1)"></circle><path d="M12 2a10 10 0 0 1 10 10" stroke="var(--bg-dark)"></path></svg>')
      : e.isPlaying
        ? ((i.innerHTML =
            '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>'),
          (c = this.el.querySelector('#full-art')) == null || c.classList.add('playing'))
        : ((i.innerHTML =
            '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>'),
          (f = this.el.querySelector('#full-art')) == null || f.classList.remove('playing'));
    const r = this.el.querySelector('#player-shuffle-btn');
    r && (e.shuffle ? (r.style.color = '#8b5cf6') : (r.style.color = ''));
    const a = this.el.querySelector('#player-repeat-btn');
    a &&
      (e.repeat === 'all'
        ? ((a.style.color = '#8b5cf6'),
          (a.innerHTML =
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>'))
        : e.repeat === 'one'
          ? ((a.style.color = '#8b5cf6'),
            (a.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position: relative;">
            <polyline points="17 1 21 5 17 9"></polyline>
            <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
            <polyline points="7 23 3 19 7 15"></polyline>
            <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
            <text x="9" y="15" font-size="8" font-family="sans-serif" font-weight="900" fill="#8b5cf6">1</text>
          </svg>
        `))
          : ((a.style.color = ''),
            (a.innerHTML =
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>')));
    const slider = this.el.querySelector('#player-volume-slider');
    const tooltip = this.el.querySelector('#player-volume-tooltip');
    if (slider) {
      slider.value = String(e.volume);
      this.updateVolumeFill(slider, e.volume);
    }
    if (tooltip) {
      tooltip.textContent = Math.round(e.volume * 100) + '%';
      tooltip.style.left = 'calc(7px + (100% - 14px) * ' + e.volume + ')';
    }
    const l = this.el.querySelector('#player-queue-list');
    if (l) {
      const d = l.querySelectorAll('.queue-item'),
        g = this.getQueue();
      d.forEach((h, k) => {
        const L = g[k];
        L && e.currentTrack && L.id === e.currentTrack.id
          ? h.classList.add('active')
          : h.classList.remove('active');
      });
    }
  }
}
