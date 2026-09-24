/**
 * Presets de moldura + insets de tela para WallMedia iframe.
 * Insets em fracao do bbox do sprite (u/v 0..1).
 */
import type { ScreenInset, WallMedia, WallMediaFrame } from '@tradeclass/contracts';
import { LARGURA_TILE, type Pt } from './iso';
import { posicaoMountParede } from './parede-blit';

export type FramePreset = {
  frame: WallMediaFrame;
  assetId: string | null;
  fileName: string | null;
  /** Tamanho tipico do sprite (px) — fallback se o atlas nao informar. */
  spriteW: number;
  spriteH: number;
  inset: ScreenInset;
  defaultSpan: number;
  defaultHeightPx: number;
};

export const FRAME_PRESETS: Record<WallMediaFrame, FramePreset> = {
  none: {
    frame: 'none',
    assetId: null,
    fileName: null,
    spriteW: 96,
    spriteH: 48,
    inset: { u0: 0, v0: 0, u1: 1, v1: 1 },
    defaultSpan: 2,
    defaultHeightPx: 44,
  },
  tv: {
    frame: 'tv',
    assetId: 'office-tv-off',
    fileName: 'Office/Tv_Off.png',
    spriteW: 64,
    spriteH: 48,
    inset: { u0: 0.18, v0: 0.22, u1: 0.82, v1: 0.72 },
    defaultSpan: 1,
    defaultHeightPx: 28,
  },
  'big-tv': {
    frame: 'big-tv',
    assetId: 'big-tv-off',
    fileName: 'Televisions_TV/BigTv_Ani/BigTV_3_Off_Tile.png',
    spriteW: 96,
    spriteH: 72,
    inset: { u0: 0.12, v0: 0.18, u1: 0.88, v1: 0.78 },
    defaultSpan: 2,
    defaultHeightPx: 40,
  },
  cork: {
    frame: 'cork',
    assetId: 'corkboard-2',
    fileName: 'Office/Corkboard_2.png',
    spriteW: 64,
    spriteH: 56,
    inset: { u0: 0.14, v0: 0.16, u1: 0.86, v1: 0.84 },
    defaultSpan: 1,
    defaultHeightPx: 36,
  },
  screen: {
    frame: 'screen',
    assetId: 'projector-screen',
    fileName: 'Office/Projector_Screen_Ani/Projector_Screen_Ani_1.png',
    spriteW: 96,
    spriteH: 64,
    inset: { u0: 0.1, v0: 0.12, u1: 0.9, v1: 0.82 },
    defaultSpan: 3,
    defaultHeightPx: 48,
  },
};

export function presetDaFrame(frame: WallMediaFrame | undefined): FramePreset {
  return FRAME_PRESETS[frame ?? 'none'] ?? FRAME_PRESETS.none;
}

export type RetanguloTela = { x: number; y: number; w: number; h: number };

/**
 * Retangulo da area de conteudo (tela) no espaco da cena (px), a partir do
 * blit da moldura. Sprites TinyHouse ja sao isometricos — a tela e um
 * retangulo eixo-alinhado dentro do bbox do PNG.
 */
export function retanguloTelaNoSprite(
  mountTopLeft: Pt,
  spriteW: number,
  spriteH: number,
  inset: ScreenInset,
): RetanguloTela {
  const u0 = Math.min(inset.u0, inset.u1);
  const u1 = Math.max(inset.u0, inset.u1);
  const v0 = Math.min(inset.v0, inset.v1);
  const v1 = Math.max(inset.v0, inset.v1);
  return {
    x: mountTopLeft.x + u0 * spriteW,
    y: mountTopLeft.y + v0 * spriteH,
    w: Math.max(4, (u1 - u0) * spriteW),
    h: Math.max(4, (v1 - v0) * spriteH),
  };
}

type PeCal = { peWallR: Pt; peWallL: Pt };

/**
 * Posicao do canto superior-esquerdo do sprite/painel no espaco da cena
 * (origem do slot ja embutida via slotX0/slotY0).
 */
export function posicaoMediaParede(
  slotX0: number,
  slotY0: number,
  face: 'R' | 'L',
  gx: number,
  gy: number,
  dx: number,
  dy: number,
  peCal: PeCal,
): Pt {
  const pe = face === 'L' ? peCal.peWallL : peCal.peWallR;
  return posicaoMountParede(
    slotX0,
    slotY0,
    { assetId: '_', gx, gy, face, dx, dy, papel: 'wall' },
    pe,
    dx,
    dy,
  );
}

/**
 * Retangulo de tela para um WallMedia wall-native no espaco da cena.
 * Sem moldura: largura = spanTiles * (LARGURA_TILE/2), altura = heightPx.
 */
export function retanguloTelaWallMedia(
  wm: WallMedia,
  slotX0: number,
  slotY0: number,
  peCal: PeCal,
  spriteSize?: { w: number; h: number },
): RetanguloTela | null {
  const face = wm.face;
  if (!face) return null;
  const gx = wm.gx ?? wm.cell.x;
  const gy = wm.gy ?? wm.cell.y;
  const dx = wm.dx ?? 0;
  const dy = wm.dy ?? 0;
  const preset = presetDaFrame(wm.frame);
  const inset = wm.screenInset ?? preset.inset;
  const topLeft = posicaoMediaParede(slotX0, slotY0, face, gx, gy, dx, dy, peCal);

  if (wm.frame && wm.frame !== 'none') {
    const sw = spriteSize?.w ?? preset.spriteW;
    const sh = spriteSize?.h ?? preset.spriteH;
    return retanguloTelaNoSprite(topLeft, sw, sh, inset);
  }

  const span = wm.size?.w ?? preset.defaultSpan;
  const w = Math.max(24, span * (LARGURA_TILE / 2));
  const h = Math.max(16, wm.heightPx ?? preset.defaultHeightPx);
  return { x: topLeft.x, y: topLeft.y, w, h };
}
