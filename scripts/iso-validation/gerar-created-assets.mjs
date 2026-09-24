/**
 * Gera PNGs isométricos procedurais para a aba Create do TinyTraderLab.
 *
 * Uso (raiz do repo): node scripts/iso-validation/gerar-created-assets.mjs
 *
 * Saida:
 *   assets-source/tradeclass-created/*.png
 *   scripts/iso-validation/created-assets.json
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const OUT_DIR = path.join(REPO_ROOT, 'assets-source', 'tradeclass-created');
const JSON_PATH = path.join(__dirname, 'created-assets.json');
const SIZE = 128;

// --- PNG encoder (RGBA, sem deps) -------------------------------------------

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

// --- Pixel buffer -----------------------------------------------------------

function createBuf() {
  return Buffer.alloc(SIZE * SIZE * 4);
}

function setPx(buf, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  buf[i] = r;
  buf[i + 1] = g;
  buf[i + 2] = b;
  buf[i + 3] = a;
}

function getA(buf, x, y) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return 0;
  return buf[(y * SIZE + x) * 4 + 3];
}

/** Preenche losango isometrico (eixo X/Y de grid). */
function fillDiamond(buf, cx, cy, halfW, halfH, colorFn) {
  for (let y = cy - halfH; y <= cy + halfH; y++) {
    const t = 1 - Math.abs(y - cy) / halfH;
    const span = Math.floor(halfW * t);
    for (let x = cx - span; x <= cx + span; x++) {
      const c = colorFn(x, y, cx, cy, halfW, halfH);
      if (c) setPx(buf, x, y, c[0], c[1], c[2], c[3] ?? 255);
    }
  }
}

function outlineDiamond(buf, cx, cy, halfW, halfH, r, g, b) {
  for (let y = cy - halfH; y <= cy + halfH; y++) {
    const t = 1 - Math.abs(y - cy) / halfH;
    const span = Math.floor(halfW * t);
    setPx(buf, cx - span, y, r, g, b);
    setPx(buf, cx + span, y, r, g, b);
  }
  setPx(buf, cx, cy - halfH, r, g, b);
  setPx(buf, cx, cy + halfH, r, g, b);
}

function fillRect(buf, x0, y0, x1, y1, r, g, b, a = 255) {
  const xa = Math.min(x0, x1);
  const xb = Math.max(x0, x1);
  const ya = Math.min(y0, y1);
  const yb = Math.max(y0, y1);
  for (let y = ya; y <= yb; y++) {
    for (let x = xa; x <= xb; x++) setPx(buf, x, y, r, g, b, a);
  }
}

function hashNoise(x, y) {
  let n = (x * 374761393 + y * 668265263) ^ 0x5bd1e995;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 0xffffffff;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Decodifica PNG indexado (bit 4/8, ctype 3) para RGBA. */
function decodeIndexedPng(filePath) {
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
  if (ctype !== 3 || !plte) throw new Error('PNG indexado esperado: ' + filePath);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = 1 + Math.ceil((w * bit) / 8);
  const recon = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const row = y * stride;
    const f = raw[row];
    for (let x = 1; x < stride; x++) {
      const cur = raw[row + x];
      const left = x > 1 ? recon[row + x - 1] : 0;
      const up = y > 0 ? recon[row - stride + x] : 0;
      const upLeft = y > 0 && x > 1 ? recon[row - stride + x - 1] : 0;
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
      let id;
      if (bit === 8) id = recon[y * stride + 1 + x];
      else if (bit === 4) {
        const byte = recon[y * stride + 1 + Math.floor(x / 2)];
        id = x % 2 === 0 ? (byte >> 4) & 0xf : byte & 0xf;
      } else throw new Error('bit depth nao suportado: ' + bit);
      const r = plte[id * 3];
      const g = plte[id * 3 + 1];
      const bl = plte[id * 3 + 2];
      const a = trns && id < trns.length ? trns[id] : 255;
      const o = (y * w + x) * 4;
      rgba[o] = r;
      rgba[o + 1] = g;
      rgba[o + 2] = bl;
      rgba[o + 3] = a;
    }
  }
  return { w, h, rgba };
}

/** Decodifica PNG RGBA (ctype 6) ou RGB (ctype 2). */
function decodeRgbaPng(filePath) {
  const b = fs.readFileSync(filePath);
  let i = 8;
  let w;
  let h;
  let ctype;
  const idat = [];
  while (i < b.length) {
    const len = b.readUInt32BE(i);
    const t = b.slice(i + 4, i + 8).toString('ascii');
    const d = b.slice(i + 8, i + 8 + len);
    if (t === 'IHDR') {
      w = d.readUInt32BE(0);
      h = d.readUInt32BE(4);
      ctype = d[9];
    } else if (t === 'IDAT') idat.push(d);
    else if (t === 'IEND') break;
    i += 12 + len;
  }
  if (ctype !== 6 && ctype !== 2) {
    throw new Error('PNG RGBA/RGB esperado: ' + filePath + ' ctype=' + ctype);
  }
  const channels = ctype === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const rowBytes = 1 + w * channels;
  const recon = Buffer.alloc(rowBytes * h);
  for (let y = 0; y < h; y++) {
    const row = y * rowBytes;
    const f = raw[row];
    for (let x = 1; x < rowBytes; x++) {
      const cur = raw[row + x];
      const left = x > channels ? recon[row + x - channels] : 0;
      const up = y > 0 ? recon[row - rowBytes + x] : 0;
      const upLeft = y > 0 && x > channels ? recon[row - rowBytes + x - channels] : 0;
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
      } else {
        const s = y * rowBytes + 1 + x * 3;
        rgba[o] = recon[s];
        rgba[o + 1] = recon[s + 1];
        rgba[o + 2] = recon[s + 2];
        rgba[o + 3] = 255;
      }
    }
  }
  return { w, h, rgba };
}

/**
 * Remapeia cores da Mesa de centro (Table_10):
 * madeira -> plastico branco; pes escuros -> aluminio; sombra/contorno preservados.
 */
const TABLE10_RECOLOR = new Map([
  // madeira (tampo)
  ['223,130,61', [244, 244, 248, 255]], // #df823d principal
  ['237,168,93', [255, 255, 255, 255]], // #eda85d highlight
  ['194,107,36', [228, 228, 234, 255]], // #c26b24 mid
  ['137,69,34', [200, 202, 210, 255]], // #894522 escuro
  ['60,19,0', [168, 170, 178, 255]], // #3c1300 borda madeira
  // pes / metal originais -> aluminio
  ['52,55,55', [154, 160, 168, 255]], // #343737
  ['72,76,75', [176, 182, 190, 255]], // #484c4b
  ['105,108,104', [210, 214, 220, 255]], // #696c68 highlight pe
  ['32,33,34', [110, 116, 124, 255]], // #202122 sombra pe
  // contorno e sombra
  ['5,5,7', [58, 60, 68, 255]], // #050507 outline
  ['23,19,37', [26, 28, 36, 128]], // #171325 sombra (alpha preservado abaixo)
]);

/** Toda a mesa em aluminio (mesma silhueta da branca / Table_10). */
const TABLE10_METAL_RECOLOR = new Map([
  ['223,130,61', [176, 182, 190, 255]], // tampo base metal
  ['237,168,93', [214, 218, 224, 255]], // highlight metal
  ['194,107,36', [154, 160, 168, 255]], // mid
  ['137,69,34', [120, 126, 134, 255]], // escuro
  ['60,19,0', [96, 102, 110, 255]], // borda
  ['52,55,55', [154, 160, 168, 255]],
  ['72,76,75', [176, 182, 190, 255]],
  ['105,108,104', [210, 214, 220, 255]],
  ['32,33,34', [110, 116, 124, 255]],
  ['5,5,7', [58, 60, 68, 255]],
  ['23,19,37', [26, 28, 36, 128]],
]);

function recolorRgba(src, map) {
  const out = Buffer.from(src);
  for (let i = 0; i < out.length; i += 4) {
    const a = out[i + 3];
    if (a < 8) continue;
    const key = out[i] + ',' + out[i + 1] + ',' + out[i + 2];
    const m = map.get(key);
    if (!m) continue;
    out[i] = m[0];
    out[i + 1] = m[1];
    out[i + 2] = m[2];
    if (a < 255) out[i + 3] = a;
    else out[i + 3] = m[3];
  }
  return out;
}

// --- Assets -----------------------------------------------------------------

/** Tapete branco tecido ~ footprint carpet-red (bbox ~123x62). */
function drawWhiteRug() {
  const buf = createBuf();
  const cx = 64;
  const cy = 64;
  // carpet-red ~123x62 => halfW=61, halfH=31
  const halfW = 61;
  const halfH = 31;

  fillDiamond(buf, cx, cy + 2, halfW - 2, halfH - 1, () => [210, 210, 214, 90]);

  fillDiamond(buf, cx, cy, halfW, halfH, (x, y, ox, oy, hw, hh) => {
    const dy = (y - oy) / hh;
    const dx = (x - ox) / hw;
    const edge = Math.abs(dx) + Math.abs(dy);
    const n = hashNoise(x, y);
    const weave = ((x + y) & 3) === 0 ? -6 : ((x * 2 + y) & 5) === 0 ? 4 : 0;
    const shade = Math.floor(dy * 10) + Math.floor(n * 8) + weave;
    let r = 248 + shade;
    let g = 248 + shade;
    let b = 250 + Math.floor(shade * 0.6);
    if (edge > 0.86) {
      r = 220;
      g = 220;
      b = 228;
    } else if (edge > 0.78) {
      r = 238;
      g = 238;
      b = 244;
    }
    return [
      Math.max(200, Math.min(255, r)),
      Math.max(200, Math.min(255, g)),
      Math.max(210, Math.min(255, b)),
      255,
    ];
  });

  outlineDiamond(buf, cx, cy, halfW, halfH, 160, 160, 170);
  outlineDiamond(buf, cx, cy, halfW - 3, halfH - 2, 230, 230, 236);

  // pontos de fio (textura tecido)
  for (let y = cy - halfH + 4; y <= cy + halfH - 4; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (getA(buf, x, y) < 200) continue;
      if (hashNoise(x * 3, y * 7) > 0.92) {
        setPx(buf, x, y, 255, 255, 255, 255);
      } else if (hashNoise(x * 5, y * 2) > 0.97) {
        setPx(buf, x, y, 228, 228, 234, 255);
      }
    }
  }

  return buf;
}

/**
 * Mesa branca plastico + pes aluminio: clone 1:1 da Mesa de centro
 * (Living Roon/Table_10.png / living-table-10), so recolorindo a paleta.
 */
function loadTable10Rgba() {
  const srcPath = path.join(
    REPO_ROOT,
    'assets-source',
    'tinyhouse-pixel-salvaje',
    'TinyHouse',
    'Living Roon',
    'Table_10.png',
  );
  const { w, h, rgba } = decodeIndexedPng(srcPath);
  if (w !== SIZE || h !== SIZE) {
    throw new Error(`Table_10 inesperado: ${w}x${h}`);
  }
  return rgba;
}

function drawWhiteDeskFromCoffeeTable() {
  return recolorRgba(loadTable10Rgba(), TABLE10_RECOLOR);
}

function drawMetalDeskFromCoffeeTable() {
  return recolorRgba(loadTable10Rgba(), TABLE10_METAL_RECOLOR);
}

/**
 * Mesa alternativa (Desk_1_Tile / desk-1): mesma madeira da Table_10 + tons extras.
 * Embranquecimento alinhado à Mesa centro branca plástico.
 */
const DESK1_RECOLOR = new Map([
  ['223,130,61', [244, 244, 248, 255]],
  ['237,168,93', [255, 255, 255, 255]],
  ['194,107,36', [228, 228, 234, 255]],
  ['189,121,50', [220, 222, 228, 255]], // face da gaveta / caixa
  ['137,69,34', [200, 202, 210, 255]],
  ['116,59,14', [184, 186, 194, 255]],
  ['112,51,16', [170, 172, 180, 255]],
  ['111,51,17', [168, 170, 178, 255]],
  ['111,52,17', [168, 170, 178, 255]],
  ['86,34,0', [150, 152, 160, 255]],
  ['76,28,4', [140, 142, 150, 255]],
  ['60,19,0', [120, 122, 130, 255]],
  ['25,20,37', [26, 28, 36, 128]],
]);

/**
 * Mesa principal (Office_Main_Table_Base): charcoal -> plástico branco;
 * perna T / highlights metálicos -> alumínio (como pés da mesa centro).
 */
const MAIN_DESK_RECOLOR = new Map([
  ['76,79,80', [244, 244, 248, 255]], // tampo
  ['116,125,129', [230, 232, 238, 255]], // aresta tampo
  ['155,171,178', [214, 218, 224, 255]], // highlight tampo
  ['39,43,44', [176, 178, 186, 255]], // face escura tampo
  ['69,70,76', [200, 202, 210, 255]], // corpo do móvel/gavetas
  ['134,140,141', [210, 214, 220, 255]], // face de gaveta / acento
  ['185,193,194', [176, 182, 190, 255]], // pe T aluminio
  ['221,231,233', [230, 234, 240, 255]], // highlight metal / puxadores
  ['0,0,0', [58, 60, 68, 255]],
  ['5,5,7', [58, 60, 68, 255]],
  ['24,25,27', [26, 28, 36, 128]],
]);

function tinyHousePath(...parts) {
  return path.join(
    REPO_ROOT,
    'assets-source',
    'tinyhouse-pixel-salvaje',
    'TinyHouse',
    ...parts,
  );
}

function loadDesk1Rgba() {
  const { w, h, rgba } = decodeIndexedPng(tinyHousePath('Desks', 'Desk_1_Tile.png'));
  if (w !== SIZE || h !== SIZE) throw new Error(`Desk_1 inesperado: ${w}x${h}`);
  return Buffer.from(rgba);
}

function loadMainDeskRgba() {
  const { w, h, rgba } = decodeRgbaPng(
    tinyHousePath('Desks', 'Office_Main_Table_Desk', 'Office_Main_Table_Base.png'),
  );
  if (w !== SIZE || h !== SIZE) throw new Error(`Main desk inesperado: ${w}x${h}`);
  return Buffer.from(rgba);
}

function pxAt(rgba, x, y) {
  const i = (y * SIZE + x) * 4;
  return [rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3], i];
}

function neighbors4(x, y) {
  return [
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
    [x, y + 1],
  ];
}

/** True se (x,y) tem vizinho 4-dir com RGB alvo (e alfa >= 8). */
function hasNeighborRgb(rgba, x, y, r, g, b) {
  for (const [nx, ny] of neighbors4(x, y)) {
    if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
    const [pr, pg, pb, pa] = pxAt(rgba, nx, ny);
    if (pa >= 8 && pr === r && pg === g && pb === b) return true;
  }
  return false;
}

/**
 * Remove a gaveta da Mesa alternativa por completo.
 *
 * O pe direito original carrega um painel frontal largo (116 + 111/112/86)
 * que, sem a face 189, ainda lê como gaveta. Aqui:
 * - protege tampo, pe esquerdo (76), face externa do pe direito (137) e sombra;
 * - apaga face da gaveta (189) e todo o painel/fiadas do vao sob o tampo.
 */
function eraseDesk1Drawer(rgba) {
  const out = Buffer.from(rgba);
  const protectedPx = new Uint8Array(SIZE * SIZE);

  function rgbEq(r, g, b, pr, pg, pb) {
    return r === pr && g === pg && b === pb;
  }

  function isTopColor(r, g, b) {
    return (
      rgbEq(r, g, b, 223, 130, 61) ||
      rgbEq(r, g, b, 237, 168, 93) ||
      rgbEq(r, g, b, 194, 107, 36)
    );
  }

  const queue = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const [r, g, b, a] = pxAt(out, x, y);
      if (a < 8) continue;
      const idx = y * SIZE + x;
      // tampo
      if (isTopColor(r, g, b) && y <= 76) {
        protectedPx[idx] = 1;
        queue.push(idx);
        continue;
      }
      // pe esquerdo
      if (rgbEq(r, g, b, 76, 28, 4)) {
        protectedPx[idx] = 1;
        queue.push(idx);
        continue;
      }
      // pe direito: SOMENTE a face externa (137) — sem painel frontal
      if (rgbEq(r, g, b, 137, 69, 34)) {
        protectedPx[idx] = 1;
        queue.push(idx);
        continue;
      }
      // aresta frontal do tampo a direita (116 em y baixo, x alto)
      if (rgbEq(r, g, b, 116, 59, 14) && y <= 73 && x >= 88) {
        protectedPx[idx] = 1;
        queue.push(idx);
        continue;
      }
      // sombra
      if (rgbEq(r, g, b, 25, 20, 37)) {
        protectedPx[idx] = 1;
        queue.push(idx);
      }
    }
  }

  // flood: contorno 60,19,0 so quando cola em pe/tampo (nao encadear puxador)
  let qi = 0;
  while (qi < queue.length) {
    const cur = queue[qi++];
    const cx = cur % SIZE;
    const cy = (cur / SIZE) | 0;
    const [cr, cg, cb] = pxAt(out, cx, cy);
    const curIsOutline = rgbEq(cr, cg, cb, 60, 19, 0);
    for (const [nx, ny] of neighbors4(cx, cy)) {
      if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
      const nidx = ny * SIZE + nx;
      if (protectedPx[nidx]) continue;
      const [r, g, b, a] = pxAt(out, nx, ny);
      if (a < 8) continue;
      if (rgbEq(r, g, b, 189, 121, 50)) continue;
      if (rgbEq(r, g, b, 60, 19, 0)) {
        // so protege contorno a partir de pe/tampo, nao de outro contorno
        if (curIsOutline) continue;
        protectedPx[nidx] = 1;
        queue.push(nidx);
        continue;
      }
      if (isTopColor(r, g, b) && ny <= 74) {
        protectedPx[nidx] = 1;
        queue.push(nidx);
        continue;
      }
      if (rgbEq(r, g, b, 76, 28, 4) || rgbEq(r, g, b, 137, 69, 34)) {
        protectedPx[nidx] = 1;
        queue.push(nidx);
        continue;
      }
      if (rgbEq(r, g, b, 116, 59, 14) && ny <= 73 && nx >= 88) {
        protectedPx[nidx] = 1;
        queue.push(nidx);
      }
    }
  }

  // apaga vao sob o tampo (inclui painel frontal que lia como gaveta)
  for (let y = 68; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const idx = y * SIZE + x;
      if (protectedPx[idx]) continue;
      const [, , , a, i] = pxAt(out, x, y);
      if (a < 8) continue;
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 0;
    }
  }

  // garante face da gaveta 100% fora
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const [r, g, b, a, i] = pxAt(out, x, y);
      if (a >= 8 && rgbEq(r, g, b, 189, 121, 50)) {
        out[i] = 0;
        out[i + 1] = 0;
        out[i + 2] = 0;
        out[i + 3] = 0;
      }
    }
  }

  return out;
}

/**
 * Mantém a caixa da gaveta, mas apaga puxador e tracinhos que entregam
 * a face frontal — face lisa (abre para o lado oculto).
 */
function smoothDesk1Drawer(rgba) {
  const out = Buffer.from(rgba);
  const face = [189, 121, 50, 255];
  // puxador + moldura rebaixada + fiadas mid na face frontal
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const [r, g, b, a, i] = pxAt(out, x, y);
        if (a < 8) continue;
        if (y < 76 || x > 78) continue;
        const isCue =
          (r === 60 && g === 19 && b === 0) ||
          (r === 86 && g === 34 && b === 0) ||
          (r === 116 && g === 59 && b === 14) ||
          (r === 237 && g === 168 && b === 93);
        if (!isCue) continue;
        if (!hasNeighborRgb(out, x, y, face[0], face[1], face[2])) continue;
        out[i] = face[0];
        out[i + 1] = face[1];
        out[i + 2] = face[2];
        out[i + 3] = face[3];
      }
    }
  }
  return out;
}

/**
 * Remove o móvel de 3 gavetas (esquerda) da Mesa principal.
 * Mantém tampo + pe T direito; o vão esquerdo fica livre (alfa 0).
 */
function eraseMainCabinet(rgba) {
  const out = Buffer.from(rgba);
  const clear = new Uint8Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const [r, g, b, a] = pxAt(out, x, y);
      if (a < 8) continue;
      // corpo do armário
      if (r === 69 && g === 70 && b === 76) {
        clear[y * SIZE + x] = 1;
        continue;
      }
      // faces/linhas de gaveta só no bloco esquerdo (pe T usa o mesmo tom à direita)
      if (r === 134 && g === 140 && b === 141 && x < 55) {
        clear[y * SIZE + x] = 1;
        continue;
      }
      // coluna de puxadores (x~31) — highlight metal só no móvel
      if (r === 221 && g === 231 && b === 233 && x < 45 && y >= 55 && y <= 80) {
        clear[y * SIZE + x] = 1;
      }
    }
  }
  // contornos pretos colados ao móvel (não ao tampo)
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const idx = y * SIZE + x;
        if (clear[idx]) continue;
        const [r, g, b, a] = pxAt(out, x, y);
        if (a < 8) continue;
        const isOutline =
          (r === 5 && g === 5 && b === 7) || (r === 0 && g === 0 && b === 0);
        if (!isOutline || x > 54) continue;
        let touch = false;
        for (const [nx, ny] of neighbors4(x, y)) {
          if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
          if (clear[ny * SIZE + nx]) {
            touch = true;
            break;
          }
        }
        if (touch) clear[idx] = 1;
      }
    }
  }
  for (let i = 0; i < clear.length; i++) {
    if (!clear[i]) continue;
    const o = i * 4;
    out[o] = 0;
    out[o + 1] = 0;
    out[o + 2] = 0;
    out[o + 3] = 0;
  }
  return out;
}

/**
 * Mantém o bloco de gavetas, mas remove puxadores e tracinhos frontais —
 * face lisa (gavetas abrem para o lado oculto).
 */
function smoothMainCabinet(rgba) {
  const out = Buffer.from(rgba);
  const face = [69, 70, 76, 255];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const [r, g, b, a, i] = pxAt(out, x, y);
      if (a < 8 || x >= 55) continue;
      // faces internas / fiadas das 3 gavetas -> corpo liso
      if (r === 134 && g === 140 && b === 141) {
        out[i] = face[0];
        out[i + 1] = face[1];
        out[i + 2] = face[2];
        out[i + 3] = face[3];
        continue;
      }
      // puxadores (coluna clara no móvel)
      if (r === 221 && g === 231 && b === 233 && y >= 55 && y <= 80) {
        out[i] = face[0];
        out[i + 1] = face[1];
        out[i + 2] = face[2];
        out[i + 3] = face[3];
      }
    }
  }
  return out;
}

function drawDesk1WhiteNoDrawer() {
  return recolorRgba(eraseDesk1Drawer(loadDesk1Rgba()), DESK1_RECOLOR);
}

function drawDesk1WhiteSmoothDrawer() {
  return recolorRgba(smoothDesk1Drawer(loadDesk1Rgba()), DESK1_RECOLOR);
}

function drawMainDeskWhiteNoDrawer() {
  return recolorRgba(eraseMainCabinet(loadMainDeskRgba()), MAIN_DESK_RECOLOR);
}

function drawMainDeskWhiteSmoothDrawer() {
  return recolorRgba(smoothMainCabinet(loadMainDeskRgba()), MAIN_DESK_RECOLOR);
}

/**
 * Suporte de camera: clone do projector-stand (Office/Projector_Stand.png).
 * - madeira -> grafite/preto/cinza (mesma hierarquia de valores)
 * - disco superior um pouco menor (escala ~0.86, isometria preservada)
 * - pernas/pescoco intactos; canvas 128 com o sprite 64 centrado
 */
const STAND_WOOD_TO_GRAPHITE = new Map([
  ['225,174,110', [196, 200, 208, 255]], // tampo claro -> cinza claro
  ['147,85,56', [120, 124, 132, 255]], // madeira mid -> cinza mid
  ['92,56,63', [72, 76, 84, 255]], // madeira escura -> grafite
  ['60,19,0', [36, 38, 46, 255]], // borda madeira -> near-black
  ['24,20,38', [22, 22, 30, 255]], // sombra/contorno original
]);

const STAND_PLATFORM_MAX_Y = 18; // disco superior (analise intrínseca do asset 64x64)
const STAND_PLATFORM_SCALE = 0.86;

function shrinkStandPlatform(rgba, w, h, maxY, scale) {
  const out = Buffer.alloc(rgba.length); // transparente
  // base (pescoco + pernas): copia 1:1
  for (let y = maxY + 1; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      out[i] = rgba[i];
      out[i + 1] = rgba[i + 1];
      out[i + 2] = rgba[i + 2];
      out[i + 3] = rgba[i + 3];
    }
  }

  let minX = w;
  let minY = h;
  let maxX = -1;
  let platMaxY = -1;
  let n = 0;
  let sumX = 0;
  let sumY = 0;
  for (let y = 0; y <= maxY; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (rgba[i + 3] < 16) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > platMaxY) platMaxY = y;
      sumX += x;
      sumY += y;
      n += 1;
    }
  }
  if (n < 8) throw new Error('disco do suporte nao encontrado');
  const cx = sumX / n;
  const cy = sumY / n;

  // Amostra no espaco destino (nearest) para evitar buracos.
  const inv = 1 / scale;
  const margin = Math.ceil(Math.max(maxX - minX, platMaxY - minY) * (1 - scale)) + 2;
  for (let y = minY - margin; y <= platMaxY + margin; y++) {
    for (let x = minX - margin; x <= maxX + margin; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const sx = cx + (x - cx) * inv;
      const sy = cy + (y - cy) * inv;
      const ix = Math.floor(sx + 0.5);
      const iy = Math.floor(sy + 0.5);
      if (iy < 0 || iy > maxY || ix < 0 || ix >= w) continue;
      const si = (iy * w + ix) * 4;
      if (rgba[si + 3] < 16) continue;
      const di = (y * w + x) * 4;
      out[di] = rgba[si];
      out[di + 1] = rgba[si + 1];
      out[di + 2] = rgba[si + 2];
      out[di + 3] = rgba[si + 3];
    }
  }

  // Encaixa o disco de volta no pescoco (evita gap apos encolher).
  let newMaxY = -1;
  for (let y = 0; y <= maxY + margin; y++) {
    for (let x = 0; x < w; x++) {
      if (out[(y * w + x) * 4 + 3] < 16) continue;
      if (y <= maxY && y > newMaxY) newMaxY = y;
    }
  }
  if (newMaxY >= 0 && newMaxY < maxY) {
    const dy = maxY - newMaxY;
    const shifted = Buffer.alloc(out.length);
    // base intacta
    for (let y = maxY + 1; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        shifted[i] = out[i];
        shifted[i + 1] = out[i + 1];
        shifted[i + 2] = out[i + 2];
        shifted[i + 3] = out[i + 3];
      }
    }
    for (let y = 0; y <= maxY; y++) {
      for (let x = 0; x < w; x++) {
        const si = (y * w + x) * 4;
        if (out[si + 3] < 16) continue;
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        const di = (ny * w + x) * 4;
        shifted[di] = out[si];
        shifted[di + 1] = out[si + 1];
        shifted[di + 2] = out[si + 2];
        shifted[di + 3] = out[si + 3];
      }
    }
    return shifted;
  }
  return out;
}

function blitCentered(srcRgba, sw, sh, canvas) {
  const out = Buffer.alloc(canvas * canvas * 4);
  const ox = Math.floor((canvas - sw) / 2);
  const oy = Math.floor((canvas - sh) / 2);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const si = (y * sw + x) * 4;
      if (srcRgba[si + 3] < 8) continue;
      const di = ((oy + y) * canvas + (ox + x)) * 4;
      out[di] = srcRgba[si];
      out[di + 1] = srcRgba[si + 1];
      out[di + 2] = srcRgba[si + 2];
      out[di + 3] = srcRgba[si + 3];
    }
  }
  return out;
}

function drawCameraStandFromProjectorStand() {
  const srcPath = path.join(
    REPO_ROOT,
    'assets-source',
    'tinyhouse-pixel-salvaje',
    'TinyHouse',
    'Office',
    'Projector_Stand.png',
  );
  const { w, h, rgba } = decodeRgbaPng(srcPath);
  if (w !== 64 || h !== 64) throw new Error(`Projector_Stand inesperado: ${w}x${h}`);
  const shrunk = shrinkStandPlatform(rgba, w, h, STAND_PLATFORM_MAX_Y, STAND_PLATFORM_SCALE);
  const graphite = recolorRgba(shrunk, STAND_WOOD_TO_GRAPHITE);
  return blitCentered(graphite, w, h, SIZE);
}

/**
 * Painel iso montado em Wall_R (face NE): arestas verticais + topo/base 2:1.
 * Ancorado no pe tipico da Wall_R (32, ~83) — mesmo espaco do blitPecaParede.
 *
 * span tiles → largura de face = span * 64 (LARGURA_TILE/2)
 * heightPx → altura util da tela/cortica
 */
function createBufWH(w, h) {
  return { w, h, data: Buffer.alloc(w * h * 4) };
}

function setPxWH(buf, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= buf.w || y >= buf.h) return;
  const i = (y * buf.w + x) * 4;
  buf.data[i] = r;
  buf.data[i + 1] = g;
  buf.data[i + 2] = b;
  buf.data[i + 3] = a;
}

function isoStepX(i) {
  return i * 2;
}
function isoStepY(i) {
  return i;
}

function fillIsoQuad(buf, xL, yTop, faceW, faceH, colorFn) {
  // Paralelogramo Wall_R: cada coluna x cai +0.5 px em Y (razao 2:1).
  for (let dx = 0; dx <= faceW; dx++) {
    const x = xL + dx;
    const y0 = yTop + Math.floor(dx / 2);
    const u = dx / Math.max(1, faceW);
    for (let dy = 0; dy < faceH; dy++) {
      const y = y0 + dy;
      const v = dy / Math.max(1, faceH - 1);
      const c = colorFn(u, v, x, y);
      if (c) setPxWH(buf, x, y, c[0], c[1], c[2], c[3] ?? 255);
    }
  }
}

function strokeIsoEdge(buf, xL, yTop, faceW, faceH, r, g, b) {
  for (let dx = 0; dx <= faceW; dx++) {
    const x = xL + dx;
    const y0 = yTop + Math.floor(dx / 2);
    setPxWH(buf, x, y0, r, g, b);
    setPxWH(buf, x, y0 + faceH - 1, r, g, b);
  }
  for (let dy = 0; dy < faceH; dy++) {
    setPxWH(buf, xL, yTop + dy, r, g, b);
    const xR = xL + faceW;
    setPxWH(buf, xR, yTop + Math.floor(faceW / 2) + dy, r, g, b);
  }
}

function drawWallMount(span, heightPx, style) {
  const faceW = span * 64;
  const faceH = heightPx;
  const thick = 5;
  const bezel = style.startsWith('tv') ? 5 : 4;
  const peX = 32;
  const peY = 83;
  const padR = 12;
  const padB = 12;
  const padT = 8;
  // Queda iso 2:1 ao longo da face: +1px Y por +2px X (= faceW/2).
  const isoDrop = Math.floor(faceW / 2);
  // pe ancora o canto inferior-esquerdo da face (como Tv_Off no tile 128).
  const yTopFace = peY - faceH;
  const yTopCap = yTopFace - thick;
  const shiftY = yTopCap < padT ? padT - yTopCap : 0;
  const yFace = yTopFace + shiftY;
  const yCap = yTopCap + shiftY;
  const w = Math.max(128, peX + faceW + padR);
  const h = Math.max(128, yFace + faceH + isoDrop + padB);
  const buf = createBufWH(w, h);
  const xL = peX;

  if (style.startsWith('tv')) {
    const frame = [55, 55, 62];
    const frameHi = [90, 90, 98];
    const frameLo = [28, 28, 32];
    const screen = style === 'tv-war' ? [12, 14, 18] : [18, 18, 22];
    const screenHi = style === 'tv-war' ? [28, 32, 40] : [36, 38, 44];

    for (let t = 0; t < thick; t++) {
      fillIsoQuad(buf, xL, yCap + t, faceW, 1, () => (t === 0 ? frameHi : frame));
    }
    fillIsoQuad(buf, xL, yFace, faceW, faceH, (u, v) => {
      if (u < 0.02 || u > 0.98 || v < 0.03 || v > 0.97) return frame;
      const inset = bezel / faceH;
      if (u < inset || u > 1 - inset || v < inset || v > 1 - inset * 1.2) return frame;
      const glow = Math.max(0, 1 - Math.abs(u + v - 0.85) * 3) * 0.35;
      return [
        Math.min(255, screen[0] + (screenHi[0] - screen[0]) * glow),
        Math.min(255, screen[1] + (screenHi[1] - screen[1]) * glow),
        Math.min(255, screen[2] + (screenHi[2] - screen[2]) * glow),
      ];
    });
    strokeIsoEdge(buf, xL, yFace, faceW, faceH, frameLo[0], frameLo[1], frameLo[2]);
    const midS = Math.floor(faceW / 4);
    const ledX = xL + isoStepX(midS);
    const ledY = yFace + faceH - 3 + isoStepY(midS);
    setPxWH(buf, ledX, ledY, 180, 180, 190);
    setPxWH(buf, ledX + 1, ledY, 140, 140, 150);
    if (style === 'tv-war') {
      for (let i = 0; i < 4; i++) {
        setPxWH(buf, ledX + 8 + i * 2, ledY, 120 + i * 20, 120 + i * 20, 130);
      }
    }
  } else {
    const isWide = style === 'cork-wide';
    const frame = isWide ? [160, 90, 55] : [170, 170, 175];
    const frameLo = isWide ? [90, 50, 30] : [90, 90, 95];
    const cork = isWide ? [168, 130, 95] : [155, 118, 85];
    const corkDark = isWide ? [140, 105, 75] : [130, 98, 70];

    for (let t = 0; t < thick; t++) {
      fillIsoQuad(buf, xL, yCap + t, faceW, 1, () => frame);
    }
    fillIsoQuad(buf, xL, yFace, faceW, faceH, (u, v, x, y) => {
      const insetU = bezel / (faceW / 2);
      const insetV = bezel / faceH;
      if (u < insetU || u > 1 - insetU || v < insetV || v > 1 - insetV) return frame;
      const n = hashNoise(x, y);
      const n2 = hashNoise(x * 3, y * 5);
      if (n > 0.92) return corkDark;
      if (n2 > 0.85) {
        return [
          Math.min(255, cork[0] + 18),
          Math.min(255, cork[1] + 14),
          Math.min(255, cork[2] + 10),
        ];
      }
      return cork;
    });
    strokeIsoEdge(buf, xL, yFace, faceW, faceH, frameLo[0], frameLo[1], frameLo[2]);
    if (style === 'cork-tall') {
      const pins = [
        [0.25, 0.2, 220, 60, 60],
        [0.55, 0.35, 60, 100, 200],
        [0.4, 0.6, 240, 200, 60],
        [0.7, 0.75, 60, 160, 80],
      ];
      for (const [pu, pv, pr, pg, pb] of pins) {
        const s = Math.floor(pu * (faceW / 2));
        const x = xL + isoStepX(s);
        const y = yFace + Math.floor(pv * faceH) + isoStepY(s);
        setPxWH(buf, x, y, pr, pg, pb);
        setPxWH(buf, x + 1, y, pr, pg, pb);
      }
    }
    if (style === 'cork-wide') {
      for (const pv of [0.28, 0.5, 0.72]) {
        const paperH = 6;
        const y0 = Math.floor(pv * faceH);
        fillIsoQuad(buf, xL + 10, yFace + y0, faceW - 24, paperH, (u, v) => {
          if (u < 0.05 || u > 0.95) return null;
          return v < 0.15 ? [230, 225, 210] : [245, 240, 225];
        });
      }
    }
  }

  return { buf: buf.data, w: buf.w, h: buf.h };
}

function writeAsset(fileName, buf, sizeOrW = SIZE, height) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const abs = path.join(OUT_DIR, fileName);
  const w = sizeOrW;
  const h = height == null ? sizeOrW : height;
  fs.writeFileSync(abs, encodePngRGBA(w, h, buf));
  return abs;
}

function copyExternalPng(srcAbs, destName) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const abs = path.join(OUT_DIR, destName);
  fs.copyFileSync(srcAbs, abs);
  return abs;
}

function main() {
  const deskFile = 'Desk_White_Plastic.png';
  const metalFile = 'Desk_Metal.png';
  const desk1NoDrawerFile = 'Desk1_White_Plastic_NoDrawer.png';
  const desk1SmoothFile = 'Desk1_White_Plastic_SmoothDrawer.png';
  const mainNoDrawerFile = 'MainDesk_White_Plastic_NoDrawer.png';
  const mainSmoothFile = 'MainDesk_White_Plastic_SmoothDrawer.png';
  const rugFile = 'Rug_White_Fabric.png';
  const cameraFile = 'Cinema_Camera.png';
  const cameraProFile = 'Cinema_Camera_Pro.png';
  const standFile = 'Camera_Stand.png';

  writeAsset(deskFile, drawWhiteDeskFromCoffeeTable());
  writeAsset(metalFile, drawMetalDeskFromCoffeeTable());
  writeAsset(desk1NoDrawerFile, drawDesk1WhiteNoDrawer());
  writeAsset(desk1SmoothFile, drawDesk1WhiteSmoothDrawer());
  writeAsset(mainNoDrawerFile, drawMainDeskWhiteNoDrawer());
  writeAsset(mainSmoothFile, drawMainDeskWhiteSmoothDrawer());
  writeAsset(rugFile, drawWhiteRug());
  writeAsset(standFile, drawCameraStandFromProjectorStand());

  const cameraSrc = process.env.CREATED_CAMERA_PNG;
  const cameraProSrc = process.env.CREATED_CAMERA_PRO_PNG;
  if (cameraSrc && fs.existsSync(cameraSrc)) copyExternalPng(cameraSrc, cameraFile);
  if (cameraProSrc && fs.existsSync(cameraProSrc)) copyExternalPng(cameraProSrc, cameraProFile);

  // Calibra cameras (escala projetor; preserva orientacao da fonte).
  const calibScript = path.join(__dirname, 'calibrar-created-assets.mjs');
  if (
    fs.existsSync(calibScript) &&
    (fs.existsSync(path.join(OUT_DIR, cameraFile)) ||
      fs.existsSync(path.join(OUT_DIR, cameraProFile)))
  ) {
    const r = spawnSync(process.execPath, [calibScript], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    if (r.stdout) process.stdout.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);
    if (r.status !== 0) throw new Error('calibrar-created-assets falhou');
  }

  const assets = [
    {
      assetId: 'created-desk-white-plastic',
      kind: 'coffee',
      nome: 'Mesa centro branca plastico',
      fileName: `created/${deskFile}`,
      papel: 'prop',
      uso: 'aleatorio',
      origem: 'create',
      baseAssetId: 'living-table-10',
    },
    {
      assetId: 'created-desk-metal',
      kind: 'coffee',
      nome: 'Mesa centro metal',
      fileName: `created/${metalFile}`,
      papel: 'prop',
      uso: 'aleatorio',
      origem: 'create',
      baseAssetId: 'living-table-10',
      interativo: {
        acao: 'popup',
        titulo: 'Teste de design',
        corpo: 'Teste de design',
      },
    },
    {
      assetId: 'created-desk1-white-no-drawer',
      kind: 'desk',
      nome: 'Mesa alternativa branca (sem gaveta)',
      fileName: `created/${desk1NoDrawerFile}`,
      papel: 'prop',
      uso: 'aleatorio',
      origem: 'create',
      baseAssetId: 'desk-1',
      notas: 'Desk_1 embranquecida (plastico); gaveta removida.',
    },
    {
      assetId: 'created-desk1-white-smooth-drawer',
      kind: 'desk',
      nome: 'Mesa alternativa branca (gaveta lateral)',
      fileName: `created/${desk1SmoothFile}`,
      papel: 'prop',
      uso: 'aleatorio',
      origem: 'create',
      baseAssetId: 'desk-1',
      notas: 'Desk_1 embranquecida; caixa da gaveta lisa (abre para o lado oculto).',
    },
    {
      assetId: 'created-maindesk-white-no-drawer',
      kind: 'desk',
      nome: 'Mesa principal branca (sem gaveta)',
      fileName: `created/${mainNoDrawerFile}`,
      papel: 'prop',
      uso: 'aleatorio',
      origem: 'create',
      baseAssetId: 'office-main-table',
      notas: 'Office_Main_Table embranquecida; móvel de gavetas removido.',
    },
    {
      assetId: 'created-maindesk-white-smooth-drawer',
      kind: 'desk',
      nome: 'Mesa principal branca (gaveta lateral)',
      fileName: `created/${mainSmoothFile}`,
      papel: 'prop',
      uso: 'aleatorio',
      origem: 'create',
      baseAssetId: 'office-main-table',
      notas: 'Office_Main_Table embranquecida; bloco de gavetas liso (abre para o lado oculto).',
    },
    {
      assetId: 'created-rug-white-fabric',
      kind: 'rug',
      nome: 'Tapete branco tecido',
      fileName: `created/${rugFile}`,
      papel: 'prop',
      uso: 'aleatorio',
      origem: 'create',
    },
  ];

  if (fs.existsSync(path.join(OUT_DIR, cameraFile))) {
    assets.push({
      assetId: 'created-cinema-camera',
      kind: 'lamp',
      nome: 'Camera de filmagem',
      fileName: `created/${cameraFile}`,
      papel: 'prop',
      uso: 'aleatorio',
      origem: 'create',
      baseAssetId: 'office-projector',
    });
  }
  if (fs.existsSync(path.join(OUT_DIR, cameraProFile))) {
    assets.push({
      assetId: 'created-cinema-camera-pro',
      kind: 'lamp',
      nome: 'Camera de cinema',
      fileName: `created/${cameraProFile}`,
      papel: 'prop',
      uso: 'aleatorio',
      origem: 'create',
      baseAssetId: 'office-projector',
    });
  }
  assets.push({
    assetId: 'created-camera-stand',
    kind: 'lamp',
    nome: 'Suporte camera',
    fileName: `created/${standFile}`,
    papel: 'prop',
    uso: 'aleatorio',
    origem: 'create',
    baseAssetId: 'projector-stand',
  });

  // --- Painéis de parede XL (TV / cortiça) ---------------------------------
  const wallMounts = [
    {
      assetId: 'created-wall-tv-3x',
      fileName: 'Wall_TV_3x100.png',
      nome: 'TV de parede 3×100',
      kind: 'board',
      baseAssetId: 'office-tv-off',
      span: 3,
      heightPx: 100,
      style: 'tv',
      notas: 'Replica TV de parede TinyHouse em escala Lab: 3 tiles × 100px.',
    },
    {
      assetId: 'created-wall-tv-4x',
      fileName: 'Wall_TV_4x100.png',
      nome: 'TV de parede 4×100',
      kind: 'board',
      baseAssetId: 'office-tv-off',
      span: 4,
      heightPx: 100,
      style: 'tv',
      notas: 'Replica TV de parede TinyHouse em escala Lab: 4 tiles × 100px.',
    },
    {
      assetId: 'created-wall-tv-war',
      fileName: 'Wall_TV_War_6x120.png',
      nome: 'TV war room 6×120',
      kind: 'board',
      baseAssetId: 'big-tv-off',
      span: 6,
      heightPx: 120,
      style: 'tv-war',
      notas: 'TV panorâmica de war room (inspirada na BigTV), 6 tiles × 120px.',
    },
    {
      assetId: 'created-cork-wide',
      fileName: 'Wall_Cork_Wide_3x72.png',
      nome: 'Cortica panoramica 3×72',
      kind: 'board',
      baseAssetId: 'corkboard-2',
      span: 3,
      heightPx: 72,
      style: 'cork-wide',
      notas: 'Cortiça larga para murais/agenda (Cortica 2), 3 tiles × 72px.',
    },
    {
      assetId: 'created-cork-tall',
      fileName: 'Wall_Cork_Tall_2x110.png',
      nome: 'Cortica mural 2×110',
      kind: 'board',
      baseAssetId: 'corkboard',
      span: 2,
      heightPx: 110,
      style: 'cork-tall',
      notas: 'Cortiça alta para avisos empilhados (Cortica), 2 tiles × 110px.',
    },
  ];

  for (const m of wallMounts) {
    const { buf, w, h } = drawWallMount(m.span, m.heightPx, m.style);
    writeAsset(m.fileName, buf, w, h);
    assets.push({
      assetId: m.assetId,
      kind: m.kind,
      nome: m.nome,
      fileName: `created/${m.fileName}`,
      papel: 'wall',
      uso: 'aleatorio',
      origem: 'create',
      baseAssetId: m.baseAssetId,
      span: m.span,
      heightPx: m.heightPx,
      notas: m.notas,
    });
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const doc = {
    versao: '1.3',
    data: hoje,
    notas:
      'Assets gerados proceduralmente (aba Create). fileName com prefixo created/ aponta para assets-source/tradeclass-created/. Mesas centro = recolor Table_10. Mesas alternativa/principal = embranquecimento Desk_1 / Office_Main_Table (±gaveta). Cameras vs projetor. Painéis de parede XL (TV/cortiça) com span×heightPx.',
    assets,
  };
  fs.writeFileSync(JSON_PATH, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  console.log('[create] PNGs ->', path.relative(REPO_ROOT, OUT_DIR));
  console.log('[create] JSON ->', path.relative(REPO_ROOT, JSON_PATH));
  console.log('[create] assets:', doc.assets.map((a) => a.assetId).join(', '));
}

main();
