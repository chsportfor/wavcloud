const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const html = fs.readFileSync('android-app/app/src/main/assets/app.html', 'utf8');
const images = [], timers = new Map(), requests = [];
let timerId = 0;
const context = {
  window: { WavCloudArtwork: { resolve: (...args) => requests.push(args) }, dispatchEvent() {} },
  setTimeout(fn) { timers.set(++timerId, fn); return timerId; },
  clearTimeout(id) { timers.delete(id); },
  CustomEvent: class {},
  Image: class { constructor() { images.push(this); } },
  w: { getArtworkUrl: id => '/art/' + id }, uiText: () => ({}),
  W: function() {}
};
context.W.prototype.getTrackLocation = track => {
  const parts = track.filePath.split(/[\\/]/);
  return { category: parts.at(-3), album: parts.at(-2) };
};
vm.createContext(context);
vm.runInContext(html.slice(html.indexOf('// BEGIN VERIFIED ARTWORK CATALOG'), html.indexOf('function uiCover(')), context);
vm.runInContext(html.slice(html.indexOf('function uiEnsureArtwork('), html.indexOf('const uiOriginalState=')), context);
(async () => {
  vm.runInContext(`uiApplyRemoteArtwork({
    'DJMAX Album///V EXTENSION 2': 'https://remote.example.test/djmax.jpg',
    'DJMAX Album///V EXTENSION 3': 'javascript:alert(1)'
  })`, context);
  assert.equal(
    await context.uiRequestHighResArtwork({ id: 'remote', filePath: 'DJMAX Album/V EXTENSION 2/song.flac' }),
    'https://remote.example.test/djmax.jpg',
    'a valid server catalog entry must replace the bundled URL'
  );
  assert.notEqual(
    await context.uiRequestHighResArtwork({ id: 'unsafe', filePath: 'DJMAX Album/V EXTENSION 3/song.flac' }),
    'javascript:alert(1)',
    'the remote catalog must reject non-HTTPS URLs'
  );
  for (const filePath of [
    'Blue Archive Album/Kivotos Of Rock ~ Per Ardua ad Astra/song.flac'
  ]) {
    assert.equal(await context.uiRequestHighResArtwork({ id: filePath, filePath, album: 'Album', artist: 'Artist' }), '');
  }
  for (const filePath of [
    'DJMAX Album/V EXTENSION 2/song.flac',
    'Blue Archive Album/Kivotos of Rock/song.flac',
    '동인 음악 Album/EmoCosine - DEBUT!/song.flac',
    '동인 음악 Album/Project Etheria - ~The First Page~/song.flac',
    '동인 음악 Album/SANY-ON - DidItYesterday/song.flac',
    '동인 음악 Album/モリモリあつし - FIRST_ DREAMER/song.flac',
    '동인 음악 Album/モリモリあつし - Re-End of a Dream/song.flac'
  ]) {
    assert.match(await context.uiRequestHighResArtwork({ id: filePath, filePath, album: 'Album', artist: 'Artist' }), /^https:\/\//);
  }
  assert.equal(requests.length, 0, 'curated and metadata-preferred albums must not invoke the heuristic resolver');
  const track = { id: 'a', album: 'Personal album', artist: 'Artist' };
  const pending = context.uiRequestHighResArtwork(track);
  assert.equal(context.uiRequestHighResArtwork(track), pending, 'requests for the same album are shared');
  assert.equal(timers.size, 0, 'waiting in the native queue must not consume the network timeout');
  context.window.__wavcloudArtworkStarted(requests[0][0]);
  assert.equal(timers.size, 1);
  context.window.__wavcloudArtworkResolved(requests[0][0], 'https://example.test/hq');
  assert.equal(await pending, 'https://example.test/hq');
  assert.equal(timers.size, 0);
  const el = { dataset: {}, style: {}, isConnected: true, replaceChildren() {} };
  context.uiEnsureArtwork(el, track);
  await Promise.resolve();
  const original = images[0], high = images[1];
  high.naturalWidth = high.naturalHeight = 1200; high.onload();
  original.naturalWidth = original.naturalHeight = 200; original.onload();
  assert.equal(el.style.backgroundImage, 'url("https://example.test/hq")', 'late small originals cannot overwrite HQ');
  original.onerror();
  assert.equal(el.style.backgroundImage, 'url("https://example.test/hq")', 'original failure must retain HQ');
  context.uiEnsureArtwork(el, track); await Promise.resolve();
  assert.equal(images.length, 2, 'playback ticks must not repeatedly load HQ');
  const large = { dataset: { artworkProbe: 'a', artworkSize: '2000' }, style: {}, isConnected: true, replaceChildren() {} };
  context.uiUpgradeArtworkBackground(large, track); await Promise.resolve();
  images[2].naturalWidth = images[2].naturalHeight = 1200; images[2].onload();
  assert.equal(large.style.backgroundImage, undefined, 'larger originals must not be downgraded');
  console.log('PASS: queued resolution, deduplication, late original races, failure fallback, resolution comparison');
})().catch(error => { console.error(error); process.exitCode = 1; });
