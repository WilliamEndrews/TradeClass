/**
 * Adaptador AgenciaMontada → OfficeLayout + NavGrid + metadados espaciais.
 *
 * Aqui o preview **pode** usar `colarProto` (diferente de `montarAgencia`,
 * que so empacota retangulos). O resultado alimenta pathfinding e a
 * simulacao de atores; o painter visual continua lendo o palco do tema.
 */

import type { Cell, OfficeLayout, Prop, Room } from '@tradeclass/contracts';
import {
  buildNavGrid,
  colarProto,
  facingOlhandoPara,
  footprintCells,
  gradeDoProto,
  isWalkable,
  resolverAssento,
  resolverColisaoDoCatalogo,
  resolverPostoAgente,
  type NavGrid,
} from '@tradeclass/world-engine';
import type { AgenciaMontada } from './montar-agencia';
import { resolverSpecLab } from './proto-blit/catalogo';
import type { ZonaPedido } from './selecionar-pedido';

const COLAR_OPTS = { resolverSpec: resolverSpecLab };

/**
 * Mobiliario que o agente ocioso visita: ele para na celula caminhavel em
 * frente ao objeto e vira para ele. Nunca sobre o objeto.
 */
export const KINDS_INTERESSE: readonly Prop['kind'][] = [
  'printer',
  'cabinet',
  'bookshelf',
  'water',
  'coffee',
  'board',
];

export type PontoInteresse = {
  propId: string;
  kind: Prop['kind'];
  /** Celula caminhavel onde o agente estaciona. */
  cell: Cell;
  /** Orientacao que faz o agente encarar o objeto. */
  facing: 0 | 1 | 2 | 3;
};

export type AgenteEspacial = {
  agentId: string;
  zonaKind: ZonaPedido;
  roomId: string;
  door: Cell;
  desk?: Prop;
  seat?: Cell;
  seatFrac?: { x: number; y: number; facing: 0 | 1 | 2 | 3 };
  roomRect: Room['rect'];
  /** Paradas de interesse na propria sala, para o passeio ocioso. */
  pontosInteresse: PontoInteresse[];
  /** Celulas livres da sala onde parar nao coloca o agente sobre um asset. */
  passeio: Cell[];
};

export type LayoutDaAgencia = {
  layout: OfficeLayout;
  corredorY: number;
};

export type CenarioEspacial = LayoutDaAgencia & {
  agentes: AgenteEspacial[];
  nav: NavGrid;
  entrada: Cell;
  /** Chaves `x,y` cobertas por mobiliario — destinos de parada as evitam. */
  ocupadas: ReadonlySet<string>;
};

function ladoDoSlot(rect: Room['rect'], corredorY: number): 'norte' | 'sul' {
  return rect.y1 <= corredorY ? 'norte' : 'sul';
}

function salaDeSlot(
  slot: AgenciaMontada['slots'][number],
  corredorY: number,
): Room {
  const { w } = gradeDoProto(slot.proto.tema);
  const lado = ladoDoSlot(slot.rect, corredorY);
  const portaX = slot.rect.x0 + Math.floor((w - 1) / 2);
  const portaY = lado === 'norte' ? slot.rect.y1 - 1 : slot.rect.y0;

  return {
    roomId: `room-${slot.proto.key}`,
    zoneId: slot.proto.key,
    name: slot.proto.tema.nome,
    kind: slot.proto.zonaKind,
    rect: { ...slot.rect },
    door: { x: portaX, y: portaY },
  };
}

function agentIdsDoSlot(zonaKind: string, indicePriv: number): string[] {
  if (zonaKind === 'salao_especialistas') return ['agent-boss'];
  if (
    zonaKind === 'sala_user' ||
    zonaKind === 'macroeconomia' ||
    zonaKind === 'noticias'
  ) {
    return [`agent-priv-${indicePriv}`];
  }
  return [];
}

/** Ids a partir dos postos do tema (multi-seat). */
export function agentIdsDosPostos(
  tema: { postosTrabalho?: readonly { agentSlot: string }[] },
  zonaKind: string,
  indicePrivBase: number,
): string[] {
  const postos = tema.postosTrabalho ?? [];
  if (postos.length === 0) return agentIdsDoSlot(zonaKind, indicePrivBase);

  return postos.map((p, i) => {
    const slot = p.agentSlot;
    if (slot !== 'default') return slot;
    if (zonaKind === 'salao_especialistas') return i === 0 ? 'agent-boss' : `agent-boss-${i}`;
    return `agent-priv-${indicePrivBase + i}`;
  });
}

export function construirEspacoAgencia(agencia: AgenciaMontada): CenarioEspacial {
  const rooms: Room[] = [];
  const props: Prop[] = [];
  const wallMounts: OfficeLayout['wallMounts'] = [];
  const wallMedia: OfficeLayout['wallMedia'] = [];
  let indicePriv = 0;
  const agentesPorZona = new Map<string, string[]>();

  for (const slot of agencia.slots) {
    const sala = salaDeSlot(slot, agencia.corredorY);
    rooms.push(sala);

    const zonaKind = slot.proto.zonaKind;
    let agentIds: string[];
    if (zonaKind === 'landing' || zonaKind === 'corridor') {
      agentIds = [];
    } else {
      const base = indicePriv;
      agentIds = agentIdsDosPostos(slot.proto.tema, zonaKind, base);
      if (
        zonaKind === 'sala_user' ||
        zonaKind === 'macroeconomia' ||
        zonaKind === 'noticias'
      ) {
        indicePriv += Math.max(1, agentIds.length);
      }
    }
    agentesPorZona.set(slot.proto.key, agentIds);

    // O palco visual e espacial preserva a orientacao autorada no lab.
    // A porta/soleira e orientada separadamente conforme a faixa.
    const resultado = colarProto(sala, slot.proto.tema, agentIds, false, COLAR_OPTS);
    props.push(...resultado.props);
    wallMounts.push(...resultado.mounts);
    wallMedia.push(...resultado.wallMedia);
  }

  const layout: OfficeLayout = {
    officeId: `viewtest-${agencia.seed}`,
    seed: agencia.seed >>> 0,
    grid: { ...agencia.grid },
    rooms,
    props,
    decor: [],
    corridors: agencia.corridors.map((c) => ({ ...c })),
    theme: { name: 'viewtest', palette: [], greenery: 0.3 },
    walls: [],
    wallMounts,
    wallMedia,
    corridorTileSetId: 'Concrete',
  };

  // resolverColisaoDoCatalogo(COLAR_OPTS): mesmo catalogo do lab que colarProto
  // usou acima para escolher os assetId dos props - decisao de colisao consistente.
  const nav = buildNavGrid(layout, { resolverColisao: resolverColisaoDoCatalogo(COLAR_OPTS) });

  const salao = rooms.find((r) => r.kind === 'salao_especialistas');
  const entrada = salao?.door ?? rooms.find((r) => r.kind === 'sala_user')?.door ?? agencia.corridors[0] ?? { x: 1, y: 1 };

  const agentes: AgenteEspacial[] = [];
  const ocupadas = celulasOcupadasPorProps(props);
  for (const slot of agencia.slots) {
    if (slot.proto.zonaKind === 'landing' || slot.proto.zonaKind === 'corridor') continue;

    const sala = rooms.find((r) => r.zoneId === slot.proto.key);
    if (!sala) continue;

    const agentIds = agentesPorZona.get(slot.proto.key) ?? [];
    agentIds.forEach((agentId, i) => {
      const desk = props.find((p) => p.kind === 'desk' && p.ownerAgentId === agentId);
      const posto = resolverPostoAgente(slot.proto.tema, agentId, sala, false, i);
      const seat = desk ? (resolverAssento(nav, desk) ?? undefined) : undefined;

      agentes.push({
        agentId,
        zonaKind: slot.proto.zonaKind as ZonaPedido,
        roomId: sala.roomId,
        door: { ...sala.door },
        desk,
        seat,
        seatFrac: posto?.render,
        roomRect: { ...sala.rect },
        pontosInteresse: pontosDeInteresseNaSala(nav, props, sala.rect, ocupadas),
        passeio: celulasDePasseio(nav, sala.rect, sala.door, ocupadas),
      });
    });
  }

  return {
    layout,
    corredorY: agencia.corredorY,
    agentes,
    nav,
    entrada,
    ocupadas,
  };
}

/**
 * Kinds sobre os quais parar e visualmente aceitavel: o tapete e o proprio
 * assento fazem parte do posto. Qualquer outro mobiliario vira "em cima do
 * asset" e e excluido dos destinos do passeio.
 */
const KINDS_PISAVEIS: readonly Prop['kind'][] = ['rug', 'chair'];

const VIZINHANCA: readonly { x: number; y: number }[] = [
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];

function chaveCelula(c: Cell): string {
  return `${c.x},${c.y}`;
}

function dentroDoRect(c: Cell, rect: Room['rect']): boolean {
  return c.x >= rect.x0 && c.x < rect.x1 && c.y >= rect.y0 && c.y < rect.y1;
}

/** Celulas cobertas por mobiliario onde um agente parado ficaria sobre o asset. */
export function celulasOcupadasPorProps(props: readonly Prop[]): Set<string> {
  const out = new Set<string>();
  for (const prop of props) {
    if (KINDS_PISAVEIS.includes(prop.kind)) continue;
    for (const c of footprintCells(prop)) out.add(chaveCelula(c));
  }
  return out;
}

/** Primeira celula livre encostada no objeto, junto com a celula encarada. */
function frenteDoProp(
  nav: NavGrid,
  prop: Prop,
  ocupadas: ReadonlySet<string>,
  aceita: (c: Cell) => boolean,
): { cell: Cell; alvo: Cell } | undefined {
  for (const base of footprintCells(prop)) {
    for (const d of VIZINHANCA) {
      const cell = { x: base.x + d.x, y: base.y + d.y };
      if (!isWalkable(nav, cell) || ocupadas.has(chaveCelula(cell))) continue;
      if (!aceita(cell)) continue;
      return { cell, alvo: base };
    }
  }
  return undefined;
}

/** Paradas de interesse de uma sala: impressora, armario, bebedouro, copiadora… */
export function pontosDeInteresseNaSala(
  nav: NavGrid,
  props: readonly Prop[],
  rect: Room['rect'],
  ocupadas: ReadonlySet<string>,
): PontoInteresse[] {
  const out: PontoInteresse[] = [];
  for (const prop of props) {
    if (!KINDS_INTERESSE.includes(prop.kind)) continue;
    if (!dentroDoRect(prop.cell, rect)) continue;
    const frente = frenteDoProp(nav, prop, ocupadas, (c) => dentroDoRect(c, rect));
    if (!frente) continue;
    out.push({
      propId: prop.propId,
      kind: prop.kind,
      cell: frente.cell,
      facing: facingOlhandoPara(
        { x: frente.cell.x, y: frente.cell.y },
        { x: frente.alvo.x, y: frente.alvo.y },
      ),
    });
  }
  return out;
}

/** Celulas livres da sala onde o agente pode parar sem pisar em mobiliario. */
export function celulasDePasseio(
  nav: NavGrid,
  rect: Room['rect'],
  porta: Cell,
  ocupadas: ReadonlySet<string>,
): Cell[] {
  return celulasWalkableNaSala(nav, rect).filter(
    (c) =>
      !ocupadas.has(chaveCelula(c)) && !(c.x === porta.x && c.y === porta.y),
  );
}

/** Celulas walkable dentro de uma sala (para destino na copa). */
export function celulasWalkableNaSala(
  nav: NavGrid,
  rect: Room['rect'],
): Cell[] {
  const out: Cell[] = [];
  for (let y = rect.y0; y < rect.y1; y++) {
    for (let x = rect.x0; x < rect.x1; x++) {
      const c = { x, y };
      if (nav.cells[y * nav.width + x] === 1) out.push(c);
    }
  }
  return out;
}
