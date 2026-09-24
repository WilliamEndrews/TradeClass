/**
 * Painel HTML do grafico (lightweight-charts) — overlay ao clicar WallMedia.
 * O preview na parede continua sendo blit offscreen (ohlcv-mock.blitCandles).
 */
import { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries, type IChartApi } from 'lightweight-charts';
import { gerarSerieOHLCV } from './ohlcv-mock';

interface Props {
  seriesId: string;
  altura?: number;
}

export function ChartPanel({ seriesId, altura = 220 }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

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
    const dados = gerarSerieOHLCV(seriesId, 80);
    series.setData(dados.map((c) => ({
      time: c.time as `${number}-${number}-${number}`,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    })));
    chart.timeScale().fitContent();
    chartRef.current = chart;

    const ro = new ResizeObserver(() => {
      if (!hostRef.current) return;
      chart.applyOptions({ width: hostRef.current.clientWidth });
    });
    ro.observe(host);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [seriesId, altura]);

  return <div ref={hostRef} className="chart-panel" style={{ width: '100%', height: altura }} />;
}
