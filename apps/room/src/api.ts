/**
 * API cliente do TradeClass - chamadas REST ponto a ponto.
 *
 * O WebSocket e a fonte de mundo (quadros a 10 Hz). Estas funcoes fazem
 * operacoes pontuais que nao cabem no stream: SimFirma, onboarding, login.
 */

export interface SimularResult {
  ticks: number;
  tMundoMs: number;
  kpis: {
    activeRuns: number;
    costUsdToday: number;
    budgetUsdToday: number;
    errorsLast5Min: number;
    tokensPerMinute: number;
    pendingApprovals: number;
  };
}

/**
 * Converte URL do WebSocket para URL base da API REST.
 * ws://localhost:8787/mundo -> http://localhost:8787
 */
function baseDaApi(urlWs: string): string {
  const u = new URL(urlWs);
  const protocol = u.protocol === 'wss:' ? 'https:' : 'http:';
  return `${protocol}//${u.host}`;
}

export type BrokerLinkDto = {
  linkId: string;
  tenantId: string;
  label: string;
  brokerName: string;
  accountLogin?: string;
  serverName?: string;
  webTerminalUrl: string;
  status: 'pending' | 'linked' | 'error';
  provider: 'web_terminal' | 'metaapi_future';
};

export type MarketSeriesDto = {
  seriesId: string;
  mt5Symbol: string;
  timeframe: string;
  source: string;
  bars: Array<{
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
};

export async function listarBrokerLinks(urlWs: string, token: string): Promise<BrokerLinkDto[]> {
  const res = await fetch(`${baseDaApi(urlWs)}/api/broker/links`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return (await res.json()) as BrokerLinkDto[];
}

export async function salvarBrokerLink(
  urlWs: string,
  token: string,
  body: {
    linkId?: string;
    label: string;
    brokerName: string;
    accountLogin?: string;
    serverName?: string;
    webTerminalUrl: string;
  },
): Promise<BrokerLinkDto> {
  const res = await fetch(`${baseDaApi(urlWs)}/api/broker/links`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ...body, provider: 'web_terminal' }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return (await res.json()) as BrokerLinkDto;
}

export async function buscarSerie(
  urlWs: string,
  token: string,
  seriesId: string,
  tf = 'M5',
  n = 80,
): Promise<MarketSeriesDto> {
  const url = new URL(`${baseDaApi(urlWs)}/api/market/series/${encodeURIComponent(seriesId)}`);
  url.searchParams.set('tf', tf);
  url.searchParams.set('n', String(n));
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return (await res.json()) as MarketSeriesDto;
}

export async function simular(
  urlWs: string,
  tenantId: string,
  token: string,
  durationMs: number,
  carga: number,
): Promise<SimularResult> {
  const res = await fetch(`${baseDaApi(urlWs)}/api/tenants/${tenantId}/simulate`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ durationMs, carga }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return (await res.json()) as SimularResult;
}
