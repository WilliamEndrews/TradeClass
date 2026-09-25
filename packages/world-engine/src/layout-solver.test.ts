/**
 * Testes de propriedade da geracao de escritorio (space-program + solver).
 *
 * A promessa do produto e "design nunca igual, invariantes absolutas"
 * (ver docstring de `layout-validation.ts`). Estes testes verificam
 * exatamente essa promessa: determinismo por seed, e zero violacoes de
 * invariante em muitas seeds e tamanhos de elenco diferentes.
 */
import { describe, expect, it } from 'vitest';
import type { AgentDescriptor, AgentRole, OfficeLayout } from '@tradeclass/contracts';
import { INITIAL_CATALOG } from '@tradeclass/contracts';
import { planSpaceProgram } from './space-program.js';
import { solveLayout } from './layout-solver.js';
import { validarLayout } from './layout-validation.js';
import { buildNavGrid, footprintCells, isWalkable } from './navgrid.js';

const PAPEIS: AgentRole[] = [
  'orchestrator',
  'researcher',
  'analyst',
  'support',
  'engineer',
  'finance',
  'guardian',
];

function elenco(tamanho: number): AgentDescriptor[] {
  return Array.from({ length: tamanho }, (_, i) => ({
    agentId: `agent-${i}`,
    displayName: `Agente ${i}`,
    role: PAPEIS[i % PAPEIS.length] as AgentRole,
    framework: 'test',
    discoveredVia: 'synthetic' as const,
    avatarSeed: i,
  }));
}

function gerarLayout(seed: number, tamanho: number) {
  const programa = planSpaceProgram(elenco(tamanho), { officeId: 'office-test', seed });
  return solveLayout(programa);
}

describe('geracao de escritorio - determinismo', () => {
  it('mesma seed e mesmo elenco produzem exatamente o mesmo layout', () => {
    const a = gerarLayout(42, 6);
    const b = gerarLayout(42, 6);
    expect(b).toEqual(a);
  });

  it('seeds diferentes tendem a produzir layouts diferentes', () => {
    const a = gerarLayout(1, 6);
    const b = gerarLayout(2, 6);
    expect(a).not.toEqual(b);
  });
});

describe('geracao de escritorio - invariantes geometricas', () => {
  const seeds = Array.from({ length: 30 }, (_, i) => i * 101 + 7);
  const tamanhos = [1, 2, 4, 7, 8, 12, 20];

  it.each(seeds)('seed %i com elenco de 7 agentes: zero violacoes', (seed) => {
    const layout = gerarLayout(seed, 7);
    expect(validarLayout(layout)).toEqual([]);
  });

  it.each(tamanhos)('elenco de %i agente(s) (seed fixa): zero violacoes', (tamanho) => {
    const layout = gerarLayout(999, tamanho);
    expect(validarLayout(layout)).toEqual([]);
  });
});

describe('footprint multi-celula', () => {
  it('props do palco bloqueiam celulas no navgrid', () => {
    const layout = gerarLayout(999, 1);
    const propComFootprint = layout.props.find(
      (p) => p.kind === 'desk' && p.footprint.w >= 1 && p.footprint.h >= 1,
    );
    if (!propComFootprint) return;
    const nav = buildNavGrid(layout);
    const celulas = footprintCells(propComFootprint);
    for (const c of celulas) expect(isWalkable(nav, c)).toBe(false);
  });

  it('valida que um footprint que estoura a parede da sala e rejeitado', () => {
    const layout = gerarLayout(999, 7);
    const sala = layout.rooms[0]!;
    const propInvalido: OfficeLayout['props'][number] = {
      propId: 'sofa-invalido-teste',
      kind: 'sofa',
      cell: { x: sala.rect.x1 - 1, y: sala.rect.y0 + 1 },
      roomId: sala.roomId,
      facing: 0,
      footprint: { w: 2, h: 1 }, // segunda celula cai fora da sala (x1 e exclusivo)
    };
    const layoutInvalido: OfficeLayout = { ...layout, props: [...layout.props, propInvalido] };
    const violacoes = validarLayout(layoutInvalido);
    expect(
      violacoes.some((v) => v.regra === 'prop-dentro-da-sala' && v.detalhe.includes('sofa-invalido-teste')),
    ).toBe(true);
  });

  it('valida que footprints sobrepostos contam como props empilhados', () => {
    const layout = gerarLayout(999, 7);
    const ancora = layout.props[0];
    expect(ancora).toBeDefined();
    const propSobreposto: OfficeLayout['props'][number] = {
      propId: 'chair-sobreposta-teste',
      kind: 'chair',
      cell: ancora!.cell,
      roomId: ancora!.roomId,
      facing: 0,
      footprint: { w: 1, h: 1 },
    };
    const layoutInvalido: OfficeLayout = { ...layout, props: [...layout.props, propSobreposto] };
    const violacoes = validarLayout(layoutInvalido);
    expect(violacoes.some((v) => v.regra === 'sem-props-empilhados')).toBe(true);
  });
});

describe('catalogo TinyTraderLab e solver (passo 7)', () => {
  it('todo Prop.kind colocado pelo solver tem asset no catalogo', () => {
    const catalogados = new Set<string>(INITIAL_CATALOG.assets.map((a) => a.kind));
    const kinds = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      for (const p of gerarLayout(seed, 7).props) kinds.add(p.kind);
    }
    for (const k of kinds) {
      expect(catalogados.has(k)).toBe(true);
    }
  });

  it('elenco de 7 agentes produz layout valido com props do proto', () => {
    const kinds = new Set<string>();
    const layout = gerarLayout(999, 7);
    expect(validarLayout(layout)).toEqual([]);
    expect(layout.props.length).toBeGreaterThan(0);
    for (const p of layout.props) kinds.add(p.kind);
    // Props colados da biblia (copa/boss/private) — ao menos um kind conhecido.
    const conhecidos = ['desk', 'chair', 'sofa', 'water', 'coffee', 'board', 'lamp', 'printer', 'rug', 'cabinet', 'meter'];
    expect(conhecidos.some((k) => kinds.has(k))).toBe(true);
  });

  it('Construtor cola proto: tileSetId e walls vazio; salas com proto tem temaId', () => {
    const layout = gerarLayout(999, 7);
    expect(layout.walls).toEqual([]);
    expect(layout.rooms.every((s) => Boolean(s.tileSetId))).toBe(true);
    expect(layout.corridorTileSetId).toBe('cool-lab');
    const comProto = layout.rooms.filter((s) => s.temaId);
    expect(comProto.length).toBeGreaterThan(0);
    expect(comProto.every((s) => Boolean(s.temaId))).toBe(true);
  });
});

describe('micro-escritorio de 1 agente', () => {
  it('salas com porta no centro da aresta, zero leftover, layout valido', () => {
    const layout = gerarLayout(999, 1);
    expect(validarLayout(layout)).toEqual([]);
    expect(layout.rooms.length).toBeGreaterThanOrEqual(2);

    for (const sala of layout.rooms) {
      const largura = sala.rect.x1 - sala.rect.x0;
      const altura = sala.rect.y1 - sala.rect.y0;
      expect(largura).toBeGreaterThanOrEqual(3);
      expect(altura).toBeGreaterThanOrEqual(3);
      expect(sala.door.x).toBe(sala.rect.x0 + Math.floor((largura - 1) / 2));
    }

    const spineY = Math.floor(layout.grid.height / 2);
    expect(layout.corridors.every((c) => c.y === spineY)).toBe(true);
    expect(layout.corridors).toHaveLength(layout.grid.width - 2);
    expect(layout.corridorTileSetId).toBe('cool-lab');
  });
});

describe('decor de superficie (removido — mobilia vem do palco)', () => {
  it('decor vazio apos remocao de mobiliar/decorar', () => {
    const layout = gerarLayout(999, 7);
    expect(layout.decor).toEqual([]);
  });

  it('decor com onPropId inexistente e rejeitado pela validacao', () => {
    const layout = gerarLayout(999, 7);
    const sala = layout.rooms[0]!;
    const decorInvalido: OfficeLayout['decor'][number] = {
      decorId: 'laptop-invalido-teste',
      kind: 'laptop',
      cell: { x: sala.rect.x0 + 1, y: sala.rect.y0 + 1 },
      roomId: sala.roomId,
      onPropId: 'prop-que-nao-existe',
      facing: 0,
    };
    const layoutInvalido: OfficeLayout = { ...layout, decor: [...layout.decor, decorInvalido] };
    const violacoes = validarLayout(layoutInvalido);
    expect(
      violacoes.some((v) => v.regra === 'decor-prop-valido' && v.detalhe.includes('laptop-invalido-teste')),
    ).toBe(true);
  });

  it('decor adicional em celula vazia nao bloqueia o navgrid', () => {
    const layout = gerarLayout(42, 7);
    const sala = layout.rooms[0]!;
    // Encontra uma celula livre dentro da sala (nao e porta, nao tem prop).
    const ocupadas = new Set(layout.props.map((p) => `${p.cell.x},${p.cell.y}`));
    let celulaLivre: { x: number; y: number } | null = null;
    for (let y = sala.rect.y0; y < sala.rect.y1 && !celulaLivre; y++) {
      for (let x = sala.rect.x0; x < sala.rect.x1 && !celulaLivre; x++) {
        if (x === sala.door.x && y === sala.door.y) continue;
        if (!ocupadas.has(`${x},${y}`)) celulaLivre = { x, y };
      }
    }
    expect(celulaLivre).not.toBeNull();
    const decorExtra: OfficeLayout['decor'][number] = {
      decorId: 'xicara-livre-teste',
      kind: 'radio',
      cell: celulaLivre!,
      roomId: sala.roomId,
      facing: 0,
    };
    const layoutComDecor: OfficeLayout = { ...layout, decor: [...layout.decor, decorExtra] };
    const nav = buildNavGrid(layoutComDecor);
    expect(isWalkable(nav, celulaLivre!)).toBe(true);
  });
});
