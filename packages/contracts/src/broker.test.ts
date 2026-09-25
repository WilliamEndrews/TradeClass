import { describe, expect, it } from 'vitest';
import {
  BrokerLinkSchema,
  BrokerLinkUpsertSchema,
  MarketSeriesSnapshotSchema,
  SPECIALTY_SYMBOLS,
  bindingDaEspecialidade,
  ehUrlHttpsTerminal,
  seriesIdDaEspecialidade,
} from './broker';

describe('specialty → simbolo', () => {
  it('mapeia especialidades de trade para series canonicas', () => {
    expect(seriesIdDaEspecialidade('gold')).toBe('XAUUSD');
    expect(seriesIdDaEspecialidade('usd')).toBe('EURUSD');
    expect(seriesIdDaEspecialidade('eur')).toBe('EURUSD');
    expect(seriesIdDaEspecialidade('yen')).toBe('USDJPY');
    expect(seriesIdDaEspecialidade('crypto')).toBe('BTCUSD');
    expect(seriesIdDaEspecialidade('macro')).toBe('US500');
    expect(seriesIdDaEspecialidade('orchestrator')).toBe('EURUSD');
    expect(seriesIdDaEspecialidade('news')).toBeUndefined();
  });

  it('binding carrega mt5Symbol igual ao seriesId neste ciclo', () => {
    for (const b of Object.values(SPECIALTY_SYMBOLS)) {
      expect(b.mt5Symbol).toBe(b.seriesId);
      expect(bindingDaEspecialidade(b.specialty)?.seriesId).toBe(b.seriesId);
    }
  });
});

describe('BrokerLink', () => {
  it('aceita web_terminal https', () => {
    const r = BrokerLinkSchema.safeParse({
      linkId: 'lnk-1',
      tenantId: 't1',
      label: 'Mesa principal',
      brokerName: 'Exness',
      webTerminalUrl: 'https://trade.example.com/terminal',
      status: 'linked',
      provider: 'web_terminal',
    });
    expect(r.success).toBe(true);
  });

  it('upsert exige URL', () => {
    expect(BrokerLinkUpsertSchema.safeParse({
      label: 'x',
      brokerName: 'y',
      webTerminalUrl: 'https://broker.example/web',
      provider: 'web_terminal',
    }).success).toBe(true);
    expect(BrokerLinkUpsertSchema.safeParse({
      label: 'x',
      brokerName: 'y',
      webTerminalUrl: '',
      provider: 'web_terminal',
    }).success).toBe(false);
  });

  it('valida https do terminal', () => {
    expect(ehUrlHttpsTerminal('https://mt5.broker/web')).toBe(true);
    expect(ehUrlHttpsTerminal('http://mt5.broker/web')).toBe(false);
    expect(ehUrlHttpsTerminal('not-a-url')).toBe(false);
  });
});

describe('MarketSeriesSnapshot', () => {
  it('valida snapshot mock', () => {
    const r = MarketSeriesSnapshotSchema.safeParse({
      seriesId: 'EURUSD',
      mt5Symbol: 'EURUSD',
      timeframe: 'M5',
      source: 'mock',
      bars: [{ time: '2026-01-01', open: 1, high: 2, low: 0.5, close: 1.2, volume: 10 }],
    });
    expect(r.success).toBe(true);
  });
});
