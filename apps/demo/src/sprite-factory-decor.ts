/**
 * Sprites procedurais de decor de superficie (laptop, monitor, etc.).
 */
import type { PaletaResolvida } from '@tradeclass/world-engine';
import type { DecorKind } from './sprite-factory-types';
import {
  iso,
  corStr,
  escurecer,
  clarear,
  criarCanvas,
  caixaIso3D,
} from './sprite-factory-helpers';

export function renderizarDecor(kind: DecorKind, paleta: PaletaResolvida): HTMLCanvasElement {
  const w = 32;
  const h = 32;
  const { canvas, ctx } = criarCanvas(w, h);

  const ox = w / 2;
  const oy = h / 2 + 6;
  ctx.translate(ox, oy);

  switch (kind) {
    case 'laptop':
      renderizarLaptop(ctx, paleta);
      break;
    case 'monitor':
      renderizarMonitor(ctx, paleta);
      break;
    case 'keyboard':
      renderizarKeyboard(ctx, paleta);
      break;
    case 'mouse':
      renderizarMouse(ctx, paleta);
      break;
    case 'books':
      renderizarBooks(ctx, paleta);
      break;
    case 'radio':
      renderizarRadio(ctx, paleta);
      break;
  }

  return canvas;
}

export function renderizarLaptop(ctx: CanvasRenderingContext2D, paleta: PaletaResolvida): void {
  const c = iso(0.5, 0.5);
  // Base
  ctx.fillStyle = corStr(escurecer(paleta.monitorCorpo, 0.8));
  ctx.beginPath();
  ctx.roundRect(c.x - 8, c.y - 2, 16, 4, 1);
  ctx.fill();
  // Tela aberta
  ctx.fillStyle = corStr(paleta.monitorCorpo);
  ctx.beginPath();
  ctx.roundRect(c.x - 8, c.y - 10, 16, 8, 1);
  ctx.fill();
  // Tela brilhante
  const grad = ctx.createLinearGradient(c.x - 6, c.y - 9, c.x + 6, c.y - 3);
  grad.addColorStop(0, corStr(paleta.monitorTela, 0.9));
  grad.addColorStop(1, corStr(clarear(paleta.monitorTela, 0.15), 0.85));
  ctx.fillStyle = grad;
  ctx.fillRect(c.x - 6, c.y - 9, 12, 6);
  // Logo brilho
  ctx.fillStyle = corStr(0xffffff, 0.2);
  ctx.beginPath();
  ctx.moveTo(c.x - 5, c.y - 8);
  ctx.lineTo(c.x - 2, c.y - 8);
  ctx.lineTo(c.x, c.y - 4);
  ctx.lineTo(c.x - 3, c.y - 4);
  ctx.closePath();
  ctx.fill();
}

export function renderizarMonitor(ctx: CanvasRenderingContext2D, paleta: PaletaResolvida): void {
  const c = iso(0.5, 0.5);
  // Pe
  ctx.fillStyle = corStr(escurecer(paleta.monitorCorpo, 0.7));
  ctx.fillRect(c.x - 2, c.y - 2, 4, 2);
  // Base
  ctx.fillStyle = corStr(paleta.monitorCorpo);
  ctx.fillRect(c.x - 5, c.y, 10, 2);
  // Corpo
  ctx.fillStyle = corStr(paleta.monitorCorpo);
  ctx.beginPath();
  ctx.roundRect(c.x - 9, c.y - 12, 18, 10, 1);
  ctx.fill();
  // Tela
  const grad = ctx.createLinearGradient(c.x - 7, c.y - 11, c.x + 7, c.y - 3);
  grad.addColorStop(0, corStr(paleta.monitorTela, 0.9));
  grad.addColorStop(1, corStr(clarear(paleta.monitorTela, 0.15), 0.85));
  ctx.fillStyle = grad;
  ctx.fillRect(c.x - 7, c.y - 11, 14, 7);
  // Reflexo
  ctx.fillStyle = corStr(0xffffff, 0.08);
  ctx.beginPath();
  ctx.moveTo(c.x - 6, c.y - 10);
  ctx.lineTo(c.x - 2, c.y - 10);
  ctx.lineTo(c.x + 2, c.y - 5);
  ctx.lineTo(c.x - 2, c.y - 5);
  ctx.closePath();
  ctx.fill();
}

export function renderizarKeyboard(ctx: CanvasRenderingContext2D, paleta: PaletaResolvida): void {
  const c = iso(0.5, 0.5);
  ctx.fillStyle = corStr(paleta.teclado);
  ctx.beginPath();
  ctx.roundRect(c.x - 8, c.y - 2, 16, 4, 1);
  ctx.fill();
  ctx.fillStyle = corStr(clarear(paleta.teclado, 0.2), 0.6);
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(c.x - 7 + i * 3, c.y - 1, 2, 1.5);
  }
}

export function renderizarMouse(ctx: CanvasRenderingContext2D, paleta: PaletaResolvida): void {
  const c = iso(0.5, 0.5);
  ctx.fillStyle = corStr(clarear(paleta.teclado, 0.1));
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, 3, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = corStr(escurecer(paleta.teclado, 0.7), 0.5);
  ctx.fillRect(c.x - 0.5, c.y - 2, 1, 4);
}

export function renderizarBooks(ctx: CanvasRenderingContext2D, paleta: PaletaResolvida): void {
  const c = iso(0.5, 0.5);
  const cores = [0xd94f4f, 0x4f6df5, 0x3f8f52, 0xd0a056, 0x9a5fd0];
  for (let i = 0; i < 3; i++) {
    const py = c.y - 1 - i * 2.5;
    const cor = cores[i % cores.length] ?? 0xd94f4f;
    ctx.fillStyle = corStr(cor, 0.9);
    ctx.fillRect(c.x - 6 + i * 1.5, py, 12 - i * 1, 2.5);
  }
}

export function renderizarRadio(ctx: CanvasRenderingContext2D, paleta: PaletaResolvida): void {
  const c = iso(0.5, 0.5);
  // Corpo
  ctx.fillStyle = corStr(0x8d6e63);
  ctx.beginPath();
  ctx.roundRect(c.x - 6, c.y - 4, 12, 6, 1);
  ctx.fill();
  // Alto-falante
  ctx.fillStyle = corStr(0x4a3728, 0.6);
  ctx.beginPath();
  ctx.arc(c.x - 2, c.y - 1, 2, 0, Math.PI * 2);
  ctx.fill();
  // Dial
  ctx.fillStyle = corStr(0xffffff, 0.8);
  ctx.fillRect(c.x + 2, c.y - 3, 3, 2);
  // Antena
  ctx.strokeStyle = corStr(0x555555);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(c.x + 4, c.y - 4);
  ctx.lineTo(c.x + 6, c.y - 10);
  ctx.stroke();
}
