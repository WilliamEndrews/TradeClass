/**
 * Serie OHLCV mock + helper de grafico para wall media (Fase 1 web charts).
 */
export type Candle = { time: number; open: number; high: number; low: number; close: number };

/** Gera candles deterministicos a partir de um seed textual. */
export function gerarSerieMock(seriesId: string, n = 60, base = 100): Candle[] {
  let h = 2166136261;
  for (let i = 0; i < seriesId.length; i++) {
    h ^= seriesId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const out: Candle[] = [];
  let preco = base + (h % 50);
  const agora = Math.floor(Date.now() / 1000);
  for (let i = 0; i < n; i++) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const delta = ((h % 1000) / 1000 - 0.45) * 2;
    const open = preco;
    const close = Math.max(1, open + delta);
    const high = Math.max(open, close) + Math.abs(delta) * 0.3;
    const low = Math.min(open, close) - Math.abs(delta) * 0.3;
    out.push({
      time: agora - (n - i) * 3600,
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
    });
    preco = close;
  }
  return out;
}

/** Desenha candles simplificados num canvas offscreen (blit / preview). */
export function desenharCandlesOffscreen(
  width: number,
  height: number,
  seriesId: string,
): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d')!;
  const candles = gerarSerieMock(seriesId);
  ctx.fillStyle = '#0c1210';
  ctx.fillRect(0, 0, width, height);
  const min = Math.min(...candles.map((x) => x.low));
  const max = Math.max(...candles.map((x) => x.high));
  const span = Math.max(0.01, max - min);
  const barW = width / candles.length;
  candles.forEach((k, i) => {
    const x = i * barW + barW * 0.5;
    const yHigh = height - ((k.high - min) / span) * (height - 8) - 4;
    const yLow = height - ((k.low - min) / span) * (height - 8) - 4;
    const yOpen = height - ((k.open - min) / span) * (height - 8) - 4;
    const yClose = height - ((k.close - min) / span) * (height - 8) - 4;
    const up = k.close >= k.open;
    ctx.strokeStyle = up ? '#7dba7a' : '#d47868';
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.moveTo(x, yHigh);
    ctx.lineTo(x, yLow);
    ctx.stroke();
    const top = Math.min(yOpen, yClose);
    const h = Math.max(1, Math.abs(yClose - yOpen));
    ctx.fillRect(x - barW * 0.3, top, barW * 0.6, h);
  });
  ctx.fillStyle = '#c4a35a';
  ctx.font = '10px monospace';
  ctx.fillText(seriesId, 6, 12);
  return c;
}
