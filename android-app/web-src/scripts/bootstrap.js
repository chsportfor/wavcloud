// === 10. Bootstrap Application (EXECUTED AFTER ALL EXTENSIONS ARE DEFINED) ===
const F = () => {
  new AppController('app');
  window.WavCloudAndroid?.requestState();
};
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', F) : F();
