class MiniPlayerView {
  constructor(e, t) {
    defineField(this, 'el');
    this.onExpand = t;
    this.el = document.createElement('div');
    this.el.className = 'now-playing-bar';
    e.appendChild(this.el);
    this.render();
    p.subscribe((s) => {
      s.currentTrack
        ? (this.el.classList.add('visible'), this.updateState(s))
        : this.el.classList.remove('visible');
    });
  }
  render() {
    this.renderLayout();
    const area = this.el.querySelector('#np-expand-area');
    area.tabIndex = 0;
    area.setAttribute('role', 'button');
    area.setAttribute('aria-label', '전체 플레이어 열기');
    area.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.onExpand();
      }
    });
    const next = document.createElement('button');
    next.type = 'button';
    next.id = 'np-next-btn';
    next.className = 'btn-icon np-next-btn';
    next.title = '다음 곡';
    next.setAttribute('aria-label', '다음 곡');
    next.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 4.5v15l12-7.5L5 4.5Z"/><path d="M18 4.5h2v15h-2z"/></svg>';
    this.el.querySelector('#np-play-btn').after(next);
    next.addEventListener('click', (event) => {
      event.stopPropagation();
      window.dispatchEvent(new CustomEvent('player:next'));
    });
  }
  updateVolumeFill(e, t) {
    const s = t * 100;
    e.style.background = `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${s}%, rgba(255,255,255,0.1) ${s}%, rgba(255,255,255,0.1) 100%)`;
  }
  updateState(state) {
    uiUpdatePlaybackProgress(this, state);
    const key = uiPlaybackRenderKey(state);
    if (key === this.renderedStateKey) return;
    this.renderedStateKey = key;
    this.updateControls(state);
    this.el
      .querySelector('#np-play-btn')
      .setAttribute('aria-label', state.isPlaying ? '일시정지' : '재생');
    uiEnsureArtwork(this.el.querySelector('.np-art'), state.currentTrack);
  }
  renderLayout() {
    var o;
    this.el.innerHTML = `
      <div class="np-progress"><div class="np-progress-fill" id="np-progress-fill"></div></div>
      <div class="np-left" id="np-expand-area">
        <div class="np-art">
           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" style="margin: 12px;"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
        </div>
        <div class="np-info">
          <div class="np-title" id="np-title"></div>
          <div class="np-artist" id="np-artist"></div>
        </div>
      </div>
      <div class="np-controls" style="display: flex; align-items: center; gap: 15px;">
        <div class="np-volume-mini">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon></svg>
          <div class="volume-slider-wrapper">
            <div class="volume-tooltip" id="np-volume-tooltip">100%</div>
            <input type="range" id="np-volume-slider" min="0" max="1" step="0.01" value="1" style="width: 80px; height: 4px; accent-color: var(--accent-gradient-start); cursor: pointer;" />
          </div>
        </div>
        <button class="btn-icon" id="np-play-btn" style="width: 40px; height: 40px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        </button>
      </div>
    `;
    (o = this.el.querySelector('#np-expand-area')) == null ||
      o.addEventListener('click', () => this.onExpand());
    const e = this.el.querySelector('.np-progress');
    e &&
      e.addEventListener('click', (l) => {
        l.stopPropagation();
        const c = e.getBoundingClientRect(),
          f = Math.max(0, Math.min(1, (l.clientX - c.left) / c.width)),
          d = p.getState();
        d.duration && p.seek(f * d.duration);
      });
    this.el.querySelector('#np-play-btn').addEventListener('click', (l) => {
      (l.stopPropagation(), p.getState().isPlaying ? p.pause() : p.resume());
    });
    const s = this.el.querySelector('#np-volume-slider'),
      i = this.el.querySelector('#np-volume-tooltip');
    let r = null;
    const a = (l) => {
        const c = Math.round(l * 100);
        i &&
          ((i.textContent = `${c}%`),
          (i.style.left = `calc(7px + (100% - 14px) * ${l})`),
          i.classList.add('visible'));
        r && clearTimeout(r);
      },
      n = () => {
        r && clearTimeout(r);
        r = window.setTimeout(() => {
          i && i.classList.remove('visible');
        }, 800);
      };
    s.addEventListener('click', (l) => l.stopPropagation());
    s.addEventListener('input', (l) => {
      const c = parseFloat(l.target.value);
      (p.setVolume(c), this.updateVolumeFill(s, c), a(c), n());
    });
    s.addEventListener('mouseenter', () => {
      a(parseFloat(s.value));
    });
    s.addEventListener('mouseleave', () => {
      n();
    });
    s.addEventListener('pointerdown', () => {
      a(parseFloat(s.value));
    });
    s.addEventListener('pointerup', () => {
      n();
    });
  }
  updateControls(e) {
    if (e.currentTrack) {
      this.el.querySelector('#np-title').textContent = e.currentTrack.title;
      this.el.querySelector('#np-artist').textContent = e.currentTrack.artist || 'Unknown Artist';
      const l = this.el.querySelector('.np-art');
      l &&
        (e.currentTrack.hasArtwork
          ? ((l.style.backgroundImage = `url(${w.getArtworkUrl(e.currentTrack.id)})`),
            (l.style.backgroundSize = 'cover'),
            (l.style.backgroundPosition = 'center'),
            (l.innerHTML = ''))
          : ((l.style.backgroundImage = ''),
            (l.innerHTML =
              '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" style="margin: 12px;"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>')));
    }
    const t = this.el.querySelector('.np-progress');
    t && t.classList.toggle('loading', e.isLoading);
    const s = this.el.querySelector('#np-play-btn');
    e.isLoading
      ? (s.innerHTML =
          '<svg class="spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.15)"></circle><path d="M12 2a10 10 0 0 1 10 10" stroke="#8b5cf6"></path></svg>')
      : e.isPlaying
        ? (s.innerHTML =
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>')
        : (s.innerHTML =
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>');
    const i = this.el.querySelector('#np-volume-slider'),
      r = this.el.querySelector('#np-volume-tooltip');
    i && ((i.value = e.volume.toString()), this.updateVolumeFill(i, e.volume));
    r &&
      ((r.textContent = `${Math.round(e.volume * 100)}%`),
      (r.style.left = `calc(7px + (100% - 14px) * ${e.volume})`));
  }
}
