/**
 * Selecao unificada (agente / mesa / quadro / wallMedia).
 * O painel lateral sempre espelha textualmente (ADR-0009).
 */

export type SelecaoAlvo =
  | { kind: 'agent'; id: string }
  | { kind: 'desk'; id: string }
  | { kind: 'board'; id: string }
  | { kind: 'wallMedia'; id: string };

export type AbaPainel = 'config' | 'contas' | 'agente' | 'grafico';

export function selecaoDeString(s: string | null): SelecaoAlvo | null {
  if (!s) return null;
  if (s.startsWith('desk:')) return { kind: 'desk', id: s.slice(5) };
  if (s.startsWith('board:')) return { kind: 'board', id: s.slice(6) };
  if (s.startsWith('wm:')) return { kind: 'wallMedia', id: s.slice(3) };
  return { kind: 'agent', id: s };
}

export function chaveSelecao(s: SelecaoAlvo | null): string | null {
  if (!s) return null;
  if (s.kind === 'agent') return s.id;
  if (s.kind === 'desk') return `desk:${s.id}`;
  if (s.kind === 'board') return `board:${s.id}`;
  return `wm:${s.id}`;
}
