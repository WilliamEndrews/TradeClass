import { describe, expect, it } from 'vitest';
import { SyntheticStream } from '@tradeclass/synthetic';
import {
  elencoDaPlanta,
  montarMundoDaPlanta,
  PLANTA_PADRAO_TRADECLASS,
} from '@tradeclass/iso-office';

describe('world-source planta fixa Lab', () => {
  it('elenco sintetico: geometria da planta, nao de nClientes', () => {
    const stream = new SyntheticStream({ seed: 20260802, comRoteiro: true });
    const mundo = montarMundoDaPlanta(PLANTA_PADRAO_TRADECLASS, 20260802, stream.agents);
    const seats = elencoDaPlanta(PLANTA_PADRAO_TRADECLASS);
    expect(mundo.plantaId).toBe(PLANTA_PADRAO_TRADECLASS);
    expect(mundo.layout.rooms.filter((r) => r.kind === 'salao_especialistas')).toHaveLength(1);
    expect(mundo.layout.rooms.filter((r) => r.kind === 'noticias')).toHaveLength(1);
    expect(mundo.layout.rooms.filter((r) => r.kind === 'sala_user')).toHaveLength(1);
    expect(mundo.layout.rooms.filter((r) => r.kind === 'macroeconomia')).toHaveLength(1);
    const donos = new Set(
      mundo.layout.props
        .filter((p) => p.kind === 'desk' && p.ownerAgentId)
        .map((p) => p.ownerAgentId),
    );
    expect(donos.size).toBeGreaterThan(0);
    expect(mundo.elenco.length).toBe(seats.length);
    for (const id of donos) {
      expect(mundo.elenco.some((a) => a.agentId === id)).toBe(true);
    }
  });

  it('1 agente: ainda usa planta fixa (assentos restantes mock)', () => {
    const stream = new SyntheticStream({
      seed: 1,
      comRoteiro: false,
      elencoCustomizado: [
        {
          id: 'agent-triagem',
          nome: 'Triagem',
          role: 'guardian',
          framework: 'langgraph',
          taxa: 0.4,
          duracao: 2600,
          erro: 0.04,
          custo: 0.004,
          modelo: 'gpt-4o-mini',
        },
      ],
    });
    const mundo = montarMundoDaPlanta(PLANTA_PADRAO_TRADECLASS, 1, stream.agents);
    expect(mundo.layout.rooms.filter((r) => r.kind === 'salao_especialistas')).toHaveLength(1);
    expect(mundo.layout.rooms.filter((r) => r.kind === 'sala_user')).toHaveLength(1);
    expect(mundo.layout.rooms.filter((r) => r.kind === 'noticias')).toHaveLength(1);
    expect(
      mundo.layout.props.some((p) => p.kind === 'desk' && p.ownerAgentId === 'agent-triagem'),
    ).toBe(true);
  });

  it('mesmo N de agentes nao remonta salas extras', () => {
    const a = new SyntheticStream({ seed: 42, comRoteiro: true });
    const b = new SyntheticStream({
      seed: 42,
      comRoteiro: false,
      quantidadeAgentes: a.agents.length + 5,
    });
    const ma = montarMundoDaPlanta(PLANTA_PADRAO_TRADECLASS, 42, a.agents);
    const mb = montarMundoDaPlanta(PLANTA_PADRAO_TRADECLASS, 42, b.agents);
    expect(ma.layout.rooms.length).toBe(mb.layout.rooms.length);
    expect(ma.layout.grid.width).toBe(mb.layout.grid.width);
    expect(ma.layout.grid.height).toBe(mb.layout.grid.height);
  });
});
