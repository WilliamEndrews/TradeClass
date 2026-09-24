import { describe, expect, it } from 'vitest';
import type { WallMedia } from '@tradeclass/contracts';
import {
  aabbDoQuad,
  aplicarHomografia,
  cssBlendMode,
  exportarPresetSnippet,
  gradeApartirCantos,
  homografiaMatrix3d,
  homografiaMatriz,
  nestPresetPorAsset,
  pontoEmPoligono,
  quadrilateroTelaWallMedia,
  resolverCantosTela,
  resolverDisplay,
  urlPareceImagem,
} from './screen-nest';

const PE = { peWallR: { x: 0, y: 0 }, peWallL: { x: 0, y: 0 } };

function wmBase(over: Partial<WallMedia> = {}): WallMedia {
  return {
    mediaId: 'm1',
    kind: 'iframe',
    roomId: 'r1',
    cell: { x: 1, y: 1 },
    size: { w: 2, h: 1 },
    face: 'R',
    gx: 1,
    gy: 1,
    url: 'https://example.com',
    ...over,
  };
}

describe('resolverCantosTela', () => {
  it('usa screenCorners do tema como override', () => {
    const corners = {
      tl: { u: 0.2, v: 0.2 },
      tr: { u: 0.8, v: 0.25 },
      br: { u: 0.85, v: 0.7 },
      bl: { u: 0.15, v: 0.75 },
    };
    const r = resolverCantosTela(wmBase({ screenCorners: corners, nestAssetId: 'office-tv-off' }));
    expect(r.corners).toEqual(corners);
    expect(r.nestAssetId).toBe('office-tv-off');
  });

  it('cai no preset do nestAssetId', () => {
    const r = resolverCantosTela(wmBase({ nestAssetId: 'office-tv-off' }));
    const preset = nestPresetPorAsset('office-tv-off')!;
    expect(r.corners).toEqual(preset.corners);
    expect(r.spriteW).toBe(64);
  });

  it('deriva cantos de screenInset legado', () => {
    const r = resolverCantosTela(
      wmBase({
        frame: 'tv',
        screenInset: { u0: 0.1, v0: 0.2, u1: 0.9, v1: 0.8 },
      }),
    );
    expect(r.corners.tl).toEqual({ u: 0.1, v: 0.2 });
    expect(r.corners.br).toEqual({ u: 0.9, v: 0.8 });
  });
});

describe('quadrilateroTelaWallMedia', () => {
  it('aceita UV fora de 0..1 (estouro alem do sprite)', () => {
    const q = quadrilateroTelaWallMedia(
      wmBase({
        nestAssetId: 'office-tv-off',
        screenCorners: {
          tl: { u: -0.5, v: -0.25 },
          tr: { u: 1.5, v: -0.25 },
          br: { u: 1.5, v: 1.25 },
          bl: { u: -0.5, v: 1.25 },
        },
      }),
      0,
      0,
      PE,
      { w: 64, h: 48 },
    );
    expect(q).not.toBeNull();
    const box = aabbDoQuad(q!);
    // 2x sprite width (u span 2.0 * 64), 1.5x height (v span 1.5 * 48)
    expect(box.w).toBeCloseTo(128, 4);
    expect(box.h).toBeCloseTo(72, 4);
    // Estouro: largura do quad > sprite (64)
    expect(q!.tr.x - q!.tl.x).toBeCloseTo(128, 4);
    expect(q!.tl.x).toBeLessThan(q!.tr.x);
  });
});

describe('homografiaMatrix3d', () => {
  it('mapeia cantos src para dst com erro baixo', () => {
    const dst = {
      tl: { x: 10, y: 20 },
      tr: { x: 110, y: 25 },
      br: { x: 100, y: 80 },
      bl: { x: 5, y: 70 },
    };
    const h = homografiaMatriz(100, 50, dst);
    const corners = [
      [{ x: 0, y: 0 }, dst.tl],
      [{ x: 100, y: 0 }, dst.tr],
      [{ x: 100, y: 50 }, dst.br],
      [{ x: 0, y: 50 }, dst.bl],
    ] as const;
    for (const [src, expectPt] of corners) {
      const p = aplicarHomografia(h, src);
      expect(p.x).toBeCloseTo(expectPt.x, 5);
      expect(p.y).toBeCloseTo(expectPt.y, 5);
    }
    expect(homografiaMatrix3d(100, 50, dst).startsWith('matrix3d(')).toBe(true);
    expect(pontoEmPoligono({ x: 55, y: 45 }, [dst.tl, dst.tr, dst.br, dst.bl])).toBe(true);
  });

  it('aplicarHomografia identidade', () => {
    const h = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    const p = aplicarHomografia(h, { x: 12, y: 34 });
    expect(p.x).toBeCloseTo(12);
    expect(p.y).toBeCloseTo(34);
  });
});

describe('display / blend / url', () => {
  it('detecta imagem por extensao', () => {
    expect(urlPareceImagem('https://cdn.example/a.png')).toBe(true);
    expect(urlPareceImagem('https://cdn.example/a.webp?x=1')).toBe(true);
    expect(urlPareceImagem('https://example.com/page')).toBe(false);
    expect(urlPareceImagem('data:image/png;base64,aaa')).toBe(true);
  });

  it('resolverDisplay auto e hybrid', () => {
    expect(resolverDisplay({ url: 'https://x.com/a.jpg' })).toBe('image');
    expect(resolverDisplay({ url: 'https://example.com' })).toBe('iframe');
    expect(resolverDisplay({ display: 'hybrid', url: 'https://example.com' })).toBe('hybrid');
  });

  it('cssBlendMode', () => {
    expect(cssBlendMode(undefined)).toBe('screen');
    expect(cssBlendMode('linear-dodge')).toBe('plus-lighter');
    expect(cssBlendMode('normal')).toBe('normal');
  });
});

describe('grade / export', () => {
  it('gradeApartirCantos 3x3', () => {
    const g = gradeApartirCantos(
      {
        tl: { u: 0, v: 0 },
        tr: { u: 1, v: 0 },
        br: { u: 1, v: 1 },
        bl: { u: 0, v: 1 },
      },
      3,
      3,
    );
    expect(g.points).toHaveLength(9);
    expect(g.points[4]).toEqual({ u: 0.5, v: 0.5 });
  });

  it('exportarPresetSnippet', () => {
    const s = exportarPresetSnippet('office-tv-off', 64, 48, {
      tl: { u: 0.1, v: 0.1 },
      tr: { u: 0.9, v: 0.1 },
      br: { u: 0.9, v: 0.9 },
      bl: { u: 0.1, v: 0.9 },
    });
    expect(s).toContain("'office-tv-off'");
    expect(s).toContain('spriteW: 64');
  });
});
