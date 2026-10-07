function uiDialog(title) {
  const d = document.createElement('dialog');
  d.className = 'ui-sheet';
  const h = uiText('div', 'ui-sheet-heading');
  h.append(
    uiText('h2', '', title),
    uiButton('닫기', 'ui-close', () => d.close()),
  );
  d.append(h);
  d.addEventListener('click', (e) => {
    if (e.target === d) d.close();
  });
  document.body.append(d);
  d.addEventListener('close', () => d.remove());
  return d;
}
const uiTrackOrderContext = (view) => {
  if (view.activeDetailView?.type === 'album') {
    return `album:${view.activeDetailView.key || `${view.activeDetailView.category || ''}/${view.activeDetailView.name || ''}`}`;
  }
  if (view.activeDetailView?.type === 'folder' && view.activeSubFolder) {
    return `folder:${view.activeDetailView.name || ''}/${view.activeSubFolder}`;
  }
  return null;
};
const uiTrackOrderStorageKey = (context) => `cm_detail_track_order_${encodeURIComponent(context)}`;
const uiApplySavedTrackOrder = (view, sourceTracks) => {
  const tracks = [...sourceTracks].sort(_trackSorter);
  const context = uiTrackOrderContext(view);
  if (!context) return tracks;
  try {
    const saved = JSON.parse(localStorage.getItem(uiTrackOrderStorageKey(context)) || '[]');
    const ranks = new Map(saved.map((id, index) => [String(id), index]));
    return tracks
      .map((track, baseIndex) => ({ track, baseIndex, rank: ranks.get(String(track.id)) }))
      .sort((a, b) => {
        const ar = a.rank ?? Number.MAX_SAFE_INTEGER;
        const br = b.rank ?? Number.MAX_SAFE_INTEGER;
        return ar - br || a.baseIndex - b.baseIndex;
      })
      .map((item) => item.track);
  } catch {
    return tracks;
  }
};
async function uiRefreshOfflineBadge(row) {
  const badge = row.querySelector('.ui-offline-badge');
  const check = (Number(row.dataset.offlineCheck) || 0) + 1;
  row.dataset.offlineCheck = String(check);
  let saved = false;
  try {
    saved = await A.isTrackCached(row.dataset.id);
  } catch (error) {
    console.warn('[OfflineBadge] Could not check saved track:', error);
  }
  if (row.dataset.offlineCheck !== String(check)) return;
  row.dataset.offlineSaved = String(saved);
  if (badge) badge.hidden = !saved;
  const download = row.querySelector('.download-btn');
  if (download) download.title = saved ? '오프라인 저장 삭제' : '오프라인으로 저장';
}
for (const eventName of ['offline:downloaded', 'offline:removed']) {
  window.addEventListener(eventName, (event) => {
    const trackId = String(event.detail);
    document.querySelectorAll('.library-view .track-item[data-id]').forEach((row) => {
      if (row.dataset.id === trackId) uiRefreshOfflineBadge(row);
    });
  });
}
