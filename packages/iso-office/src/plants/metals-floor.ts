import type { PlantaFixa } from './tipos';

/** Especialistas em ouro e correlacionados. */
export const PLANTA_METALS_FLOOR: PlantaFixa = {
  id: 'metals-floor',
  nome: 'Metals Floor',
  descricao: 'Especialistas em ouro e correlacionados.',
  salas: [
    {
      temaId: 'boss-room-2',
      zonaKind: 'boss_room',
      desks: [{ specialty: 'orchestrator', seatSlot: 'seat-0', displayName: 'Metals Lead' }],
    },
    {
      temaId: 'sala-completa-piso-azul-new',
      zonaKind: 'private',
      desks: [
        { specialty: 'gold', seatSlot: 'seat-0', displayName: 'Gold Specialist' },
        { specialty: 'gold', seatSlot: 'seat-1', displayName: 'Gold Scout' },
        { specialty: 'news', seatSlot: 'seat-2', displayName: 'Metals News' },
      ],
    },
    {
      temaId: 'copa-simples-new',
      zonaKind: 'break',
      desks: [],
    },
  ],
};
