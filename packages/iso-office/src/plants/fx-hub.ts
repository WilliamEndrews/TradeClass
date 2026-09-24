import type { PlantaFixa } from './tipos';

/** Mesas USD, Yen e EUR no mesmo piso. */
export const PLANTA_FX_HUB: PlantaFixa = {
  id: 'fx-hub',
  nome: 'FX Hub',
  descricao: 'Mesas USD, Yen e EUR no mesmo piso.',
  salas: [
    {
      temaId: 'boss-room-1',
      zonaKind: 'boss_room',
      desks: [{ specialty: 'orchestrator', seatSlot: 'seat-0', displayName: 'FX Lead' }],
    },
    {
      temaId: 'sala-simples2-piso-azul-new',
      zonaKind: 'private',
      desks: [
        { specialty: 'usd', seatSlot: 'seat-0', displayName: 'USD Desk' },
        { specialty: 'yen', seatSlot: 'seat-1', displayName: 'Yen Desk' },
        { specialty: 'eur', seatSlot: 'seat-2', displayName: 'EUR Desk' },
      ],
    },
    {
      temaId: 'copa-simples-new',
      zonaKind: 'break',
      desks: [],
    },
  ],
};
