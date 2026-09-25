/**
 * Injeta WallMedia de demo no layout (graficos mock + midia warpeada).
 * Nao altera o solver — so enriquece a planta para a UI de trade.
 */
import type { OfficeLayout, WallMedia } from '@tradeclass/contracts';

/** SVG data-URL: “tela ligada” com barras — sem CORS. */
const DEMO_SCREEN_IMG =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#061018"/>
          <stop offset="100%" stop-color="#0d2233"/>
        </linearGradient>
      </defs>
      <rect width="320" height="180" fill="url(#g)"/>
      <g fill="#3d8bfd" opacity="0.9">
        <rect x="24" y="90" width="28" height="60"/>
        <rect x="64" y="70" width="28" height="80"/>
        <rect x="104" y="50" width="28" height="100"/>
        <rect x="144" y="80" width="28" height="70"/>
        <rect x="184" y="40" width="28" height="110"/>
        <rect x="224" y="65" width="28" height="85"/>
        <rect x="264" y="55" width="28" height="95"/>
      </g>
      <text x="16" y="28" fill="#7dd3fc" font-family="monospace" font-size="14">EURUSD · M5</text>
      <text x="16" y="168" fill="#5a7a6a" font-family="monospace" font-size="11">TradeClass nest</text>
    </svg>`,
  );

/** Anexa telas de grafico nas salas war_room / meeting / open se ainda nao houver. */
export function anexarWallMediaDemo(layout: OfficeLayout): OfficeLayout {
  if ((layout.wallMedia?.length ?? 0) > 0) return layout;

  const midias: WallMedia[] = [];
  const salas = layout.rooms.filter(
    (r) =>
      r.kind === 'salao_especialistas' || r.kind === 'macroeconomia' || r.kind === 'noticias',
  );

  const series = ['EURUSD', 'XAUUSD', 'BTCUSD', 'USDJPY'];
  for (let i = 0; i < salas.length; i++) {
    const sala = salas[i]!;
    const w = Math.max(1, sala.rect.x1 - sala.rect.x0);
    const cx = sala.rect.x0 + Math.min(1, w - 2);
    const cy = sala.rect.y0;
    midias.push({
      mediaId: `wm-chart-${sala.roomId}`,
      kind: 'chart',
      roomId: sala.roomId,
      cell: { x: cx, y: cy },
      size: { w: 2, h: 1 },
      seriesId: series[i % series.length],
      face: 'R',
    });
  }

  const recep = layout.rooms.find((r) => r.kind === 'sala_user');
  if (recep) {
    midias.push({
      mediaId: `wm-banner-${recep.roomId}`,
      kind: 'banner',
      roomId: recep.roomId,
      cell: { x: recep.rect.x0 + 1, y: recep.rect.y0 },
      size: { w: 3, h: 1 },
      url: '#tradeclass-banner',
    });
  }

  // Painel iframe (matrix3d via inset legado → cantos).
  const salaPainel = layout.rooms.find((r) => r.kind === 'macroeconomia' || r.kind === 'noticias');
  if (salaPainel) {
    midias.push({
      mediaId: `wm-iframe-panel-${salaPainel.roomId}`,
      kind: 'iframe',
      roomId: salaPainel.roomId,
      cell: { x: salaPainel.rect.x0 + 1, y: salaPainel.rect.y0 },
      size: { w: 3, h: 1 },
      url: 'https://example.com',
      face: 'R',
      gx: salaPainel.rect.x0 + 1,
      gy: salaPainel.rect.y0,
      dx: 8,
      dy: -48,
      frame: 'none',
      heightPx: 52,
      display: 'iframe',
      blendMode: 'screen',
    });
  }

  // TV com imagem nest (modo image + screen blend).
  const boss = layout.rooms.find((r) => r.kind === 'salao_especialistas');
  if (boss) {
    midias.push({
      mediaId: `wm-image-tv-${boss.roomId}`,
      kind: 'iframe',
      roomId: boss.roomId,
      cell: { x: boss.rect.x0, y: boss.rect.y0 + 1 },
      size: { w: 1, h: 1 },
      url: DEMO_SCREEN_IMG,
      face: 'L',
      gx: boss.rect.x0,
      gy: boss.rect.y0 + 1,
      dx: 0,
      dy: -36,
      frame: 'tv',
      mountAssetId: 'office-tv-off',
      nestAssetId: 'office-tv-off',
      display: 'image',
      blendMode: 'screen',
    });
  }

  // Big TV hybrid: preview na parede + iframe no painel ao clicar.
  const war = layout.rooms.find((r) => r.kind === 'macroeconomia');
  if (war) {
    midias.push({
      mediaId: `wm-hybrid-bigtv-${war.roomId}`,
      kind: 'iframe',
      roomId: war.roomId,
      cell: { x: war.rect.x0 + 2, y: war.rect.y0 },
      size: { w: 2, h: 1 },
      url: 'https://example.com',
      face: 'R',
      gx: war.rect.x0 + 2,
      gy: war.rect.y0,
      dx: 4,
      dy: -40,
      frame: 'big-tv',
      mountAssetId: 'big-tv-off',
      nestAssetId: 'big-tv-off',
      display: 'hybrid',
      blendMode: 'screen',
    });
  }

  return { ...layout, wallMedia: midias };
}
