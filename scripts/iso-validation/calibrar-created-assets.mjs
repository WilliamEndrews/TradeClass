/**
 * Calibra cameras Create:
 * - escala ao bbox do projetor (~38x27, tol ±4)
 * - preserva orientacao da fonte (sem flip) — cinema-pro segue a foto de referencia
 *
 * Uso (raiz): node scripts/iso-validation/calibrar-created-assets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');
const OUT = path.join(REPO, 'assets-source', 'tradeclass-created');
const TH = path.join(REPO, 'assets-source', 'tinyhouse-pixel-salvaje', 'TinyHouse');

const SIZE = 128;
const PROJECTOR_TARGET = { w: 38, h: 27 };

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
  const channels = ctype === 6 ? 4 : ctype === 2 ? 3 : 1;
  const rowBytes = ctype === 3 ? 1 + Math.ceil((w * bit) / 8) : 1 + w * channels;
  const recon = Buffer.alloc(rowBytes * h);
  for (let y = 0; y < h; y++) {
    const row = y * rowBytes;
    const f = raw[row];
    for (let x = 1; x < rowBytes; x++) {
      const cur = raw[row + x];
      const left = ctype === 3 ? (x > 1 ? recon[row + x - 1] : 0) : x > channels ? recon[row + x - channels] : 0;
      const up = y > 0 ? recon[row - rowBytes + x] : 0;
      const upLeft =
        y > 0 && (ctype === 3 ? x > 1 : x > channels)
          ? recon[row - rowBytes + x - (ctype === 3 ? 1 : channels)]
          : 0;
      let val = cur;
      if (f === 1) val = (cur + left) & 255;
      else if (f === 2) val = (cur + up) & 255;
      else if (f === 3) val = (cur + Math.floor((left + up) / 2)) & 255;
      else if (f === 4) val = (cur + paeth(left, up, upLeft)) & 255;
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
      } else throw new Error('ctype ' + ctype + ' em ' + filePath);
    }
  }
  return { w, h, rgba };
}

function isBg(r, g, b, a) {
  if (a < 12) return true;
  if (r > 235 && g > 235 && b > 235) return true;
  if (r < 8 && g < 8 && b < 8) return true;
  if (r > 220 && g > 220 && b > 220 && Math.abs(r - g) < 12 && Math.abs(g - b) < 12) return true;
  return false;
}

function punchBg(rgba) {
  for (let i = 0; i < rgba.length; i += 4) {
    if (isBg(rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3])) rgba[i + 3] = 0;
  }
}

function bboxOf(rgba, w, h) {
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
  if (maxX < 0) throw new Error('sem pixels opacos');
  return { minX, minY, maxX, maxY, bw: maxX - minX + 1, bh: maxY - minY + 1 };
}

function fitToCanvas(rgba, w, h, canvas, targetW, targetH, tol = 0) {
  punchBg(rgba);
  const box = bboxOf(rgba, w, h);
  const scaleMin = Math.min(targetW / box.bw, targetH / box.bh);
  const scaleMax = Math.max(targetW / box.bw, targetH / box.bh);
  let scale = scaleMin;
  const dwMax = Math.round(box.bw * scaleMax);
  const dhMax = Math.round(box.bh * scaleMax);
  if (dwMax <= targetW + tol && dhMax <= targetH + tol) {
    scale = scaleMax;
  }
  const dw = Math.max(1, Math.round(box.bw * scale));
  const dh = Math.max(1, Math.round(box.bh * scale));
  const ox = Math.floor((canvas - dw) / 2);
  const oy = Math.floor((canvas - dh) / 2);
  const out = Buffer.alloc(canvas * canvas * 4);
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const sx = box.minX + Math.min(box.bw - 1, Math.floor((x + 0.5) / scale));
      const sy = box.minY + Math.min(box.bh - 1, Math.floor((y + 0.5) / scale));
      const si = (sy * w + sx) * 4;
      const di = ((oy + y) * canvas + (ox + x)) * 4;
      out[di] = rgba[si];
      out[di + 1] = rgba[si + 1];
      out[di + 2] = rgba[si + 2];
      out[di + 3] = rgba[si + 3];
    }
  }
  return out;
}

function measure(rgba, canvas) {
  const box = bboxOf(rgba, canvas, canvas);
  return { bw: box.bw, bh: box.bh };
}

function firstExisting(paths) {
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function calibrateCamera(label, srcCandidates, destName) {
  const camSrc = firstExisting(srcCandidates);
  if (!camSrc) {
    console.log('[calib] skip', label, '(fonte ausente)');
    return;
  }
  let cam = decodePng(camSrc);
  punchBg(cam.rgba);
  // Preserva orientacao da fonte (sem flip). Escala ao envelope do projetor.
  const camOut = fitToCanvas(
    cam.rgba,
    cam.w,
    cam.h,
    SIZE,
    PROJECTOR_TARGET.w,
    PROJECTOR_TARGET.h,
    4,
  );
  fs.writeFileSync(path.join(OUT, destName), encodePngRGBA(SIZE, SIZE, camOut));
  console.log('[calib]', label, measure(camOut, SIZE), 'target', PROJECTOR_TARGET);
}

function main() {
  const assetsDir = path.join(
    'C:/Users/Guilherme Endrews/.cursor/projects/c-Projetos-TradeClass/assets',
  );

  calibrateCamera(
    'camera',
    [path.join(assetsDir, 'Cinema_Camera_gen.true.png'), path.join(OUT, 'Cinema_Camera.png')],
    'Cinema_Camera.png',
  );

  calibrateCamera(
    'camera-pro',
    [
      path.join(assetsDir, 'Cinema_Camera_Pro_gen.true.png'),
      path.join(OUT, 'Cinema_Camera_Pro.png'),
    ],
    'Cinema_Camera_Pro.png',
  );

  const proj = decodePng(path.join(TH, 'Office/Projector_Ani/Projector_Ani_1.png'));
  for (let i = 0; i < proj.rgba.length; i += 4) {
    if (proj.rgba[i + 3] < 12) continue;
    if (proj.rgba[i] > 235 && proj.rgba[i + 1] > 235 && proj.rgba[i + 2] > 235) {
      proj.rgba[i + 3] = 0;
    }
  }
  console.log('[ref] projector', measure(proj.rgba, proj.w));

  const poolPath = path.join(OUT, 'Pool_Table.png');
  if (fs.existsSync(poolPath)) {
    fs.unlinkSync(poolPath);
    console.log('[calib] removido', path.relative(REPO, poolPath));
  }
}

main();
