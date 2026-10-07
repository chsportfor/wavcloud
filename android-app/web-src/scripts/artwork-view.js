function uiEnsureArtwork(element, track, backgroundElement) {
  if (!element || !track || track.id == null) return;
  const artworkId = String(track.id);
  if (element.dataset.artworkProbe === artworkId) {
    if (element.dataset.artworkLoaded) {
      element.style.backgroundImage = element.dataset.artworkLoaded;
      element.replaceChildren();
    }
    uiUpgradeArtworkBackground(element, track, backgroundElement);
    return;
  }
  delete element.dataset.artworkLoaded;
  delete element.dataset.highResolutionUrl;
  delete element.dataset.artworkUpgradePending;
  delete element.dataset.artworkSize;
  element.dataset.artworkProbe = artworkId;
  const url = w.getArtworkUrl(track.id);
  const image = new Image();
  image.onload = () => {
    if (element.dataset.artworkProbe !== artworkId) return;
    const size = Math.min(image.naturalWidth || 0, image.naturalHeight || 0);
    if (element.dataset.highResolutionUrl && size <= Number(element.dataset.artworkSize || 0))
      return;
    element.dataset.artworkSize = String(size);
    element.style.backgroundImage = `url("${url}")`;
    element.dataset.artworkLoaded = `url("${url}")`;
    element.style.backgroundSize = 'cover';
    element.style.backgroundPosition = 'center';
    element.replaceChildren();
    if (backgroundElement) backgroundElement.style.backgroundImage = `url("${url}")`;
  };
  image.onerror = () => {
    if (element.dataset.artworkProbe !== artworkId) return;
    if (element.dataset.highResolutionUrl) return;
    element.style.backgroundImage = 'none';
    element.replaceChildren(uiText('span', '', '♪'));
  };
  image.src = url;
  uiUpgradeArtworkBackground(element, track, backgroundElement);
}
