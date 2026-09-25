import { describe, expect, it } from 'vitest';
import { SyntheticStream } from '@tradeclass/synthetic';
import { montarMundoDaPlanta, PLANTA_PADRAO_TRADECLASS } from '@tradeclass/iso-office';
import { validarLayout } from '@tradeclass/world-engine';
import { ehCameraCinema } from './camera-cinema';
import { chaveSelecao, selecaoDeString } from './selection';
import { anexarLiveTradeRoom, contextoLivePov } from './live-trade-room';
import { anexarWallMediaDemo } from './wall-media-demo';
import createdAssets from '../../../scripts/iso-validation/created-assets.json';

describe('camera cinema / live POV', () => {
  it('ehCameraCinema reconhece assetIds Create', () => {
    expect(ehCameraCinema('created-cinema-camera')).toBe(true);
    expect(ehCameraCinema('created-cinema-camera-pro')).toBe(true);
    expect(ehCameraCinema('office-projector')).toBe(false);
  });

  it('selecao cam: ida e volta', () => {
    const s = selecaoDeString('cam:live-cam-boss');
    expect(s).toEqual({ kind: 'camera', id: 'live-cam-boss' });
    expect(chaveSelecao(s)).toBe('cam:live-cam-boss');
  });

  it('created-assets: cameras com interativo live_pov', () => {
    const cams = (createdAssets as { assets: { assetId: string; interativo?: { acao?: string } }[] })
      .assets
      .filter((a) => a.assetId.startsWith('created-cinema-camera'));
    expect(cams.length).toBeGreaterThanOrEqual(2);
    for (const c of cams) {
      expect(c.interativo?.acao).toBe('live_pov');
    }
  });

  it('anexarLiveTradeRoom injeta camera + laptop + big-tv', () => {
    const stream = new SyntheticStream({ seed: 20260802, comRoteiro: true });
    const mundo = montarMundoDaPlanta(PLANTA_PADRAO_TRADECLASS, 20260802, stream.agents);
    const layout = anexarLiveTradeRoom(anexarWallMediaDemo(mundo.layout));
    const cam = layout.props.find((p) => ehCameraCinema(p.assetId));
    expect(cam).toBeDefined();
    expect(layout.decor.some((d) => d.kind === 'laptop')).toBe(true);
    expect(layout.wallMedia?.some((m) => m.frame === 'big-tv')).toBe(true);

    const ctx = contextoLivePov(layout, cam!.propId);
    expect(ctx.agentId.length).toBeGreaterThan(0);
    expect(ctx.seriesId.length).toBeGreaterThan(0);
    expect(ctx.bgUrl.length).toBeGreaterThan(0);
  });

  it('anexarLiveTradeRoom mantem layout valido', () => {
    const stream = new SyntheticStream({ seed: 20260802, comRoteiro: true });
    const mundo = montarMundoDaPlanta(PLANTA_PADRAO_TRADECLASS, 20260802, stream.agents);
    const layout = anexarLiveTradeRoom(anexarWallMediaDemo(mundo.layout));
    expect(validarLayout(layout)).toEqual([]);
  });
});
