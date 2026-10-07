import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const syncCheck = spawnSync(process.execPath, ['android-app/tools/sync-web.mjs', '--check'], {
  cwd: process.cwd(),
  encoding: 'utf8'
});
if (syncCheck.status !== 0) throw new Error(syncCheck.stderr || syncCheck.stdout || 'Web source check failed');

const html = fs.readFileSync('android-app/app/src/main/assets/app.html', 'utf8');
const startToken = '<script type="module">';
const endToken = '</script>';
const start = html.indexOf(startToken);
const end = html.lastIndexOf(endToken);
if (start < 0 || end <= start) throw new Error('Bundled module script is missing');
const source = html.slice(start + startToken.length, end);
if (!source.includes('class AndroidAudioPlayer extends AudioPlayer') || !source.includes('this.native.setQueue')) throw new Error('Native bridge was not bundled');
if (/\b(?:LibraryView|PlayerView|MiniPlayerView)\.prototype\.\w+\s*=/.test(source)) throw new Error('View prototype overrides must not return');
if (!source.includes('__wavcloudNativeProgress')) throw new Error('Native progress bridge was not bundled');
if (!source.includes('WavCloudOffline.download') || !source.includes('__wavcloudOfflineResult')) {
  throw new Error('Native offline bridge was not bundled');
}
if (source.includes('navigator.serviceWorker.register')) throw new Error('PWA service worker leaked into Android bundle');
if (!html.includes('body class="wavcloud-native"')) throw new Error('Native layout marker is missing');
fs.writeFileSync('work/android-app-bundle-check.mjs', source);
console.log('PASS: Android web bundle contains playback/offline bridges and no service worker registration');
