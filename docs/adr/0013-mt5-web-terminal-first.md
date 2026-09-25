# ADR-0013 — MT5 web-terminal first

- Status: Aceito
- Data: 2026-09-24
- Contexto do produto: landing onboarding, Room wall media / iframes, feed OHLCV

## Contexto

O TradeClass personifica agentes especialistas num floor isometrico. A conta
do usuario precisa entrar no canvas: graficos nas TVs, terminal nas paredes
(iframes) e, mais tarde, ordens reais. Nao ha EA local nem login MetaAPI neste
ciclo.

## Decisao

1. **Agora:** o usuario cola a URL https do *web terminal* do broker.
   `BrokerLink.webTerminalUrl` vai para `WallMedia.url` (iframe / hybrid).
2. **Feed de mercado** e uma API REST pluggable (`MarketDataProvider`).
   Default = mock deterministico; `MARKET_DATA_URL` ativa HTTP.
3. **Especialidade → simbolo** e canonico (`SPECIALTY_SYMBOLS`): gold=XAUUSD,
   usd/eur/orchestrator=EURUSD, yen=USDJPY, crypto=BTCUSD, macro=US500, news=nenhum.
4. **Depois (nao implementado):** `provider: 'metaapi_future'` — login remoto
   WebSocket estilo MetaAPI. A interface do provider ja e o slot. Este ciclo
   rejeita o provider com mensagem clara. Sem ordens / posicoes / equity real.

## Consequencias

- Brokers com `X-Frame-Options` nao entram na parede; o painel hybrid abre a URL.
- PnL do narrative-scheduler continua mock ate o feed de conta.
- Trocar o mock por MetaAPI nao muda contratos de `BrokerLink` / `MarketSeriesSnapshot`.
