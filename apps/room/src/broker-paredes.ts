/**
 * Aplica a URL do web terminal nas paredes iframe/hybrid (placeholders).
 */
import type { BrokerLink, OfficeLayout, WallMedia } from '@tradeclass/contracts';

const PLACEHOLDER_HOSTS = new Set(['example.com', 'www.example.com']);

export function urlEhPlaceholderIframe(url: string | undefined): boolean {
  if (!url) return true;
  if (url.startsWith('data:image/')) return false;
  if (url.startsWith('#')) return false;
  try {
    const u = new URL(url);
    return PLACEHOLDER_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

export function primeiroLinkAtivo(links: readonly BrokerLink[]): BrokerLink | undefined {
  return links.find((l) => l.status === 'linked' && l.webTerminalUrl) ?? links[0];
}

export function aplicarBrokerNasParedes(
  layout: OfficeLayout,
  link: Pick<BrokerLink, 'webTerminalUrl'> | null | undefined,
): OfficeLayout {
  const url = link?.webTerminalUrl?.trim();
  if (!url || !layout.wallMedia?.length) return layout;

  const wallMedia: WallMedia[] = layout.wallMedia.map((wm) => {
    if (wm.kind !== 'iframe' && wm.kind !== 'projection') return wm;
    if (wm.display === 'image') return wm;
    if (!urlEhPlaceholderIframe(wm.url)) return wm;
    return { ...wm, url };
  });
  return { ...layout, wallMedia };
}
