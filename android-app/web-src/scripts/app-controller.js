class AppController {
  constructor(e) {
    defineField(this, 'container');
    defineField(this, 'loginView');
    defineField(this, 'libraryView');
    defineField(this, 'playerView');
    defineField(this, 'queue', []);
    if (((this.container = document.getElementById(e)), !this.container))
      throw new Error('App container not found');
    this.loginView = new LoginView(this.container, () => this.showLibrary());
    this.libraryView = new LibraryView(this.container, (t, s) => this.playTrack(t, s));
    this.playerView = new PlayerView(
      this.container,
      () => this.hidePlayer(),
      () => p.getQueue(),
      (t) => this.playTrack(t),
    );
    new MiniPlayerView(this.container, () => this.showPlayer());
    window.addEventListener('player:next', () => this.playNext());
    window.addEventListener('player:prev', () => this.playPrev());
    setTimeout(() => {
      window.addEventListener('popstate', (t) => {
        this.handlePopState(t.state);
      });
    }, 500);
    this.init();
  }
  init() {
    w.isAuthenticated()
      ? (this.showLibrary(),
        history.replaceState({ view: 'library', tab: this.libraryView.currentMenuTab }, ''))
      : this.showLogin();
  }
  showLogin() {
    this.libraryView.hide();
    this.playerView.hide();
    this.loginView.show();
  }
  showLibrary() {
    this.loginView.hide();
    this.playerView.hide();
    this.libraryView.show();
  }
  showPlayer() {
    var e;
    this.playerView.show();
    ((e = history.state) == null ? void 0 : e.view) !== 'player' &&
      history.pushState({ view: 'player' }, '');
  }
  hidePlayer() {
    var e;
    this.playerView.hide();
    ((e = history.state) == null ? void 0 : e.view) === 'player' && history.back();
  }
  handlePopState(e) {
    !e || e.view === 'library'
      ? (this.playerView.hide(), this.libraryView.closeDetailView(e))
      : e.view === 'library-detail'
        ? (this.playerView.hide(), this.libraryView.restoreDetailState(e))
        : e.view === 'player' && this.playerView.show();
  }
  playTrack(e, t) {
    t && t.length > 0 && p.setQueue(t);
    p.play(e);
  }
  playNext() {
    const next = p.getNextTrack();
    if (next) p.play(next);
    else p.stop(true);
  }
  playPrev() {
    const e = p.getQueue();
    if (e.length === 0) return;
    const t = p.getState();
    if (!t.currentTrack) return;
    const s = e.findIndex((r) => r.id === t.currentTrack.id);
    if (t.shuffle) {
      if (e.length === 1) p.play(e[0]);
      else {
        let r = s;
        for (; r === s;) r = Math.floor(Math.random() * e.length);
        p.play(e[r]);
      }
      return;
    }
    let i = s - 1;
    i < 0 && (t.repeat === 'all' ? (i = e.length - 1) : (i = 0));
    p.play(e[i]);
  }
}
