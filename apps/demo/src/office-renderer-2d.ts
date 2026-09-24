/**
 * RENDERIZADOR DO ESCRITORIO (Canvas 2D + Sprites) - FASE 2
 *
 * Papel deste arquivo: orquestrar camera + passes de desenho.
 * Implementacao fatiada em helpers, camera, static e dynamic.
 */
import type { OfficeLayout, WorldDelta, WorldSnapshot } from '@tradeclass/contracts';
import { PersonagemKit } from '@tradeclass/iso-characters';
import { resolverPaleta, tileSetsDoLayout } from '@tradeclass/world-engine';
import { carregarAtlas } from './asset-atlas';
import { criarFabrica } from './sprite-factory';
import {
  aplicarZoomNoPonto,
  cameraInicial,
  resetarCamera,
  seguirPontoMundo,
} from './office-renderer-2d-camera';
import { desenharAmbiente, desenharAtores, desenharPenumbra } from './office-renderer-2d-dynamic';
import { cor, extensaoDoMundo, iso } from './office-renderer-2d-helpers';
import { construirEstatico } from './office-renderer-2d-static';

export interface RendererHandle {
  /** Entrega um quadro para desenho. Chamada a 10 Hz pelo laco de simulacao. */
  push(frame: WorldSnapshot | WorldDelta): void;
  /** Destaca um agente (selecionado no painel lateral). */
  select(agentId: string | null): void;
  /** Foca a camera num agente (segue seu movimento). */
  focusAgent(agentId: string | null): void;
  /** Reset da camera (zoom e pan). */
  resetCamera(): void;
  destroy(): void;
}

export async function criarRenderer(
  canvas: HTMLCanvasElement,
  layout: OfficeLayout,
): Promise<RendererHandle> {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D indisponivel neste ambiente.');

  const palco = canvas.parentElement ?? canvas;
  const ext = extensaoDoMundo(layout);
  const paleta = resolverPaleta(layout.theme);
  const atlas = carregarAtlas('', tileSetsDoLayout(layout));
  await atlas.ready;
  const sprites = criarFabrica(paleta, atlas);
  const personagens = await PersonagemKit.carregar();
  const pendingBake = new Set<string>();

  const garantirAtores = (frame: WorldSnapshot | WorldDelta): void => {
    for (const ator of frame.actors) {
      if (personagens.tem(ator.agentId) || pendingBake.has(ator.agentId)) continue;
      pendingBake.add(ator.agentId);
      void personagens.garantir(ator.agentId).finally(() => pendingBake.delete(ator.agentId));
    }
  };

  let estatico: HTMLCanvasElement | null = null;

  const camera = cameraInicial();

  let escalaBase = 1;
  let deslocX = 0;
  let deslocY = 0;
  let dpr = 1;

  let quadro: WorldSnapshot | WorldDelta | null = null;
  let selecionado: string | null = null;
  let fase = 0;
  let ultimoMs = performance.now();
  let vivo = true;
  let raf = 0;

  let arrastando = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragPanStartX = 0;
  let dragPanStartY = 0;

  const ajustar = (): void => {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const larguraCss = Math.max(1, palco.clientWidth);
    const alturaCss = Math.max(1, palco.clientHeight);

    canvas.width = Math.round(larguraCss * dpr);
    canvas.height = Math.round(alturaCss * dpr);

    escalaBase = Math.min(larguraCss / ext.largura, alturaCss / ext.altura) * 0.94;
    deslocX = (larguraCss - ext.largura * escalaBase) / 2 - ext.minX * escalaBase;
    deslocY = (alturaCss - ext.altura * escalaBase) / 2 - ext.minY * escalaBase;

    if (!estatico) {
      estatico = construirEstatico(layout, ext, 1, paleta, sprites);
    }
  };

  ajustar();
  const observador = new ResizeObserver(ajustar);
  observador.observe(palco);

  const onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const fator = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const rect = canvas.getBoundingClientRect();
    aplicarZoomNoPonto(
      camera,
      fator,
      e.clientX - rect.left,
      e.clientY - rect.top,
      escalaBase,
      deslocX,
      deslocY,
    );
  };

  const onPointerDown = (e: PointerEvent): void => {
    arrastando = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragPanStartX = camera.panX;
    dragPanStartY = camera.panY;
    canvas.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (!arrastando) return;
    camera.panX = dragPanStartX + (e.clientX - dragStartX);
    camera.panY = dragPanStartY + (e.clientY - dragStartY);
    camera.seguirAgente = null;
  };

  const onPointerUp = (e: PointerEvent): void => {
    arrastando = false;
    canvas.releasePointerCapture(e.pointerId);
  };

  const onDoubleClick = (): void => {
    resetarCamera(camera);
    ajustar();
  };

  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('dblclick', onDoubleClick);

  const laco = (agora: number): void => {
    if (!vivo) return;
    fase += Math.min(64, agora - ultimoMs) / 1000;
    ultimoMs = agora;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = cor(paleta.fundo);
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const escalaEfetiva = escalaBase * camera.zoom;
    const panEfetivoX = deslocX + camera.panX;
    const panEfetivoY = deslocY + camera.panY;

    if (camera.seguirAgente && quadro) {
      const ator = quadro.actors.find((a) => a.agentId === camera.seguirAgente);
      if (ator) {
        const pos = iso(ator.x + 0.5, ator.y + 0.5);
        seguirPontoMundo(
          camera,
          pos.x,
          pos.y,
          canvas.width / dpr / 2,
          canvas.height / dpr / 2,
          escalaEfetiva,
          deslocX,
          deslocY,
        );
      }
    }

    if (estatico) {
      const dstX = (panEfetivoX + ext.minX * escalaEfetiva) * dpr;
      const dstY = (panEfetivoY + ext.minY * escalaEfetiva) * dpr;
      const dstW = ext.largura * escalaEfetiva * dpr;
      const dstH = ext.altura * escalaEfetiva * dpr;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(estatico, dstX, dstY, dstW, dstH);
      ctx.imageSmoothingEnabled = true;
    }

    if (quadro) {
      ctx.setTransform(
        escalaEfetiva * dpr,
        0,
        0,
        escalaEfetiva * dpr,
        panEfetivoX * dpr,
        panEfetivoY * dpr,
      );
      desenharPenumbra(ctx, layout, quadro, fase, paleta);
      desenharAmbiente(ctx, layout, quadro, fase, paleta);
      desenharAtores(ctx, quadro, selecionado, fase, paleta, sprites, personagens);
    }

    raf = requestAnimationFrame(laco);
  };
  raf = requestAnimationFrame(laco);

  return {
    push: (f) => {
      quadro = f;
      garantirAtores(f);
    },
    select: (id) => {
      selecionado = id;
    },
    focusAgent: (id) => {
      camera.seguirAgente = id;
    },
    resetCamera: () => {
      resetarCamera(camera);
      ajustar();
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
