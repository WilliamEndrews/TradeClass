/**
 * Gerador mock de series OHLCV para preview de WallMedia (Fase 1).
 * Deterministico por seriesId+seed — replay e testes ficam estaveis.
 */

export interface CandleOHLCV {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function prng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function diaISO(base: Date, offset: number): string {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

/** Gera N candles diarios a partir de um seriesId (ex.: BTC-USD, EURUSD). */
export function gerarSerieOHLCV(seriesId: string, barras = 60, seedExtra = 0): CandleOHLCV[] {
  const rnd = prng(hashSeed(seriesId) ^ (seedExtra >>> 0));
  const basePreco =
    seriesId.toUpperCase().includes('BTC') ? 62_000
    : seriesId.toUpperCase().includes('GOLD') || seriesId.toUpperCase().includes('XAU') ? 2_350
    : seriesId.toUpperCase().includes('EUR') ? 1.08
    : 100 + (hashSeed(seriesId) % 400);

  const volatilidade = basePreco * 0.012;
  let close = basePreco;
  const hoje = new Date();
  hoje.setUTCHours(0, 0, 0, 0);
  const out: CandleOHLCV[] = [];

  for (let i = 0; i < barras; i++) {
    const drift = (rnd() - 0.48) * volatilidade;
    const open = close;
    const high = open + Math.abs(drift) + rnd() * volatilidade * 0.4;
    const low = open - Math.abs(drift) - rnd() * volatilidade * 0.4;
    close = Math.max(low, Math.min(high, open + drift));
    out.push({
      time: diaISO(hoje, i - barras + 1),
      open: arred(open),
      high: arred(high),
      low: arred(low),
      close: arred(close),
      volume: Math.round(800 + rnd() * 4200),
    });
  }
  return out;
}

function arred(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** Blit offscreen de candles (preview de parede) — sem DOM / lightweight-charts. */
export function blitCandles(
  ctx: CanvasRenderingContext2D,
  candles: readonly CandleOHLCV[],
  w: number,
  h: number,
  opts?: { up?: string; down?: string; bg?: string },
): void {
  const up = opts?.up ?? '#7dba7a';
  const down = opts?.down ?? '#d47868';
  const bg = opts?.bg ?? '#0c1210';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  if (candles.length < 2) return;

  let min = Infinity;
  let max = -Infinity;
  for (const c of candles) {
    if (c.low < min) min = c.low;
    if (c.high > max) max = c.high;
  }
  const range = max - min || 1;
  const pad = 4;
  const bodyW = Math.max(1, (w - pad * 2) / candles.length - 1);

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]!;
    const x = pad + i * ((w - pad * 2) / candles.length) + bodyW / 2;
    const yHigh = pad + ((max - c.high) / range) * (h - pad * 2);
    const yLow = pad + ((max - c.low) / range) * (h - pad * 2);
    const yOpen = pad + ((max - c.open) / range) * (h - pad * 2);
    const yClose = pad + ((max - c.close) / range) * (h - pad * 2);
    const cor = c.close >= c.open ? up : down;
    ctx.strokeStyle = cor;
    ctx.beginPath();
    ctx.moveTo(x, yHigh);
    ctx.lineTo(x, yLow);
    ctx.stroke();
    ctx.fillStyle = cor;
    const top = Math.min(yOpen, yClose);
    const bodyH = Math.max(1, Math.abs(yClose - yOpen));
    ctx.fillRect(x - bodyW / 2, top, bodyW, bodyH);
  }
}
