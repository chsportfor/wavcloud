// BEGIN VERIFIED ARTWORK CATALOG
const uiVerifiedArtwork = __WAVCLOUD_ARTWORK_CATALOG__;
// END VERIFIED ARTWORK CATALOG

// These collections already carry the intended jacket in their audio metadata.
// Keep that embedded art instead of substituting a video thumbnail or another edition.
const uiEmbeddedArtworkPreferred = new Set();

// The server copy can replace or add cover URLs without publishing another APK.
// Keep the bundled catalog as an offline fallback and cache the latest valid copy.
let uiRemoteArtworkLoaded = false;
const uiApplyRemoteArtwork = catalog => {
  if (!catalog || Array.isArray(catalog) || typeof catalog !== 'object') return;
  for (const [key, url] of Object.entries(catalog)) {
    if (typeof key === 'string' && typeof url === 'string' && /^https:\/\//i.test(url)) {
      uiVerifiedArtwork[key] = url;
    }
  }
};
try {
  if (typeof localStorage !== 'undefined') uiApplyRemoteArtwork(JSON.parse(localStorage.getItem('wavcloud_artwork_catalog') || 'null'));
} catch { }
const uiRemoteArtworkReady = typeof fetch === 'function'
  ? (() => {
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      let timeout;
      const request = fetch(`/artwork-catalog.json?_=${Date.now()}`, {
        cache: 'no-store',
        ...(controller ? { signal: controller.signal } : {})
      })
        .then(response => response.ok ? response.json() : null)
        .then(catalog => {
          uiApplyRemoteArtwork(catalog);
          if (catalog && typeof localStorage !== 'undefined') localStorage.setItem('wavcloud_artwork_catalog', JSON.stringify(catalog));
        })
        .catch(() => {});
      const deadline = new Promise(resolve => {
        timeout = setTimeout(() => { controller?.abort(); resolve(); }, 2500);
      });
      return Promise.race([request, deadline]).finally(() => {
        clearTimeout(timeout);
        uiRemoteArtworkLoaded = true;
      });
    })()
  : Promise.resolve().then(() => { uiRemoteArtworkLoaded = true; });

const uiHighResArtwork = new Map();
const uiHighResArtworkPending = new Map();
const uiHighResArtworkCallbacks = new Map();
const uiHighResArtworkStarts = new Map();
let uiHighResArtworkRequestId = 0;

function uiArtworkAlbum(track) {
  if (track?.album && !/^unknown|wavcloud$/i.test(track.album)) return track.album;
  const parts = String(track?.filePath || '').replace(/\\/g, '/').split('/').filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 2] : '';
}

function uiArtworkKey(track) {
  if (uiArtworkUsesEmbedded(track)) return '';
  const verified = uiVerifiedArtworkKey(track);
  if (verified) return verified;
  const album = uiArtworkAlbum(track).trim().toLocaleLowerCase();
  const artist = String(track?.artist || '').trim().toLocaleLowerCase();
  return album && artist ? `${artist}///${album}` : '';
}

function uiArtworkFolderKey(track) {
  if (!track?.filePath) return '';
  const location = W.prototype.getTrackLocation(track);
  return `${location.category}///${location.album}`;
}

function uiArtworkUsesEmbedded(track) {
  const key = uiArtworkFolderKey(track);
  return key === 'Blue Archive Album///Kivotos Of Rock ~ Per Ardua ad Astra' ||
    uiEmbeddedArtworkPreferred.has(key);
}

function uiVerifiedArtworkKey(track) {
  const key = uiArtworkFolderKey(track);
  return Object.prototype.hasOwnProperty.call(uiVerifiedArtwork, key) ? key : '';
}

function uiResolvedArtworkUrl(track) {
  const key = uiArtworkKey(track);
  if (uiVerifiedArtwork[key]) return uiVerifiedArtwork[key];
  return key && uiHighResArtwork.has(key) ? uiHighResArtwork.get(key) : '';
}

function uiRequestHighResArtwork(track) {
  if (!uiRemoteArtworkLoaded) return uiRemoteArtworkReady.then(() => uiRequestHighResArtwork(track));
  const key = uiArtworkKey(track);
  if (uiVerifiedArtwork[key]) return Promise.resolve(uiVerifiedArtwork[key]);
  if (!key || !window.WavCloudArtwork) return Promise.resolve('');
  if (uiHighResArtwork.has(key)) return Promise.resolve(uiHighResArtwork.get(key));
  if (uiHighResArtworkPending.has(key)) return uiHighResArtworkPending.get(key);

  const requestId = `art-${++uiHighResArtworkRequestId}`;
  const promise = new Promise(resolve => {
    let timeout;
    // Queue time is not network time: the native resolver processes albums serially.
    uiHighResArtworkStarts.set(requestId, () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => window.__wavcloudArtworkResolved(requestId, ''), 120000);
    });
    uiHighResArtworkCallbacks.set(requestId, url => {
      clearTimeout(timeout);
      uiHighResArtworkStarts.delete(requestId);
      const resolvedUrl = typeof url === 'string' ? url : '';
      uiHighResArtwork.set(key, resolvedUrl);
      uiHighResArtworkPending.delete(key);
      resolve(resolvedUrl);
      if (resolvedUrl) window.dispatchEvent(new CustomEvent('wavcloud:artwork-resolved', { detail: { key, url: resolvedUrl } }));
    });
  });
  uiHighResArtworkPending.set(key, promise);
  try {
    window.WavCloudArtwork.resolve(requestId, uiArtworkAlbum(track), String(track.artist || ''));
  } catch {
    window.__wavcloudArtworkResolved(requestId, '');
  }
  return promise;
}

window.__wavcloudArtworkStarted = requestId => uiHighResArtworkStarts.get(requestId)?.();
window.__wavcloudArtworkResolved = (requestId, url) => {
  const callback = uiHighResArtworkCallbacks.get(requestId);
  if (!callback) return;
  uiHighResArtworkCallbacks.delete(requestId);
  callback(url || '');
};

function uiUpgradeArtworkImage(image, track, container) {
  if (!image || !track) return;
  const expectedId = String(track.id ?? '');
  image.dataset.trackId = expectedId;
  uiRequestHighResArtwork(track).then(url => {
    if (!url || image.dataset.trackId !== expectedId || !image.isConnected) return;
    const probe = new Image();
    probe.onload = () => {
      if (image.dataset.trackId !== expectedId || !image.isConnected) return;
      if (Math.min(probe.naturalWidth, probe.naturalHeight) <= Math.min(image.naturalWidth, image.naturalHeight)) return;
      image.src = url;
      image.dataset.highResolution = 'true';
      container?.classList.add('has-artwork');
    };
    probe.src = url;
  });
}

function uiUpgradeArtworkBackground(element, track, backgroundElement) {
  if (!element || !track) return;
  const expectedId = String(track.id ?? '');
  uiRequestHighResArtwork(track).then(url => {
    if (!url || element.dataset.artworkProbe !== expectedId || !element.isConnected) return;
    if (element.dataset.highResolutionUrl === url || element.dataset.artworkUpgradePending === url) return;
    element.dataset.artworkUpgradePending = url;
    const probe = new Image();
    probe.onerror = () => { if (element.dataset.artworkUpgradePending === url) delete element.dataset.artworkUpgradePending; };
    probe.onload = () => {
      if (element.dataset.artworkProbe !== expectedId || !element.isConnected) return;
      delete element.dataset.artworkUpgradePending;
      const size = Math.min(probe.naturalWidth, probe.naturalHeight);
      if (size <= Number(element.dataset.artworkSize || 0)) return;
      element.dataset.artworkSize = String(size);
      element.dataset.highResolutionUrl = url;
      const cssUrl = `url("${url}")`;
      element.style.backgroundImage = cssUrl;
      element.dataset.artworkLoaded = cssUrl;
      element.replaceChildren();
      if (backgroundElement) backgroundElement.style.backgroundImage = cssUrl;
    };
    probe.src = url;
  });
}

function uiCover(track, className) {
  const div = uiText('div', className);
  const fallback = uiText('div', 'ui-cover-fallback', '');
  fallback.innerHTML = '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>';
  div.append(fallback);
  if (track && track.id != null) {
    const image = document.createElement('img');
    image.className = 'ui-cover-image';
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('load', () => div.classList.add('has-artwork'));
    image.addEventListener('error', () => { image.style.visibility = 'hidden'; });
    image.addEventListener('load', () => { image.style.visibility = ''; });
    image.src = w.getArtworkUrl(track.id);
    div.append(image);
    uiUpgradeArtworkImage(image, track, div);
  }
  return div;
}
