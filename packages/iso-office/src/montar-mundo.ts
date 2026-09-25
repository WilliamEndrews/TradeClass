/**
 * Montagem unica da planta iso (cliente e servidor).
 *
 * Pipeline TradeClass: planta fixa do Lab (biblia/palco) + elenco ancorado
 * nos assentos. `montarMundoIso` permanece para legado RNG / testes.
 * Deterministico: mesma entrada, mesma planta (ADR-0006).
 */

import type { AgentDescriptor, OfficeLayout } from '@tradeclass/contracts';
import { seriesIdDaEspecialidade } from '@tradeclass/contracts';
import { BIBLIA_TEMAS } from '@tradeclass/world-engine';
import { resolverSpecLab } from './proto-blit/catalogo';
import {
  assinaturaElenco,
  construirEspacoAgencia,
  ordenarElencoCliente,
  type CenarioEspacial,
} from './espaco-agencia';
import { montarAgencia, type AgenciaMontada } from './montar-agencia';
import {
  bindingsDaPlanta,
  carregarPlanta,
  elencoDaPlanta,
} from './plants';
import type { ZonaPedido } from './selecionar-pedido';
import { resolverColisaoDoCatalogo, type ResolverColisao } from '@tradeclass/world-engine';

export const COLAR_LAB = { resolverSpec: resolverSpecLab };

/** Planta padrao Lab → Viewtest → Room (sem escalar por N agentes). */
export const PLANTA_PADRAO_TRADECLASS = 'macro-desk';

export function resolverColisaoLab(): ResolverColisao {
  return resolverColisaoDoCatalogo(COLAR_LAB);
}

export type MundoIso = {
  agencia: AgenciaMontada;
  cenario: CenarioEspacial;
  layout: OfficeLayout;
  /** Elenco efetivamente ancorado nos assentos (pode incluir mocks da planta). */
  elenco: AgentDescriptor[];
  plantaId?: string;
};

/**
 * Placeholder ate o primeiro span OTLP. 1 Boss + 1 copa, mesa do placeholder.
 */
export const AGENTE_PLACEHOLDER: AgentDescriptor = {
  agentId: 'TradeClass-placeholder',
  displayName: 'Aguardando telemetria',
  role: 'unknown',
  framework: 'unknown',
  discoveredVia: 'manual',
  avatarSeed: 0,
};

export function elencoParaPlanta(agentes: readonly AgentDescriptor[]): AgentDescriptor[] {
  const clientes = ordenarElencoCliente(agentes);
  return clientes.length > 0 ? clientes : [AGENTE_PLACEHOLDER];
}

/**
 * Ancora o elenco do backend nos assentos da planta fixa.
 * Preferencia: agentId que ja bate com binding da planta; resto preenche
 * assentos vazios em ordem. Nao muda a geometria (sem remount por quantidade).
 */
export function ancorarElencoNaPlanta(
  plantaId: string,
  agentes: readonly AgentDescriptor[],
): AgentDescriptor[] {
  const bindings = bindingsDaPlanta(plantaId);
  const seats = elencoDaPlanta(plantaId);
  if (seats.length === 0) {
    return elencoParaPlanta(agentes);
  }

  const clientes = ordenarElencoCliente(agentes);
  const byId = new Map(clientes.map((a) => [a.agentId, a]));
  const usados = new Set<string>();
  const out: AgentDescriptor[] = [];

  for (const seatId of seats) {
    const binding = bindings.find((b) => b.agentId === seatId);
    const serie = binding ? seriesIdDaEspecialidade(binding.specialty) : undefined;
    const direto = byId.get(seatId);
    if (direto) {
      out.push({
        ...direto,
        specialty: direto.specialty ?? binding?.specialty,
        seriesId: direto.seriesId ?? serie,
      });
      usados.add(direto.agentId);
      continue;
    }
    const livre = clientes.find((a) => !usados.has(a.agentId));
    if (livre) {
      out.push({
        ...livre,
        specialty: livre.specialty ?? binding?.specialty,
        seriesId: livre.seriesId ?? serie,
      });
      usados.add(livre.agentId);
    } else if (binding) {
      out.push({
        agentId: binding.agentId,
        displayName: binding.displayName,
        role: binding.specialty === 'orchestrator' ? 'orchestrator' : 'analyst',
        framework: 'unknown',
        discoveredVia: 'manual',
        avatarSeed: hashCurto(binding.agentId),
        specialty: binding.specialty,
        seriesId: serie,
      });
    } else {
      out.push({
        ...AGENTE_PLACEHOLDER,
        agentId: seatId,
        displayName: seatId,
        avatarSeed: hashCurto(seatId),
      });
    }
  }

  return out.length > 0 ? out : [AGENTE_PLACEHOLDER];
}

function hashCurto(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Escritorio fixo do Lab: geometria da planta, agentes so preenchem assentos.
 */
export function montarMundoDaPlanta(
  plantaId: string,
  seed: number,
  agentes: readonly AgentDescriptor[],
): MundoIso {
  const agencia = carregarPlanta(plantaId, seed);
  if (!agencia) {
    throw new Error(`montarMundoDaPlanta: planta desconhecida id=${plantaId}`);
  }
  const elenco = ancorarElencoNaPlanta(plantaId, agentes);
  const cenario = construirEspacoAgencia(agencia, elenco);
  return { agencia, cenario, layout: cenario.layout, elenco, plantaId };
}

/**
 * @deprecated Preferir `montarMundoDaPlanta` — escala salas por nClientes (legado RNG).
 */
export function montarMundoIso(
  seed: number,
  agentes: readonly AgentDescriptor[],
): MundoIso {
  const elenco = elencoParaPlanta(agentes);
  const nClientes = elenco.filter((a) => a.agentId !== 'TradeClass-placeholder').length;
  const salas = Math.max(1, nClientes);
  const agencia = montarAgencia({ salas }, seed);
  if (!agencia) {
    throw new Error(`montarMundoIso: pedido invalido seed=${seed} salas=${salas}`);
  }
  const cenario = construirEspacoAgencia(agencia, elenco);
  return { agencia, cenario, layout: cenario.layout, elenco };
}

export function agenciaDeLayout(layout: OfficeLayout): AgenciaMontada {
  const corredorY = layout.corridors[0]?.y ?? 1;
  const slots: AgenciaMontada['slots'] = [];
  for (const room of layout.rooms) {
    const zonaKind = room.kind as ZonaPedido;
    if (zonaKind !== 'private' && zonaKind !== 'break' && zonaKind !== 'boss_room') continue;
    const tema = temaDoZoneId(room.zoneId, zonaKind);
    if (!tema) continue;
    slots.push({
      proto: { key: room.zoneId, zonaKind, tema },
      rect: { ...room.rect },
    });
  }
  return {
    seed: layout.seed,
    grid: { ...layout.grid },
    slots,
    corridors: layout.corridors.map((c) => ({ x: c.x, y: c.y })),
    corredorY,
    pisoCorredor: 'Concrete',
  };
}

/** Ids na ordem da planta: boss, depois privativos (para re-colar no renderer). */
export function elencoIdsDoLayout(layout: OfficeLayout, agencia: AgenciaMontada): string[] {
  const ids: string[] = [];
  const boss = layout.rooms.find((r) => r.kind === 'boss_room');
  if (boss) {
    const mesa = layout.props.find(
      (p) => p.kind === 'desk' && p.roomId === boss.roomId && p.ownerAgentId,
    );
    if (mesa?.ownerAgentId) ids.push(mesa.ownerAgentId);
  }
  for (const slot of agencia.slots) {
    if (slot.proto.zonaKind !== 'private') continue;
    const sala = layout.rooms.find((r) => r.zoneId === slot.proto.key);
    if (!sala) continue;
    const mesa = layout.props.find(
      (p) => p.kind === 'desk' && p.roomId === sala.roomId && p.ownerAgentId,
    );
    if (mesa?.ownerAgentId) ids.push(mesa.ownerAgentId);
  }
  return ids;
}

function temaDoZoneId(zoneId: string, kind: ZonaPedido) {
  const prefix = `${kind}-`;
  if (!zoneId.startsWith(prefix)) {
    return BIBLIA_TEMAS.temas.find((t) => t.id === zoneId);
  }
  const rest = zoneId.slice(prefix.length);
  const dash = rest.indexOf('-');
  const temaId = dash >= 0 ? rest.slice(dash + 1) : rest;
  return BIBLIA_TEMAS.temas.find((t) => t.id === temaId);
}

export function assinaturaElencoDe(agentes: readonly AgentDescriptor[]): string {
  return assinaturaElenco(elencoParaPlanta(agentes).map((a) => a.agentId));
}
