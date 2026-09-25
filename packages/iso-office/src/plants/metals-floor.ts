import type { PlantaFixa } from './tipos';

/** Especialistas em ouro e correlacionados. */
export const PLANTA_METALS_FLOOR: PlantaFixa = {
  id: 'metals-floor',
  nome: 'Metals Floor',
  descricao: 'Especialistas em ouro e correlacionados.',
  salas: [
    {
      temaId: 'boss-room-2',
      zonaKind: 'salao_especialistas',
      desks: [{ specialty: 'orchestrator', seatSlot: 'seat-0', displayName: 'Metals Lead' }],
    },
    {
      temaId: 'sala-simples2-new',
      zonaKind: 'sala_user',
      desks: [{ specialty: 'gold', seatSlot: 'seat-0', displayName: 'User Metals' }],
    },
    {
      temaId: 'sala-completa-piso-azul-new',
      zonaKind: 'macroeconomia',
      desks: [
        { specialty: 'gold', seatSlot: 'seat-0', displayName: 'Gold Specialist' },
        { specialty: 'gold', seatSlot: 'seat-1', displayName: 'Gold Scout' },
      ],
    },
    {
      temaId: 'copa-simples-new',
      zonaKind: 'noticias',
      desks: [{ specialty: 'news', seatSlot: 'seat-0', displayName: 'Metals News' }],
    },
  ],
};
