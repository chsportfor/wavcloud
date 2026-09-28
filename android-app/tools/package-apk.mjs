import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const workspace = path.resolve(import.meta.dirname, '..', '..');
const buildOutput = path.join(workspace, 'android-app', 'app', 'build', 'outputs', 'apk', 'debug');
const metadata = JSON.parse(fs.readFileSync(path.join(buildOutput, 'output-metadata.json'), 'utf8'));
const artifact = metadata.elements?.find(element => element.type === 'SINGLE');
if (!artifact || !/^\d+\.\d+\.\d+$/.test(artifact.versionName) || !artifact.outputFile) {
  throw new Error('Android build did not produce a versioned debug APK');
}

const source = path.join(buildOutput, artifact.outputFile);
const destination = path.join(workspace, 'outputs', `WavCloud-Android-${artifact.versionName}-debug.apk`);
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.copyFileSync(source, destination);
const hash = createHash('sha256').update(fs.readFileSync(destination)).digest('hex').toUpperCase();
console.log(`APK: ${destination}`);
console.log(`SHA-256: ${hash}`);
