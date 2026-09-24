/**
 * Nest de midia em telas do catálogo: cantos UV, warp, homografia CSS.
 * Smart-object analog: Free Transform (4 cantos) + Warp opcional.
 */
import type {
  ScreenCorners,
  ScreenInset,
  UvPoint,
  WallMedia,
  WallMediaBlendMode,
  WallMediaDisplay,
  WarpGrid,
} from '@tradeclass/contracts';
import { LARGURA_TILE, type Pt } from './iso';
import { FRAME_PRESETS, posicaoMediaParede, presetDaFrame } from './wall-media-frame';

export type ScreenNestPreset = {
  assetId: string;
  spriteW: number;
  spriteH: number;
  corners: ScreenCorners;
  warpGrid?: WarpGrid;
  /** Atalho de frame Lab (opcional). */
  frame?: keyof typeof FRAME_PRESETS;
};

function insetParaCantos(inset: ScreenInset): ScreenCorners {
  const u0 = Math.min(inset.u0, inset.u1);
  const u1 = Math.max(inset.u0, inset.u1);
  const v0 = Math.min(inset.v0, inset.v1);
  const v1 = Math.max(inset.v0, inset.v1);
  return {
    tl: { u: u0, v: v0 },
    tr: { u: u1, v: v0 },
    br: { u: u1, v: v1 },
    bl: { u: u0, v: v1 },
  };
}

function cantosDePresetFrame(frameKey: keyof typeof FRAME_PRESETS): ScreenCorners {
  return insetParaCantos(FRAME_PRESETS[frameKey].inset);
}

/** Presets calibrados no codigo por assetId do catalogo. */
export const SCREEN_NEST_PRESETS: Record<string, ScreenNestPreset> = {
  'office-tv-off': {
    assetId: 'office-tv-off',
    spriteW: 64,
    spriteH: 48,
    corners: cantosDePresetFrame('tv'),
    frame: 'tv',
  },
  'big-tv-off': {
    assetId: 'big-tv-off',
    spriteW: 96,
    spriteH: 72,
    corners: cantosDePresetFrame('big-tv'),
    frame: 'big-tv',
  },
  'corkboard-2': {
    assetId: 'corkboard-2',
    spriteW: 64,
    spriteH: 56,
    corners: cantosDePresetFrame('cork'),
    frame: 'cork',
  },
  'projector-screen': {
    assetId: 'projector-screen',
    spriteW: 96,
    spriteH: 64,
    corners: cantosDePresetFrame('screen'),
    frame: 'screen',
  },
};

export function nestPresetPorAsset(assetId: string | undefined | null): ScreenNestPreset | null {
  if (!assetId) return null;
  return SCREEN_NEST_PRESETS[assetId] ?? null;
}

export function nestPresetIds(): string[] {
  return Object.keys(SCREEN_NEST_PRESETS);
}

export type CantosResolvidos = {
  corners: ScreenCorners;
  warpGrid?: WarpGrid;
  spriteW: number;
  spriteH: number;
  nestAssetId: string | null;
};

/**
 * Resolve cantos efetivos: override tema → nestAssetId/mountAssetId preset →
 * screenInset / frame AABB → painel full.
 */
export function resolverCantosTela(
  wm: Pick<
    WallMedia,
    'screenCorners' | 'warpGrid' | 'screenInset' | 'frame' | 'nestAssetId' | 'mountAssetId' | 'size' | 'heightPx'
  >,
  spriteSize?: { w: number; h: number },
): CantosResolvidos {
  const nestId = wm.nestAssetId ?? wm.mountAssetId ?? null;
  const nest = nestPresetPorAsset(nestId);
  const framePreset = presetDaFrame(wm.frame ?? nest?.frame);

  const spriteW = spriteSize?.w ?? nest?.spriteW ?? framePreset.spriteW;
  const spriteH = spriteSize?.h ?? nest?.spriteH ?? framePreset.spriteH;

  if (wm.screenCorners) {
    return {
      corners: wm.screenCorners,
      warpGrid: wm.warpGrid ?? nest?.warpGrid,
      spriteW,
      spriteH,
      nestAssetId: nestId,
    };
  }

  if (nest) {
    return {
      corners: nest.corners,
      warpGrid: wm.warpGrid ?? nest.warpGrid,
      spriteW,
      spriteH,
      nestAssetId: nest.assetId,
    };
  }

  const inset = wm.screenInset ?? framePreset.inset;
  const temMoldura = wm.frame && wm.frame !== 'none';
  if (temMoldura || wm.screenInset) {
    return {
      corners: insetParaCantos(inset),
      warpGrid: wm.warpGrid,
      spriteW,
      spriteH,
      nestAssetId: nestId,
    };
  }

  // Painel sem moldura: quad full do bbox sintetico (span x heightPx).
  return {
    corners: { tl: { u: 0, v: 0 }, tr: { u: 1, v: 0 }, br: { u: 1, v: 1 }, bl: { u: 0, v: 1 } },
    warpGrid: wm.warpGrid,
    spriteW: Math.max(24, (wm.size?.w ?? framePreset.defaultSpan) * (LARGURA_TILE / 2)),
    spriteH: Math.max(16, wm.heightPx ?? framePreset.defaultHeightPx),
    nestAssetId: nestId,
  };
}

export type QuadTela = { tl: Pt; tr: Pt; br: Pt; bl: Pt };

function uvParaCena(topLeft: Pt, spriteW: number, spriteH: number, p: UvPoint): Pt {
  return {
    x: topLeft.x + p.u * spriteW,
    y: topLeft.y + p.v * spriteH,
  };
}

type PeCal = { peWallR: Pt; peWallL: Pt };

/**
 * Quatro cantos da tela em espaco de cena (px), a partir do mount + UVs.
 */
export function quadrilateroTelaWallMedia(
  wm: WallMedia,
  slotX0: number,
  slotY0: number,
  peCal: PeCal,
  spriteSize?: { w: number; h: number },
): QuadTela | null {
  const face = wm.face;
  if (!face) return null;
  const gx = wm.gx ?? wm.cell.x;
  const gy = wm.gy ?? wm.cell.y;
  const dx = wm.dx ?? 0;
  const dy = wm.dy ?? 0;
  const resolved = resolverCantosTela(wm, spriteSize);
  const topLeft = posicaoMediaParede(slotX0, slotY0, face, gx, gy, dx, dy, peCal);
  const { corners, spriteW, spriteH } = resolved;
  return {
    tl: uvParaCena(topLeft, spriteW, spriteH, corners.tl),
    tr: uvParaCena(topLeft, spriteW, spriteH, corners.tr),
    br: uvParaCena(topLeft, spriteW, spriteH, corners.br),
    bl: uvParaCena(topLeft, spriteW, spriteH, corners.bl),
  };
}

/** AABB do quad (legado / hit-test aproximado). */
export function aabbDoQuad(q: QuadTela): { x: number; y: number; w: number; h: number } {
  const xs = [q.tl.x, q.tr.x, q.br.x, q.bl.x];
  const ys = [q.tl.y, q.tr.y, q.br.y, q.bl.y];
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const x1 = Math.max(...xs);
  const y1 = Math.max(...ys);
  return { x: x0, y: y0, w: Math.max(4, x1 - x0), h: Math.max(4, y1 - y0) };
}

export function pontoEmPoligono(p: Pt, poly: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i]!.x;
    const yi = poly[i]!.y;
    const xj = poly[j]!.x;
    const yj = poly[j]!.y;
    const intersect =
      yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function quadComoPoligono(q: QuadTela): Pt[] {
  return [q.tl, q.tr, q.br, q.bl];
}

/**
 * Homografia 2D: mapeia retangulo eixo-alinhado (0,0)-(w,h) para o quad destino.
 * Retorna matrix3d CSS (coluna-major, 4x4) como string.
 * Algoritmo: resolver sistema linear 8x8 para perspectiva.
 */
export function homografiaMatrix3d(
  srcW: number,
  srcH: number,
  dst: QuadTela,
): string {
  const src: QuadTela = {
    tl: { x: 0, y: 0 },
    tr: { x: srcW, y: 0 },
    br: { x: srcW, y: srcH },
    bl: { x: 0, y: srcH },
  };
  const h = computeHomography(src, dst);
  // CSS matrix3d is column-major:
  // For 2D homography [[h00 h01 h02],[h10 h11 h12],[h20 h21 h22]]:
  // matrix3d(h00, h10, 0, h20,  h01, h11, 0, h21,  0,0,1,0,  h02, h12, 0, h22)
  return homografiaParaCss(h);
}

/** Homografia 3x3 flat (row-major) — util para testes / canvas. */
export function homografiaMatriz(srcW: number, srcH: number, dst: QuadTela): number[] {
  const src: QuadTela = {
    tl: { x: 0, y: 0 },
    tr: { x: srcW, y: 0 },
    br: { x: srcW, y: srcH },
    bl: { x: 0, y: srcH },
  };
  return computeHomography(src, dst);
}

function homografiaParaCss(h: number[]): string {
  const a = h[0] ?? 1;
  const b = h[1] ?? 0;
  const c = h[2] ?? 0;
  const d = h[3] ?? 0;
  const e = h[4] ?? 1;
  const f = h[5] ?? 0;
  const g = h[6] ?? 0;
  const hh = h[7] ?? 0;
  const i = h[8] ?? 1;
  return `matrix3d(${a},${d},${0},${g}, ${b},${e},${0},${hh}, ${0},${0},${1},${0}, ${c},${f},${0},${i})`;
}

/** Aplica homografia 3x3 (row-major flat 9) a um ponto. */
export function aplicarHomografia(h: number[], p: Pt): Pt {
  const a = h[0] ?? 1;
  const b = h[1] ?? 0;
  const c = h[2] ?? 0;
  const d = h[3] ?? 0;
  const e = h[4] ?? 1;
  const f = h[5] ?? 0;
  const g = h[6] ?? 0;
  const hh = h[7] ?? 0;
  const i = h[8] ?? 1;
  const w = g * p.x + hh * p.y + i;
  return {
    x: (a * p.x + b * p.y + c) / w,
    y: (d * p.x + e * p.y + f) / w,
  };
}

function computeHomography(src: QuadTela, dst: QuadTela): number[] {
  const s = [src.tl, src.tr, src.br, src.bl];
  const d = [dst.tl, dst.tr, dst.br, dst.bl];
  // Solve for h00..h21 with h22=1 using 8 equations (DLT simplified).
  const A: number[][] = [];
  const B: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = s[i]!;
    const { x: u, y: v } = d[i]!;
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    B.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    B.push(v);
  }
  const h8 = solveLinear8(A, B);
  return [h8[0]!, h8[1]!, h8[2]!, h8[3]!, h8[4]!, h8[5]!, h8[6]!, h8[7]!, 1];
}

/** Gauss-Jordan 8x8. */
function solveLinear8(A: number[][], B: number[]): number[] {
  const n = 8;
  const M = A.map((row, i) => [...row, B[i]!]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r]![col]!) > Math.abs(M[piv]![col]!)) piv = r;
    }
    [M[col], M[piv]] = [M[piv]!, M[col]!];
    const diag = M[col]![col]!;
    if (Math.abs(diag) < 1e-12) continue;
    for (let c = col; c <= n; c++) M[col]![c]! /= diag;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r]![col]!;
      for (let c = col; c <= n; c++) M[r]![c]! -= f * M[col]![c]!;
    }
  }
  return M.map((row) => row[n]!);
}

/** CSS mix-blend-mode a partir do contrato. */
export function cssBlendMode(mode: WallMediaBlendMode | undefined): string {
  switch (mode ?? 'screen') {
    case 'linear-dodge':
      return 'plus-lighter';
    case 'normal':
      return 'normal';
    case 'screen':
    default:
      return 'screen';
  }
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i;

export function urlPareceImagem(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    const path = url.startsWith('data:image/')
      ? url
      : new URL(url, 'https://example.local').pathname;
    if (url.startsWith('data:image/')) return true;
    return IMAGE_EXT.test(path);
  } catch {
    return IMAGE_EXT.test(url);
  }
}

/**
 * Resolve modo de display efetivo.
 * hybrid: preview na parede + iframe no painel.
 */
export function resolverDisplay(
  wm: Pick<WallMedia, 'display' | 'url'>,
): 'image' | 'iframe' | 'hybrid' {
  const d = (wm.display ?? 'auto') as WallMediaDisplay;
  if (d === 'image' || d === 'iframe' || d === 'hybrid') return d;
  return urlPareceImagem(wm.url) ? 'image' : 'iframe';
}

/** Exporta snippet TS de preset a partir de cantos calibrados no Lab. */
export function exportarPresetSnippet(
  assetId: string,
  spriteW: number,
  spriteH: number,
  corners: ScreenCorners,
  warpGrid?: WarpGrid,
): string {
  const warp = warpGrid
    ? `,\n  warpGrid: ${JSON.stringify(warpGrid)}`
    : '';
  return `'${assetId}': {
  assetId: '${assetId}',
  spriteW: ${spriteW},
  spriteH: ${spriteH},
  corners: ${JSON.stringify(corners)}${warp},
},`;
}

/** Interpola grade de warp (cols x rows) a partir dos 4 cantos se nao houver grade. */
export function gradeApartirCantos(corners: ScreenCorners, cols = 3, rows = 3): WarpGrid {
  const points: UvPoint[] = [];
  for (let r = 0; r < rows; r++) {
    const tv = r / (rows - 1);
    for (let c = 0; c < cols; c++) {
      const tu = c / (cols - 1);
      // Bilinear nos 4 cantos.
      const topU = corners.tl.u + (corners.tr.u - corners.tl.u) * tu;
      const topV = corners.tl.v + (corners.tr.v - corners.tl.v) * tu;
      const botU = corners.bl.u + (corners.br.u - corners.bl.u) * tu;
      const botV = corners.bl.v + (corners.br.v - corners.bl.v) * tu;
      points.push({
        u: topU + (botU - topU) * tv,
        v: topV + (botV - topV) * tv,
      });
    }
  }
  return { cols, rows, points };
}
