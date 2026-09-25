/**
 * Biblia do Construtor: cada tema e um ProtoComodo (grade + tileset + palco
 * + calibracao). O solver escolhe por zonaKind e cola; nao inventa geometria
 * interna da sala.
 */

import {
  INITIAL_CATALOG,
  TILESETS,
  montarTileSet,
  resolverTileSet,
  type CalibracaoSala,
  type Prop,
  type Room,
  type TileSet,
  type WallMedia,
  type WallMediaFrame,
  type WallMount,
} from '@tradeclass/contracts';
import type { Rng } from './prng.js';
import temasJson from './biblia/temas-arquiteto.json';
import { resolverPostoAgente, resolverPostoParaMesa } from './postos-trabalho.js';

/** Zonas TradeClass + corredor estrutural + landing de marketing. */
export type ZonaKindTiles =
  | 'salao_especialistas'
  | 'sala_user'
  | 'macroeconomia'
  | 'noticias'
  | 'corridor'
  | 'landing';

/** Zonas do escritorio padrao (exclui corridor/landing). */
export const ZONAS_TRADECLASS = [
  'salao_especialistas',
  'sala_user',
  'macroeconomia',
  'noticias',
] as const satisfies readonly ZonaKindTiles[];

export type ZonaTradeClass = (typeof ZONAS_TRADECLASS)[number];

/**
 * Ate o remapeamento manual na biblia, temas ainda usam ids MicroFirma.
 * listarProtos cai nestes ids quando a zona TradeClass ainda nao tem proto.
 */
const FALLBACK_ZONA_LEGADO: Record<ZonaTradeClass, readonly string[]> = {
  salao_especialistas: ['boss_room'],
  sala_user: ['private'],
  macroeconomia: ['private', 'open', 'meeting'],
  noticias: ['break', 'open', 'reception'],
};

export interface SlotPoliticaTiles {
  modo: 'default' | 'unico' | 'opcoes';
  pisos: string[];
  paredes: string[];
}

export interface PecaPalco {
  assetId: string;
  gx: number;
  gy: number;
  qx?: number;
  qy?: number;
  passo?: number;
  papel?: 'prop' | 'decor' | 'wall';
  face?: 'R' | 'L';
  dx?: number;
  dy?: number;
}

/** Iframe / midia autorada no lab (coords locais do palco). */
export interface WallMediaPalco {
  mediaId: string;
  kind?: 'iframe' | 'projection' | 'banner' | 'chart';
  url?: string;
  frame?: WallMediaFrame;
  mountAssetId?: string;
  nestAssetId?: string;
  face: 'R' | 'L';
  gx: number;
  gy: number;
  dx?: number;
  dy?: number;
  size?: { w: number; h: number };
  heightPx?: number;
  screenInset?: { u0: number; v0: number; u1: number; v1: number };
  screenCorners?: {
    tl: { u: number; v: number };
    tr: { u: number; v: number };
    br: { u: number; v: number };
    bl: { u: number; v: number };
  };
  warpGrid?: {
    cols: number;
    rows: number;
    points: { u: number; v: number }[];
  };
  blendMode?: 'normal' | 'screen' | 'linear-dodge';
  display?: 'auto' | 'image' | 'iframe' | 'hybrid';
}

export interface PostoTrabalho {
  agentSlot: string;
  gx: number;
  gy: number;
  qx?: number;
  qy?: number;
  passo?: number;
  facing?: 0 | 1 | 2 | 3;
  facingOrigem?: 'olhar_mesa' | 'manual' | 'padrao_norte';
  deskAssetId?: string;
}

export interface TemaArquiteto {
  id: string;
  nome: string;
  tilesetAtivo: string;
  pisoLivre?: string | null;
  paredeLivre?: string | null;
  piso?: string;
  parede?: string;
  prioridade: number;
  unicoNaAgencia: boolean;
  /**
   * Quando true, este tema e o escolhido para a geracao (Viewtest/Room)
   * entre as opcoes da mesma zonaKind. No maximo um por zona.
   */
  marcadoParaGeracao?: boolean;
  zonaKind: ZonaKindTiles;
  palco: PecaPalco[];
  /** Midias de parede (iframe etc.) autoradas no lab. */
  wallMedia?: WallMediaPalco[];
  grade?: { w: number; h: number };
  calibracao?: CalibracaoSala | null;
  postosTrabalho?: PostoTrabalho[];
}

export interface BibliaTemas {
  versao: string;
  politicaTiles: Record<string, SlotPoliticaTiles>;
  temas: TemaArquiteto[];
}

export const BIBLIA_TEMAS = temasJson as unknown as BibliaTemas;

/** Fallback quando o proto nao traz calibracao (mesmos numeros do lab). */
export const CALIBRACAO_PADRAO: CalibracaoSala = {
  ancoraPiso: { x: 64, y: 68 },
  peWallR: { x: 32, y: 83 },
  peWallL: { x: 95, y: 83 },
  pePorta: { x: 46, y: 101 },
  folgaPorta: { x: 11, y: 4 },
  portaComoFolha: true,
  objetos: {
    desk: { modo: 'centro', ancora: { x: 64, y: 68 } },
    water: { modo: 'canto', pe: { x: 64, y: 63 } },
  },
};

export interface TileVisual {
  tileSetId: string;
  piso?: string;
  parede?: string;
}

export function listarProtos(
  zonaKind: ZonaKindTiles,
  temas: readonly TemaArquiteto[] = BIBLIA_TEMAS.temas,
): TemaArquiteto[] {
  const diretos = temas
    .filter((t) => t.zonaKind === zonaKind)
    .sort((a, b) => b.prioridade - a.prioridade || a.id.localeCompare(b.id));
  if (diretos.length > 0) return diretos;

  const legado =
    zonaKind in FALLBACK_ZONA_LEGADO
      ? FALLBACK_ZONA_LEGADO[zonaKind as ZonaTradeClass]
      : undefined;
  if (!legado?.length) return [];

  // Temas ainda com zonaKind MicroFirma — bridge ate remapeamento no Lab.
  return temas
    .filter((t) => legado.includes(t.zonaKind as string))
    .sort((a, b) => b.prioridade - a.prioridade || a.id.localeCompare(b.id));
}

export function gradeDoProto(proto?: TemaArquiteto): { w: number; h: number } {
  return { w: proto?.grade?.w ?? 3, h: proto?.grade?.h ?? 3 };
}

export function gradeDoZona(zonaKind: ZonaKindTiles): { w: number; h: number } {
  return gradeDoProto(listarProtos(zonaKind)[0]);
}

export function calibracaoDoProto(proto?: TemaArquiteto): CalibracaoSala | undefined {
  if (!proto) return undefined;
  return proto.calibracao ?? CALIBRACAO_PADRAO;
}

/**
 * Tema marcado para geracao nesta zona. Sem marca, cai no de maior prioridade.
 * `rng` + `jaUsadosUnicos` mantidos na assinatura por compatibilidade com o solver.
 */
export function escolherTema(
  zonaKind: ZonaKindTiles,
  _rng: Rng,
  jaUsadosUnicos: Set<string>,
  temas: readonly TemaArquiteto[] = BIBLIA_TEMAS.temas,
): TemaArquiteto | undefined {
  const escolhido = temaMarcadoDaZona(zonaKind, temas, jaUsadosUnicos);
  if (escolhido?.unicoNaAgencia) jaUsadosUnicos.add(escolhido.id);
  return escolhido;
}

/**
 * Opcao marcada da zona; se nenhuma estiver marcada, a de maior prioridade.
 * Respeita `unicoNaAgencia` ja consumidos na mesma agencia.
 */
export function temaMarcadoDaZona(
  zonaKind: ZonaKindTiles,
  temas: readonly TemaArquiteto[] = BIBLIA_TEMAS.temas,
  jaUsadosUnicos: ReadonlySet<string> = new Set(),
): TemaArquiteto | undefined {
  const candidatos = listarProtos(zonaKind, temas);
  const livres = candidatos.filter((t) => !t.unicoNaAgencia || !jaUsadosUnicos.has(t.id));
  const lista = livres.length > 0 ? livres : candidatos;
  if (lista.length === 0) return undefined;
  return lista.find((t) => t.marcadoParaGeracao) ?? lista[0];
}

function variantesDe(ts: TileSet): { piso: string; parede: string } {
  const floor = ts.files.floor ?? '';
  const wall = ts.files.wall_r ?? '';
  const piso = floor.match(/Floor_128_(.+)\.png$/)?.[1] ?? 'WoodLight';
  const parede = wall.match(/Wall_R_128_(.+)\.png$/)?.[1] ?? 'BrokenWhite';
  return { piso, parede };
}

function tileSetNomeadoOuMix(piso: string, parede: string): TileVisual {
  const conhecido = TILESETS.find((t) => {
    const v = variantesDe(t);
    return v.piso === piso && v.parede === parede;
  });
  if (conhecido) return { tileSetId: conhecido.tileSetId, piso, parede };
  return { tileSetId: `mix-${piso}-${parede}`, piso, parede };
}

/** Visual direto do proto — tileset/piso/parede salvos no lab. */
export function visualDoProto(
  proto: TemaArquiteto | undefined,
  fallbackTemaNome: string,
): TileVisual {
  if (proto) {
    const piso = proto.pisoLivre ?? proto.piso ?? 'WoodLight';
    const parede = proto.paredeLivre ?? proto.parede ?? 'BrokenWhite';
    const nomeado = TILESETS.find((t) => t.tileSetId === proto.tilesetAtivo);
    if (nomeado) return { tileSetId: nomeado.tileSetId, piso, parede };
    return tileSetNomeadoOuMix(piso, parede);
  }
  const fallback = resolverTileSet(fallbackTemaNome);
  const v = variantesDe(fallback);
  return { tileSetId: fallback.tileSetId, piso: v.piso, parede: v.parede };
}

export function resolverTilesetZona(
  zonaKind: ZonaKindTiles,
  tema: TemaArquiteto | undefined,
  fallbackTemaNome: string,
  rng: Rng,
  politica: BibliaTemas['politicaTiles'] = BIBLIA_TEMAS.politicaTiles,
): TileVisual {
  const slot = politica[zonaKind] ?? { modo: 'default' as const, pisos: [], paredes: [] };

  if (slot.modo === 'unico' && slot.pisos[0]) {
    const piso = slot.pisos[0];
    // Se o proto ja carrega o piso unico, preserva o tileset nomeado (ex.: cool-lab).
    if (tema) {
      const doProto = visualDoProto(tema, fallbackTemaNome);
      if (doProto.piso === piso) return doProto;
    }
    // Sem parede na politica: pega o primeiro TILESETS com esse piso (Concrete → cool-lab).
    if (slot.paredes.length === 0) {
      const conhecido = TILESETS.find((t) => variantesDe(t).piso === piso);
      if (conhecido) {
        const v = variantesDe(conhecido);
        return { tileSetId: conhecido.tileSetId, piso: v.piso, parede: v.parede };
      }
    }
    const parede = slot.paredes[0] ?? tema?.parede ?? 'BrokenWhite';
    return tileSetNomeadoOuMix(piso, parede);
  }
  if (slot.modo === 'opcoes' && slot.pisos.length > 0) {
    const piso = rng.pick(slot.pisos);
    const parede = slot.paredes.length > 0 ? rng.pick(slot.paredes) : (tema?.parede ?? 'BrokenWhite');
    return tileSetNomeadoOuMix(piso, parede);
  }

  return visualDoProto(tema, fallbackTemaNome);
}

export function tileSetDoVisual(visual: TileVisual): TileSet {
  const nomeado = TILESETS.find((t) => t.tileSetId === visual.tileSetId);
  if (nomeado) return nomeado;
  if (visual.piso && visual.parede) return montarTileSet(visual.tileSetId, visual.piso, visual.parede);
  return resolverTileSet(visual.tileSetId);
}

/** Tilesets que o atlas da demo precisa carregar para um OfficeLayout. */
export function tileSetsDoLayout(layout: {
  theme: { name: string };
  rooms: Array<{ tileSetId?: string; piso?: string; parede?: string }>;
  corridorTileSetId?: string;
}): TileSet[] {
  const mapa = new Map<string, TileVisual>();
  const registrar = (id: string, piso?: string, parede?: string) => {
    if (!mapa.has(id)) mapa.set(id, { tileSetId: id, piso, parede });
  };
  registrar(layout.corridorTileSetId ?? layout.theme.name);
  for (const sala of layout.rooms) {
    registrar(sala.tileSetId ?? layout.theme.name, sala.piso, sala.parede);
  }
  return [...mapa.values()].map(tileSetDoVisual);
}

function candidatosChao(kind: string) {
  return INITIAL_CATALOG.assets.filter(
    (a) => a.kind === kind && a.uso !== 'off' && a.papel === 'prop',
  );
}

/** Sem candidato de piso, o Construtor nao tenta o kind (uso off / so parede). */
export function kindChaoAtivo(kind: string): boolean {
  return candidatosChao(kind).length > 0;
}

/**
 * Escolhe variante visual. Ignora `off`. Desk/cadeira preferem `obrigatorio`.
 * Sem candidato devolve undefined (atlas cai no last-wins do kind).
 */
export function escolherAssetId(kind: string, rng: Rng): string | undefined {
  const candidatos = candidatosChao(kind);
  if (candidatos.length === 0) return undefined;
  const obr = candidatos.filter((a) => a.uso === 'obrigatorio');
  const pool = obr.length > 0 ? obr : candidatos;
  return rng.pick(pool).assetId;
}

export function specDoAsset(assetId: string) {
  return INITIAL_CATALOG.assets.find((a) => a.assetId === assetId);
}

/** Spec minimo para colar palco (catalogo do lab ou INITIAL_CATALOG). */
export type ResolverSpec = {
  assetId: string;
  kind: string;
  papel?: string;
  uso?: string;
  camadas?: { assetId: string; dx?: number; dy?: number }[];
  /** Footprint real do catalogo. Ausente = 1x1 (default de `Footprint`). */
  footprint?: { w: number; h: number };
  /** Decisao explicita de colisao do catalogo (`AssetEntry.colide`). Ausente = default por kind em navgrid.ts. */
  colide?: boolean;
};

export type ColarProtoOpts = {
  resolverSpec?: (assetId: string) => ResolverSpec | undefined;
};

function specParaColar(assetId: string, opts?: ColarProtoOpts): ResolverSpec | undefined {
  const injetado = opts?.resolverSpec?.(assetId);
  if (injetado) return injetado;
  const base = specDoAsset(assetId);
  if (!base) return undefined;
  return {
    assetId: base.assetId,
    kind: base.kind,
    papel: base.papel,
    uso: base.uso,
    footprint: base.footprint,
    colide: base.colide,
  };
}

function kindDeSpec(spec: ResolverSpec): Prop['kind'] | undefined {
  if (spec.papel === 'decor' || spec.papel === 'wall') return undefined;
  return spec.kind as Prop['kind'];
}

export function kindDoAsset(assetId: string, opts?: ColarProtoOpts): Prop['kind'] | undefined {
  const spec = specParaColar(assetId, opts);
  if (!spec) return undefined;
  return kindDeSpec(spec);
}

/**
 * Constroi um `ResolverColisao` (navgrid.ts) a partir do MESMO catalogo que
 * `colarProto` usou para montar os props (`opts.resolverSpec`, se houver, ou
 * `INITIAL_CATALOG`). Garante que quem decide "este prop bloqueia?" e a
 * mesma fonte que decidiu o `assetId` da peca - sem isto, o Debugpreview
 * (catalogo do lab) e a producao (`INITIAL_CATALOG`) poderiam divergir na
 * decisao de colisao para o mesmo `assetId`.
 */
export function resolverColisaoDoCatalogo(
  opts?: ColarProtoOpts,
): (p: { assetId?: string }) => boolean | undefined {
  return (p) => {
    if (!p.assetId) return undefined;
    return specParaColar(p.assetId, opts)?.colide;
  };
}

/**
 * Cola o palco do proto na sala. Coordenadas locais (gx, gy) viram celulas
 * do rect. `espelharY` vira o palco para a porta do corredor (faixa norte)
 * sem inventar pecas novas.
 */
export function colarProto(
  sala: Room,
  proto: TemaArquiteto | undefined,
  agentIds: readonly string[],
  espelharY = false,
  opts?: ColarProtoOpts,
): { props: Prop[]; mounts: WallMount[]; wallMedia: WallMedia[] } {
  const props: Prop[] = [];
  const mounts: WallMount[] = [];
  const wallMedia: WallMedia[] = [];
  if (!proto) return { props, mounts, wallMedia };
  const { x0, y0, x1, y1 } = sala.rect;
  const altura = y1 - y0;
  const ocupado = new Set<string>([`${sala.door.x},${sala.door.y}`]);
  let indiceAgente = 0;

  for (const peca of proto.palco) {
    const spec = specParaColar(peca.assetId, opts);
    if (!spec || spec.uso === 'off') continue;
    const gx = x0 + peca.gx;
    const gy = y0 + (espelharY ? altura - 1 - peca.gy : peca.gy);
    if (gx < x0 || gx >= x1 || gy < y0 || gy >= y1) continue;

    const eParede =
      peca.papel === 'wall' || peca.face === 'R' || peca.face === 'L' || spec.papel === 'wall';
    if (eParede) {
      mounts.push({
        assetId: peca.assetId,
        roomId: sala.roomId,
        face: peca.face === 'L' ? 'L' : 'R',
        gx,
        gy,
        dx: peca.dx ?? 0,
        dy: peca.dy ?? 0,
      });
      continue;
    }
    if (spec.papel !== 'prop' && !spec.camadas?.length) continue;
    const kind = kindDeSpec(spec);
    if (!kind) continue;

    const k = `${gx},${gy}`;
    if (ocupado.has(k)) continue;
    ocupado.add(k);

    const ownerAgentId =
      spec.kind === 'desk' && indiceAgente < agentIds.length
        ? agentIds[indiceAgente++]
        : undefined;

    const postoResolvido =
      kind === 'desk' && ownerAgentId
        ? resolverPostoParaMesa(proto, ownerAgentId, indiceAgente - 1, sala, espelharY)
        : undefined;

    props.push({
      propId: `palco-${sala.roomId}-${peca.assetId}-${gx}-${gy}`,
      kind,
      cell: { x: gx, y: gy },
      roomId: sala.roomId,
      ownerAgentId,
      facing: 0,
      footprint: spec.footprint ?? { w: 1, h: 1 },
      assetId: peca.assetId,
      ...(postoResolvido
        ? {
            seat: postoResolvido.cellAlvo,
            seatFacing: postoResolvido.render.facing,
          }
        : {}),
    });
  }

  for (const mid of proto.wallMedia ?? []) {
    const gx = x0 + mid.gx;
    const gy = y0 + (espelharY ? altura - 1 - mid.gy : mid.gy);
    if (gx < x0 || gx >= x1 || gy < y0 || gy >= y1) continue;
    const face = mid.face === 'L' ? 'L' : 'R';
    const size = mid.size ?? { w: 2, h: 1 };
    wallMedia.push({
      mediaId: mid.mediaId || `wm-${sala.roomId}-${gx}-${gy}`,
      kind: mid.kind ?? 'iframe',
      roomId: sala.roomId,
      cell: { x: gx, y: gy },
      size,
      url: mid.url,
      face,
      gx,
      gy,
      dx: mid.dx ?? 0,
      dy: mid.dy ?? 0,
      frame: mid.frame ?? 'none',
      mountAssetId: mid.mountAssetId,
      nestAssetId: mid.nestAssetId ?? mid.mountAssetId,
      screenInset: mid.screenInset,
      screenCorners: mid.screenCorners,
      warpGrid: mid.warpGrid,
      blendMode: mid.blendMode,
      display: mid.display,
      heightPx: mid.heightPx,
    });
    // Garante moldura como WallMount se ainda nao plantada no palco.
    const mountId = mid.mountAssetId ?? mid.nestAssetId;
    if (mountId && mid.frame && mid.frame !== 'none') {
      const jaTem = mounts.some(
        (m) =>
          m.assetId === mountId &&
          m.face === face &&
          m.gx === gx &&
          m.gy === gy &&
          Math.abs(m.dx - (mid.dx ?? 0)) < 0.5 &&
          Math.abs(m.dy - (mid.dy ?? 0)) < 0.5,
      );
      if (!jaTem) {
        mounts.push({
          assetId: mountId,
          roomId: sala.roomId,
          face,
          gx,
          gy,
          dx: mid.dx ?? 0,
          dy: mid.dy ?? 0,
        });
      }
    }
  }

  return { props, mounts, wallMedia };
}
