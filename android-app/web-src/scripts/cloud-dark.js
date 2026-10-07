// Keep the playback controls while showing the actual upcoming order separately.
function cloudUpcomingQueue(queue, state) {
  const currentIndex = queue.findIndex(
    (track) => String(track.id) === String(state.currentTrack?.id),
  );
  const indices = queue.map((_, index) => index);
  const remaining = currentIndex < 0 ? indices : indices.filter((index) => index !== currentIndex);
  if (state.repeat === 'one') {
    return {
      indices: remaining,
      nextIndex: -1,
      hint: '한 곡 반복 중 · 다음 곡은 재생되지 않습니다.',
    };
  }
  if (state.shuffle) {
    return { indices: remaining, nextIndex: -1, hint: '셔플 중 · 다음 곡은 자동으로 선택됩니다.' };
  }
  if (currentIndex < 0 && state.currentTrack) {
    return { indices: remaining, nextIndex: -1, hint: '현재 곡이 대기열에 없습니다.' };
  }
  const after = currentIndex < 0 ? indices : indices.filter((index) => index > currentIndex);
  const wrapped =
    state.repeat === 'all' && currentIndex >= 0
      ? indices.filter((index) => index < currentIndex)
      : [];
  const upcoming = [...after, ...wrapped];
  return {
    indices: upcoming,
    nextIndex: upcoming[0] ?? -1,
    hint: upcoming.length
      ? wrapped.length
        ? '끝까지 재생한 뒤 처음으로 돌아갑니다.'
        : ''
      : '다음 재생할 곡이 없습니다.',
  };
}

function cloudEnhancePlayerRender() {
  const trigger = this.el.querySelector('#queue-toggle-btn');
  const opener = uiButton('', 'cloud-queue-open', () => trigger.click());
  opener.append(uiText('span', '', '재생 대기열'), uiText('span', 'cloud-queue-total', '0곡'));
  opener.setAttribute('aria-expanded', 'false');
  this.el.querySelector('.player-bar').append(opener);
  const current = uiText('div', 'cloud-current', '');
  this.el.querySelector('.queue-header').after(current);
  const hint = uiText('p', 'cloud-queue-hint', '');
  current.after(hint);
  this.el.querySelector('.queue-title-wrap > span').textContent = '다음 재생';
  trigger.addEventListener('click', () =>
    opener.setAttribute('aria-expanded', String(this.el.classList.contains('show-queue'))),
  );
  this.el.querySelector('#minimize-btn').addEventListener(
    'click',
    (event) => {
      if (this.el.classList.contains('show-queue')) {
        event.stopImmediatePropagation();
        trigger.click();
        opener.focus();
      }
    },
    true,
  );
}
function cloudEnhanceQueue() {
  const queue = p.getQueue();
  const state = p.getState();
  const upcoming = cloudUpcomingQueue(queue, state);
  const total = this.el.querySelector('.cloud-queue-total');
  if (total) total.textContent = `다음 ${upcoming.indices.length}곡`;
  if (!this.queueAlwaysVisible && !this.el.classList.contains('show-queue')) return;
  const count = this.el.querySelector('#queue-count');
  if (count) count.textContent = String(upcoming.indices.length);
  const hint = this.el.querySelector('.cloud-queue-hint');
  hint.textContent = upcoming.hint;
  hint.hidden = !upcoming.hint;
  const current = this.el.querySelector('.cloud-current');
  current.replaceChildren();
  current.hidden = !state.currentTrack;
  if (state.currentTrack) {
    current.append(uiCover(state.currentTrack, 'cloud-art'));
    const info = uiText('div', 'cloud-info', '');
    info.append(
      uiText('small', '', '지금 재생 중'),
      uiText('strong', '', state.currentTrack.title),
      uiText('span', 'cloud-artist', state.currentTrack.artist || '아티스트 미상'),
    );
    const play = uiButton(state.isPlaying ? 'Ⅱ' : '▶', '', () =>
      p.getState().isPlaying ? p.pause() : p.resume(),
    );
    play.setAttribute('aria-label', state.isPlaying ? '일시정지' : '재생');
    current.append(info, play);
  }
  const positions = new Map(upcoming.indices.map((index, position) => [index, position]));
  const currentIndex = queue.findIndex(
    (track) => String(track.id) === String(state.currentTrack?.id),
  );
  this.el.querySelectorAll('.queue-item[data-index]').forEach((row) => {
    const index = Number(row.dataset.index);
    row.classList.toggle('active', index === currentIndex);
    row.classList.toggle('cloud-next', index === upcoming.nextIndex);
    row.classList.toggle('cloud-queue-hidden', !positions.has(index));
    row.style.order = String(positions.get(index) ?? queue.length);
    const track = queue[index];
    if (!track || !positions.has(index)) return;
    if (index === upcoming.nextIndex) {
      row.querySelector('.queue-item-info')?.prepend(uiText('span', 'cloud-next-badge', '다음'));
    }
    row.querySelector('.queue-item-art').replaceWith(uiCover(track, 'queue-item-art'));
    const handle = row.querySelector('.queue-drag-handle');
    handle.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse') return;
      event.preventDefault();
      handle.setPointerCapture(event.pointerId);
      const from = Number(row.dataset.index);
      let to = from;
      const move = (e) => {
        const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('.queue-item');
        if (target) to = Number(target.dataset.index);
      };
      const end = () => {
        handle.removeEventListener('pointermove', move);
        if (from !== to) p.reorderQueue(from, to);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', end, { once: true });
    });
  });
}
function cloudEnhancePlayerState(state) {
  const repeat = this.el.querySelector('#player-repeat-btn'),
    shuffle = this.el.querySelector('#player-shuffle-btn');
  repeat.setAttribute('aria-pressed', String(state.repeat === 'all' || state.repeat === 'one'));
  repeat.title =
    state.repeat === 'all'
      ? '전체 반복 켜짐'
      : state.repeat === 'one'
        ? '한 곡 반복 켜짐'
        : '반복 꺼짐';
  shuffle.setAttribute('aria-pressed', String(!!state.shuffle));
  shuffle.title = state.shuffle ? '셔플 켜짐' : '셔플 꺼짐';
  const key = `${state.currentTrack?.id}:${state.isPlaying}:${state.repeat}:${state.shuffle}`;
  if (this.cloudStateKey !== key) {
    this.cloudStateKey = key;
    this.renderQueue();
  }
}
