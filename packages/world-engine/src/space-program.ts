/**
 * PROGRAMA DE NECESSIDADES (etapa 1 de 2 da geracao de escritorio)
 *
 * Esta e a etapa que, em producao, sera executada pelo Agente Arquiteto (LLM).
 * A implementacao abaixo e a versao deterministica de referencia: ela produz
 * exatamente o mesmo tipo de artefato que o LLM produzira (`SpaceProgram`),
 * o que nos da duas vantagens enormes:
 *
 *  1. o solver geometrico ja pode ser desenvolvido e testado sem LLM nenhum;
 *  2. quando o LLM entrar, ele e apenas uma implementacao alternativa desta
 *     mesma interface - e podemos comparar as duas (e cair para esta se o
 *     LLM devolver algo invalido). LLM como enfeite, nunca como dependencia
 *     critica de caminho quente (ADR-0005).
 *
 * O LLM NUNCA gera coordenadas. Ver ADR-0004.
 */

import type { AgentDescriptor, SpaceProgram, ZoneRequest } from '@tradeclass/contracts';
import { ROOM_PREFERENCE } from '@tradeclass/contracts';
import { createRng, hashString } from './prng.js';
import { TEMAS } from './themes.js';
import { gradeDoZona, type ZonaTradeClass } from './construtor-biblia.js';

/** Aresta do grafo de colaboracao real, extraido da telemetria. */
export interface CollaborationEdge {
  a: string;
  b: string;
  /** Numero de interacoes observadas (handoffs, chamadas encadeadas). */
  interactions: number;
}

export interface PlanOptions {
  officeId: string;
  seed: number;
  /** Grafo de colaboracao. Se vazio, a adjacencia cai para afinidade de papel. */
  collaboration?: CollaborationEdge[];
  /** Quantos agentes cabem numa area aberta antes de abrir uma segunda. */
  maxAgentsPorAreaAberta?: number;
}

const NOMES_ZONA: Record<ZonaTradeClass, string> = {
  salao_especialistas: 'Salao especialistas',
  sala_user: 'Sala do User',
  macroeconomia: 'Macroeconomia',
  noticias: 'Noticias',
};

/**
 * Monta o programa de necessidades a partir dos agentes descobertos.
 *
 * Conjunto padrao TradeClass (sempre as 4 zonas):
 *  - Salao especialistas
 *  - Sala do User
 *  - Macroeconomia
 *  - Noticias
 *
 * Agentes sao alocados via ROOM_PREFERENCE; zonas sem agentes ficam vazias
 * (mobiliario vem do tema marcado na biblia).
 */
export function planSpaceProgram(agents: AgentDescriptor[], opts: PlanOptions): SpaceProgram {
  const rng = createRng(opts.seed).fork('space-program');

  const porZona = new Map<ZonaTradeClass, string[]>([
    ['salao_especialistas', []],
    ['sala_user', []],
    ['macroeconomia', []],
    ['noticias', []],
  ]);

  for (const agente of agents) {
    const kind = ROOM_PREFERENCE[agente.role] as ZonaTradeClass;
    const lista = porZona.get(kind) ?? porZona.get('sala_user')!;
    lista.push(agente.agentId);
  }

  const zones: ZoneRequest[] = (
    ['salao_especialistas', 'sala_user', 'macroeconomia', 'noticias'] as const
  ).map((kind) => ({
    zoneId: `zone-${kind}`,
    name: NOMES_ZONA[kind],
    kind,
    areaWeight: 1 + (porZona.get(kind)?.length ?? 0) * 0.4,
    agentIds: ordenarPorColaboracao(porZona.get(kind) ?? [], opts.collaboration ?? []),
  }));

  // Grid: cada sala usa a grade do proto da biblia (default 3x3).
  const ladoSala = Math.max(
    3,
    ...zones.map((z) => gradeDoZona(z.kind).w),
  );
  const alturaSala = Math.max(
    3,
    ...zones.map((z) => gradeDoZona(z.kind).h),
  );
  const maxPorFaixa = Math.max(1, Math.ceil(zones.length / 2));
  const largura = clamp(maxPorFaixa * ladoSala + 2, 10, 56);
  const altura = clamp(2 + alturaSala + 1 + alturaSala, 9, 56);

  return {
    officeId: opts.officeId,
    seed: opts.seed,
    grid: { width: largura, height: altura },
    zones,
    adjacency: adjacenciaEntreZonas(zones, opts.collaboration ?? []),
    theme: (() => {
      const tema = rng.pick(TEMAS);
      return { name: tema.name, palette: [...tema.palette], greenery: tema.greenery };
    })(),
  };
}

/**
 * Ordena agentes de forma que quem colabora fique vizinho na lista - e, por
 * consequencia, vizinho de mesa. E aqui que o layout ganha SIGNIFICADO: a
 * planta do escritorio passa a ser um diagrama legivel do sistema real.
 */
function ordenarPorColaboracao(agentIds: string[], arestas: CollaborationEdge[]): string[] {
  if (agentIds.length <= 2 || arestas.length === 0) return [...agentIds];

  const peso = new Map<string, number>();
  for (const e of arestas) {
    peso.set(chave(e.a, e.b), (peso.get(chave(e.a, e.b)) ?? 0) + e.interactions);
  }

  const restantes = new Set(agentIds);
  // Comeca pelo agente mais conectado: ancora estavel e independente da ordem
  // em que os agentes foram descobertos.
  const grau = (id: string) =>
    agentIds.reduce((soma, outro) => soma + (peso.get(chave(id, outro)) ?? 0), 0);
  let atual = [...restantes].sort((a, b) => grau(b) - grau(a) || a.localeCompare(b))[0] as string;

  const saida: string[] = [];
  while (restantes.size > 0) {
    saida.push(atual);
    restantes.delete(atual);
    if (restantes.size === 0) break;
    atual = [...restantes].sort(
      (a, b) =>
        (peso.get(chave(atual, b)) ?? 0) - (peso.get(chave(atual, a)) ?? 0) || a.localeCompare(b),
    )[0] as string;
  }
  return saida;
}

/** Converte colaboracao entre AGENTES em adjacencia desejada entre ZONAS. */
function adjacenciaEntreZonas(
  zones: ZoneRequest[],
  arestas: CollaborationEdge[],
): SpaceProgram['adjacency'] {
  const zonaDoAgente = new Map<string, string>();
  for (const z of zones) for (const id of z.agentIds) zonaDoAgente.set(id, z.zoneId);

  const acumulado = new Map<string, number>();
  let maximo = 0;
  for (const e of arestas) {
    const za = zonaDoAgente.get(e.a);
    const zb = zonaDoAgente.get(e.b);
    if (!za || !zb || za === zb) continue;
    const k = chave(za, zb);
    const v = (acumulado.get(k) ?? 0) + e.interactions;
    acumulado.set(k, v);
    maximo = Math.max(maximo, v);
  }

  const saida: SpaceProgram['adjacency'] = [];
  for (const [k, v] of acumulado) {
    const [a, b] = k.split('\u0000') as [string, string];
    saida.push({ a, b, weight: maximo === 0 ? 0 : v / maximo });
  }
  // Salao especialistas fica perto das demais salas de trabalho.
  const salao = zones.find((z) => z.kind === 'salao_especialistas');
  if (salao) {
    for (const z of zones.filter((z) => z.kind !== 'salao_especialistas' && z.kind !== 'landing')) {
      saida.push({ a: salao.zoneId, b: z.zoneId, weight: 0.45 });
    }
  }
  return saida.sort((x, y) => y.weight - x.weight || x.a.localeCompare(y.a));
}

/** Chave simetrica de par: par(a,b) === par(b,a). */
function chave(a: string, b: string): string {
  return a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Deriva o avatar de um agente do seu id: estavel para sempre, sem banco. */
export function avatarSeedDe(agentId: string): number {
  return hashString(agentId);
}
