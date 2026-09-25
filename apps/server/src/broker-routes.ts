import {
  MarketTimeframeSchema,
  type JwtPayload,
} from '@tradeclass/contracts';
import type { BrokerStore } from './broker-store.js';
import type { MarketDataProvider } from './market/index.js';

export type RespostaRota = { status: number; body: unknown };

export async function tratarBrokerMarket(opts: {
  method: string;
  segments: string[];
  search: URLSearchParams;
  payload: JwtPayload | null;
  body?: string;
  store: BrokerStore;
  market: MarketDataProvider;
}): Promise<RespostaRota | null> {
  const { method, segments, search, payload, store, market } = opts;

  if (segments[0] !== 'api') return null;

  if (segments[1] === 'market' && segments[2] === 'series' && segments[3] && method === 'GET') {
    if (!payload) return { status: 401, body: { error: 'nao autorizado' } };
    const tf = MarketTimeframeSchema.safeParse(search.get('tf') ?? 'M5');
    if (!tf.success) return { status: 400, body: { error: 'timeframe invalido' } };
    const n = Number(search.get('n') ?? 200);
    const snapshot = await market.getSeries(segments[3], tf.data, n);
    return { status: 200, body: snapshot };
  }

  if (segments[1] === 'broker' && segments[2] === 'links') {
    if (!payload) return { status: 401, body: { error: 'nao autorizado' } };
    const tenantId = payload.tenantId;

    if (segments.length === 3 && method === 'GET') {
      return { status: 200, body: store.listar(tenantId) };
    }

    if (segments.length === 3 && method === 'PUT') {
      try {
        const raw = JSON.parse(opts.body ?? '{}');
        const link = store.upsert(tenantId, raw);
        return { status: 200, body: link };
      } catch (erro) {
        const msg = erro instanceof Error ? erro.message : 'payload invalido';
        return { status: 400, body: { error: msg } };
      }
    }

    if (segments.length === 4 && method === 'DELETE') {
      const ok = store.remover(tenantId, segments[3]!);
      return ok ? { status: 204, body: null } : { status: 404, body: { error: 'link nao encontrado' } };
    }
  }

  return null;
}
