import type { PlantaFixa } from './tipos';

/** Salao + user + macro + news (temas Lab ate remapeamento de zona). */
export const PLANTA_MACRO_DESK: PlantaFixa = {
  id: 'macro-desk',
  nome: 'Macro Desk',
  descricao: 'Salao especialistas, Sala do User, Macroeconomia e Noticias.',
  salas: [
    {
      temaId: 'boss-room-1',
      zonaKind: 'salao_especialistas',
      desks: [
        { specialty: 'orchestrator', seatSlot: 'seat-0', displayName: 'Desk Lead' },
        { specialty: 'macro', seatSlot: 'seat-1', displayName: 'Macro Alpha' },
      ],
    },
    {
      temaId: 'sala-simples2-new',
      zonaKind: 'sala_user',
      desks: [{ specialty: 'news', seatSlot: 'seat-0', displayName: 'User Desk' }],
    },
    {
      temaId: 'sala-simples2-piso-azul-new',
      zonaKind: 'macroeconomia',
      desks: [{ specialty: 'macro', seatSlot: 'seat-0', displayName: 'Macro Beta' }],
    },
    {
      temaId: 'sala-completa-piso-azul-new',
      zonaKind: 'noticias',
      desks: [{ specialty: 'news', seatSlot: 'seat-0', displayName: 'News Wire' }],
    },
  ],
};
