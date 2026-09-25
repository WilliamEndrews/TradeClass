import { describe, expect, it } from 'vitest';
import type { AgentDescriptor } from '@tradeclass/contracts';
import {
  montarMundoDaPlanta,
  montarMundoIso,
  PLANTA_PADRAO_TRADECLASS,
} from './montar-mundo';
import { elencoDaPlanta } from './plants';

function agente(id: string, role: AgentDescriptor['role']): AgentDescriptor {
  return {
    agentId: id,
    displayName: id,
    role,
    framework: 'test',
    discoveredVia: 'manual',
    avatarSeed: 1,
  };
}

describe('montarMundoIso (legado)', () => {
  it('bridge legado preenche zonas TradeClass ate remapeamento', () => {
    const mundo = montarMundoIso(7, [agente('agent_triador_01', 'researcher')]);
    expect(mundo.agencia.slots.length).toBeGreaterThan(0);
    expect(mundo.layout.rooms.some((r) => r.kind === 'salao_especialistas')).toBe(true);
  });
});

describe('montarMundoDaPlanta', () => {
  it('geometria fixa independente do N de agentes', () => {
    const um = montarMundoDaPlanta(PLANTA_PADRAO_TRADECLASS, 1, [
      agente('sozinho', 'analyst'),
    ]);
    const muitos = montarMundoDaPlanta(PLANTA_PADRAO_TRADECLASS, 1, [
      agente('a', 'analyst'),
      agente('b', 'finance'),
      agente('c', 'researcher'),
      agente('d', 'guardian'),
      agente('e', 'orchestrator'),
    ]);
    expect(um.layout.rooms.map((r) => r.kind).sort()).toEqual(
      muitos.layout.rooms.map((r) => r.kind).sort(),
    );
    expect(um.layout.rooms).toHaveLength(4);
  });

  it('macro-desk tem as 4 zonas TradeClass', () => {
    const mundo = montarMundoDaPlanta(PLANTA_PADRAO_TRADECLASS, 1, [
      agente('a', 'analyst'),
    ]);
    expect(mundo.layout.rooms.filter((r) => r.kind === 'salao_especialistas')).toHaveLength(1);
    expect(mundo.layout.rooms.filter((r) => r.kind === 'sala_user')).toHaveLength(1);
    expect(mundo.layout.rooms.filter((r) => r.kind === 'macroeconomia')).toHaveLength(1);
    expect(mundo.layout.rooms.filter((r) => r.kind === 'noticias')).toHaveLength(1);
    expect(mundo.elenco.length).toBe(elencoDaPlanta(PLANTA_PADRAO_TRADECLASS).length);
  });
});
