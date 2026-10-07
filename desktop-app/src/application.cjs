const path = require('node:path');
const { SERVICE_URL, isServiceUrl, canGrantPermission, windowBounds } = require('./policy.cjs');
const { readState, writeState } = require('./state.cjs');

function createApplication(electron, stateFile) {
  const { app, BrowserWindow, Menu, Tray, nativeImage, screen, shell, dialog, powerSaveBlocker } = electron;
  const state = readState(stateFile);
  const recoveryFile = path.join(__dirname, 'recovery.html');
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets/icon.png'));
  let window, tray, quitting = false, recovering = false, blocker = null, balloonShown = false;
  const stopBlocker = () => {
    if (blocker !== null) { powerSaveBlocker.stop(blocker); blocker = null; }
  };
  const save = () => {
    if (!window || window.isDestroyed()) return;
    Object.assign(state, window.getNormalBounds(), { maximized: window.isMaximized() });
    writeState(stateFile, state);
  };
  const show = () => {
    if (!window || window.isDestroyed()) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  };
  const recover = () => {
    stopBlocker();
    if (quitting || recovering || !window || window.isDestroyed()) return;
    recovering = true;
    window.loadFile(recoveryFile).catch(() => show());
  };
  const reload = () => {
    recovering = false;
    window.loadURL(SERVICE_URL).catch(recover);
  };
  const quit = () => { quitting = true; app.quit(); };

  function start() {
    const displays = [screen.getPrimaryDisplay(), ...screen.getAllDisplays().filter(item => item.id !== screen.getPrimaryDisplay().id)];
    const bounds = windowBounds(state, displays);
    window = new BrowserWindow({
      ...bounds, minWidth: Math.min(600, bounds.width), minHeight: Math.min(480, bounds.height),
      title: 'WavCloud', icon, backgroundColor: '#090c12', show: false,
      webPreferences: { partition: 'persist:wavcloud', nodeIntegration: false, nodeIntegrationInWorker: false,
        contextIsolation: true, sandbox: true, webSecurity: true, webviewTag: false, backgroundThrottling: false }
    });
    if (state.maximized === true) window.maximize();
    window.once('ready-to-show', show);
    window.on('close', event => {
      save();
      if (quitting || state.closeToTray === false || !tray) return;
      event.preventDefault();
      window.hide();
      if (!balloonShown && process.platform === 'win32') {
        balloonShown = true;
        tray.displayBalloon({ title: 'WavCloud', content: '트레이에서 계속 실행 중입니다. 완전히 종료하려면 트레이 메뉴에서 종료를 선택하세요.', iconType: 'info' });
      }
    });
    window.on('closed', () => { window = null; stopBlocker(); app.quit(); });
    window.webContents.on('will-navigate', (event, url) => { if (!isServiceUrl(url)) event.preventDefault(); });
    window.webContents.on('will-redirect', (event, url) => { if (!isServiceUrl(url)) event.preventDefault(); });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-attach-webview', event => event.preventDefault());
    window.webContents.on('page-title-updated', event => { event.preventDefault(); window.setTitle('WavCloud'); });
    window.webContents.on('did-start-navigation', (_event, url, _inPlace, mainFrame) => { if (mainFrame && isServiceUrl(url)) recovering = false; });
    window.webContents.on('did-fail-load', (_event, code, _description, url, mainFrame) => {
      if (mainFrame && code !== -3 && isServiceUrl(url)) recover();
    });
    window.webContents.on('render-process-gone', recover);
    window.webContents.on('media-started-playing', () => {
      if (blocker === null) blocker = powerSaveBlocker.start('prevent-app-suspension');
      tray?.setToolTip('WavCloud — 음악 재생 중');
    });
    window.webContents.on('media-paused', () => { stopBlocker(); tray?.setToolTip('WavCloud'); });
    const session = window.webContents.session;
    session.setPermissionRequestHandler((_contents, permission, callback, details) => callback(canGrantPermission(permission, details?.requestingUrl)));
    session.setPermissionCheckHandler((_contents, permission, origin) => canGrantPermission(permission, origin));
    session.on('will-download', (_event, item) => {
      item.setSaveDialogOptions({ title: 'WavCloud 파일 저장' });
      item.once('done', (_doneEvent, result) => {
        if (result === 'interrupted' && window && !window.isDestroyed()) dialog.showMessageBox(window, { type: 'error', title: 'WavCloud', message: '파일을 저장하지 못했습니다.', detail: '연결과 저장 공간을 확인한 뒤 다시 시도하세요.' }).catch(() => {});
      });
    });
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: '앱', submenu: [
        { label: '창을 닫으면 트레이로 이동', type: 'checkbox', checked: state.closeToTray !== false, click: item => { state.closeToTray = item.checked; save(); } },
        { type: 'separator' }, { label: '종료', accelerator: 'Alt+F4', click: quit }
      ] },
      { label: '편집', submenu: [{ role: 'undo', label: '실행 취소' }, { role: 'redo', label: '다시 실행' }, { type: 'separator' }, { role: 'cut', label: '잘라내기' }, { role: 'copy', label: '복사' }, { role: 'paste', label: '붙여넣기' }, { role: 'selectAll', label: '전체 선택' }] },
      { label: '보기', submenu: [
        { label: '최신 화면 다시 열기', accelerator: 'CmdOrCtrl+R', click: reload },
        { role: 'resetZoom', label: '기본 크기' }, { role: 'zoomIn', label: '확대' }, { role: 'zoomOut', label: '축소' },
        { role: 'togglefullscreen', label: '전체 화면' }
      ] },
      { label: '도움말', submenu: [
        { label: '웹사이트 열기', click: () => shell.openExternal(SERVICE_URL).catch(() => {}) },
        { label: 'WavCloud 정보', click: () => dialog.showMessageBox(window, { title: 'WavCloud', message: `WavCloud PC ${app.getVersion()}`, detail: 'Windows 음악 플레이어\nCtrl+K 검색 · Space 재생 · ←/→ 5초 이동\nN/P 다음·이전 곡 · M 음소거\n\n창을 닫아도 트레이에서 재생을 계속합니다.\n앱 종료는 메뉴의 종료를 사용하세요.' }).catch(() => {}) }
      ] }
    ]));
    try {
      tray = new Tray(icon.resize({ width: 32, height: 32 }));
      tray.setToolTip('WavCloud');
      tray.setContextMenu(Menu.buildFromTemplate([{ label: 'WavCloud 열기', click: show }, { type: 'separator' }, { label: '종료', click: quit }]));
      tray.on('click', show);
      tray.on('double-click', show);
    } catch { tray = null; }
    app.on('second-instance', show);
    app.on('activate', show);
    app.on('before-quit', () => { quitting = true; save(); stopBlocker(); });
    app.on('will-quit', () => { tray?.destroy(); });
    reload();
    return window;
  }
  return { start };
}
module.exports = { createApplication };
