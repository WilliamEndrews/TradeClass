/**
 * Tipos publicos da fabrica de sprites isometricos.
 */
import type { AssetAtlas } from './asset-atlas';

export type PropKind =
  | 'desk'
  | 'chair'
  | 'sofa'
  | 'board'
  | 'printer'
  | 'meter'
  | 'coffee'
  | 'plant'
  | 'lamp'
  | 'cabinet'
  | 'bookshelf'
  | 'water'
  | 'rug';

export type DecorKind = 'laptop' | 'monitor' | 'keyboard' | 'mouse' | 'books' | 'radio';

/**
 * Sprite pronto para desenho, seja de asset externo ou procedural.
 *
 * `recorte` e a regiao do canvas de origem que contem pixel visivel. Para
 * assets externos ela vem da caixa alfa medida pelo atlas: recortar no
 * desenho (em vez de recortar o canvas na carga) preserva o canvas intacto,
 * de que os tiles de piso/parede dependem para se alinhar entre si.
 *
 * `w`/`h` sao as dimensoes JA escaladas para a tela.
 */
export interface Sprite2D {
  source: CanvasImageSource;
  recorte: { x: number; y: number; w: number; h: number };
  isExternal: boolean;
  w: number;
  h: number;
}

/** @deprecated Use `Sprite2D`. Aliases mantidos para nao quebrar chamadores. */
export type PropSprite = Sprite2D;
/** @deprecated Use `Sprite2D`. */
export type DecorSprite = Sprite2D;

export interface SpriteCache {
  props: Map<PropKind, HTMLCanvasElement>;
  decor: Map<DecorKind, HTMLCanvasElement>;
  actors: Map<number, HTMLCanvasElement>;
  internals: Map<number, HTMLCanvasElement>;
  atlas: AssetAtlas | undefined;
}
