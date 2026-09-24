import { describe, expect, it } from 'vitest';
import {
  elencoMockFxHub,
  elencoMockMacroDesk,
  gerarDeskBindingsDaPlanta,
} from './agent-desk-mocks.js';

describe('agent-desk mocks', () => {
  it('gerarDeskBindingsDaPlanta cria IDs estaveis', () => {
    const bindings = gerarDeskBindingsDaPlanta('demo', [
      {
        specialty: 'usd',
        seatSlot: 'seat-0',
        displayName: 'USD',
        roomKey: 'private-0',
      },
    ]);
    expect(bindings).toEqual([
      {
        agentId: 'demo-usd-0',
        specialty: 'usd',
        roomId: 'room-demo-private-0',
        seatSlot: 'seat-0',
        displayName: 'USD',
      },
    ]);
  });

  it('elencos mock FX e macro tem orchestrator', () => {
    expect(elencoMockFxHub().some((b) => b.specialty === 'orchestrator')).toBe(true);
    expect(elencoMockMacroDesk().some((b) => b.specialty === 'macro')).toBe(true);
  });
});
