/**
 * Projecao e helpers de cor do renderer 2D do escritorio.
 */
import type { OfficeLayout } from '@tradeclass/contracts';
import type { PaletaResolvida } from '@tradeclass/world-engine';
import { ALTURA_TILE, LARGURA_TILE } from './projecao';

export interface Extensao {
  minX: number;
  minY: number;
  largura: number;
  altura: number;
}

export function iso(gx: number, gy: number): { x: number; y: number } {
  return { x: ((gx - gy) * LARGURA_TILE) / 2, y: ((gx + gy) * ALTURA_TILE) / 2 };
}

export function losango(gx: number, gy: number, recuo = 0) {
  const a = recuo;
  const b = 1 - recuo;
  return [iso(gx + a, gy + a), iso(gx + b, gy + a), iso(gx + b, gy + b), iso(gx + a, gy + b)];
}

export function extensaoDoMundo(layout: OfficeLayout): Extensao {
  const { width: w, height: h } = layout.grid;
  return {
    minX: (-h * LARGURA_TILE) / 2,
    minY: 0,
    largura: ((w + h) * LARGURA_TILE) / 2,
    altura: ((w + h) * ALTURA_TILE) / 2,
  };
}

export function caminho(ctx: CanvasRenderingContext2D, pts: Array<{ x: number; y: number }>): void {
  ctx.beginPath();
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
  ctx.closePath();
}

export function cantosDaSala(rect: { x0: number; y0: number; x1: number; y1: number }) {
  return [iso(rect.x0, rect.y0), iso(rect.x1, rect.y0), iso(rect.x1, rect.y1), iso(rect.x0, rect.y1)];
}

export function disco(ctx: CanvasRenderingContext2D, x: number, y: number, raio: number, matiz: number, alpha = 1): void {
  ctx.beginPath();
  ctx.arc(x, y, raio, 0, Math.PI * 2);
  ctx.fillStyle = cor(matiz, alpha);
  ctx.fill();
}

export function elipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, estilo: string): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = estilo;
  ctx.fill();
}

export function cor(matiz: number, alpha = 1): string {
  const v = Math.max(0, Math.min(0xffffff, Math.round(matiz)));
  const r = (v >> 16) & 0xff;
  const g = (v >> 8) & 0xff;
  const b = v & 0xff;
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

export function pseudoAleatorio(a: number, b: number): number {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

export function corDoAtor(agentId: string, interno: boolean, paleta: PaletaResolvida): number {
  if (interno) return agentId.includes('zelador') ? paleta.internoZelador : paleta.internoTecnico;
  let h = 0;
  for (let i = 0; i < agentId.length; i++) h = (h * 31 + agentId.charCodeAt(i)) >>> 0;
  return paleta.ator[h % paleta.ator.length] as number;
}

export function escurecer(matiz: number, fator: number): number {
  const r = Math.floor(((matiz >> 16) & 0xff) * fator);
  const g = Math.floor(((matiz >> 8) & 0xff) * fator);
  const b = Math.floor((matiz & 0xff) * fator);
  return (r << 16) | (g << 8) | b;
}

export function clarear(matiz: number, fator: number): number {
  const r = Math.min(255, Math.floor(((matiz >> 16) & 0xff) + (255 - ((matiz >> 16) & 0xff)) * fator));
  const g = Math.min(255, Math.floor(((matiz >> 8) & 0xff) + (255 - ((matiz >> 8) & 0xff)) * fator));
  const b = Math.min(255, Math.floor((matiz & 0xff) + (255 - (matiz & 0xff)) * fator));
  return (r << 16) | (g << 8) | b;
}

export function desenharTexturaPiso(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  material: string,
  base: number,
): void {
  const pts = losango(gx, gy, 0.02);
  const cx = (pts[0]!.x + pts[2]!.x) / 2;
  const cy = (pts[0]!.y + pts[2]!.y) / 2;

  switch (material) {
    case 'carpete': {
      // Tecido felpudo: pontilhado denso com variacao de cor e sombra em V.
      const h = gx * 17 + gy * 31;
      for (let i = 0; i < 14; i++) {
        const px = cx + ((h + i * 7) % 24) - 12;
        const py = cy + ((h + i * 5 + 11) % 14) - 7;
        ctx.fillStyle = cor(i % 2 === 0 ? escurecer(base, 0.88) : clarear(base, 0.1), 0.5);
        ctx.fillRect(px, py, 1.5, 1.5);
      }
      ctx.strokeStyle = cor(escurecer(base, 0.75), 0.15);
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy + 4);
      ctx.lineTo(cx - 4, cy);
      ctx.lineTo(cx, cy + 4);
      ctx.lineTo(cx + 4, cy);
      ctx.lineTo(cx + 8, cy + 4);
      ctx.stroke();
      break;
    }
    case 'madeira': {
      // Tabuas com veios sinuosos, no e reflexo.
      ctx.strokeStyle = cor(escurecer(base, 0.7), 0.55);
      ctx.lineWidth = 0.8;
      for (let i = 1; i < 3; i++) {
        const t = i / 3;
        const a = iso(gx, gy + t);
        const b = iso(gx + 1, gy + t);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.strokeStyle = cor(escurecer(base, 0.65), 0.35);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy - 2);
      ctx.bezierCurveTo(cx - 4, cy - 5, cx + 2, cy + 2, cx + 10, cy - 1);
      ctx.stroke();
      ctx.fillStyle = cor(escurecer(base, 0.55), 0.4);
      ctx.beginPath();
      ctx.ellipse(cx + 1, cy, 3, 1.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = cor(clarear(base, 0.08), 0.25);
      ctx.fillRect(cx - 6, cy - 4, 12, 2);
      break;
    }
    case 'azulejo': {
      // Ladrilho 2x2 com juntas escuras, borda e reflexo de porcelana.
      ctx.strokeStyle = cor(escurecer(base, 0.55), 0.75);
      ctx.lineWidth = 1;
      const m1 = iso(gx + 0.5, gy);
      const m2 = iso(gx + 0.5, gy + 1);
      ctx.beginPath();
      ctx.moveTo(m1.x, m1.y);
      ctx.lineTo(m2.x, m2.y);
      ctx.stroke();
      const m3 = iso(gx, gy + 0.5);
      const m4 = iso(gx + 1, gy + 0.5);
      ctx.beginPath();
      ctx.moveTo(m3.x, m3.y);
      ctx.lineTo(m4.x, m4.y);
      ctx.stroke();
      const borda = losango(gx, gy, 0.06);
      caminho(ctx, borda);
      ctx.strokeStyle = cor(escurecer(base, 0.6), 0.5);
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.fillStyle = cor(clarear(base, 0.2), 0.25);
      ctx.beginPath();
      ctx.ellipse(cx - 3, cy - 4, 8, 3, -0.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'cimento': {
      // Cimento com manchas, rachaduras e juntas de dilatacao.
      ctx.fillStyle = cor(escurecer(base, 0.78), 0.4);
      ctx.beginPath();
      ctx.ellipse(cx + 4, cy - 2, 6, 3, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = cor(clarear(base, 0.06), 0.3);
      ctx.beginPath();
      ctx.ellipse(cx - 3, cy + 3, 5, 3.5, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = cor(escurecer(base, 0.55), 0.35);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy - 4);
      ctx.lineTo(cx - 2, cy - 1);
      ctx.lineTo(cx + 1, cy - 2);
      ctx.moveTo(cx + 2, cy + 2);
      ctx.lineTo(cx + 7, cy + 4);
      ctx.stroke();
      ctx.strokeStyle = cor(escurecer(base, 0.5), 0.25);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      const j1 = iso(gx, gy + 0.7);
      const j2 = iso(gx + 1, gy + 0.7);
      ctx.moveTo(j1.x, j1.y);
      ctx.lineTo(j2.x, j2.y);
      ctx.stroke();
      break;
    }
  }
}
