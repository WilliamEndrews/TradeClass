/**
 * Primitivas de desenho isometrico do palco TinyTraderLab.
 * ORIGEM e mutavel (encaixarPalco / withOrigem*); o lab importa e compartilha.
 */

export const LARGURA_TILE = 128;
export const ALTURA_TILE = 64;
export const ORIGEM = { x: 360, y: 90 };
export const ORIGEM_COMPOSE = { x: 360, y: 90 };
export const COMPOSE_ORIGEM = ORIGEM_COMPOSE;

export function iso(gx, gy) {
  return { x: ((gx - gy) * LARGURA_TILE) / 2, y: ((gx + gy) * ALTURA_TILE) / 2 };
}

export function telaParaGrade(px, py, subdiv) {
  const x = px - ORIGEM.x;
  const y = py - ORIGEM.y;
  const gxF = (x / (LARGURA_TILE / 2) + y / (ALTURA_TILE / 2)) / 2;
  const gyF = (y / (ALTURA_TILE / 2) - x / (LARGURA_TILE / 2)) / 2;
  const gx = Math.floor(gxF);
  const gy = Math.floor(gyF);
  if (!subdiv) return { gx, gy, qx: 0, qy: 0 };
  return {
    gx,
    gy,
    qx: gxF - gx >= 0.5 ? 1 : 0,
    qy: gyF - gy >= 0.5 ? 1 : 0,
  };
}

export function origemDoItem(p) {
  const passo = p.passo == null ? 1 : p.passo;
  const qx = p.qx || 0;
  const qy = p.qy || 0;
  return { ox: p.gx + qx * passo, oy: p.gy + qy * passo, passo };
}

/** Ancora de tela da celula (centro do diamante) — referencia do checkpoint dx/dy. */
export function ancoraTelaCelula(gx, gy) {
  const c = iso(gx + 0.5, gy + 0.5);
  return { x: ORIGEM.x + c.x, y: ORIGEM.y + c.y };
}

/** Offset em px do ponto ate a ancora da celula (mesmo espaco das paredes). */
export function offsetPisoDoPonto(px, py, gx, gy) {
  const a = ancoraTelaCelula(gx, gy);
  return { dx: Math.round(px - a.x), dy: Math.round(py - a.y) };
}

export function chaveSlot(p) {
  return p.gx + ',' + p.gy + ',' + (p.qx || 0) + ',' + (p.qy || 0);
}

export function mesmaCelula(a, b) {
  return a.gx === b.gx && a.gy === b.gy;
}

export function mesmoSlot(a, b) {
  return chaveSlot(a) === chaveSlot(b);
}

export function medirBbox(img) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, c.width, c.height).data;
  let minX = c.width;
  let minY = c.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (data[(y * c.width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { x: 0, y: 0, w: c.width, h: c.height };
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

export function silhuetaChao(img) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, c.width, c.height).data;
  const pes = [];
  for (let x = 0; x < c.width; x++) {
    let maxY = -1;
    for (let y = 0; y < c.height; y++) {
      if (data[(y * c.width + x) * 4 + 3] > 8) maxY = y;
    }
    if (maxY >= 0) pes.push({ x, y: maxY });
  }
  return pes;
}

export function peExtremo(pes, lado) {
  if (!pes.length) return { x: 64, y: 36 };
  return lado === 'dir' ? pes[pes.length - 1] : pes[0];
}

export function blitTile(ctx, img, gx, gy, ancora, tam) {
  const passo = tam == null ? 1 : tam;
  const c = iso(gx + passo / 2, gy + passo / 2);
  const x = ORIGEM.x + c.x - ancora.x;
  const y = ORIGEM.y + c.y - ancora.y;
  ctx.drawImage(img, x, y);
  return { x, y };
}

export function blitNoPe(ctx, img, telaX, telaY, pe, scaleY) {
  const sy = scaleY == null || !(scaleY > 0) ? 1 : scaleY;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const peY = pe.y * sy;
  const x = telaX - pe.x;
  const y = telaY - peY;
  if (sy === 1) {
    ctx.drawImage(img, x, y);
  } else {
    ctx.drawImage(img, 0, 0, iw, ih, x, y, iw, ih * sy);
  }
  return { x, y, tela: { x: telaX, y: telaY }, scaleY: sy, espelhado: false };
}

/**
 * Blit ancorado no pe com reflexao horizontal (Wall_R → Wall_L).
 * Pixel (pe.x, pe.y) permanece no vertice; o resto espelha em X.
 */
export function blitNoPeEspelhado(ctx, img, telaX, telaY, pe) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  ctx.save();
  ctx.translate(telaX, telaY);
  ctx.scale(-1, 1);
  ctx.drawImage(img, -pe.x, -pe.y);
  ctx.restore();
  // Top-left do canvas da imagem no espaco de tela (apos flip).
  const x = telaX + pe.x - iw;
  const y = telaY - pe.y;
  return { x, y, tela: { x: telaX, y: telaY }, espelhado: true, iw, ih };
}

/** Ancora no pe; fatia [y0,y1) — opcionalmente espelhada em X. */
export function blitNoPeFatia(ctx, img, telaX, telaY, pe, y0, y1) {
  const iw = img.naturalWidth || img.width;
  const x = telaX - pe.x;
  const y = telaY - pe.y + y0;
  ctx.drawImage(img, 0, y0, iw, y1 - y0, x, y, iw, y1 - y0);
  return { x, y, tela: { x: telaX, y: telaY } };
}

export function blitNaVertice(ctx, img, vx, vy, pe, scaleY) {
  const v = iso(vx, vy);
  return blitNoPe(ctx, img, ORIGEM.x + v.x, ORIGEM.y + v.y, pe, scaleY);
}

export function blitNaVerticeEspelhado(ctx, img, vx, vy, pe) {
  const v = iso(vx, vy);
  return blitNoPeEspelhado(ctx, img, ORIGEM.x + v.x, ORIGEM.y + v.y, pe);
}

export function blitNaVerticeFatia(ctx, img, vx, vy, pe, y0, y1) {
  const v = iso(vx, vy);
  return blitNoPeFatia(ctx, img, ORIGEM.x + v.x, ORIGEM.y + v.y, pe, y0, y1);
}

/**
 * Linha onde termina o capo iso do tile de parede: primeira linha (do topo)
 * cuja largura opaca atinge a largura maxima (face de largura constante).
 * O passo de empilhamento sem emenda e pe.y - topoFace + 1.
 */
export function topoFaceParede(img, bbox) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, c.width, c.height).data;
  for (let y = bbox.y; y < bbox.y + bbox.h; y++) {
    let n = 0;
    for (let x = bbox.x; x < bbox.x + bbox.w; x++) {
      if (data[(y * c.width + x) * 4 + 3] > 8) n++;
    }
    if (n >= bbox.w - 1) return y;
  }
  return bbox.y;
}

/**
 * Faixa repetivel da face da parede, sem as linhas de sombra do capo.
 * O tile tem um gradiente de sombra logo abaixo do capo (linhas com mais
 * pixels escuros que o baseline da face). Repetir essas linhas cria
 * "serrilhado" horizontal em cada emenda do empilhamento.
 *
 * Retorna { topo, limpo, passo }:
 *  - topo:  primeira linha de largura maxima (fim do capo)
 *  - limpo: primeira linha da face sem sombra extra (inicio da fatia repetida)
 *  - passo: peY - limpo + 1 (distancia vertical entre niveis empilhados)
 */
export function faixaFaceParede(img, bbox, peY) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, c.width, c.height).data;
  const W = c.width;
  const escuros = (y) => {
    let n = 0;
    for (let x = bbox.x; x < bbox.x + bbox.w; x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] > 200 && data[i] + data[i + 1] + data[i + 2] < 400) n++;
    }
    return n;
  };
  let topo = bbox.y;
  for (let y = bbox.y; y < bbox.y + bbox.h; y++) {
    let n = 0;
    for (let x = bbox.x; x < bbox.x + bbox.w; x++) {
      if (data[(y * W + x) * 4 + 3] > 8) n++;
    }
    if (n >= bbox.w - 1) { topo = y; break; }
  }
  const meio = Math.floor((topo + peY) / 2);
  const baseline = escuros(meio);
  let limpo = topo;
  for (let y = topo; y <= peY; y++) {
    if (escuros(y) <= baseline) { limpo = y; break; }
  }
  return { topo, limpo, passo: Math.max(8, peY - limpo + 1) };
}

export function blitObjeto(ctx, img, bbox, gx, gy) {
  const c = iso(gx + 0.5, gy + 0.5);
  const x = ORIGEM.x + c.x - (bbox.x + bbox.w / 2);
  const y = ORIGEM.y + c.y - (bbox.y + bbox.h);
  ctx.drawImage(img, x, y);
}

export function specDoItem(spec, cal) {
  const mapa = (cal && cal.objetos) || {};
  return mapa[spec.kind] || mapa[spec.assetId] || null;
}

export function marcarPe(ctx, tela) {
  ctx.strokeStyle = '#7fff00';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(tela.x + 0.5, tela.y + 0.5, 4, 0, Math.PI * 2);
  ctx.stroke();
}

export function blitCatalogo(ctx, img, bbox, spec, item, cal, diagnostico) {
  const dx = (item && item.dx) || 0;
  const dy = (item && item.dy) || 0;
  const draw = () => {
    const o = specDoItem(spec, cal);
    const { ox, oy, passo } = origemDoItem(item);
    if (o && o.modo === 'canto' && o.pe) {
      const r = blitNaVertice(ctx, img, ox, oy, o.pe);
      if (diagnostico) {
        ctx.strokeStyle = 'rgba(255, 80, 200, 0.9)';
        ctx.strokeRect(r.x + bbox.x, r.y + bbox.y, bbox.w, bbox.h);
        marcarPe(ctx, r.tela);
      }
      return;
    }
    if (o && o.modo === 'centro' && o.ancora) {
      const r = blitTile(ctx, img, ox, oy, o.ancora, passo);
      if (diagnostico) {
        ctx.strokeStyle = 'rgba(255, 80, 200, 0.9)';
        ctx.strokeRect(r.x + bbox.x, r.y + bbox.y, bbox.w, bbox.h);
        const c = iso(ox + passo / 2, oy + passo / 2);
        marcarPe(ctx, { x: ORIGEM.x + c.x, y: ORIGEM.y + c.y });
      }
      return;
    }
    blitObjeto(ctx, img, bbox, ox, oy);
  };
  if (dx || dy) withOrigemOffset(dx, dy, draw);
  else draw();
}

export function losango(ctx, gx, gy, cor, preencher, tam) {
  const passo = tam == null ? 1 : tam;
  const pts = [iso(gx, gy), iso(gx + passo, gy), iso(gx + passo, gy + passo), iso(gx, gy + passo)];
  ctx.beginPath();
  ctx.moveTo(ORIGEM.x + pts[0].x, ORIGEM.y + pts[0].y);
  for (let i = 1; i < 4; i++) ctx.lineTo(ORIGEM.x + pts[i].x, ORIGEM.y + pts[i].y);
  ctx.closePath();
  if (preencher) {
    ctx.fillStyle = preencher;
    ctx.fill();
  }
  ctx.strokeStyle = cor;
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function perimetroGrade(ctx, w, h) {
  const pts = [iso(0, 0), iso(w, 0), iso(w, h), iso(0, h)];
  ctx.beginPath();
  ctx.moveTo(ORIGEM.x + pts[0].x, ORIGEM.y + pts[0].y);
  for (let i = 1; i < 4; i++) ctx.lineTo(ORIGEM.x + pts[i].x, ORIGEM.y + pts[i].y);
  ctx.closePath();
  ctx.strokeStyle = '#f5d76e';
  ctx.lineWidth = 2;
  ctx.stroke();
}

export function encaixarPalco(canvas, w, h, andares, subida, alturaParede, passoParede) {
  const pts = [iso(0, 0), iso(w, 0), iso(w, h), iso(0, h)];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  // Parede mais alta = tiles empilhados 1:1; sobe (niveis-1) passos de face.
  const niveis = Math.max(1, Math.round(alturaParede == null ? 1 : alturaParede));
  const passo = passoParede || subida || 0;
  const wallExtra = (niveis - 1) * passo;
  const padX = 56;
  const padTop = 100 + wallExtra + Math.max(0, (andares || 1) - 1) * (subida || 0);
  const padBottom = 40;
  const needW = Math.ceil(maxX - minX + padX * 2);
  const needH = Math.ceil(maxY - minY + padTop + padBottom);
  // Grades grandes (ate 24x24) precisam de canvas amplo.
  canvas.width = Math.max(720, Math.min(4200, needW));
  canvas.height = Math.max(520, Math.min(2800, needH));
  ORIGEM.x = Math.round((canvas.width - (minX + maxX)) / 2);
  ORIGEM.y = Math.round(padTop - minY);
}

export function thumb(img, bbox, w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#222';
  g.fillRect(0, 0, w, h);
  if (!img || !bbox) return c;
  const escala = Math.min(w / bbox.w, h / bbox.h) * 0.9;
  const dw = bbox.w * escala;
  const dh = bbox.h * escala;
  g.drawImage(img, bbox.x, bbox.y, bbox.w, bbox.h, (w - dw) / 2, (h - dh) / 2, dw, dh);
  return c;
}

export function withOrigemOffset(dx, dy, fn) {
  ORIGEM.x += dx || 0;
  ORIGEM.y += dy || 0;
  try {
    fn();
  } finally {
    ORIGEM.x -= dx || 0;
    ORIGEM.y -= dy || 0;
  }
}

export function withOrigemAbs(x, y, fn) {
  const ox = ORIGEM.x;
  const oy = ORIGEM.y;
  ORIGEM.x = x;
  ORIGEM.y = y;
  try {
    fn();
  } finally {
    ORIGEM.x = ox;
    ORIGEM.y = oy;
  }
}
