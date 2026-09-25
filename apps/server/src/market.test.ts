import { describe, expect, it } from 'vitest';
import { MockMarketProvider } from './market/mock-provider.js';
import { tratarBrokerMarket } from './broker-routes.js';
import { BrokerStore } from './broker-store.js';
import type { JwtPayload } from '@tradeclass/contracts';

const jwt: JwtPayload = {
  tenantId: 't-mkt',
  userId: 'u1',
  papel: 'admin',
  exp: 9_999_999_999,
  iat: 1,
};

describe('MockMarketProvider', () => {
  it('serie deterministica por seriesId', async () => {
    const p = new MockMarketProvider();
    const a = await p.getSeries('EURUSD', 'M5', 20);
    const b = await p.getSeries('eur-usd', 'M5', 20);
    expect(a.bars).toHaveLength(20);
    expect(a.seriesId).toBe('EURUSD');
    expect(a.source).toBe('mock');
    expect(a.bars).toEqual(b.bars);
    expect(a.bars[0]!.high).toBeGreaterThanOrEqual(a.bars[0]!.low);
  });
});

describe('GET /api/market/series', () => {
  it('exige JWT e devolve snapshot', async () => {
    const store = new BrokerStore();
    const market = new MockMarketProvider();
    const semAuth = await tratarBrokerMarket({
      method: 'GET',
      segments: ['api', 'market', 'series', 'XAUUSD'],
      search: new URLSearchParams(),
      payload: null,
      store,
      market,
    });
    expect(semAuth?.status).toBe(401);

    const ok = await tratarBrokerMarket({
      method: 'GET',
      segments: ['api', 'market', 'series', 'XAUUSD'],
      search: new URLSearchParams('tf=M5&n=12'),
      payload: jwt,
      store,
      market,
    });
    expect(ok?.status).toBe(200);
    expect((ok?.body as { seriesId: string; bars: unknown[] }).seriesId).toBe('XAUUSD');
    expect((ok?.body as { bars: unknown[] }).bars).toHaveLength(12);
  });
});
