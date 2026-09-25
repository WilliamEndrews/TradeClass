/**
 * CONTRATO 2 - LAYOUT DO ESCRITORIO
 *
 * Aqui vive a decisao arquitetural mais importante sobre geracao de ambiente
 * (ADR-0004): o LLM NAO produz geometria. O LLM produz o `SpaceProgram`
 * (programa de necessidades, sem coordenadas). Um solver deterministico e
 * seeded transforma o programa em `OfficeLayout` (geometria valida).
 *
 * Consequencias praticas:
 *  - mesma seed + mesmo programa = exatamente o mesmo escritorio, sempre
 *    (essencial para o modo Replay e para testes automatizados);
 *  - impossivel gerar salas sobrepostas ou inalcancaveis, porque a validacao
 *    e feita por codigo, nao por confianca no modelo;
 *  - custo de LLM por escritorio: uma unica chamada.
 */

import { z } from 'zod';
import { AgentRole } from './domain-events.js';

// ---------------------------------------------------------------------------
// ENTRADA: o que o LLM Arquiteto produz (alto nivel, sem coordenadas)
// ---------------------------------------------------------------------------

/** Uma zona funcional pedida pelo programa de necessidades. */
export const ZoneRequest = z.object({
  zoneId: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(['open', 'private', 'break', 'boss_room', 'meeting', 'war_room', 'reception', 'landing']),
  /** Peso relativo de area. O solver normaliza; nao sao metros quadrados. */
  areaWeight: z.number().positive(),
  /** Agentes alocados nesta zona (definem quantas mesas o solver precisa criar). */
  agentIds: z.array(z.string()).default([]),
});
export type ZoneRequest = z.infer<typeof ZoneRequest>;

/**
 * Programa de necessidades. E o unico artefato que o LLM gera.
 * `adjacency` vem do grafo real de colaboracao extraido da telemetria: agentes
 * que se chamam muito ficam perto. Assim o layout tem SIGNIFICADO - o
 * escritorio e um diagrama de arquitetura legivel por intuicao.
 */
export const SpaceProgram = z.object({
  officeId: z.string().min(1),
  /** Semente determinística. Mesma seed => mesmo escritorio. */
  seed: z.number().int().nonnegative(),
  grid: z.object({ width: z.number().int().min(10), height: z.number().int().min(9) }),
  zones: z.array(ZoneRequest).min(1),
  /** Pares de zonas que devem ficar proximas, com peso. */
  adjacency: z
    .array(z.object({ a: z.string(), b: z.string(), weight: z.number().min(0).max(1) }))
    .default([]),
  /** Direcao estetica escolhida pelo Agente Decorador. */
  theme: z
    .object({
      name: z.string().default('nordic-calm'),
      palette: z.array(z.string()).default([]),
      greenery: z.number().min(0).max(1).default(0.4),
    })
    .default({ name: 'nordic-calm', palette: [], greenery: 0.4 }),
});
export type SpaceProgram = z.infer<typeof SpaceProgram>;

// ---------------------------------------------------------------------------
// SAIDA: geometria produzida pelo solver deterministico
// ---------------------------------------------------------------------------

/** Retangulo em coordenadas de grid, inclusivo em x0/y0 e exclusivo em x1/y1. */
export const Rect = z.object({
  x0: z.number().int(),
  y0: z.number().int(),
  x1: z.number().int(),
  y1: z.number().int(),
});
export type Rect = z.infer<typeof Rect>;

export const Cell = z.object({ x: z.number().int(), y: z.number().int() });
export type Cell = z.infer<typeof Cell>;

/**
 * Footprint em celulas do grid (largura x profundidade), ancorado em `Prop.cell`
 * (canto superior-esquerdo, sem rotacao por `facing` - o grid isometrico e
 * estatico, so o sprite gira). Definido aqui, e nao no catalogo de assets,
 * porque e o solver e o navgrid - nao o catalogo visual - quem precisam
 * reservar e bloquear celulas (ADR-0012, decisao 7).
 */
export const Footprint = z.object({
  w: z.number().int().min(1).default(1),
  h: z.number().int().min(1).default(1),
});
export type Footprint = z.infer<typeof Footprint>;

/** Calibracao de blit copiada do proto do laboratorio (pe de parede, ancora de piso). */
export const PontoPx = z.object({ x: z.number(), y: z.number() });
export type PontoPx = z.infer<typeof PontoPx>;

export const CalibracaoSala = z.object({
  ancoraPiso: PontoPx,
  peWallR: PontoPx,
  peWallL: PontoPx,
  pePorta: PontoPx,
  folgaPorta: PontoPx.optional(),
  portaComoFolha: z.boolean().optional(),
  objetos: z
    .record(
      z.object({
        modo: z.enum(['centro', 'canto']),
        ancora: PontoPx.optional(),
        pe: PontoPx.optional(),
      }),
    )
    .optional(),
});
export type CalibracaoSala = z.infer<typeof CalibracaoSala>;

export const Room = z.object({
  roomId: z.string(),
  zoneId: z.string(),
  name: z.string(),
  kind: ZoneRequest.shape.kind,
  rect: Rect,
  /** Celula da porta. Garantidamente adjacente a um corredor (invariante testada). */
  door: Cell,
  /** Tileset visual desta sala (Construtor). Renderer nao escolhe. */
  tileSetId: z.string().optional(),
  /** Variante de piso quando a politica e mix livre (nao um TILESETS nomeado). */
  piso: z.string().optional(),
  /** Variante de parede quando a politica e mix livre. */
  parede: z.string().optional(),
  /** Proto da biblia do lab que foi colado nesta sala. */
  temaId: z.string().optional(),
  /** Ancoras do proto. Renderer usa isto em vez da calibracao global. */
  calibracao: CalibracaoSala.optional(),
});
export type Room = z.infer<typeof Room>;

/**
 * Face de parede emitida pelo Construtor. O renderer so blita; nao recalcula
 * NW/vidro. `glass` nao e TileKind — e material de divisoria.
 * `cell` e a celula de blit (norte/oeste da sala, ou y1 na face sul-corredor).
 */
export const WallFace = z.object({
  cell: Cell,
  papel: z.enum(['wall_l', 'wall_r', 'glass']),
  roomId: z.string(),
  temPorta: z.boolean().default(false),
});
export type WallFace = z.infer<typeof WallFace>;

/**
 * Anexo de parede (AC, janela, poster). Mesmo payload do lab
 * `{ face, gx, gy, dx, dy }`. Nao-colidivel: navgrid nunca consome.
 */
export const WallMount = z.object({
  assetId: z.string().min(1),
  roomId: z.string(),
  face: z.enum(['R', 'L']),
  gx: z.number().int(),
  gy: z.number().int(),
  dx: z.number().default(0),
  dy: z.number().default(0),
});
export type WallMount = z.infer<typeof WallMount>;

/**
 * Midia de parede / tela do trading floor (grafico, banner, iframe, projecao).
 * Nao-colidivel: navgrid nunca consome. Preview no canvas = blit offscreen;
 * detalhe interativo no painel HTML (ADR-0009).
 *
 * Charts legados usam `cell` (piso). Iframes/projection wall-native usam
 * `face` + `gx/gy/dx/dy` (mesmo modelo de WallMount).
 */
export const ScreenInset = z.object({
  u0: z.number().min(0).max(1),
  v0: z.number().min(0).max(1),
  u1: z.number().min(0).max(1),
  v1: z.number().min(0).max(1),
});
export type ScreenInset = z.infer<typeof ScreenInset>;

/** Canto UV relativo ao bbox do sprite.
 * 0..1 = dentro do PNG; valores fora (ex.: -0.5..1.5) esticam alem do bezel
 * — Smart Object parentado ao mount, nao coords absolutas de cena.
 */
export const UV_SOFT_MIN = -4;
export const UV_SOFT_MAX = 5;

export const UvPoint = z.object({
  u: z.number().min(UV_SOFT_MIN).max(UV_SOFT_MAX),
  v: z.number().min(UV_SOFT_MIN).max(UV_SOFT_MAX),
});
export type UvPoint = z.infer<typeof UvPoint>;

/** Quatro cantos da tela no sprite (fonte de verdade para nest/warp). */
export const ScreenCorners = z.object({
  tl: UvPoint,
  tr: UvPoint,
  br: UvPoint,
  bl: UvPoint,
});
export type ScreenCorners = z.infer<typeof ScreenCorners>;

/** Grade de warp opcional (ex.: 3x3 CRT). points.length === cols * rows. */
export const WarpGrid = z.object({
  cols: z.number().int().min(2).max(8),
  rows: z.number().int().min(2).max(8),
  points: z.array(UvPoint).min(4),
});
export type WarpGrid = z.infer<typeof WarpGrid>;

export const WallMediaBlendMode = z.enum(['normal', 'screen', 'linear-dodge']);
export type WallMediaBlendMode = z.infer<typeof WallMediaBlendMode>;

export const WallMediaDisplay = z.enum(['auto', 'image', 'iframe', 'hybrid']);
export type WallMediaDisplay = z.infer<typeof WallMediaDisplay>;

export const WallMediaFrame = z.enum(['none', 'tv', 'big-tv', 'cork', 'screen']);
export type WallMediaFrame = z.infer<typeof WallMediaFrame>;

export const WallMedia = z.object({
  mediaId: z.string().min(1),
  kind: z.enum(['chart', 'banner', 'iframe', 'projection']),
  roomId: z.string(),
  /** Celula ancora no grid (legado charts / pick footprint). */
  cell: Cell,
  /** Tamanho em tiles (w x h) para pick / span ao longo da face. */
  size: Footprint.default({ w: 2, h: 1 }),
  /** Serie OHLCV (feed REST / mock; MetaAPI no proximo ciclo). */
  seriesId: z.string().optional(),
  /** URL para iframe/banner/projection. */
  url: z.string().optional(),
  /** Face da parede (obrigatorio para iframe wall-native). */
  face: z.enum(['R', 'L']).optional(),
  /** Celula local/absoluta na face (WallMount). */
  gx: z.number().int().optional(),
  gy: z.number().int().optional(),
  dx: z.number().default(0).optional(),
  dy: z.number().default(0).optional(),
  /** Moldura TinyHouse ou painel sem moldura. */
  frame: WallMediaFrame.optional(),
  /** Asset da moldura (ponte WallMount). */
  mountAssetId: z.string().optional(),
  /** Asset do catálogo que define sprite + cantos de nest. */
  nestAssetId: z.string().optional(),
  /** Regiao AABB da tela no bbox do sprite (0-1) — legado; preferir screenCorners (UV livre). */
  screenInset: ScreenInset.optional(),
  /** Quatro cantos UV da tela (override do tema / calibração Lab). UV pode sair de 0..1. */
  screenCorners: ScreenCorners.optional(),
  /** Warp opcional (CRT / curvatura). */
  warpGrid: WarpGrid.optional(),
  /** Blend Photoshop-like (default screen no renderer). */
  blendMode: WallMediaBlendMode.optional(),
  /** Como renderizar na parede: auto detecta imagem vs iframe. */
  display: WallMediaDisplay.optional(),
  /** Altura do painel sem moldura (px de cena). */
  heightPx: z.number().positive().optional(),
});
export type WallMedia = z.infer<typeof WallMedia>;

/** Mobiliario e equipamento. `ownerAgentId` liga o objeto ao dono. */
export const Prop = z.object({
  propId: z.string(),
  kind: z.enum(['desk', 'chair', 'plant', 'lamp', 'printer', 'sofa', 'coffee', 'board', 'meter', 'cabinet', 'bookshelf', 'water', 'rug']),
  cell: Cell,
  roomId: z.string(),
  ownerAgentId: z.string().optional(),
  /** Orientacao para o render (0=sul, 1=oeste, 2=norte, 3=leste). */
  facing: z.number().int().min(0).max(3).default(0),
  /** Quantas celulas o objeto ocupa a partir de `cell` (canto sup.-esq.). Maioria e 1x1. */
  footprint: Footprint.default({ w: 1, h: 1 }),
  /** Variante visual (ADR-0012). Sem isto o atlas cai no last-wins do kind. */
  assetId: z.string().optional(),
  /**
   * Celula exata para "trabalhar" nesta mesa - vem do `postoTrabalho`
   * autorado no Lab (botao "marcar assento"), resolvido em geometria pura
   * no momento em que o palco e colado (sem depender do NavGrid, que ainda
   * nao existe nesse ponto do pipeline). Preenchido em `desk` com
   * `ownerAgentId` via match de agentSlot ou indice 1:1 (ver `colarProto`).
   * Ausente = quem consumir usa o vizinho generico (`seatCellFor`), como
   * sempre foi - este campo e aditivo e nao quebra layouts antigos.
   */
  seat: Cell.optional(),
  /** Orientacao do agente sentado, autorada/inferida junto ao posto. */
  seatFacing: z.number().int().min(0).max(3).optional(),
});
export type Prop = z.infer<typeof Prop>;

/**
 * Decoracao de superficie (ADR-0012, decisao 4): notebook, monitor, teclado,
 * mouse, livros - itens pequenos QUE POUSAM sobre um `Prop` (tipicamente uma
 * mesa ou estante). Deliberadamente um array SEPARADO de `props`, e
 * deliberadamente SEM footprint: `navgrid` nunca consome `decor`, entao um
 * item de decor nao pode travar pathfinding nem quebrar a invariante de
 * alcancabilidade de mesa. E puramente estetico - se o solver errar a
 * posicao, o pior caso e uma xicara flutuando, nao um agente preso.
 */
export const Decor = z.object({
  decorId: z.string(),
  kind: z.enum(['laptop', 'monitor', 'keyboard', 'mouse', 'books', 'radio']),
  cell: Cell,
  roomId: z.string(),
  /** Prop sobre o qual este item repousa (a mesa, a estante). Opcional para decor "solto". */
  onPropId: z.string().optional(),
  /** Orientacao para o render (0=sul, 1=oeste, 2=norte, 3=leste). */
  facing: z.number().int().min(0).max(3).default(0),
});
export type Decor = z.infer<typeof Decor>;

export const OfficeLayout = z.object({
  officeId: z.string(),
  seed: z.number().int().nonnegative(),
  grid: z.object({ width: z.number().int(), height: z.number().int() }),
  rooms: z.array(Room),
  props: z.array(Prop),
  /** Decoracao de superficie, nao-colidivel - ver docstring de `Decor`. */
  decor: z.array(Decor).default([]),
  /** Celulas de circulacao (corredores). Base do pathfinding entre salas. */
  corridors: z.array(Cell),
  theme: SpaceProgram.shape.theme,
  /**
   * Faces de parede/vidro. Layouts novos deixam vazio: o preview blita a
   * estrutura do proto (calibracao + tileset), como o laboratorio.
   */
  walls: z.array(WallFace).default([]),
  /** Anexos de parede. Navgrid nao consome. */
  wallMounts: z.array(WallMount).default([]),
  /** Telas / graficos de parede. Navgrid nao consome. */
  wallMedia: z.array(WallMedia).default([]),
  /** Tileset do corredor-espinha (politicaTiles.corridor). */
  corridorTileSetId: z.string().optional(),
});
export type OfficeLayout = z.infer<typeof OfficeLayout>;

/** Preferencia de tipo de sala por papel - usada pelo Arquiteto e por testes. */
export const ROOM_PREFERENCE: Record<AgentRole, ZoneRequest['kind']> = {
  orchestrator: 'boss_room',
  finance: 'private',
  guardian: 'private',
  researcher: 'open',
  analyst: 'open',
  support: 'open',
  engineer: 'open',
  unknown: 'open',
};
