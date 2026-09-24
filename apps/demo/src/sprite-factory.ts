/**
 * FABRICA DE SPRITES ISOMETRICOS - API publica (barrel fino).
 *
 * Implementacao procedural fatiada por responsabilidade:
 * helpers, desk, wall, props, actors, decor.
 */
import type { PaletaResolvida } from '@tradeclass/world-engine';
import type { CalibracaoSala, TileKind } from '@tradeclass/contracts';
import type { AssetAtlas, AtlasKind, LoadedAsset } from './asset-atlas';
import {
  ALTURA_TILE,
  LARGURA_TILE,
  PE_WALL_L,
  PE_WALL_R,
  ancoraDoPapel,
  iso,
  specObjeto,
  type PapelTile,
  type SpecObjeto,
} from './projecao';
import { SUPER, criarCanvas } from './sprite-factory-helpers';
import { renderizarAtor } from './sprite-factory-actors';
import { renderizarDecor } from './sprite-factory-decor';
import {
  renderizarCadeira,
  renderizarMesa,
  renderizarSofa,
} from './sprite-factory-desk';
import {
  renderizarArmario,
  renderizarEstante,
  renderizarLampada,
  renderizarPlanta,
  renderizarQuadro,
} from './sprite-factory-wall';
import {
  renderizarBebedouro,
  renderizarImpressora,
  renderizarMaquinaCafe,
  renderizarMedidor,
  renderizarTapete,
} from './sprite-factory-props';
import type { DecorKind, PropKind, Sprite2D, SpriteCache } from './sprite-factory-types';

export type {
  PropKind,
  DecorKind,
  Sprite2D,
  PropSprite,
  DecorSprite,
  SpriteCache,
} from './sprite-factory-types';

export { desenharSpriteAtor } from './sprite-factory-actors';

export function criarFabrica(paleta: PaletaResolvida, atlas?: AssetAtlas): SpriteCache {
  const props = new Map<PropKind, HTMLCanvasElement>();
  const decor = new Map<DecorKind, HTMLCanvasElement>();
  const actors = new Map<number, HTMLCanvasElement>();
  const internals = new Map<number, HTMLCanvasElement>();

  for (const kind of [
    'desk',
    'chair',
    'sofa',
    'board',
    'printer',
    'meter',
    'coffee',
    'plant',
    'cabinet',
    'bookshelf',
    'water',
    'rug',
  ] as PropKind[]) {
    props.set(kind, renderizarProp(kind, paleta));
  }
  props.set('lamp', renderizarProp('lamp', paleta));

  for (const kind of ['laptop', 'monitor', 'keyboard', 'mouse', 'books', 'radio'] as DecorKind[]) {
    decor.set(kind, renderizarDecor(kind, paleta));
  }

  for (const c of paleta.ator) {
    actors.set(c, renderizarAtor(c, false, paleta));
  }
  internals.set(paleta.internoZelador, renderizarAtor(paleta.internoZelador, true, paleta));
  internals.set(paleta.internoTecnico, renderizarAtor(paleta.internoTecnico, true, paleta));

  return { props, decor, actors, internals, atlas };
}

function renderizarProp(kind: PropKind, paleta: PaletaResolvida): HTMLCanvasElement {
  const w = LARGURA_TILE + 28;
  const h = ALTURA_TILE + 60;
  const { canvas, ctx } = criarCanvas(w, h);

  const ox = w / 2 - LARGURA_TILE / 2;
  const oy = h / 2 - ALTURA_TILE / 2;
  ctx.translate(ox, oy);

  switch (kind) {
    case 'desk':
      renderizarMesa(ctx, paleta);
      break;
    case 'sofa':
      renderizarSofa(ctx, paleta);
      break;
    case 'board':
      renderizarQuadro(ctx, paleta);
      break;
    case 'printer':
      renderizarImpressora(ctx, paleta);
      break;
    case 'meter':
      renderizarMedidor(ctx, paleta);
      break;
    case 'coffee':
      renderizarMaquinaCafe(ctx, paleta);
      break;
    case 'plant':
      renderizarPlanta(ctx, paleta);
      break;
    case 'lamp':
      renderizarLampada(ctx, paleta);
      break;
    case 'chair':
      renderizarCadeira(ctx, paleta);
      break;
    case 'cabinet':
      renderizarArmario(ctx, paleta);
      break;
    case 'bookshelf':
      renderizarEstante(ctx, paleta);
      break;
    case 'water':
      renderizarBebedouro(ctx, paleta);
      break;
    case 'rug':
      renderizarTapete(ctx, paleta);
      break;
  }

  return canvas;
}

/** Kinds de Prop que tem asset real no catalogo - NUNCA usar fallback procedural. */
const PROP_KINDS_COM_ASSET: ReadonlySet<PropKind> = new Set([
  'desk',
  'chair',
  'bookshelf',
  'sofa',
  'cabinet',
  'plant',
  'printer',
  'water',
  'coffee',
  'board',
  'lamp',
  'rug',
]);

/** Kinds de Decor que tem asset real no catalogo - NUNCA usar fallback procedural. */
const DECOR_KINDS_COM_ASSET: ReadonlySet<DecorKind> = new Set([
  'laptop',
  'monitor',
  'keyboard',
  'books',
  'radio',
  'mouse',
]);

/** Placeholder vazio 1x1 para kinds sem asset e sem fallback procedural. */
const PLACEHOLDER_VAZIO: HTMLCanvasElement = (() => {
  const c = document.createElement('canvas');
  c.width = 1;
  c.height = 1;
  return c;
})();

/** Sprite invisivel, para kind que deveria ter asset mas falhou ao carregar. */
const SPRITE_VAZIO: Sprite2D = {
  source: PLACEHOLDER_VAZIO,
  recorte: { x: 0, y: 0, w: 1, h: 1 },
  isExternal: false,
  w: 0,
  h: 0,
};

export function spriteDeAsset(asset: LoadedAsset): Sprite2D {
  return {
    source: asset.image,
    recorte: asset.caixa,
    isExternal: true,
    w: asset.caixa.w * asset.scale,
    h: asset.caixa.h * asset.scale,
  };
}

function spriteProcedural(canvas: HTMLCanvasElement): Sprite2D {
  return {
    source: canvas,
    recorte: { x: 0, y: 0, w: canvas.width, h: canvas.height },
    isExternal: false,
    w: canvas.width / SUPER,
    h: canvas.height / SUPER,
  };
}

export function obterSpriteProp(cache: SpriteCache, kind: PropKind, assetId?: string): Sprite2D {
  const asset = (assetId ? cache.atlas?.getById(assetId) : undefined) ?? cache.atlas?.get(kind as AtlasKind);
  if (asset) return spriteDeAsset(asset);
  if (PROP_KINDS_COM_ASSET.has(kind)) return SPRITE_VAZIO;
  return spriteProcedural(cache.props.get(kind) ?? cache.props.get('desk')!);
}

export function obterSpriteAtor(cache: SpriteCache, cor: number, interno: boolean): HTMLCanvasElement {
  if (interno) {
    return cache.internals.get(cor) ?? cache.actors.get(cor) ?? cache.actors.values().next().value!;
  }
  return cache.actors.get(cor) ?? cache.actors.values().next().value!;
}

export function obterSpriteDecor(cache: SpriteCache, kind: DecorKind): Sprite2D {
  const asset = cache.atlas?.get(kind as AtlasKind);
  if (asset) return spriteDeAsset(asset);
  if (DECOR_KINDS_COM_ASSET.has(kind)) return SPRITE_VAZIO;
  return spriteProcedural(cache.decor.get(kind) ?? cache.decor.get('laptop')!);
}

export function obterTile(
  cache: SpriteCache,
  kind: TileKind,
  tileSetId?: string,
): LoadedAsset | undefined {
  return cache.atlas?.tile(kind, tileSetId);
}

export function obterParedeVidro(cache: SpriteCache): LoadedAsset | undefined {
  return cache.atlas?.glassWall();
}

function desenharObjeto(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite2D,
  gx: number,
  gy: number,
  elevacao = 0,
): void {
  if (sprite.w <= 0 || sprite.h <= 0) return;
  const c = iso(gx + 0.5, gy + 0.5);
  const x = c.x - sprite.w / 2;
  const y = c.y - sprite.h + elevacao;
  const r = sprite.recorte;
  ctx.drawImage(sprite.source, r.x, r.y, r.w, r.h, x, y, sprite.w, sprite.h);
}

function desenharObjetoCalibrado(
  ctx: CanvasRenderingContext2D,
  asset: LoadedAsset,
  gx: number,
  gy: number,
  spec: SpecObjeto,
): void {
  const escala = asset.scale;
  const w = asset.image.width * escala;
  const h = asset.image.height * escala;
  if (spec.modo === 'canto' && spec.pe) {
    const v = iso(gx, gy);
    ctx.drawImage(asset.image, v.x - spec.pe.x * escala, v.y - spec.pe.y * escala, w, h);
    return;
  }
  const ancora = spec.ancora ?? { x: 64, y: 68 };
  const c = iso(gx + 0.5, gy + 0.5);
  ctx.drawImage(asset.image, c.x - ancora.x * escala, c.y - ancora.y * escala, w, h);
}

export function desenharSpriteProp(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite2D,
  gx: number,
  gy: number,
  kind?: PropKind,
  asset?: LoadedAsset,
): void {
  if (kind && asset) {
    const spec = specObjeto(kind);
    if (spec) {
      desenharObjetoCalibrado(ctx, asset, gx, gy, spec);
      return;
    }
  }
  desenharObjeto(ctx, sprite, gx, gy);
}

const ALTURA_TAMPO = ALTURA_TILE * 0.5;

export function desenharSpriteDecor(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite2D,
  gx: number,
  gy: number,
): void {
  desenharObjeto(ctx, sprite, gx, gy, -ALTURA_TAMPO);
}

export function desenharTile(
  ctx: CanvasRenderingContext2D,
  tile: LoadedAsset,
  gx: number,
  gy: number,
  papel: PapelTile = 'floor',
  cal?: CalibracaoSala,
): void {
  const c = iso(gx + 0.5, gy + 0.5);
  const ancora = ancoraDoPapel(papel, cal);
  const w = tile.image.width * tile.scale;
  const h = tile.image.height * tile.scale;
  const x = c.x - ancora.x * tile.scale;
  const y = c.y - ancora.y * tile.scale;
  ctx.drawImage(tile.image, x, y, w, h);
}

export function desenharAnexoParede(
  ctx: CanvasRenderingContext2D,
  asset: LoadedAsset,
  face: 'R' | 'L',
  gx: number,
  gy: number,
  dx = 0,
  dy = 0,
  cal?: CalibracaoSala,
): void {
  const pe = face === 'L' ? (cal?.peWallL ?? PE_WALL_L) : (cal?.peWallR ?? PE_WALL_R);
  const v = iso(gx, gy);
  const escala = asset.scale;
  const w = asset.image.width * escala;
  const h = asset.image.height * escala;
  ctx.drawImage(asset.image, v.x + dx - pe.x * escala, v.y + dy - pe.y * escala, w, h);
}
