/**
 * Sprites de parede / atmosfera: quadro, armario, estante, planta, lampada.
 */
import type { PaletaResolvida } from '@tradeclass/world-engine';
import {
  iso,
  losango,
  corStr,
  escurecer,
  clarear,
  path,
  caixaIso3D,
} from './sprite-factory-helpers';

export function renderizarQuadro(ctx: CanvasRenderingContext2D, paleta: PaletaResolvida): void {
  const c = iso(0.5, 0.5);

  // Sombra na parede
  ctx.save();
  ctx.filter = 'blur(4px)';
  ctx.fillStyle = corStr(0x000000, 0.15);
  ctx.fillRect(c.x - 12, c.y - 26, 24, 18);
  ctx.restore();

  // Moldura
  ctx.fillStyle = corStr(paleta.quadroBorda);
  ctx.beginPath();
  ctx.roundRect(c.x - 12, c.y - 26, 24, 18, 2);
  ctx.fill();

  // Superficie do quadro (escura, reflexiva)
  const gradBoard = ctx.createLinearGradient(c.x - 10, c.y - 24, c.x + 10, c.y - 10);
  gradBoard.addColorStop(0, corStr(0x1a2332, 0.9));
  gradBoard.addColorStop(0.5, corStr(0x2a3a4a, 0.75));
  gradBoard.addColorStop(1, corStr(0x1a2332, 0.9));
  ctx.fillStyle = gradBoard;
  ctx.fillRect(c.x - 10, c.y - 24, 20, 14);

  // Brilho do quadro
  ctx.fillStyle = corStr(0x4a6cf7, 0.1);
  ctx.fillRect(c.x - 9, c.y - 23, 18, 12);

  // Reflexo diagonal
  ctx.fillStyle = corStr(0xffffff, 0.06);
  ctx.beginPath();
  ctx.moveTo(c.x - 8, c.y - 22);
  ctx.lineTo(c.x - 4, c.y - 22);
  ctx.lineTo(c.x + 2, c.y - 12);
  ctx.lineTo(c.x - 2, c.y - 12);
  ctx.closePath();
  ctx.fill();

  // "Conteudo" do quadro (linhas de texto/grafico)
  ctx.fillStyle = corStr(0x6cf7a0, 0.5);
  ctx.fillRect(c.x - 7, c.y - 21, 8, 1);
  ctx.fillStyle = corStr(0xf7d44a, 0.4);
  ctx.fillRect(c.x - 7, c.y - 19, 6, 1);
  ctx.fillStyle = corStr(0x6cf7a0, 0.4);
  ctx.fillRect(c.x - 7, c.y - 17, 10, 1);

  // Pe do quadro (suporte na parede)
  ctx.fillStyle = corStr(escurecer(paleta.quadroBorda, 0.7));
  ctx.fillRect(c.x - 1, c.y - 8, 2, 4);
}


export function renderizarPlanta(ctx: CanvasRenderingContext2D, paleta: PaletaResolvida): void {
  const c = iso(0.5, 0.5);

  // Sombra
  ctx.save();
  ctx.filter = 'blur(3px)';
  path(ctx, losango(0, 0, 0.25));
  ctx.fillStyle = corStr(0x000000, 0.12);
  ctx.fill();
  ctx.restore();

  // Vaso de ceramica (mais alto e detalhado)
  const gradVaso = ctx.createLinearGradient(c.x, c.y - 10, c.x, c.y + 2);
  gradVaso.addColorStop(0, corStr(clarear(paleta.vaso, 0.1)));
  gradVaso.addColorStop(0.5, corStr(paleta.vaso));
  gradVaso.addColorStop(1, corStr(escurecer(paleta.vaso, 0.8)));
  ctx.fillStyle = gradVaso;
  ctx.beginPath();
  ctx.moveTo(c.x - 7, c.y + 2);
  ctx.lineTo(c.x + 7, c.y + 2);
  ctx.lineTo(c.x + 5, c.y - 10);
  ctx.lineTo(c.x - 5, c.y - 10);
  ctx.closePath();
  ctx.fill();

  // Borda do vaso (abertura)
  ctx.fillStyle = corStr(escurecer(paleta.vaso, 0.7));
  ctx.beginPath();
  ctx.ellipse(c.x, c.y - 10, 6, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Terra no vaso
  ctx.fillStyle = corStr(0x3d2817, 0.8);
  ctx.beginPath();
  ctx.ellipse(c.x, c.y - 10, 5, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tronco
  ctx.strokeStyle = corStr(paleta.plantaTronco);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y - 10);
  ctx.lineTo(c.x, c.y - 16);
  ctx.stroke();

  // Folhagem: multiplas camadas de circulos com gradiente
  const gradFolha1 = ctx.createRadialGradient(c.x - 3, c.y - 20, 0, c.x, c.y - 18, 12);
  gradFolha1.addColorStop(0, corStr(clarear(paleta.planta, 0.25)));
  gradFolha1.addColorStop(0.5, corStr(paleta.planta));
  gradFolha1.addColorStop(1, corStr(escurecer(paleta.planta, 0.65)));
  ctx.fillStyle = gradFolha1;
  ctx.beginPath();
  ctx.arc(c.x, c.y - 18, 9, 0, Math.PI * 2);
  ctx.fill();

  // Camada 2 (menor, mais clara, deslocada)
  const gradFolha2 = ctx.createRadialGradient(c.x - 4, c.y - 24, 0, c.x - 2, c.y - 22, 7);
  gradFolha2.addColorStop(0, corStr(clarear(paleta.planta, 0.2)));
  gradFolha2.addColorStop(1, corStr(escurecer(paleta.planta, 0.75)));
  ctx.fillStyle = gradFolha2;
  ctx.beginPath();
  ctx.arc(c.x - 2, c.y - 22, 6, 0, Math.PI * 2);
  ctx.fill();

  // Folhas individuais (detalhes)
  ctx.fillStyle = corStr(clarear(paleta.planta, 0.18), 0.85);
  ctx.beginPath();
  ctx.ellipse(c.x + 5, c.y - 17, 4, 2.5, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(c.x - 6, c.y - 16, 4, 2.5, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(c.x + 3, c.y - 25, 3.5, 2, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Highlight superior
  ctx.fillStyle = corStr(clarear(paleta.planta, 0.35), 0.3);
  ctx.beginPath();
  ctx.arc(c.x - 3, c.y - 24, 3, 0, Math.PI * 2);
  ctx.fill();
}

export function renderizarLampada(ctx: CanvasRenderingContext2D, paleta: PaletaResolvida): void {
  const c = iso(0.5, 0.5);

  // Base
  ctx.fillStyle = corStr(0x666666, 0.7);
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, 7, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = corStr(0x888888, 0.5);
  ctx.beginPath();
  ctx.ellipse(c.x, c.y - 1, 5, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Haste
  ctx.strokeStyle = corStr(0x888888, 0.6);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y - 1);
  ctx.lineTo(c.x, c.y - 16);
  ctx.stroke();

  // CÃºpula da lampada
  const gradCupula = ctx.createLinearGradient(c.x, c.y - 22, c.x, c.y - 14);
  gradCupula.addColorStop(0, corStr(0xfff3d6, 0.5));
  gradCupula.addColorStop(1, corStr(0xddd0b8, 0.4));
  ctx.fillStyle = gradCupula;
  ctx.beginPath();
  ctx.moveTo(c.x - 6, c.y - 16);
  ctx.lineTo(c.x + 6, c.y - 16);
  ctx.lineTo(c.x + 4, c.y - 22);
  ctx.lineTo(c.x - 4, c.y - 22);
  ctx.closePath();
  ctx.fill();

  // Bulbo (brilho)
  ctx.fillStyle = corStr(0xfff3d6, 0.5);
  ctx.beginPath();
  ctx.arc(c.x, c.y - 16, 3, 0, Math.PI * 2);
  ctx.fill();

  // Halo de luz
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const gradHalo = ctx.createRadialGradient(c.x, c.y - 16, 0, c.x, c.y - 16, 14);
  gradHalo.addColorStop(0, corStr(0xfff3d6, 0.25));
  gradHalo.addColorStop(0.5, corStr(0xfff3d6, 0.08));
  gradHalo.addColorStop(1, corStr(0xfff3d6, 0));
  ctx.fillStyle = gradHalo;
  ctx.beginPath();
  ctx.arc(c.x, c.y - 16, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function renderizarArmario(ctx: CanvasRenderingContext2D, paleta: PaletaResolvida): void {
  const c = iso(0.5, 0.5);

  // Corpo alto do armario
  caixaIso3D(ctx, 0, 0, 26, paleta.mesaTopo, paleta.mesaLado, 0.18);

  // Portas duplas
  ctx.strokeStyle = corStr(escurecer(paleta.mesaLado, 0.8), 0.5);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y - 22);
  ctx.lineTo(c.x, c.y - 2);
  ctx.stroke();

  // Macanetas
  ctx.fillStyle = corStr(0x888888);
  ctx.beginPath();
  ctx.arc(c.x - 4, c.y - 12, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(c.x + 4, c.y - 12, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Gaveta inferior
  ctx.fillStyle = corStr(escurecer(paleta.mesaLado, 0.7));
  ctx.fillRect(c.x - 10, c.y - 3, 20, 3);
  ctx.fillStyle = corStr(clarear(paleta.mesaLado, 0.1), 0.5);
  ctx.fillRect(c.x - 9, c.y - 2, 18, 1);
}

export function renderizarEstante(ctx: CanvasRenderingContext2D, paleta: PaletaResolvida): void {
  const c = iso(0.5, 0.5);

  // Corpo da estante
  caixaIso3D(ctx, 0, 0, 24, paleta.mesaTopo, paleta.mesaLado, 0.2);

  // Prateleiras
  ctx.strokeStyle = corStr(escurecer(paleta.mesaLado, 0.85), 0.7);
  ctx.lineWidth = 1;
  for (const off of [-8, -3, 2]) {
    ctx.beginPath();
    ctx.moveTo(c.x - 10, c.y - 12 + off);
    ctx.lineTo(c.x + 10, c.y - 12 + off);
    ctx.stroke();
  }

  // Livros/pastas nas prateleiras
  const cores = [0xd94f4f, 0x4f6df5, 0x3f8f52, 0xd0a056, 0x9a5fd0];
  for (let pr = 0; pr < 3; pr++) {
    const py = c.y - 14 + pr * 5;
    for (let i = 0; i < 4; i++) {
      const px = c.x - 8 + i * 4.5;
      const h = 2 + ((i + pr) % 3);
      const corLivro = cores[(i + pr) % cores.length] ?? 0xd94f4f;
      ctx.fillStyle = corStr(corLivro, 0.9);
      ctx.fillRect(px, py, 3, h);
    }
  }
}
