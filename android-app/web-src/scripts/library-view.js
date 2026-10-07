function uiDialog(title) {
  const d = document.createElement('dialog');
  d.className = 'ui-sheet';
  const h = uiText('div', 'ui-sheet-heading');
  h.append(uiText('h2', '', title), uiButton('닫기', 'ui-close', () => d.close()));
  d.append(h);
  d.addEventListener('click', e => { if (e.target === d) d.close(); });
  document.body.append(d);
  d.addEventListener('close', () => d.remove());
  return d;
}

// 1. Group tracks into Category -> Album hierarchy
W.prototype.categoryAlbumMap = function() {
  const catMap = new Map();
  for (const track of this.tracks) {
    const loc = this.getTrackLocation(track);
    const cat = loc.category || '기타';
    const albumName = loc.album || track.album || '단일 곡';
    const key = `${cat}///${albumName}`;

    if (!catMap.has(cat)) catMap.set(cat, new Map());
    const albumMap = catMap.get(cat);
    if (!albumMap.has(key)) {
      albumMap.set(key, { key, category: cat, title: albumName, tracks: [], hasArtwork: false });
    }
    const album = albumMap.get(key);
    album.tracks.push(track);
    if (track.hasArtwork) album.hasArtwork = true;
  }

  const result = [];
  for (const [category, albumMap] of catMap.entries()) {
    const albums = [...albumMap.values()];
    albums.sort((a, b) => a.title.localeCompare(b.title, 'ko'));
    result.push({ category, albums });
  }
  result.sort((a, b) => a.category.localeCompare(b.category, 'ko'));
  return result;
};

// 2. Main Render Function (Tabs, Detail Views, Mode Bar)
W.prototype.render = function() {
  this.trackRenderVersion = (this.trackRenderVersion || 0) + 1;
  if (!this.searchConfigured) {
    const search = this.el.querySelector('#search-input');
    search.type = 'search';
    search.placeholder = '곡, 아티스트, 앨범 검색';
    search.setAttribute('aria-label', '곡, 아티스트, 앨범 검색');
    search.style.maxWidth = 'none';
    this.el.querySelector('.library-header').after(search);
    this.searchConfigured = true;
  }
  const isDetail = !!this.activeDetailView;
  const isSearch = !!this.searchQuery;
  const isLibTab = (this.currentMenuTab === "tracks" || this.currentMenuTab === "folders");
  if (this.currentMenuTab === "folders") this.currentMenuTab = "tracks";

  // State change check for scroll reset
  const detailKey = this.activeDetailView ? `${this.activeDetailView.type}:${this.activeDetailView.name}` : "";
  const subKey = this.activeSubFolder || "";
  if (this.currentMenuTab !== this.prevMenuTab || detailKey !== this.prevDetailViewName || subKey !== this.prevSubFolder) {
    this.prevMenuTab = this.currentMenuTab;
    this.prevDetailViewName = detailKey;
    this.prevSubFolder = subKey;
    this.scrollToTop();
  }

  const backBtn = this.el.querySelector("#lib-back-btn");
  const plBtn = this.el.querySelector("#create-playlist-btn");

  // Setup modeBar elements if not cached
  if (!this.modeBarEl) {
    this.modeBarEl = this.el.querySelector("#lib-view-mode-bar");
    this.modeTitleEl = this.el.querySelector("#lib-view-mode-title");
    const segBtns = this.el.querySelectorAll("#lib-segmented-control .ui-segment-btn");
    segBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const mode = btn.getAttribute("data-mode");
        this.libraryViewMode = mode;
        localStorage.setItem("cm_lib_view_mode", mode);
        this.activeDetailView = null;
        this.activeSubFolder = null;
        this.scrollToTop();
        this.render();
      });
    });
  }

  // Active View Mode: 'albums' (default) or 'folders'
  const savedMode = localStorage.getItem('cm_lib_view_mode');
  this.libraryViewMode = (savedMode === 'folders') ? 'folders' : 'albums';

  // Toggle View Mode Bar (Visible only in top-level library tab when not searching)
  if (this.modeBarEl) {
    if (isLibTab && !isDetail && !isSearch) {
      this.modeBarEl.style.display = "flex";
      if (this.modeTitleEl) {
        this.modeTitleEl.textContent = this.libraryViewMode === 'folders' ? '폴더 탐색' : '앨범 컬렉션';
      }
      const segBtns = this.el.querySelectorAll("#lib-segmented-control .ui-segment-btn");
      segBtns.forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-mode') === this.libraryViewMode);
      });
    } else {
      this.modeBarEl.style.display = "none";
    }
  }

  // Render view content
  if (isDetail) {
    if (backBtn) backBtn.style.display = "inline-flex";
    if (plBtn) plBtn.style.display = "none";
    this.headerTitleEl.textContent = this.activeSubFolder ? this.activeSubFolder : this.activeDetailView.name;
    this.renderDetailViewTracks();
  } else {
    if (backBtn) backBtn.style.display = "none";
    this.headerTitleEl.textContent = "내 라이브러리";
    if (this.currentMenuTab === "playlists") {
      if (plBtn) plBtn.style.display = "block";
      this.renderPlaylistsGrid();
    } else if (this.currentMenuTab === "offline") {
      if (plBtn) plBtn.style.display = "none";
      this.renderOfflineList();
    } else {
      // Main Library Tab ("tracks")
      if (plBtn) plBtn.style.display = "none";
      this.renderAllTracksList();
    }
  }
};

// 3. Render Main Library Tab (Albums or Folders)
W.prototype.renderAllTracksList = function() {
  this.trackListEl.replaceChildren();

  // Search Results
  if (this.searchQuery) {
    const q = this.searchQuery.toLowerCase();
    const filtered = this.tracks.filter(t => 
      (t.title && t.title.toLowerCase().includes(q)) ||
      (t.artist && t.artist.toLowerCase().includes(q)) ||
      (t.album && t.album.toLowerCase().includes(q))
    );
    if (filtered.length === 0) {
      this.trackListEl.innerHTML = '<div style="text-align:center; padding: 60px 20px; color: var(--text-secondary);">검색 결과가 없습니다.</div>';
      return;
    }
    this.trackListEl.appendChild(this.createDetailActionBar(filtered));
    const list = uiText('div', 'track-list', '');
    this.trackListEl.appendChild(list);
    this.renderTrackItemsList(filtered, list);
    return;
  }

  // Loading state (Clean spinner, NEVER flash raw flat tracks)
  if (this.tracks.length === 0) {
    if (this.libraryLoaded) {
      const empty = uiText('div', 'ui-empty-library');
      empty.append(
        uiText('p', 'ui-sheet-description', '아직 등록된 곡이 없습니다.'),
        uiButton('음악 업로드', 'ui-action-primary', () => this.showUploadModal())
      );
      this.trackListEl.append(empty);
      return;
    }
    this.trackListEl.innerHTML = `
      <div style="text-align:center; padding: 60px 20px; color: var(--text-secondary);">
        <svg class="spinner" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-bottom: 12px;">
          <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.1)"></circle>
          <path d="M12 2a10 10 0 0 1 10 10" stroke="#8b5cf6"></path>
        </svg>
        <p style="margin: 0; font-size: 0.9rem;">라이브러리를 불러오는 중...</p>
      </div>`;
    return;
  }

  // View modes: 'folders' or 'albums' (default)
  if (this.libraryViewMode === 'folders') {
    this.renderFoldersGrid();
  } else {
    this.renderAlbumsGrid();
  }
};

// 4. Keep the Cloud Dark cards and filter the collection by top-level category.
W.prototype.renderAlbumsGrid = function() {
  const catData = this.categoryAlbumMap();
  const albumCount = catData.reduce((sum, group) => sum + group.albums.length, 0);

  if (!albumCount) {
    this.trackListEl.append(uiText('p', 'ui-empty', '아직 등록된 앨범이 없습니다.'));
    return;
  }

  const categoryNames = catData.map(group => group.category);
  const savedCategory = localStorage.getItem('cm_album_category_filter') || 'all';
  const selectedCategory = savedCategory === 'all' || categoryNames.includes(savedCategory)
    ? savedCategory
    : 'all';
  if (selectedCategory !== savedCategory) localStorage.setItem('cm_album_category_filter', selectedCategory);

  const categoryFilter = uiText('div', 'ui-category-chips-wrapper', '');
  const filterOptions = [{ value: 'all', label: '전체' }, ...categoryNames.map(name => ({ value: name, label: name }))];
  filterOptions.forEach(option => {
    const button = uiButton(option.label, `ui-chip-btn${option.value === selectedCategory ? ' active' : ''}`, () => {
      if (option.value === selectedCategory) return;
      localStorage.setItem('cm_album_category_filter', option.value);
      this.scrollToTop();
      this.render();
    });
    button.setAttribute('aria-pressed', String(option.value === selectedCategory));
    categoryFilter.append(button);
  });
  this.trackListEl.append(categoryFilter);

  const createAlbumCard = (album) => {
    const sourceCover = album.tracks.find(t => t.hasArtwork) || album.tracks[0];
    const cover = sourceCover ? { ...sourceCover, album: album.title } : sourceCover;
    const artist = album.tracks[0]?.artist || '아티스트 미상';
    const card = uiButton('', 'ui-album-card', () => {
      this.scrollToTop();
      this.activeDetailView = { type: 'album', name: album.title, key: album.key, category: album.category };
      this.activeSubFolder = null;
      history.pushState({ view: 'library-detail', tab: this.currentMenuTab, detail: this.activeDetailView }, '');
      this.render();
      requestAnimationFrame(() => this.scrollToTop());
    });
    card.append(
      uiCover(cover, 'ui-album-cover'),
      uiText('span', 'ui-album-title', album.title),
      uiText('span', 'ui-album-sub', `${album.tracks.length}곡 · ${artist}`)
    );
    return card;
  };

  const visibleGroups = selectedCategory === 'all'
    ? catData
    : catData.filter(group => group.category === selectedCategory);
  const visibleAlbums = visibleGroups.flatMap(group => group.albums);
  const heading = uiText('div', 'ui-collection-heading', '');
  heading.append(
    uiText('h2', '', selectedCategory === 'all' ? '전체 앨범' : selectedCategory),
    uiText('span', '', `${visibleAlbums.length}개의 앨범`)
  );
  const grid = uiText('div', 'ui-album-grid', '');
  visibleAlbums.forEach(album => grid.append(createAlbumCard(album)));
  this.trackListEl.append(heading, grid);
};

// 5. Render Folders Grid (Hierarchical Categories -> Albums/Subfolders -> Tracks)
W.prototype.renderFoldersGrid = function() {
  this.trackListEl.replaceChildren();
  if (!this.folders || this.folders.length === 0) {
    this.trackListEl.innerHTML = '<div style="text-align:center; padding: 60px 20px; color: var(--text-secondary);">감지된 폴더가 없습니다.</div>';
    return;
  }
  const heading = uiText('div', 'ui-collection-heading', '');
  heading.append(uiText('h2', '', '폴더'), uiText('span', '', `${this.folders.length}개의 폴더`));
  this.trackListEl.append(heading);
  const container = uiText('div', 'ui-folder-list', '');
  this.folders.forEach(folderName => {
    const folderTracks = this.tracks.filter(t => t.filePath.split(/[/\\]/).includes(folderName));
    const count = folderTracks.length;
    const item = uiButton('', 'ui-folder-card', null);
    const folderIcon = uiText('div', 'ui-folder-icon', '');
    folderIcon.innerHTML = '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>';
    const info = uiText('div', 'ui-folder-info', '');
    info.append(uiText('strong', '', folderName), uiText('span', '', `${count}곡`));
    const arrow = uiText('div', 'ui-folder-arrow', '');
    arrow.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>';
    item.append(folderIcon, info, arrow);
    item.addEventListener("click", () => {
      this.activeDetailView = { type: "folder", name: folderName };
      history.pushState({ view: "library-detail", tab: this.currentMenuTab, detail: this.activeDetailView, subFolder: null }, "");
      this.render();
    });
    container.appendChild(item);
  });
  this.trackListEl.appendChild(container);
};

const uiTrackOrderContext = view => {
  if (view.activeDetailView?.type === 'album') {
    return `album:${view.activeDetailView.key || `${view.activeDetailView.category || ''}/${view.activeDetailView.name || ''}`}`;
  }
  if (view.activeDetailView?.type === 'folder' && view.activeSubFolder) {
    return `folder:${view.activeDetailView.name || ''}/${view.activeSubFolder}`;
  }
  return null;
};

const uiTrackOrderStorageKey = context => `cm_detail_track_order_${encodeURIComponent(context)}`;

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
      .map(item => item.track);
  } catch {
    return tracks;
  }
};

// 6. Detail View (Album Hero or Folder/Playlist Tracks)
const uiOriginalDetail = W.prototype.renderDetailViewTracks;
W.prototype.renderDetailViewTracks = function() {
  if (this.activeDetailView?.type === 'folder' && this.activeSubFolder) {
    const category = this.activeDetailView.name;
    const tracks = uiApplySavedTrackOrder(this, this.tracks.filter(track => {
      const location = this.getTrackLocation(track);
      return location.category === category && location.album === this.activeSubFolder;
    }));

    this.trackListEl.replaceChildren();
    if (!tracks.length) {
      this.trackListEl.append(uiText('p', 'ui-empty', '이 폴더에는 재생할 곡이 없습니다.'));
      return;
    }

    const sourceCover = tracks.find(track => track.hasArtwork) || tracks[0];
    const cover = sourceCover ? { ...sourceCover, album: this.activeSubFolder } : sourceCover;
    const mins = Math.round(tracks.reduce((sum, track) => sum + (track.duration || 0), 0) / 60);
    const hero = uiText('section', 'ui-album-hero', '');
    const info = uiText('div', 'ui-album-info', '');
    info.append(
      uiText('p', 'ui-eyebrow', category.toUpperCase()),
      uiText('h1', '', this.activeSubFolder),
      uiText('p', 'ui-muted', `${tracks[0]?.artist || '아티스트 미상'} · ${tracks.length}곡 · 약 ${mins}분`)
    );
    const actions = uiText('div', 'ui-album-actions', '');
    actions.append(
      uiButton('▶ 전체 재생', 'ui-primary', () => {
        p.setShuffle(false);
        this.onPlayTrack(tracks[0], tracks);
      }),
      uiButton('＋ 대기열', 'ui-secondary', () => {
        p.addToQueue(tracks);
        P(`${tracks.length}곡을 대기열에 추가했습니다.`);
      })
    );
    info.append(actions);
    hero.append(uiCover(cover, 'ui-hero-cover'), info);
    this.trackListEl.append(hero);

    const list = uiText('div', 'ui-album-tracks', '');
    this.trackListEl.append(list);
    this.renderTrackItemsList(tracks, list);
    requestAnimationFrame(() => this.scrollToTop());
    return;
  }

  if (this.activeDetailView?.type !== 'album') {
    return uiOriginalDetail.call(this);
  }

  let targetAlbum = null;
  const catData = this.categoryAlbumMap();
  for (const { albums } of catData) {
    const found = albums.find(a => a.key === this.activeDetailView.key);
    if (found) { targetAlbum = found; break; }
  }

  this.trackListEl.replaceChildren();
  if (!targetAlbum) {
    this.trackListEl.append(uiText('p', 'ui-empty', '앨범을 찾을 수 없습니다.'));
    return;
  }

  // NOTE: Redundant '← 앨범 목록으로' chip button removed as requested by user!
  // Back navigation is handled by top-left #lib-back-btn.

  const tracks = uiApplySavedTrackOrder(this, targetAlbum.tracks);
  const sourceCover = tracks.find(t => t.hasArtwork) || tracks[0];
  const cover = sourceCover ? { ...sourceCover, album: targetAlbum.title } : sourceCover;
  const mins = Math.round(tracks.reduce((sum, t) => sum + (t.duration || 0), 0) / 60);

  const hero = uiText('section', 'ui-album-hero', '');
  const info = uiText('div', 'ui-album-info', '');
  info.append(
    uiText('p', 'ui-eyebrow', targetAlbum.category ? targetAlbum.category.toUpperCase() : 'ALBUM'),
    uiText('h1', '', targetAlbum.title),
    uiText('p', 'ui-muted', `${tracks[0]?.artist || '아티스트 미상'} · ${tracks.length}곡 · 약 ${mins}분`)
  );

  const actions = uiText('div', 'ui-album-actions', '');
  actions.append(
    uiButton('▶ 전체 재생', 'ui-primary', () => {
      p.setShuffle(false);
      this.onPlayTrack(tracks[0], tracks);
    }),
    uiButton('대기열에 추가', 'ui-secondary', () => {
      p.addToQueue(tracks);
      P(`${targetAlbum.title} (${tracks.length}곡)을 대기열에 추가했습니다.`);
    })
  );
  info.append(actions);
  hero.append(uiCover(cover, 'ui-hero-cover'), info);
  this.trackListEl.append(hero);

  const list = uiText('div', 'ui-album-tracks', '');
  this.trackListEl.append(list);
  this.renderTrackItemsList(tracks, list);
};

// 7. Offline List Tab
W.prototype.renderOfflineList = async function() {
  const version = this.trackRenderVersion;
  this.trackListEl.replaceChildren();
  const cached = [];
  for (const t of this.tracks) {
    const saved = await A.isTrackCached(t.id);
    if (version !== this.trackRenderVersion) return;
    const query = this.searchQuery;
    if (saved && (!query || [t.title, t.artist, t.album].some(value => value?.toLowerCase().includes(query)))) cached.push(t);
  }
  if (version !== this.trackRenderVersion) return;
  if (cached.length === 0) {
    this.trackListEl.innerHTML = `
      <div style="text-align:center; padding: 60px 20px; color: var(--text-secondary);">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 15px; opacity: 0.5;">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <p>${this.searchQuery ? '저장된 곡 중 검색 결과가 없습니다.' : '오프라인으로 저장된 곡이 없습니다.'}</p>
      </div>`;
    return;
  }
  this.trackListEl.appendChild(this.createDetailActionBar(cached));
  const list = uiText('div', 'track-list', '');
  this.trackListEl.appendChild(list);
  this.renderTrackItemsList(cached, list);
};

// 8. Enhance Track Rows with Track Numbers & More Popup Menu
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
  window.addEventListener(eventName, event => {
    const trackId = String(event.detail);
    document.querySelectorAll('.library-view .track-item[data-id]').forEach(row => {
      if (row.dataset.id === trackId) uiRefreshOfflineBadge(row);
    });
  });
}

const uiOriginalRows = W.prototype.renderTrackItemsList;
const uiOriginalReorderTracks = W.prototype.reorderTracks;
W.prototype.reorderTracks = function(tracks, fromIndex, toIndex) {
  if (this.searchQuery || this.currentMenuTab === 'offline') return;
  const context = uiTrackOrderContext(this);
  if (!context) return uiOriginalReorderTracks.call(this, tracks, fromIndex, toIndex);
  const moved = tracks.splice(fromIndex, 1)[0];
  if (!moved) return;
  tracks.splice(toIndex, 0, moved);
  localStorage.setItem(uiTrackOrderStorageKey(context), JSON.stringify(tracks.map(track => track.id)));
  this.render();
};

W.prototype.renderTrackItemsList = async function(tracks, target) {
  if (await uiOriginalRows.call(this, tracks, target) === false) return;
  const list = target || this.trackListEl;
  const isReorderableDetail = !!uiTrackOrderContext(this) && !this.searchQuery && this.currentMenuTab !== 'offline';
  list.classList.add('ui-track-list');
  list.classList.toggle('ui-restored-album-list', isReorderableDetail);
  list.querySelectorAll('.track-item[data-id]').forEach((row, index) => {
    if (this.searchQuery || this.currentMenuTab === 'offline') row.setAttribute('draggable', 'false');
    if (row.querySelector('.ui-more')) return;
    const drag = row.querySelector('.drag-handle');
    if (drag) {
      drag.replaceChildren();
      drag.classList.add('ui-track-number');
      drag.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="6" r="1"></circle><circle cx="16" cy="6" r="1"></circle><circle cx="8" cy="12" r="1"></circle><circle cx="16" cy="12" r="1"></circle><circle cx="8" cy="18" r="1"></circle><circle cx="16" cy="18" r="1"></circle></svg><span>${String(index + 1).padStart(2, '0')}</span>`;
      drag.setAttribute('aria-label', `${index + 1}번 곡${isReorderableDetail || this.activeDetailView?.type === 'playlist' && !this.searchQuery ? ' 순서 변경' : ''}`);
      drag.addEventListener('click', event => event.stopPropagation());

      if (isReorderableDetail) {
        let touchDrag = null;
        drag.addEventListener('pointerdown', event => {
          if (event.pointerType === 'mouse') return;
          event.preventDefault();
          event.stopPropagation();
          touchDrag = { pointerId: event.pointerId, from: index, to: index };
          drag.setPointerCapture?.(event.pointerId);
          row.classList.add('dragging');
        });
        drag.addEventListener('pointermove', event => {
          if (!touchDrag || touchDrag.pointerId !== event.pointerId) return;
          event.preventDefault();
          const over = document.elementFromPoint(event.clientX, event.clientY)?.closest('.track-item[data-id]');
          if (!over || over.parentElement !== row.parentElement) return;
          list.querySelectorAll('.track-item.drag-over').forEach(item => item.classList.remove('drag-over'));
          over.classList.add('drag-over');
          touchDrag.to = [...list.querySelectorAll('.track-item[data-id]')].indexOf(over);
        });
        const finishTouchDrag = event => {
          if (!touchDrag || touchDrag.pointerId !== event.pointerId) return;
          event.preventDefault();
          event.stopPropagation();
          const { from, to } = touchDrag;
          touchDrag = null;
          row.classList.remove('dragging');
          list.querySelectorAll('.track-item.drag-over').forEach(item => item.classList.remove('drag-over'));
          if (from !== to && to >= 0) this.reorderTracks(tracks, from, to);
        };
        drag.addEventListener('pointerup', finishTouchDrag);
        drag.addEventListener('pointercancel', finishTouchDrag);
      }
    }
    const actions = [...row.querySelectorAll('.track-queue-btn,.playlist-action-btn,.download-btn')];
    actions.forEach(b => b.hidden = true);
    const info = row.querySelector('.track-info');
    if (info && !info.querySelector('.ui-offline-badge')) {
      const badge = uiText('span', 'ui-offline-badge', '오프라인 저장됨');
      badge.hidden = true;
      info.append(badge);
    }
    uiRefreshOfflineBadge(row);
    const more = uiButton('···', 'ui-more', async e => {
      e.stopPropagation();
      await uiRefreshOfflineBadge(row);
      const track = tracks.find(t => String(t.id) === String(row.dataset.id));
      const d = uiDialog(track?.title || '곡 메뉴');
      const menu = uiText('div', 'ui-menu', '');
      for (const original of actions) {
        const label = original.matches('.track-queue-btn')
          ? '대기열에 추가'
          : original.matches('.playlist-action-btn')
          ? (this.activeDetailView?.type === 'playlist' ? '재생목록에서 제거' : '재생목록에 추가')
          : row.dataset.offlineSaved === 'true'
          ? '오프라인 저장 삭제'
          : '오프라인으로 저장';
        menu.append(uiButton(label, 'ui-menu-item', () => {
          d.close();
          original.click();
        }));
      }
      d.append(menu);
      d.showModal();
    });
    more.setAttribute('aria-label', '곡 메뉴');
    row.append(more);
    const rowTrack = tracks.find(track => String(track.id) === String(row.dataset.id));
    const rowArtwork = row.querySelector('.track-art');
    if (rowTrack && rowArtwork) {
      rowArtwork.dataset.artworkProbe = String(rowTrack.id);
      uiUpgradeArtworkBackground(rowArtwork, rowTrack);
    }
  });
};

