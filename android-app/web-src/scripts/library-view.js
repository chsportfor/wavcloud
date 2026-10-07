class LibraryView {
  constructor(e, t) {
    defineField(this, 'el');
    defineField(this, 'trackListEl');
    defineField(this, 'headerTitleEl');
    defineField(this, 'bottomNavEl');
    defineField(this, 'tracks', []);
    defineField(this, 'playlists', []);
    defineField(this, 'folders', []);
    defineField(
      this,
      'currentMenuTab',
      localStorage.getItem('cm_active_tab') === 'folders'
        ? 'tracks'
        : localStorage.getItem('cm_active_tab') || 'tracks',
    );
    defineField(this, 'activeDetailView', null);
    defineField(this, 'activeSubFolder', null);
    defineField(this, 'searchQuery', '');
    defineField(this, 'draggedIndex', null);
    defineField(this, 'prevMenuTab', '');
    defineField(this, 'prevDetailViewName', '');
    defineField(this, 'prevSubFolder', '');
    defineField(
      this,
      'artObserver',
      new IntersectionObserver(
        (e) => {
          e.forEach((t) => {
            if (t.isIntersecting) {
              const s = t.target,
                i = s.getAttribute('data-art-url');
              i &&
                ((s.style.backgroundImage = `url("${i}")`),
                (s.style.backgroundSize = 'cover'),
                (s.style.backgroundPosition = 'center'),
                (s.innerHTML = ''),
                s.removeAttribute('data-art-url'));
              this.artObserver.unobserve(s);
            }
          });
        },
        { rootMargin: '200px' },
      ),
    );
    var o, l, c, f;
    this.onPlayTrack = t;
    this.el = document.createElement('div');
    this.el.className = 'view library-view';
    this.el.innerHTML = `
      <div class="library-fixed-header">
        <div class="library-header">
          <div style="display: flex; align-items: center; gap: 15px; min-width: 0; flex: 1;">
            <button class="btn-icon" id="lib-back-btn" style="display: none; color: white;" title="뒤로가기">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <h2 id="lib-header-title" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0;">내 라이브러리</h2>
          </div>
          <div style="display: flex; gap: 12px; align-items: center; flex-shrink: 0;" id="lib-action-area">
            <input type="text" id="search-input" placeholder="검색..." class="glass" style="display: none; max-width: 130px; padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); color: white;" />
            <button class="btn-icon" id="search-toggle-btn" title="검색" style="color: white; display: flex; align-items: center; justify-content: center;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </button>
            <button class="btn" id="create-playlist-btn" style="padding: 6px 12px; border-radius: 8px; font-size: 0.85rem; display: none;">+ 재생목록</button>

            <div style="position: relative; display: flex; align-items: center;">
              <button class="btn-icon" id="settings-toggle-btn" title="설정" style="color: white; display: flex; align-items: center; justify-content: center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              </button>
              <div class="settings-dropdown glass" id="settings-dropdown" style="display: none;">
                <button class="dropdown-item" id="upload-menu-btn">음악 업로드</button>
                <button class="dropdown-item" id="scan-menu-btn">라이브러리 스캔</button>
                <button class="dropdown-item" id="logout-menu-btn" style="color: #ff4b4b;">로그아웃</button>
              </div>
            </div>
          </div>
        </div>
        <!-- Permanent View Mode Toggle Bar (No Emojis, Clean Text: 앨범 | 폴더) -->
        <div class="ui-view-mode-bar" id="lib-view-mode-bar">
          <div class="ui-view-mode-title" id="lib-view-mode-title">앨범 컬렉션</div>
          <div class="ui-segmented-control" id="lib-segmented-control">
            <button class="ui-segment-btn active" data-mode="albums">앨범</button>
            <button class="ui-segment-btn" data-mode="folders">폴더</button>
          </div>
        </div>
      </div>

      <!-- Isolated Scrolling Area -->
      <div class="library-scroll-container" id="lib-scroll-container">
        <div class="track-list" id="track-list"></div>
      </div>

      <!-- Bottom Navigation Bar -->
      <div class="bottom-nav" id="lib-bottom-nav">
        <button class="nav-btn active" data-tab="tracks">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
          <span>라이브러리</span>
        </button>
        <button class="nav-btn" data-tab="playlists">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
          <span>재생목록</span>
        </button>
        <button class="nav-btn" data-tab="offline">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          <span>저장됨</span>
        </button>
      </div>
    `;
    this.trackListEl = this.el.querySelector('#track-list');
    this.headerTitleEl = this.el.querySelector('#lib-header-title');
    this.bottomNavEl = this.el.querySelector('#lib-bottom-nav');
    this.bottomNavEl.querySelectorAll('.nav-btn').forEach((d) => {
      d.getAttribute('data-tab') === this.currentMenuTab
        ? d.classList.add('active')
        : d.classList.remove('active');
    });
    e.appendChild(this.el);
    const s = this.el.querySelector('#search-input'),
      i = this.el.querySelector('#search-toggle-btn');
    i == null ||
      i.addEventListener('click', () => {
        s.style.display === 'none'
          ? ((s.style.display = 'block'), s.focus())
          : ((s.style.display = 'none'), (s.value = ''), (this.searchQuery = ''), this.render());
      });
    s == null ||
      s.addEventListener('input', (d) => {
        ((this.searchQuery = d.target.value.toLowerCase()), this.render());
      });
    const r = this.el.querySelector('#settings-toggle-btn'),
      a = this.el.querySelector('#settings-dropdown');
    r == null ||
      r.addEventListener('click', (d) => {
        (d.stopPropagation(), (a.style.display = a.style.display === 'none' ? 'block' : 'none'));
      });
    window.addEventListener('click', () => {
      a && (a.style.display = 'none');
    });
    (o = this.el.querySelector('#upload-menu-btn')) == null ||
      o.addEventListener('click', (d) => {
        (d.stopPropagation(), (a.style.display = 'none'), this.showUploadModal());
      });
    const n = this.el.querySelector('#scan-menu-btn');
    n == null ||
      n.addEventListener('click', async (d) => {
        (d.stopPropagation(), (a.style.display = 'none'), this.startLibraryScan());
      });
    (l = this.el.querySelector('#logout-menu-btn')) == null ||
      l.addEventListener('click', (d) => {
        (d.stopPropagation(), w.logout(), window.location.reload());
      });
    (c = this.el.querySelector('#create-playlist-btn')) == null ||
      c.addEventListener('click', () => {
        this.promptCreatePlaylist();
      });
    (f = this.el.querySelector('#lib-back-btn')) == null ||
      f.addEventListener('click', () => {
        this.activeSubFolder
          ? ((this.activeSubFolder = null),
            history.pushState(
              {
                view: 'library-detail',
                tab: this.currentMenuTab,
                detail: this.activeDetailView,
                subFolder: null,
              },
              '',
            ),
            this.render())
          : this.activeDetailView &&
            ((this.activeDetailView = null),
            history.pushState({ view: 'library', tab: this.currentMenuTab }, ''),
            this.render());
      });
    this.bottomNavEl.querySelectorAll('.nav-btn').forEach((d) => {
      d.addEventListener('click', () => {
        ((this.currentMenuTab = d.getAttribute('data-tab')),
          localStorage.setItem('cm_active_tab', this.currentMenuTab),
          this.bottomNavEl
            .querySelectorAll('.nav-btn')
            .forEach((g) => g.classList.remove('active')),
          d.classList.add('active'),
          (this.activeDetailView = null),
          (this.activeSubFolder = null),
          history.replaceState({ view: 'library', tab: this.currentMenuTab }, ''),
          this.render());
      });
    });
    this.loadPlaylists();
    window.addEventListener('offline:downloaded', () => this.render());
    window.addEventListener('offline:removed', () => this.render());
  }
  observeArtworks(e) {
    e.querySelectorAll('.track-art[data-art-url]').forEach((t) => this.artObserver.observe(t));
  }
  scrollToTop() {
    const e = this.el.querySelector('#lib-scroll-container');
    e && (e.scrollTop = 0);
  }
  show() {
    this.el.classList.add('active');
    this.loadTracks();
    uiResumeLibraryScan(this);
  }
  hide() {
    this.el.classList.remove('active');
  }
  closeDetailView(e) {
    this.activeDetailView = null;
    this.activeSubFolder = null;
    e && e.tab && (this.currentMenuTab = e.tab);
    localStorage.setItem('cm_active_tab', this.currentMenuTab);
    this.bottomNavEl.querySelectorAll('.nav-btn').forEach((t) => {
      t.getAttribute('data-tab') === this.currentMenuTab
        ? t.classList.add('active')
        : t.classList.remove('active');
    });
    this.render();
  }
  restoreDetailState(e) {
    this.currentMenuTab = e.tab || 'tracks';
    localStorage.setItem('cm_active_tab', this.currentMenuTab);
    this.activeDetailView = e.detail || null;
    this.activeSubFolder = e.subFolder || null;
    this.bottomNavEl.querySelectorAll('.nav-btn').forEach((t) => {
      t.getAttribute('data-tab') === this.currentMenuTab
        ? t.classList.add('active')
        : t.classList.remove('active');
    });
    this.render();
  }
  loadPlaylists() {
    this.playlists = uiLoadPlaylists();
  }
  savePlaylists() {
    localStorage.setItem('cm_playlists', JSON.stringify(this.playlists));
  }
  promptCreatePlaylist(trackId) {
    return uiCreatePlaylist(this, trackId);
  }
  confirmDeletePlaylist(playlist) {
    return uiDeletePlaylist(this, playlist);
  }
  startLibraryScan() {
    return uiStartLibraryScan(this);
  }
  async loadTracks() {
    return uiLoadTracks(this);
  }
  getTrackLocation(e) {
    let t = '',
      s = '';
    const i = e.filePath.split(/[/\\]/);
    let r = i.indexOf('음악 앨범');
    return (
      r === -1 && (r = i.indexOf('music')),
      r !== -1
        ? (i.length > r + 1 && (t = i[r + 1]),
          i.length > r + 2 && r + 2 < i.length - 1 && (s = i[r + 2]))
        : i.length > 2
          ? ((t = i[i.length - 3]), (s = i[i.length - 2]))
          : i.length > 1 && (t = i[i.length - 2]),
      { category: t, album: s }
    );
  }
  extractFolders() {
    const e = new Set();
    this.tracks.forEach((i) => {
      const { category: r } = this.getTrackLocation(i);
      r && e.add(r);
    });
    const t = Array.from(e),
      s = localStorage.getItem('cm_folder_order');
    if (s)
      try {
        const i = JSON.parse(s);
        t.sort((r, a) => {
          const n = i.indexOf(r),
            o = i.indexOf(a);
          return n !== -1 && o !== -1
            ? n - o
            : n !== -1
              ? -1
              : o !== -1
                ? 1
                : r.localeCompare(a, void 0, { numeric: !0, sensitivity: 'base' });
        });
      } catch {
        t.sort((i, r) => i.localeCompare(r, void 0, { numeric: !0, sensitivity: 'base' }));
      }
    else t.sort((i, r) => i.localeCompare(r, void 0, { numeric: !0, sensitivity: 'base' }));
    this.folders = t;
  }
  render() {
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
    const isLibTab = this.currentMenuTab === 'tracks' || this.currentMenuTab === 'folders';
    if (this.currentMenuTab === 'folders') this.currentMenuTab = 'tracks';

    // State change check for scroll reset
    const detailKey = this.activeDetailView
      ? `${this.activeDetailView.type}:${this.activeDetailView.name}`
      : '';
    const subKey = this.activeSubFolder || '';
    if (
      this.currentMenuTab !== this.prevMenuTab ||
      detailKey !== this.prevDetailViewName ||
      subKey !== this.prevSubFolder
    ) {
      this.prevMenuTab = this.currentMenuTab;
      this.prevDetailViewName = detailKey;
      this.prevSubFolder = subKey;
      this.scrollToTop();
    }

    const backBtn = this.el.querySelector('#lib-back-btn');
    const plBtn = this.el.querySelector('#create-playlist-btn');

    // Setup modeBar elements if not cached
    if (!this.modeBarEl) {
      this.modeBarEl = this.el.querySelector('#lib-view-mode-bar');
      this.modeTitleEl = this.el.querySelector('#lib-view-mode-title');
      const segBtns = this.el.querySelectorAll('#lib-segmented-control .ui-segment-btn');
      segBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const mode = btn.getAttribute('data-mode');
          this.libraryViewMode = mode;
          localStorage.setItem('cm_lib_view_mode', mode);
          this.activeDetailView = null;
          this.activeSubFolder = null;
          this.scrollToTop();
          this.render();
        });
      });
    }

    // Active View Mode: 'albums' (default) or 'folders'
    const savedMode = localStorage.getItem('cm_lib_view_mode');
    this.libraryViewMode = savedMode === 'folders' ? 'folders' : 'albums';

    // Toggle View Mode Bar (Visible only in top-level library tab when not searching)
    if (this.modeBarEl) {
      if (isLibTab && !isDetail && !isSearch) {
        this.modeBarEl.style.display = 'flex';
        if (this.modeTitleEl) {
          this.modeTitleEl.textContent =
            this.libraryViewMode === 'folders' ? '폴더 탐색' : '앨범 컬렉션';
        }
        const segBtns = this.el.querySelectorAll('#lib-segmented-control .ui-segment-btn');
        segBtns.forEach((b) => {
          b.classList.toggle('active', b.getAttribute('data-mode') === this.libraryViewMode);
        });
      } else {
        this.modeBarEl.style.display = 'none';
      }
    }

    // Render view content
    if (isDetail) {
      if (backBtn) backBtn.style.display = 'inline-flex';
      if (plBtn) plBtn.style.display = 'none';
      this.headerTitleEl.textContent = this.activeSubFolder
        ? this.activeSubFolder
        : this.activeDetailView.name;
      this.renderDetailViewTracks();
    } else {
      if (backBtn) backBtn.style.display = 'none';
      this.headerTitleEl.textContent = '내 라이브러리';
      if (this.currentMenuTab === 'playlists') {
        if (plBtn) plBtn.style.display = 'block';
        this.renderPlaylistsGrid();
      } else if (this.currentMenuTab === 'offline') {
        if (plBtn) plBtn.style.display = 'none';
        this.renderOfflineList();
      } else {
        // Main Library Tab ("tracks")
        if (plBtn) plBtn.style.display = 'none';
        this.renderAllTracksList();
      }
    }
  }
  renderPlaylistsGrid() {
    if (((this.trackListEl.innerHTML = ''), this.playlists.length === 0)) {
      this.trackListEl.innerHTML = `
        <div style="text-align:center; padding: 60px 20px; color: var(--text-secondary);">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 15px; opacity: 0.5;"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
          <p>생성된 재생목록이 없습니다. 위 버튼을 눌러 추가해보세요!</p>
        </div>
      `;
      return;
    }
    const e = document.createElement('div');
    e.className = 'track-list';
    this.playlists.forEach((t) => {
      var n;
      const i = t.trackIds
          .map((o) => this.tracks.find((l) => l.id === o))
          .filter((o) => !!o)
          .find((o) => o.hasArtwork),
        r = i
          ? `<div class="track-art" data-art-url="${uiEscapeHtml(w.getArtworkUrl(i.id))}" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);"></div>`
          : `<div class="track-art" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
          </div>`,
        a = document.createElement('div');
      ((a.className = 'track-item glass'),
        (a.style.gridTemplateColumns = '40px 1fr auto'),
        (a.style.cursor = 'pointer'),
        (a.innerHTML = `
        ${r}
        <div class="track-info">
          <div class="track-title" style="font-weight: 600; font-size: 0.95rem; color: white;">${uiEscapeHtml(t.name)}</div>
          <div class="track-artist" style="font-size: 0.8rem; color: var(--text-secondary);">재생목록 • ${t.trackIds.length}곡</div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; padding-right: 5px;">
          <button class="btn-icon delete-playlist-btn" title="재생목록 삭제" style="color: #ff4b4b; background: none; border: none; cursor: pointer; padding: 4px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
      `),
        (n = a.querySelector('.delete-playlist-btn')) == null ||
          n.addEventListener('click', (o) => {
            (o.stopPropagation(), this.confirmDeletePlaylist(t));
          }),
        a.addEventListener('click', () => {
          ((this.activeDetailView = { type: 'playlist', name: t.name }),
            history.pushState(
              {
                view: 'library-detail',
                tab: this.currentMenuTab,
                detail: this.activeDetailView,
                subFolder: null,
              },
              '',
            ),
            this.render());
        }),
        e.appendChild(a));
    });
    this.trackListEl.appendChild(e);
    this.observeArtworks(this.trackListEl);
  }
  renderFoldersGrid() {
    this.trackListEl.replaceChildren();
    if (!this.folders || this.folders.length === 0) {
      this.trackListEl.innerHTML =
        '<div style="text-align:center; padding: 60px 20px; color: var(--text-secondary);">감지된 폴더가 없습니다.</div>';
      return;
    }
    const heading = uiText('div', 'ui-collection-heading', '');
    heading.append(uiText('h2', '', '폴더'), uiText('span', '', `${this.folders.length}개의 폴더`));
    this.trackListEl.append(heading);
    const container = uiText('div', 'ui-folder-list', '');
    this.folders.forEach((folderName) => {
      const folderTracks = this.tracks.filter((t) =>
        t.filePath.split(/[/\\]/).includes(folderName),
      );
      const count = folderTracks.length;
      const item = uiButton('', 'ui-folder-card', null);
      const folderIcon = uiText('div', 'ui-folder-icon', '');
      folderIcon.innerHTML =
        '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>';
      const info = uiText('div', 'ui-folder-info', '');
      info.append(uiText('strong', '', folderName), uiText('span', '', `${count}곡`));
      const arrow = uiText('div', 'ui-folder-arrow', '');
      arrow.innerHTML =
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>';
      item.append(folderIcon, info, arrow);
      item.addEventListener('click', () => {
        this.activeDetailView = { type: 'folder', name: folderName };
        history.pushState(
          {
            view: 'library-detail',
            tab: this.currentMenuTab,
            detail: this.activeDetailView,
            subFolder: null,
          },
          '',
        );
        this.render();
      });
      container.appendChild(item);
    });
    this.trackListEl.appendChild(container);
  }
  renderAllTracksList() {
    this.trackListEl.replaceChildren();

    // Search Results
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      const filtered = this.tracks.filter(
        (t) =>
          (t.title && t.title.toLowerCase().includes(q)) ||
          (t.artist && t.artist.toLowerCase().includes(q)) ||
          (t.album && t.album.toLowerCase().includes(q)),
      );
      if (filtered.length === 0) {
        this.trackListEl.innerHTML =
          '<div style="text-align:center; padding: 60px 20px; color: var(--text-secondary);">검색 결과가 없습니다.</div>';
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
          uiButton('음악 업로드', 'ui-action-primary', () => this.showUploadModal()),
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
  }
  renderDetailViewTracks() {
    if (this.activeDetailView?.type === 'folder' && this.activeSubFolder) {
      const category = this.activeDetailView.name;
      const tracks = uiApplySavedTrackOrder(
        this,
        this.tracks.filter((track) => {
          const location = this.getTrackLocation(track);
          return location.category === category && location.album === this.activeSubFolder;
        }),
      );

      this.trackListEl.replaceChildren();
      if (!tracks.length) {
        this.trackListEl.append(uiText('p', 'ui-empty', '이 폴더에는 재생할 곡이 없습니다.'));
        return;
      }

      const sourceCover = tracks.find((track) => track.hasArtwork) || tracks[0];
      const cover = sourceCover ? { ...sourceCover, album: this.activeSubFolder } : sourceCover;
      const mins = Math.round(tracks.reduce((sum, track) => sum + (track.duration || 0), 0) / 60);
      const hero = uiText('section', 'ui-album-hero', '');
      const info = uiText('div', 'ui-album-info', '');
      info.append(
        uiText('p', 'ui-eyebrow', category.toUpperCase()),
        uiText('h1', '', this.activeSubFolder),
        uiText(
          'p',
          'ui-muted',
          `${tracks[0]?.artist || '아티스트 미상'} · ${tracks.length}곡 · 약 ${mins}분`,
        ),
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
        }),
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
      return this.renderFolderPlaylistDetail();
    }

    let targetAlbum = null;
    const catData = this.categoryAlbumMap();
    for (const { albums } of catData) {
      const found = albums.find((a) => a.key === this.activeDetailView.key);
      if (found) {
        targetAlbum = found;
        break;
      }
    }

    this.trackListEl.replaceChildren();
    if (!targetAlbum) {
      this.trackListEl.append(uiText('p', 'ui-empty', '앨범을 찾을 수 없습니다.'));
      return;
    }

    // NOTE: Redundant '← 앨범 목록으로' chip button removed as requested by user!
    // Back navigation is handled by top-left #lib-back-btn.

    const tracks = uiApplySavedTrackOrder(this, targetAlbum.tracks);
    const sourceCover = tracks.find((t) => t.hasArtwork) || tracks[0];
    const cover = sourceCover ? { ...sourceCover, album: targetAlbum.title } : sourceCover;
    const mins = Math.round(tracks.reduce((sum, t) => sum + (t.duration || 0), 0) / 60);

    const hero = uiText('section', 'ui-album-hero', '');
    const info = uiText('div', 'ui-album-info', '');
    info.append(
      uiText(
        'p',
        'ui-eyebrow',
        targetAlbum.category ? targetAlbum.category.toUpperCase() : 'ALBUM',
      ),
      uiText('h1', '', targetAlbum.title),
      uiText(
        'p',
        'ui-muted',
        `${tracks[0]?.artist || '아티스트 미상'} · ${tracks.length}곡 · 약 ${mins}분`,
      ),
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
      }),
    );
    info.append(actions);
    hero.append(uiCover(cover, 'ui-hero-cover'), info);
    this.trackListEl.append(hero);

    const list = uiText('div', 'ui-album-tracks', '');
    this.trackListEl.append(list);
    this.renderTrackItemsList(tracks, list);
  }
  createDetailActionBar(e) {
    var s, i, r;
    const t = document.createElement('div');
    return (
      (t.className = 'detail-action-bar'),
      (t.innerHTML = `
      <button class="btn-action primary" id="act-play-all">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        <span>전체 재생</span>
      </button>
      <button class="btn-action" id="act-add-queue">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        <span>대기열에 추가</span>
      </button>
      <button class="btn-action" id="act-play-next">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>
        <span>다음에 재생</span>
      </button>
    `),
      (s = t.querySelector('#act-play-all')) == null ||
        s.addEventListener('click', () => {
          e.length !== 0 && (this.onPlayTrack(e[0], e), P(`${e.length}곡 재생을 시작합니다.`));
        }),
      (i = t.querySelector('#act-add-queue')) == null ||
        i.addEventListener('click', () => {
          e.length !== 0 && (p.addToQueue(e), P(`${e.length}곡이 대기열 끝에 추가되었습니다.`));
        }),
      (r = t.querySelector('#act-play-next')) == null ||
        r.addEventListener('click', () => {
          e.length !== 0 &&
            (p.playNextInQueue(e), P(`${e.length}곡이 다음 재생 대기열에 추가되었습니다.`));
        }),
      t
    );
  }
  async renderTrackItemsList(tracks, target) {
    if (this.searchQuery) {
      tracks = tracks.filter(track => uiTrackMatchesSearch(track, this.searchQuery));
      if (!tracks.length) {
        (target || this.trackListEl).replaceChildren(uiText('p', 'ui-empty', '검색 결과가 없습니다.'));
        return;
      }
    }
    if ((await this.renderTrackRows(tracks, target)) === false) return;
    const list = target || this.trackListEl;
    const isReorderableDetail =
      !!uiTrackOrderContext(this) && !this.searchQuery && this.currentMenuTab !== 'offline';
    list.classList.add('ui-track-list');
    list.classList.toggle('ui-restored-album-list', isReorderableDetail);
    list.querySelectorAll('.track-item[data-id]').forEach((row, index) => {
      if (this.searchQuery || this.currentMenuTab === 'offline')
        row.setAttribute('draggable', 'false');
      if (row.querySelector('.ui-more')) return;
      const drag = row.querySelector('.drag-handle');
      if (drag) {
        drag.replaceChildren();
        drag.classList.add('ui-track-number');
        drag.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="6" r="1"></circle><circle cx="16" cy="6" r="1"></circle><circle cx="8" cy="12" r="1"></circle><circle cx="16" cy="12" r="1"></circle><circle cx="8" cy="18" r="1"></circle><circle cx="16" cy="18" r="1"></circle></svg><span>${String(index + 1).padStart(2, '0')}</span>`;
        drag.setAttribute(
          'aria-label',
          `${index + 1}번 곡${isReorderableDetail || (this.activeDetailView?.type === 'playlist' && !this.searchQuery) ? ' 순서 변경' : ''}`,
        );
        drag.addEventListener('click', (event) => event.stopPropagation());

        if (isReorderableDetail) {
          let touchDrag = null;
          drag.addEventListener('pointerdown', (event) => {
            if (event.pointerType === 'mouse') return;
            event.preventDefault();
            event.stopPropagation();
            touchDrag = { pointerId: event.pointerId, from: index, to: index };
            drag.setPointerCapture?.(event.pointerId);
            row.classList.add('dragging');
          });
          drag.addEventListener('pointermove', (event) => {
            if (!touchDrag || touchDrag.pointerId !== event.pointerId) return;
            event.preventDefault();
            const over = document
              .elementFromPoint(event.clientX, event.clientY)
              ?.closest('.track-item[data-id]');
            if (!over || over.parentElement !== row.parentElement) return;
            list
              .querySelectorAll('.track-item.drag-over')
              .forEach((item) => item.classList.remove('drag-over'));
            over.classList.add('drag-over');
            touchDrag.to = [...list.querySelectorAll('.track-item[data-id]')].indexOf(over);
          });
          const finishTouchDrag = (event) => {
            if (!touchDrag || touchDrag.pointerId !== event.pointerId) return;
            event.preventDefault();
            event.stopPropagation();
            const { from, to } = touchDrag;
            touchDrag = null;
            row.classList.remove('dragging');
            list
              .querySelectorAll('.track-item.drag-over')
              .forEach((item) => item.classList.remove('drag-over'));
            if (from !== to && to >= 0) this.reorderTracks(tracks, from, to);
          };
          drag.addEventListener('pointerup', finishTouchDrag);
          drag.addEventListener('pointercancel', finishTouchDrag);
        }
      }
      const actions = [
        ...row.querySelectorAll('.track-queue-btn,.playlist-action-btn,.download-btn'),
      ];
      actions.forEach((b) => (b.hidden = true));
      const info = row.querySelector('.track-info');
      if (info && !info.querySelector('.ui-offline-badge')) {
        const badge = uiText('span', 'ui-offline-badge', '오프라인 저장됨');
        badge.hidden = true;
        info.append(badge);
      }
      uiRefreshOfflineBadge(row);
      const more = uiButton('···', 'ui-more', async (e) => {
        e.stopPropagation();
        await uiRefreshOfflineBadge(row);
        const track = tracks.find((t) => String(t.id) === String(row.dataset.id));
        const d = uiDialog(track?.title || '곡 메뉴');
        const menu = uiText('div', 'ui-menu', '');
        for (const original of actions) {
          const label = original.matches('.track-queue-btn')
            ? '대기열에 추가'
            : original.matches('.playlist-action-btn')
              ? this.activeDetailView?.type === 'playlist'
                ? '재생목록에서 제거'
                : '재생목록에 추가'
              : row.dataset.offlineSaved === 'true'
                ? '오프라인 저장 삭제'
                : '오프라인으로 저장';
          menu.append(
            uiButton(label, 'ui-menu-item', () => {
              d.close();
              original.click();
            }),
          );
        }
        d.append(menu);
        d.showModal();
      });
      more.setAttribute('aria-label', '곡 메뉴');
      row.append(more);
      const rowTrack = tracks.find((track) => String(track.id) === String(row.dataset.id));
      const rowArtwork = row.querySelector('.track-art');
      if (rowTrack && rowArtwork) {
        rowArtwork.dataset.artworkProbe = String(rowTrack.id);
        uiUpgradeArtworkBackground(rowArtwork, rowTrack);
      }
    });
  }
  reorderTracks(tracks, fromIndex, toIndex) {
    if (this.searchQuery || this.currentMenuTab === 'offline') return;
    const context = uiTrackOrderContext(this);
    if (!context) return this.reorderLibraryTracks(tracks, fromIndex, toIndex);
    const moved = tracks.splice(fromIndex, 1)[0];
    if (!moved) return;
    tracks.splice(toIndex, 0, moved);
    localStorage.setItem(
      uiTrackOrderStorageKey(context),
      JSON.stringify(tracks.map((track) => track.id)),
    );
    this.render();
  }
  async addToPlaylist(e) {
    return uiAddToPlaylist(this, e);
  }
  removeFromPlaylist(e) {
    if (!this.activeDetailView || this.activeDetailView.type !== 'playlist') return;
    const t = this.playlists.find((s) => s.name === this.activeDetailView.name);
    t && ((t.trackIds = t.trackIds.filter((s) => s !== e)), this.savePlaylists(), this.render());
  }
  async toggleCache(e, t) {
    return uiToggleCache(this, e, t);
  }
  showUploadModal() {
    return showUploadDialog(this);
  }
  categoryAlbumMap() {
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
  }
  renderAlbumsGrid() {
    const catData = this.categoryAlbumMap();
    const albumCount = catData.reduce((sum, group) => sum + group.albums.length, 0);

    if (!albumCount) {
      this.trackListEl.append(uiText('p', 'ui-empty', '아직 등록된 앨범이 없습니다.'));
      return;
    }

    const categoryNames = catData.map((group) => group.category);
    const savedCategory = localStorage.getItem('cm_album_category_filter') || 'all';
    const selectedCategory =
      savedCategory === 'all' || categoryNames.includes(savedCategory) ? savedCategory : 'all';
    if (selectedCategory !== savedCategory)
      localStorage.setItem('cm_album_category_filter', selectedCategory);

    const categoryFilter = uiText('div', 'ui-category-chips-wrapper', '');
    const filterOptions = [
      { value: 'all', label: '전체' },
      ...categoryNames.map((name) => ({ value: name, label: name })),
    ];
    filterOptions.forEach((option) => {
      const button = uiButton(
        option.label,
        `ui-chip-btn${option.value === selectedCategory ? ' active' : ''}`,
        () => {
          if (option.value === selectedCategory) return;
          localStorage.setItem('cm_album_category_filter', option.value);
          this.scrollToTop();
          this.render();
        },
      );
      button.setAttribute('aria-pressed', String(option.value === selectedCategory));
      categoryFilter.append(button);
    });
    this.trackListEl.append(categoryFilter);

    const createAlbumCard = (album) => {
      const sourceCover = album.tracks.find((t) => t.hasArtwork) || album.tracks[0];
      const cover = sourceCover ? { ...sourceCover, album: album.title } : sourceCover;
      const artist = album.tracks[0]?.artist || '아티스트 미상';
      const card = uiButton('', 'ui-album-card', () => {
        this.scrollToTop();
        this.activeDetailView = {
          type: 'album',
          name: album.title,
          key: album.key,
          category: album.category,
        };
        this.activeSubFolder = null;
        history.pushState(
          { view: 'library-detail', tab: this.currentMenuTab, detail: this.activeDetailView },
          '',
        );
        this.render();
        requestAnimationFrame(() => this.scrollToTop());
      });
      card.append(
        uiCover(cover, 'ui-album-cover'),
        uiText('span', 'ui-album-title', album.title),
        uiText('span', 'ui-album-sub', `${album.tracks.length}곡 · ${artist}`),
      );
      return card;
    };

    const visibleGroups =
      selectedCategory === 'all'
        ? catData
        : catData.filter((group) => group.category === selectedCategory);
    const visibleAlbums = visibleGroups.flatMap((group) => group.albums);
    const heading = uiText('div', 'ui-collection-heading', '');
    heading.append(
      uiText('h2', '', selectedCategory === 'all' ? '전체 앨범' : selectedCategory),
      uiText('span', '', `${visibleAlbums.length}개의 앨범`),
    );
    const grid = uiText('div', 'ui-album-grid', '');
    visibleAlbums.forEach((album) => grid.append(createAlbumCard(album)));
    this.trackListEl.append(heading, grid);
  }
  renderFolderPlaylistDetail() {
    if (this.activeDetailView) {
      if (this.activeDetailView.type === 'playlist') {
        const e = [],
          t = this.playlists.find((i) => i.name === this.activeDetailView.name);
        t &&
          t.trackIds.forEach((i) => {
            const r = this.tracks.find((a) => a.id === i);
            r && e.push(r);
          });
        const s = e.filter(
          (i) =>
            i.title.toLowerCase().includes(this.searchQuery) ||
            (i.artist && i.artist.toLowerCase().includes(this.searchQuery)),
        );
        this.trackListEl.innerHTML = '';
        s.length > 0 && this.trackListEl.appendChild(this.createDetailActionBar(s));
        this.renderTrackItemsList(s, this.trackListEl);
        return;
      }
      if (this.activeDetailView.type === 'folder') {
        const e = this.activeDetailView.name;
        if (this.activeSubFolder) {
          const t = this.tracks.filter((i) => {
            const { category: r, album: a } = this.getTrackLocation(i);
            return r === e && a === this.activeSubFolder;
          });
          t.sort(_trackSorter);
          const s = t.filter(
            (i) =>
              i.title.toLowerCase().includes(this.searchQuery) ||
              (i.artist && i.artist.toLowerCase().includes(this.searchQuery)),
          );
          this.trackListEl.innerHTML = '';
          s.length > 0 && this.trackListEl.appendChild(this.createDetailActionBar(s));
          this.renderTrackItemsList(s, this.trackListEl);
        } else {
          const t = new Set(),
            s = [];
          this.tracks.forEach((n) => {
            const { category: o, album: l } = this.getTrackLocation(n);
            o === e && (l ? t.add(l) : s.push(n));
          });
          const i = Array.from(t),
            r = localStorage.getItem(`cm_album_order_${e}`);
          if (r)
            try {
              const n = JSON.parse(r);
              i.sort((o, l) => {
                const c = n.indexOf(o),
                  f = n.indexOf(l);
                return c !== -1 && f !== -1
                  ? c - f
                  : c !== -1
                    ? -1
                    : f !== -1
                      ? 1
                      : o.localeCompare(l, void 0, { numeric: !0, sensitivity: 'base' });
              });
            } catch {
              i.sort((n, o) => n.localeCompare(o, void 0, { numeric: !0, sensitivity: 'base' }));
            }
          else i.sort((n, o) => n.localeCompare(o, void 0, { numeric: !0, sensitivity: 'base' }));
          if (i.length === 0 && s.length === 0) {
            this.trackListEl.innerHTML =
              '<div style="text-align:center; padding: 40px; color: var(--text-secondary);">수록곡이나 앨범이 없습니다.</div>';
            return;
          }
          this.trackListEl.innerHTML = '';
          const a = document.createElement('div');
          if (
            ((a.className = 'track-list'),
            i.forEach((n) => {
              var g;
              const o = this.tracks.filter((h) => {
                  const { category: k, album: L } = this.getTrackLocation(h);
                  return k === e && L === n;
                }),
                l = o.length,
                c = o.find((h) => h.hasArtwork),
                f = c
                  ? `<div class="track-art" data-art-url="${uiEscapeHtml(w.getArtworkUrl(c.id))}" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);"></div>`
                  : `<div class="track-art" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
              </div>`,
                d = document.createElement('div');
              d.className = 'track-item glass';
              d.setAttribute('draggable', 'true');
              d.setAttribute('data-album', n);
              d.style.gridTemplateColumns = '30px 40px 1fr auto';
              d.style.cursor = 'pointer';
              d.innerHTML = `
            <div class="drag-handle" style="margin-right: 5px; color: rgba(255,255,255,0.2); cursor: grab; display: flex; align-items: center;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </div>
            ${f}
            <div class="track-info">
              <div class="track-title" style="font-weight: 600; font-size: 0.95rem; color: white;">${uiEscapeHtml(n)}</div>
              <div class="track-artist" style="font-size: 0.8rem; color: var(--text-secondary);">앨범 • ${l}곡</div>
            </div>
            <div style="color: var(--text-secondary); display: flex; align-items: center; gap: 6px; padding-right: 5px;">
              <button class="album-queue-btn" title="대기열에 추가" style="color: var(--text-secondary); background: none; border: none; cursor: pointer; padding: 4px; display: flex; align-items: center;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
          `;
              (g = d.querySelector('.album-queue-btn')) == null ||
                g.addEventListener('click', (h) => {
                  (h.stopPropagation(),
                    p.addToQueue(o),
                    P(`"${n}" ${o.length}곡이 대기열에 추가되었습니다.`));
                });
              d.addEventListener('click', (h) => {
                const k = h.target;
                k.closest('.drag-handle') ||
                  k.closest('.album-queue-btn') ||
                  ((this.activeSubFolder = n),
                  history.pushState(
                    {
                      view: 'library-detail',
                      tab: this.currentMenuTab,
                      detail: this.activeDetailView,
                      subFolder: n,
                    },
                    '',
                  ),
                  this.render());
              });
              d.addEventListener('dragstart', (h) => {
                ((this.draggedIndex = i.indexOf(n)),
                  d.classList.add('dragging'),
                  h.dataTransfer &&
                    ((h.dataTransfer.effectAllowed = 'move'),
                    h.dataTransfer.setData('text/plain', n)));
              });
              d.addEventListener('dragend', () => {
                (d.classList.remove('dragging'),
                  a.querySelectorAll('.track-item').forEach((h) => {
                    h.classList.remove('drag-over');
                  }),
                  (this.draggedIndex = null));
              });
              d.addEventListener('dragover', (h) => {
                (h.preventDefault(), d.classList.add('drag-over'));
              });
              d.addEventListener('dragleave', () => {
                d.classList.remove('drag-over');
              });
              d.addEventListener('drop', (h) => {
                var E;
                (h.preventDefault(), d.classList.remove('drag-over'));
                const k = n,
                  L = (E = h.dataTransfer) == null ? void 0 : E.getData('text/plain');
                if (!L || L === k) return;
                const S = this.draggedIndex !== null ? this.draggedIndex : i.indexOf(L),
                  T = i.indexOf(k);
                if (S !== -1 && T !== -1) {
                  const C = i.splice(S, 1)[0];
                  (i.splice(T, 0, C),
                    localStorage.setItem(`cm_album_order_${e}`, JSON.stringify(i)),
                    this.render());
                }
              });
              a.appendChild(d);
            }),
            this.trackListEl.appendChild(a),
            this.observeArtworks(this.trackListEl),
            s.length > 0)
          ) {
            const n = document.createElement('div');
            n.style.padding = '20px 10px 8px 10px';
            n.style.fontSize = '0.9rem';
            n.style.color = 'var(--text-secondary)';
            n.style.fontWeight = '600';
            n.textContent = '수록곡';
            this.trackListEl.appendChild(n);
            s.sort(_trackSorter);
            const o = s.filter(
              (l) =>
                l.title.toLowerCase().includes(this.searchQuery) ||
                (l.artist && l.artist.toLowerCase().includes(this.searchQuery)),
            );
            this.renderTrackItemsList(o, this.trackListEl);
          }
        }
      }
    }
  }
  async renderOfflineList() {
    const version = this.trackRenderVersion;
    this.trackListEl.replaceChildren();
    const cached = [];
    for (const t of this.tracks) {
      const saved = await A.isTrackCached(t.id);
      if (version !== this.trackRenderVersion) return;
      const query = this.searchQuery;
      if (
        saved &&
        (!query ||
          [t.title, t.artist, t.album].some((value) => value?.toLowerCase().includes(query)))
      )
        cached.push(t);
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
  }
  async renderTrackRows(e, t) {
    const version = this.trackRenderVersion;
    const s = t || this.trackListEl;
    t || (s.innerHTML = '');
    const i = [];
    if (this.currentMenuTab === 'offline' && !this.activeDetailView) {
      for (const r of e) {
        const cached = await A.isTrackCached(r.id);
        if (version !== this.trackRenderVersion) return false;
        if (cached) i.push(r);
      }
    } else i.push(...e);
    if (version !== this.trackRenderVersion) return false;
    if (i.length === 0 && !t) {
      s.innerHTML =
        '<div style="text-align:center; padding: 40px; color: var(--text-secondary);">이 항목에 곡이 없습니다.</div>';
      return;
    }
    i.forEach((r) => {
      const a = document.createElement('div');
      ((a.className = 'track-item glass'),
        a.setAttribute('draggable', 'true'),
        a.setAttribute('data-id', r.id),
        A.isTrackCached(r.id).then((l) => {
          const c = a.querySelector('.download-btn');
          l &&
            c &&
            ((c.style.color = '#1ed760'),
            c.setAttribute('title', 'Delete cache'),
            (c.innerHTML =
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><path d="M20 6L9 17l-5-5"></path></svg>'));
        }));
      const n = this.activeDetailView && this.activeDetailView.type === 'playlist',
        o = n
          ? '<button class="btn-icon playlist-action-btn" title="Remove from playlist" style="color: #ff4b4b; background:none; border:none; cursor:pointer;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></button>'
          : '<button class="btn-icon playlist-action-btn" title="Add to playlist" style="color: var(--text-secondary); background:none; border:none; cursor:pointer;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></button>';
      if (
        ((a.innerHTML = `
        <div class="drag-handle" style="margin-right: 5px; color: rgba(255,255,255,0.2); cursor: grab; display: flex; align-items: center;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </div>
        <div class="track-art">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
        </div>
        <div class="track-info" style="flex: 1;">
          <div class="track-title" style="font-weight: 500; font-size: 0.95rem;">${uiEscapeHtml(r.title)}</div>
          <div class="track-artist" style="font-size: 0.8rem; color: var(--text-secondary);">${uiEscapeHtml(r.artist || 'Unknown Artist')}</div>
        </div>
        <div class="track-duration" style="margin-right: 10px; font-size: 0.85rem; color: var(--text-secondary);">${p.formatTime(r.duration || 0)}</div>
        <div style="display: flex; gap: 4px; align-items: center;">
          <button class="btn-icon track-queue-btn" title="대기열에 추가" style="color: var(--text-secondary); background:none; border:none; cursor:pointer; padding: 4px; display: flex; align-items: center;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
          ${o}
          <button class="btn-icon download-btn" title="Download Offline" style="background:none; border:none; cursor:pointer; color: var(--text-secondary); padding: 4px; display: flex; align-items: center;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          </button>
        </div>
      `),
        r.hasArtwork)
      ) {
        const l = a.querySelector('.track-art');
        l && l.setAttribute('data-art-url', w.getArtworkUrl(r.id));
      }
      (a.addEventListener('click', (l) => {
        const c = l.target;
        if (c.closest('.track-queue-btn')) {
          (l.stopPropagation(), p.addToQueue(r), P(`"${r.title}" 대기열에 추가되었습니다.`));
          return;
        }
        if (c.closest('.download-btn')) {
          (l.stopPropagation(), this.toggleCache(r, a));
          return;
        }
        if (c.closest('.playlist-action-btn')) {
          (l.stopPropagation(), n ? this.removeFromPlaylist(r.id) : this.addToPlaylist(r.id));
          return;
        }
        this.onPlayTrack(r, i);
      }),
        a.addEventListener('dragstart', (l) => {
          ((this.draggedIndex = i.findIndex((c) => c.id === r.id)),
            a.classList.add('dragging'),
            l.dataTransfer &&
              ((l.dataTransfer.effectAllowed = 'move'),
              l.dataTransfer.setData('text/plain', r.id)));
        }),
        a.addEventListener('dragend', () => {
          (a.classList.remove('dragging'),
            this.el.querySelectorAll('.track-item').forEach((l) => {
              l.classList.remove('drag-over');
            }),
            (this.draggedIndex = null));
        }),
        a.addEventListener('dragover', (l) => {
          (l.preventDefault(), a.classList.add('drag-over'));
        }),
        a.addEventListener('dragleave', () => {
          a.classList.remove('drag-over');
        }),
        a.addEventListener('drop', (l) => {
          var h;
          (l.preventDefault(), a.classList.remove('drag-over'));
          const c = r.id,
            f = (h = l.dataTransfer) == null ? void 0 : h.getData('text/plain');
          if (!f || f === c) return;
          const d = this.draggedIndex !== null ? this.draggedIndex : i.findIndex((k) => k.id === f),
            g = i.findIndex((k) => k.id === c);
          d !== -1 && g !== -1 && this.reorderTracks(i, d, g);
        }),
        s.appendChild(a));
    });
    this.observeArtworks(s);
  }
  reorderLibraryTracks(e, t, s) {
    const i = e.splice(t, 1)[0];
    if ((e.splice(s, 0, i), this.activeDetailView && this.activeDetailView.type === 'playlist')) {
      const r = this.playlists.find((a) => a.name === this.activeDetailView.name);
      r && ((r.trackIds = e.map((a) => a.id)), this.savePlaylists());
    } else {
      const r = e.map((a) => a.id);
      localStorage.setItem('cm_global_sequence', JSON.stringify(r));
      this.tracks = e;
    }
    this.render();
  }
}
