import { describe, expect, it } from 'vitest';
import { BrokerStore } from './broker-store.js';
import { tratarBrokerMarket } from './broker-routes.js';
import { MockMarketProvider } from './market/mock-provider.js';
import type { JwtPayload } from '@tradeclass/contracts';

const jwt: JwtPayload = {
  tenantId: 't-br',
  userId: 'u1',
  papel: 'operator',
  exp: 9_999_999_999,
  iat: 1,
};

const payloadOk = {
  label: 'Mesa lead',
  brokerName: 'BrokerX',
  accountLogin: '123456',
  serverName: 'BrokerX-Live',
  webTerminalUrl: 'https://trade.brokerx.example/web',
  provider: 'web_terminal',
};

describe('BrokerStore', () => {
  it('upsert + listar + remover', () => {
    const s = new BrokerStore();
    const a = s.upsert('t1', payloadOk);
    expect(a.status).toBe('linked');
    expect(s.listar('t1')).toHaveLength(1);
    const b = s.upsert('t1', { ...payloadOk, linkId: a.linkId, label: 'Mesa 2' });
    expect(b.linkId).toBe(a.linkId);
    expect(s.listar('t1')[0]!.label).toBe('Mesa 2');
    expect(s.remover('t1', a.linkId)).toBe(true);
    expect(s.listar('t1')).toHaveLength(0);
  });

  it('rejeita metaapi_future e http', () => {
    const s = new BrokerStore();
    expect(() => s.upsert('t1', { ...payloadOk, provider: 'metaapi_future' })).toThrow(/metaapi_future/);
    expect(() => s.upsert('t1', { ...payloadOk, webTerminalUrl: 'http://inseguro.example' })).toThrow(/https/);
  });
});

describe('rotas /api/broker/links', () => {
  it('CRUD autenticado por tenant', async () => {
    const store = new BrokerStore();
    const market = new MockMarketProvider();
    const criado = await tratarBrokerMarket({
      method: 'PUT',
      segments: ['api', 'broker', 'links'],
      search: new URLSearchParams(),
      payload: jwt,
      body: JSON.stringify(payloadOk),
      store,
      market,
    });
    expect(criado?.status).toBe(200);
    const linkId = (criado?.body as { linkId: string }).linkId;

    const lista = await tratarBrokerMarket({
      method: 'GET',
      segments: ['api', 'broker', 'links'],
      search: new URLSearchParams(),
      payload: jwt,
      store,
      market,
    });
    expect(lista?.status).toBe(200);
    expect(lista?.body).toHaveLength(1);

    const del = await tratarBrokerMarket({
      method: 'DELETE',
      segments: ['api', 'broker', 'links', linkId],
      search: new URLSearchParams(),
      payload: jwt,
      store,
      market,
    });
    expect(del?.status).toBe(204);
  });
});
