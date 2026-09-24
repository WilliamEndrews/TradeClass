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
});
export type AgentDeskBinding = z.infer<typeof AgentDeskBindingSchema>;

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
