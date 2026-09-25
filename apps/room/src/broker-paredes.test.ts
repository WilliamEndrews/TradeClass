import { describe, expect, it } from 'vitest';
import type { OfficeLayout, WallMedia } from '@tradeclass/contracts';
import { aplicarBrokerNasParedes, urlEhPlaceholderIframe } from './broker-paredes';

function layoutCom(midias: WallMedia[]): OfficeLayout {
  return {
    officeId: 'o1',
    seed: 1,
    grid: { width: 8, height: 8 },
    rooms: [],
    props: [],
    decor: [],
    corridors: [],
    theme: { name: 't', palette: [], greenery: 0 },
    walls: [],
    wallMounts: [],
    wallMedia: midias,
  };
}

describe('aplicarBrokerNasParedes', () => {
  it('troca example.com e ignora data-image', () => {
    const terminal = 'https://trade.broker.example/web';
    const out = aplicarBrokerNasParedes(
      layoutCom([
        {
          mediaId: 'a',
          kind: 'iframe',
          roomId: 'r',
          cell: { x: 1, y: 1 },
          size: { w: 2, h: 1 },
          url: 'https://example.com',
          display: 'iframe',
        },
        {
          mediaId: 'b',
          kind: 'iframe',
          roomId: 'r',
          cell: { x: 2, y: 1 },
          size: { w: 1, h: 1 },
          url: 'data:image/svg+xml,x',
          display: 'image',
        },
        {
          mediaId: 'c',
          kind: 'chart',
          roomId: 'r',
          cell: { x: 3, y: 1 },
          size: { w: 2, h: 1 },
          seriesId: 'EURUSD',
        },
      ]),
      { webTerminalUrl: terminal },
    );
    expect(out.wallMedia?.[0]?.url).toBe(terminal);
    expect(out.wallMedia?.[1]?.url).toContain('data:image');
    expect(out.wallMedia?.[2]?.seriesId).toBe('EURUSD');
  });

  it('reconhece placeholder', () => {
    expect(urlEhPlaceholderIframe('https://example.com/x')).toBe(true);
    expect(urlEhPlaceholderIframe(undefined)).toBe(true);
    expect(urlEhPlaceholderIframe('https://trade.real/web')).toBe(false);
  });
});
