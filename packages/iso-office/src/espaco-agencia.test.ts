import { describe, expect, it } from 'vitest';
import { carregarPlanta } from './planta';
import { footprintCells, isWalkable } from '@tradeclass/world-engine';
import {
  celulasOcupadasPorProps,
  celulasWalkableNaSala,
  construirEspacoAgencia,
  KINDS_INTERESSE,
} from './espaco-agencia';

const PLANTA = 'macro-desk';

describe('construirEspacoAgencia', () => {
  it('porta norte fica na borda sul da sala (y1-1)', () => {
    const agencia = carregarPlanta(PLANTA, 20260915)!;
    const cenario = construirEspacoAgencia(agencia);

    const salasNorte = cenario.layout.rooms.filter((r) => r.rect.y1 <= agencia.corredorY);
    expect(salasNorte.length).toBeGreaterThan(0);
    for (const sala of salasNorte) {
      expect(sala.door.y).toBe(sala.rect.y1 - 1);
    }
  });

  it('porta sul fica na borda norte da sala (y0)', () => {
    const agencia = carregarPlanta(PLANTA, 20260915)!;
    const cenario = construirEspacoAgencia(agencia);

    const salasSul = cenario.layout.rooms.filter((r) => r.rect.y0 > agencia.corredorY);
    for (const sala of salasSul) {
      expect(sala.door.y).toBe(sala.rect.y0);
    }
  });

  it('salao especialistas tem mesa e assento walkable', () => {
    const agencia = carregarPlanta(PLANTA, 20260915)!;
    const cenario = construirEspacoAgencia(agencia);
    const boss = cenario.agentes.find((a) => a.agentId === 'agent-boss' || a.agentId === 'seat-0');
    expect(cenario.agentes.length).toBeGreaterThan(0);
    const comMesa = cenario.agentes.find((a) => a.desk);
    expect(comMesa).toBeDefined();
    if (comMesa?.desk) {
      expect(isWalkable(cenario.nav, comMesa.desk.cell)).toBe(false);
    }
    if (comMesa?.seat) {
      expect(isWalkable(cenario.nav, comMesa.seat)).toBe(true);
    }
    void boss;
  });

  it('corredor conecta salas (celulas walkable)', () => {
    const agencia = carregarPlanta(PLANTA, 20260915)!;
    const cenario = construirEspacoAgencia(agencia);
    expect(cenario.layout.corridors.length).toBeGreaterThan(0);
    for (const c of cenario.layout.corridors) {
      expect(isWalkable(cenario.nav, c)).toBe(true);
    }
  });

  it('ponto de interesse fica em frente ao objeto, nunca sobre ele', () => {
    const agencia = carregarPlanta(PLANTA, 20260915)!;
    const cenario = construirEspacoAgencia(agencia);
    const ocupadas = celulasOcupadasPorProps(cenario.layout.props);

    let total = 0;
    for (const agente of cenario.agentes) {
      for (const poi of agente.pontosInteresse) {
        total += 1;
        expect(KINDS_INTERESSE).toContain(poi.kind);
        expect(isWalkable(cenario.nav, poi.cell)).toBe(true);
        expect(ocupadas.has(`${poi.cell.x},${poi.cell.y}`)).toBe(false);

        const prop = cenario.layout.props.find((p) => p.propId === poi.propId)!;
        const encostado = footprintCells(prop).some(
          (c) => Math.abs(c.x - poi.cell.x) + Math.abs(c.y - poi.cell.y) === 1,
        );
        expect(encostado).toBe(true);
      }
    }
    expect(total).toBeGreaterThan(0);
  });

  it('celulas de passeio nao caem sobre mobiliario nem na porta', () => {
    const agencia = carregarPlanta(PLANTA, 20260915)!;
    const cenario = construirEspacoAgencia(agencia);
    const ocupadas = celulasOcupadasPorProps(cenario.layout.props);

    for (const agente of cenario.agentes) {
      expect(agente.passeio.length).toBeGreaterThan(0);
      for (const c of agente.passeio) {
        expect(isWalkable(cenario.nav, c)).toBe(true);
        expect(ocupadas.has(`${c.x},${c.y}`)).toBe(false);
        expect(c.x === agente.door.x && c.y === agente.door.y).toBe(false);
      }
    }
  });

  it('salao especialistas tem celulas walkable', () => {
    const agencia = carregarPlanta(PLANTA, 20260915)!;
    const cenario = construirEspacoAgencia(agencia);
    const salao = cenario.layout.rooms.find((r) => r.kind === 'salao_especialistas');
    expect(salao).toBeDefined();
    const celulas = celulasWalkableNaSala(cenario.nav, salao!.rect);
    expect(celulas.length).toBeGreaterThan(0);
  });
});
