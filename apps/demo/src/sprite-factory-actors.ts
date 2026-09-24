/**
 * Sprites procedurais de atores (personagens isometricos).
 */
import type { PaletaResolvida } from '@tradeclass/world-engine';
import { ALTURA_PERSONAGEM } from './projecao';
import { SUPER, corStr, escurecer, clarear, criarCanvas } from './sprite-factory-helpers';

export function renderizarAtor(corCorpo: number, interno: boolean, paleta: PaletaResolvida): HTMLCanvasElement {
  const w = 32;
  const h = 56;
  const { canvas, ctx } = criarCanvas(w, h);

  const cx = w / 2;
  const cy = h / 2 + 10;

  // Sombra suave no chao
  ctx.save();
  ctx.filter = 'blur(2px)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, 10, 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = corStr(0x000000, 0.22);
  ctx.fill();
  ctx.restore();

  // Pernas (calca)
  const gradPernas = ctx.createLinearGradient(cx, cy - 8, cx, cy + 2);
  gradPernas.addColorStop(0, corStr(escurecer(corCorpo, 0.7)));
  gradPernas.addColorStop(1, corStr(escurecer(corCorpo, 0.85)));
  ctx.fillStyle = gradPernas;
  ctx.fillRect(cx - 5, cy - 8, 4, 10);
  ctx.fillRect(cx + 1, cy - 8, 4, 10);

  // Pes
  ctx.fillStyle = corStr(0x333333);
  ctx.fillRect(cx - 5, cy + 1, 4, 2);
  ctx.fillRect(cx + 1, cy + 1, 4, 2);

  // Corpo (tronco) com gradiente
  const gradCorpo = ctx.createLinearGradient(cx, cy - 24, cx, cy - 6);
  gradCorpo.addColorStop(0, corStr(clarear(corCorpo, 0.18)));
  gradCorpo.addColorStop(0.5, corStr(corCorpo));
  gradCorpo.addColorStop(1, corStr(escurecer(corCorpo, 0.82)));
  ctx.fillStyle = gradCorpo;
  ctx.beginPath();
  ctx.roundRect(cx - 8, cy - 24, 16, 18, 4);
  ctx.fill();

  // Braco esquerdo
  ctx.fillStyle = corStr(escurecer(corCorpo, 0.88));
  ctx.beginPath();
  ctx.roundRect(cx - 10, cy - 22, 4, 12, 2);
  ctx.fill();

  // Braco direito
  ctx.fillStyle = corStr(escurecer(corCorpo, 0.88));
  ctx.beginPath();
  ctx.roundRect(cx + 6, cy - 22, 4, 12, 2);
  ctx.fill();

  // Maos
  ctx.fillStyle = corStr(paleta.atorPele);
  ctx.beginPath();
  ctx.arc(cx - 8, cy - 10, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 8, cy - 10, 2, 0, Math.PI * 2);
  ctx.fill();

  // Highlight no ombro esquerdo
  ctx.fillStyle = corStr(clarear(corCorpo, 0.3), 0.35);
  ctx.beginPath();
  ctx.roundRect(cx - 7, cy - 23, 5, 6, 2);
  ctx.fill();

  // Cabeca com gradiente
  const gradCabeca = ctx.createRadialGradient(cx - 2, cy - 30, 0, cx, cy - 28, 8);
  gradCabeca.addColorStop(0, corStr(clarear(paleta.atorPele, 0.08)));
  gradCabeca.addColorStop(1, corStr(escurecer(paleta.atorPele, 0.9)));
  ctx.fillStyle = gradCabeca;
  ctx.beginPath();
  ctx.arc(cx, cy - 28, 7, 0, Math.PI * 2);
  ctx.fill();

  // Cabelo
  ctx.fillStyle = corStr(paleta.atorCabelo);
  ctx.beginPath();
  ctx.arc(cx, cy - 31, 7, Math.PI + 0.2, -0.2);
  ctx.fill();
  // Franja
  ctx.fillStyle = corStr(escurecer(paleta.atorCabelo, 0.9), 0.8);
  ctx.beginPath();
  ctx.ellipse(cx, cy - 32, 5, 2.5, 0, 0, Math.PI);
  ctx.fill();

  // Olhos
  ctx.fillStyle = corStr(0x222222);
  ctx.fillRect(cx - 3, cy - 28, 1.5, 1.5);
  ctx.fillRect(cx + 1.5, cy - 28, 1.5, 1.5);

  // Uniforme de agente interno: faixa no peito
  if (interno) {
    ctx.fillStyle = corStr(escurecer(corCorpo, 0.6), 0.8);
    ctx.fillRect(cx - 8, cy - 16, 16, 2.5);
    // Distintivo
    ctx.fillStyle = corStr(clarear(corCorpo, 0.3), 0.7);
    ctx.beginPath();
    ctx.arc(cx, cy - 14.5, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

export function desenharSpriteAtor(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  x: number,
  y: number,
  bob: number,
): void {
  const alturaLogica = sprite.height / SUPER;
  const escala = ALTURA_PERSONAGEM / alturaLogica;
  const sw = (sprite.width / SUPER) * escala;
  const sh = alturaLogica * escala;
  ctx.drawImage(sprite, x - sw / 2, y - sh - bob, sw, sh);
}
