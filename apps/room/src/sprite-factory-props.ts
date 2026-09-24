/**
 * Sprites de props de escritorio: impressora, medidor, cafe, bebedouro, tapete.
 */
import type { PaletaResolvida } from '@tradeclass/world-engine';
import {
  iso,
  losango,
  corStr,
  escurecer,
  clarear,
  caixaIso3D,
  path,
} from './sprite-factory-helpers';

export function renderizarImpressora(ctx: CanvasRenderingContext2D, paleta: PaletaResolvida): void {
  const c = iso(0.5, 0.5);

  // Sombra
  ctx.save();
  ctx.filter = 'blur(3px)';
  path(ctx, losango(0, 0, 0.1));
  ctx.fillStyle = corStr(0x000000, 0.15);
  ctx.fill();
  ctx.restore();

  // Corpo da impressora
  caixaIso3D(ctx, 0, 0, 10, 0xd7dbe0, 0xa8aeb6, 0.18);

  // Bandeja superior (relevo)
  ctx.fillStyle = corStr(escurecer(0xd7dbe0, 0.85));
  ctx.beginPath();
  ctx.roundRect(c.x - 9, c.y - 14, 18, 3, 1);
  ctx.fill();

  // Slot de papel (fenda escura)
  ctx.fillStyle = corStr(0x333333);
  ctx.fillRect(c.x - 8, c.y - 11, 16, 2);

  // Papel saindo
  ctx.fillStyle = corStr(0xfdfdfd, 0.85);
  ctx.fillRect(c.x - 6, c.y - 15, 12, 4);
  ctx.fillStyle = corStr(0xc9c4bb, 0.5);
  ctx.fillRect(c.x - 6, c.y - 13, 12, 1);

  // Painel de controle
  ctx.fillStyle = corStr(0x444444);
  ctx.beginPath();
  ctx.roundRect(c.x + 4, c.y - 9, 6, 4, 1);
  ctx.fill();

  // LED de status (verde)
  ctx.beginPath();
  ctx.arc(c.x + 7, c.y - 7, 1.2, 0, Math.PI * 2);
  ctx.fillStyle = corStr(0x3f8f52);
  ctx.fill();
  // Halo do LED
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.beginPath();
  ctx.arc(c.x + 7, c.y - 7, 3, 0, Math.PI * 2);
  ctx.fillStyle = corStr(0x3f8f52, 0.2);
  ctx.fill();
  ctx.restore();
}

export function renderizarMedidor(ctx: CanvasRenderingContext2D, paleta: PaletaResolvida): void {
  const c = iso(0.5, 0.5);

  // Sombra
  ctx.save();
  ctx.filter = 'blur(3px)';
  path(ctx, losango(0, 0, 0.15));
  ctx.fillStyle = corStr(0x000000, 0.15);
  ctx.fill();
  ctx.restore();

  // Corpo do medidor
  caixaIso3D(ctx, 0, 0, 16, 0xdfe4ea, 0xa8b0ba, 0.22);

  // Display digital
  ctx.fillStyle = corStr(0x0a0a0a);
  ctx.beginPath();
  ctx.roundRect(c.x - 8, c.y - 22, 16, 9, 1);
  ctx.fill();

  // Borda do display
  ctx.strokeStyle = corStr(0x333333, 0.8);
  ctx.lineWidth = 1;
  ctx.stroke();

  // Numeros no display (verde LCD)
  ctx.fillStyle = corStr(0x00ff88, 0.85);
  ctx.font = 'bold 6px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('8.7', c.x, c.y - 15);

  // Brilho do display
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = corStr(0x00ff88, 0.08);
  ctx.fillRect(c.x - 7, c.y - 21, 14, 7);
  ctx.restore();

  // BotÃµes
  ctx.fillStyle = corStr(0x888888);
  ctx.beginPath();
  ctx.arc(c.x - 6, c.y - 8, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(c.x + 6, c.y - 8, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

export function renderizarMaquinaCafe(ctx: CanvasRenderingContext2D, paleta: PaletaResolvida): void {
  const c = iso(0.5, 0.5);

  // Sombra
  ctx.save();
  ctx.filter = 'blur(3px)';
  path(ctx, losango(0, 0, 0.2));
  ctx.fillStyle = corStr(0x000000, 0.15);
  ctx.fill();
  ctx.restore();

  // Corpo da maquina
  caixaIso3D(ctx, 0, 0, 12, 0x8d6e63, 0x6d5248, 0.18);

  // Reservatorio de agua (transparente)
  ctx.fillStyle = corStr(0x4a90d9, 0.15);
  ctx.beginPath();
  ctx.roundRect(c.x - 7, c.y - 18, 6, 12, 1);
  ctx.fill();
  ctx.strokeStyle = corStr(0x4a90d9, 0.3);
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Bico de saida
  ctx.fillStyle = corStr(0x555555);
  ctx.fillRect(c.x - 2, c.y - 14, 4, 4);

  // Caneca sob o bico
  ctx.fillStyle = corStr(0xffffff, 0.9);
  ctx.beginPath();
  ctx.roundRect(c.x - 4, c.y - 8, 8, 6, 1.5);
  ctx.fill();
  // Cafe na caneca
  ctx.fillStyle = corStr(0x4a2c17, 0.85);
  ctx.beginPath();
  ctx.ellipse(c.x, c.y - 7, 3, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Vapor
  ctx.strokeStyle = corStr(0xffffff, 0.25);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y - 16);
  ctx.quadraticCurveTo(c.x + 3, c.y - 20, c.x - 1, c.y - 24);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(c.x + 2, c.y - 16);
  ctx.quadraticCurveTo(c.x - 2, c.y - 21, c.x + 3, c.y - 25);
  ctx.stroke();

  // LED de aquecimento
  ctx.beginPath();
  ctx.arc(c.x + 5, c.y - 16, 1, 0, Math.PI * 2);
  ctx.fillStyle = corStr(0xff4444, 0.8);
  ctx.fill();
}


export function renderizarBebedouro(ctx: CanvasRenderingContext2D, paleta: PaletaResolvida): void {
  const c = iso(0.5, 0.5);

  // Base
  caixaIso3D(ctx, 0, 0, 14, 0xd7dbe0, 0xa8aeb6, 0.22);

  // Painel frontal
  ctx.fillStyle = corStr(0x2a3a5a, 0.9);
  ctx.fillRect(c.x - 7, c.y - 14, 14, 12);

  // Garrafa de agua azul translucida
  ctx.fillStyle = corStr(0x4a90d9, 0.4);
  ctx.beginPath();
  ctx.ellipse(c.x, c.y - 8, 4, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Nivel da agua
  ctx.fillStyle = corStr(0x7fc4ff, 0.5);
  ctx.beginPath();
  ctx.ellipse(c.x, c.y - 6, 3.5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Torneira
  ctx.strokeStyle = corStr(0x888888);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y - 16);
  ctx.lineTo(c.x, c.y - 11);
  ctx.stroke();
  ctx.fillStyle = corStr(0x888888);
  ctx.beginPath();
  ctx.arc(c.x, c.y - 9, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // LED verde
  ctx.fillStyle = corStr(0x3f8f52);
  ctx.beginPath();
  ctx.arc(c.x + 4, c.y - 14, 1, 0, Math.PI * 2);
  ctx.fill();
}

export function renderizarTapete(ctx: CanvasRenderingContext2D, paleta: PaletaResolvida): void {
  const c = iso(0.5, 0.5);

  // Tapete fino, achatado no chao
  ctx.save();
  ctx.filter = 'blur(1px)';
  path(ctx, losango(0, 0, 0.25));
  ctx.fillStyle = corStr(0x000000, 0.08);
  ctx.fill();
  ctx.restore();

  // Corpo do tapete
  const gradRug = ctx.createRadialGradient(c.x - 4, c.y - 4, 0, c.x, c.y, 18);
  gradRug.addColorStop(0, corStr(clarear(paleta.tapete, 0.1)));
  gradRug.addColorStop(0.6, corStr(paleta.tapete));
  gradRug.addColorStop(1, corStr(escurecer(paleta.tapete, 0.85)));
  path(ctx, losango(0, 0, 0.22));
  ctx.fillStyle = gradRug;
  ctx.fill();

  // Borda
  path(ctx, losango(0, 0, 0.28));
  ctx.strokeStyle = corStr(escurecer(paleta.tapete, 0.6), 0.5);
  ctx.lineWidth = 1;
  ctx.stroke();

  // Padrao central
  ctx.fillStyle = corStr(clarear(paleta.tapete, 0.2), 0.5);
  ctx.beginPath();
  ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = corStr(escurecer(paleta.tapete, 0.7), 0.4);
  ctx.beginPath();
  ctx.arc(c.x, c.y, 3, 0, Math.PI * 2);
  ctx.fill();
}
