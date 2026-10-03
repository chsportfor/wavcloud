// Library actions use app sheets and a persistent, non-blocking scan card.
function uiPlaylistSheet(title) {
  const dialog = uiDialog(title);
  dialog.classList.add('ui-library-sheet');
  dialog.setAttribute('aria-label', title);
  return dialog;
}

function uiCreatePlaylist(library, trackId) {
  const dialog = uiPlaylistSheet('새 재생목록');
  const form = uiText('form', 'ui-playlist-form');
  const label = uiText('label', 'ui-field-label', '재생목록 이름');
  const input = uiText('input', 'ui-name-input');
  input.type = 'text';
  input.maxLength = 80;
  input.placeholder = '예: 자주 듣는 음악';
  input.setAttribute('aria-label', '재생목록 이름');
  input.autocomplete = 'off';
  label.append(input);
  const error = uiText('p', 'ui-form-error');
  error.setAttribute('role', 'alert');
  const actions = uiText('div', 'ui-sheet-actions');
  const cancel = uiButton('취소', 'ui-action-secondary', () => dialog.close());
  cancel.type = 'button';
  const create = uiButton(trackId ? '만들고 곡 추가' : '만들기', 'ui-action-primary');
  create.type = 'submit';
  actions.append(cancel, create);
  form.append(label, error, actions);
  dialog.append(form);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const name = input.value.trim();
    if (!name) { error.textContent = '이름을 입력해 주세요.'; input.focus(); return; }
    if (library.playlists.some(playlist => playlist.name.trim() === name)) {
      error.textContent = '이미 사용 중인 이름입니다. 다른 이름을 입력해 주세요.';
      input.focus();
      return;
    }
    const playlist = { name, trackIds: trackId ? [trackId] : [] };
    library.playlists.push(playlist);
    try { library.savePlaylists(); }
    catch { library.playlists.pop(); error.textContent = '재생목록을 저장하지 못했습니다. 다시 시도해 주세요.'; return; }
    dialog.close();
    library.render();
    P(trackId ? `“${name}”에 곡을 추가했습니다.` : `“${name}” 재생목록을 만들었습니다.`);
  });
  input.addEventListener('input', () => { error.textContent = ''; });
  dialog.showModal();
  input.focus();
}

function uiAddToPlaylist(library, trackId) {
  const dialog = uiPlaylistSheet('재생목록에 추가');
  const track = library.tracks.find(item => item.id === trackId);
  dialog.append(uiText('p', 'ui-sheet-description', track?.title || '추가할 재생목록을 선택하세요.'));
  const list = uiText('div', 'ui-playlist-options');
  if (!library.playlists.length) list.append(uiText('p', 'ui-sheet-description', '첫 재생목록을 만들어 이 곡을 저장해 보세요.'));
  for (const playlist of library.playlists) {
    const added = playlist.trackIds.includes(trackId);
    const button = uiButton('', 'ui-playlist-option', () => {
      if (playlist.trackIds.includes(trackId)) return;
      playlist.trackIds.push(trackId);
      try { library.savePlaylists(); }
      catch { playlist.trackIds.pop(); P('재생목록을 저장하지 못했습니다.'); return; }
      dialog.close();
      library.render();
      P(`“${playlist.name}”에 곡을 추가했습니다.`);
    });
    button.type = 'button';
    button.disabled = added;
    button.append(uiText('span', 'ui-playlist-name', playlist.name), uiText('span', 'ui-playlist-meta', added ? '추가됨' : `${playlist.trackIds.length}곡`));
    list.append(button);
  }
  const create = uiButton('+ 새 재생목록 만들기', 'ui-action-secondary ui-new-playlist', () => {
    dialog.close();
    uiCreatePlaylist(library, trackId);
  });
  dialog.append(list, create);
  dialog.showModal();
}

function uiDeletePlaylist(library, playlist) {
  const dialog = uiPlaylistSheet('재생목록 삭제');
  dialog.append(uiText('p', 'ui-sheet-description', `“${playlist.name}” 재생목록을 삭제할까요?`));
  const actions = uiText('div', 'ui-sheet-actions');
  actions.append(uiButton('취소', 'ui-action-secondary', () => dialog.close()), uiButton('삭제', 'ui-action-danger', () => {
    const previous = library.playlists;
    library.playlists = previous.filter(item => item !== playlist);
    try { library.savePlaylists(); }
    catch { library.playlists = previous; P('재생목록을 삭제하지 못했습니다.'); return; }
    dialog.close();
    library.render();
    P('재생목록을 삭제했습니다.');
  }));
  dialog.append(actions);
  dialog.showModal();
}

async function uiScanRequest(path, method = 'GET') {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await w.fetchWithAuth(path, { method, signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error('스캔 상태를 확인하지 못했습니다.');
    return await response.json();
  } finally { clearTimeout(timeout); }
}

function uiScanCard(library) {
  if (library.scanCard?.el.isConnected) return library.scanCard;
  const el = uiText('section', 'ui-scan-card');
  el.setAttribute('aria-label', '라이브러리 스캔 진행 상태');
  const heading = uiText('div', 'ui-scan-heading');
  const title = uiText('strong', '', '라이브러리 스캔');
  const action = uiButton('닫기', 'ui-scan-action');
  action.hidden = true;
  heading.append(title, action);
  const summary = uiText('p', 'ui-scan-summary');
  summary.setAttribute('role', 'status');
  const progress = uiText('progress', 'ui-scan-progress');
  progress.max = 100;
  progress.setAttribute('aria-label', '곡 처리 진행률');
  const detail = uiText('p', 'ui-scan-detail');
  el.append(heading, summary, progress, detail);
  library.el.querySelector('.library-fixed-header').append(el);
  library.scanCard = { el, title, action, summary, progress, detail };
  return library.scanCard;
}

function uiRenderScan(library, job) {
  const card = uiScanCard(library);
  const running = job.status === 'running';
  const completed = job.status === 'completed';
  const knownTotal = typeof job.total === 'number';
  card.el.dataset.status = job.status;
  card.title.textContent = completed ? '라이브러리 스캔 완료' : job.status === 'failed' ? '스캔 상태 확인 필요' : '라이브러리 스캔 중';
  card.action.hidden = running;
  card.action.textContent = completed ? '닫기' : '다시 확인';
  card.action.onclick = completed ? () => card.el.remove() : () => uiStartLibraryScan(library);
  if (knownTotal) {
    const percent = job.total ? Math.floor(job.processed / job.total * 100) : completed ? 100 : 0;
    card.progress.value = completed ? 100 : Math.min(100, percent);
    card.summary.textContent = completed ? `${job.found}곡 확인 완료${job.failed ? ` · 읽기 실패 ${job.failed}곡` : ''}` : `${job.processed} / ${job.total}곡 · ${percent}%`;
  } else {
    card.progress.removeAttribute('value');
    card.summary.textContent = job.discovered ? `음악 파일 찾는 중 · ${job.discovered}곡 발견` : '음악 폴더를 확인하고 있습니다.';
  }
  card.detail.textContent = job.message || (completed ? '최신 곡 목록을 반영했습니다.' : job.phase === 'converting' ? `FLAC 변환 중 · ${job.currentFile}` : job.currentFile || '파일을 찾은 뒤 곡 정보를 읽습니다.');
  if (job.status === 'failed') card.summary.textContent = '서버에서 진행 상황을 다시 확인할 수 있습니다.';
  const button = library.el.querySelector('#scan-menu-btn');
  button.disabled = running;
  button.textContent = running ? '스캔 중…' : '라이브러리 스캔';
}

async function uiWatchLibraryScan(library, job) {
  library.scanJob = job;
  let failures = 0;
  while (job.status === 'running') {
    library.scanJob = job;
    uiRenderScan(library, job);
    await new Promise(resolve => setTimeout(resolve, 1000));
    try {
      const latest = await uiScanRequest('/api/tracks/scan/status');
      if (latest.status === 'idle' || latest.id !== job.id) throw new Error('스캔 작업이 바뀌었습니다. 다시 확인해 주세요.');
      job = latest;
      failures = 0;
    } catch (error) {
      if (++failures >= 3) throw error;
      uiScanCard(library).detail.textContent = '연결을 다시 확인하고 있습니다…';
    }
  }
  if (job.status === 'failed') throw new Error(job.error || '라이브러리 스캔에 실패했습니다.');
  const tracks = (await w.getTracks()).sort(_trackSorter);
  library.tracks = tracks;
  library.libraryLoaded = true;
  try { localStorage.setItem('cm_tracks', JSON.stringify(tracks)); } catch { /* The refreshed list remains usable. */ }
  library.extractFolders();
  library.render();
  library.scanJob = job;
  uiRenderScan(library, job);
  P(`라이브러리 스캔 완료 · ${job.found}곡`);
}

function uiRunLibraryScan(library, getJob) {
  if (library.scanPromise) return library.scanPromise;
  uiRenderScan(library, { status: 'running', phase: 'discovering' });
  library.scanPromise = (async () => {
    try { await uiWatchLibraryScan(library, await getJob()); }
    catch (error) { uiRenderScan(library, { status: 'failed', message: error.name === 'AbortError' ? '서버 연결이 지연되고 있습니다. 다시 확인해 주세요.' : error.message }); }
    finally { library.scanPromise = null; }
  })();
  return library.scanPromise;
}

function uiStartLibraryScan(library) {
  const reconnect = library.scanCard?.el.dataset.status === 'failed';
  return uiRunLibraryScan(library, async () => {
    const current = await uiScanRequest('/api/tracks/scan/status');
    if (current.status === 'running' || reconnect && current.status === 'completed' && library.scanJob?.id === current.id) return current;
    return uiScanRequest('/api/tracks/scan/start', 'POST');
  });
}

async function uiResumeLibraryScan(library) {
  if (library.scanChecked || library.scanPromise) return;
  library.scanChecked = true;
  try {
    const job = await uiScanRequest('/api/tracks/scan/status');
    if (job.status === 'running' && !library.scanPromise) uiRunLibraryScan(library, () => Promise.resolve(job));
  } catch { library.scanChecked = false; }
}
