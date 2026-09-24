import { describe, expect, it } from 'vitest';
import { gerarSerieOHLCV } from './ohlcv-mock';

describe('ohlcv-mock', () => {
  it('gera serie deterministica por seriesId', () => {
    const a = gerarSerieOHLCV('EURUSD', 20);
    const b = gerarSerieOHLCV('EURUSD', 20);
    expect(a).toHaveLength(20);
    expect(a).toEqual(b);
    expect(a[0]!.high).toBeGreaterThanOrEqual(a[0]!.low);
    expect(a[a.length - 1]!.time < a[0]!.time || a.length > 1).toBe(true);
  });

  it('series diferentes divergem', () => {
    const eur = gerarSerieOHLCV('EURUSD', 10);
    const btc = gerarSerieOHLCV('BTC-USD', 10);
    expect(eur[0]!.close).not.toBe(btc[0]!.close);
  });
});
