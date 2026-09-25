/**
 * Viewport atomico do Viewtest: prepara, valida e publica a cena completa.
 * Camera zoom-in alinhada ao Room (pan + scroll).
 */

import { useEffect, useRef, useState } from 'react';
import type { ActorState } from '@tradeclass/contracts';
import { PersonagemKit } from '@tradeclass/iso-characters';
import { prepararCenaIso } from './cena-isometrica';
import {
  CAMERA_ZOOM_INICIAL,
  CAMERA_ZOOM_MAX,
  CAMERA_ZOOM_MIN,
} from './camera-zoom';
import { desenharAgencia } from './desenhar-agencia';
import { desenharAtores, desenharDebugOverlay } from './desenhar-atores';
import { construirEspacoAgencia, type CenarioEspacial } from '@tradeclass/iso-office';
import type { AgenciaMontada } from './montar-agencia';
import { OclusaoCorredor } from './oclusao-parede';
import { RosaVentos } from './RosaVentos';
import { SimulacaoAgentes } from './simulacao-agentes';
import type { Historia } from './tarefa-especial/historias';
import {
  SimulacaoTarefaEspecial,
  type StatusTarefa,
} from './tarefa-especial/simulacao-tarefa';

type Props = {
  agencia: AgenciaMontada | null;
  vazioSemTemas?: boolean;
  tarefaEspecial?: Historia | null;
  elencoIds?: string[];
};

type Camera = { zoom: number; panX: number; panY: number };

function contarAtividades(atores: ActorState[]): string {
  const walking = atores.filter((a) => a.activity === 'walking').length;
  const working = atores.filter((a) => a.activity === 'working').length;
  const resting = atores.filter((a) => a.activity === 'resting').length;
  const talking = atores.filter((a) => a.activity === 'talking').length;
  const parts = [
    `${atores.length} agente(s)`,
    `${walking} walking`,
    `${working} working`,
    `${resting} resting`,
  ];
  if (talking > 0) parts.push(`${talking} talking`);
  return parts.join(' · ');
}

function limparCanvas(canvas: HTMLCanvasElement, mensagem?: string): void {
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#07111f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (mensagem) {
    ctx.fillStyle = 'rgba(126, 200, 255, 0.9)';
    ctx.font = '12px "IBM Plex Mono", ui-monospace, monospace';
    ctx.fillText(mensagem, 24, 36);
  }
}

export function PreviewStage({
  agencia,
  vazioSemTemas = false,
  tarefaEspecial = null,
  elencoIds,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const generationRef = useRef(0);
  const debugRef = useRef(false);
  const cameraRef = useRef<Camera>({
    zoom: CAMERA_ZOOM_INICIAL,
    panX: 0,
    panY: 0,
  });
  const [status, setStatus] = useState('palco vazio — carregue uma planta do Lab');
  const [erro, setErro] = useState<string | null>(null);
  const [debugOverlay, setDebugOverlay] = useState(false);
  const [stripParedeL, setStripParedeL] = useState(false);
  const [painelTarefa, setPainelTarefa] = useState<StatusTarefa | null>(null);

  debugRef.current = debugOverlay;

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const alvo = ev.target as HTMLElement | null;
      const tag = alvo?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || alvo?.isContentEditable) {
        return;
      }

      if (ev.key === 'd' || ev.key === 'D') setDebugOverlay((v) => !v);
      if (ev.key === 'w' || ev.key === 'W') setStripParedeL((v) => !v);
      if (ev.key === 'r' || ev.key === 'R') {
        cameraRef.current = { zoom: CAMERA_ZOOM_INICIAL, panX: 0, panY: 0 };
      }

      const passo = ev.shiftKey ? 96 : 48;
      const cam = cameraRef.current;
      if (ev.key === 'ArrowLeft') {
        ev.preventDefault();
        cam.panX += passo;
      } else if (ev.key === 'ArrowRight') {
        ev.preventDefault();
        cam.panX -= passo;
      } else if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        cam.panY += passo;
      } else if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        cam.panY -= passo;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const cam = cameraRef.current;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const fator = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const rect = wrap.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const novoZoom = Math.max(
        CAMERA_ZOOM_MIN,
        Math.min(CAMERA_ZOOM_MAX, cam.zoom * fator),
      );
      const wx = (cx - cam.panX) / cam.zoom;
      const wy = (cy - cam.panY) / cam.zoom;
      cam.panX = cx - wx * novoZoom;
      cam.panY = cy - wy * novoZoom;
      cam.zoom = novoZoom;
    };

    let arrastando = false;
    let sx = 0;
    let sy = 0;
    let pan0x = 0;
    let pan0y = 0;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      arrastando = true;
      sx = e.clientX;
      sy = e.clientY;
      pan0x = cam.panX;
      pan0y = cam.panY;
      wrap.classList.add('arrastando');
      wrap.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!arrastando) return;
      cam.panX = pan0x + (e.clientX - sx);
      cam.panY = pan0y + (e.clientY - sy);
    };
    const onUp = (e: PointerEvent) => {
      if (!arrastando) return;
      arrastando = false;
      wrap.classList.remove('arrastando');
      try {
        wrap.releasePointerCapture(e.pointerId);
      } catch {
        /* ja liberado */
      }
    };
    const onDbl = () => {
      cam.zoom = CAMERA_ZOOM_INICIAL;
      cam.panX = 0;
      cam.panY = 0;
    };

    wrap.addEventListener('wheel', onWheel, { passive: false });
    wrap.addEventListener('pointerdown', onDown);
    wrap.addEventListener('pointermove', onMove);
    wrap.addEventListener('pointerup', onUp);
    wrap.addEventListener('pointercancel', onUp);
    wrap.addEventListener('lostpointercapture', onUp);
    wrap.addEventListener('dblclick', onDbl);
    return () => {
      wrap.classList.remove('arrastando');
      wrap.removeEventListener('wheel', onWheel);
      wrap.removeEventListener('pointerdown', onDown);
      wrap.removeEventListener('pointermove', onMove);
      wrap.removeEventListener('pointerup', onUp);
      wrap.removeEventListener('pointercancel', onUp);
      wrap.removeEventListener('lostpointercapture', onUp);
      wrap.removeEventListener('dblclick', onDbl);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const generationId = ++generationRef.current;
    cancelAnimationFrame(rafRef.current);
    setPainelTarefa(null);
    cameraRef.current = { zoom: CAMERA_ZOOM_INICIAL, panX: 0, panY: 0 };

    if (!agencia || agencia.slots.length === 0) {
      limparCanvas(canvas);
      setStatus(
        vazioSemTemas || agencia?.slots.length === 0
          ? 'nenhum tema encontrado na biblia para esse pedido'
          : 'palco vazio — carregue uma planta do Lab',
      );
      setErro(null);
      return;
    }

    limparCanvas(canvas, 'montando agencia...');
    setStatus('carregando e validando assets…');
    setErro(null);
    let cancelado = false;

    void (async () => {
      try {
        const cena = await prepararCenaIso(agencia, { stripParedeL });
        if (cancelado || generationId !== generationRef.current) return;

        setStatus('compondo cena isometrica…');
        const staticCanvas = document.createElement('canvas');
        staticCanvas.width = cena.width;
        staticCanvas.height = cena.height;
        const staticCtx = staticCanvas.getContext('2d');
        if (!staticCtx) throw new Error('canvas 2d indisponivel');
        await desenharAgencia(staticCtx, agencia, cena);
        if (cancelado || generationId !== generationRef.current) return;

        const cenario: CenarioEspacial = construirEspacoAgencia(agencia, elencoIds);
        const kit = await PersonagemKit.carregar({
          agentIdsExtras: cenario.agentes.map((a) => a.agentId),
        });
        if (cancelado || generationId !== generationRef.current) return;

        const oclusao = await OclusaoCorredor.preparar(cena, cenario.layout.corridors);
        if (cancelado || generationId !== generationRef.current) return;

        const modoTarefa = Boolean(tarefaEspecial) && cenario.agentes.length >= 3;
        const simAmbient = modoTarefa
          ? null
          : new SimulacaoAgentes(cenario, agencia.seed);
        const simTarefa =
          modoTarefa && tarefaEspecial
            ? new SimulacaoTarefaEspecial(cenario, tarefaEspecial, agencia.seed)
            : null;

        let ultimo = performance.now();
        let ultimoStatus = 0;

        const loop = (agora: number) => {
          if (cancelado || generationId !== generationRef.current) return;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          const dpr = Math.min(2, window.devicePixelRatio || 1);
          const larguraCss = Math.max(1, wrap.clientWidth);
          const alturaCss = Math.max(1, wrap.clientHeight);
          canvas.width = Math.round(larguraCss * dpr);
          canvas.height = Math.round(alturaCss * dpr);
          canvas.style.width = `${larguraCss}px`;
          canvas.style.height = `${alturaCss}px`;

          const escalaBase =
            Math.min(larguraCss / cena.width, alturaCss / cena.height) * 0.96;
          const cam = cameraRef.current;
          const ea = escalaBase * cam.zoom;
          const deslocX = (larguraCss - cena.width * escalaBase) / 2;
          const deslocY = (alturaCss - cena.height * escalaBase) / 2;

          const dt = Math.min(100, agora - ultimo);
          ultimo = agora;
          const atores = simTarefa
            ? simTarefa.tick(dt)
            : (simAmbient as SimulacaoAgentes).tick(dt);
          const debug = simTarefa
            ? simTarefa.debugInfo()
            : (simAmbient as SimulacaoAgentes).debugInfo();

          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.fillStyle = '#07111f';
          ctx.fillRect(0, 0, larguraCss, alturaCss);
          ctx.imageSmoothingEnabled = false;
          ctx.setTransform(
            dpr * ea,
            0,
            0,
            dpr * ea,
            dpr * (deslocX + cam.panX),
            dpr * (deslocY + cam.panY),
          );
          ctx.drawImage(staticCanvas, 0, 0);
          desenharAtores(ctx, cena.origem, atores, agora, kit, oclusao);
          if (debugRef.current) {
            desenharDebugOverlay(ctx, cena.origem, { cenario, debug });
          }

          if (agora - ultimoStatus >= 400) {
            const nSalao = agencia.slots.filter((s) => s.proto.zonaKind === 'salao_especialistas').length;
            const nUser = agencia.slots.filter((s) => s.proto.zonaKind === 'sala_user').length;
            const nMacro = agencia.slots.filter((s) => s.proto.zonaKind === 'macroeconomia').length;
            const nNews = agencia.slots.filter((s) => s.proto.zonaKind === 'noticias').length;
            const geracaoTxt = agencia.geracao != null ? ` · g${agencia.geracao}` : '';
            const seedTxt = ` · seed ${agencia.seed.toString(16).slice(0, 6)}`;
            const zoomTxt = ` · z${cam.zoom.toFixed(1)}`;
            const debugTxt = debugRef.current ? ' · debug (D)' : '';
            const stripTxt = stripParedeL ? ' · stripL (W)' : ' · clipL (W)';
            const warningTxt = cena.warnings.length ? ` · ${cena.warnings.length} aviso(s)` : '';
            const tarefaTxt = simTarefa
              ? ` · tarefa especial · ${tarefaEspecial!.id}`
              : '';
            setStatus(
              `planta ${nSalao} salao + ${nUser} user + ${nMacro} macro + ${nNews} news · ${contarAtividades(atores)}${geracaoTxt}${seedTxt}${zoomTxt}${debugTxt}${stripTxt}${tarefaTxt}${warningTxt} · setas/arraste`,
            );
            if (simTarefa) setPainelTarefa(simTarefa.status());
            else setPainelTarefa(null);
            ultimoStatus = agora;
          }
          rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);
      } catch (err) {
        if (cancelado || generationId !== generationRef.current) return;
        const mensagem = String(err instanceof Error ? err.message : err);
        limparCanvas(canvas, 'falha ao montar a cena');
        setErro(mensagem);
        setStatus('falha estrutural ou asset ausente');
      }
    })();

    return () => {
      cancelado = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [agencia, vazioSemTemas, stripParedeL, tarefaEspecial, elencoIds]);

  return (
    <section className="stage" aria-label="Palco blueprint">
      <div className="stage-scroll">
        <div className="stage-canvas-wrap" ref={wrapRef}>
          <canvas ref={canvasRef} className="stage-canvas" />
          {erro ? <p className="stage-erro">{erro}</p> : null}
          <p className="stage-status">{status}</p>
          {painelTarefa ? (
            <aside className="tarefa-painel" aria-live="polite">
              <p className="tarefa-painel-titulo">{painelTarefa.titulo}</p>
              <p className="tarefa-painel-resumo">{painelTarefa.resumo}</p>
              <p className="tarefa-painel-batida">
                {painelTarefa.papelAtivo} · {painelTarefa.nomeAtivo}
                {painelTarefa.falaAtiva ? `: “${painelTarefa.falaAtiva}”` : ''}
                <span className="tarefa-painel-prog">
                  {' '}
                  · {painelTarefa.batidaIndex + 1}/{painelTarefa.batidaTotal}
                </span>
              </p>
            </aside>
          ) : null}
        </div>
      </div>
      <RosaVentos />
    </section>
  );
}
