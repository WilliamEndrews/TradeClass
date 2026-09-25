import { describe, expect, it } from 'vitest';
import { carregarPlanta } from '@tradeclass/iso-office/planta';
import { isWalkable } from '@tradeclass/world-engine';
import { celulasOcupadasPorProps, construirEspacoAgencia } from './espaco-agencia';
import { SimulacaoAgentes } from './simulacao-agentes';

const PLANTA = 'macro-desk';

describe('SimulacaoAgentes', () => {
  it('path so usa celulas walkable', () => {
    const agencia = carregarPlanta(PLANTA, 20260915)!;
    const cenario = construirEspacoAgencia(agencia);
    const sim = new SimulacaoAgentes(cenario, 20260915);

    for (let i = 0; i < 200; i++) {
      sim.tick(50);
      const debug = sim.debugInfo();
      for (const path of debug.paths.values()) {
        for (const c of path) {
          expect(isWalkable(cenario.nav, c)).toBe(true);
        }
      }
    }
  });

  it('agente completa ciclo de fases ao longo do tempo', () => {
    const agencia = carregarPlanta(PLANTA, 20260915)!;
    const cenario = construirEspacoAgencia(agencia);
    const sim = new SimulacaoAgentes(cenario, 20260915);

    const vistos = new Set<string>();
    for (let i = 0; i < 800; i++) {
      const atores = sim.tick(50);
      for (const a of atores) vistos.add(a.activity);
    }

    expect(vistos.has('working')).toBe(true);
    expect(vistos.has('walking')).toBe(true);
    expect(vistos.has('resting')).toBe(true);
  });

  it('agente ocioso passeia e para em frente a um ponto de interesse', () => {
    const agencia = carregarPlanta(PLANTA, 20260915)!;
    const cenario = construirEspacoAgencia(agencia);
    const sim = new SimulacaoAgentes(cenario, 20260915);

    const pois = new Map(
      cenario.agentes.map((a) => [
        a.agentId,
        new Set(a.pontosInteresse.map((p) => `${p.cell.x},${p.cell.y}`)),
      ]),
    );
    const visitados = new Set<string>();
    const longeDoAssento = new Set<string>();

    for (let i = 0; i < 1600; i++) {
      for (const a of sim.tick(50)) {
        const meta = cenario.agentes.find((m) => m.agentId === a.agentId)!;
        if (a.activity === 'idle' && pois.get(a.agentId)?.has(`${a.x},${a.y}`)) {
          visitados.add(a.agentId);
        }
        if (meta.seat && Math.hypot(a.x - meta.seat.x, a.y - meta.seat.y) > 1.5) {
          longeDoAssento.add(a.agentId);
        }
      }
    }

    expect(visitados.size).toBeGreaterThan(0);
    expect(longeDoAssento.size).toBe(cenario.agentes.length);
  });

  it('agente parado nunca ocupa a celula de um asset', () => {
    const agencia = carregarPlanta(PLANTA, 20260915)!;
    const cenario = construirEspacoAgencia(agencia);
    const sim = new SimulacaoAgentes(cenario, 20260915);
    const ocupadas = celulasOcupadasPorProps(cenario.layout.props);

    for (let i = 0; i < 400; i++) {
      for (const a of sim.tick(50)) {
        if (a.activity === 'walking') continue;
        expect(ocupadas.has(`${a.x},${a.y}`)).toBe(false);
      }
    }
  });
});
