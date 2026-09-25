/**
 * Estado / politica / normalizacao de temas do lab (suporte a UI de temas).
 * Persistencia localStorage + shape da biblia; pintura DOM fica no orchestrator.
 */
import { normalizarPostosTrabalho } from './lab-temas.mjs';

export const GRADE_MAX = 24;
export const ANDARES_MAX = 3;
export const ALTURA_PAREDE_MIN = 1;
export const ALTURA_PAREDE_MAX = 3;
export const ALTURA_PAREDE_PASSO = 1;
export const STORAGE_KEY = 'TradeClass-lab-catalogo-v4';

/** Zonas TradeClass + corredor estrutural + landing. MicroFirma removido. */
export const ZONAS_TILE = [
  { id: 'salao_especialistas', nome: 'Salao especialistas' },
  { id: 'sala_user', nome: 'Sala do User' },
  { id: 'macroeconomia', nome: 'Macroeconomia' },
  { id: 'noticias', nome: 'Noticias' },
  { id: 'corridor', nome: 'corredor' },
  { id: 'landing', nome: 'Landing' },
];

/** ids MicroFirma preservados no disco ate remapeamento manual. */
export const ZONAS_LEGACY = [
  'open',
  'private',
  'break',
  'boss_room',
  'meeting',
  'war_room',
  'reception',
];

export function slugTema(nome) {
  const s = String(nome || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return s || 'tema';
}

export function clampInt(n, lo, hi) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

/** Niveis inteiros de parede (empilhamento 1:1, sem escala). */
export function clampAlturaParede(n) {
  return clampInt(n, ALTURA_PAREDE_MIN, ALTURA_PAREDE_MAX);
}

export function coordsFaixa(eixo, valor, outroMax) {
  const out = [];
  for (let i = 0; i < outroMax; i++) {
    out.push(eixo === 'gx' ? valor + ',' + i : i + ',' + valor);
  }
  return out.join('  ');
}

export function clampGrade(g) {
  return {
    w: clampInt(g && g.w, 1, GRADE_MAX),
    h: clampInt(g && g.h, 1, GRADE_MAX),
  };
}

export function inferirGrade(palco) {
  let maxX = 2;
  let maxY = 2;
  for (const p of palco || []) {
    if (p.gx > maxX) maxX = p.gx;
    if (p.gy > maxY) maxY = p.gy;
  }
  return clampGrade({ w: maxX + 1, h: maxY + 1 });
}

export function paineisPadrao() {
  return {
    tilesets: false,
    piso: false,
    parede: false,
    zona: false,
    temas: false,
    json: false,
  };
}

export function normalizarPaineis(bruto) {
  const base = paineisPadrao();
  if (!bruto || typeof bruto !== 'object') return base;
  for (const id of Object.keys(base)) {
    if (typeof bruto[id] === 'boolean') base[id] = bruto[id];
  }
  return base;
}

/**
 * Aceita zonas TradeClass; preserva ids legado ate remapeamento manual no Lab.
 * Fallback so quando o id e vazio/desconhecido.
 */
export function zonaKindOk(id) {
  if (ZONAS_TILE.some((z) => z.id === id)) return id;
  if (ZONAS_LEGACY.includes(id)) return id;
  return 'sala_user';
}

export function itemEParede(p) {
  return !!(p && (p.papel === 'wall' || p.face === 'R' || p.face === 'L'));
}

export function palcoItemNormalizado(p) {
  if (itemEParede(p)) {
    return {
      assetId: p.assetId,
      papel: 'wall',
      face: p.face === 'L' ? 'L' : 'R',
      gx: typeof p.gx === 'number' ? p.gx : 0,
      gy: typeof p.gy === 'number' ? p.gy : 0,
      dx: typeof p.dx === 'number' ? p.dx : 0,
      dy: typeof p.dy === 'number' ? p.dy : 0,
      espelhado: !!p.espelhado,
    };
  }
  return { qx: 0, qy: 0, passo: 1, ...p };
}

export function normalizarTema(t) {
  const palco = (t.palco || []).map(palcoItemNormalizado);
  return {
    ...t,
    palco,
    grade: t.grade ? clampGrade(t.grade) : inferirGrade(palco),
    andares: clampInt(t.andares != null ? t.andares : 1, 1, ANDARES_MAX),
    subidaAndar: typeof t.subidaAndar === 'number' ? t.subidaAndar : null,
    alturaParede: clampAlturaParede(t.alturaParede != null ? t.alturaParede : 1),
    subdiv: t.subdiv !== false,
    prioridade: clampInt(t.prioridade != null ? t.prioridade : 5, 1, 9),
    unicoNaAgencia: !!t.unicoNaAgencia,
    marcadoParaGeracao: !!t.marcadoParaGeracao,
    zonaKind: zonaKindOk(t.zonaKind),
    calibracao: t.calibracao && typeof t.calibracao === 'object' ? t.calibracao : null,
    postosTrabalho: normalizarPostosTrabalho(t.postosTrabalho),
    wallMedia: Array.isArray(t.wallMedia)
      ? t.wallMedia.map(normalizarWallMedia).filter(Boolean)
      : [],
  };
}

function normalizarWallMedia(m) {
  if (!m || typeof m !== 'object') return null;
  const face = m.face === 'L' ? 'L' : 'R';
  const frames = new Set(['none', 'tv', 'big-tv', 'cork', 'screen', 'tv-3x', 'tv-4x', 'tv-war', 'cork-wide', 'cork-tall']);
  const blends = new Set(['normal', 'screen', 'linear-dodge']);
  const displays = new Set(['auto', 'image', 'iframe', 'hybrid']);
  const UV_MIN = -4;
  const UV_MAX = 5;
  const uvOk = (p) =>
    p && typeof p === 'object' && typeof p.u === 'number' && typeof p.v === 'number'
      ? {
          u: Math.min(UV_MAX, Math.max(UV_MIN, p.u)),
          v: Math.min(UV_MAX, Math.max(UV_MIN, p.v)),
        }
      : null;
  let screenCorners;
  if (m.screenCorners && typeof m.screenCorners === 'object') {
    const tl = uvOk(m.screenCorners.tl);
    const tr = uvOk(m.screenCorners.tr);
    const br = uvOk(m.screenCorners.br);
    const bl = uvOk(m.screenCorners.bl);
    if (tl && tr && br && bl) screenCorners = { tl, tr, br, bl };
  }
  let warpGrid;
  if (m.warpGrid && typeof m.warpGrid === 'object' && Array.isArray(m.warpGrid.points)) {
    const cols = clampInt(m.warpGrid.cols, 2, 8) || 3;
    const rows = clampInt(m.warpGrid.rows, 2, 8) || 3;
    const points = m.warpGrid.points.map(uvOk).filter(Boolean);
    if (points.length >= 4) warpGrid = { cols, rows, points };
  }
  return {
    mediaId: String(m.mediaId || `wm-${Date.now()}`),
    kind: m.kind === 'chart' || m.kind === 'banner' || m.kind === 'projection' ? m.kind : 'iframe',
    url: typeof m.url === 'string' ? m.url : '',
    frame: frames.has(m.frame) ? m.frame : 'none',
    mountAssetId: m.mountAssetId || undefined,
    nestAssetId: m.nestAssetId || m.mountAssetId || undefined,
    face,
    gx: clampInt(m.gx, 0, 32),
    gy: clampInt(m.gy, 0, 32),
    dx: typeof m.dx === 'number' ? m.dx : 0,
    dy: typeof m.dy === 'number' ? m.dy : 0,
    size: m.size && typeof m.size.w === 'number' ? { w: clampInt(m.size.w, 1, 16), h: clampInt(m.size.h || 1, 1, 8) } : { w: 2, h: 1 },
    heightPx: typeof m.heightPx === 'number' ? Math.min(480, Math.max(16, m.heightPx)) : undefined,
    screenInset: m.screenInset && typeof m.screenInset === 'object' ? m.screenInset : undefined,
    screenCorners,
    warpGrid,
    blendMode: blends.has(m.blendMode) ? m.blendMode : 'normal',
    display: displays.has(m.display) ? m.display : 'auto',
    previewApplied: !!m.previewApplied,
  };
}

export function slotTilesPadrao() {
  return { modo: 'default', pisos: [], paredes: [] };
}

export function politicaPadrao() {
  const o = {};
  for (const z of ZONAS_TILE) o[z.id] = slotTilesPadrao();
  return o;
}

export function normalizarPolitica(bruto, catalogo) {
  const pisosOk = new Set((catalogo && catalogo.pisos) || []);
  const paredesOk = new Set((catalogo && catalogo.paredes) || []);
  const base = politicaPadrao();
  const src = bruto && typeof bruto === 'object' ? bruto : {};
  const ids = [...ZONAS_TILE.map((z) => z.id), ...ZONAS_LEGACY];
  for (const id of ids) {
    const s = src[id] || {};
    if (!(id in src) && ZONAS_LEGACY.includes(id)) continue;
    const modo = s.modo === 'unico' || s.modo === 'opcoes' ? s.modo : 'default';
    const pisos = (Array.isArray(s.pisos) ? s.pisos : []).filter((n) => !pisosOk.size || pisosOk.has(n));
    const paredes = (Array.isArray(s.paredes) ? s.paredes : []).filter((n) => !paredesOk.size || paredesOk.has(n));
    if (modo === 'default') {
      base[id] = slotTilesPadrao();
    } else if (modo === 'unico') {
      base[id] = {
        modo: 'unico',
        pisos: pisos.slice(0, 1),
        paredes: paredes.slice(0, 1),
      };
    } else {
      base[id] = { modo: 'opcoes', pisos: pisos, paredes: paredes };
    }
  }
  return base;
}

export function estadoDoCatalogo(catalogo, temasArquivo) {
  return {
    tilesetAtivo: catalogo.tilesetAtivo || 'nordic-calm',
    pisoLivre: catalogo.pisoLivre || null,
    paredeLivre: catalogo.paredeLivre || null,
    usos: Object.fromEntries(catalogo.assets.map((a) => [a.assetId, a.uso])),
    palco: (catalogo.palcoPadrao || []).map(palcoItemNormalizado),
    celula: { gx: 1, gy: 1, qx: 0, qy: 0 },
    diagnostico: false,
    subdiv: true,
    modoPlantar: 'piso',
    paredeSel: null,
    temas: Array.isArray(temasArquivo) ? temasArquivo.map(normalizarTema) : [],
    combos: [],
    combinando: false,
    composeCamadas: [],
    grade: clampGrade(catalogo.palcoGrade || { w: 3, h: 3 }),
    andares: clampInt(catalogo.andares || 1, 1, ANDARES_MAX),
    subidaAndar: typeof catalogo.subidaAndar === 'number' ? catalogo.subidaAndar : null,
    alturaParede: clampAlturaParede(catalogo.alturaParede != null ? catalogo.alturaParede : 1),
    politicaTiles: politicaPadrao(),
    previewZona: null,
    postosTrabalho: [],
    wallMedia: [],
    paineis: paineisPadrao(),
  };
}

export function carregarEstado(catalogo, temasArquivo, politicaArquivo) {
  try {
    const bruto = localStorage.getItem(STORAGE_KEY);
    if (!bruto) {
      const base = estadoDoCatalogo(catalogo, temasArquivo);
      base.politicaTiles = normalizarPolitica(politicaArquivo, catalogo);
      return base;
    }
    const salvo = JSON.parse(bruto);
    const base = estadoDoCatalogo(catalogo, temasArquivo);
    const temasLocais = Array.isArray(salvo.temas) && salvo.temas.length
      ? salvo.temas.map(normalizarTema)
      : base.temas;
    return {
      ...base,
      ...salvo,
      usos: { ...base.usos, ...(salvo.usos || {}) },
      palco: Array.isArray(salvo.palco) ? salvo.palco.map(palcoItemNormalizado) : base.palco,
      celula: { gx: 1, gy: 1, qx: 0, qy: 0, ...(salvo.celula || {}) },
      temas: temasLocais,
      subdiv: salvo.subdiv !== false,
      combos: Array.isArray(salvo.combos) ? salvo.combos : base.combos,
      combinando: false,
      composeCamadas: Array.isArray(salvo.composeCamadas) ? salvo.composeCamadas : [],
      modoPlantar: salvo.modoPlantar === 'parede' ? 'parede' : 'piso',
      paredeSel: null,
      grade: clampGrade(salvo.grade || base.grade),
      andares: clampInt(salvo.andares != null ? salvo.andares : base.andares, 1, ANDARES_MAX),
      subidaAndar: typeof salvo.subidaAndar === 'number' ? salvo.subidaAndar : base.subidaAndar,
      alturaParede: clampAlturaParede(
        salvo.alturaParede != null ? salvo.alturaParede : base.alturaParede,
      ),
      politicaTiles: normalizarPolitica(salvo.politicaTiles || politicaArquivo, catalogo),
      previewZona: null,
      postosTrabalho: Array.isArray(salvo.postosTrabalho) ? normalizarPostosTrabalho(salvo.postosTrabalho) : [],
      wallMedia: Array.isArray(salvo.wallMedia)
        ? salvo.wallMedia.map(normalizarWallMedia).filter(Boolean)
        : [],
      paineis: normalizarPaineis(salvo.paineis),
    };
  } catch {
    const base = estadoDoCatalogo(catalogo, temasArquivo);
    base.politicaTiles = normalizarPolitica(politicaArquivo, catalogo);
    return base;
  }
}

export function gravarEstado(estado) {
  const slim = {
    tilesetAtivo: estado.tilesetAtivo,
    pisoLivre: estado.pisoLivre,
    paredeLivre: estado.paredeLivre,
    usos: estado.usos,
    palco: estado.palco,
    celula: estado.celula,
    diagnostico: estado.diagnostico,
    subdiv: estado.subdiv,
    modoPlantar: estado.modoPlantar === 'parede' ? 'parede' : 'piso',
    temas: estado.temas,
    combos: estado.combos,
    composeCamadas: estado.composeCamadas,
    grade: estado.grade,
    andares: estado.andares,
    subidaAndar: estado.subidaAndar,
    alturaParede: clampAlturaParede(estado.alturaParede != null ? estado.alturaParede : 1),
    politicaTiles: estado.politicaTiles,
    postosTrabalho: estado.postosTrabalho,
    wallMedia: (estado.wallMedia || []).map((m) => {
      if (!m || typeof m !== 'object') return m;
      const { _previewStatus, ...rest } = m;
      return rest;
    }),
    paineis: normalizarPaineis(estado.paineis),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
}

export function tilesPreviewZona(estado) {
  const id = estado.previewZona;
  if (!id || !estado.politicaTiles) return null;
  const slot = estado.politicaTiles[id];
  if (!slot || slot.modo === 'default') return null;
  return {
    piso: slot.pisos && slot.pisos[0] ? slot.pisos[0] : null,
    parede: slot.paredes && slot.paredes[0] ? slot.paredes[0] : null,
  };
}

export function resolverCores(catalogo, estado) {
  const ts = catalogo.tilesets.find((t) => t.tileSetId === estado.tilesetAtivo) || catalogo.tilesets[0];
  const preview = tilesPreviewZona(estado);
  return {
    piso: (preview && preview.piso) || estado.pisoLivre || ts.piso,
    parede: (preview && preview.parede) || estado.paredeLivre || ts.parede,
    tileSetId: ts.tileSetId,
    previewZona: estado.previewZona || null,
  };
}

export function nomeZonaTile(id) {
  const z = ZONAS_TILE.find((x) => x.id === id);
  if (z) return z.nome;
  if (ZONAS_LEGACY.includes(id)) return id + ' (legado)';
  return id;
}

export function resumoPolitica(politica) {
  const bits = [];
  for (const z of ZONAS_TILE) {
    const s = politica && politica[z.id];
    if (!s || s.modo === 'default') continue;
    const n = (s.pisos || []).length + (s.paredes || []).length;
    bits.push(z.nome + ' ' + s.modo + (n ? ' (' + (s.pisos || []).join(',') + ')' : ''));
  }
  return bits.length ? bits.join('  |  ') : 'todas as zonas no tema do arquiteto';
}
