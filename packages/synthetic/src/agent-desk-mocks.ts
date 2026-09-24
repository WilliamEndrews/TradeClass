/**
 * Gerador sintetico de bindings agent↔desk para plantas fixas.
 */
import type { AgentDeskBinding, AgentSpecialty } from '@tradeclass/contracts';

export type PlantaDeskSpec = {
  specialty: AgentSpecialty;
  seatSlot: string;
  displayName: string;
  roomKey: string;
};

/**
 * Cria AgentDeskBinding[] deterministico a partir de desks de uma planta.
 * `plantaId` entra no agentId para nao colidir entre plantas.
 */
export function gerarDeskBindingsDaPlanta(
  plantaId: string,
  desks: readonly PlantaDeskSpec[],
): AgentDeskBinding[] {
  return desks.map((d, i) => ({
    agentId: `${plantaId}-${d.specialty}-${i}`,
    specialty: d.specialty,
    roomId: `room-${plantaId}-${d.roomKey}`,
    seatSlot: d.seatSlot,
    displayName: d.displayName,
  }));
}

/** Elenco mock tipico para demo FX (usd/yen/eur + orchestrator). */
export function elencoMockFxHub(): AgentDeskBinding[] {
  return gerarDeskBindingsDaPlanta('fx-hub', [
    {
      specialty: 'orchestrator',
      seatSlot: 'seat-0',
      displayName: 'FX Lead',
      roomKey: 'boss_room-0',
    },
    { specialty: 'usd', seatSlot: 'seat-0', displayName: 'USD Desk', roomKey: 'private-0' },
    { specialty: 'yen', seatSlot: 'seat-1', displayName: 'Yen Desk', roomKey: 'private-0' },
    { specialty: 'eur', seatSlot: 'seat-2', displayName: 'EUR Desk', roomKey: 'private-0' },
  ]);
}

/** Elenco mock tipico para demo metals. */
export function elencoMockMetalsFloor(): AgentDeskBinding[] {
  return gerarDeskBindingsDaPlanta('metals-floor', [
    {
      specialty: 'orchestrator',
      seatSlot: 'seat-0',
      displayName: 'Metals Lead',
      roomKey: 'boss_room-0',
    },
    {
      specialty: 'gold',
      seatSlot: 'seat-0',
      displayName: 'Gold Specialist',
      roomKey: 'private-0',
    },
    { specialty: 'gold', seatSlot: 'seat-1', displayName: 'Gold Scout', roomKey: 'private-0' },
    { specialty: 'news', seatSlot: 'seat-2', displayName: 'Metals News', roomKey: 'private-0' },
  ]);
}

/** Elenco mock tipico para demo macro. */
export function elencoMockMacroDesk(): AgentDeskBinding[] {
  return gerarDeskBindingsDaPlanta('macro-desk', [
    {
      specialty: 'orchestrator',
      seatSlot: 'seat-0',
      displayName: 'Desk Lead',
      roomKey: 'boss_room-0',
    },
    { specialty: 'macro', seatSlot: 'seat-1', displayName: 'Macro Alpha', roomKey: 'boss_room-0' },
    { specialty: 'news', seatSlot: 'seat-0', displayName: 'News Wire', roomKey: 'private-0' },
    { specialty: 'macro', seatSlot: 'seat-1', displayName: 'Macro Beta', roomKey: 'private-0' },
  ]);
}
