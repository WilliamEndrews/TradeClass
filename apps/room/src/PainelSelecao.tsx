/**
 * Painel de abas para selecao no canvas (mesa / quadro / wall media).
 * Equivalente textual obrigatorio (ADR-0009).
 */
import { useEffect, useRef, useState } from 'react';
import type { BrokerLinkDto } from './api';
import { ChartPanel } from './chart-panel';
import { desenharCandlesOffscreen } from './mock-charts';

export type AbaSelecao = 'config' | 'contas' | 'agente' | 'grafico';

export type SelecaoCanvas = {
  kind: 'desk' | 'board' | 'wall-media' | 'chair';
  id: string;
  agentId?: string;
  seriesId?: string;
  label?: string;
} | null;

type Props = {
  selecao: SelecaoCanvas;
  t: (chave: string, vars?: Record<string, string | number>) => string;
  links?: BrokerLinkDto[];
  urlWs?: string;
  token?: string;
  onAbrirTerminal?: (url: string) => void;
};

export function PainelSelecao({
  selecao,
  t,
  links = [],
  urlWs,
  token,
  onAbrirTerminal,
}: Props) {
  const [aba, setAba] = useState<AbaSelecao>('agente');
  const chartRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!selecao) return;
    if (selecao.kind === 'desk' || selecao.kind === 'chair') setAba('agente');
    else if (selecao.kind === 'wall-media') setAba('grafico');
    else setAba('config');
  }, [selecao]);

  useEffect(() => {
    if (aba !== 'grafico' || !chartRef.current || selecao?.seriesId) return;
    const seriesId = selecao?.id ?? 'XAUUSD';
    const off = desenharCandlesOffscreen(280, 120, seriesId);
    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;
    chartRef.current.width = off.width;
    chartRef.current.height = off.height;
    ctx.drawImage(off, 0, 0);
  }, [aba, selecao]);

  if (!selecao) {
    return (
      <section aria-label="Selecao">
        <h2>{t('tabs.agente')}</h2>
        <p className="nota">{t('selecao.nenhuma')}</p>
      </section>
    );
  }

  const titulo =
    selecao.kind === 'desk' || selecao.kind === 'chair'
      ? t('selecao.mesa')
      : selecao.kind === 'board'
        ? t('selecao.quadro')
        : t('tabs.grafico');

  return (
    <section aria-label="Selecao">
      <h2>{titulo}</h2>
      <p className="nota">
        {selecao.label ?? selecao.id}
        {selecao.agentId ? ` · ${selecao.agentId}` : ''}
      </p>
      <div className="tabs-selecao" role="tablist">
        {(['config', 'contas', 'agente', 'grafico'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={aba === id}
            className={aba === id ? 'tab ativo' : 'tab'}
            onClick={() => setAba(id)}
          >
            {t(`tabs.${id}`)}
          </button>
        ))}
      </div>
      <div className="tab-painel" role="tabpanel">
        {aba === 'config' && <p className="nota">Preferencias do desk (mock).</p>}
        {aba === 'contas' && (
          links.length === 0 ? (
            <p className="nota">{t('painel.contas.vazio')}</p>
          ) : (
            <ul className="kpi-lista">
              {links.map((l) => (
                <li key={l.linkId}>
                  <span>{l.label}</span>
                  <strong>{l.brokerName}</strong>
                  {l.webTerminalUrl && onAbrirTerminal && (
                    <button type="button" onClick={() => onAbrirTerminal(l.webTerminalUrl)}>
                      {t('painel.contas.abrirPainel')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )
        )}
        {aba === 'agente' && (
          <ul className="kpi-lista">
            <li>
              <span>{t('trade.pnlSessao')}</span>
              <strong>+1.24%</strong>
            </li>
            <li>
              <span>{t('trade.sinais')}</span>
              <strong>3</strong>
            </li>
            <li>
              <span>{t('trade.risco')}</span>
              <strong>medio</strong>
            </li>
          </ul>
        )}
        {aba === 'grafico' && (
          selecao.seriesId ? (
            <ChartPanel seriesId={selecao.seriesId} urlWs={urlWs} token={token} />
          ) : (
            <canvas ref={chartRef} className="chart-preview" aria-label={t('tabs.grafico')} />
          )
        )}
      </div>
    </section>
  );
}
