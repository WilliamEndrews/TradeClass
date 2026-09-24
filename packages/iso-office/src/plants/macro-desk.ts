import type { PlantaFixa } from './tipos';

/** Sala macro + news + orquestrador (boss) e copa. */
export const PLANTA_MACRO_DESK: PlantaFixa = {
  id: 'macro-desk',
  nome: 'Macro Desk',
  descricao: 'Sala macro + news + orquestrador (boss) e copa.',
  salas: [
    {
      temaId: 'boss-room-1',
      zonaKind: 'boss_room',
      desks: [
        { specialty: 'orchestrator', seatSlot: 'seat-0', displayName: 'Desk Lead' },
        { specialty: 'macro', seatSlot: 'seat-1', displayName: 'Macro Alpha' },
      ],
    },
    {
      temaId: 'sala-simples2-new',
      zonaKind: 'private',
      desks: [
        { specialty: 'news', seatSlot: 'seat-0', displayName: 'News Wire' },
        { specialty: 'macro', seatSlot: 'seat-1', displayName: 'Macro Beta' },
      ],
    },
    {
      temaId: 'copa-simples-new',
      zonaKind: 'break',
      desks: [],
    },
  ],
};
