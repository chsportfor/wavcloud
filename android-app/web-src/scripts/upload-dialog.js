function uiAskFolderName(title) {
  const dialog = uiDialog(title);
  const input = document.createElement('input');
  input.type = 'text'; input.maxLength = 200;
  input.placeholder = '폴더 이름'; input.setAttribute('aria-label', '폴더 이름');
  const submit = uiButton('만들기', 'ui-action-primary', () => {
    if (!input.value.trim()) return;
    name = input.value.trim(); dialog.close();
  });
  let name = null;
  submit.disabled = true;
  input.addEventListener('input', () => { submit.disabled = !input.value.trim(); });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); submit.click(); }
  });
  dialog.append(input, submit);
  return new Promise(resolve => {
    dialog.addEventListener('close', () => resolve(name), { once: true });
    dialog.showModal(); input.focus();
  });
}

const UPLOAD_SUPPORTED_EXT_RE = /\.(wav|mp3|flac|ogg|m4a)$/i;
const UPLOAD_LAST_CATEGORY_KEY = 'cm_upload_last_category';
const UPLOAD_LAST_ALBUM_KEY = 'cm_upload_last_album';

function formatUploadBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function showUploadDialog(library) {
  const overlay = document.createElement('div');
  overlay.className = 'upload-modal-overlay';
  const modal = document.createElement('div');
  modal.className = 'upload-modal';
  modal.innerHTML = `
      <div class="upload-modal-header">
        <h3>음악 업로드</h3>
        <button class="btn-icon" id="upload-modal-close" style="color: white;" aria-label="닫기">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      <div class="upload-modal-body">
        <div class="upload-field">
          <label for="upload-category-select">대분류 (Category)</label>
          <div style="display: flex; gap: 8px;">
            <select id="upload-category-select" class="upload-select">
              <option value="">불러오는 중...</option>
            </select>
            <button type="button" class="btn" id="upload-new-category-btn" style="white-space: nowrap; padding: 6px 12px; font-size: 0.85rem;">+ 새로 만들기</button>
          </div>
        </div>

        <div class="upload-field">
          <label for="upload-album-select">소분류 앨범 (Album)</label>
          <div style="display: flex; gap: 8px;">
            <select id="upload-album-select" class="upload-select">
              <option value="">먼저 대분류를 선택하세요</option>
            </select>
            <button type="button" class="btn" id="upload-new-album-btn" style="white-space: nowrap; padding: 6px 12px; font-size: 0.85rem;">+ 새로 만들기</button>
          </div>
        </div>

        <div class="upload-field">
          <label>음악 파일 선택</label>
          <div class="upload-dropzone" id="upload-dropzone">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(139,92,246,0.6)" stroke-width="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <p>음악 파일을 여기에 드래그하거나 <button type="button" style="color: #8b5cf6; cursor: pointer; text-decoration: underline; background: none; border: 0; padding: 0; font: inherit;" id="upload-browse">파일 찾기</button></p>
            <p style="font-size: 0.75rem; color: var(--text-secondary);">지원 형식: .wav, .mp3, .flac, .ogg, .m4a (WAV는 자동 FLAC 변환)</p>
            <input type="file" id="upload-file-input" multiple accept=".wav,.mp3,.flac,.ogg,.m4a,audio/*" style="display: none;" />
          </div>
          <div id="upload-warning" class="upload-warning" style="display: none;"></div>
          <div id="upload-file-summary" class="upload-file-summary" style="display: none;">
            <span id="upload-file-summary-text"></span>
            <button type="button" id="upload-clear-btn" class="upload-clear-btn">전체 비우기</button>
          </div>
          <div id="upload-file-list" class="upload-file-list"></div>
        </div>

        <div id="upload-progress-area" style="display: none;">
          <div class="upload-progress-bar">
            <div class="upload-progress-fill" id="upload-progress-fill"></div>
          </div>
          <div id="upload-progress-text" style="text-align: center; font-size: 0.85rem; color: var(--text-secondary); margin-top: 8px;"></div>
        </div>
      </div>

      <div class="upload-modal-footer">
        <button type="button" class="btn" id="upload-cancel-btn" style="background: rgba(255,255,255,0.1);">취소</button>
        <button type="button" class="btn" id="upload-submit-btn" style="background: linear-gradient(135deg, #8b5cf6, #6d28d9);" disabled>업로드 시작</button>
      </div>
    `;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  let folders = {};
  let entries = [];
  let isUploading = false;
  let activeAbort = null;

  const categorySelect = modal.querySelector('#upload-category-select');
  const albumSelect = modal.querySelector('#upload-album-select');
  const newCategoryBtn = modal.querySelector('#upload-new-category-btn');
  const newAlbumBtn = modal.querySelector('#upload-new-album-btn');
  const fileInput = modal.querySelector('#upload-file-input');
  const fileListEl = modal.querySelector('#upload-file-list');
  const fileSummaryEl = modal.querySelector('#upload-file-summary');
  const fileSummaryText = modal.querySelector('#upload-file-summary-text');
  const clearBtn = modal.querySelector('#upload-clear-btn');
  const warningEl = modal.querySelector('#upload-warning');
  const dropzone = modal.querySelector('#upload-dropzone');
  const closeBtn = modal.querySelector('#upload-modal-close');
  const cancelBtn = modal.querySelector('#upload-cancel-btn');
  const submitBtn = modal.querySelector('#upload-submit-btn');
  const progressArea = modal.querySelector('#upload-progress-area');
  const progressFill = modal.querySelector('#upload-progress-fill');
  const progressText = modal.querySelector('#upload-progress-text');

  const closeDialog = () => {
    if (isUploading && activeAbort) {
      activeAbort.abort();
      return;
    }
    overlay.classList.add('closing');
    setTimeout(() => overlay.remove(), 200);
  };

  closeBtn?.addEventListener('click', closeDialog);
  cancelBtn?.addEventListener('click', closeDialog);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay && !isUploading) closeDialog();
  });

  const showWarning = (message) => {
    if (!message) {
      warningEl.style.display = 'none';
      warningEl.textContent = '';
      return;
    }
    warningEl.textContent = message;
    warningEl.style.display = 'block';
  };

  const renderAlbumOptions = (selectedAlbum = '') => {
    const category = categorySelect.value;
    albumSelect.innerHTML = '<option value="">-- 소분류 앨범 선택 --</option>';
    const albums = category && folders[category] ? folders[category] : [];
    albums.forEach((album) => {
      const option = document.createElement('option');
      option.value = album;
      option.textContent = album;
      albumSelect.appendChild(option);
    });
    if (selectedAlbum && albums.includes(selectedAlbum)) {
      albumSelect.value = selectedAlbum;
    }
  };

  const updateControls = () => {
    const hasPendingOrError = entries.some((item) => item.status === 'pending' || item.status === 'error');
    const errorCount = entries.filter((item) => item.status === 'error').length;
    categorySelect.disabled = isUploading;
    albumSelect.disabled = isUploading;
    newCategoryBtn.disabled = isUploading;
    newAlbumBtn.disabled = isUploading;
    clearBtn.disabled = isUploading;
    cancelBtn.textContent = isUploading ? '업로드 중단' : '닫기';
    if (isUploading) {
      submitBtn.disabled = true;
      submitBtn.textContent = '업로드 중...';
    } else {
      submitBtn.disabled = !(categorySelect.value && albumSelect.value && hasPendingOrError);
      submitBtn.textContent = errorCount > 0 ? `실패한 파일 재시도 (${errorCount})` : '업로드 시작';
    }
  };

  const statusLabels = {
    pending: '대기',
    uploading: '업로드 중',
    done: '완료',
    skipped: '이미 있음',
    error: '실패',
  };

  const renderFileList = () => {
    fileListEl.innerHTML = '';
    if (entries.length === 0) {
      fileSummaryEl.style.display = 'none';
      updateControls();
      return;
    }
    const totalBytes = entries.reduce((sum, item) => sum + item.file.size, 0);
    fileSummaryText.textContent = `선택된 파일 ${entries.length}개 (총 ${formatUploadBytes(totalBytes)})`;
    fileSummaryEl.style.display = 'flex';

    entries.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = `upload-file-item is-${item.status}`;

      const nameSpan = document.createElement('span');
      nameSpan.style.cssText = 'flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
      nameSpan.textContent = item.file.name;

      const sizeSpan = document.createElement('span');
      sizeSpan.style.cssText = 'color: var(--text-secondary); font-size: 0.8rem; margin-right: 4px;';
      sizeSpan.textContent = formatUploadBytes(item.file.size);

      const badge = document.createElement('span');
      badge.className = 'upload-file-status';
      badge.textContent = statusLabels[item.status] || '대기';

      row.append(nameSpan, sizeSpan, badge);

      if (!isUploading && item.status !== 'done') {
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn-icon upload-file-remove';
        removeBtn.style.cssText = 'color: #ff4b4b; padding: 2px;';
        removeBtn.setAttribute('aria-label', `${item.file.name} 제거`);
        removeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        removeBtn.addEventListener('click', () => {
          entries.splice(index, 1);
          renderFileList();
        });
        row.appendChild(removeBtn);
      }

      if (item.status === 'error' && item.error) {
        const errEl = document.createElement('div');
        errEl.className = 'upload-file-error-msg';
        errEl.textContent = item.error;
        row.appendChild(errEl);
      }

      fileListEl.appendChild(row);
    });
    updateControls();
  };

  const addFiles = (rawFiles) => {
    if (isUploading) return;
    const incoming = Array.from(rawFiles || []);
    if (incoming.length === 0) return;

    const existingKeys = new Set(entries.map((item) => `${item.file.name}::${item.file.size}::${item.file.lastModified}`));
    let unsupportedCount = 0;
    let duplicateCount = 0;

    for (const file of incoming) {
      if (!UPLOAD_SUPPORTED_EXT_RE.test(file.name)) {
        unsupportedCount++;
        continue;
      }
      const key = `${file.name}::${file.size}::${file.lastModified}`;
      if (existingKeys.has(key)) {
        duplicateCount++;
        continue;
      }
      existingKeys.add(key);
      entries.push({ file, status: 'pending', error: '' });
    }

    const notices = [];
    if (unsupportedCount > 0) notices.push(`지원하지 않는 형식 ${unsupportedCount}개 제외됨 (.wav, .mp3, .flac, .ogg, .m4a만 지원)`);
    if (duplicateCount > 0) notices.push(`중복 선택된 파일 ${duplicateCount}개 제외됨`);
    showWarning(notices.join(' · '));
    renderFileList();
  };

  try {
    folders = await w.getFolders();
    const categories = Object.keys(folders).sort();
    categorySelect.innerHTML = '<option value="">-- 대분류 선택 --</option>';
    categories.forEach((cat) => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      categorySelect.appendChild(option);
    });
    const savedCategory = localStorage.getItem(UPLOAD_LAST_CATEGORY_KEY) || '';
    const savedAlbum = localStorage.getItem(UPLOAD_LAST_ALBUM_KEY) || '';
    if (savedCategory && categories.includes(savedCategory)) {
      categorySelect.value = savedCategory;
      renderAlbumOptions(savedAlbum);
    }
  } catch {
    categorySelect.innerHTML = '<option value="">불러오기 실패</option>';
  }
  updateControls();

  categorySelect.addEventListener('change', () => {
    localStorage.setItem(UPLOAD_LAST_CATEGORY_KEY, categorySelect.value);
    renderAlbumOptions();
    updateControls();
  });
  albumSelect.addEventListener('change', () => {
    localStorage.setItem(UPLOAD_LAST_ALBUM_KEY, albumSelect.value);
    updateControls();
  });

  newCategoryBtn?.addEventListener('click', async () => {
    const name = await uiAskFolderName('새 대분류 폴더');
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    try {
      await w.createFolder(trimmed);
      folders[trimmed] = [];
      const option = document.createElement('option');
      option.value = trimmed;
      option.textContent = trimmed;
      categorySelect.appendChild(option);
      categorySelect.value = trimmed;
      localStorage.setItem(UPLOAD_LAST_CATEGORY_KEY, trimmed);
      renderAlbumOptions();
      updateControls();
    } catch (error) {
      P(error.message || '대분류 생성을 실패했습니다');
    }
  });

  newAlbumBtn?.addEventListener('click', async () => {
    const category = categorySelect.value;
    if (!category) {
      P('먼저 대분류를 선택하세요.');
      return;
    }
    const name = await uiAskFolderName('새 앨범 폴더');
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    try {
      await w.createFolder(category, trimmed);
      folders[category] = folders[category] || [];
      folders[category].push(trimmed);
      const option = document.createElement('option');
      option.value = trimmed;
      option.textContent = trimmed;
      albumSelect.appendChild(option);
      albumSelect.value = trimmed;
      localStorage.setItem(UPLOAD_LAST_ALBUM_KEY, trimmed);
      updateControls();
    } catch (error) {
      P(error.message || '앨범 생성을 실패했습니다');
    }
  });

  dropzone.addEventListener('click', () => {
    if (!isUploading) fileInput.click();
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files) addFiles(fileInput.files);
    fileInput.value = '';
  });
  dropzone.addEventListener('dragover', (event) => {
    event.preventDefault();
    if (!isUploading) dropzone.classList.add('drag-active');
  });
  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('drag-active');
  });
  dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropzone.classList.remove('drag-active');
    if (event.dataTransfer?.files) addFiles(event.dataTransfer.files);
  });
  clearBtn.addEventListener('click', () => {
    if (isUploading) return;
    entries = [];
    showWarning('');
    renderFileList();
  });

  submitBtn.addEventListener('click', async () => {
    const category = categorySelect.value;
    const album = albumSelect.value;
    const targets = entries.filter((item) => item.status === 'pending' || item.status === 'error');
    if (!category || !album || targets.length === 0 || isUploading) return;

    localStorage.setItem(UPLOAD_LAST_CATEGORY_KEY, category);
    localStorage.setItem(UPLOAD_LAST_ALBUM_KEY, album);
    showWarning('');
    isUploading = true;
    activeAbort = new AbortController();
    progressArea.style.display = 'block';
    progressFill.style.width = '0%';
    updateControls();

    let uploadedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    let wasAborted = false;
    const total = targets.length;

    for (let idx = 0; idx < total; idx++) {
      if (activeAbort.signal.aborted) {
        wasAborted = true;
        break;
      }
      const item = targets[idx];
      const startedAt = Date.now();
      item.status = 'uploading';
      item.error = '';
      renderFileList();
      progressText.textContent = `업로드 중 (${idx + 1}/${total}): ${item.file.name}`;

      try {
        const res = await w.uploadTrack(
          item.file,
          category,
          album,
          (loaded, totalBytes) => {
            const filePct = Math.round((loaded / totalBytes) * 100);
            const overallPct = Math.round(((idx + loaded / totalBytes) / total) * 100);
            progressFill.style.width = `${overallPct}%`;
            const loadedMb = (loaded / 1048576).toFixed(1);
            const totalMb = (totalBytes / 1048576).toFixed(1);
            const elapsed = (Date.now() - startedAt) / 1000;
            const speed = elapsed > 0.3 ? ` (${(loaded / 1048576 / elapsed).toFixed(1)} MB/s)` : '';
            progressText.textContent = `[${idx + 1}/${total}] ${item.file.name} (${filePct}%) — ${loadedMb}/${totalMb} MB${speed}`;
          },
          activeAbort.signal,
        );
        if (res && res.skipped > 0) {
          item.status = 'skipped';
          skippedCount++;
        } else {
          item.status = 'done';
          uploadedCount++;
        }
      } catch (error) {
        if (error && (error.aborted || activeAbort.signal.aborted)) {
          item.status = 'pending';
          wasAborted = true;
          break;
        }
        if (error && error.status === 409) {
          item.status = 'skipped';
          skippedCount++;
        } else {
          item.status = 'error';
          item.error = error?.message || '업로드 실패';
          failedCount++;
        }
      }
      progressFill.style.width = `${Math.round(((idx + 1) / total) * 100)}%`;
    }

    isUploading = false;
    activeAbort = null;
    renderFileList();

    if (uploadedCount > 0) {
      void library.loadTracks();
    }

    if (wasAborted) {
      progressText.textContent = `업로드가 중단되었습니다. (완료 ${uploadedCount}개, 건너뜀 ${skippedCount}개)`;
      return;
    }

    if (failedCount > 0) {
      progressText.textContent = `완료 ${uploadedCount}개 · 건너뜀 ${skippedCount}개 · 실패 ${failedCount}개 — 실패한 항목을 확인 후 재시도하세요.`;
      return;
    }

    progressFill.style.width = '100%';
    progressText.textContent = `업로드 완료! ${uploadedCount}개 업로드, ${skippedCount}개 건너뜀`;
    setTimeout(() => {
      if (document.body.contains(overlay)) closeDialog();
    }, 1200);
  });

  requestAnimationFrame(() => overlay.classList.add('open'));
}
