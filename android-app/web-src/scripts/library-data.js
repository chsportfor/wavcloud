// Validate persisted data before views use string and array methods.
function uiTrackMatchesSearch(track, query) {
  const text = String(query || '').trim().toLocaleLowerCase();
  return !text || [track.title, track.artist, track.album].some(value =>
    typeof value === 'string' && value.toLocaleLowerCase().includes(text));
}

function uiIsTrack(track) {
  return (
    track !== null &&
    typeof track === 'object' &&
    typeof track.id === 'string' &&
    typeof track.title === 'string' &&
    typeof track.filePath === 'string' &&
    (track.artist == null || typeof track.artist === 'string') &&
    (track.album == null || typeof track.album === 'string')
  );
}

function uiLoadPlaylists() {
  try {
    const parsed = JSON.parse(localStorage.getItem('cm_playlists') || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (playlist) =>
          playlist &&
          typeof playlist.name === 'string' &&
          playlist.name.trim() &&
          Array.isArray(playlist.trackIds),
      )
      .map((playlist) => ({
        name: playlist.name,
        trackIds: [...new Set(playlist.trackIds.filter((id) => typeof id === 'string'))],
      }));
  } catch {
    return [];
  }
}

function uiCacheTracks(tracks) {
  // A full browser cache must not prevent a successful network load rendering.
  try {
    localStorage.setItem('cm_tracks', JSON.stringify(tracks));
    return true;
  } catch {
    return false;
  }
}

function uiLoadTracks(library) {
  if (library.trackRequest) return library.trackRequest;
  library.trackRequest = Promise.resolve()
    .then(async () => {
      if (!library.tracks.length) {
        try {
          const tracks = JSON.parse(localStorage.getItem('cm_tracks') || '[]');
          if (Array.isArray(tracks)) library.tracks = tracks.filter(uiIsTrack);
        } catch {
          /* Keep corrupt cache data untouched for recovery. */
        }
        if (library.tracks.length) {
          library.extractFolders();
          library.render();
        }
      }
      library.loadPlaylists();
      if (!library.tracks.length) library.trackListEl.textContent = '라이브러리를 불러오는 중…';
      try {
        let tracks;
        for (let attempt = 0; ; attempt++) {
          try { tracks = await w.getTracks(); break; }
          catch (error) {
            if (error.code !== 'LIBRARY_NOT_READY' || attempt >= 59) throw error;
            if (!library.tracks.length) library.trackListEl.textContent = '서버에서 라이브러리를 준비하고 있습니다…';
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
        tracks.sort(_trackSorter);
        library.tracks = tracks;
        library.libraryLoaded = true;
        uiCacheTracks(tracks);
        library.extractFolders();
        library.render();
      } catch {
        if (!library.tracks.length) {
          library.trackListEl.replaceChildren(
            uiText('p', 'ui-sheet-description', '라이브러리를 불러오지 못했습니다.'),
            uiButton('다시 시도', 'ui-action-secondary', () => library.loadTracks()),
          );
        }
      }
    })
    .finally(() => {
      library.trackRequest = null;
    });
  return library.trackRequest;
}

const uiCacheActions = new Map();
async function uiToggleCache(library, track, row) {
  if (uiCacheActions.has(track.id)) return uiCacheActions.get(track.id);
  const button = row.querySelector('.download-btn');
  if (!button) return;
  const icon = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '…';
  const action = Promise.resolve().then(async () => {
    try {
      if (await A.isTrackCached(track.id)) {
        await A.removeTrack(track.id);
        P('오프라인 저장을 삭제했습니다.');
      } else {
        await A.downloadTrack(track);
        P('오프라인으로 저장했습니다.');
      }
    } catch {
      P('오프라인 저장을 변경하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      button.disabled = false;
      button.innerHTML = icon;
      uiCacheActions.delete(track.id);
      if (row.isConnected) await uiRefreshOfflineBadge(row);
    }
  });
  uiCacheActions.set(track.id, action);
  return action;
}
