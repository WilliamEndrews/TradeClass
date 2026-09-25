import type { MarketDataProvider } from './provider.js';
import { HttpMarketProvider } from './http-provider.js';
import { MockMarketProvider } from './mock-provider.js';

export type { MarketDataProvider } from './provider.js';
export { MockMarketProvider } from './mock-provider.js';
export { HttpMarketProvider } from './http-provider.js';
export { normalizarSeriesId } from './provider.js';

export function criarMarketProvider(): MarketDataProvider {
  const base = process.env.MARKET_DATA_URL?.trim();
  if (base) {
    return new HttpMarketProvider(base, process.env.MARKET_DATA_KEY);
  }
  return new MockMarketProvider();
}
