const _trackSorter = (a, b) => {
  const gn = (t) => {
    if (t.trackNumber != null && t.trackNumber > 0) return t.trackNumber;
    const fn = (t.filePath || t.title || '').replace(/\\/g, '/').split('/').pop();
    const m = fn.match(/^(\d+)/);
    return m ? parseInt(m[1], 10) : 99999;
  };
  const na = gn(a),
    nb = gn(b);
  if (na !== nb) return na - nb;
  return (a.filePath || '').localeCompare(b.filePath || '', void 0, {
    numeric: !0,
    sensitivity: 'base',
  });
};
function defineField(object, key, value) {
  Object.defineProperty(object, key, {
    enumerable: true,
    configurable: true,
    writable: true,
    value,
  });
}
(function () {
  const e = document.createElement('link').relList;
  if (e && e.supports && e.supports('modulepreload')) return;
  for (const i of document.querySelectorAll('link[rel="modulepreload"]')) s(i);
  new MutationObserver((i) => {
    for (const r of i)
      if (r.type === 'childList')
        for (const a of r.addedNodes) a.tagName === 'LINK' && a.rel === 'modulepreload' && s(a);
  }).observe(document, { childList: !0, subtree: !0 });
  function t(i) {
    const r = {};
    return (
      i.integrity && (r.integrity = i.integrity),
      i.referrerPolicy && (r.referrerPolicy = i.referrerPolicy),
      i.crossOrigin === 'use-credentials'
        ? (r.credentials = 'include')
        : i.crossOrigin === 'anonymous'
          ? (r.credentials = 'omit')
          : (r.credentials = 'same-origin'),
      r
    );
  }
  function s(i) {
    if (i.ep) return;
    i.ep = !0;
    const r = t(i);
    fetch(i.href, r);
  }
})();
let V = null;
function P(x, e = 2200) {
  let t = document.getElementById('cm-toast');
  t ||
    ((t = document.createElement('div')),
    (t.id = 'cm-toast'),
    (t.className = 'cm-toast'),
    document.body.appendChild(t));
  t.textContent = x;
  t.classList.add('visible');
  V && clearTimeout(V);
  V = setTimeout(() => {
    t == null || t.classList.remove('visible');
  }, e);
}
