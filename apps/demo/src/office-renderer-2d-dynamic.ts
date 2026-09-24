/**
 * Passes dinamicos: penumbra, ambiente (heat/fila) e atores.
 */
import type { OfficeLayout, WorldDelta, WorldSnapshot } from '@tradeclass/contracts';
import { dimensoesPersonagem, type PersonagemKit } from '@tradeclass/iso-characters';
import type { PaletaResolvida } from '@tradeclass/world-engine';
import {
  desenharSpriteAtor,
  obterSpriteAtor,
  type SpriteCache,
} from './sprite-factory';
import { ALTURA_TILE, LARGURA_TILE } from './projecao';
import {
  caminho,
  cantosDaSala,
  cor,
  corDoAtor,
  disco,
  elipse,
  iso,
  pseudoAleatorio,
} from './office-renderer-2d-helpers';

export const PENUMBRA_NORMAL = 0.05;

export function desenharPenumbra(
  ctx: CanvasRenderingContext2D,
  layout: OfficeLayout,
  quadro: WorldSnapshot | WorldDelta,
  fase: number,
  paleta: PaletaResolvida,
): void {
  const estados = new Map(quadro.rooms.map((r) => [r.roomId, r]));
  for (const sala of layout.rooms) {
    const c = iso((sala.rect.x0 + sala.rect.x1) / 2, (sala.rect.y0 + sala.rect.y1) / 2);
    const raio = Math.max(20, (sala.rect.x1 - sala.rect.x0 + sala.rect.y1 - sala.rect.y0) * 6);
    const quebrada = estados.get(sala.roomId)?.lightBroken;

    // Luz ambiente no centro do teto (halo claro).
    const g = ctx.createRadialGradient(c.x, c.y - 10, 0, c.x, c.y - 10, raio);
    g.addColorStop(0, cor(paleta.paredeTopo, 0.12));
    g.addColorStop(0.6, cor(paleta.paredeTopo, 0.04));
    g.addColorStop(1, cor(paleta.paredeTopo, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, raio, raio * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    let escuridao = PENUMBRA_NORMAL;
    if (quebrada) {
      const h = hashTexto(sala.roomId);
      const periodo = 2.4 + pseudoAleatorio(h, 1) * 1.8;
      const defasagem = pseudoAleatorio(h, 2) * periodo;
      const cicloId = Math.floor((fase + defasagem) / periodo);
      const piscaNesteCiclo = pseudoAleatorio(cicloId, h) > 0.55;
      escuridao = 0.45;
      if (piscaNesteCiclo) {
        const t = ((fase + defasagem) % periodo) / periodo;
        if (t < 0.12) {
          const envelope = Math.sin((t / 0.12) * Math.PI);
          escuridao += 0.25 * envelope;
        }
      }
    }
    caminho(ctx, cantosDaSala(sala.rect));
    ctx.fillStyle = cor(paleta.penumbra, escuridao);
    ctx.fill();
  }
}

export function hashTexto(texto: string): number {
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) >>> 0;
  return h;
}

export function halo(ctx: CanvasRenderingContext2D, x: number, y: number, raio: number, matiz: number, alpha: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, raio);
  g.addColorStop(0, cor(matiz, alpha));
  g.addColorStop(0.55, cor(matiz, alpha * 0.42));
  g.addColorStop(1, cor(matiz, 0));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, (ALTURA_TILE / LARGURA_TILE) * 2);
  ctx.translate(-x, -y);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, raio, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function desenharAmbiente(
  ctx: CanvasRenderingContext2D,
  layout: OfficeLayout,
  quadro: WorldSnapshot | WorldDelta,
  fase: number,
  paleta: PaletaResolvida,
): void {
  const propPorId = new Map(layout.props.map((p) => [p.propId, p]));
  for (const mesa of quadro.desks) {
    const prop = propPorId.get(mesa.propId);
    if (!prop) continue;
    const c = iso(prop.cell.x + 0.5, prop.cell.y + 0.5);
    if (mesa.heat > 0.05) {
      const pulso = 0.75 + 0.25 * Math.sin(fase * 4);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      halo(ctx, c.x, c.y - 6, 34 + mesa.heat * 26, 0xff7a45, 0.4 * mesa.heat * pulso);
      ctx.restore();
    }
    for (let i = 0; i < mesa.queuePile; i++) {
      const topo = c.y - 14 - i * 2.1;
      ctx.beginPath();
      ctx.rect(c.x - 9, topo, 18, 2);
      ctx.fillStyle = cor(0xfdfdfd, 0.95);
      ctx.fill();
      ctx.strokeStyle = cor(0xc9c4bb, 1);
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
    for (let i = 0; i < mesa.litter; i++) {
      const ang = (i / Math.max(1, mesa.litter)) * Math.PI * 2;
      disco(ctx, c.x + Math.cos(ang) * 16, c.y + 6 + Math.sin(ang) * 8, 3, 0x9aa0a6, 0.85);
    }
  }
  for (const sala of quadro.rooms) {
    if (sala.incident < 0.35) continue;
    const geo = layout.rooms.find((r) => r.roomId === sala.roomId);
    if (!geo) continue;
    const c = iso((geo.rect.x0 + geo.rect.x1) / 2, (geo.rect.y0 + geo.rect.y1) / 2);
    for (let i = 0; i < 4; i++) {
      const t = (fase * 0.6 + i * 0.25) % 1;
      disco(ctx, c.x + Math.sin((fase + i) * 1.7) * 10, c.y - 20 - t * 60, 8 + t * 16, 0x6b7280, (1 - t) * 0.28 * sala.incident);
    }
  }
}

export function desenharAtores(
  ctx: CanvasRenderingContext2D,
  quadro: WorldSnapshot | WorldDelta,
  selecionado: string | null,
  fase: number,
  paleta: PaletaResolvida,
  sprites: SpriteCache,
  personagens: PersonagemKit,
): void {
  const tMs = fase * 1000;
  const dimensoes = dimensoesPersonagem(personagens.escalaPadrao);
  const ordenados = [...quadro.actors].sort((a, b) => a.x + a.y - (b.x + b.y));
  for (const ator of ordenados) {
    const c = iso(ator.x + 0.5, ator.y + 0.5);
    const base = corDoAtor(ator.agentId, ator.isInternal, paleta);
    const bob =
      ator.activity === 'walking' ? Math.abs(Math.sin(fase * 8)) * 2.5 : Math.sin(fase * 2) * 0.8;
    const peY = c.y + bob;

    elipse(ctx, c.x, peY + 2, dimensoes.largura * 0.16, 4, cor(0x000000, 0.18));

    if (selecionado === ator.agentId) {
      ctx.beginPath();
      ctx.ellipse(c.x, peY + 2, 18, 8, 0, 0, Math.PI * 2);
      ctx.strokeStyle = cor(0x1f2937, 0.8);
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    const klimmos = personagens.desenhar(
      ctx,
      ator.agentId,
      ator.activity,
      ator.pose,
      ator.facing,
      tMs,
      c.x,
      peY,
    );
    if (!klimmos) {
      const sprite = obterSpriteAtor(sprites, base, ator.isInternal);
      desenharSpriteAtor(ctx, sprite, c.x, peY, 0);
    }

    const topo = peY - (klimmos ? dimensoes.altura + 4 : 38);

    if (ator.health !== 'healthy') {
      ctx.beginPath();
      ctx.rect(c.x - 7, topo, 14, 3);
      ctx.fillStyle = cor(ator.health === 'failing' ? paleta.perigo : 0xe0a03f);
      ctx.fill();
    }

    if (ator.activity === 'working' && ator.progress > 0) {
      ctx.beginPath();
      ctx.rect(c.x - 10, topo - 6, 20, 3.5);
      ctx.fillStyle = cor(0x000000, 0.18);
      ctx.fill();
      ctx.beginPath();
      ctx.rect(c.x - 10, topo - 6, 20 * ator.progress, 3.5);
      ctx.fillStyle = cor(0x3f8f52);
      ctx.fill();
    }

    if (ator.activity === 'waiting_approval') {
      const pulso = 0.6 + 0.4 * Math.sin(fase * 5);
      const iy = topo - 14;
      disco(ctx, c.x, iy, 8, 0xffffff, 0.95);
      ctx.beginPath();
      ctx.arc(c.x, iy, 8, 0, Math.PI * 2);
      ctx.strokeStyle = cor(paleta.perigo, pulso);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.rect(c.x - 1, iy - 4, 2, 5);
      ctx.fillStyle = cor(paleta.perigo);
      ctx.fill();
      disco(ctx, c.x, iy + 3, 1.2, paleta.perigo);
    }

    if (ator.activity === 'sweeping') {
      ctx.beginPath();
      ctx.rect(c.x + 10, peY - 36, 2, 18);
      ctx.fillStyle = cor(0x8d6e63);
      ctx.fill();
      ctx.beginPath();
      ctx.rect(c.x + 6, peY - 20, 10, 3);
      ctx.fillStyle = cor(0xd9a86c);
      ctx.fill();
    }
    if (ator.activity === 'repairing') {
      ctx.beginPath();
      ctx.rect(c.x + 10, peY - 34, 2, 10);
      ctx.fillStyle = cor(0x9aa0a6);
      ctx.fill();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      halo(ctx, c.x, peY - 40, 26, 0xfff3d6, 0.35);
      ctx.restore();
    }
  }
}
