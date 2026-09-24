/**
 * Contratos de mesa/especialidade para desks de trading.
 * Backend agentico real vem depois; por ora o frontend/mock usa estes tipos.
 * WallMedia vive em layout.ts (fonte unica no OfficeLayout).
 */
import { z } from 'zod';

export const AgentSpecialtySchema = z.enum([
  'macro',
  'news',
  'gold',
  'usd',
  'yen',
  'eur',
  'crypto',
  'orchestrator',
]);
export type AgentSpecialty = z.infer<typeof AgentSpecialtySchema>;

export const AgentDeskBindingSchema = z.object({
  agentId: z.string().min(1),
  specialty: AgentSpecialtySchema,
  roomId: z.string().min(1),
  seatSlot: z.string().min(1),
  displayName: z.string().min(1),
  /** Referencia opcional da sala no Lab (tema/palco). */
  salaRef: z.string().min(1).optional(),
});
export type AgentDeskBinding = z.infer<typeof AgentDeskBindingSchema>;

/**
 * Contrato minimo assento ↔ agentId do backend (varios agentes por sala).
 * `seatId` tipicamente = `${roomId}:${seatSlot}`.
 */
export const SeatAgentLinkSchema = z.object({
  seatId: z.string().min(1),
  agentId: z.string().min(1),
  salaRef: z.string().min(1).optional(),
});
export type SeatAgentLink = z.infer<typeof SeatAgentLinkSchema>;

export const ESPECIALIDADE_COR: Record<AgentSpecialty, string> = {
  macro: '#5eb8a0',
  news: '#c4a35a',
  gold: '#d4a84b',
  usd: '#7dba7a',
  yen: '#6a9fd4',
  eur: '#8aa0c4',
  crypto: '#9b7dba',
  orchestrator: '#d47868',
};

export function seatIdDeBinding(b: Pick<AgentDeskBinding, 'roomId' | 'seatSlot'>): string {
  return `${b.roomId}:${b.seatSlot}`;
}

export function linksDeBindings(bindings: readonly AgentDeskBinding[]): SeatAgentLink[] {
  return bindings.map((b) => ({
    seatId: seatIdDeBinding(b),
    agentId: b.agentId,
    salaRef: b.salaRef ?? b.roomId,
  }));
}
