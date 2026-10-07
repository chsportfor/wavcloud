// === 10. Bootstrap Application (EXECUTED AFTER ALL EXTENSIONS ARE DEFINED) ===
const F = () => {
  const app = new AppController('app');
  if (typeof uiSetupBrowser === 'function') uiSetupBrowser(app);
  window.WavCloudAndroid?.requestState();
};
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', F) : F();
