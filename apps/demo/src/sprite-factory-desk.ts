/**
 * Sprites procedurais de mesa / assento (desk, sofa, chair).
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

export function renderizarMesa(ctx: CanvasRenderingContext2D, paleta: PaletaResolvida): void {
  const c = iso(0.5, 0.5);

  // Sombra da cadeira (atras da mesa)
  ctx.save();
  ctx.filter = 'blur(3px)';
  ctx.beginPath();
  ctx.ellipse(c.x, c.y + 8, 10, 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = corStr(0x000000, 0.12);
  ctx.fill();
  ctx.restore();

  // Cadeira giratoria (atras da mesa, parcialmente visivel)
  const gradCad = ctx.createLinearGradient(c.x, c.y - 6, c.x, c.y + 6);
  gradCad.addColorStop(0, corStr(paleta.cadeiraEncosto));
  gradCad.addColorStop(1, corStr(paleta.cadeira));
  ctx.fillStyle = gradCad;
  ctx.beginPath();
  ctx.roundRect(c.x - 8, c.y - 4, 16, 10, 3);
  ctx.fill();
  // Encosto da cadeira
  ctx.fillStyle = corStr(escurecer(paleta.cadeiraEncosto, 0.85), 0.9);
  ctx.beginPath();
  ctx.roundRect(c.x - 8, c.y - 10, 16, 5, 2);
  ctx.fill();

  // Tampo da mesa
  caixaIso3D(ctx, 0, 0, 8, paleta.mesaTopo, paleta.mesaLado, 0.1);

  // Pernas da mesa (4 pernas finas)
  const pernas = losango(0, 0, 0.15);
  for (const p of pernas) {
    ctx.fillStyle = corStr(paleta.mesaPerna);
    ctx.fillRect(p.x - 1, p.y, 2, 6);
  }

  // Monitor sobre a mesa
  const mc = iso(0.5, 0.5);
  // Pe do monitor
  ctx.fillStyle = corStr(escurecer(paleta.monitorCorpo, 0.7));
  ctx.fillRect(mc.x - 2, mc.y - 12, 4, 3);
  // Base do monitor
  ctx.fillStyle = corStr(paleta.monitorCorpo);
  ctx.fillRect(mc.x - 5, mc.y - 10, 10, 2);

  // Corpo do monitor (escuro, retroiluminado)
  const gradMon = ctx.createLinearGradient(mc.x - 8, mc.y - 22, mc.x + 8, mc.y - 10);
  gradMon.addColorStop(0, corStr(escurecer(paleta.monitorCorpo, 0.8)));
  gradMon.addColorStop(0.5, corStr(paleta.monitorCorpo));
  gradMon.addColorStop(1, corStr(escurecer(paleta.monitorCorpo, 0.9)));
  ctx.fillStyle = gradMon;
  ctx.beginPath();
  ctx.roundRect(mc.x - 9, mc.y - 22, 18, 12, 1.5);
  ctx.fill();

  // Tela do monitor (brilho azul)
  const gradTela = ctx.createLinearGradient(mc.x - 7, mc.y - 20, mc.x + 7, mc.y - 12);
  gradTela.addColorStop(0, corStr(paleta.monitorTela, 0.9));
  gradTela.addColorStop(0.5, corStr(clarear(paleta.monitorTela, 0.15), 0.85));
  gradTela.addColorStop(1, corStr(paleta.monitorTela, 0.9));
  ctx.fillStyle = gradTela;
  ctx.fillRect(mc.x - 7, mc.y - 20, 14, 9);

  // Reflexo na tela
  ctx.fillStyle = corStr(0xffffff, 0.08);
  ctx.beginPath();
  ctx.moveTo(mc.x - 6, mc.y - 19);
  ctx.lineTo(mc.x - 2, mc.y - 19);
  ctx.lineTo(mc.x + 2, mc.y - 12);
  ctx.lineTo(mc.x - 4, mc.y - 12);
  ctx.closePath();
  ctx.fill();

  // Linhas de codigo na tela
  ctx.fillStyle = corStr(0x6cf7a0, 0.4);
  ctx.fillRect(mc.x - 5, mc.y - 18, 6, 1);
  ctx.fillRect(mc.x - 5, mc.y - 16, 4, 1);
  ctx.fillRect(mc.x - 5, mc.y - 14, 7, 1);

  // Teclado sobre a mesa
  ctx.fillStyle = corStr(paleta.teclado);
  ctx.beginPath();
  ctx.roundRect(mc.x - 7, mc.y - 5, 14, 4, 1);
  ctx.fill();
  // Teclas
  ctx.fillStyle = corStr(clarear(paleta.teclado, 0.2), 0.6);
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(mc.x - 6 + i * 2.5, mc.y - 4, 1.5, 1.5);
  }

  // Mouse
  ctx.fillStyle = corStr(clarear(paleta.teclado, 0.1));
  ctx.beginPath();
  ctx.ellipse(mc.x + 8, mc.y - 3, 2.5, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function renderizarSofa(ctx: CanvasRenderingContext2D, paleta: PaletaResolvida): void {
  const c = iso(0.5, 0.5);

  // Sombra
  ctx.save();
  ctx.filter = 'blur(4px)';
  path(ctx, losango(0, 0, 0.05));
  ctx.fillStyle = corStr(0x000000, 0.15);
  ctx.fill();
  ctx.restore();

  // Base do sofa (caixa larga)
  caixaIso3D(ctx, 0, 0, 6, paleta.sofa, escurecer(paleta.sofa, 0.8), 0.06);

  // Braco esquerdo
  const bl = iso(0.08, 0.5);
  ctx.fillStyle = corStr(escurecer(paleta.sofa, 0.85));
  ctx.beginPath();
  ctx.roundRect(bl.x - 3, bl.y - 12, 6, 14, 2);
  ctx.fill();
  ctx.fillStyle = corStr(clarear(paleta.sofa, 0.08), 0.4);
  ctx.beginPath();
  ctx.roundRect(bl.x - 2, bl.y - 11, 4, 5, 1.5);
  ctx.fill();

  // Braco direito
  const br = iso(0.92, 0.5);
  ctx.fillStyle = corStr(escurecer(paleta.sofa, 0.85));
  ctx.beginPath();
  ctx.roundRect(br.x - 3, br.y - 12, 6, 14, 2);
  ctx.fill();
  ctx.fillStyle = corStr(clarear(paleta.sofa, 0.08), 0.4);
  ctx.beginPath();
  ctx.roundRect(br.x - 2, br.y - 11, 4, 5, 1.5);
  ctx.fill();

  // Encosto alto (atrÃ¡s)
  const enc = iso(0.5, 0.12);
  const gradEnc = ctx.createLinearGradient(enc.x, enc.y - 18, enc.x, enc.y - 4);
  gradEnc.addColorStop(0, corStr(paleta.sofaEncosto));
  gradEnc.addColorStop(1, corStr(escurecer(paleta.sofaEncosto, 0.85)));
  ctx.fillStyle = gradEnc;
  ctx.beginPath();
  ctx.roundRect(enc.x - 14, enc.y - 18, 28, 14, 4);
  ctx.fill();

  // Almofadas (2)
  for (const offset of [-6, 6]) {
    const ac = iso(0.5, 0.5);
    const gradAlm = ctx.createRadialGradient(ac.x + offset - 2, ac.y - 8, 0, ac.x + offset, ac.y - 6, 7);
    gradAlm.addColorStop(0, corStr(clarear(paleta.sofaAlmofada, 0.15)));
    gradAlm.addColorStop(0.7, corStr(paleta.sofaAlmofada));
    gradAlm.addColorStop(1, corStr(escurecer(paleta.sofaAlmofada, 0.85)));
    ctx.fillStyle = gradAlm;
    ctx.beginPath();
    ctx.ellipse(ac.x + offset, ac.y - 6, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Highlight no encosto
  ctx.fillStyle = corStr(clarear(paleta.sofaEncosto, 0.2), 0.3);
  ctx.beginPath();
  ctx.roundRect(enc.x - 12, enc.y - 17, 24, 3, 1.5);
  ctx.fill();
}


export function renderizarCadeira(ctx: CanvasRenderingContext2D, paleta: PaletaResolvida): void {
  const c = iso(0.5, 0.5);

  // Sombra
  ctx.save();
  ctx.filter = 'blur(2px)';
  ctx.beginPath();
  ctx.ellipse(c.x, c.y + 4, 9, 4, 0, 0, Math.PI * 2);
  ctx.fillStyle = corStr(0x000000, 0.15);
  ctx.fill();
  ctx.restore();

  // Base/cinco rodas
  ctx.fillStyle = corStr(0x333333, 0.9);
  for (const a of [-0.6, -0.2, 0.2, 0.6]) {
    ctx.beginPath();
    ctx.ellipse(c.x + a * 10, c.y + 4, 2, 1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Coluna central
  ctx.strokeStyle = corStr(0x555555);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y + 3);
  ctx.lineTo(c.x, c.y - 6);
  ctx.stroke();

  // Assento
  const gradAssento = ctx.createLinearGradient(c.x, c.y - 4, c.x, c.y + 2);
  gradAssento.addColorStop(0, corStr(clarear(paleta.cadeira, 0.1)));
  gradAssento.addColorStop(1, corStr(paleta.cadeira));
  ctx.fillStyle = gradAssento;
  ctx.beginPath();
  ctx.roundRect(c.x - 8, c.y - 6, 16, 8, 3);
  ctx.fill();

  // Encosto
  const gradEnc = ctx.createLinearGradient(c.x, c.y - 18, c.x, c.y - 6);
  gradEnc.addColorStop(0, corStr(paleta.cadeiraEncosto));
  gradEnc.addColorStop(1, corStr(escurecer(paleta.cadeiraEncosto, 0.9)));
  ctx.fillStyle = gradEnc;
  ctx.beginPath();
  ctx.roundRect(c.x - 7, c.y - 18, 14, 12, 4);
  ctx.fill();

  // Brilho no encosto
  ctx.fillStyle = corStr(clarear(paleta.cadeiraEncosto, 0.2), 0.3);
  ctx.beginPath();
  ctx.roundRect(c.x - 6, c.y - 17, 5, 6, 2);
  ctx.fill();
}
