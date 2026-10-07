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

async function showUploadDialog(library) {
  var T, E, C, q, y;
  const e = document.createElement('div');
  e.className = 'upload-modal-overlay';
  const t = document.createElement('div');
  t.className = 'upload-modal';
  t.innerHTML = `
      <div class="upload-modal-header">
        <h3>음악 업로드</h3>
        <button class="btn-icon" id="upload-modal-close" style="color: white;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      <div class="upload-modal-body">
        <!-- Category Selector -->
        <div class="upload-field">
          <label>대분류 (Category)</label>
          <div style="display: flex; gap: 8px;">
            <select id="upload-category-select" class="upload-select">
              <option value="">불러오는 중...</option>
            </select>
            <button class="btn" id="upload-new-category-btn" style="white-space: nowrap; padding: 6px 12px; font-size: 0.85rem;">+ 새로 만들기</button>
          </div>
        </div>

        <!-- Album Selector -->
        <div class="upload-field">
          <label>소분류 앨범 (Album)</label>
          <div style="display: flex; gap: 8px;">
            <select id="upload-album-select" class="upload-select">
              <option value="">먼저 대분류를 선택하세요</option>
            </select>
            <button class="btn" id="upload-new-album-btn" style="white-space: nowrap; padding: 6px 12px; font-size: 0.85rem;">+ 새로 만들기</button>
          </div>
        </div>

        <!-- File Drop Zone -->
        <div class="upload-field">
          <label>음악 파일 선택</label>
          <div class="upload-dropzone" id="upload-dropzone">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(139,92,246,0.6)" stroke-width="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <p>음악 파일을 여기에 드래그 앤 드롭하거나 <button type="button" style="color: #8b5cf6; cursor: pointer; text-decoration: underline; background: none; border: 0; padding: 0; font: inherit;" id="upload-browse">파일 찾기</button></p>
            <p style="font-size: 0.75rem; color: var(--text-secondary);">지원 형식: .wav, .mp3, .flac, .ogg, .m4a 등</p>
            <input type="file" id="upload-file-input" multiple accept="audio/*" style="display: none;" />
          </div>
          <div id="upload-file-list" class="upload-file-list"></div>
        </div>

        <!-- Progress -->
        <div id="upload-progress-area" style="display: none;">
          <div class="upload-progress-bar">
            <div class="upload-progress-fill" id="upload-progress-fill"></div>
          </div>
          <div id="upload-progress-text" style="text-align: center; font-size: 0.85rem; color: var(--text-secondary); margin-top: 8px;"></div>
        </div>
      </div>

      <div class="upload-modal-footer">
        <button class="btn" id="upload-cancel-btn" style="background: rgba(255,255,255,0.1);">취소</button>
        <button class="btn" id="upload-submit-btn" style="background: linear-gradient(135deg, #8b5cf6, #6d28d9);" disabled>업로드 시작</button>
      </div>
    `;
  e.appendChild(t);
  document.body.appendChild(e);
  let s = {},
    i = [];
  const r = t.querySelector('#upload-category-select'),
    a = t.querySelector('#upload-album-select'),
    n = t.querySelector('#upload-file-input'),
    o = t.querySelector('#upload-file-list'),
    l = t.querySelector('#upload-dropzone'),
    c = t.querySelector('#upload-submit-btn'),
    f = t.querySelector('#upload-progress-area'),
    d = t.querySelector('#upload-progress-fill'),
    g = t.querySelector('#upload-progress-text'),
    h = () => {
      e.classList.add('closing');
      setTimeout(() => e.remove(), 200);
    };
  (T = t.querySelector('#upload-modal-close')) == null || T.addEventListener('click', h);
  (E = t.querySelector('#upload-cancel-btn')) == null || E.addEventListener('click', h);
  e.addEventListener('click', (u) => {
    u.target === e && h();
  });
  try {
    s = await w.getFolders();
    const u = Object.keys(s).sort();
    r.innerHTML = '<option value="">-- 대분류 선택 --</option>';
    u.forEach((m) => {
      const b = document.createElement('option');
      ((b.value = m), (b.textContent = m), r.appendChild(b));
    });
  } catch {
    r.innerHTML = '<option value="">불러오기 실패</option>';
  }
  r.addEventListener('change', () => {
    const u = r.value;
    ((a.innerHTML = '<option value="">-- 소분류 앨범 선택 --</option>'),
      u &&
        s[u] &&
        s[u].forEach((m) => {
          const b = document.createElement('option');
          ((b.value = m), (b.textContent = m), a.appendChild(b));
        }),
      S());
  });
  a.addEventListener('change', () => S());
  (C = t.querySelector('#upload-new-category-btn')) == null ||
    C.addEventListener('click', async () => {
      const u = await uiAskFolderName('새 대분류 폴더');
      if (!(!u || u.trim() === ''))
        try {
          (await w.createFolder(u.trim()), (s[u.trim()] = []));
          const m = document.createElement('option');
          ((m.value = u.trim()),
            (m.textContent = u.trim()),
            r.appendChild(m),
            (r.value = u.trim()),
            r.dispatchEvent(new Event('change')));
        } catch (m) {
          P(m.message || '대분류 생성을 실패했습니다');
        }
    });
  (q = t.querySelector('#upload-new-album-btn')) == null ||
    q.addEventListener('click', async () => {
      const u = r.value;
      if (!u) {
        P('먼저 대분류를 선택하세요.');
        return;
      }
      const m = await uiAskFolderName('새 앨범 폴더');
      if (!(!m || m.trim() === ''))
        try {
          (await w.createFolder(u, m.trim()), s[u] || (s[u] = []), s[u].push(m.trim()));
          const b = document.createElement('option');
          ((b.value = m.trim()),
            (b.textContent = m.trim()),
            a.appendChild(b),
            (a.value = m.trim()),
            S());
        } catch (b) {
          P(b.message || '앨범 생성을 실패했습니다');
        }
    });
  (y = t.querySelector('#upload-browse')) == null || y.addEventListener('click', () => n.click());
  n.addEventListener('change', () => {
    n.files && ((i = [...i, ...Array.from(n.files)]), L(), S());
  });
  l.addEventListener('dragover', (u) => {
    (u.preventDefault(), l.classList.add('drag-active'));
  });
  l.addEventListener('dragleave', () => {
    l.classList.remove('drag-active');
  });
  l.addEventListener('drop', (u) => {
    var m;
    if (
      (u.preventDefault(),
      l.classList.remove('drag-active'),
      (m = u.dataTransfer) != null && m.files)
    ) {
      const b = Array.from(u.dataTransfer.files).filter(
        (M) => M.type.startsWith('audio/') || /\.(wav|mp3|flac|ogg|m4a|aac|wma)$/i.test(M.name),
      );
      ((i = [...i, ...b]), L(), S());
    }
  });
  const k = (u) =>
      u < 1024
        ? u + ' B'
        : u < 1024 * 1024
          ? (u / 1024).toFixed(1) + ' KB'
          : (u / (1024 * 1024)).toFixed(1) + ' MB',
    L = () => {
      o.innerHTML = '';
      i.forEach((u, m) => {
        const b = document.createElement('div');
        ((b.className = 'upload-file-item'),
          (b.innerHTML = `
          <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${uiEscapeHtml(u.name)}</span>
          <span style="color: var(--text-secondary); font-size: 0.8rem; margin-right: 8px;">${k(u.size)}</span>
          <button class="btn-icon upload-file-remove" data-index="${m}" style="color: #ff4b4b; padding: 2px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        `),
          o.appendChild(b));
      });
      o.querySelectorAll('.upload-file-remove').forEach((u) => {
        u.addEventListener('click', () => {
          const m = parseInt(u.getAttribute('data-index') || '0');
          (i.splice(m, 1), L(), S());
        });
      });
    },
    S = () => {
      c.disabled = !(r.value && a.value && i.length > 0);
    };
  c.addEventListener('click', async () => {
    const u = r.value,
      m = a.value;
    if (!u || !m || i.length === 0) return;
    ((c.disabled = !0), (f.style.display = 'block'));
    let b = 0;
    const M = i.length;
    let sk = 0;
    for (let idx = 0; idx < M; idx++) {
      const I = i[idx],
        t0 = Date.now();
      g.textContent = `업로드 중 (${idx + 1}/${M}): ${I.name}`;
      try {
        const res = await w.uploadTrack(I, u, m, (l, tot) => {
          const fp = Math.round((l / tot) * 100),
            op = Math.round(((idx + l / tot) / M) * 100);
          d.style.width = `${op}%`;
          const lm = (l / 1048576).toFixed(1),
            tm = (tot / 1048576).toFixed(1),
            el = (Date.now() - t0) / 1e3,
            spd = el > 0.3 ? ` (${(l / 1048576 / el).toFixed(1)} MB/s)` : '';
          g.textContent = `[${idx + 1}/${M}] ${I.name} (${fp}%) — ${lm}/${tm} MB${spd}`;
        });
        res && res.skipped > 0 ? (sk++, (g.textContent = `[건너뜀 (이미 존재)] ${I.name}`)) : b++;
        d.style.width = `${Math.round(((idx + 1) / M) * 100)}%`;
      } catch (D) {
        g.textContent = `실패: ${I.name} — ${D.message}`;
      }
    }
    ((g.textContent = `업로드 완료! 총 ${b}개 업로드, ${sk}개 건너뜀 (전체 ${M}개)`),
      (d.style.width = '100%'),
      setTimeout(async () => {
        (h(), await library.loadTracks());
      }, 1500));
  });
  requestAnimationFrame(() => e.classList.add('open'));
}
