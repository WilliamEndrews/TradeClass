/**
 * Pos-processa PNGs gerados (camera) para assets Create:
 * remove fundo quase branco/preto, centraliza no canvas alvo.
 *
 * Uso:
 *   node scripts/iso-validation/postprocess-created-png.mjs <src> <dest> <size>
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function crcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
}
const CRC_TABLE = crcTable();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcBuf), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePngRGBA(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    rgba.copy(raw, row + 1, y * width * 4, (y + 1) * width * 4);
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function decodePng(filePath) {
  const b = fs.readFileSync(filePath);
  let i = 8;
  let w;
  let h;
  let bit;
  let ctype;
  let plte;
  let trns;
  const idat = [];
  while (i < b.length) {
    const len = b.readUInt32BE(i);
    const t = b.slice(i + 4, i + 8).toString('ascii');
    const d = b.slice(i + 8, i + 8 + len);
    if (t === 'IHDR') {
      w = d.readUInt32BE(0);
      h = d.readUInt32BE(4);
      bit = d[8];
      ctype = d[9];
    } else if (t === 'PLTE') plte = d;
    else if (t === 'tRNS') trns = d;
    else if (t === 'IDAT') idat.push(d);
    else if (t === 'IEND') break;
    i += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = ctype === 6 ? 4 : ctype === 2 ? 3 : ctype === 3 ? 1 : 1;
  const stride = 1 + Math.ceil((w * bit * (ctype === 3 ? 1 : bpp)) / 8);
  // For 8-bit RGB/RGBA: stride = 1 + w*channels
  const channels = ctype === 6 ? 4 : ctype === 2 ? 3 : ctype === 0 ? 1 : 1;
  const rowBytes = ctype === 3 ? 1 + Math.ceil((w * bit) / 8) : 1 + w * channels;
  const recon = Buffer.alloc(rowBytes * h);
  for (let y = 0; y < h; y++) {
    const row = y * rowBytes;
    const f = raw[row];
    for (let x = 1; x < rowBytes; x++) {
      const cur = raw[row + x];
      const left = x > channels ? recon[row + x - channels] : x > 1 && ctype === 3 ? recon[row + x - 1] : 0;
      const up = y > 0 ? recon[row - rowBytes + x] : 0;
      const upLeft = y > 0 && x > channels ? recon[row - rowBytes + x - channels] : 0;
      const leftIdx = ctype === 3 ? (x > 1 ? recon[row + x - 1] : 0) : left;
      const upLeftIdx = ctype === 3 ? (y > 0 && x > 1 ? recon[row - rowBytes + x - 1] : 0) : upLeft;
      let val = cur;
      if (f === 1) val = (cur + (ctype === 3 ? leftIdx : left)) & 255;
      else if (f === 2) val = (cur + up) & 255;
      else if (f === 3) val = (cur + Math.floor(((ctype === 3 ? leftIdx : left) + up) / 2)) & 255;
      else if (f === 4) val = (cur + paeth(ctype === 3 ? leftIdx : left, up, ctype === 3 ? upLeftIdx : upLeft)) & 255;
      recon[row + x] = val;
    }
  }
  const rgba = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (ctype === 6) {
        const s = y * rowBytes + 1 + x * 4;
        rgba[o] = recon[s];
        rgba[o + 1] = recon[s + 1];
        rgba[o + 2] = recon[s + 2];
        rgba[o + 3] = recon[s + 3];
      } else if (ctype === 2) {
        const s = y * rowBytes + 1 + x * 3;
        rgba[o] = recon[s];
        rgba[o + 1] = recon[s + 1];
        rgba[o + 2] = recon[s + 2];
        rgba[o + 3] = 255;
      } else if (ctype === 3) {
        let id;
        if (bit === 8) id = recon[y * rowBytes + 1 + x];
        else {
          const byte = recon[y * rowBytes + 1 + Math.floor(x / 2)];
          id = x % 2 === 0 ? (byte >> 4) & 0xf : byte & 0xf;
        }
        rgba[o] = plte[id * 3];
        rgba[o + 1] = plte[id * 3 + 1];
        rgba[o + 2] = plte[id * 3 + 2];
        rgba[o + 3] = trns && id < trns.length ? trns[id] : 255;
      } else throw new Error('ctype ' + ctype);
    }
  }
  return { w, h, rgba, ctype };
}

function isBg(r, g, b, a) {
  if (a < 12) return true;
  // white / light studio
  if (r > 235 && g > 235 && b > 235) return true;
  // near-black empty (rare)
  if (r < 8 && g < 8 && b < 8 && a > 200) return true;
  return false;
}

function processToCanvas(srcPath, destPath, size) {
  const { w, h, rgba } = decodePng(srcPath);
  // punch background
  for (let i = 0; i < rgba.length; i += 4) {
    if (isBg(rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3])) {
      rgba[i + 3] = 0;
    }
  }
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (rgba[(y * w + x) * 4 + 3] < 16) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) throw new Error('sem pixels opacos: ' + srcPath);
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const pad = Math.floor(size * 0.06);
  const scale = Math.min((size - pad * 2) / bw, (size - pad * 2) / bh);
  const dw = Math.max(1, Math.round(bw * scale));
  const dh = Math.max(1, Math.round(bh * scale));
  const ox = Math.floor((size - dw) / 2);
  const oy = Math.floor((size - dh) / 2);
  const out = Buffer.alloc(size * size * 4);

  // nearest-neighbor scale crop
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const sx = minX + Math.min(bw - 1, Math.floor((x + 0.5) / scale));
      const sy = minY + Math.min(bh - 1, Math.floor((y + 0.5) / scale));
      const si = (sy * w + sx) * 4;
      const di = ((oy + y) * size + (ox + x)) * 4;
      out[di] = rgba[si];
      out[di + 1] = rgba[si + 1];
      out[di + 2] = rgba[si + 2];
      out[di + 3] = rgba[si + 3];
    }
  }

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, encodePngRGBA(size, size, out));
  console.log('[post]', path.basename(destPath), `${w}x${h} -> ${size}x${size}`, `bbox ${bw}x${bh}`);
}

const [src, dest, sizeArg] = process.argv.slice(2);
if (!src || !dest || !sizeArg) {
  console.error('uso: node postprocess-created-png.mjs <src> <dest> <size>');
  process.exit(1);
}
processToCanvas(path.resolve(src), path.resolve(dest), Number(sizeArg));
