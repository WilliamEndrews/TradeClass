import type { MarketSeriesSnapshot, MarketTimeframe, OhlcvBar } from '@tradeclass/contracts';
import type { MarketDataProvider } from './provider.js';
import { normalizarSeriesId } from './provider.js';

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function prng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function arred(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function diaISO(base: Date, offset: number): string {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

export function gerarBarrasMock(seriesId: string, barras: number): OhlcvBar[] {
  const id = normalizarSeriesId(seriesId);
  const rnd = prng(hashSeed(id));
  const basePreco =
    id.includes('BTC') ? 62_000
    : id.includes('XAU') || id.includes('GOLD') ? 2_350
    : id.includes('JPY') ? 149.2
    : id.includes('US500') || id.includes('SPX') ? 5_200
    : id.includes('EUR') ? 1.08
    : 100 + (hashSeed(id) % 400);

  const volatilidade = basePreco * 0.012;
  let close = basePreco;
  const hoje = new Date();
  hoje.setUTCHours(0, 0, 0, 0);
  const out: OhlcvBar[] = [];

  for (let i = 0; i < barras; i++) {
    const drift = (rnd() - 0.48) * volatilidade;
    const open = close;
    const high = open + Math.abs(drift) + rnd() * volatilidade * 0.4;
    const low = open - Math.abs(drift) - rnd() * volatilidade * 0.4;
    close = Math.max(low, Math.min(high, open + drift));
    out.push({
      time: diaISO(hoje, i - barras + 1),
      open: arred(open),
      high: arred(high),
      low: arred(low),
      close: arred(close),
      volume: Math.round(800 + rnd() * 4200),
    });
  }
  return out;
}

export class MockMarketProvider implements MarketDataProvider {
  readonly source = 'mock' as const;

  async getSeries(
    seriesId: string,
    timeframe: MarketTimeframe,
    n: number,
  ): Promise<MarketSeriesSnapshot> {
    const id = normalizarSeriesId(seriesId) || 'EURUSD';
    const barras = Math.max(2, Math.min(500, Math.floor(n) || 200));
    return {
      seriesId: id,
      mt5Symbol: id,
      timeframe,
      source: 'mock',
      bars: gerarBarrasMock(id, barras),
    };
  }
}
