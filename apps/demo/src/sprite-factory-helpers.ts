/**
 * Helpers de desenho procedural da fabrica de sprites.
 */
import { iso as isoCompartilhado } from './projecao';

export const SUPER = 2;
export const iso = isoCompartilhado;

export function losango(gx: number, gy: number, recuo = 0) {
  const a = recuo;
  const b = 1 - recuo;
  return [iso(gx + a, gy + a), iso(gx + b, gy + a), iso(gx + b, gy + b), iso(gx + a, gy + b)];
}

// ---------------------------------------------------------------------------
// Cores
// ---------------------------------------------------------------------------

export function corStr(matiz: number, alpha = 1): string {
  const v = Math.max(0, Math.min(0xffffff, Math.round(matiz)));
  const r = (v >> 16) & 0xff;
  const g = (v >> 8) & 0xff;
  const b = v & 0xff;
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
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

// ---------------------------------------------------------------------------
// Canvas helper
// ---------------------------------------------------------------------------

export function criarCanvas(largura: number, altura: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(largura * SUPER);
  canvas.height = Math.ceil(altura * SUPER);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SUPER, SUPER);
  return { canvas, ctx };
}

export function path(ctx: CanvasRenderingContext2D, pts: Array<{ x: number; y: number }>): void {
  ctx.beginPath();
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// Caixa isometrica 3D-like com gradientes e sombras
// ---------------------------------------------------------------------------

export function caixaIso3D(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  altura: number,
  corTopo: number,
  corLado: number,
  recuo: number,
): void {
  const base = losango(gx, gy, recuo);
  const topo = base.map((p) => ({ x: p.x, y: p.y - altura }));

  ctx.save();
  ctx.filter = 'blur(3px)';
  path(ctx, base);
  ctx.fillStyle = corStr(0x000000, 0.18);
  ctx.fill();
  ctx.restore();

  const gradEsq = ctx.createLinearGradient(base[3]!.x, base[3]!.y, topo[3]!.x, topo[3]!.y);
  gradEsq.addColorStop(0, corStr(escurecer(corLado, 0.82)));
  gradEsq.addColorStop(1, corStr(corLado));
  path(ctx, [base[3]!, base[2]!, topo[2]!, topo[3]!]);
  ctx.fillStyle = gradEsq;
  ctx.fill();

  const gradDir = ctx.createLinearGradient(base[2]!.x, base[2]!.y, topo[2]!.x, topo[2]!.y);
  gradDir.addColorStop(0, corStr(escurecer(corLado, 0.68)));
  gradDir.addColorStop(1, corStr(escurecer(corLado, 0.86)));
  path(ctx, [base[2]!, base[1]!, topo[1]!, topo[2]!]);
  ctx.fillStyle = gradDir;
  ctx.fill();

  const cx = (topo[0]!.x + topo[2]!.x) / 2;
  const cy = (topo[0]!.y + topo[2]!.y) / 2;
  const raio = Math.hypot(topo[0]!.x - topo[2]!.x, topo[0]!.y - topo[2]!.y) / 2;
  const gradTopo = ctx.createRadialGradient(cx - raio * 0.3, cy - raio * 0.2, 0, cx, cy, raio);
  gradTopo.addColorStop(0, corStr(clarear(corTopo, 0.15)));
  gradTopo.addColorStop(0.6, corStr(corTopo));
  gradTopo.addColorStop(1, corStr(escurecer(corTopo, 0.9)));
  path(ctx, topo);
  ctx.fillStyle = gradTopo;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(topo[0]!.x, topo[0]!.y);
  ctx.lineTo(topo[1]!.x, topo[1]!.y);
  ctx.strokeStyle = corStr(clarear(corTopo, 0.35), 0.5);
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(base[3]!.x, base[3]!.y);
  ctx.lineTo(base[2]!.x, base[2]!.y);
  ctx.lineTo(base[1]!.x, base[1]!.y);
  ctx.strokeStyle = corStr(0x000000, 0.22);
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
