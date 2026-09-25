import {
  BIBLIA_TEMAS,
  hashString,
  temaMarcadoDaZona,
  ZONAS_TRADECLASS,
  type TemaArquiteto,
  type ZonaKindTiles,
  type ZonaTradeClass,
} from '@tradeclass/world-engine';

/** Pedido do dashboard (legado): quantidade de salas. */
export type PedidoGeracao = {
  salas: number;
};

export type ZonaPedido = ZonaTradeClass;

export type ProtoEscolhido = {
  key: string;
  zonaKind: ZonaPedido | 'landing';
  tema: TemaArquiteto;
};

/** Seed estavel so a partir do pedido (testes / repro sem geracao). */
export function seedDoPedido(pedido: PedidoGeracao): number {
  return hashString(`demo:${pedido.salas}`);
}

/** Seed de uma geracao concreta (pedido + geracao + salt). */
export function seedDaGeracao(pedido: PedidoGeracao, geracao: number, salt: number): number {
  return hashString(`demo:${pedido.salas}#${geracao}:${salt >>> 0}`);
}

export function saltAleatorio(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0]!;
  }
  return (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
}

/**
 * Tema marcado da zona (ou maior prioridade). Sem RNG.
 * Assinatura legada mantida para callers que ainda passam rng/unicos.
 */
export function escolherTemaPonderado(
  zonaKind: ZonaKindTiles,
  _rng: unknown,
  jaUsadosUnicos: Set<string>,
  temas: readonly TemaArquiteto[] = BIBLIA_TEMAS.temas,
): TemaArquiteto | undefined {
  const escolhido = temaMarcadoDaZona(zonaKind, temas, jaUsadosUnicos);
  if (escolhido?.unicoNaAgencia) jaUsadosUnicos.add(escolhido.id);
  return escolhido;
}

/**
 * Conjunto padrao TradeClass: as 4 zonas, cada uma com o tema marcado.
 * `pedido.salas` e ignorado (legado); sempre o conjunto unico.
 */
export function selecionarPedido(_pedido: PedidoGeracao, _seed?: number): ProtoEscolhido[] {
  const unicos = new Set<string>();
  const out: ProtoEscolhido[] = [];

  for (const zonaKind of ZONAS_TRADECLASS) {
    const tema = temaMarcadoDaZona(zonaKind, BIBLIA_TEMAS.temas, unicos);
    if (!tema) continue;
    if (tema.unicoNaAgencia) unicos.add(tema.id);
    out.push({
      key: `${zonaKind}-0-${tema.id}`,
      zonaKind,
      tema,
    });
  }

  return out;
}

/** Assinatura multiset dos temas (ordem-independente) para anti-eco. */
export function assinaturaTemas(protos: readonly ProtoEscolhido[]): string {
  return protos
    .map((p) => p.tema.id)
    .slice()
    .sort()
    .join('|');
}
