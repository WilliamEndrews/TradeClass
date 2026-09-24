/**
 * RENDERER TOP-DOWN MVP — retangulos para salas, mesas e cadeiras.
 * Mesmo WorldSnapshot / contrato de pick que o iso. Pensado para mobile.
 */

import type { OfficeLayout, WorldDelta, WorldSnapshot } from '@tradeclass/contracts';
import { blitCandles, gerarSerieOHLCV } from './ohlcv-mock';
import type { SelecaoAlvo } from './selection';

export interface RendererHandle {
  push(frame: WorldSnapshot | WorldDelta): void;
  select(alvo: SelecaoAlvo | string | null): void;
  focusAgent(agentId: string | null): void;
  resetCamera(): void;
  onPick(cb: (alvo: SelecaoAlvo | null) => void): void;
  getViewTransform(): {
    origemCena: { x: number; y: number };
    escala: number;
    cenaParaCss: (x: number, y: number) => { x: number; y: number };
  };
  destroy(): void;
}

const CELL = 28;
const CORES = {
  fundo: '#070b09',
  corredor: '#121a17',
  sala: '#1a2822',
  desk: '#c4a35a',
  board: '#5eb8a0',
  chair: '#3a4a44',
  ator: '#7dba7a',
  sel: '#c4a35a',
  wallMedia: '#2a3a34',
};

function normalizarSelecao(alvo: SelecaoAlvo | string | null): SelecaoAlvo | null {
  if (!alvo) return null;
  if (typeof alvo === 'string') return { kind: 'agent', id: alvo };
  return alvo;
}

export async function criarRendererTopDown(
  canvas: HTMLCanvasElement,
  layout: OfficeLayout,
): Promise<RendererHandle> {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D indisponivel.');

  const palco = canvas.parentElement ?? canvas;
  let dpr = 1;
  let quadro: WorldSnapshot | WorldDelta | null = null;
  let selecionado: SelecaoAlvo | null = null;
  let vivo = true;
  let raf = 0;
  let pickCb: ((alvo: SelecaoAlvo | null) => void) | null = null;
  let panX = 20;
  let panY = 20;
  let zoom = 1;
  let arrastando = false;
  let dragSX = 0;
  let dragSY = 0;
  let dragPX = 0;
  let dragPY = 0;
  let moveu = false;

  // Cache de previews de chart
  const previewCache = new Map<string, HTMLCanvasElement>();
  for (const wm of layout.wallMedia ?? []) {
    if (wm.kind !== 'chart' || !wm.seriesId) continue;
    const off = document.createElement('canvas');
    off.width = 64;
    off.height = 32;
    const octx = off.getContext('2d');
    if (octx) {
      blitCandles(octx, gerarSerieOHLCV(wm.seriesId, 24), 64, 32);
      previewCache.set(wm.mediaId, off);
    }
  }

  const ajustar = (): void => {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, palco.clientWidth);
    const h = Math.max(1, palco.clientHeight);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  };
  ajustar();
  const observador = new ResizeObserver(ajustar);
  observador.observe(palco);

  const mundoParaTela = (gx: number, gy: number): { x: number; y: number } => ({
    x: panX + gx * CELL * zoom,
    y: panY + gy * CELL * zoom,
  });

  const telaParaMundo = (sx: number, sy: number): { x: number; y: number } => ({
    x: (sx - panX) / (CELL * zoom),
    y: (sy - panY) / (CELL * zoom),
  });

  const pickEm = (sx: number, sy: number): SelecaoAlvo | null => {
    const m = telaParaMundo(sx, sy);
    const gx = Math.floor(m.x);
    const gy = Math.floor(m.y);

    if (quadro) {
      for (const a of quadro.actors) {
        if (Math.hypot(a.x + 0.5 - m.x, a.y + 0.5 - m.y) < 0.55) {
          return { kind: 'agent', id: a.agentId };
        }
      }
    }

    for (const wm of layout.wallMedia ?? []) {
      const sw = wm.size?.w ?? 2;
      const sh = wm.size?.h ?? 1;
      if (gx >= wm.cell.x && gx < wm.cell.x + sw && gy >= wm.cell.y && gy < wm.cell.y + sh) {
        return { kind: 'wallMedia', id: wm.mediaId };
      }
    }

    for (const p of layout.props) {
      if (p.kind !== 'desk' && p.kind !== 'board' && p.kind !== 'chair') continue;
      const fw = p.footprint?.w ?? 1;
      const fh = p.footprint?.h ?? 1;
      if (gx >= p.cell.x && gx < p.cell.x + fw && gy >= p.cell.y && gy < p.cell.y + fh) {
        if (p.kind === 'desk') return { kind: 'desk', id: p.propId };
        if (p.kind === 'board') return { kind: 'board', id: p.propId };
      }
    }
    return null;
  };

  const onPointerDown = (e: PointerEvent): void => {
    arrastando = true;
    moveu = false;
    dragSX = e.clientX;
    dragSY = e.clientY;
    dragPX = panX;
    dragPY = panY;
    canvas.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent): void => {
    if (!arrastando) return;
    const dx = e.clientX - dragSX;
    const dy = e.clientY - dragSY;
    if (Math.hypot(dx, dy) > 4) moveu = true;
    panX = dragPX + dx;
    panY = dragPY + dy;
  };
  const onPointerUp = (e: PointerEvent): void => {
    arrastando = false;
    canvas.releasePointerCapture(e.pointerId);
    if (moveu) return;
    const rect = canvas.getBoundingClientRect();
    const alvo = pickEm(e.clientX - rect.left, e.clientY - rect.top);
    selecionado = alvo;
    pickCb?.(alvo);
  };
  const onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    zoom = Math.max(0.5, Math.min(2.5, zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  const laco = (): void => {
    if (!vivo) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;
    ctx.fillStyle = CORES.fundo;
    ctx.fillRect(0, 0, cssW, cssH);

    // Corredores
    ctx.fillStyle = CORES.corredor;
    for (const c of layout.corridors) {
      const p = mundoParaTela(c.x, c.y);
      ctx.fillRect(p.x, p.y, CELL * zoom - 1, CELL * zoom - 1);
    }

    // Salas
    for (const r of layout.rooms) {
      const p0 = mundoParaTela(r.rect.x0, r.rect.y0);
      const w = (r.rect.x1 - r.rect.x0) * CELL * zoom;
      const h = (r.rect.y1 - r.rect.y0) * CELL * zoom;
      ctx.fillStyle = CORES.sala;
      ctx.fillRect(p0.x, p0.y, w, h);
      ctx.strokeStyle = '#2a3a34';
      ctx.strokeRect(p0.x, p0.y, w, h);
    }

    // Wall media
    for (const wm of layout.wallMedia ?? []) {
      const sw = (wm.size?.w ?? 2) * CELL * zoom;
      const sh = (wm.size?.h ?? 1) * CELL * zoom;
      const p = mundoParaTela(wm.cell.x, wm.cell.y);
      const preview = previewCache.get(wm.mediaId);
      if (preview) {
        ctx.drawImage(preview, p.x, p.y, sw, sh);
      } else {
        ctx.fillStyle = CORES.wallMedia;
        ctx.fillRect(p.x, p.y, sw, sh);
      }
      if (selecionado?.kind === 'wallMedia' && selecionado.id === wm.mediaId) {
        ctx.strokeStyle = CORES.sel;
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x, p.y, sw, sh);
      }
    }

    // Props
    for (const prop of layout.props) {
      if (prop.kind !== 'desk' && prop.kind !== 'board' && prop.kind !== 'chair') continue;
      const fw = (prop.footprint?.w ?? 1) * CELL * zoom;
      const fh = (prop.footprint?.h ?? 1) * CELL * zoom;
      const p = mundoParaTela(prop.cell.x, prop.cell.y);
      ctx.fillStyle =
        prop.kind === 'desk' ? CORES.desk
        : prop.kind === 'board' ? CORES.board
        : CORES.chair;
      ctx.fillRect(p.x + 2, p.y + 2, fw - 4, fh - 4);
      const selKind = prop.kind === 'desk' ? 'desk' : prop.kind === 'board' ? 'board' : null;
      if (selKind && selecionado?.kind === selKind && selecionado.id === prop.propId) {
        ctx.strokeStyle = CORES.sel;
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x + 1, p.y + 1, fw - 2, fh - 2);
      }
    }

    // Atores
    if (quadro) {
      for (const a of quadro.actors) {
        const p = mundoParaTela(a.x, a.y);
        const r = 6 * zoom;
        ctx.fillStyle = CORES.ator;
        ctx.beginPath();
        ctx.arc(p.x + CELL * zoom * 0.5, p.y + CELL * zoom * 0.5, r, 0, Math.PI * 2);
        ctx.fill();
        if (selecionado?.kind === 'agent' && selecionado.id === a.agentId) {
          ctx.strokeStyle = CORES.sel;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }

    raf = requestAnimationFrame(laco);
  };
  raf = requestAnimationFrame(laco);

  return {
    push: (f) => { quadro = f; },
    select: (alvo) => { selecionado = normalizarSelecao(alvo); },
    focusAgent: () => {},
    resetCamera: () => { panX = 20; panY = 20; zoom = 1; },
    onPick: (cb) => { pickCb = cb; },
    getViewTransform: () => ({
      origemCena: { x: 0, y: 0 },
      escala: zoom,
      cenaParaCss: (x, y) => ({ x: panX + x * zoom, y: panY + y * zoom }),
    }),
    destroy: () => {
      vivo = false;
      cancelAnimationFrame(raf);
      observador.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
    },
  };
}
