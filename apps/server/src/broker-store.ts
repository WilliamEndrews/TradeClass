/**
 * Contas / web terminals por tenant (memoria, mesmo estilo do registry).
 * `metaapi_future` e rejeitado neste ciclo.
 */
import {
  BrokerLinkSchema,
  BrokerLinkUpsertSchema,
  ehUrlHttpsTerminal,
  type BrokerLink,
  type BrokerLinkUpsert,
} from '@tradeclass/contracts';
import { gerarId } from './auth.js';

export class BrokerStore {
  private readonly porTenant = new Map<string, BrokerLink[]>();

  listar(tenantId: string): BrokerLink[] {
    return [...(this.porTenant.get(tenantId) ?? [])];
  }

  upsert(tenantId: string, raw: unknown): BrokerLink {
    const parsed = BrokerLinkUpsertSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(parsed.error.issues.map((i) => i.message).join('; ') || 'payload invalido');
    }
    const body = parsed.data;
    if (body.provider === 'metaapi_future') {
      throw new Error('metaapi_future ainda nao implementado (ADR web-terminal-first)');
    }
    if (!ehUrlHttpsTerminal(body.webTerminalUrl)) {
      throw new Error('webTerminalUrl precisa ser https://');
    }

    const lista = this.porTenant.get(tenantId) ?? [];
    const existente = body.linkId ? lista.find((l) => l.linkId === body.linkId) : undefined;
    const link: BrokerLink = BrokerLinkSchema.parse({
      linkId: existente?.linkId ?? body.linkId ?? gerarId(),
      tenantId,
      label: body.label,
      brokerName: body.brokerName,
      accountLogin: body.accountLogin,
      serverName: body.serverName,
      webTerminalUrl: body.webTerminalUrl,
      status: body.status ?? 'linked',
      provider: 'web_terminal',
    });

    const next = existente
      ? lista.map((l) => (l.linkId === link.linkId ? link : l))
      : [...lista, link];
    this.porTenant.set(tenantId, next);
    return link;
  }

  remover(tenantId: string, linkId: string): boolean {
    const lista = this.porTenant.get(tenantId) ?? [];
    const next = lista.filter((l) => l.linkId !== linkId);
    if (next.length === lista.length) return false;
    this.porTenant.set(tenantId, next);
    return true;
  }
}

export function primeiroLinkAtivo(links: readonly BrokerLink[]): BrokerLink | undefined {
  return links.find((l) => l.status === 'linked' && l.webTerminalUrl) ?? links[0];
}
