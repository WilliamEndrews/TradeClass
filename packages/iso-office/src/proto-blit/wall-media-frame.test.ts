/**
 * Testes dos presets / retangulo de tela WallMedia.
 */
import { describe, expect, it } from 'vitest';
import type { WallMedia } from '@tradeclass/contracts';
import { FRAME_PRESETS, presetDaFrame, retanguloTelaWallMedia } from './wall-media-frame';

const PE = { peWallR: { x: 32, y: 83 }, peWallL: { x: 95, y: 83 } };

describe('wall-media-frame', () => {
  it('presets cobrem frames do plano', () => {
    expect(Object.keys(FRAME_PRESETS).sort()).toEqual(['big-tv', 'cork', 'none', 'screen', 'tv']);
    expect(presetDaFrame('tv').assetId).toBe('office-tv-off');
    expect(presetDaFrame(undefined).frame).toBe('none');
  });

  it('retangulo painel sem moldura respeita span e heightPx', () => {
    const wm: WallMedia = {
      mediaId: 't1',
      kind: 'iframe',
      roomId: 'r',
      cell: { x: 1, y: 0 },
      size: { w: 3, h: 1 },
      face: 'R',
      gx: 1,
      gy: 0,
      dx: 0,
      dy: 0,
      frame: 'none',
      heightPx: 40,
      url: 'https://example.com',
    };
    const r = retanguloTelaWallMedia(wm, 0, 0, PE);
    expect(r).not.toBeNull();
    expect(r!.h).toBe(40);
    expect(r!.w).toBeGreaterThan(40);
  });

  it('retangulo com moldura tv usa inset', () => {
    const preset = FRAME_PRESETS.tv;
    const wm: WallMedia = {
      mediaId: 't2',
      kind: 'iframe',
      roomId: 'r',
      cell: { x: 0, y: 1 },
      size: { w: 1, h: 1 },
      face: 'L',
      gx: 0,
      gy: 1,
      frame: 'tv',
      mountAssetId: 'office-tv-off',
      screenInset: preset.inset,
      url: 'https://example.com',
    };
    const r = retanguloTelaWallMedia(wm, 0, 0, PE);
    expect(r).not.toBeNull();
    expect(r!.w).toBeLessThan(preset.spriteW);
    expect(r!.h).toBeLessThan(preset.spriteH);
  });
});
