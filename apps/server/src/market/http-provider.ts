import {
  MarketSeriesSnapshotSchema,
  type MarketSeriesSnapshot,
  type MarketTimeframe,
} from '@tradeclass/contracts';
import type { MarketDataProvider } from './provider.js';
import { MockMarketProvider } from './mock-provider.js';
import { normalizarSeriesId } from './provider.js';

/**
 * Feed HTTP opcional. Sem MARKET_DATA_URL (ou falha de rede) cai no mock.
 * Proximo ciclo: MetaAPI implementa a mesma interface.
 */
export class HttpMarketProvider implements MarketDataProvider {
  readonly source = 'http' as const;
  private readonly fallback = new MockMarketProvider();

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey?: string,
  ) {}

  async getSeries(
    seriesId: string,
    timeframe: MarketTimeframe,
    n: number,
  ): Promise<MarketSeriesSnapshot> {
    const id = normalizarSeriesId(seriesId);
    const url = new URL(`series/${encodeURIComponent(id)}`, this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`);
    url.searchParams.set('tf', timeframe);
    url.searchParams.set('n', String(n));
    try {
      const headers: Record<string, string> = { accept: 'application/json' };
      if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`;
      const res = await fetch(url, { headers });
      if (!res.ok) return this.fallback.getSeries(seriesId, timeframe, n);
      const parsed = MarketSeriesSnapshotSchema.safeParse(await res.json());
      if (!parsed.success) return this.fallback.getSeries(seriesId, timeframe, n);
      return parsed.data;
    } catch {
      return this.fallback.getSeries(seriesId, timeframe, n);
    }
  }
}
