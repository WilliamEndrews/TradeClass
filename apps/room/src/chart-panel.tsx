/**
 * Painel HTML do grafico (lightweight-charts) — overlay ao clicar WallMedia.
 * Prefere feed REST; cai no mock se offline.
 */
import { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries, type IChartApi } from 'lightweight-charts';
import { aquecerSerie } from './market-cache';

interface Props {
  seriesId: string;
  altura?: number;
  urlWs?: string;
  token?: string;
}

export function ChartPanel({ seriesId, altura = 220, urlWs, token }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let vivo = true;

    const chart = createChart(host, {
      width: host.clientWidth || 280,
      height: altura,
      layout: {
        background: { color: '#0c1210' },
        textColor: '#8aa094',
      },
      grid: {
        vertLines: { color: '#1a2822' },
        horzLines: { color: '#1a2822' },
      },
      rightPriceScale: { borderColor: '#2a3a34' },
      timeScale: { borderColor: '#2a3a34' },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#7dba7a',
      downColor: '#d47868',
      borderVisible: false,
      wickUpColor: '#7dba7a',
      wickDownColor: '#d47868',
    });
    chartRef.current = chart;

    void aquecerSerie(seriesId, urlWs, token, 80).then((dados) => {
      if (!vivo) return;
      series.setData(dados.map((c) => ({
        time: c.time as `${number}-${number}-${number}`,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })));
      chart.timeScale().fitContent();
    });

    const ro = new ResizeObserver(() => {
      if (!hostRef.current) return;
      chart.applyOptions({ width: hostRef.current.clientWidth });
    });
    ro.observe(host);

    return () => {
      vivo = false;
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [seriesId, altura, urlWs, token]);

  return <div ref={hostRef} className="chart-panel" style={{ width: '100%', height: altura }} />;
}
