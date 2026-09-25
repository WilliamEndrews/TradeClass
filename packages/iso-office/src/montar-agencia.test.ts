import { describe, expect, it } from 'vitest';
import { carregarPlanta, listarPlantas } from './planta';
import { gradeDoProto } from '@tradeclass/world-engine';
import { construirEspacoAgencia } from './espaco-agencia';
import { montarAgencia } from './montar-agencia';
import { seedDoPedido } from './selecionar-pedido';

function overlap(
  a: { x0: number; y0: number; x1: number; y1: number },
  b: { x0: number; y0: number; x1: number; y1: number },
): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

describe('montarAgencia (legado RNG → temas marcados)', () => {
  it('pedido vazio devolve null', () => {
    expect(montarAgencia({ salas: 0 })).toBeNull();
  });

  it('selecionarPedido preenche zonas TradeClass via bridge legado ate remapeamento', () => {
    const agencia = montarAgencia({ salas: 2 }, seedDoPedido({ salas: 2 }));
    expect(agencia).not.toBeNull();
    expect(agencia!.slots.length).toBeGreaterThan(0);
    for (const slot of agencia!.slots) {
      expect([
        'salao_especialistas',
        'sala_user',
        'macroeconomia',
        'noticias',
      ]).toContain(slot.proto.zonaKind);
    }
  });
});

describe('planta fixa TradeClass', () => {
  const plantaId = listarPlantas()[0]?.id ?? 'macro-desk';

  it('carrega planta com as 4 zonas TradeClass', () => {
    const agencia = carregarPlanta(plantaId, 20260915);
    expect(agencia).not.toBeNull();
    expect(agencia!.slots).toHaveLength(4);
    const kinds = agencia!.slots.map((s) => s.proto.zonaKind).sort();
    expect(kinds).toEqual(
      ['macroeconomia', 'noticias', 'sala_user', 'salao_especialistas'].sort(),
    );
  });

  it('cada slot ocupa exatamente a grade do tema', () => {
    const agencia = carregarPlanta(plantaId, 20260915)!;
    for (const slot of agencia.slots) {
      const grade = gradeDoProto(slot.proto.tema);
      expect(slot.rect.x1 - slot.rect.x0).toBe(grade.w);
      expect(slot.rect.y1 - slot.rect.y0).toBe(grade.h);
    }
  });

  it('slots nao se sobrepoem e ha corredor', () => {
    const agencia = carregarPlanta(plantaId, 20260915)!;
    const slots = agencia.slots;
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        expect(overlap(slots[i]!.rect, slots[j]!.rect)).toBe(false);
      }
    }
    expect(agencia.pisoCorredor).toBe('Concrete');
    expect(agencia.corridors.length).toBeGreaterThan(0);
  });

  it('agencia montada gera cenario espacial com agentes', () => {
    const agencia = carregarPlanta(plantaId, 20260915)!;
    const cenario = construirEspacoAgencia(agencia);
    expect(cenario.layout.rooms.length).toBe(agencia.slots.length);
    expect(cenario.agentes.length).toBeGreaterThan(0);
    expect(cenario.nav.cells.length).toBe(agencia.grid.width * agencia.grid.height);
  });

  it('todas as portas encostam no corredor', () => {
    const agencia = carregarPlanta(plantaId, 20260915)!;
    const cenario = construirEspacoAgencia(agencia);
    const corredores = new Set(cenario.layout.corridors.map((c) => `${c.x},${c.y}`));
    for (const room of cenario.layout.rooms) {
      const norte = room.rect.y1 <= agencia.corredorY;
      const vizinho = { x: room.door.x, y: room.door.y + (norte ? 1 : -1) };
      expect(corredores.has(`${vizinho.x},${vizinho.y}`)).toBe(true);
    }
  });
});
