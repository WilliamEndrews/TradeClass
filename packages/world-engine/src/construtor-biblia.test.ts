import { describe, expect, it } from 'vitest';
import { INITIAL_CATALOG } from '@tradeclass/contracts';
import { createRng } from './prng.js';
import {
  BIBLIA_TEMAS,
  escolherAssetId,
  escolherTema,
  kindChaoAtivo,
  listarProtos,
  resolverTilesetZona,
  colarProto,
} from './construtor-biblia.js';

describe('biblia do Construtor', () => {
  it('carrega temas do laboratorio', () => {
    expect(BIBLIA_TEMAS.temas.length).toBeGreaterThan(0);
    expect(BIBLIA_TEMAS.politicaTiles.private?.modo).toBe('default');
  });

  it('escolhe tema por zonaKind e prioridade', () => {
    const rng = createRng(1);
    const usados = new Set<string>();
    const tema = escolherTema('private', rng, usados);
    expect(tema).toBeDefined();
    expect(tema!.zonaKind).toBe('private');
    expect(listarProtos('private').map((t) => t.id)).toContain(tema!.id);
    expect(escolherTema('meeting', rng, usados)).toBeUndefined();
  });

  it('zona landing existe na politica e o proto handcrafted e listavel', () => {
    expect(BIBLIA_TEMAS.politicaTiles.landing?.modo).toBe('default');
    const landings = listarProtos('landing');
    expect(landings.length).toBeGreaterThan(0);
    expect(landings.some((t) => t.id.startsWith('landing'))).toBe(true);
    const escolhido = escolherTema('landing', createRng(1), new Set());
    expect(escolhido?.zonaKind).toBe('landing');
  });

  it('desk/chair preferem asset obrigatorio; kind de parede nao e chao', () => {
    const rng = createRng(7);
    expect(escolherAssetId('desk', rng)).toBe('office-main-table');
    expect(escolherAssetId('chair', rng)).toBe('basic-office-chair');
    expect(kindChaoAtivo('board')).toBe(true);
    const boards = INITIAL_CATALOG.assets.filter((a) => a.kind === 'board' && a.papel === 'prop');
    expect(boards.some((a) => a.assetId === 'board-full')).toBe(true);
  });

  it('politica default herda o tileset do tema', () => {
    const rng = createRng(3);
    const tema = escolherTema('private', rng, new Set());
    expect(tema).toBeDefined();
    const visual = resolverTilesetZona('private', tema, 'midnight-ops', rng);
    expect(visual.tileSetId).toBe(tema!.tilesetAtivo);
    // Corredor e break podem nao ter proto dedicado; se existir, herda tilesetAtivo.
    const corridor = escolherTema('corridor', rng, new Set());
    if (corridor) expect(corridor.tilesetAtivo.length).toBeGreaterThan(0);
    const brk = escolherTema('break', rng, new Set());
    expect(brk?.tilesetAtivo).toBeTruthy();
  });
});

describe('colarProto multi-seat', () => {
  it('atribui seat distinto a cada mesa quando ha N postos', () => {
    const deskId = escolherAssetId('desk', createRng(1));
    expect(deskId).toBeTruthy();
    const tema = {
      id: 'multi',
      nome: 'multi',
      tilesetAtivo: 'nordic-calm',
      prioridade: 5,
      unicoNaAgencia: false,
      zonaKind: 'private' as const,
      grade: { w: 4, h: 3 },
      palco: [
        { assetId: deskId!, gx: 0, gy: 1 },
        { assetId: deskId!, gx: 2, gy: 1 },
      ],
      postosTrabalho: [
        { agentSlot: 'seat-0', gx: 0, gy: 0, passo: 1, facing: 2 as const },
        { agentSlot: 'seat-1', gx: 2, gy: 0, passo: 1, facing: 0 as const },
      ],
    };
    const sala = {
      roomId: 'r1',
      zoneId: 'z1',
      name: 'Sala',
      kind: 'private' as const,
      rect: { x0: 1, y0: 1, x1: 5, y1: 4 },
      door: { x: 2, y: 3 },
    };
    const { props } = colarProto(sala, tema, ['agent-a', 'agent-b']);
    const desks = props.filter((p) => p.kind === 'desk');
    expect(desks).toHaveLength(2);
    expect(desks[0]!.ownerAgentId).toBe('agent-a');
    expect(desks[1]!.ownerAgentId).toBe('agent-b');
    expect(desks[0]!.seat).toBeDefined();
    expect(desks[1]!.seat).toBeDefined();
    expect(desks[0]!.seat).not.toEqual(desks[1]!.seat);
  });
});
