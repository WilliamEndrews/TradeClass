/**
 * Overlay de midia na parede: image (homografia), iframe (matrix3d), hybrid.
 * Encaixa nos 4 cantos UV da tela + blend Screen (Photoshop-like).
 */
import { useEffect, useRef } from 'react';
import type { WallMedia } from '@tradeclass/contracts';
import { CALIBRACAO_PADRAO } from '@tradeclass/world-engine';
import {
  aabbDoQuad,
  cssBlendMode,
  gradeApartirCantos,
  homografiaMatrix3d,
  pontoEmPoligono,
  quadrilateroTelaWallMedia,
  resolverCantosTela,
  resolverDisplay,
  urlPareceImagem,
  type QuadTela,
} from '@tradeclass/iso-office';

export type ViewTransform = {
  origemCena: { x: number; y: number };
  cenaParaCss: (x: number, y: number) => { x: number; y: number };
  escala: number;
};

type Props = {
  midias: readonly WallMedia[];
  getTransform: () => ViewTransform | null;
  selecionadoId?: string | null;
  /** Clique em hybrid / painel — sobe URL para o painel lateral. */
  onHybridOpen?: (wm: WallMedia) => void;
};

const CONTENT_W = 320;
const CONTENT_H = 180;

type Slot = {
  wm: WallMedia;
  mode: 'image' | 'iframe' | 'hybrid';
  root: HTMLDivElement;
  content: HTMLElement; // img | iframe | canvas
  srcW: number;
  srcH: number;
};

function mapQuad(tr: ViewTransform, q: QuadTela): QuadTela {
  const map = (p: { x: number; y: number }) =>
    tr.cenaParaCss(tr.origemCena.x + p.x, tr.origemCena.y + p.y);
  return { tl: map(q.tl), tr: map(q.tr), br: map(q.br), bl: map(q.bl) };
}

function clipPathQuad(q: QuadTela): string {
  return `polygon(${q.tl.x}px ${q.tl.y}px, ${q.tr.x}px ${q.tr.y}px, ${q.br.x}px ${q.br.y}px, ${q.bl.x}px ${q.bl.y}px)`;
}

function blendCss(wm: WallMedia): string {
  return cssBlendMode(wm.blendMode);
}

/** Desenha imagem warpeada na grade (triangulos) no canvas em coords CSS absolutas. */
function desenharWarpCanvas(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  cssQuad: QuadTela,
  corners: ReturnType<typeof resolverCantosTela>['corners'],
  warpGrid: ReturnType<typeof resolverCantosTela>['warpGrid'],
  hostW: number,
  hostH: number,
): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.ceil(hostW * dpr) || canvas.height !== Math.ceil(hostH * dpr)) {
    canvas.width = Math.ceil(hostW * dpr);
    canvas.height = Math.ceil(hostH * dpr);
    canvas.style.width = `${hostW}px`;
    canvas.style.height = `${hostH}px`;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx || !img.complete || img.naturalWidth === 0) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, hostW, hostH);

  const grid = warpGrid ?? gradeApartirCantos(corners, 3, 3);
  const { cols, rows, points } = grid;
  if (points.length < cols * rows) return;

  // Destino: bilinear dos 4 cantos CSS pela posicao (i/(cols-1), j/(rows-1))
  // OU usa UV dos points mapeados no bbox do sprite → interpolar no cssQuad.
  // Simplificacao: points sao UV no sprite; mapeamos UV→css via bilinear no cssQuad
  // relativo aos corners UV do nest.
  const cu0 = Math.min(corners.tl.u, corners.bl.u, corners.tr.u, corners.br.u);
  const cu1 = Math.max(corners.tl.u, corners.bl.u, corners.tr.u, corners.br.u);
  const cv0 = Math.min(corners.tl.v, corners.bl.v, corners.tr.v, corners.br.v);
  const cv1 = Math.max(corners.tl.v, corners.bl.v, corners.tr.v, corners.br.v);
  const du = Math.max(1e-6, cu1 - cu0);
  const dv = Math.max(1e-6, cv1 - cv0);

  const dstAt = (u: number, v: number) => {
    const su = (u - cu0) / du;
    const sv = (v - cv0) / dv;
    const topX = cssQuad.tl.x + (cssQuad.tr.x - cssQuad.tl.x) * su;
    const topY = cssQuad.tl.y + (cssQuad.tr.y - cssQuad.tl.y) * su;
    const botX = cssQuad.bl.x + (cssQuad.br.x - cssQuad.bl.x) * su;
    const botY = cssQuad.bl.y + (cssQuad.br.y - cssQuad.bl.y) * su;
    return { x: topX + (botX - topX) * sv, y: topY + (botY - topY) * sv };
  };

  // Override: se warp moveu pontos, usar posicao bilinear a partir do index + UV do point
  const node = (c: number, r: number) => {
    const p = points[r * cols + c]!;
    return dstAt(p.u, p.v);
  };

  const iw = img.naturalWidth;
  const ih = img.naturalHeight;

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const p00 = node(c, r);
      const p10 = node(c + 1, r);
      const p01 = node(c, r + 1);
      const p11 = node(c + 1, r + 1);
      const u0 = c / (cols - 1);
      const u1 = (c + 1) / (cols - 1);
      const v0 = r / (rows - 1);
      const v1 = (r + 1) / (rows - 1);
      // Dois triangulos
      drawTexturedTriangle(ctx, img, iw, ih, u0, v0, u1, v0, u0, v1, p00, p10, p01);
      drawTexturedTriangle(ctx, img, iw, ih, u1, v0, u1, v1, u0, v1, p10, p11, p01);
    }
  }
}

/** Affine texture triangle (canvas 2D). */
function drawTexturedTriangle(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  iw: number,
  ih: number,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  u2: number,
  v2: number,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
): void {
  const x0 = u0 * iw;
  const y0 = v0 * ih;
  const x1 = u1 * iw;
  const y1 = v1 * ih;
  const x2 = u2 * iw;
  const y2 = v2 * ih;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.closePath();
  ctx.clip();

  // Solve affine: [x y 1] * M = [X Y]
  const denom = x0 * (y1 - y2) + x1 * (y2 - y0) + x2 * (y0 - y1);
  if (Math.abs(denom) < 1e-6) {
    ctx.restore();
    return;
  }
  const m11 = (p0.x * (y1 - y2) + p1.x * (y2 - y0) + p2.x * (y0 - y1)) / denom;
  const m12 = (p0.x * (x2 - x1) + p1.x * (x0 - x2) + p2.x * (x1 - x0)) / denom;
  const m13 =
    (p0.x * (x1 * y2 - x2 * y1) + p1.x * (x2 * y0 - x0 * y2) + p2.x * (x0 * y1 - x1 * y0)) / denom;
  const m21 = (p0.y * (y1 - y2) + p1.y * (y2 - y0) + p2.y * (y0 - y1)) / denom;
  const m22 = (p0.y * (x2 - x1) + p1.y * (x0 - x2) + p2.y * (x1 - x0)) / denom;
  const m23 =
    (p0.y * (x1 * y2 - x2 * y1) + p1.y * (x2 * y0 - x0 * y2) + p2.y * (x0 * y1 - x1 * y0)) / denom;

  ctx.transform(m11, m21, m12, m22, m13, m23);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

function criarPlaceholderCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = CONTENT_W;
  c.height = CONTENT_H;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createLinearGradient(0, 0, CONTENT_W, CONTENT_H);
    g.addColorStop(0, '#0a1620');
    g.addColorStop(1, '#1a3040');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CONTENT_W, CONTENT_H);
    ctx.fillStyle = '#3d8bfd';
    ctx.font = '14px monospace';
    ctx.fillText('SCREEN ON', 20, CONTENT_H / 2);
  }
  return c;
}

export function WallMediaOverlay({ midias, getTransform, selecionadoId, onHybridOpen }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const onHybridRef = useRef(onHybridOpen);
  onHybridRef.current = onHybridOpen;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let raf = 0;
    let vivo = true;

    const peCal = {
      peWallR: CALIBRACAO_PADRAO.peWallR,
      peWallL: CALIBRACAO_PADRAO.peWallL,
    };

    const wall = midias.filter((m) => m.kind === 'iframe' && m.face && m.url);
    host.innerHTML = '';
    const slots: Slot[] = [];

    for (const wm of wall) {
      const mode = resolverDisplay(wm);
      const root = document.createElement('div');
      root.dataset.mediaId = wm.mediaId;
      root.style.position = 'absolute';
      root.style.left = '0';
      root.style.top = '0';
      root.style.width = '0';
      root.style.height = '0';
      root.style.overflow = 'visible';
      root.style.pointerEvents = 'none';
      root.style.mixBlendMode = blendCss(wm) as string;

      let content: HTMLElement;

      if (mode === 'iframe') {
        const el = document.createElement('iframe');
        el.title = wm.mediaId;
        el.src = wm.url || 'about:blank';
        el.sandbox.add('allow-scripts', 'allow-same-origin', 'allow-forms', 'allow-popups');
        el.loading = 'lazy';
        el.style.border = 'none';
        el.style.background = '#0c1210';
        el.style.transformOrigin = '0 0';
        el.style.pointerEvents = 'none';
        el.width = String(CONTENT_W);
        el.height = String(CONTENT_H);
        el.style.width = `${CONTENT_W}px`;
        el.style.height = `${CONTENT_H}px`;
        content = el;
      } else if (mode === 'image' || (mode === 'hybrid' && urlPareceImagem(wm.url))) {
        const canvas = document.createElement('canvas');
        canvas.style.position = 'absolute';
        canvas.style.left = '0';
        canvas.style.top = '0';
        canvas.style.pointerEvents = 'none';
        const img = new Image();
        if (/^https?:/i.test(wm.url!)) img.crossOrigin = 'anonymous';
        img.decoding = 'async';
        img.src = wm.url!;
        (canvas as HTMLCanvasElement & { __img?: HTMLImageElement }).__img = img;
        content = canvas;
      } else {
        // hybrid sem imagem: placeholder canvas warpeado
        const canvas = document.createElement('canvas');
        canvas.style.position = 'absolute';
        canvas.style.left = '0';
        canvas.style.top = '0';
        canvas.style.pointerEvents = 'none';
        const ph = criarPlaceholderCanvas();
        const img = new Image();
        img.src = ph.toDataURL('image/png');
        (canvas as HTMLCanvasElement & { __img?: HTMLImageElement }).__img = img;
        content = canvas;
      }

      root.appendChild(content);
      host.appendChild(root);
      slots.push({ wm, mode, root, content, srcW: CONTENT_W, srcH: CONTENT_H });

      if (mode === 'hybrid') {
        root.style.pointerEvents = 'auto';
        root.style.cursor = 'pointer';
        root.addEventListener('click', (e) => {
          e.stopPropagation();
          onHybridRef.current?.(wm);
        });
      }
    }

    const tick = () => {
      if (!vivo) return;
      const tr = getTransform();
      const hostW = host.clientWidth || 1;
      const hostH = host.clientHeight || 1;
      if (tr) {
        for (const slot of slots) {
          const { wm, mode, root, content } = slot;
          const quadCena = quadrilateroTelaWallMedia(wm, 0, 0, peCal);
          if (!quadCena) {
            root.style.display = 'none';
            continue;
          }
          root.style.display = 'block';
          const cssQ = mapQuad(tr, quadCena);
          const ativo = !selecionadoId || selecionadoId === wm.mediaId;
          root.style.opacity = ativo ? '1' : '0.75';

          if (content instanceof HTMLCanvasElement && (content as HTMLCanvasElement & { __img?: HTMLImageElement }).__img) {
            const img = (content as HTMLCanvasElement & { __img?: HTMLImageElement }).__img!;
            const resolved = resolverCantosTela(wm);
            if (img.complete && img.naturalWidth > 0) {
              desenharWarpCanvas(content, img, cssQ, resolved.corners, resolved.warpGrid, hostW, hostH);
            } else {
              img.onload = () => {
                /* next tick will draw */
              };
            }
            // Hit area: invisible polygon overlay via clip on root size full host
            root.style.width = `${hostW}px`;
            root.style.height = `${hostH}px`;
            root.style.clipPath = clipPathQuad(cssQ);
            if (mode === 'iframe') {
              /* n/a */
            } else if (mode === 'hybrid') {
              content.style.pointerEvents = 'none';
            }
          } else {
            // matrix3d path (iframe or flat img)
            content.style.position = 'absolute';
            content.style.left = '0';
            content.style.top = '0';
            content.style.width = `${slot.srcW}px`;
            content.style.height = `${slot.srcH}px`;
            content.style.transform = homografiaMatrix3d(slot.srcW, slot.srcH, cssQ);
            content.style.clipPath = 'none';
            root.style.width = '0';
            root.style.height = '0';
            root.style.clipPath = 'none';

            if (mode === 'iframe') {
              const el = content as HTMLIFrameElement;
              el.style.pointerEvents = ativo ? 'auto' : 'none';
              root.style.pointerEvents = ativo ? 'auto' : 'none';
            }

            // Outline selecionado via box shadow no AABB
            if (selecionadoId === wm.mediaId) {
              const box = aabbDoQuad(cssQ);
              root.style.outline = '';
              content.style.outline = `1px solid #7dd3fc`;
              void box;
            } else {
              content.style.outline = 'none';
            }
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      vivo = false;
      cancelAnimationFrame(raf);
      host.innerHTML = '';
    };
  }, [midias, getTransform, selecionadoId]);

  if (!midias.some((m) => m.kind === 'iframe' && m.face && m.url)) return null;

  return (
    <div
      ref={hostRef}
      className="wall-media-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 4,
      }}
    />
  );
}

/** Hit-test CSS point against wall media quads (para pick externo). */
export function hitWallMediaCss(
  midias: readonly WallMedia[],
  cssPt: { x: number; y: number },
  getTransform: () => ViewTransform | null,
): WallMedia | null {
  const tr = getTransform();
  if (!tr) return null;
  const peCal = {
    peWallR: CALIBRACAO_PADRAO.peWallR,
    peWallL: CALIBRACAO_PADRAO.peWallL,
  };
  for (let i = midias.length - 1; i >= 0; i--) {
    const wm = midias[i]!;
    if (wm.kind !== 'iframe' || !wm.face) continue;
    const q = quadrilateroTelaWallMedia(wm, 0, 0, peCal);
    if (!q) continue;
    const cssQ = mapQuad(tr, q);
    if (pontoEmPoligono(cssPt, [cssQ.tl, cssQ.tr, cssQ.br, cssQ.bl])) return wm;
  }
  return null;
}

/** @deprecated use WallMediaOverlay */
export { WallMediaOverlay as WallIframeOverlay };
