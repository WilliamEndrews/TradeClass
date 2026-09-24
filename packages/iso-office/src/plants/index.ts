/**
 * Catalogo de plantas fixas do TradeClass.
 * Substitui o spam RNG de selecionarPedido por escritorios pre-compostos.
 */
import type { AgentDeskBinding } from '@tradeclass/contracts';
import { BIBLIA_TEMAS, type TemaArquiteto } from '@tradeclass/world-engine';
import { montarAgenciaDeProtos, type AgenciaMontada } from '../montar-agencia';
import type { ProtoEscolhido, ZonaPedido } from '../selecionar-pedido';
import { PLANTA_FX_HUB } from './fx-hub';
import { PLANTA_MACRO_DESK } from './macro-desk';
import { PLANTA_METALS_FLOOR } from './metals-floor';
import type { PlantaDesk, PlantaFixa, PlantaSala } from './tipos';

export type { PlantaDesk, PlantaFixa, PlantaSala } from './tipos';

const TEMAS_POR_ID = new Map(BIBLIA_TEMAS.temas.map((t) => [t.id, t]));

/** Primeiro tema da biblia para um zonaKind (fallback estavel). */
function temaPorZona(zonaKind: ZonaPedido): TemaArquiteto | undefined {
  return BIBLIA_TEMAS.temas.find((t) => t.zonaKind === zonaKind);
}

function resolverTemaId(preferido: string, zonaKind: ZonaPedido): TemaArquiteto {
  const direto = TEMAS_POR_ID.get(preferido);
  if (direto) return direto;
  const fallback = temaPorZona(zonaKind);
  if (!fallback) throw new Error(`planta: sem tema para zona ${zonaKind}`);
  return fallback;
}

/** Plantas oficiais — ids de tema preferidos; caem no primeiro da zona se ausentes. */
export const PLANTAS_FIXAS: readonly PlantaFixa[] = [
  PLANTA_MACRO_DESK,
  PLANTA_METALS_FLOOR,
  PLANTA_FX_HUB,
];

export function listarPlantas(): readonly PlantaFixa[] {
  return PLANTAS_FIXAS;
}

export function obterPlanta(id: string): PlantaFixa | undefined {
  return PLANTAS_FIXAS.find((p) => p.id === id);
}

function protosDaPlanta(planta: PlantaFixa): ProtoEscolhido[] {
  return planta.salas.map((sala, i) => {
    const tema = resolverTemaId(sala.temaId, sala.zonaKind);
    return {
      key: `${planta.id}-${sala.zonaKind}-${i}`,
      zonaKind: sala.zonaKind,
      tema,
    };
  });
}

/** Monta AgenciaMontada a partir de uma planta fixa (sem RNG de spam). */
export function carregarPlanta(id: string, seed = 20260915): AgenciaMontada | null {
  const planta = obterPlanta(id);
  if (!planta) return null;
  const protos = protosDaPlanta(planta);
  if (protos.length === 0) return null;
  return montarAgenciaDeProtos(protos, seed >>> 0);
}

/** Bindings mock de agentes para a planta (IDs estaveis). */
export function bindingsDaPlanta(id: string): AgentDeskBinding[] {
  const planta = obterPlanta(id);
  if (!planta) return [];
  const out: AgentDeskBinding[] = [];
  planta.salas.forEach((sala, si) => {
    const roomId = `room-${id}-${sala.zonaKind}-${si}`;
    sala.desks.forEach((d, di) => {
      out.push({
        agentId: `${id}-${d.specialty}-${di}`,
        specialty: d.specialty,
        roomId,
        seatSlot: d.seatSlot,
        displayName: d.displayName,
        salaRef: sala.temaId,
      });
    });
  });
  return out;
}

/** Elenco de agentIds na ordem das salas/desks da planta. */
export function elencoDaPlanta(id: string): string[] {
  return bindingsDaPlanta(id).map((b) => b.agentId);
}
