function uiBrowserShortcut(event, state) {
  if (event.ctrlKey && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k') return 'search';
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat) return null;
  if (event.target?.closest?.('input, textarea, select, button, a, [contenteditable], [role="slider"], dialog[open]')) return null;
  if (!state.currentTrack) return null;
  return { ' ': 'toggle', ArrowLeft: 'backward', ArrowRight: 'forward', n: 'next', p: 'previous', m: 'mute' }[event.key] || null;
}

function uiSetupBrowser(app) {
  const nav = document.querySelector('#lib-bottom-nav');
  const brand = uiText('div', 'web-brand', 'WavCloud');
  nav.prepend(brand);
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', '라이브러리 메뉴');
  const search = document.querySelector('#search-input');
  search.setAttribute('aria-label', '곡, 아티스트, 앨범 검색');
  search.placeholder = '곡, 아티스트, 앨범 검색 · Ctrl+K';
  document.querySelector('#search-toggle-btn').title = '검색 (Ctrl+K)';
  for (const id of ['np-volume-slider', 'player-volume-slider']) {
    document.getElementById(id).setAttribute('aria-label', '음량');
  }
  for (const id of ['full-progress-bar']) {
    const bar = document.getElementById(id);
    bar.tabIndex = 0;
    bar.setAttribute('role', 'slider');
    bar.setAttribute('aria-label', '재생 위치');
    bar.setAttribute('aria-valuemin', '0');
    bar.addEventListener('keydown', event => {
      const state = p.getState();
      const value = event.key === 'Home' ? 0 : event.key === 'End' ? state.duration
        : event.key === 'ArrowLeft' ? state.currentTime - 5 : event.key === 'ArrowRight' ? state.currentTime + 5 : null;
      if (value === null || !state.duration) return;
      event.preventDefault();
      event.stopPropagation();
      p.seek(Math.max(0, Math.min(state.duration, value)));
    });
    p.subscribe(state => {
      bar.setAttribute('aria-valuemax', String(state.duration || 0));
      bar.setAttribute('aria-valuenow', String(Math.round(state.currentTime || 0)));
    });
  }
  const wide = window.matchMedia('(min-width: 900px)');
  // The PC layout keeps the real queue visible alongside the artwork.
  const refreshQueue = () => {
    app.playerView.queueAlwaysVisible = wide.matches;
    app.playerView.renderQueue();
  };
  wide.addEventListener('change', refreshQueue);
  refreshQueue();
  let unmutedVolume = p.getState().volume || .5;
  window.addEventListener('keydown', event => {
    if (document.querySelector('dialog[open]')) return;
    const state = p.getState();
    const action = uiBrowserShortcut(event, state);
    if (!action) return;
    event.preventDefault();
    if (action === 'search') {
      app.hidePlayer();
      search.style.display = 'block';
      search.focus();
    } else if (action === 'toggle') state.isPlaying ? p.pause() : p.resume();
    else if (action === 'next') app.playNext();
    else if (action === 'previous') app.playPrev();
    else if (action === 'backward' || action === 'forward') p.seek(Math.max(0, Math.min(state.duration, state.currentTime + (action === 'forward' ? 5 : -5))));
    else if (action === 'mute') {
      if (state.volume > 0) { unmutedVolume = state.volume; p.setVolume(0); }
      else p.setVolume(unmutedVolume);
    }
  });
  const help = uiText('button', 'dropdown-item', '키보드 단축키');
  help.type = 'button';
  document.querySelector('#settings-dropdown').append(help);
  help.addEventListener('click', () => {
    const dialog = document.createElement('dialog');
    dialog.className = 'ui-sheet web-shortcut-dialog';
    dialog.setAttribute('aria-label', '키보드 단축키');
    dialog.innerHTML = '<div class="ui-sheet-heading"><h2>키보드 단축키</h2><button class="ui-close">닫기</button></div><dl><dt>검색</dt><dd>Ctrl+K</dd><dt>재생 / 일시정지</dt><dd>Space</dd><dt>5초 이동</dt><dd>← / →</dd><dt>다음 / 이전 곡</dt><dd>N / P</dd><dt>음소거</dt><dd>M</dd></dl>';
    document.body.append(dialog);
    dialog.querySelector('button').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    dialog.showModal();
  });
}
