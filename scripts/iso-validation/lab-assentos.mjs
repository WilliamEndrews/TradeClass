/**
 * Multi-assento do TinyTraderLab: slots seat-N, upsert por agentSlot, facing.
 * Helpers puros (testaveis); o lab so faz wiring DOM/estado.
 */
import {
  inferirFacingAssento,
  mesaMaisProximaDoPosto,
  normalizarPostosTrabalho,
  postoParaGrid,
} from './lab-temas.mjs';

export const ASSENTO_SLOT_PADRAO = 'seat-0';
export const MAX_ASSENTOS_PADRAO = 6;
export const MAX_ASSENTOS_LIMITE = 12;

/** Compara duas subcelulas (gx/gy + qx/qy). */
export function mesmaSubcelula(a, b) {
  if (!a || !b) return false;
  return (
    a.gx === b.gx &&
    a.gy === b.gy &&
    (a.qx || 0) === (b.qx || 0) &&
    (a.qy || 0) === (b.qy || 0)
  );
}

/** Clamp do limite de assentos do lab (1..12). */
export function clampMaxAssentos(n, fallback = MAX_ASSENTOS_PADRAO) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(1, Math.min(MAX_ASSENTOS_LIMITE, Math.round(v)));
}

/** Lista slots ja usados + o ativo, sem duplicar. */
export function listarSlotsAssento(postos, slotAtivo) {
  const slots = (postos || []).map((p) => p.agentSlot);
  const ativo = slotAtivo || ASSENTO_SLOT_PADRAO;
  if (!slots.includes(ativo)) slots.push(ativo);
  return [...new Set(slots)].sort();
}

/** Proximo id livre no padrao seat-0, seat-1, ... */
export function proximoSlotLivre(postos) {
  let i = 0;
  while ((postos || []).some((p) => p.agentSlot === `seat-${i}`)) i += 1;
  return `seat-${i}`;
}

/** True se ainda cabe um slot novo sob o limite. */
export function podeAdicionarSlot(postos, maxAssentos) {
  return (postos || []).length < clampMaxAssentos(maxAssentos);
}

/**
 * Monta a entrada de posto (facing via mesa mais proxima).
 * `mesas` = [{ assetId, gx, gy }, ...].
 */
export function montarEntradaAssento(cel, slot, mesas) {
  const base = {
    agentSlot: slot || ASSENTO_SLOT_PADRAO,
    gx: cel.gx,
    gy: cel.gy,
    qx: cel.qx || 0,
    qy: cel.qy || 0,
    passo: 0.5,
  };
  const mesa = mesaMaisProximaDoPosto(base, mesas);
  const inferido = inferirFacingAssento(base, mesa);
  return {
    ...base,
    ...inferido,
    ...(mesa ? { deskAssetId: mesa.assetId } : {}),
  };
}

/**
 * Upsert por agentSlot. Se o slot e novo e ja bateu no max, retorna
 * `{ ok: false, motivo: 'limite' }` sem alterar a lista.
 */
export function upsertPostoTrabalho(postos, entry, maxAssentos) {
  const atuais = postos || [];
  const slot = entry.agentSlot || ASSENTO_SLOT_PADRAO;
  const jaExiste = atuais.some((p) => p.agentSlot === slot);
  const max = clampMaxAssentos(maxAssentos);
  if (!jaExiste && atuais.length >= max) {
    return { ok: false, motivo: 'limite', postos: atuais, max };
  }
  const next = normalizarPostosTrabalho([
    ...atuais.filter((p) => p.agentSlot !== slot),
    entry,
  ]);
  return { ok: true, postos: next, max };
}

export function removerPostoPorSlot(postos, slot) {
  return normalizarPostosTrabalho(
    (postos || []).filter((p) => p.agentSlot !== slot),
  );
}

/** Gira facing do posto (+1 ou -1) e marca origem manual. */
export function girarFacingManual(posto, giro) {
  if (!posto) return null;
  const dir = giro >= 0 ? 1 : -1;
  return {
    ...posto,
    facing: (((posto.facing ?? 2) + dir) % 4 + 4) % 4,
    facingOrigem: 'manual',
  };
}

/**
 * Desenha a seta de facing no canvas.
 * `deps` = { iso(gx,gy), origem: {x,y} }.
 */
export function desenharSetaFacingPosto(ctx, posto, deps) {
  const { iso, origem } = deps;
  const vetores = [
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
    { x: 1, y: 0 },
  ];
  const v = vetores[posto.facing] || vetores[2];
  const g = postoParaGrid(posto);
  const aIso = iso(g.x, g.y);
  const bIso = iso(g.x + v.x * 0.38, g.y + v.y * 0.38);
  const ax = origem.x + aIso.x;
  const ay = origem.y + aIso.y;
  const bx = origem.x + bIso.x;
  const by = origem.y + bIso.y;
  const ang = Math.atan2(by - ay, bx - ax);

  ctx.save();
  ctx.strokeStyle = posto.facingOrigem === 'manual' ? '#f5d76e' : '#34d399';
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx - Math.cos(ang - 0.55) * 7, by - Math.sin(ang - 0.55) * 7);
  ctx.lineTo(bx - Math.cos(ang + 0.55) * 7, by - Math.sin(ang + 0.55) * 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Stroke/fill do losango de subcelula no modo assento/diagnostico. */
export function estiloLosangoAssento({
  marcandoAssento,
  hover,
  sel,
  postoTravado,
}) {
  let stroke = marcandoAssento
    ? 'rgba(52, 211, 153, 0.45)'
    : 'rgba(80, 160, 255, 0.55)';
  let fill = null;
  if (postoTravado) {
    stroke = '#34d399';
    fill = 'rgba(52, 211, 153, 0.28)';
  } else if (hover) {
    stroke = '#f5d76e';
    fill = 'rgba(245, 215, 110, 0.32)';
  } else if (sel) {
    stroke = '#7ec8ff';
    fill = 'rgba(80, 160, 255, 0.14)';
  }
  return { stroke, fill };
}
