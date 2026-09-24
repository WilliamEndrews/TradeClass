import { describe, expect, it } from 'vitest';
import {
  bindingsDaPlanta,
  carregarPlanta,
  elencoDaPlanta,
  listarPlantas,
} from './plants';

describe('plantas fixas TradeClass', () => {
  it('lista as tres plantas oficiais', () => {
    const ids = listarPlantas().map((p) => p.id);
    expect(ids).toEqual(['macro-desk', 'metals-floor', 'fx-hub']);
  });

  it('carregarPlanta monta agencia sem spam RNG', () => {
    const a = carregarPlanta('macro-desk', 42);
    const b = carregarPlanta('macro-desk', 42);
    expect(a).not.toBeNull();
    expect(b).toEqual(a);
    expect(a!.slots.length).toBeGreaterThan(0);
  });

  it('bindings e elenco sao estaveis por planta', () => {
    const bindings = bindingsDaPlanta('fx-hub');
    expect(bindings.some((b) => b.specialty === 'usd')).toBe(true);
    expect(elencoDaPlanta('fx-hub')).toEqual(bindings.map((b) => b.agentId));
  });
});
