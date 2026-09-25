import type { MarketSeriesSnapshot, MarketTimeframe } from '@tradeclass/contracts';

export interface MarketDataProvider {
  readonly source: MarketSeriesSnapshot['source'];
  getSeries(
    seriesId: string,
    timeframe: MarketTimeframe,
    n: number,
  ): Promise<MarketSeriesSnapshot>;
}

export function normalizarSeriesId(seriesId: string): string {
  return seriesId.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}
