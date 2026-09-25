/**
 * FASE 0 - DEMONSTRACAO SINTETICA (TradeClass trading floor)
 *
 *   telemetria -> eventos -> Narrative Scheduler -> World Engine -> render
 *
 * Painel lateral = caminho acessivel de tudo que o canvas mostra (ADR-0009).
 * Clique em desk/board/wallMedia abre abas Configuracoes | Contas | Agente | Grafico.
 */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { ActorState, DomainEvent, OfficeLayout, Prop, WallMedia, WorldKpis } from '@tradeclass/contracts';
import { validarLayout, type Violacao } from '@tradeclass/world-engine';
import { criarRenderer, type RendererHandle } from './office-renderer-iso';
import { criarRendererTopDown } from './office-renderer-topdown';
import {
  criarFonteLocal,
  criarFonteRemota,
  type EstadoConexao,
  type WorldSource,
} from './world-source';
import { useI18n } from './use-i18n';
import { IDIOMAS, ROTULO_IDIOMA, type Idioma } from './i18n';
import { listarBrokerLinks, salvarBrokerLink, simular, type BrokerLinkDto, type SimularResult } from './api';
import { aplicarBrokerNasParedes, primeiroLinkAtivo } from './broker-paredes';
import { ChartPanel } from './chart-panel';
import { aquecerSerie } from './market-cache';
import type { AbaPainel, SelecaoAlvo } from './selection';
import { chaveSelecao } from './selection';
import { anexarWallMediaDemo } from './wall-media-demo';
import { anexarLiveTradeRoom, contextoLivePov } from './live-trade-room';
import { WallMediaOverlay } from './wall-media-overlay';
import { LivePovModal } from './live-pov-modal';

const TOKEN_QUERY = new URL(window.location.href).searchParams.get('token');

function resolverUrlServidor(): string | undefined {
  if (TOKEN_QUERY) {
    const api = import.meta.env.VITE_TRADECLASS_API ?? 'http://127.0.0.1:8787';
    const u = new URL(api);
    const ws = u.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${ws}//${u.host}/mundo?token=${encodeURIComponent(TOKEN_QUERY)}`;
  }
  return import.meta.env.VITE_TRADECLASS_WS as string | undefined;
}

const URL_SERVIDOR = resolverUrlServidor();

const PARAM_AGENTES = (() => {
  const url = new URL(window.location.href);
  const v = url.searchParams.get('agents');
  return v ? parseInt(v, 10) : undefined;
})();

function usarVistaMobile(): boolean {
  const url = new URL(window.location.href);
  if (url.searchParams.get('view') === 'mobile') return true;
  if (url.searchParams.get('view') === 'iso') return false;
  return window.matchMedia('(max-width: 768px)').matches;
}

const CHAVE_CONEXAO: Record<EstadoConexao, string> = {
  local: 'conexao.local',
  conectando: 'conexao.conectando',
  conectado: 'conexao.conectado',
  reconectando: 'conexao.reconectando',
  falhou: 'conexao.falhou',
};

interface EstadoPainel {
  kpis: WorldKpis;
  atores: ActorState[];
  historico: string[];
  tickAtual: number;
  layout: OfficeLayout | null;
}

const CHAVE_ATIVIDADE: Record<ActorState['activity'], string> = {
  idle: 'atividade.idle',
  walking: 'atividade.walking',
  working: 'atividade.working',
  resting: 'atividade.resting',
  waiting_approval: 'atividade.waiting_approval',
  blocked: 'atividade.blocked',
  sweeping: 'atividade.sweeping',
  repairing: 'atividade.repairing',
  talking: 'atividade.talking',
};

async function montarRenderer(
  canvas: HTMLCanvasElement,
  layout: OfficeLayout,
  mobile: boolean,
  terminalUrl?: string | null,
): Promise<RendererHandle> {
  const comMidia = aplicarBrokerNasParedes(
    anexarLiveTradeRoom(anexarWallMediaDemo(layout)),
    terminalUrl ? { webTerminalUrl: terminalUrl } : null,
  );
  return mobile
    ? criarRendererTopDown(canvas, comMidia)
    : criarRenderer(canvas, comMidia);
}

export default function App() {
  const { t, idioma, setIdioma } = useI18n();
  const [vistaMobile, setVistaMobile] = useState(usarVistaMobile);

  useEffect(() => {
    document.documentElement.lang = idioma === 'pseudo' ? 'qps-ploc' : idioma;
  }, [idioma]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = () => setVistaMobile(usarVistaMobile());
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<RendererHandle | null>(null);
  const fonteRef = useRef<WorldSource | null>(null);

  const [seed, setSeed] = useState(20260802);
  const [selecionado, setSelecionado] = useState<SelecaoAlvo | null>(null);
  const [aba, setAba] = useState<AbaPainel>('agente');
  const [painel, setPainel] = useState<EstadoPainel | null>(null);
  const [historicoKpis, setHistoricoKpis] = useState<WorldKpis[]>([]);
  const [violacoes, setViolacoes] = useState<Violacao[]>([]);
  const [pausado, setPausado] = useState(false);
  const [conexao, setConexao] = useState<EstadoConexao>(URL_SERVIDOR ? 'conectando' : 'local');
  const [avisoFonte, setAvisoFonte] = useState<string | null>(null);

  const [simDuracao, setSimDuracao] = useState(5000);
  const [simCarga, setSimCarga] = useState(1);
  const [simToken, setSimToken] = useState(import.meta.env.VITE_TRADECLASS_TOKEN as string | undefined ?? '');
  const [simResultado, setSimResultado] = useState<SimularResult | null>(null);
  const [simCarregando, setSimCarregando] = useState(false);
  const [simErro, setSimErro] = useState<string | null>(null);
  const [hybridUrl, setHybridUrl] = useState<string | null>(null);
  const [livePovAberto, setLivePovAberto] = useState(false);
  const [brokerLinks, setBrokerLinks] = useState<BrokerLinkDto[]>([]);
  const [contaLabel, setContaLabel] = useState('Mesa principal');
  const [contaBroker, setContaBroker] = useState('');
  const [contaUrl, setContaUrl] = useState('');
  const [contaErro, setContaErro] = useState<string | null>(null);
  const [contaSalvando, setContaSalvando] = useState(false);
  const brokerUrlRef = useRef<string | null>(null);

  const selecionadoRef = useRef<SelecaoAlvo | null>(null);
  selecionadoRef.current = selecionado;
  const painelLayoutRef = useRef<OfficeLayout | null>(null);

  useEffect(() => {
    let vivo = true;
    let handle: RendererHandle | null = null;
    let fonte: WorldSource | null = null;
    let cancelarQuadros: () => void = () => {};
    let cancelarEstado: () => void = () => {};

    void (async () => {
      let criada: WorldSource;
      if (URL_SERVIDOR) {
        try {
          criada = await criarFonteRemota(URL_SERVIDOR);
          setAvisoFonte(null);
        } catch (erro) {
          console.warn('[app] servidor indisponivel, caindo para simulacao local:', erro);
          setAvisoFonte(t('app.servidorIndisponivel', { url: URL_SERVIDOR }));
          criada = criarFonteLocal(seed, PARAM_AGENTES);
        }
      } else {
        criada = criarFonteLocal(seed, PARAM_AGENTES);
      }

      if (!vivo) {
        criada.destroy();
        return;
      }
      fonte = criada;
      fonteRef.current = criada;
      setViolacoes(criada.violacoes);
      setConexao(criada.estado());
      cancelarEstado = criada.onEstado(setConexao);

      if (URL_SERVIDOR && !TOKEN_QUERY && criada.seedSessao !== seed) {
        criada.enviar({ type: 'reseed', seed });
      }

      const tokenApi = TOKEN_QUERY ?? (import.meta.env.VITE_TRADECLASS_TOKEN as string | undefined);
      if (URL_SERVIDOR && tokenApi) {
        try {
          const links = await listarBrokerLinks(URL_SERVIDOR, tokenApi);
          if (vivo) {
            setBrokerLinks(links);
            const ativo = primeiroLinkAtivo(links);
            brokerUrlRef.current = ativo?.webTerminalUrl ?? null;
            if (ativo) {
              setContaLabel(ativo.label);
              setContaBroker(ativo.brokerName);
              setContaUrl(ativo.webTerminalUrl);
            }
          }
        } catch {
          // Room local / token sem rotas broker
        }
        for (const wm of criada.layout.wallMedia ?? []) {
          if (wm.seriesId) void aquecerSerie(wm.seriesId, URL_SERVIDOR, tokenApi, 32);
        }
      }

      if (!canvasRef.current) return;
      handle = await montarRenderer(canvasRef.current, criada.layout, vistaMobile, brokerUrlRef.current);
      if (!vivo) {
        handle.destroy();
        return;
      }
      rendererRef.current = handle;
      handle.onPick((alvo) => {
        setSelecionado(alvo);
        if (alvo?.kind === 'camera') {
          setLivePovAberto(true);
          setAba('config');
        } else if (alvo?.kind === 'wallMedia') setAba('grafico');
        else if (alvo?.kind === 'agent') setAba('agente');
        else if (alvo) setAba('config');
      });
      let officeIdAtual = criada.layout.officeId;

      const historico: string[] = [];
      let contador = 0;
      cancelarQuadros = criada.onQuadro(({ quadro, eventos }) => {
        if (quadro.kind === 'snapshot' && quadro.layout.officeId !== officeIdAtual) {
          officeIdAtual = quadro.layout.officeId;
          const anterior = rendererRef.current;
          rendererRef.current = null;
          anterior?.destroy();
          setViolacoes(validarLayout(quadro.layout));
          void (async () => {
            if (!vivo || !canvasRef.current) return;
            const novo = await montarRenderer(
              canvasRef.current,
              quadro.layout,
              vistaMobile,
              brokerUrlRef.current,
            );
            if (!vivo) {
              novo.destroy();
              return;
            }
            handle = novo;
            rendererRef.current = novo;
            novo.onPick((alvo) => {
              setSelecionado(alvo);
              if (alvo?.kind === 'camera') {
                setLivePovAberto(true);
                setAba('config');
              } else if (alvo?.kind === 'wallMedia') setAba('grafico');
              else if (alvo?.kind === 'agent') setAba('agente');
              else if (alvo) setAba('config');
            });
            novo.select(selecionadoRef.current);
            novo.push(quadro);
          })();
          return;
        }

        rendererRef.current?.push(quadro);

        for (const e of eventos) {
          if (e.type === 'llm.completed' || e.type === 'tool.called') continue;
          historico.unshift(descreverEvento(e, t));
        }
        if (eventos.length === 0 && quadro.kind === 'delta') {
          for (const c of quadro.chatter) historico.unshift(`${nomeCurto(c.agentId)}: ${c.text}`);
        }
        if (historico.length > 60) historico.length = 60;

        if (++contador % 3 === 0) {
          const layoutAtual =
            quadro.kind === 'snapshot'
              ? aplicarBrokerNasParedes(
                  anexarLiveTradeRoom(anexarWallMediaDemo(quadro.layout)),
                  brokerUrlRef.current
                ? { webTerminalUrl: brokerUrlRef.current }
                : null)
              : painelLayoutRef.current;
          if (quadro.kind === 'snapshot') painelLayoutRef.current = layoutAtual;
          setPainel({
            kpis: quadro.kpis,
            atores: quadro.actors,
            historico: [...historico.slice(0, 14)],
            tickAtual: quadro.tick,
            layout: layoutAtual ?? fonteRef.current?.layout ?? null,
          });
          setHistoricoKpis((prev) => [...prev, quadro.kpis].slice(-60));
        }
      });
    })();

    return () => {
      vivo = false;
      cancelarQuadros();
      cancelarEstado();
      handle?.destroy();
      fonte?.destroy();
      rendererRef.current = null;
      fonteRef.current = null;
    };
  }, [seed, vistaMobile, brokerLinks.length]);

  useEffect(() => {
    rendererRef.current?.select(selecionado);
    if (selecionado?.kind === 'agent') {
      rendererRef.current?.focusAgent(selecionado.id);
    }
  }, [selecionado]);

  const aprovacoes = useMemo(
    () => (painel?.atores ?? []).filter((a) => a.activity === 'waiting_approval'),
    [painel],
  );

  const clientes = (painel?.atores ?? []).filter((a) => !a.isInternal);
  const internos = (painel?.atores ?? []).filter((a) => a.isInternal);
  const custo = painel?.kpis.costUsdToday ?? 0;
  const orcamento = painel?.kpis.budgetUsdToday ?? 1;
  const percentualOrcamento = Math.min(100, (custo / orcamento) * 100);
  const layout = painel?.layout ?? fonteRef.current?.layout ?? null;
  const espelho = resolverEspelho(selecionado, layout, painel?.atores ?? [], t);
  const livePov =
    selecionado?.kind === 'camera' && layout
      ? contextoLivePov(layout, selecionado.id)
      : null;
  const getViewTransform = useCallback(
    () => rendererRef.current?.getViewTransform?.() ?? null,
    [],
  );

  const tokenApi = TOKEN_QUERY ?? (simToken || undefined);

  async function salvarConta() {
    if (!URL_SERVIDOR || !tokenApi) {
      setContaErro(t('painel.contas.precisaToken'));
      return;
    }
    setContaSalvando(true);
    setContaErro(null);
    try {
      const salvo = await salvarBrokerLink(URL_SERVIDOR, tokenApi, {
        linkId: brokerLinks[0]?.linkId,
        label: contaLabel.trim() || 'Mesa principal',
        brokerName: contaBroker.trim() || 'Broker',
        webTerminalUrl: contaUrl.trim(),
      });
      setBrokerLinks([salvo, ...brokerLinks.filter((l) => l.linkId !== salvo.linkId)]);
      brokerUrlRef.current = salvo.webTerminalUrl;
    } catch (err) {
      setContaErro(err instanceof Error ? err.message : t('painel.contas.falha'));
    } finally {
      setContaSalvando(false);
    }
  }

  return (
    <div className={`app${vistaMobile ? ' app-mobile' : ''}`}>
      <aside className="painel">
        <header className="marca">
          <h1>{t('app.titulo')}</h1>
          <p>{t('app.subtitulo')}</p>
          <p className={`fonte fonte-${conexao}`}>
            {t('app.fonteMundo')}: <strong>{t(CHAVE_CONEXAO[conexao])}</strong>
          </p>
          {avisoFonte && <p className="erro">{avisoFonte}</p>}
          <div className="seletor-idioma">
            <label htmlFor="sel-idioma">{t('i18ma.seletor')}</label>
            <select
              id="sel-idioma"
              value={idioma}
              onChange={(e) => setIdioma(e.target.value as Idioma)}
            >
              {IDIOMAS.map((id) => (
                <option key={id} value={id}>{ROTULO_IDIOMA[id]}</option>
              ))}
            </select>
          </div>
        </header>

        <section aria-label="Indicadores">
          <div className="kpis">
            <Kpi rotulo={t('kpi.pnlSessao')} valor={formatarPnl(painel?.kpis.pnlSessionUsd ?? 0)} alerta={(painel?.kpis.pnlSessionUsd ?? 0) < 0} />
            <Kpi rotulo={t('kpi.sinais')} valor={String(painel?.kpis.activeSignals ?? 0)} />
            <Kpi rotulo={t('kpi.risco')} valor={String(painel?.kpis.riskScore ?? 0)} alerta={(painel?.kpis.riskScore ?? 0) > 60} />
            <Kpi rotulo={t('kpi.execucoesAtivas')} valor={String(painel?.kpis.activeRuns ?? 0)} />
            <Kpi rotulo={t('kpi.erros5min')} valor={String(painel?.kpis.errorsLast5Min ?? 0)} alerta={(painel?.kpis.errorsLast5Min ?? 0) > 4} />
            <Kpi rotulo={t('kpi.aprovacoes')} valor={String(painel?.kpis.pendingApprovals ?? 0)} alerta={(painel?.kpis.pendingApprovals ?? 0) > 0} />
          </div>

          <div className="orcamento">
            <div className="orcamento-cabecalho">
              <span>{t('orcamento.custoDia')}</span>
              <strong>
                US$ {custo.toFixed(2)} / {orcamento.toFixed(2)}
              </strong>
            </div>
            <div className="barra" role="progressbar" aria-valuenow={Math.round(percentualOrcamento)} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${percentualOrcamento}%`, background: percentualOrcamento > 85 ? '#d47868' : '#7dba7a' }} />
            </div>
            <p className="nota">{t('orcamento.nota')}</p>
          </div>

          <section className="dashboard" aria-label={t('dashboard.titulo')}>
            <h2>{t('dashboard.titulo')}</h2>
            <div className="cartoes">
              <div className="cartao">
                <span className="cartao-rotulo">{t('kpi.pnlSessao')}</span>
                <strong className="cartao-valor">{formatarPnl(painel?.kpis.pnlSessionUsd ?? 0)}</strong>
              </div>
              <div className="cartao">
                <span className="cartao-rotulo">{t('kpi.sinais')}</span>
                <strong className="cartao-valor">{String(painel?.kpis.activeSignals ?? 0)}</strong>
              </div>
              <div className="cartao">
                <span className="cartao-rotulo">{t('kpi.risco')}</span>
                <strong className="cartao-valor">{String(painel?.kpis.riskScore ?? 0)}</strong>
              </div>
              <div className="cartao">
                <span className="cartao-rotulo">{t('kpi.tokensMin')}</span>
                <strong className="cartao-valor">{formatarNumero(painel?.kpis.tokensPerMinute ?? 0)}</strong>
              </div>
            </div>
            <p className="nota">{t('dashboard.nota')}</p>
            <section className="historico" aria-label={t('dashboard.historico')}>
              <h3>{t('dashboard.historico')}</h3>
              <div className="historico-series">
                <Sparkline titulo={t('kpi.pnlSessao')} dados={historicoKpis.map((k) => k.pnlSessionUsd ?? 0)} cor="#7dba7a" />
                <Sparkline titulo={t('kpi.risco')} dados={historicoKpis.map((k) => k.riskScore ?? 0)} cor="#d47868" />
              </div>
            </section>
          </section>
        </section>

        <section className="selecao-painel" aria-label={t('painel.selecao')}>
          <h2>{t('painel.selecao')}</h2>
          <p className="espelho-selecao">{espelho.texto}</p>
          <div className="abas" role="tablist">
            {([
              ['config', 'painel.aba.config'],
              ['contas', 'painel.aba.contas'],
              ['agente', 'painel.aba.agente'],
              ['grafico', 'painel.aba.grafico'],
            ] as const).map(([id, chave]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={aba === id}
                className={aba === id ? 'ativo' : ''}
                onClick={() => setAba(id)}
              >
                {t(chave)}
              </button>
            ))}
          </div>
          <div className="aba-conteudo" role="tabpanel">
            {aba === 'config' && (
              <div>
                <p className="nota">{espelho.config}</p>
                {espelho.prop && (
                  <ul className="lista-detalhe">
                    <li>{t('painel.propId')}: {espelho.prop.propId}</li>
                    <li>{t('painel.kind')}: {espelho.prop.kind}</li>
                    <li>{t('painel.sala')}: {espelho.prop.roomId}</li>
                    {espelho.prop.ownerAgentId && (
                      <li>{t('painel.dono')}: {nomeCurto(espelho.prop.ownerAgentId)}</li>
                    )}
                  </ul>
                )}
                {espelho.media && (
                  <ul className="lista-detalhe">
                    <li>{t('painel.mediaId')}: {espelho.media.mediaId}</li>
                    <li>{t('painel.kind')}: {espelho.media.kind}</li>
                    <li>{t('painel.serie')}: {espelho.media.seriesId ?? '—'}</li>
                  </ul>
                )}
              </div>
            )}
            {aba === 'contas' && (
              <div>
                <p className="nota">{t('painel.contas.nota')}</p>
                {brokerLinks.length > 0 ? (
                  <ul className="lista-detalhe">
                    {brokerLinks.map((l) => (
                      <li key={l.linkId}>
                        {l.label} · {l.brokerName} · {l.status}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="nota">{t('painel.contas.vazio')}</p>
                )}
                <label className="nota" htmlFor="conta-label">{t('painel.contas.nome')}</label>
                <input id="conta-label" value={contaLabel} onChange={(e) => setContaLabel(e.target.value)} />
                <label className="nota" htmlFor="conta-broker">{t('painel.contas.broker')}</label>
                <input id="conta-broker" value={contaBroker} onChange={(e) => setContaBroker(e.target.value)} />
                <label className="nota" htmlFor="conta-url">{t('painel.contas.url')}</label>
                <input
                  id="conta-url"
                  value={contaUrl}
                  onChange={(e) => setContaUrl(e.target.value)}
                  placeholder="https://"
                />
                {contaErro && <p className="erro">{contaErro}</p>}
                <div className="onboard-acoes" style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button type="button" disabled={contaSalvando} onClick={() => void salvarConta()}>
                    {contaSalvando ? t('painel.contas.salvando') : t('painel.contas.salvar')}
                  </button>
                  <button
                    type="button"
                    disabled={!contaUrl}
                    onClick={() => setHybridUrl(contaUrl)}
                  >
                    {t('painel.contas.abrirPainel')}
                  </button>
                </div>
                <ul className="lista-detalhe">
                  <li>{t('kpi.pnlSessao')}: {formatarPnl(painel?.kpis.pnlSessionUsd ?? 0)}</li>
                  <li>{t('kpi.sinais')}: {painel?.kpis.activeSignals ?? 0}</li>
                  <li>{t('orcamento.custoDia')}: US$ {custo.toFixed(2)}</li>
                </ul>
              </div>
            )}
            {aba === 'agente' && (
              <div>
                {espelho.ator ? (
                  <ul className="lista-detalhe">
                    <li>{nomeCurto(espelho.ator.agentId)}</li>
                    <li>{t(CHAVE_ATIVIDADE[espelho.ator.activity])}</li>
                    <li>{t('painel.saude')}: {espelho.ator.health}</li>
                  </ul>
                ) : (
                  <p className="nota">{t('painel.agente.vazio')}</p>
                )}
              </div>
            )}
            {aba === 'grafico' && (
              <div>
                {espelho.media?.kind === 'iframe' && espelho.media.url ? (
                  <>
                    <p className="nota">
                      {espelho.media.display ?? 'auto'} · {espelho.media.frame ?? 'none'} · {espelho.media.url}
                    </p>
                    {/\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(espelho.media.url) ||
                    espelho.media.url.startsWith('data:image/') ? (
                      <img
                        src={hybridUrl ?? espelho.media.url}
                        alt={espelho.media.mediaId}
                        style={{ width: '100%', maxHeight: 220, objectFit: 'contain', background: '#0c1210' }}
                      />
                    ) : (
                      <iframe
                        title={espelho.media.mediaId}
                        src={hybridUrl ?? espelho.media.url}
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                        style={{ width: '100%', height: 220, border: '1px solid #2a3a34', background: '#0c1210' }}
                      />
                    )}
                  </>
                ) : espelho.media?.seriesId ? (
                  <>
                    <p className="nota">{t('painel.grafico.serie', { id: espelho.media.seriesId })}</p>
                    <ChartPanel
                      seriesId={espelho.media.seriesId}
                      urlWs={URL_SERVIDOR}
                      token={tokenApi}
                    />
                  </>
                ) : (
                  <p className="nota">{t('painel.grafico.vazio')}</p>
                )}
              </div>
            )}
          </div>
        </section>

        {aprovacoes.length > 0 && (
          <section className="aprovacoes" aria-label="Aprovacoes pendentes">
            <h2>{t('aprovacao.titulo')}</h2>
            {aprovacoes.map((a) => (
              <div key={a.agentId} className="aprovacao">
                <span>{t('aprovacao.bloqueado', { nome: nomeCurto(a.agentId) })}</span>
                <button
                  type="button"
                  onClick={() =>
                    fonteRef.current?.enviar({ type: 'resolve_approval', agentId: a.agentId })
                  }
                >
                  {t('aprovacao.liberar')}
                </button>
              </div>
            ))}
          </section>
        )}

        <section aria-label="Agentes do cliente">
          <h2>{t('agentes.titulo')} ({clientes.length})</h2>
          <ul className="lista">
            {clientes.map((a) => (
              <li key={a.agentId}>
                <button
                  type="button"
                  className={chaveSelecao(selecionado) === a.agentId ? 'ativo' : ''}
                  aria-pressed={chaveSelecao(selecionado) === a.agentId}
                  onClick={() => {
                    const next = selecionado?.kind === 'agent' && selecionado.id === a.agentId
                      ? null
                      : { kind: 'agent' as const, id: a.agentId };
                    setSelecionado(next);
                    setAba('agente');
                  }}
                >
                  <span className={`ponto saude-${a.health}`} aria-hidden="true" />
                  <span className="nome">{nomeCurto(a.agentId)}</span>
                  <span className="atividade">{t(CHAVE_ATIVIDADE[a.activity])}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Equipe TradeClass">
          <h2>{t('agentes.internaTitulo')}</h2>
          <ul className="lista compacta">
            {internos.map((a) => (
              <li key={a.agentId}>
                <span className="nome">{nomeCurto(a.agentId)}</span>
                <span className="atividade">{t(CHAVE_ATIVIDADE[a.activity])}</span>
              </li>
            ))}
          </ul>
          <p className="nota">{t('agentes.notaInterna')}</p>
        </section>

        <section aria-label="Fatos recentes">
          <h2>{t('fatos.titulo')}</h2>
          <ol className="ticker">
            {(painel?.historico ?? []).map((linha, i) => (
              <li key={`${linha}-${i}`}>{linha}</li>
            ))}
          </ol>
          <p className="nota">{t('fatos.nota')}</p>
        </section>

        <section aria-label="Controles">
          <h2>{t('controles.titulo')}</h2>
          <div className="controles">
            <button
              type="button"
              onClick={() => {
                const proximo = !pausado;
                setPausado(proximo);
                fonteRef.current?.enviar({ type: 'set_paused', paused: proximo });
              }}
            >
              {pausado ? t('controles.retomar') : t('controles.pausar')}
            </button>
            <button type="button" onClick={() => setSeed(Math.floor(Math.random() * 1_000_000))}>
              {t('controles.novoEscritorio')}
            </button>
          </div>
          <label className="campo">
            {t('controles.semente')}
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value) || 0)}
            />
          </label>
          <p className="nota">{t('controles.notaSemente')}</p>
          {violacoes.length > 0 ? (
            <p className="erro">
              {t('controles.violacoes', { n: violacoes.length })}{' '}
              {violacoes.map((v) => v.regra).join(', ')}
            </p>
          ) : (
            <p className="ok">{t('controles.layoutValido')}</p>
          )}
        </section>

        <section aria-label="SimFirma" className="simfirma">
          <h2>{t('simfirma.titulo')}</h2>
          {!URL_SERVIDOR || !fonteRef.current?.tenantId ? (
            <p className="nota">{t('simfirma.requerRemoto')}</p>
          ) : (
            <>
              <label className="campo">
                {t('simfirma.duracao')}
                <input type="number" min={1000} max={60000} value={simDuracao} onChange={(e) => setSimDuracao(Number(e.target.value) || 0)} />
              </label>
              <label className="campo">
                {t('simfirma.carga')}
                <input type="number" min={1} max={100} value={simCarga} onChange={(e) => setSimCarga(Number(e.target.value) || 1)} />
              </label>
              <label className="campo">
                {t('simfirma.token')}
                <input type="password" value={simToken} onChange={(e) => setSimToken(e.target.value)} placeholder="eyJ..." />
              </label>
              <button
                type="button"
                className="simfirma-rodar"
                disabled={simCarregando || !simToken}
                onClick={async () => {
                  const tenantId = fonteRef.current?.tenantId;
                  if (!URL_SERVIDOR || !tenantId) return;
                  setSimCarregando(true);
                  setSimErro(null);
                  setSimResultado(null);
                  try {
                    const r = await simular(URL_SERVIDOR, tenantId, simToken, simDuracao, simCarga);
                    if (r) setSimResultado(r);
                  } catch (err) {
                    setSimErro(err instanceof Error ? err.message : 'erro desconhecido');
                  } finally {
                    setSimCarregando(false);
                  }
                }}
              >
                {simCarregando ? t('simfirma.rodando') : t('simfirma.rodar')}
              </button>
              {simErro && <p className="erro">{simErro}</p>}
              {simResultado && (
                <div className="simfirma-resultado">
                  <p>
                    {simResultado.ticks} {t('simfirma.ticks')} / {simResultado.tMundoMs}ms {t('simfirma.tMundo')}
                  </p>
                  <div className="kpis simfirma-kpis">
                    <Kpi rotulo={t('kpi.execucoesAtivas')} valor={String(simResultado.kpis.activeRuns)} />
                    <Kpi rotulo={t('kpi.erros5min')} valor={String(simResultado.kpis.errorsLast5Min)} />
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </aside>

      <main className="palco">
        <canvas ref={canvasRef} aria-label={t('canvas.ariaLabel')} role="img" />
        {!vistaMobile && layout && (
          <WallMediaOverlay
            midias={layout.wallMedia ?? []}
            getTransform={getViewTransform}
            selecionadoId={selecionado?.kind === 'wallMedia' ? selecionado.id : null}
            onHybridOpen={(wm) => {
              setSelecionado({ kind: 'wallMedia', id: wm.mediaId });
              setAba('grafico');
              setHybridUrl(wm.url ?? null);
            }}
          />
        )}
        <div className="controles-camera">
          <button type="button" onClick={() => rendererRef.current?.resetCamera()} title={t('camera.reset')}>
            {t('camera.reset')}
          </button>
          <span className="dica-camera">
            {vistaMobile ? t('camera.dicaMobile') : t('camera.dica')}
          </span>
        </div>
        {livePov && (
          <LivePovModal
            aberto={livePovAberto}
            onFechar={() => setLivePovAberto(false)}
            agentId={livePov.agentId}
            seriesId={livePov.seriesId}
            bgUrl={livePov.bgUrl}
            mode="simulated"
            t={t}
          />
        )}
      </main>
    </div>
  );
}

function resolverEspelho(
  sel: SelecaoAlvo | null,
  layout: OfficeLayout | null,
  atores: ActorState[],
  t: (chave: string, vars?: Record<string, string | number>) => string,
): {
  texto: string;
  config: string;
  prop?: Prop;
  media?: WallMedia;
  ator?: ActorState;
} {
  if (!sel) {
    return { texto: t('painel.selecao.nenhuma'), config: t('painel.config.vazio') };
  }
  if (sel.kind === 'agent') {
    const ator = atores.find((a) => a.agentId === sel.id);
    return {
      texto: t('painel.selecao.agente', { nome: nomeCurto(sel.id) }),
      config: t('painel.config.agente', { nome: nomeCurto(sel.id) }),
      ator,
    };
  }
  if (sel.kind === 'desk' || sel.kind === 'board') {
    const prop = layout?.props.find((p) => p.propId === sel.id);
    return {
      texto: t(sel.kind === 'desk' ? 'painel.selecao.mesa' : 'painel.selecao.quadro', {
        id: sel.id,
      }),
      config: t('painel.config.prop', { kind: sel.kind, id: sel.id }),
      prop,
    };
  }
  if (sel.kind === 'camera') {
    const prop = layout?.props.find((p) => p.propId === sel.id);
    return {
      texto: t('painel.selecao.camera', { id: sel.id }),
      config: t('painel.config.camera', { id: sel.id }),
      prop,
    };
  }
  const media = layout?.wallMedia?.find((m) => m.mediaId === sel.id);
  return {
    texto: t('painel.selecao.midia', { id: sel.id, kind: media?.kind ?? '—' }),
    config: t('painel.config.midia', { id: sel.id }),
    media,
  };
}

function Sparkline({ titulo, dados, cor }: { titulo: string; dados: number[]; cor: string }) {
  const LARGURA = 140;
  const ALTURA = 40;
  if (dados.length < 2) return <div className="sparkline" style={{ width: LARGURA }}>{titulo}: --</div>;

  const max = Math.max(...dados, 1);
  const min = Math.min(...dados, 0);
  const range = max - min || 1;
  const passo = LARGURA / (dados.length - 1);
  const pontos = dados.map((v, i) => {
    const x = i * passo;
    const y = ALTURA - ((v - min) / range) * ALTURA;
    return `${x},${y}`;
  });
  const atual = dados[dados.length - 1];

  return (
    <div className="sparkline" style={{ width: LARGURA }} title={`${titulo}: ${atual}`}>
      <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} width={LARGURA} height={ALTURA}>
        <polyline points={pontos.join(' ')} fill="none" stroke={cor} strokeWidth="2" />
      </svg>
      <span className="sparkline-titulo">{titulo}</span>
      <span className="sparkline-valor">{String(atual)}</span>
    </div>
  );
}

function Kpi({ rotulo, valor, alerta }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className={`kpi${alerta ? ' alerta' : ''}`}>
      <span>{rotulo}</span>
      <strong>{valor}</strong>
    </div>
  );
}

function descreverEvento(
  e: DomainEvent,
  t: (chave: string, vars?: Record<string, string | number>) => string,
): string {
  switch (e.type) {
    case 'agent.discovered':
      return t('evento.discovered', { nome: e.agent.displayName, framework: e.agent.framework });
    case 'run.started':
      return t('evento.runStarted', { nome: nomeCurto(e.agentId), label: e.label ?? t('evento.execucao') });
    case 'run.finished':
      return t('evento.runFinished', { nome: nomeCurto(e.agentId), duracao: (e.durationMs / 1000).toFixed(1), status: e.status });
    case 'error.raised':
      return t('evento.errorRaised', { nome: nomeCurto(e.agentId), kind: e.kind, severity: e.severity });
    case 'approval.requested':
      return t('evento.approvalRequested', { nome: nomeCurto(e.agentId) });
    case 'queue.observed':
      return t('evento.queueObserved', { nome: nomeCurto(e.agentId), depth: e.depth });
    default:
      return e.type;
  }
}

function nomeCurto(agentId: string): string {
  const bruto = agentId.replace(/^agent-/, '').replace(/^TradeClass-/, '');
  return bruto.charAt(0).toUpperCase() + bruto.slice(1);
}

function formatarNumero(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n));
}

function formatarPnl(n: number): string {
  const sinal = n >= 0 ? '+' : '';
  return `${sinal}${n.toFixed(2)}`;
}
