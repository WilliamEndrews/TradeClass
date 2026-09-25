/**
 * Cache de series para blit/painel. Prefere API; cai no mock local.
 */
import type { CandleOHLCV } from './ohlcv-mock';
import { gerarSerieOHLCV } from './ohlcv-mock';
import { buscarSerie } from './api';

const cache = new Map<string, CandleOHLCV[]>();

export function candlesDaSerie(seriesId: string, barras = 60): CandleOHLCV[] {
  const hit = cache.get(seriesId);
  if (hit && hit.length > 0) return hit.slice(-barras);
  return gerarSerieOHLCV(seriesId, barras);
}

export async function aquecerSerie(
  seriesId: string,
  urlWs: string | undefined,
  token: string | undefined,
  n = 80,
): Promise<CandleOHLCV[]> {
  if (urlWs && token) {
    try {
      const snap = await buscarSerie(urlWs, token, seriesId, 'M5', n);
      cache.set(seriesId, snap.bars);
      return snap.bars;
    } catch {
      // offline / sem auth: mock
    }
  }
  const local = gerarSerieOHLCV(seriesId, n);
  cache.set(seriesId, local);
  return local;
}
