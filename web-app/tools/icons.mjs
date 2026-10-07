import { deflateSync } from 'node:zlib';

// Rasterize the repository's simple waveform icon without a build dependency.
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const tag = Buffer.from(type);
  const size = Buffer.alloc(4), crc = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([tag, data])));
  return Buffer.concat([size, tag, data, crc]);
}
export function createIcon(size) {
  const rows = Buffer.alloc((size * 3 + 1) * size);
  const bars = [[128, 248, 280], [192, 200, 328], [256, 144, 384], [320, 200, 328], [384, 248, 280]];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = (x + .5) * 512 / size, py = (y + .5) * 512 / size;
      const wave = bars.some(([bx, top, bottom]) => {
        const closest = Math.max(top, Math.min(bottom, py));
        return (px - bx) ** 2 + (py - closest) ** 2 <= 15 ** 2;
      });
      const offset = y * (size * 3 + 1) + 1 + x * 3;
      rows.set(wave ? [128, 153, 255] : [17, 22, 33], offset);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}
