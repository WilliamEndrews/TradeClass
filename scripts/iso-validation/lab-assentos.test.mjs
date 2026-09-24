import { describe, expect, it } from 'vitest';
import {
  ASSENTO_SLOT_PADRAO,
  clampMaxAssentos,
  estiloLosangoAssento,
  girarFacingManual,
  listarSlotsAssento,
  mesmaSubcelula,
  montarEntradaAssento,
  podeAdicionarSlot,
  proximoSlotLivre,
  removerPostoPorSlot,
  upsertPostoTrabalho,
} from './lab-assentos.mjs';

describe('multi-assento', () => {
  it('lista slots usados + ativo sem duplicar', () => {
    expect(listarSlotsAssento([{ agentSlot: 'seat-1' }], 'seat-0')).toEqual([
      'seat-0',
      'seat-1',
    ]);
    expect(listarSlotsAssento([{ agentSlot: 'seat-0' }], 'seat-0')).toEqual(['seat-0']);
  });

  it('aloca seat-N livre e respeita limite', () => {
    const postos = [
      { agentSlot: 'seat-0', gx: 0, gy: 0 },
      { agentSlot: 'seat-1', gx: 1, gy: 0 },
    ];
    expect(proximoSlotLivre(postos)).toBe('seat-2');
    expect(podeAdicionarSlot(postos, 2)).toBe(false);
    expect(podeAdicionarSlot(postos, 3)).toBe(true);
    expect(clampMaxAssentos(99)).toBe(12);
  });

  it('upsert por slot permite varios assentos e bloqueia no max', () => {
    const mesa = [{ assetId: 'desk-a', gx: 2, gy: 1 }];
    const a = montarEntradaAssento({ gx: 2, gy: 2, qx: 0, qy: 0 }, 'seat-0', mesa);
    const b = montarEntradaAssento({ gx: 3, gy: 2, qx: 1, qy: 0 }, 'seat-1', mesa);
    const r1 = upsertPostoTrabalho([], a, 2);
    expect(r1.ok).toBe(true);
    expect(r1.postos).toHaveLength(1);

    const r2 = upsertPostoTrabalho(r1.postos, b, 2);
    expect(r2.ok).toBe(true);
    expect(r2.postos.map((p) => p.agentSlot).sort()).toEqual(['seat-0', 'seat-1']);

    const c = montarEntradaAssento({ gx: 0, gy: 0, qx: 0, qy: 0 }, 'seat-2', mesa);
    const r3 = upsertPostoTrabalho(r2.postos, c, 2);
    expect(r3.ok).toBe(false);
    expect(r3.motivo).toBe('limite');
    expect(r3.postos).toHaveLength(2);

    // Reposicionar o mesmo slot nao conta como novo.
    const a2 = montarEntradaAssento({ gx: 1, gy: 1, qx: 0, qy: 1 }, 'seat-0', mesa);
    const r4 = upsertPostoTrabalho(r2.postos, a2, 2);
    expect(r4.ok).toBe(true);
    expect(r4.postos.find((p) => p.agentSlot === 'seat-0').gx).toBe(1);
  });

  it('remove por slot e gira facing manual', () => {
    const postos = [
      { agentSlot: 'seat-0', gx: 0, gy: 0, facing: 2 },
      { agentSlot: 'seat-1', gx: 1, gy: 0, facing: 0 },
    ];
    expect(removerPostoPorSlot(postos, 'seat-0')).toHaveLength(1);
    expect(girarFacingManual(postos[1], 1)).toEqual({
      agentSlot: 'seat-1',
      gx: 1,
      gy: 0,
      facing: 1,
      facingOrigem: 'manual',
    });
    expect(girarFacingManual({ facing: 0 }, -1).facing).toBe(3);
  });

  it('mesmaSubcelula e estilo de hover/travado', () => {
    expect(mesmaSubcelula({ gx: 1, gy: 1, qx: 0, qy: 1 }, { gx: 1, gy: 1, qx: 0, qy: 1 })).toBe(
      true,
    );
    expect(mesmaSubcelula({ gx: 1, gy: 1, qx: 0, qy: 0 }, { gx: 1, gy: 1, qx: 1, qy: 0 })).toBe(
      false,
    );
    const travado = estiloLosangoAssento({
      marcandoAssento: true,
      hover: true,
      sel: false,
      postoTravado: true,
    });
    expect(travado.stroke).toBe('#34d399');
    expect(ASSENTO_SLOT_PADRAO).toBe('seat-0');
  });
});
