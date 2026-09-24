/**
 * Tipos das plantas fixas (escritorios pre-compostos).
 */
import type { AgentSpecialty } from '@tradeclass/contracts';
import type { ZonaPedido } from '../selecionar-pedido';

export type PlantaDesk = {
  specialty: AgentSpecialty;
  seatSlot: string;
  displayName: string;
};

export type PlantaSala = {
  temaId: string;
  zonaKind: ZonaPedido;
  desks: PlantaDesk[];
};

export type PlantaFixa = {
  id: string;
  nome: string;
  descricao: string;
  salas: PlantaSala[];
};
