import { describe, expect, it } from 'vitest';
import { ZONAS_TRADECLASS } from '@tradeclass/world-engine';
import {
  seedDaGeracao,
  seedDoPedido,
  selecionarPedido,
} from './selecionar-pedido';

describe('selecionarPedido', () => {
  it('mesma chamada produz a mesma lista (temas marcados, sem RNG)', () => {
    const seed = seedDaGeracao({ salas: 2 }, 3, 99);
    const a = selecionarPedido({ salas: 2 }, seed);
    const b = selecionarPedido({ salas: 2 }, seed);
    expect(a.map((p) => p.tema.id)).toEqual(b.map((p) => p.tema.id));
  });

  it('pedido.salas nao altera o conjunto (sempre as zonas TradeClass marcadas)', () => {
    const a = selecionarPedido({ salas: 1 }, seedDoPedido({ salas: 1 }));
    const b = selecionarPedido({ salas: 9 }, seedDoPedido({ salas: 9 }));
    expect(a.map((p) => p.zonaKind)).toEqual(b.map((p) => p.zonaKind));
  });

  it('so inclui zonas TradeClass, no maximo uma por zona', () => {
    const lista = selecionarPedido({ salas: 4 }, seedDoPedido({ salas: 4 }));
    for (const p of lista) {
      expect(ZONAS_TRADECLASS).toContain(p.zonaKind);
    }
    const kinds = lista.map((p) => p.zonaKind);
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it('marca unicoNaAgencia sem repetir enquanto houver alternativa', () => {
    const seed = seedDaGeracao({ salas: 2 }, 1, 1);
    const lista = selecionarPedido({ salas: 2 }, seed);
    const unicos = lista.filter((p) => p.tema.unicoNaAgencia).map((p) => p.tema.id);
    expect(new Set(unicos).size).toBe(unicos.length);
  });
});
