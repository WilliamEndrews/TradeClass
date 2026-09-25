/**
 * RENDERIZADOR ISO DO ROOM — painter do lab + Klimmos + oclusao.
 *
 * Nao desenha heat/fila/lixo/luz/fumaca (cortados neste ciclo).
 * A fronteira e a mesma do renderer antigo: recebe layout + quadros e pinta.
 * Pick de desk/board/wallMedia alimenta o painel (ADR-0009).
 */

import type { ActorState, OfficeLayout, WorldDelta, WorldSnapshot } from '@tradeclass/contracts';
import { PersonagemKit } from '@tradeclass/iso-characters';
import {
  OclusaoCorredor,
  agenciaDeLayout,
  ALTURA_TILE,
  construirEspacoAgencia,
  desenharAgencia,
  desenharAtores,
  elencoIdsDoLayout,
  iso,
  LARGURA_TILE,
  pontoEmPoligono,
  prepararCenaIso,
  projetarAtorSentado,
  quadComoPoligono,
  quadrilateroTelaWallMedia,
  retanguloTelaWallMedia,
  type AgenteEspacial,
  type CenaIsoPreparada,
} from '@tradeclass/iso-office';
import { CALIBRACAO_PADRAO } from '@tradeclass/world-engine';
import {
  CAMERA_ZOOM_INICIAL,
  CAMERA_ZOOM_MAX,
  CAMERA_ZOOM_MIN,
} from './camera-zoom';
import { ehCameraCinema } from './camera-cinema';
import { blitCandles } from './ohlcv-mock';
import { candlesDaSerie } from './market-cache';
import type { SelecaoAlvo } from './selection';
import type { ViewTransform } from './wall-media-overlay';

const CAMERA_PNG: Record<string, string> = {
  'created-cinema-camera': '/tradeclass-created/Cinema_Camera.png',
  'created-cinema-camera-pro': '/tradeclass-created/Cinema_Camera_Pro.png',
  'created-camera-stand': '/tradeclass-created/Camera_Stand.png',
};

async function carregarImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}


export interface RendererHandle {
  push(frame: WorldSnapshot | WorldDelta): void;
  select(alvo: SelecaoAlvo | string | null): void;
  focusAgent(agentId: string | null): void;
  resetCamera(): void;
  onPick(cb: (alvo: SelecaoAlvo | null) => void): void;
  getViewTransform(): ViewTransform;
  destroy(): void;
}

interface Camera {
  zoom: number;
  panX: number;
  panY: number;
  seguirAgente: string | null;
}

function normalizarSelecao(alvo: SelecaoAlvo | string | null): SelecaoAlvo | null {
  if (!alvo) return null;
  if (typeof alvo === 'string') return { kind: 'agent', id: alvo };
  return alvo;
}

function telaParaGrade(
  sx: number,
  sy: number,
  origem: { x: number; y: number },
): { gx: number; gy: number } {
  const x = sx - origem.x;
  const y = sy - origem.y;
  const gxF = (x / (LARGURA_TILE / 2) + y / (ALTURA_TILE / 2)) / 2;
  const gyF = (y / (ALTURA_TILE / 2) - x / (LARGURA_TILE / 2)) / 2;
  return { gx: Math.floor(gxF), gy: Math.floor(gyF) };
}

export async function criarRenderer(
  canvas: HTMLCanvasElement,
  layout: OfficeLayout,
): Promise<RendererHandle> {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D indisponivel neste ambiente.');

  const palco = canvas.parentElement ?? canvas;
  const agencia = agenciaDeLayout(layout);
  const donos = elencoIdsDoLayout(layout, agencia);
  const cenario = construirEspacoAgencia(agencia, donos);
  const porAgente = new Map<string, AgenteEspacial>(
    cenario.agentes.map((a) => [a.agentId, a]),
  );

  const cena: CenaIsoPreparada = await prepararCenaIso(agencia, { stripParedeL: false });
  const estatico = document.createElement('canvas');
  estatico.width = cena.width;
  estatico.height = cena.height;
  const ectx = estatico.getContext('2d');
  if (!ectx) throw new Error('Canvas 2D indisponivel para a camada estatica.');
  await desenharAgencia(ectx, agencia, cena, { fill: '#0c1210' });

  // Preview offscreen de WallMedia — charts blit; iframes = placeholder escuro no quad.
  const peCal = { peWallR: CALIBRACAO_PADRAO.peWallR, peWallL: CALIBRACAO_PADRAO.peWallL };
  for (const wm of layout.wallMedia ?? []) {
    if (wm.kind === 'iframe' && wm.face) {
      const q = quadrilateroTelaWallMedia(wm, 0, 0, peCal);
      if (q) {
        ectx.fillStyle = '#050a0e';
        ectx.beginPath();
        ectx.moveTo(cena.origem.x + q.tl.x, cena.origem.y + q.tl.y);
        ectx.lineTo(cena.origem.x + q.tr.x, cena.origem.y + q.tr.y);
        ectx.lineTo(cena.origem.x + q.br.x, cena.origem.y + q.br.y);
        ectx.lineTo(cena.origem.x + q.bl.x, cena.origem.y + q.bl.y);
        ectx.closePath();
        ectx.fill();
      } else {
        const r = retanguloTelaWallMedia(wm, 0, 0, peCal);
        if (r) {
          ectx.fillStyle = '#0a1014';
          ectx.fillRect(cena.origem.x + r.x, cena.origem.y + r.y, r.w, r.h);
        }
      }
      continue;
    }
    const p = iso(wm.cell.x + 0.5, wm.cell.y + 0.5);
    const cx = cena.origem.x + p.x;
    const cy = cena.origem.y + p.y - 40;
    const tw = (wm.size?.w ?? 2) * 48;
    const th = 28;
    if (wm.kind === 'chart' && wm.seriesId) {
      const off = document.createElement('canvas');
      off.width = tw;
      off.height = th;
      const octx = off.getContext('2d');
      if (octx) {
        blitCandles(octx, candlesDaSerie(wm.seriesId, 32), tw, th);
        ectx.drawImage(off, cx - tw / 2, cy - th);
      }
    } else {
      ectx.fillStyle = wm.kind === 'banner' ? '#1a2822' : '#18221e';
      ectx.fillRect(cx - tw / 2, cy - th, tw, th);
      ectx.strokeStyle = '#c4a35a';
      ectx.strokeRect(cx - tw / 2, cy - th, tw, th);
    }
  }

  // Overlay das cameras Create (planta ainda blita projector; pick usa assetId).
  for (const prop of layout.props) {
    const src = prop.assetId ? CAMERA_PNG[prop.assetId] : undefined;
    if (!src) continue;
    const img = await carregarImg(src);
    if (!img) continue;
    const p = iso(prop.cell.x + 0.5, prop.cell.y + 0.5);
    const escala = 0.55;
    const dw = img.naturalWidth * escala;
    const dh = img.naturalHeight * escala;
    ectx.imageSmoothingEnabled = false;
    ectx.drawImage(
      img,
      cena.origem.x + p.x - dw / 2,
      cena.origem.y + p.y - dh * 0.85,
      dw,
      dh,
    );
  }

  const oclusao = await OclusaoCorredor.preparar(cena, layout.corridors);
  const personagens = await PersonagemKit.carregar({ agentIdsExtras: donos });
  const pendingBake = new Set<string>();

  const garantirAtores = (frame: WorldSnapshot | WorldDelta): void => {
    for (const ator of frame.actors) {
      if (personagens.tem(ator.agentId) || pendingBake.has(ator.agentId)) continue;
      pendingBake.add(ator.agentId);
      void personagens.garantir(ator.agentId).finally(() => pendingBake.delete(ator.agentId));
    }
  };

  const camera: Camera = { zoom: CAMERA_ZOOM_INICIAL, panX: 0, panY: 0, seguirAgente: null };
  let escalaBase = 1;
  let deslocX = 0;
  let deslocY = 0;
  let dpr = 1;
  let quadro: WorldSnapshot | WorldDelta | null = null;
  let selecionado: SelecaoAlvo | null = null;
  let pickCb: ((alvo: SelecaoAlvo | null) => void) | null = null;
  let tMs = 0;
  let ultimoMs = performance.now();
  let vivo = true;
  let raf = 0;
  let arrastando = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragPanStartX = 0;
  let dragPanStartY = 0;
  let moveu = false;

  const ajustar = (): void => {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const larguraCss = Math.max(1, palco.clientWidth);
    const alturaCss = Math.max(1, palco.clientHeight);
    canvas.width = Math.round(larguraCss * dpr);
    canvas.height = Math.round(alturaCss * dpr);
    escalaBase = Math.min(larguraCss / cena.width, alturaCss / cena.height) * 0.96;
    deslocX = (larguraCss - cena.width * escalaBase) / 2;
    deslocY = (alturaCss - cena.height * escalaBase) / 2;
  };

  ajustar();
  const observador = new ResizeObserver(ajustar);
  observador.observe(palco);

  const cssParaCena = (clientX: number, clientY: number): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect();
    const cx = clientX - rect.left;
    const cy = clientY - rect.top;
    const ea = escalaBase * camera.zoom;
    return {
      x: (cx - deslocX - camera.panX) / ea,
      y: (cy - deslocY - camera.panY) / ea,
    };
  };

  const pickEm = (clientX: number, clientY: number): SelecaoAlvo | null => {
    const cenaPt = cssParaCena(clientX, clientY);
    const grade = telaParaGrade(cenaPt.x, cenaPt.y, cena.origem);

    if (quadro) {
      for (const a of quadro.actors) {
        const p = iso(a.x + 0.5, a.y + 0.5);
        const ax = cena.origem.x + p.x;
        const ay = cena.origem.y + p.y;
        if (Math.hypot(ax - cenaPt.x, ay - cenaPt.y) < 28) {
          return { kind: 'agent', id: a.agentId };
        }
      }
    }

    for (const wm of layout.wallMedia ?? []) {
      if (wm.kind === 'iframe' && wm.face) {
        const q = quadrilateroTelaWallMedia(wm, 0, 0, peCal);
        if (q) {
          const poly = quadComoPoligono(q).map((p) => ({
            x: cena.origem.x + p.x,
            y: cena.origem.y + p.y,
          }));
          if (pontoEmPoligono(cenaPt, poly)) {
            return { kind: 'wallMedia', id: wm.mediaId };
          }
          continue;
        }
      }
      const sw = wm.size?.w ?? 2;
      const sh = wm.size?.h ?? 1;
      if (
        grade.gx >= wm.cell.x && grade.gx < wm.cell.x + sw
        && grade.gy >= wm.cell.y && grade.gy < wm.cell.y + sh
      ) {
        return { kind: 'wallMedia', id: wm.mediaId };
      }
    }

    for (const prop of layout.props) {
      if (prop.kind !== 'desk' && prop.kind !== 'board' && !ehCameraCinema(prop.assetId)) {
        continue;
      }
      const fw = prop.footprint?.w ?? 1;
      const fh = prop.footprint?.h ?? 1;
      if (
        grade.gx >= prop.cell.x && grade.gx < prop.cell.x + fw
        && grade.gy >= prop.cell.y && grade.gy < prop.cell.y + fh
      ) {
        if (ehCameraCinema(prop.assetId)) {
          return { kind: 'camera', id: prop.propId };
        }
        return prop.kind === 'desk'
          ? { kind: 'desk', id: prop.propId }
          : { kind: 'board', id: prop.propId };
      }
    }
    return null;
  };

  const onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const fator = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const novoZoom = Math.max(CAMERA_ZOOM_MIN, Math.min(CAMERA_ZOOM_MAX, camera.zoom * fator));
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const ea = escalaBase * camera.zoom;
    const ed = escalaBase * novoZoom;
    const wx = (cx - deslocX - camera.panX) / ea;
    const wy = (cy - deslocY - camera.panY) / ea;
    camera.panX = cx - deslocX - wx * ed;
    camera.panY = cy - deslocY - wy * ed;
    camera.zoom = novoZoom;
  };

  const onPointerDown = (e: PointerEvent): void => {
    arrastando = true;
    moveu = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragPanStartX = camera.panX;
    dragPanStartY = camera.panY;
    canvas.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (!arrastando) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    if (Math.hypot(dx, dy) > 5) moveu = true;
    camera.panX = dragPanStartX + dx;
    camera.panY = dragPanStartY + dy;
    camera.seguirAgente = null;
  };

  const onPointerUp = (e: PointerEvent): void => {
    arrastando = false;
    canvas.releasePointerCapture(e.pointerId);
    if (moveu) return;
    const alvo = pickEm(e.clientX, e.clientY);
    selecionado = alvo;
    pickCb?.(alvo);
  };

  const onDoubleClick = (): void => {
    camera.zoom = CAMERA_ZOOM_INICIAL;
    camera.panX = 0;
    camera.panY = 0;
    camera.seguirAgente = null;
    ajustar();
  };

  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('dblclick', onDoubleClick);

  const laco = (agora: number): void => {
    if (!vivo) return;
    tMs += Math.min(64, agora - ultimoMs);
    ultimoMs = agora;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0c1210';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const escalaEfetiva = escalaBase * camera.zoom;
    const panEfetivoX = deslocX + camera.panX;
    const panEfetivoY = deslocY + camera.panY;

    if (camera.seguirAgente && quadro) {
      const ator = quadro.actors.find((a) => a.agentId === camera.seguirAgente);
      if (ator) {
        const p = iso(ator.x + 0.5, ator.y + 0.5);
        const sx = cena.origem.x + p.x;
        const sy = cena.origem.y + p.y;
        const alvoX = canvas.width / dpr / 2 - sx * escalaEfetiva;
        const alvoY = canvas.height / dpr / 2 - sy * escalaEfetiva;
        camera.panX += (alvoX - deslocX - camera.panX) * 0.08;
        camera.panY += (alvoY - deslocY - camera.panY) * 0.08;
      }
    }

    ctx.setTransform(
      escalaEfetiva * dpr,
      0,
      0,
      escalaEfetiva * dpr,
      panEfetivoX * dpr,
      panEfetivoY * dpr,
    );
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(estatico, 0, 0);

    if (quadro) {
      const falas = new Map<string, string>();
      if (quadro.kind === 'delta') {
        for (const c of quadro.chatter) falas.set(c.agentId, c.text);
      }
      const atores: (ActorState & { speech?: string })[] = quadro.actors.map((a) => {
        const meta = porAgente.get(a.agentId);
        const projetado = projetarAtorSentado(a, meta?.seatFrac);
        const speech = falas.get(a.agentId);
        return speech ? { ...projetado, speech } : projetado;
      });
      desenharAtores(ctx, cena.origem, atores, tMs, personagens, oclusao);

      if (selecionado?.kind === 'agent') {
        const idSel = selecionado.id;
        const ator = atores.find((a) => a.agentId === idSel);
        if (ator) {
          const p = iso(ator.x + 0.5, ator.y + 0.5);
          const cx = cena.origem.x + p.x;
          const cy = cena.origem.y + p.y;
          ctx.strokeStyle = 'rgba(196, 163, 90, 0.85)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(cx, cy + 4, 18, 8, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    raf = requestAnimationFrame(laco);
  };
  raf = requestAnimationFrame(laco);

  return {
    push: (f) => {
      quadro = f;
      garantirAtores(f);
    },
    select: (alvo) => {
      selecionado = normalizarSelecao(alvo);
    },
    focusAgent: (id) => {
      camera.seguirAgente = id;
    },
    resetCamera: () => {
      camera.zoom = CAMERA_ZOOM_INICIAL;
      camera.panX = 0;
      camera.panY = 0;
      camera.seguirAgente = null;
      ajustar();
    },
    onPick: (cb) => {
      pickCb = cb;
    },
    getViewTransform: () => {
      const ea = escalaBase * camera.zoom;
      return {
        origemCena: { ...cena.origem },
        escala: ea,
        cenaParaCss: (x, y) => ({
          x: deslocX + camera.panX + x * ea,
          y: deslocY + camera.panY + y * ea,
        }),
      };
    },
    destroy: () => {
      vivo = false;
      cancelAnimationFrame(raf);
      observador.disconnect();
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('dblclick', onDoubleClick);
    },
  };
}
