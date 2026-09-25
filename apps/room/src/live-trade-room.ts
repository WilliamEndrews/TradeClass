/**
 * Injeta cena live-trade na planta: laptop no desk, big-tv, camera cinema.
 * Nao altera o solver — so enriquece o layout (como wall-media-demo).
 */
import type { Decor, OfficeLayout, Prop, WallMedia } from '@tradeclass/contracts';
import { ehCameraCinema } from './camera-cinema';

/** SVG data-URL: fundo de “live” para a big-tv / modal POV. */
export const LIVE_TRADE_BG_IMG =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#04080c"/>
          <stop offset="100%" stop-color="#0a1a22"/>
        </linearGradient>
      </defs>
      <rect width="640" height="360" fill="url(#g)"/>
      <g fill="#2f6fed" opacity="0.85">
        <rect x="40" y="180" width="36" height="120"/>
        <rect x="90" y="140" width="36" height="160"/>
        <rect x="140" y="100" width="36" height="200"/>
        <rect x="190" y="160" width="36" height="140"/>
        <rect x="240" y="80" width="36" height="220"/>
        <rect x="290" y="120" width="36" height="180"/>
        <rect x="340" y="90" width="36" height="210"/>
        <rect x="390" y="150" width="36" height="150"/>
        <rect x="440" y="70" width="36" height="230"/>
        <rect x="490" y="110" width="36" height="190"/>
        <rect x="540" y="130" width="36" height="170"/>
      </g>
      <text x="28" y="40" fill="#7dd3fc" font-family="monospace" font-size="22">LIVE TRADE</text>
      <text x="28" y="330" fill="#5a7a6a" font-family="monospace" font-size="14">TradeClass · camera POV</text>
    </svg>`,
  );

function celulaLivre(
  layout: OfficeLayout,
  roomId: string,
  preferidas: { x: number; y: number }[],
): { x: number; y: number } | null {
  const sala = layout.rooms.find((r) => r.roomId === roomId);
  if (!sala) return null;
  const ocupadas = new Set<string>();
  for (const p of layout.props) {
    if (p.roomId !== roomId) continue;
    const fw = p.footprint?.w ?? 1;
    const fh = p.footprint?.h ?? 1;
    for (let dx = 0; dx < fw; dx++) {
      for (let dy = 0; dy < fh; dy++) {
        ocupadas.add(`${p.cell.x + dx},${p.cell.y + dy}`);
      }
    }
  }
  ocupadas.add(`${sala.door.x},${sala.door.y}`);

  const candidatas = [
    ...preferidas,
    // Varre o interior da sala (margem 1).
    ...Array.from({ length: Math.max(0, sala.rect.y1 - sala.rect.y0 - 2) }, (_, iy) =>
      Array.from({ length: Math.max(0, sala.rect.x1 - sala.rect.x0 - 2) }, (_, ix) => ({
        x: sala.rect.x0 + 1 + ix,
        y: sala.rect.y0 + 1 + iy,
      })),
    ).flat(),
  ];

  for (const c of candidatas) {
    if (
      c.x >= sala.rect.x0 &&
      c.x < sala.rect.x1 &&
      c.y >= sala.rect.y0 &&
      c.y < sala.rect.y1 &&
      !ocupadas.has(`${c.x},${c.y}`)
    ) {
      return c;
    }
  }
  return null;
}

/**
 * Anexa props/decor/wallMedia da sala live-trade se ainda nao houver camera cinema.
 */
export function anexarLiveTradeRoom(layout: OfficeLayout): OfficeLayout {
  if (layout.props.some((p) => ehCameraCinema(p.assetId))) {
    return layout;
  }

  const sala =
    layout.rooms.find((r) => r.kind === 'salao_especialistas') ??
    layout.rooms.find((r) => r.kind === 'sala_user');
  if (!sala) return layout;

  const desk =
    layout.props.find((p) => p.kind === 'desk' && p.roomId === sala.roomId && p.ownerAgentId) ??
    layout.props.find((p) => p.kind === 'desk' && p.roomId === sala.roomId);
  if (!desk) return layout;

  const props = [...layout.props];
  const decor = [...(layout.decor ?? [])];
  const wallMedia = [...(layout.wallMedia ?? [])];

  // Reaproveita projector-stand do tema se existir; senao cria lamp nova.
  const projectorIdx = props.findIndex(
    (p) =>
      p.roomId === sala.roomId &&
      (p.assetId === 'projector-stand-combo' ||
        p.assetId === 'projector-stand' ||
        p.assetId === 'office-projector'),
  );

  let cameraCell = desk.cell;
  if (projectorIdx >= 0) {
    const antigo = props[projectorIdx]!;
    cameraCell = antigo.cell;
    props[projectorIdx] = {
      ...antigo,
      kind: 'lamp',
      assetId: 'created-cinema-camera-pro',
      footprint: antigo.footprint ?? { w: 1, h: 1 },
    };
  } else {
    const livre = celulaLivre(layout, sala.roomId, [
      { x: desk.cell.x, y: desk.cell.y + 1 },
      { x: desk.cell.x + 1, y: desk.cell.y },
      { x: desk.cell.x - 1, y: desk.cell.y },
      { x: desk.cell.x, y: desk.cell.y - 1 },
    ]);
    if (!livre) return layout;
    cameraCell = livre;
    const camera: Prop = {
      propId: `live-cam-${sala.roomId}`,
      kind: 'lamp',
      cell: livre,
      roomId: sala.roomId,
      facing: 0,
      footprint: { w: 1, h: 1 },
      assetId: 'created-cinema-camera-pro',
    };
    props.push(camera);
  }

  // Stand opcional numa celula vizinha livre.
  if (!props.some((p) => p.assetId === 'created-camera-stand')) {
    const standCell = celulaLivre(
      { ...layout, props },
      sala.roomId,
      [
        { x: cameraCell.x, y: cameraCell.y + 1 },
        { x: cameraCell.x + 1, y: cameraCell.y },
        { x: cameraCell.x - 1, y: cameraCell.y },
      ],
    );
    if (standCell) {
      props.push({
        propId: `live-cam-stand-${sala.roomId}`,
        kind: 'lamp',
        cell: standCell,
        roomId: sala.roomId,
        facing: 0,
        footprint: { w: 1, h: 1 },
        assetId: 'created-camera-stand',
      });
    }
  }

  if (!decor.some((d) => d.onPropId === desk.propId && d.kind === 'laptop')) {
    const laptop: Decor = {
      decorId: `live-laptop-${desk.propId}`,
      kind: 'laptop',
      cell: desk.cell,
      roomId: sala.roomId,
      onPropId: desk.propId,
      facing: desk.facing ?? 0,
    };
    decor.push(laptop);
  }

  if (!wallMedia.some((m) => m.frame === 'big-tv' && m.roomId === sala.roomId)) {
    const serie = desk.ownerAgentId ? 'EURUSD' : 'XAUUSD';
    const tv: WallMedia = {
      mediaId: `wm-live-bigtv-${sala.roomId}`,
      kind: 'iframe',
      roomId: sala.roomId,
      cell: { x: sala.rect.x0 + 1, y: sala.rect.y0 },
      size: { w: 2, h: 1 },
      url: LIVE_TRADE_BG_IMG,
      seriesId: serie,
      face: 'R',
      gx: sala.rect.x0 + 1,
      gy: sala.rect.y0,
      dx: 4,
      dy: -40,
      frame: 'big-tv',
      mountAssetId: 'big-tv-off',
      nestAssetId: 'big-tv-off',
      display: 'hybrid',
      blendMode: 'screen',
    };
    wallMedia.push(tv);
  }

  return { ...layout, props, decor, wallMedia };
}

/** Resolve agentId + seriesId para o modal POV a partir da camera selecionada. */
export function contextoLivePov(
  layout: OfficeLayout,
  cameraPropId: string,
): { agentId: string; seriesId: string; bgUrl: string } {
  const cam = layout.props.find((p) => p.propId === cameraPropId);
  const salaId = cam?.roomId;
  const desk =
    (salaId
      ? layout.props.find((p) => p.kind === 'desk' && p.roomId === salaId && p.ownerAgentId)
      : undefined) ??
    layout.props.find((p) => p.kind === 'desk' && p.ownerAgentId);

  const wm =
    (salaId
      ? layout.wallMedia?.find((m) => m.roomId === salaId && (m.frame === 'big-tv' || m.seriesId))
      : undefined) ?? layout.wallMedia?.find((m) => m.frame === 'big-tv' || m.url);

  return {
    agentId: desk?.ownerAgentId ?? 'agent-boss',
    seriesId: wm?.seriesId ?? 'EURUSD',
    bgUrl:
      (wm?.url && (wm.url.startsWith('data:image/') || /\.(png|jpe?g|gif|webp|svg)/i.test(wm.url))
        ? wm.url
        : undefined) ?? LIVE_TRADE_BG_IMG,
  };
}
