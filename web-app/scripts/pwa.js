if ('serviceWorker' in navigator) {
  const pageScript = new URL(document.querySelector('script[type="module"][src]').src).pathname;
  const pageStyle = new URL(document.querySelector('link[rel="stylesheet"]').href).pathname;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    navigator.serviceWorker.controller?.postMessage({ type: 'WAVCLOUD_BUILD' });
  });
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type !== 'WAVCLOUD_BUILD' || (event.data.script === pageScript && event.data.style === pageStyle) || document.querySelector('.web-update')) return;
    const banner = uiText('div', 'web-update', '새 버전이 준비됐어요.');
    banner.setAttribute('role', 'status');
    const reload = uiText('button', '', '새로고침');
    reload.type = 'button';
    reload.addEventListener('click', () => window.location.reload());
    banner.append(reload);
    document.body.append(banner);
  });
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update().catch(() => {});
      });
    } catch (error) {
      console.warn('Offline page setup failed', error);
    }
  });
}
