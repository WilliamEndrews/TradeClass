/**
 * Pass de desenho estatico: piso, paredes e mobiliario (sprites).
 */
import type { OfficeLayout } from '@tradeclass/contracts';
import type { PaletaResolvida } from '@tradeclass/world-engine';
import type { LoadedAsset } from './asset-atlas';
import {
  desenharAnexoParede,
  desenharSpriteDecor,
  desenharSpriteProp,
  desenharTile,
  obterSpriteDecor,
  obterSpriteProp,
  obterTile,
  type DecorKind,
  type PropKind,
  type SpriteCache,
} from './sprite-factory';
import {
  caminho,
  clarear,
  cor,
  desenharTexturaPiso,
  escurecer,
  type Extensao,
  iso,
  losango,
} from './office-renderer-2d-helpers';

export const ALTURA_PAREDE = 52;

export function construirEstatico(
  layout: OfficeLayout,
  ext: Extensao,
  escalaFisica: number,
  paleta: PaletaResolvida,
  sprites: SpriteCache,
): HTMLCanvasElement {
  const alvo = document.createElement('canvas');
  alvo.width = Math.max(1, Math.ceil(ext.largura * escalaFisica));
  alvo.height = Math.max(1, Math.ceil(ext.altura * escalaFisica));
  const g = alvo.getContext('2d');
  if (!g) return alvo;
  // Sprites entram aqui 1:1 (ESCALA_ASSET = 1). Suavizacao desligada garante
  // que nenhum arredondamento de sub-pixel introduza borrao no pixel art.
  g.imageSmoothingEnabled = false;
  g.setTransform(escalaFisica, 0, 0, escalaFisica, -ext.minX * escalaFisica, -ext.minY * escalaFisica);
  desenharPiso(g, layout, paleta, sprites);
  desenharCenarioEstatico(g, layout, paleta, sprites);
  return alvo;
}

/**
 * Piso do escritorio.
 *
 * Caminho preferido: tile de piso do TinyTraderLab, blitado uma vez por celula.
 * Caminho de emergencia (tile faltando): losango pintado, so para nao deixar
 * o chao vazio - reconhecivelmente pior, e de proposito, para que a ausencia
 * do asset seja obvia em vez de silenciosa.
 */
export function desenharPiso(
  ctx: CanvasRenderingContext2D,
  layout: OfficeLayout,
  paleta: PaletaResolvida,
  sprites: SpriteCache,
): void {
  const tilePisoPadrao = obterTile(sprites, 'floor', layout.corridorTileSetId ?? layout.theme.name);

  /** Todas as celulas com piso: salas + corredores. */
  const celulas: Array<{
    x: number;
    y: number;
    corBase: number;
    tileSetId: string;
    calibracao?: OfficeLayout['rooms'][number]['calibracao'];
  }> = [];
  const idCorredor = layout.corridorTileSetId ?? layout.theme.name;
  for (const c of layout.corridors) {
    celulas.push({ x: c.x, y: c.y, corBase: paleta.corredor, tileSetId: idCorredor });
  }
  for (const sala of layout.rooms) {
    const base = paleta.piso[sala.kind] ?? paleta.piso.sala_user!;
    const tileSetId = sala.tileSetId ?? layout.theme.name;
    for (let y = sala.rect.y0; y < sala.rect.y1; y++) {
      for (let x = sala.rect.x0; x < sala.rect.x1; x++) {
        celulas.push({ x, y, corBase: base, tileSetId, calibracao: sala.calibracao });
      }
    }
  }

  if (tilePisoPadrao) {
    celulas.sort((a, b) => a.x + a.y - (b.x + b.y));
    for (const c of celulas) {
      const tile = obterTile(sprites, 'floor', c.tileSetId) ?? tilePisoPadrao;
      desenharTile(ctx, tile, c.x, c.y, 'floor', c.calibracao);
    }
    return;
  }

  for (const c of celulas) {
    caminho(ctx, losango(c.x, c.y));
    ctx.fillStyle = cor(c.corBase);
    ctx.fill();
  }
}

export function desenharCenarioEstatico(
  ctx: CanvasRenderingContext2D,
  layout: OfficeLayout,
  paleta: PaletaResolvida,
  sprites: SpriteCache,
): void {
  interface Item { depth: number; draw: () => void; }
  const itens: Item[] = [];

  const desenharParede = (
    gx: number,
    gy: number,
    tileWall: LoadedAsset | undefined,
    papelWall: 'wall_l' | 'wall_r',
    cal?: OfficeLayout['rooms'][number]['calibracao'],
  ): void => {
    if (tileWall) {
      desenharTile(ctx, tileWall, gx, gy, papelWall, cal);
      return;
    }
    segmentoParede(ctx, iso(gx, gy), iso(gx + 1, gy), ALTURA_PAREDE, paleta.paredeInterna, false);
  };

  const tileSetDaSala = (roomId: string): string => {
    const sala = layout.rooms.find((s) => s.roomId === roomId);
    return sala?.tileSetId ?? layout.theme.name;
  };

  const calibracaoDaSala = (roomId: string) =>
    layout.rooms.find((s) => s.roomId === roomId)?.calibracao;

  if ((layout.walls ?? []).length > 0) {
    for (const face of layout.walls) {
      const ts = tileSetDaSala(face.roomId);
      const cal = calibracaoDaSala(face.roomId);
      const gx = face.cell.x;
      const gy = face.cell.y;
      const papel = face.papel === 'wall_l' ? 'wall_l' : 'wall_r';
      itens.push({
        depth: gx + gy + 0.4,
        draw: () => desenharParede(gx, gy, obterTile(sprites, papel, ts), papel, cal),
      });
      if (face.temPorta) {
        const porta = obterTile(sprites, 'door', ts);
        if (porta) {
          itens.push({
            depth: gx + gy + 0.45,
            draw: () => desenharTile(ctx, porta, gx, gy, 'door', cal),
          });
        }
      }
    }
  } else {
    // Proto do lab: estrutura NW + porta no norte, iguais ao blitEstrutura.
    for (const sala of layout.rooms) {
      const { x0, y0, y1 } = sala.rect;
      const x1 = sala.rect.x1;
      const ts = sala.tileSetId ?? layout.theme.name;
      const cal = sala.calibracao;
      const wallR = obterTile(sprites, 'wall_r', ts);
      const wallL = obterTile(sprites, 'wall_l', ts);
      const porta = obterTile(sprites, 'door', ts);
      const gxPorta = x0 + Math.floor((x1 - x0 - 1) / 2);

      for (let x = x0; x < x1; x++) {
        itens.push({
          depth: x + y0 + 0.4,
          draw: () => desenharParede(x, y0, wallR, 'wall_r', cal),
        });
        if (x === gxPorta && porta) {
          itens.push({
            depth: x + y0 + 0.45,
            draw: () => desenharTile(ctx, porta, x, y0, 'door', cal),
          });
        }
      }
      for (let y = y0; y < y1; y++) {
        itens.push({
          depth: x0 + y + 0.4,
          draw: () => desenharParede(x0, y, wallL, 'wall_l', cal),
        });
      }
    }
  }

  for (const m of layout.wallMounts ?? []) {
    const cal = calibracaoDaSala(m.roomId);
    itens.push({
      depth: m.gx + m.gy + 0.43,
      draw: () => {
        const asset = sprites.atlas?.getById(m.assetId);
        if (!asset) return;
        desenharAnexoParede(ctx, asset, m.face, m.gx, m.gy, m.dx, m.dy, cal);
      },
    });
  }

  const props = [...layout.props].sort((a, b) => a.cell.x + a.cell.y - (b.cell.x + b.cell.y));
  for (const p of props) {
    itens.push({
      // +0.5: na frente da parede da mesma celula (0.4). Permite mesa na
      // fileira do fundo sem a Wall_R pintar por cima do tampo.
      depth: p.cell.x + p.cell.y + 0.5,
      draw: () => {
        const kind = p.kind as PropKind;
        const asset = (p.assetId ? sprites.atlas?.getById(p.assetId) : undefined) ?? sprites.atlas?.get(kind);
        desenharSpriteProp(
          ctx,
          obterSpriteProp(sprites, kind, p.assetId),
          p.cell.x,
          p.cell.y,
          kind,
          asset,
        );
      },
    });
  }

  // Decor de superficie: desenhado DEPOIS do prop sobre o qual repousa,
  // com depth ligeiramente maior para manter ordem correta na projecao isometrica.
  const decor = [...layout.decor].sort((a, b) => a.cell.x + a.cell.y - (b.cell.x + b.cell.y));
  for (const d of decor) {
    itens.push({
      depth: d.cell.x + d.cell.y + 0.7,
      draw: () => {
        desenharSpriteDecor(ctx, obterSpriteDecor(sprites, d.kind as DecorKind), d.cell.x, d.cell.y);
      },
    });
  }

  itens.sort((a, b) => a.depth - b.depth);
  for (const item of itens) item.draw();
}

export function segmentoParede(
  ctx: CanvasRenderingContext2D,
  pA: { x: number; y: number },
  pB: { x: number; y: number },
  altura: number,
  corFace: number,
  externo: boolean,
): void {
  const opacidade = externo ? 1 : 0.55;
  const topoA = { x: pA.x, y: pA.y - altura };
  const topoB = { x: pB.x, y: pB.y - altura };
  const grad = ctx.createLinearGradient(pA.x, pA.y, topoA.x, topoA.y);
  grad.addColorStop(0, cor(escurecer(corFace, 0.82), opacidade));
  grad.addColorStop(0.5, cor(corFace, opacidade));
  grad.addColorStop(1, cor(clarear(corFace, 0.08), opacidade));
  caminho(ctx, [pA, pB, topoB, topoA]);
  ctx.fillStyle = grad;
  ctx.fill();

  // Rodape (base da parede mais escura)
  ctx.fillStyle = cor(escurecer(corFace, 0.7), 0.6);
  ctx.fillRect(Math.min(pA.x, pB.x), Math.min(pA.y, pB.y) - 3, Math.abs(pB.x - pA.x) + 2, 3);

  // Janela: apenas em paredes externas (fachada do predio).
  const dx = pB.x - pA.x;
  const dy = pB.y - pA.y;
  const len = Math.hypot(dx, dy);
  if (externo && len > 14) {
    const jx = (pA.x + pB.x) / 2;
    const jy = (pA.y + pB.y) / 2;
    const jAltura = altura * 0.55;
    const jBase = altura * 0.25;
    const jLargura = Math.min(len * 0.4, 18);
    const ux = dx / len;
    const uy = dy / len;
    const jA = { x: jx - ux * jLargura / 2, y: jy - uy * jLargura / 2 };
    const jB = { x: jx + ux * jLargura / 2, y: jy + uy * jLargura / 2 };
    const jTopoA = { x: jA.x, y: jA.y - jBase - jAltura };
    const jTopoB = { x: jB.x, y: jB.y - jBase - jAltura };
    const jBaseA = { x: jA.x, y: jA.y - jBase };
    const jBaseB = { x: jB.x, y: jB.y - jBase };
    // Vidro da janela (azul claro translucido)
    const gradJ = ctx.createLinearGradient(jA.x, jBaseA.y, jB.x, jTopoB.y);
    gradJ.addColorStop(0, cor(0xa8c8e8, 0.35));
    gradJ.addColorStop(0.5, cor(0xc8ddf0, 0.25));
    gradJ.addColorStop(1, cor(0xa8c8e8, 0.35));
    caminho(ctx, [jBaseA, jBaseB, jTopoB, jTopoA]);
    ctx.fillStyle = gradJ;
    ctx.fill();
    // Moldura da janela
    ctx.strokeStyle = cor(escurecer(corFace, 0.6), 0.7);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Cruzeta da janela
    ctx.beginPath();
    ctx.moveTo((jA.x + jB.x) / 2, jBaseA.y);
    ctx.lineTo((jA.x + jB.x) / 2, jTopoA.y);
    ctx.moveTo(jA.x, (jBaseA.y + jTopoA.y) / 2);
    ctx.lineTo(jB.x, (jBaseB.y + jTopoB.y) / 2);
    ctx.strokeStyle = cor(escurecer(corFace, 0.5), 0.5);
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.strokeStyle = cor(escurecer(corFace, 0.8), 0.5);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pA.x, pA.y);
  ctx.lineTo(pB.x, pB.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(topoA.x, topoA.y);
  ctx.lineTo(topoB.x, topoB.y);
  ctx.strokeStyle = cor(clarear(corFace, 0.15), 0.4);
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
