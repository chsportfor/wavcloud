class LoginView {
  constructor(e, t) {
    defineField(this, 'el');
    this.onLoginSuccess = t;
    this.el = document.createElement('div');
    this.el.className = 'view login-view glass';
    e.appendChild(this.el);
    this.render();
  }
  show() {
    this.el.classList.add('active');
  }
  hide() {
    this.el.classList.remove('active');
  }
  render() {
    this.el.innerHTML = `
      <div class="login-card glass">
        <h1 class="text-gradient">CloudMusic</h1>
        <p style="color: var(--text-secondary); margin-bottom: 24px;">프리미엄 무손실 스트리밍</p>
        <div class="login-error" id="login-error"></div>
        <input type="text" id="username" placeholder="사용자 아이디" />
        <input type="password" id="password" placeholder="비밀번호" />
        <button class="btn" id="login-btn">
          <span>로그인</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
      </div>
    `;
    const e = this.el.querySelector('#login-btn'),
      t = this.el.querySelector('#username'),
      s = this.el.querySelector('#password'),
      i = this.el.querySelector('#login-error'),
      r = async () => {
        e.disabled = !0;
        e.style.opacity = '0.7';
        i.textContent = '';
        try {
          await w.login(t.value, s.value);
          this.onLoginSuccess();
        } catch (a) {
          i.textContent = a.message || '로그인에 실패했습니다';
        } finally {
          e.disabled = !1;
          e.style.opacity = '1';
        }
      };
    e.addEventListener('click', r);
    s.addEventListener('keydown', (a) => {
      a.key === 'Enter' && r();
    });
  }
}
