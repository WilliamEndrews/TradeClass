import type { PlantaFixa } from './tipos';

/** Mesas USD, Yen e EUR no mesmo piso. */
export const PLANTA_FX_HUB: PlantaFixa = {
  id: 'fx-hub',
  nome: 'FX Hub',
  descricao: 'Mesas USD, Yen e EUR no mesmo piso.',
  salas: [
    {
      temaId: 'boss-room-1',
      zonaKind: 'salao_especialistas',
      desks: [{ specialty: 'orchestrator', seatSlot: 'seat-0', displayName: 'FX Lead' }],
    },
    {
      temaId: 'sala-simples2-new',
      zonaKind: 'sala_user',
      desks: [{ specialty: 'usd', seatSlot: 'seat-0', displayName: 'User FX' }],
    },
    {
      temaId: 'sala-simples2-piso-azul-new',
      zonaKind: 'macroeconomia',
      desks: [
        { specialty: 'usd', seatSlot: 'seat-0', displayName: 'USD Desk' },
        { specialty: 'yen', seatSlot: 'seat-1', displayName: 'Yen Desk' },
        { specialty: 'eur', seatSlot: 'seat-2', displayName: 'EUR Desk' },
      ],
    },
    {
      temaId: 'copa-simples-new',
      zonaKind: 'noticias',
      desks: [{ specialty: 'news', seatSlot: 'seat-0', displayName: 'FX News' }],
    },
  ],
};
