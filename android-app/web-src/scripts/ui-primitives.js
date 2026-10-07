// === v23 Clean UI Extensions ===

function uiText(tag, className, textContent) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (textContent) el.textContent = textContent;
  return el;
}
function uiButton(text, className, onClick) {
  const btn = uiText('button', className, text);
  if (onClick) btn.addEventListener('click', onClick);
  return btn;
}

// Position updates do not change artwork, controls, metadata, or offline state.
function uiPlaybackRenderKey(state) {
  const track = state.currentTrack;
  return JSON.stringify([
    track?.id,
    track?.title,
    track?.artist,
    track?.album,
    track?.hasArtwork,
    track?.artworkUri,
    state.isPlaying,
    state.isLoading,
    state.volume,
    state.repeat,
    state.shuffle,
  ]);
}

function uiUpdatePlaybackProgress(view, state, full = false) {
  if (full && view.isDraggingProgress) return;
  const duration = state.duration > 0 ? state.duration : state.currentTrack?.duration || 0;
  const position = state.currentTime || 0;
  const percentage = duration > 0 ? Math.min(100, Math.max(0, (position / duration) * 100)) : 0;
  const fill = view.el.querySelector(full ? '#full-progress-fill' : '#np-progress-fill');
  const width = `${percentage}%`;
  if (fill && fill.style.width !== width) fill.style.width = width;
  if (full) {
    for (const [selector, value] of [
      ['#full-current', position],
      ['#full-total', duration],
    ]) {
      const node = view.el.querySelector(selector);
      const text = p.formatTime(value);
      if (node && node.textContent !== text) node.textContent = text;
    }
  }
}
