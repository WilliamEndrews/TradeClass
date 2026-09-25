/**
 * Modal POV simulado da camera de cinema (~70% viewport).
 * Slot `mode: webrtc_future` reservado (ADR-0014) — sem MediaStream neste ciclo.
 */
import { useEffect, useRef, useState } from 'react';
import { PersonagemKit } from '@tradeclass/iso-characters';

export type LivePovMode = 'simulated' | 'webrtc_future';

type Props = {
  aberto: boolean;
  onFechar: () => void;
  agentId: string;
  seriesId: string;
  bgUrl: string;
  mode?: LivePovMode;
  t: (chave: string, vars?: Record<string, string | number>) => string;
};

export function LivePovModal({
  aberto,
  onFechar,
  agentId,
  seriesId,
  bgUrl,
  mode = 'simulated',
  t,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [viewers] = useState(() => 120 + Math.floor(Math.random() * 880));

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aberto, onFechar]);

  useEffect(() => {
    if (!aberto || mode !== 'simulated') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let vivo = true;
    let raf = 0;

    void (async () => {
      const kit = await PersonagemKit.carregar({ agentIdsExtras: [agentId] });
      await kit.garantir(agentId);
      if (!vivo) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const W = 640;
      const H = 360;
      canvas.width = W;
      canvas.height = H;

      const bg = new Image();
      bg.src = bgUrl;
      await new Promise<void>((resolve) => {
        if (bg.complete) resolve();
        else {
          bg.onload = () => resolve();
          bg.onerror = () => resolve();
        }
      });
      if (!vivo) return;

      const t0 = performance.now();
      const loop = (now: number) => {
        if (!vivo) return;
        ctx.fillStyle = '#04080c';
        ctx.fillRect(0, 0, W, H);
        if (bg.naturalWidth > 0) {
          ctx.drawImage(bg, 0, 0, W, H);
        }
        // Vinheta leve
        const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.75);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,0,0.45)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        kit.desenhar(ctx, agentId, 'working', 'seated', 0, now - t0, W * 0.5, H * 0.78, 2.2);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    })();

    return () => {
      vivo = false;
      cancelAnimationFrame(raf);
    };
  }, [aberto, agentId, bgUrl, mode]);

  if (!aberto) return null;

  return (
    <div
      className="live-pov-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div
        className="live-pov-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t('livePov.titulo')}
      >
        <header className="live-pov-chrome">
          <span className="live-pov-badge">LIVE</span>
          <span className="live-pov-ticker">{seriesId}</span>
          <span className="live-pov-viewers">
            {t('livePov.viewers', { n: viewers })}
          </span>
          <button type="button" className="live-pov-fechar" onClick={onFechar} aria-label={t('livePov.fechar')}>
            ×
          </button>
        </header>
        <div className="live-pov-stage">
          {mode === 'webrtc_future' ? (
            <p className="live-pov-soon">{t('livePov.webrtcEmBreve')}</p>
          ) : (
            <canvas ref={canvasRef} className="live-pov-canvas" />
          )}
        </div>
        <footer className="live-pov-foot">
          <span>{t('livePov.agente', { id: agentId })}</span>
          <span className="live-pov-mode">{t('livePov.modoSimulado')}</span>
        </footer>
      </div>
    </div>
  );
}
