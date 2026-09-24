import { describe, expect, it } from 'vitest';
import {
  ORIGEM,
  ancoraTelaCelula,
  offsetPisoDoPonto,
  telaParaGrade,
} from './lab-desenho-palco.mjs';

describe('posicionamento livre no piso', () => {
  it('ancora da celula fica no centro do diamante', () => {
    ORIGEM.x = 360;
    ORIGEM.y = 90;
    const a = ancoraTelaCelula(1, 2);
    const g = telaParaGrade(a.x, a.y, false);
    expect(g.gx).toBe(1);
    expect(g.gy).toBe(2);
  });

  it('offsetPisoDoPonto grava checkpoint relativo a celula', () => {
    ORIGEM.x = 360;
    ORIGEM.y = 90;
    const a = ancoraTelaCelula(0, 0);
    const off = offsetPisoDoPonto(a.x + 14, a.y - 9, 0, 0);
    expect(off).toEqual({ dx: 14, dy: -9 });
  });

  it('rebaseia offset ao mudar de celula sem perder o pe', () => {
    ORIGEM.x = 360;
    ORIGEM.y = 90;
    const a0 = ancoraTelaCelula(0, 0);
    const footX = a0.x + 20;
    const footY = a0.y + 10;
    const g = telaParaGrade(footX, footY, false);
    const off = offsetPisoDoPonto(footX, footY, g.gx, g.gy);
    const a1 = ancoraTelaCelula(g.gx, g.gy);
    expect(Math.round(a1.x + off.dx)).toBe(Math.round(footX));
    expect(Math.round(a1.y + off.dy)).toBe(Math.round(footY));
  });
});
