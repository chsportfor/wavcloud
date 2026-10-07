let uiSelectedTrack = null;
const p = window.WavCloudAndroid ? new AndroidAudioPlayer() : new AudioPlayer();
const $ = new URLSearchParams(window.location.search),
  H = $.get('token');
if (H) {
  w.token = H;
  localStorage.setItem('cm_token', H);
  $.delete('token');
  const x = $.toString(),
    e = window.location.pathname + (x ? '?' + x : '') + window.location.hash;
  window.history.replaceState(null, '', e);
}

p.subscribe((state) => {
  if (uiSelectedTrack !== state.currentTrack?.id) {
    uiSelectedTrack = state.currentTrack?.id;
    document
      .querySelectorAll('.track-item[data-id]')
      .forEach((row) => row.classList.toggle('ui-current', row.dataset.id === uiSelectedTrack));
  }
});
