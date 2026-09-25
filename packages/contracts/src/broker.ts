/**
 * Contratos de conta broker / feed de mercado.
 *
 * Ciclo atual: web terminal (URL no iframe) + OHLCV por API.
 * `metaapi_future` e slot documentado — rejeitado ate o proximo ciclo.
 */
import { z } from 'zod';
import { AgentSpecialtySchema, type AgentSpecialty } from './agent-desk.js';

export const BrokerProviderSchema = z.enum(['web_terminal', 'metaapi_future']);
export type BrokerProvider = z.infer<typeof BrokerProviderSchema>;

export const BrokerLinkStatusSchema = z.enum(['pending', 'linked', 'error']);
export type BrokerLinkStatus = z.infer<typeof BrokerLinkStatusSchema>;

export const BrokerLinkSchema = z.object({
  linkId: z.string().min(1),
  tenantId: z.string().min(1),
  label: z.string().min(1),
  brokerName: z.string().min(1),
  accountLogin: z.string().min(1).optional(),
  serverName: z.string().min(1).optional(),
  webTerminalUrl: z.string().url(),
  status: BrokerLinkStatusSchema,
  provider: BrokerProviderSchema,
});
export type BrokerLink = z.infer<typeof BrokerLinkSchema>;

/** Payload de upsert (linkId opcional = criar). */
export const BrokerLinkUpsertSchema = BrokerLinkSchema.omit({
  linkId: true,
  tenantId: true,
  status: true,
}).extend({
  linkId: z.string().min(1).optional(),
  status: BrokerLinkStatusSchema.optional(),
  webTerminalUrl: z.string().min(1),
});
export type BrokerLinkUpsert = z.infer<typeof BrokerLinkUpsertSchema>;

export const SymbolBindingSchema = z.object({
  specialty: AgentSpecialtySchema,
  seriesId: z.string().min(1),
  mt5Symbol: z.string().min(1),
  displayName: z.string().min(1),
});
export type SymbolBinding = z.infer<typeof SymbolBindingSchema>;

export const MarketTimeframeSchema = z.enum(['M1', 'M5', 'M15', 'H1', 'H4', 'D1']);
export type MarketTimeframe = z.infer<typeof MarketTimeframeSchema>;

export const OhlcvBarSchema = z.object({
  time: z.string().min(1),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number().nonnegative(),
});
export type OhlcvBar = z.infer<typeof OhlcvBarSchema>;

export const MarketSeriesSnapshotSchema = z.object({
  seriesId: z.string().min(1),
  mt5Symbol: z.string().min(1),
  timeframe: MarketTimeframeSchema,
  source: z.enum(['mock', 'http', 'metaapi_future']),
  bars: z.array(OhlcvBarSchema),
});
export type MarketSeriesSnapshot = z.infer<typeof MarketSeriesSnapshotSchema>;

export const MarketSeriesDeltaSchema = z.object({
  seriesId: z.string().min(1),
  timeframe: MarketTimeframeSchema,
  bar: OhlcvBarSchema,
});
export type MarketSeriesDelta = z.infer<typeof MarketSeriesDeltaSchema>;

/** Mapa canonico specialty → serie / simbolo MT5. `news` nao tem serie. */
export const SPECIALTY_SYMBOLS: Readonly<
  Record<Exclude<AgentSpecialty, 'news'>, SymbolBinding>
> = {
  gold: { specialty: 'gold', seriesId: 'XAUUSD', mt5Symbol: 'XAUUSD', displayName: 'Gold' },
  usd: { specialty: 'usd', seriesId: 'EURUSD', mt5Symbol: 'EURUSD', displayName: 'EUR/USD' },
  eur: { specialty: 'eur', seriesId: 'EURUSD', mt5Symbol: 'EURUSD', displayName: 'EUR/USD' },
  yen: { specialty: 'yen', seriesId: 'USDJPY', mt5Symbol: 'USDJPY', displayName: 'USD/JPY' },
  crypto: { specialty: 'crypto', seriesId: 'BTCUSD', mt5Symbol: 'BTCUSD', displayName: 'Bitcoin' },
  macro: { specialty: 'macro', seriesId: 'US500', mt5Symbol: 'US500', displayName: 'US500' },
  orchestrator: {
    specialty: 'orchestrator',
    seriesId: 'EURUSD',
    mt5Symbol: 'EURUSD',
    displayName: 'EUR/USD (lead)',
  },
};

export function bindingDaEspecialidade(specialty: AgentSpecialty): SymbolBinding | undefined {
  if (specialty === 'news') return undefined;
  return SPECIALTY_SYMBOLS[specialty];
}

export function seriesIdDaEspecialidade(specialty: AgentSpecialty): string | undefined {
  return bindingDaEspecialidade(specialty)?.seriesId;
}

export function ehUrlHttpsTerminal(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}
