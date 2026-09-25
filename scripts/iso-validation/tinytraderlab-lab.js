/**
 * Laboratorio TinyTraderLab: palco 3x3 + catalogo do arquiteto.
 * Carrega calibracao-tinytraderlab.json, catalogo-laboratorio.json e
 * a biblia de temas do Construtor (world-engine/src/biblia/).
 */
import {
  anexoParedeValido,
  mesclarCombos,
  normalizarPostosTrabalho,
  postoParaGrid,
  rebasearAnexoParede,
  restaurarCoresDoTema,
  validarPalco,
} from './lab-temas.mjs';
import {
  ASSENTO_SLOT_PADRAO,
  MAX_ASSENTOS_PADRAO,
  clampMaxAssentos,
  desenharSetaFacingPosto as desenharSetaFacingDeps,
  estiloLosangoAssento,
  girarFacingManual,
  listarSlotsAssento as listarSlotsAssentoPuros,
  mesmaSubcelula as mesmaSubcelulaPura,
  montarEntradaAssento,
  podeAdicionarSlot,
  proximoSlotLivre,
  removerPostoPorSlot,
  upsertPostoTrabalho,
} from './lab-assentos.mjs';
import {
  ALTURA_TILE,
  COMPOSE_ORIGEM,
  LARGURA_TILE,
  ORIGEM,
  ORIGEM_COMPOSE,
  ancoraTelaCelula,
  blitCatalogo,
  blitNaVertice,
  blitNaVerticeEspelhado,
  blitNaVerticeFatia,
  blitNoPe,
  blitObjeto,
  blitTile,
  chaveSlot,
  encaixarPalco,
  iso,
  losango,
  marcarPe,
  medirBbox,
  mesmaCelula,
  mesmoSlot,
  offsetPisoDoPonto,
  origemDoItem,
  peExtremo,
  perimetroGrade,
  silhuetaChao,
  specDoItem,
  telaParaGrade,
  thumb,
  faixaFaceParede,
  withOrigemAbs,
  withOrigemOffset,
} from './lab-desenho-palco.mjs';
import {
  ANDARES_MAX,
  ALTURA_PAREDE_MAX,
  ALTURA_PAREDE_MIN,
  ALTURA_PAREDE_PASSO,
  GRADE_MAX,
  STORAGE_KEY,
  ZONAS_TILE,
  carregarEstado,
  clampAlturaParede,
  clampGrade,
  clampInt,
  coordsFaixa,
  estadoDoCatalogo,
  gravarEstado,
  inferirGrade,
  itemEParede,
  nomeZonaTile,
  normalizarPaineis,
  normalizarPolitica,
  normalizarTema,
  paineisPadrao,
  palcoItemNormalizado,
  politicaPadrao,
  resolverCores,
  resumoPolitica,
  slotTilesPadrao,
  slugTema,
  tilesPreviewZona,
  zonaKindOk,
} from './lab-temas-ui.mjs';

const BASE = '../../assets-source/tinyhouse-pixel-salvaje/TinyHouse/';
const BASE_CREATED = '../../assets-source/tradeclass-created/';
const ANCORA_PISO = { x: 64, y: 68 };
const URL_CALIBRACAO = '../../apps/room/src/calibracao-tinytraderlab.json';
const URL_CATALOGO = './catalogo-laboratorio.json';
const URL_TEMAS = '../../packages/world-engine/src/biblia/temas-arquiteto.json';
const URL_COMBOS = './combinacoes-laboratorio.json';
const URL_CREATED = './created-assets.json';
/** API do lab-server.mjs â€” grava a biblia no disco do repo. */
const URL_PERSISTIR_TEMAS = '/api/temas-arquiteto';
const URL_PERSISTIR_COMBOS = '/api/combinacoes-laboratorio';
const URL_PERSISTIR_CREATED = '/api/created-assets';
const DIR_TILES = 'Floor_Wall_Tiles_128';
const PORTA_VIDRO = 'Doors/Office_Glass_Door_Ani/Office_Glass_Door_1.png';

const CALIBRACAO_FALLBACK = {
  rodada: 5,
  plano: 'B',
  ancoraPiso: ANCORA_PISO,
  peWallR: { x: 32, y: 83 },
  peWallL: { x: 95, y: 83 },
  pePorta: { x: 46, y: 101 },
  folgaPorta: { x: 11, y: 4 },
  objetos: {
    desk: { modo: 'centro', ancora: { x: 64, y: 68 } },
    water: { modo: 'canto', pe: { x: 64, y: 63 } },
  },
};

const cacheImg = new Map();

function urlPng(fileName) {
  if (typeof fileName === 'string' && fileName.startsWith('created/')) {
    const rel = fileName.slice('created/'.length);
    return BASE_CREATED + rel.split('/').map(encodeURIComponent).join('/');
  }
  return BASE + fileName.split('/').map(encodeURIComponent).join('/');
}

function carregar(src) {
  if (cacheImg.has(src)) return cacheImg.get(src);
  const p = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('falhou ' + src));
    img.src = urlPng(src);
  });
  cacheImg.set(src, p);
  return p;
}

function fetchJson(url, fallback) {
  return fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .catch((err) => {
      if (fallback) return fallback;
      throw err;
    });
}

(async () => {
  const canvas = document.getElementById('palco');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const [cal, catalogo, temasDoc, combosDoc, createdDoc] = await Promise.all([
    fetchJson(URL_CALIBRACAO, CALIBRACAO_FALLBACK),
    fetchJson(URL_CATALOGO),
    fetchJson(URL_TEMAS, { temas: [] }),
    fetchJson(URL_COMBOS, { combinacoes: [] }),
    fetchJson(URL_CREATED, { assets: [] }),
  ]);

  const ancoraPiso = cal.ancoraPiso || ANCORA_PISO;
  const peR = cal.peWallR;
  const peL = cal.peWallL;
  const peP = cal.pePorta;
  const FOLGA_PORTA = cal.folgaPorta;
  const bboxPorSrc = new Map();

  const estado = carregarEstado(catalogo, temasDoc.temas || [], temasDoc.politicaTiles);
  estado.combos = mesclarCombos(combosDoc.combinacoes || [], estado.combos || []);
  estado.createdAssets = Array.isArray(createdDoc.assets) ? createdDoc.assets : [];
  let temasOrigem = localStorage.getItem(STORAGE_KEY) ? 'localStorage' : 'disco';

  function assetsCatalogo() {
    return catalogo.assets.concat(estado.combos || []);
  }

  function todosAssets() {
    return assetsCatalogo().concat(estado.createdAssets || []);
  }

  function specPorId(id) {
    return todosAssets().find((a) => a.assetId === id);
  }

  function abrirPopupInterativo(interativo) {
    const drawer = document.getElementById('interact-drawer');
    if (!drawer) return;
    const titulo = document.getElementById('interact-title');
    const corpo = document.getElementById('interact-corpo');
    if (titulo) titulo.textContent = interativo?.titulo || 'Teste de design';
    if (corpo) {
      if (interativo?.acao === 'live_pov') {
        corpo.textContent =
          (interativo?.corpo || 'POV da camera de cinema') +
          ' Abra o Room e clique na camera para o modal de live.';
      } else {
        corpo.textContent = interativo?.corpo || 'Teste de design';
      }
    }
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
  }

  function acaoInterativaAbreOverlay(acao) {
    return acao === 'popup' || acao === 'live_pov';
  }

  function fecharPopupInterativo() {
    const drawer = document.getElementById('interact-drawer');
    if (!drawer || !drawer.classList.contains('open')) return false;
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    return true;
  }

  async function bboxDe(src) {
    if (bboxPorSrc.has(src)) return bboxPorSrc.get(src);
    const img = await carregar(src);
    const b = medirBbox(img);
    bboxPorSrc.set(src, b);
    return b;
  }

  let ultBboxWall = null;
  let paredePecaIx = -1;
  let arrasteParede = null;
  let arrasteCalib = null;
  /** Arraste do miolo do nest (move dx/dy no espaco, estilo Word). */
  let arrasteNest = null;
  let arrastePiso = null;
  let arraste = null;
  let pulouClickPalco = false;
  let filtroPapel = '';
  let arrasteCatalogo = null;
  let bookAberto = true;
  /** Modo "marcar assento": grade subdividida clicavel; nao persiste no localStorage. */
  let marcandoAssento = false;
  /** Hover da subcelula sob o mouse enquanto marca assento (null fora da grade). */
  let assentoHover = null;
  /** Limite de assentos por tema (configuravel no lab). */
  let maxAssentos = MAX_ASSENTOS_PADRAO;
  /** Slot ativo para marcar/editar (seat-0, seat-1, ...). */
  let assentoSlotAtivo = ASSENTO_SLOT_PADRAO;
  const UNDO_MAX = 60;
  const historicoUndo = [];
  const historicoRedo = [];
  let undoDoArraste = false;
  let composeSel = -1;
  document.body.classList.add('book-open');
  // Ancoragem fina sempre ativa por tras dos panos (UI de subdiv removida).
  estado.subdiv = true;

  const ESPELHAVEL_OFF = new Set([
    'projector-screen',
    'japanese-shelf',
    'japanese-canvas',
    'kitchen-cabinet-glass',
    'kitchen-shelf',
  ]);

  function assetEspelhavel(spec) {
    if (!spec || spec.papel !== 'wall') return false;
    if (spec.espelhavel === false) return false;
    if (spec.espelhavel === true) return true;
    return !ESPELHAVEL_OFF.has(spec.assetId);
  }

  function agentSlotAssento() {
    return assentoSlotAtivo || 'seat-0';
  }

  function listarSlotsAssento() {
    return listarSlotsAssentoPuros(estado.postosTrabalho, assentoSlotAtivo);
  }

  function pintarSeletorAssentos() {
    const sel = document.getElementById('assento-slot-ativo');
    const lim = document.getElementById('assento-max');
    const contagem = document.getElementById('assento-contagem');
    if (lim) {
      lim.value = String(maxAssentos);
    }
    if (contagem) {
      contagem.textContent = `${(estado.postosTrabalho || []).length}/${maxAssentos}`;
    }
    if (!sel) return;
    const slots = listarSlotsAssento();
    sel.innerHTML = '';
    for (const s of slots) {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      if (s === assentoSlotAtivo) opt.selected = true;
      sel.appendChild(opt);
    }
  }

  function adicionarSlotAssento() {
    if (!podeAdicionarSlot(estado.postosTrabalho, maxAssentos)) {
      const status = document.getElementById('tema-persist-status');
      if (status) {
        status.dataset.ok = '0';
        status.textContent = `limite de ${maxAssentos} assentos atingido`;
      }
      return;
    }
    assentoSlotAtivo = proximoSlotLivre(estado.postosTrabalho);
    pintarSeletorAssentos();
    setMarcandoAssento(true);
  }

  function removerSlotAssentoAtivo() {
    const slot = agentSlotAssento();
    estado.postosTrabalho = removerPostoPorSlot(estado.postosTrabalho, slot);
    const rest = estado.postosTrabalho;
    assentoSlotAtivo = rest[0]?.agentSlot || ASSENTO_SLOT_PADRAO;
    gravarEstado(estado);
    pintarSeletorAssentos();
    desenharPalco();
  }

  function mesmaSubcelula(a, b) {
    return mesmaSubcelulaPura(a, b);
  }

  function atualizarBotaoAssento() {
    const btn = document.getElementById('btn-marcar-assento');
    if (!btn) return;
    btn.classList.toggle('ativo', marcandoAssento);
    btn.textContent = marcandoAssento ? 'cancelar assento' : 'marcar assento';
    btn.title = marcandoAssento
      ? 'Sair (Esc). Q/E gira o facing do slot ativo. Varios assentos por sala.'
      : 'Marca o slot ativo (seat-N). Adicione slots para multi-assento.';
    canvas.classList.toggle('marcando-assento', marcandoAssento);
    pintarSeletorAssentos();
  }

  function setMarcandoAssento(ativo) {
    marcandoAssento = !!ativo;
    if (!marcandoAssento) assentoHover = null;
    atualizarBotaoAssento();
    atualizarCelulaTxt();
    desenharPalco();
  }

  function travarAssentoEm(cel) {
    if (!cel) return;
    if (cel.gx < 0 || cel.gy < 0 || cel.gx >= gradeW() || cel.gy >= gradeH()) return;
    const slot = agentSlotAssento();
    const mesas = estado.palco
      .filter((peca) => specPorId(peca.assetId)?.kind === 'desk')
      .map((peca) => ({ assetId: peca.assetId, gx: peca.gx, gy: peca.gy }));
    const entry = montarEntradaAssento(cel, slot, mesas);
    const r = upsertPostoTrabalho(estado.postosTrabalho, entry, maxAssentos);
    if (!r.ok) {
      const status = document.getElementById('tema-persist-status');
      if (status) {
        status.dataset.ok = '0';
        status.textContent = `limite de ${maxAssentos} assentos - remova um ou aumente o max`;
      }
      return;
    }
    estado.postosTrabalho = r.postos;
    estado.celula = { gx: cel.gx, gy: cel.gy, qx: cel.qx || 0, qy: cel.qy || 0 };
    gravarEstado(estado);
    atualizarCelulaTxt();
    pintarSeletorAssentos();
    const status = document.getElementById('tema-persist-status');
    if (status) {
      status.dataset.ok = '1';
      status.textContent =
        `assento ${slot} em ${cel.gx},${cel.gy} q${cel.qx || 0}${cel.qy || 0} (${estado.postosTrabalho.length}/${maxAssentos}) - salve o tema`;
    }
    desenharPalco();
  }

  function celulaAssentoSobPonto(px, py) {
    const g = telaParaGrade(px, py, true);
    if (g.gx < 0 || g.gy < 0 || g.gx >= gradeW() || g.gy >= gradeH()) return null;
    return { gx: g.gx, gy: g.gy, qx: g.qx || 0, qy: g.qy || 0 };
  }

  function desenharSetaFacingPosto(ctx, posto) {
    desenharSetaFacingDeps(ctx, posto, { iso, origem: ORIGEM });
  }

  function peDaFace(face) {
    return face === 'L' ? peL : peR;
  }
  function verticeDaFace(face, gx, gy) {
    return face === 'L' ? { vx: 0, vy: gy } : { vx: gx, vy: 0 };
  }
  function posBlitVertice(vx, vy, pe, dx, dy) {
    const v = iso(vx, vy);
    return {
      x: ORIGEM.x + (dx || 0) + v.x - pe.x,
      y: ORIGEM.y + (dy || 0) + v.y - pe.y,
    };
  }
  function rectFromBlit(o, bbox) {
    return { x: o.x + bbox.x, y: o.y + bbox.y, w: bbox.w, h: bbox.h };
  }
  function rectFace(face, gx, gy, bbox) {
    const pe = peDaFace(face);
    const v = verticeDaFace(face, gx, gy);
    return rectFromBlit(posBlitVertice(v.vx, v.vy, pe, 0, 0), bbox);
  }
  function rectPecaParede(item, bbox) {
    const pe = peDaFace(item.face);
    const v = verticeDaFace(item.face, item.gx, item.gy);
    const o = posBlitVertice(v.vx, v.vy, pe, item.dx || 0, item.dy || 0);
    // Espelho explicito (Ctrl+E) — nao depende da face.
    if (item.espelhado) {
      const telaX = o.x + pe.x;
      return {
        x: telaX + pe.x - (bbox.x + bbox.w),
        y: o.y + bbox.y,
        w: bbox.w,
        h: bbox.h,
      };
    }
    return rectFromBlit(o, bbox);
  }
  function rectPecaPiso(item, bbox, spec) {
    const { ox, oy, passo } = origemDoItem(item);
    const dx = item.dx || 0;
    const dy = item.dy || 0;
    const o = specDoItem(spec, cal);
    if (o && o.modo === 'canto' && o.pe) {
      return rectFromBlit(posBlitVertice(ox, oy, o.pe, dx, dy), bbox);
    }
    if (o && o.modo === 'centro' && o.ancora) {
      const c = iso(ox + passo / 2, oy + passo / 2);
      return {
        x: ORIGEM.x + dx + c.x - o.ancora.x + bbox.x,
        y: ORIGEM.y + dy + c.y - o.ancora.y + bbox.y,
        w: bbox.w,
        h: bbox.h,
      };
    }
    const c = iso(ox + 0.5, oy + 0.5);
    return {
      x: ORIGEM.x + dx + c.x - (bbox.x + bbox.w / 2) + bbox.x,
      y: ORIGEM.y + dy + c.y - (bbox.y + bbox.h) + bbox.y,
      w: bbox.w,
      h: bbox.h,
    };
  }
  /** Camadas de um combo com bbox ja cacheada (apos o 1o blit). */
  function bboxCamadas(spec) {
    const out = [];
    if (!spec || !spec.camadas) return out;
    for (const cam of spec.camadas) {
      const layerSpec = specPorId(cam.assetId);
      if (!layerSpec || layerSpec.camadas || !layerSpec.fileName) continue;
      if (!bboxPorSrc.has(layerSpec.fileName)) continue;
      out.push({
        bbox: bboxPorSrc.get(layerSpec.fileName),
        dx: cam.dx || 0,
        dy: cam.dy || 0,
        layerSpec,
      });
    }
    return out;
  }
  function unirRects(rects) {
    if (!rects.length) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const r of rects) {
      minX = Math.min(minX, r.x);
      minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.w);
      maxY = Math.max(maxY, r.y + r.h);
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  /** Retangulo de hit/destaque: asset simples ou uniao das camadas do combo. */
  function rectPecaSpec(item, spec) {
    if (!item || !spec) return null;
    if (spec.camadas && spec.camadas.length) {
      const cams = bboxCamadas(spec);
      if (!cams.length) return null;
      const rects = [];
      if (itemEParede(item)) {
        for (const cam of cams) {
          rects.push(rectPecaParede({
            ...item,
            dx: (item.dx || 0) + cam.dx,
            dy: (item.dy || 0) + cam.dy,
          }, cam.bbox));
        }
      } else {
        for (const cam of cams) {
          const r = rectPecaPiso(item, cam.bbox, cam.layerSpec);
          rects.push({ x: r.x + cam.dx, y: r.y + cam.dy, w: r.w, h: r.h });
        }
      }
      return unirRects(rects);
    }
    if (!spec.fileName || !bboxPorSrc.has(spec.fileName)) return null;
    const bbox = bboxPorSrc.get(spec.fileName);
    return itemEParede(item) ? rectPecaParede(item, bbox) : rectPecaPiso(item, bbox, spec);
  }
  function pontoNoRect(px, py, r) {
    return px >= r.x && py >= r.y && px <= r.x + r.w && py <= r.y + r.h;
  }
  function facesDoPalco() {
    const faces = [];
    for (let gx = 0; gx < gradeW(); gx++) faces.push({ face: 'R', gx: gx, gy: 0 });
    for (let gy = 0; gy < gradeH(); gy++) faces.push({ face: 'L', gx: 0, gy: gy });
    return faces;
  }
  function faceSobPonto(px, py) {
    if (!ultBboxWall) return null;
    let best = null;
    let bestD = Infinity;
    for (const f of facesDoPalco()) {
      const bbox = f.face === 'L' ? ultBboxWall.L : ultBboxWall.R;
      const r = rectFace(f.face, f.gx, f.gy, bbox);
      if (!pontoNoRect(px, py, r)) continue;
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const d = (px - cx) * (px - cx) + (py - cy) * (py - cy);
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }
    return best;
  }
  function dyInicialParede(assetId) {
    const subida = subidaEfetiva(null);
    if (assetId === 'office-ac' || assetId === 'office-window') return Math.round(-subida * 0.72);
    if (assetId === 'projector-screen') return Math.round(-subida * 0.55);
    return Math.round(-subida * 0.45);
  }
  function pecasDaFace(sel) {
    if (!sel) return [];
    return estado.palco.filter((p) =>
      itemEParede(p) && p.face === sel.face && p.gx === sel.gx && p.gy === sel.gy,
    );
  }
  function pecaParedeSobPonto(px, py) {
    for (let i = estado.palco.length - 1; i >= 0; i--) {
      const p = estado.palco[i];
      if (!itemEParede(p)) continue;
      const r = rectPecaSpec(p, specPorId(p.assetId));
      if (r && pontoNoRect(px, py, r)) return i;
    }
    return -1;
  }
  function pecaPisoSobPonto(px, py) {
    for (let i = estado.palco.length - 1; i >= 0; i--) {
      const p = estado.palco[i];
      if (itemEParede(p)) continue;
      const r = rectPecaSpec(p, specPorId(p.assetId));
      if (r && pontoNoRect(px, py, r)) return i;
    }
    return -1;
  }
  /** Qualquer peca do palco (parede tem prioridade visual se sobrepor). */
  function pecaPalcoSobPonto(px, py) {
    const w = pecaParedeSobPonto(px, py);
    if (w >= 0) return w;
    return pecaPisoSobPonto(px, py);
  }
  function mesmaFace(a, b) {
    return a && b && a.face === b.face && a.gx === b.gx && a.gy === b.gy;
  }

  function snapshotCanvas() {
    return {
      palco: JSON.parse(JSON.stringify(estado.palco)),
      celula: {
        gx: estado.celula.gx,
        gy: estado.celula.gy,
        qx: estado.celula.qx || 0,
        qy: estado.celula.qy || 0,
      },
      paredeSel: estado.paredeSel
        ? { face: estado.paredeSel.face, gx: estado.paredeSel.gx, gy: estado.paredeSel.gy }
        : null,
      paredePecaIx,
      composeCamadas: JSON.parse(JSON.stringify(estado.composeCamadas || [])),
      composeSel,
    };
  }

  function aplicarSnapshotCanvas(snap) {
    estado.palco = JSON.parse(JSON.stringify(snap.palco || []));
    estado.celula = {
      gx: snap.celula && snap.celula.gx != null ? snap.celula.gx : 1,
      gy: snap.celula && snap.celula.gy != null ? snap.celula.gy : 1,
      qx: snap.celula && snap.celula.qx != null ? snap.celula.qx : 0,
      qy: snap.celula && snap.celula.qy != null ? snap.celula.qy : 0,
    };
    estado.paredeSel = snap.paredeSel
      ? { face: snap.paredeSel.face, gx: snap.paredeSel.gx, gy: snap.paredeSel.gy }
      : null;
    paredePecaIx = typeof snap.paredePecaIx === 'number' ? snap.paredePecaIx : -1;
    estado.composeCamadas = JSON.parse(JSON.stringify(snap.composeCamadas || []));
    composeSel = typeof snap.composeSel === 'number' ? snap.composeSel : -1;
  }

  function marcarUndo() {
    historicoUndo.push(snapshotCanvas());
    if (historicoUndo.length > UNDO_MAX) historicoUndo.shift();
    historicoRedo.length = 0;
  }

  function refreshAposUndo() {
    gravarEstado(estado);
    pintarListaParede();
    pintarCamadasLocais();
    if (typeof pintarListaCamadas === 'function') pintarListaCamadas();
    if (estado.combinando && typeof desenharCompose === 'function') desenharCompose();
    else desenharPalco();
  }

  function desfazer() {
    if (arrasteParede || arrastePiso || arraste || arrasteCatalogo) return;
    if (!historicoUndo.length) return;
    historicoRedo.push(snapshotCanvas());
    aplicarSnapshotCanvas(historicoUndo.pop());
    refreshAposUndo();
  }

  function refazer() {
    if (arrasteParede || arrastePiso || arraste || arrasteCatalogo) return;
    if (!historicoRedo.length) return;
    historicoUndo.push(snapshotCanvas());
    aplicarSnapshotCanvas(historicoRedo.pop());
    refreshAposUndo();
  }

  function espelharFacePeca(idx) {
    const peca = estado.palco[idx];
    if (!peca || !itemEParede(peca)) return;
    const spec = specPorId(peca.assetId);
    if (!assetEspelhavel(spec)) return;
    marcarUndo();
    // 1) Inverte o sprite (flag explicita — drop/arraste nao espelha sozinho).
    peca.espelhado = !peca.espelhado;
    // 2) Leva para a parede oposta no mesmo "indice" ao longo da aresta.
    const faceNova = peca.face === 'L' ? 'R' : 'L';
    if (faceNova === 'L') {
      peca.face = 'L';
      peca.gy = clampInt(typeof peca.gx === 'number' ? peca.gx : peca.gy || 0, 0, gradeH() - 1);
      peca.gx = 0;
    } else {
      peca.face = 'R';
      peca.gx = clampInt(typeof peca.gy === 'number' ? peca.gy : peca.gx || 0, 0, gradeW() - 1);
      peca.gy = 0;
    }
    // Mantem dy (altura na parede); zera dx para ancorar limpo no pe da face nova.
    peca.dx = 0;
    // NAO chama rebasearAnexoParede — ele recalculava a face pela posicao e
    // desfazia o salto / misturava com o flip automatico.
    estado.paredeSel = { face: peca.face, gx: peca.gx, gy: peca.gy };
    paredePecaIx = idx;
    gravarEstado(estado);
    pintarListaParede();
    pintarCamadasLocais();
    desenharPalco();
  }

  /** Hit-test: face de parede sob o ponto ou null (cai no piso). */
  function destinoDoPonto(px, py, preferWall) {
    const face = faceSobPonto(px, py);
    if (face && (preferWall || preferWall == null)) {
      // Se o ponto esta claramente na silhueta da parede, prioriza anexo.
      return { tipo: 'parede', face };
    }
    const g = telaParaGrade(px, py, true);
    if (g.gx < 0 || g.gx >= gradeW() || g.gy < 0 || g.gy >= gradeH()) {
      if (face) return { tipo: 'parede', face };
      return null;
    }
    // Proximidade as arestas NW: se qx/qy perto da borda oeste/norte, vira parede.
    if (!preferWall && face) {
      const nearL = g.gx === 0 && (g.qx || 0) < 0.35;
      const nearR = g.gy === 0 && (g.qy || 0) < 0.35;
      if ((face.face === 'L' && nearL) || (face.face === 'R' && nearR)) {
        return { tipo: 'parede', face };
      }
    }
    if (preferWall && face) return { tipo: 'parede', face };
    return { tipo: 'piso', celula: g };
  }

  function plantarNoPonto(spec, px, py, snap) {
    if (!spec) return;
    if (estado.combinando) {
      adicionarAoCompose(spec);
      return;
    }
    const preferWall = spec.papel === 'wall';
    const dest = destinoDoPonto(px, py, preferWall ? true : false);
    if (!dest) return;
    if (dest.tipo === 'parede' || (preferWall && dest.tipo === 'parede')) {
      const face = dest.face || faceSobPonto(px, py);
      if (!face) return;
      marcarUndo();
      estado.modoPlantar = 'parede';
      estado.paredeSel = face;
      estado.palco.push({
        assetId: spec.assetId,
        papel: 'wall',
        face: face.face,
        gx: face.gx,
        gy: face.gy,
        dx: 0,
        dy: dyInicialParede(spec.assetId),
        espelhado: false,
      });
      paredePecaIx = estado.palco.length - 1;
      if (spec.fileName) bboxDe(spec.fileName).catch(() => undefined);
      desenharPalco();
      return;
    }
    if (spec.papel === 'wall') {
      // Wall asset dropado no meio: ancora na face mais proxima.
      const face = faceSobPonto(px, py) || { face: 'R', gx: dest.celula.gx, gy: 0 };
      marcarUndo();
      estado.paredeSel = face;
      estado.palco.push({
        assetId: spec.assetId,
        papel: 'wall',
        face: face.face,
        gx: face.gx,
        gy: face.gy,
        dx: 0,
        dy: dyInicialParede(spec.assetId),
        espelhado: false,
      });
      paredePecaIx = estado.palco.length - 1;
      desenharPalco();
      return;
    }
    marcarUndo();
    estado.modoPlantar = 'piso';
    const sel = dest.celula;
    estado.celula = sel;
    const alvo = {
      assetId: spec.assetId,
      gx: sel.gx,
      gy: sel.gy,
      qx: 0,
      qy: 0,
      passo: 1,
      dx: 0,
      dy: 0,
    };
    if (spec.papel === 'decor') alvo.papel = 'decor';
    if (snap) {
      // Shift: snap legado aos quartis da celula (sem offset livre).
      alvo.qx = sel.qx || 0;
      alvo.qy = sel.qy || 0;
      alvo.passo = 0.5;
    } else {
      const off = offsetPisoDoPonto(px, py, sel.gx, sel.gy);
      alvo.dx = off.dx;
      alvo.dy = off.dy;
    }
    estado.palco.push(alvo);
    paredePecaIx = estado.palco.length - 1;
    desenharPalco();
  }

  function vizinhosRelevantes(idx) {
    const peca = estado.palco[idx];
    if (!peca) return [];
    const out = [];
    for (let i = 0; i < estado.palco.length; i++) {
      if (i === idx) continue;
      const o = estado.palco[i];
      if (itemEParede(peca) && itemEParede(o)) {
        if (mesmaFace(peca, o)) out.push(i);
        continue;
      }
      if (!itemEParede(peca) && !itemEParede(o)) {
        if (Math.abs(peca.gx - o.gx) <= 1 && Math.abs(peca.gy - o.gy) <= 1) out.push(i);
      }
    }
    return out;
  }

  function moverPecaPalco(idx, dir) {
    if (idx < 0 || idx >= estado.palco.length) return;
    const j = idx + dir;
    if (j < 0 || j >= estado.palco.length) return;
    marcarUndo();
    const tmp = estado.palco[idx];
    estado.palco[idx] = estado.palco[j];
    estado.palco[j] = tmp;
    paredePecaIx = j;
    gravarEstado(estado);
    pintarListaParede();
    pintarCamadasLocais();
    desenharPalco();
  }

  function pintarCamadasLocais() {
    const wrap = document.getElementById('camadas-locais');
    const root = document.getElementById('lista-camadas-locais');
    if (!wrap || !root) return;
    if (estado.combinando || paredePecaIx < 0 || !estado.palco[paredePecaIx]) {
      wrap.hidden = true;
      root.innerHTML = '';
      return;
    }
    const viz = vizinhosRelevantes(paredePecaIx);
    wrap.hidden = false;
    root.innerHTML = '';
    const self = estado.palco[paredePecaIx];
    const selfSpec = specPorId(self.assetId);
    const chipSelf = document.createElement('div');
    chipSelf.className = 'chip sel';
    const nomeSelf = document.createElement('span');
    nomeSelf.textContent = (selfSpec ? selfSpec.nome : self.assetId) + ' (selecionado)';
    const rmSelf = document.createElement('button');
    rmSelf.type = 'button';
    rmSelf.textContent = 'remover';
    rmSelf.title = 'Remove a peca selecionada (Delete / Ctrl+Del)';
    rmSelf.addEventListener('click', (ev) => {
      ev.stopPropagation();
      removerPecaPalco(paredePecaIx);
    });
    chipSelf.appendChild(nomeSelf);
    chipSelf.appendChild(rmSelf);
    root.appendChild(chipSelf);
    for (const i of viz) {
      const p = estado.palco[i];
      const s = specPorId(p.assetId);
      const chip = document.createElement('div');
      chip.className = 'chip';
      const nome = document.createElement('span');
      nome.textContent = s ? s.nome : p.assetId;
      const atras = document.createElement('button');
      atras.type = 'button';
      atras.textContent = 'atras';
      atras.addEventListener('click', () => {
        // Move vizinho para antes do selecionado (atras no painter se idx menor).
        if (i > paredePecaIx) moverPecaPalco(i, paredePecaIx - i);
        else moverPecaPalco(paredePecaIx, 1);
      });
      const frente = document.createElement('button');
      frente.type = 'button';
      frente.textContent = 'frente';
      frente.addEventListener('click', () => {
        if (i < paredePecaIx) moverPecaPalco(i, paredePecaIx - i);
        else moverPecaPalco(paredePecaIx, -1);
      });
      chip.appendChild(nome);
      chip.appendChild(atras);
      chip.appendChild(frente);
      root.appendChild(chip);
    }
  }

  function limparSelecaoEditor() {
    if (estado.combinando) {
      if (composeSel < 0) return false;
      composeSel = -1;
      pintarListaCamadas();
      desenharCompose();
      return true;
    }
    if (paredePecaIx < 0) return false;
    paredePecaIx = -1;
    pintarListaParede();
    pintarCamadasLocais();
    desenharPalco();
    return true;
  }

  function nudgeAnexoSelecionado(ddx, ddy) {
    if (estado.combinando || paredePecaIx < 0) return false;
    const peca = estado.palco[paredePecaIx];
    if (!peca || !itemEParede(peca)) return false;
    marcarUndo();
    peca.dx = (peca.dx || 0) + ddx;
    peca.dy = (peca.dy || 0) + ddy;
    gravarEstado(estado);
    pintarListaParede();
    pintarCamadasLocais();
    desenharPalco();
    return true;
  }

  function setBookOpen(on) {
    bookAberto = !!on;
    document.body.classList.toggle('book-open', bookAberto);
    const edge = document.getElementById('btn-book-edge');
    const top = document.getElementById('btn-toggle-book');
    if (edge) edge.classList.toggle('ativo', bookAberto);
    if (top) top.classList.toggle('ativo', bookAberto);
  }

  const IFRAME_FRAMES = {
    none: { assetId: null, inset: { u0: 0, v0: 0, u1: 1, v1: 1 }, span: 2, heightPx: 44, sw: 96, sh: 48 },
    tv: { assetId: 'office-tv-off', inset: { u0: 0.18, v0: 0.22, u1: 0.82, v1: 0.72 }, span: 1, heightPx: 28, sw: 64, sh: 48 },
    'big-tv': { assetId: 'big-tv-off', inset: { u0: 0.12, v0: 0.18, u1: 0.88, v1: 0.78 }, span: 2, heightPx: 40, sw: 96, sh: 72 },
    cork: { assetId: 'corkboard-2', inset: { u0: 0.14, v0: 0.16, u1: 0.86, v1: 0.84 }, span: 1, heightPx: 36, sw: 64, sh: 56 },
    screen: { assetId: 'projector-screen', inset: { u0: 0.1, v0: 0.12, u1: 0.9, v1: 0.82 }, span: 3, heightPx: 48, sw: 96, sh: 64 },
    'tv-3x': { assetId: 'created-wall-tv-3x', inset: { u0: 0.08, v0: 0.1, u1: 0.92, v1: 0.88 }, span: 3, heightPx: 100, sw: 192, sh: 100 },
    'tv-4x': { assetId: 'created-wall-tv-4x', inset: { u0: 0.08, v0: 0.1, u1: 0.92, v1: 0.88 }, span: 4, heightPx: 100, sw: 256, sh: 100 },
    'tv-war': { assetId: 'created-wall-tv-war', inset: { u0: 0.06, v0: 0.08, u1: 0.94, v1: 0.9 }, span: 6, heightPx: 120, sw: 384, sh: 120 },
    'cork-wide': { assetId: 'created-cork-wide', inset: { u0: 0.1, v0: 0.12, u1: 0.9, v1: 0.88 }, span: 3, heightPx: 72, sw: 192, sh: 72 },
    'cork-tall': { assetId: 'created-cork-tall', inset: { u0: 0.12, v0: 0.1, u1: 0.88, v1: 0.9 }, span: 2, heightPx: 110, sw: 128, sh: 110 },
  };

  function insetParaCantos(inset) {
    const u0 = Math.min(inset.u0, inset.u1);
    const u1 = Math.max(inset.u0, inset.u1);
    const v0 = Math.min(inset.v0, inset.v1);
    const v1 = Math.max(inset.v0, inset.v1);
    return {
      tl: { u: u0, v: v0 },
      tr: { u: u1, v: v0 },
      br: { u: u1, v: v1 },
      bl: { u: u0, v: v1 },
    };
  }

  function cantosDaMidia(mid) {
    if (mid.screenCorners) return mid.screenCorners;
    const preset = IFRAME_FRAMES[mid.frame] || IFRAME_FRAMES.none;
    return insetParaCantos(mid.screenInset || preset.inset);
  }

  function gradeApartirCantosLab(corners, cols = 3, rows = 3) {
    const points = [];
    for (let r = 0; r < rows; r++) {
      const tv = r / (rows - 1);
      for (let c = 0; c < cols; c++) {
        const tu = c / (cols - 1);
        const topU = corners.tl.u + (corners.tr.u - corners.tl.u) * tu;
        const topV = corners.tl.v + (corners.tr.v - corners.tl.v) * tu;
        const botU = corners.bl.u + (corners.br.u - corners.bl.u) * tu;
        const botV = corners.bl.v + (corners.br.v - corners.bl.v) * tu;
        points.push({ u: topU + (botU - topU) * tv, v: topV + (botV - topV) * tv });
      }
    }
    return { cols, rows, points };
  }

  /** Ix da midia em calibracao; null = off. */
  let iframeCalibIx = null;
  /** Handle ativo: 'tl'|'tr'|'br'|'bl' | 'w:r:c' */
  let iframeCalibHandle = null;
  /** Preview raster no palco: mediaId → { kind, source, status } */
  const nestPreviewCache = new Map();
  let nestVideoRaf = 0;
  let nestVideoTabAtiva = false;

  if (!Array.isArray(estado.wallMedia)) estado.wallMedia = [];

  function statusPreviewChip(m) {
    const st = m._previewStatus || nestPreviewCache.get(m.mediaId)?.status;
    if (st === 'ok') return '✓';
    if (st === 'loading') return '…';
    if (st === 'erro') return '!';
    return '–';
  }

  function urlPareceImagemLab(url) {
    if (!url) return false;
    if (url.startsWith('data:image/')) return true;
    if (/\.(png|jpe?g|gif|webp|bmp|svg|avif)(\?|#|$)/i.test(url)) return true;
    // CDNs / hotlink sem extensao no path (Google Images, etc.)
    if (
      /(?:^|[/.])(?:gstatic|googleusercontent|ggpht|twimg|imgur|unsplash|images\.unsplash|cloudinary|imgix|pinimg|fbcdn|cdninstagram|wikimedia|ytimg)\./i.test(
        url,
      )
    ) {
      return true;
    }
    if (/[?&](format|fm|imgfmt)=(jpg|jpeg|png|webp|gif)/i.test(url)) return true;
    if (/\/(?:image|images|img|photo|photos|media)\//i.test(url) && /^https?:/i.test(url)) return true;
    return false;
  }

  function urlPareceVideoLab(url) {
    if (!url) return false;
    if (url.startsWith('data:video/')) return true;
    return /\.(mp4|webm|ogg)(\?|#|$)/i.test(url);
  }

  function detectarTipoPreview(url, display) {
    const u = (url || '').trim();
    if (!u || u === 'about:blank') return 'placeholder';
    if (/#chart|chart-demo/i.test(u)) return 'chart';
    if (/#table|table-demo/i.test(u)) return 'table';
    if (parseYoutubeUrl(u)) return 'youtube';
    if (display === 'image' || urlPareceImagemLab(u)) return 'image';
    if (urlPareceVideoLab(u)) return 'video';
    return 'page';
  }

  /**
   * Extrai id + start de youtube.com / youtu.be / shorts / embed.
   * Ex.: https://www.youtube.com/watch?v=OkNo_N85em0&t=3067s
   */
  function parseYoutubeUrl(url) {
    try {
      const u = new URL(url.trim());
      const host = u.hostname.replace(/^www\./, '');
      if (
        host !== 'youtube.com' &&
        host !== 'm.youtube.com' &&
        host !== 'music.youtube.com' &&
        host !== 'youtu.be' &&
        host !== 'youtube-nocookie.com'
      ) {
        return null;
      }
      let id = null;
      if (host === 'youtu.be') {
        id = u.pathname.replace(/^\//, '').split('/')[0] || null;
      } else if (u.pathname.startsWith('/embed/') || u.pathname.startsWith('/shorts/') || u.pathname.startsWith('/live/')) {
        id = u.pathname.split('/')[2] || null;
      } else {
        id = u.searchParams.get('v');
      }
      if (!id || !/^[\w-]{6,32}$/.test(id)) return null;

      let start = 0;
      const tRaw = u.searchParams.get('t') || u.searchParams.get('start') || '';
      if (/^\d+$/.test(tRaw)) {
        start = Number(tRaw);
      } else if (tRaw) {
        const m = tRaw.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/i);
        if (m) {
          start =
            (Number(m[1]) || 0) * 3600 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0);
        }
      }
      // Hash #t=1m30s
      const hashT = (u.hash || '').match(/t=([^&]+)/);
      if (hashT && !start) {
        const ht = hashT[1];
        if (/^\d+$/.test(ht)) start = Number(ht);
        else {
          const m = ht.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/i);
          if (m) {
            start =
              (Number(m[1]) || 0) * 3600 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0);
          }
        }
      }

      return {
        id,
        start,
        thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        thumbMax: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
        embed:
          `https://www.youtube.com/embed/${id}?` +
          `start=${start}&autoplay=1&mute=1&rel=0&modestbranding=1&playsinline=1`,
      };
    } catch {
      return null;
    }
  }

  const NEST_LIVE_W = 320;
  const NEST_LIVE_H = 180;

  function nestLiveHost() {
    return document.getElementById('nest-live-overlay');
  }

  function solveLinear8Lab(A, B) {
    const n = 8;
    const M = A.map((row, i) => [...row, B[i]]);
    for (let col = 0; col < n; col++) {
      let piv = col;
      for (let r = col + 1; r < n; r++) {
        if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
      }
      [M[col], M[piv]] = [M[piv], M[col]];
      const diag = M[col][col];
      if (Math.abs(diag) < 1e-12) continue;
      for (let c = col; c <= n; c++) M[col][c] /= diag;
      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const f = M[r][col];
        for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
      }
    }
    return M.map((row) => row[n]);
  }

  function homografiaMatrix3dLab(srcW, srcH, dst) {
    const s = [
      { x: 0, y: 0 },
      { x: srcW, y: 0 },
      { x: srcW, y: srcH },
      { x: 0, y: srcH },
    ];
    const d = [dst.tl, dst.tr, dst.br, dst.bl];
    const A = [];
    const B = [];
    for (let i = 0; i < 4; i++) {
      const { x, y } = s[i];
      const { x: u, y: v } = d[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
      B.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
      B.push(v);
    }
    const h8 = solveLinear8Lab(A, B);
    const a = h8[0];
    const b = h8[1];
    const c = h8[2];
    const d0 = h8[3];
    const e = h8[4];
    const f = h8[5];
    const g = h8[6];
    const hh = h8[7];
    const i = 1;
    return `matrix3d(${a},${d0},0,${g}, ${b},${e},0,${hh}, 0,0,1,0, ${c},${f},0,${i})`;
  }

  function criarYoutubeIframe(yt) {
    const el = document.createElement('iframe');
    el.title = `YouTube ${yt.id}`;
    el.src = yt.embed;
    el.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    el.allowFullscreen = true;
    el.referrerPolicy = 'strict-origin-when-cross-origin';
    el.width = String(NEST_LIVE_W);
    el.height = String(NEST_LIVE_H);
    el.style.width = `${NEST_LIVE_W}px`;
    el.style.height = `${NEST_LIVE_H}px`;
    el.style.pointerEvents = 'auto';
    return el;
  }

  function syncNestLiveOverlays() {
    const host = nestLiveHost();
    const cv = document.getElementById('palco');
    if (!host || !cv || cv.hidden) {
      if (host) host.querySelectorAll('iframe').forEach((el) => { el.style.display = 'none'; });
      return;
    }
    const sx = cv.clientWidth / cv.width;
    const sy = cv.clientHeight / cv.height;
    const seen = new Set();

    for (let mi = 0; mi < (estado.wallMedia || []).length; mi++) {
      const mid = estado.wallMedia[mi];
      if (!mid?.face) continue;
      const entry = nestPreviewCache.get(mid.mediaId);
      if (!entry || entry.kind !== 'youtube' || !entry.iframe) continue;
      seen.add(mid.mediaId);
      const el = entry.iframe;
      if (!el.parentElement) host.appendChild(el);

      const calibrando = mi === iframeCalibIx;
      if (calibrando) {
        el.style.display = 'none';
        continue;
      }
      el.style.display = 'block';

      const preset = IFRAME_FRAMES[mid.frame] || IFRAME_FRAMES.none;
      const pe = peDaFace(mid.face);
      const v = verticeDaFace(mid.face, mid.gx, mid.gy);
      const topLeft = posBlitVertice(v.vx, v.vy, pe, mid.dx || 0, mid.dy || 0);
      let sw;
      let sh;
      if (mid.frame && mid.frame !== 'none') {
        sw = preset.sw;
        sh = preset.sh;
      } else {
        const span = mid.size?.w || preset.span;
        sw = span * (LARGURA_TILE / 2);
        sh = mid.heightPx || preset.heightPx;
      }
      const corners = cantosDaMidia(mid);
      const pt = (p) => ({
        x: (topLeft.x + p.u * sw) * sx,
        y: (topLeft.y + p.v * sh) * sy,
      });
      const cssQ = {
        tl: pt(corners.tl),
        tr: pt(corners.tr),
        br: pt(corners.br),
        bl: pt(corners.bl),
      };
      el.style.transform = homografiaMatrix3dLab(NEST_LIVE_W, NEST_LIVE_H, cssQ);
      el.dataset.mediaId = mid.mediaId;
    }

    host.querySelectorAll('iframe').forEach((el) => {
      const id = el.dataset.mediaId;
      if (id && !seen.has(id)) el.remove();
    });
  }

  /** Carrega imagem para blit no Lab. Prefere sem CORS (tainted ok para preview). */
  async function carregarImagemLab(url) {
    const load = (useCors) =>
      new Promise((resolve, reject) => {
        const img = new Image();
        if (useCors) img.crossOrigin = 'anonymous';
        img.decoding = 'async';
        img.onload = () => {
          if (!img.naturalWidth) reject(new Error('empty'));
          else resolve(img);
        };
        img.onerror = () => reject(new Error('img'));
        img.src = url;
      });

    // 1) Sem CORS — funciona com gstatic/hotlink e ainda desenha no canvas.
    try {
      return await load(false);
    } catch {
      /* try next */
    }
    // 2) Com CORS (CDN que permite).
    try {
      return await load(true);
    } catch {
      /* try next */
    }
    // 3) fetch → blob (mesma origem / proxies permissivos).
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error('fetch');
    const blob = await res.blob();
    if (!blob.type.startsWith('image/') && blob.type !== 'application/octet-stream') {
      throw new Error('not-image');
    }
    const objUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = () => reject(new Error('blob'));
        im.src = objUrl;
      });
      return img;
    } finally {
      setTimeout(() => URL.revokeObjectURL(objUrl), 60_000);
    }
  }

  function criarCanvasDemoChart() {
    const c = document.createElement('canvas');
    c.width = 320;
    c.height = 180;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 320, 180);
    g.addColorStop(0, '#061018');
    g.addColorStop(1, '#0d2233');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 320, 180);
    const hs = [60, 80, 100, 70, 110, 85, 95];
    ctx.fillStyle = '#3d8bfd';
    hs.forEach((h, i) => {
      const x = 24 + i * 40;
      ctx.fillRect(x, 160 - h, 28, h);
    });
    ctx.fillStyle = '#7dd3fc';
    ctx.font = '14px monospace';
    ctx.fillText('EURUSD · M5 demo', 16, 28);
    return c;
  }

  function criarCanvasDemoTable() {
    const c = document.createElement('canvas');
    c.width = 320;
    c.height = 180;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0a1210';
    ctx.fillRect(0, 0, 320, 180);
    ctx.strokeStyle = '#2a3a34';
    ctx.fillStyle = '#9ae6b4';
    ctx.font = '12px monospace';
    const rows = [
      ['Symbol', 'Bid', 'Ask'],
      ['EURUSD', '1.0842', '1.0844'],
      ['XAUUSD', '2341', '2342'],
      ['BTC', '64210', '64240'],
    ];
    rows.forEach((r, i) => {
      const y = 28 + i * 36;
      ctx.strokeRect(12, y - 16, 296, 32);
      ctx.fillText(r[0], 20, y);
      ctx.fillText(r[1], 120, y);
      ctx.fillText(r[2], 220, y);
    });
    return c;
  }

  function criarCanvasPlaceholder(url, erro) {
    const c = document.createElement('canvas');
    c.width = 320;
    c.height = 180;
    const ctx = c.getContext('2d');
    ctx.fillStyle = erro ? '#2a1010' : '#0a1620';
    ctx.fillRect(0, 0, 320, 180);
    ctx.fillStyle = erro ? '#f87171' : '#7dd3fc';
    ctx.font = '13px monospace';
    ctx.fillText(erro ? 'PREVIEW ERRO' : 'SCREEN ON', 16, 40);
    ctx.fillStyle = '#5a7a6a';
    ctx.font = '11px monospace';
    let host = url || '';
    try {
      host = new URL(url, 'https://local.test').hostname || url.slice(0, 40);
    } catch {
      host = String(url).slice(0, 40);
    }
    ctx.fillText(host, 16, 70);
    ctx.fillText(erro ? 'CORS / URL invalida' : 'Cole URL .png/.jpg ou #chart', 16, 100);
    return c;
  }

  function sourcePronto(entry) {
    if (!entry || !entry.source) return false;
    if (entry.kind === 'image' || entry.kind === 'youtube') {
      const s = entry.source;
      if (s instanceof HTMLCanvasElement) return true;
      return s.complete && s.naturalWidth > 0;
    }
    if (entry.kind === 'video') return entry.source.readyState >= 2;
    return true; // canvas chart/table/placeholder
  }

  function blitNestTriangulo(ctx, img, iw, ih, u0, v0, u1, v1, u2, v2, p0, p1, p2) {
    const x0 = u0 * iw;
    const y0 = v0 * ih;
    const x1 = u1 * iw;
    const y1 = v1 * ih;
    const x2 = u2 * iw;
    const y2 = v2 * ih;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.closePath();
    ctx.clip();
    const denom = x0 * (y1 - y2) + x1 * (y2 - y0) + x2 * (y0 - y1);
    if (Math.abs(denom) < 1e-6) {
      ctx.restore();
      return;
    }
    const m11 = (p0.x * (y1 - y2) + p1.x * (y2 - y0) + p2.x * (y0 - y1)) / denom;
    const m12 = (p0.x * (x2 - x1) + p1.x * (x0 - x2) + p2.x * (x1 - x0)) / denom;
    const m13 =
      (p0.x * (x1 * y2 - x2 * y1) + p1.x * (x2 * y0 - x0 * y2) + p2.x * (x0 * y1 - x1 * y0)) / denom;
    const m21 = (p0.y * (y1 - y2) + p1.y * (y2 - y0) + p2.y * (y0 - y1)) / denom;
    const m22 = (p0.y * (x2 - x1) + p1.y * (x0 - x2) + p2.y * (x1 - x0)) / denom;
    const m23 =
      (p0.y * (x1 * y2 - x2 * y1) + p1.y * (x2 * y0 - x0 * y2) + p2.y * (x0 * y1 - x1 * y0)) / denom;
    ctx.transform(m11, m21, m12, m22, m13, m23);
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }

  function blitNestWarp(ctx, source, cornersUv, topLeft, sw, sh, warpGrid, blendMode) {
    let img = source;
    let iw;
    let ih;
    if (source instanceof HTMLVideoElement) {
      iw = source.videoWidth || 320;
      ih = source.videoHeight || 180;
      img = source;
    } else if (source instanceof HTMLCanvasElement) {
      iw = source.width;
      ih = source.height;
      img = source;
    } else {
      iw = source.naturalWidth || source.width;
      ih = source.naturalHeight || source.height;
    }
    if (!iw || !ih) return;

    const uvPt = (p) => ({ x: topLeft.x + p.u * sw, y: topLeft.y + p.v * sh });
    // Mesh mais densa = borda mais limpa quando o nest e pequeno.
    const grid = warpGrid || gradeApartirCantosLab(cornersUv, 4, 4);
    const { cols, rows, points } = grid;
    if (!points || points.length < cols * rows) return;

    const prev = ctx.globalCompositeOperation;
    const prevSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
    // Default opaco/nitido (nao holograma). screen soh se escolhido.
    if (blendMode === 'screen') ctx.globalCompositeOperation = 'screen';
    else if (blendMode === 'linear-dodge') ctx.globalCompositeOperation = 'lighter';
    else ctx.globalCompositeOperation = 'source-over';

    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const p00 = uvPt(points[r * cols + c]);
        const p10 = uvPt(points[r * cols + (c + 1)]);
        const p01 = uvPt(points[(r + 1) * cols + c]);
        const p11 = uvPt(points[(r + 1) * cols + (c + 1)]);
        const u0 = c / (cols - 1);
        const u1 = (c + 1) / (cols - 1);
        const v0 = r / (rows - 1);
        const v1 = (r + 1) / (rows - 1);
        blitNestTriangulo(ctx, img, iw, ih, u0, v0, u1, v0, u0, v1, p00, p10, p01);
        blitNestTriangulo(ctx, img, iw, ih, u1, v0, u1, v1, u0, v1, p10, p11, p01);
      }
    }
    ctx.globalCompositeOperation = prev;
    ctx.imageSmoothingEnabled = prevSmooth;
  }

  function limparPreviewMidia(mediaId) {
    const old = nestPreviewCache.get(mediaId);
    if (old?.kind === 'video' && old.source) {
      try {
        old.source.pause();
        old.source.removeAttribute('src');
        old.source.load();
      } catch {
        /* ignore */
      }
    }
    if (old?.iframe) {
      try {
        old.iframe.remove();
      } catch {
        /* ignore */
      }
    }
    nestPreviewCache.delete(mediaId);
  }

  function temVideoPreviewAtivo() {
    for (const e of nestPreviewCache.values()) {
      if (e.kind === 'video' && e.status === 'ok') return true;
    }
    return false;
  }

  function pararNestVideoRaf() {
    if (nestVideoRaf) {
      cancelAnimationFrame(nestVideoRaf);
      nestVideoRaf = 0;
    }
  }

  function garantirNestVideoRaf() {
    if (!nestVideoTabAtiva || !temVideoPreviewAtivo()) {
      pararNestVideoRaf();
      return;
    }
    if (nestVideoRaf) return;
    const tick = () => {
      nestVideoRaf = 0;
      if (!nestVideoTabAtiva || !temVideoPreviewAtivo()) return;
      desenharPalco();
      nestVideoRaf = requestAnimationFrame(tick);
    };
    nestVideoRaf = requestAnimationFrame(tick);
  }

  async function aplicarPreviewNest(ix, opts = {}) {
    const mid = estado.wallMedia[ix];
    if (!mid) return;
    const urlInput = document.querySelector(`[data-iframe-url="${ix}"]`);
    if (urlInput && typeof urlInput.value === 'string') {
      mid.url = urlInput.value.trim();
    }
    const url = (mid.url || '').trim();
    limparPreviewMidia(mid.mediaId);
    mid._previewStatus = 'loading';
    if (!opts.silentList) atualizarListaIframe();

    const tipo = detectarTipoPreview(url, mid.display);
    const blendSel = document.getElementById('iframe-blend')?.value;
    if (blendSel === 'normal' || blendSel === 'screen' || blendSel === 'linear-dodge') {
      mid.blendMode = blendSel;
    } else if (!mid.blendMode || mid.blendMode === 'screen') {
      // Migrar default antigo (screen/holograma) → opaco nitido.
      mid.blendMode = 'normal';
    }
    const setOk = (kind, source, extra = {}) => {
      nestPreviewCache.set(mid.mediaId, { kind, source, status: 'ok', url, ...extra });
      mid._previewStatus = 'ok';
      mid.previewApplied = true;
      // Aplicar esconde barras/handles; chip do nest reabre calibracao.
      if (iframeCalibIx === ix) iframeCalibIx = null;
      if (!opts.silentList) atualizarListaIframe();
      desenharPalco();
      garantirNestVideoRaf();
    };
    const setErro = (msg) => {
      const ph = criarCanvasPlaceholder(url, true);
      nestPreviewCache.set(mid.mediaId, { kind: 'placeholder', source: ph, status: 'erro', url });
      mid._previewStatus = 'erro';
      if (!opts.silentList) atualizarListaIframe();
      desenharPalco();
      const hint = document.getElementById('iframe-hint');
      if (hint) hint.textContent = msg || 'Falha ao carregar preview (CORS/rede).';
    };

    try {
      if (tipo === 'chart') {
        setOk('chart', criarCanvasDemoChart());
        return;
      }
      if (tipo === 'table') {
        setOk('table', criarCanvasDemoTable());
        return;
      }
      if (tipo === 'youtube') {
        const yt = parseYoutubeUrl(url);
        if (!yt) {
          setErro('URL YouTube invalida.');
          return;
        }
        let thumb;
        try {
          thumb = await carregarImagemLab(yt.thumbMax);
        } catch {
          try {
            thumb = await carregarImagemLab(yt.thumb);
          } catch {
            thumb = criarCanvasPlaceholder(url, false);
          }
        }
        const iframe = criarYoutubeIframe(yt);
        iframe.dataset.mediaId = mid.mediaId;
        const host = nestLiveHost();
        if (host) host.appendChild(iframe);
        setOk('youtube', thumb, { iframe, yt });
        const hint = document.getElementById('iframe-hint');
        if (hint) {
          hint.textContent = `YouTube ${yt.id}` + (yt.start ? ` @ ${yt.start}s` : '') + ' — player ao vivo no nest.';
        }
        return;
      }
      if (tipo === 'image') {
        try {
          const img = await carregarImagemLab(url);
          setOk('image', img);
        } catch {
          setErro(
            'Imagem nao carregou (CORS ou URL invalida). Use data:image/…, arquivo local servido, ou #chart.',
          );
        }
        return;
      }
      if (tipo === 'page' || tipo === 'placeholder') {
        setOk('placeholder', criarCanvasPlaceholder(url, false));
        return;
      }
      if (tipo === 'video') {
        const vid = document.createElement('video');
        vid.muted = true;
        vid.loop = true;
        vid.playsInline = true;
        vid.preload = 'auto';
        await new Promise((resolve, reject) => {
          vid.onloadeddata = () => resolve();
          vid.onerror = () => reject(new Error('video'));
          vid.src = url;
        });
        try {
          await vid.play();
        } catch {
          /* autoplay */
        }
        setOk('video', vid);
        return;
      }
      setOk('placeholder', criarCanvasPlaceholder(url, false));
    } catch {
      setErro('Nao foi possivel carregar a URL (tente data: / YouTube / #chart).');
    }
  }

  function salvarUrlNest(ix) {
    const mid = estado.wallMedia[ix];
    if (!mid) return;
    const urlInput = document.querySelector(`[data-iframe-url="${ix}"]`);
    const url = urlInput ? urlInput.value.trim() : mid.url;
    marcarUndo();
    mid.url = url;
    gravarEstado(estado);
    const hint = document.getElementById('iframe-hint');
    if (hint) hint.textContent = 'URL salva. Clique Aplicar para renderizar no canvas.';
    atualizarListaIframe();
  }

  function autoAplicarPreviewsNest() {
    const lista = estado.wallMedia || [];
    lista.forEach((m, i) => {
      const url = (m.url || '').trim();
      if (!url || url === 'about:blank') return;
      const tipo = detectarTipoPreview(url, m.display);
      const deve =
        m.previewApplied ||
        tipo === 'image' ||
        tipo === 'video' ||
        tipo === 'youtube' ||
        tipo === 'chart' ||
        tipo === 'table';
      if (!deve) return;
      void aplicarPreviewNest(i, { silentList: true }).then(() => {
        atualizarListaIframe();
        garantirNestVideoRaf();
      });
    });
  }

  function atualizarListaIframe() {
    const ul = document.getElementById('iframe-lista');
    if (!ul) return;
    const lista = estado.wallMedia || [];
    if (!lista.length) {
      ul.innerHTML = '<li class="nota">Nenhuma midia no palco.</li>';
      return;
    }
    ul.innerHTML = lista
      .map((m, i) => {
        const st = statusPreviewChip(m);
        const urlEsc = String(m.url || '')
          .replace(/&/g, '&amp;')
          .replace(/"/g, '&quot;')
          .replace(/</g, '&lt;');
        return (
          `<li class="iframe-lista-item">` +
          `<div class="iframe-lista-top">` +
          `<button type="button" data-iframe-ix="${i}" class="chip-filter${iframeCalibIx === i ? ' ativo' : ''}">` +
          `${st} ${m.frame || 'none'} · ${m.display || 'auto'} · ${m.face} ${m.gx},${m.gy}` +
          `</button>` +
          `<button type="button" data-iframe-url-save="${i}" title="Salvar URL">URL</button>` +
          `<button type="button" data-iframe-apply="${i}" title="Aplicar no canvas">Aplicar</button>` +
          `<button type="button" data-iframe-rm="${i}">x</button>` +
          `</div>` +
          `<input type="url" data-iframe-url="${i}" class="iframe-url-row" value="${urlEsc}" placeholder="https://… · data:image/… · #chart · #table" />` +
          `</li>`
        );
      })
      .join('');
    ul.querySelectorAll('[data-iframe-ix]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const ix = Number(btn.getAttribute('data-iframe-ix'));
        // Clique no chip: reabre barras/handles de calibracao desse nest.
        iframeCalibIx = iframeCalibIx === ix ? null : ix;
        atualizarListaIframe();
        desenharPalco();
      });
    });
    ul.querySelectorAll('[data-iframe-url-save]').forEach((btn) => {
      btn.addEventListener('click', () => {
        salvarUrlNest(Number(btn.getAttribute('data-iframe-url-save')));
      });
    });
    ul.querySelectorAll('[data-iframe-apply]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const ix = Number(btn.getAttribute('data-iframe-apply'));
        marcarUndo();
        void aplicarPreviewNest(ix).then(() => {
          gravarEstado(estado);
        });
      });
    });
    ul.querySelectorAll('[data-iframe-rm]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const ix = Number(btn.getAttribute('data-iframe-rm'));
        marcarUndo();
        const mid = estado.wallMedia[ix];
        if (mid) limparPreviewMidia(mid.mediaId);
        estado.wallMedia.splice(ix, 1);
        if (iframeCalibIx === ix) iframeCalibIx = null;
        else if (iframeCalibIx != null && iframeCalibIx > ix) iframeCalibIx -= 1;
        if (mid && mid.mountAssetId) {
          const mi = estado.palco.findIndex(
            (p) =>
              itemEParede(p) &&
              p.assetId === mid.mountAssetId &&
              p.face === mid.face &&
              p.gx === mid.gx &&
              p.gy === mid.gy,
          );
          if (mi >= 0) estado.palco.splice(mi, 1);
        }
        atualizarListaIframe();
        desenharPalco();
        gravarEstado(estado);
        garantirNestVideoRaf();
      });
    });
  }

  function plantarIframeNaParede() {
    const face = estado.paredeSel || { face: 'R', gx: estado.celula?.gx || 0, gy: 0 };
    if (!face) {
      const hint = document.getElementById('iframe-hint');
      if (hint) hint.textContent = 'Clique numa face de parede no palco antes de plantar.';
      return;
    }
    const frame = document.getElementById('iframe-frame')?.value || 'none';
    const url = document.getElementById('iframe-url')?.value?.trim() || 'about:blank';
    const span = clampInt(document.getElementById('iframe-span')?.value, 1, 16) || 2;
    const heightPx = clampInt(document.getElementById('iframe-height')?.value, 16, 480) || 44;
    const display = document.getElementById('iframe-display')?.value || 'auto';
    const blendMode = document.getElementById('iframe-blend')?.value || 'normal';
    const preset = IFRAME_FRAMES[frame] || IFRAME_FRAMES.none;
    marcarUndo();
    const mediaId = `wm-iframe-${Date.now().toString(36)}`;
    const corners = insetParaCantos(preset.inset);
    const entry = {
      mediaId,
      kind: 'iframe',
      url,
      frame,
      mountAssetId: preset.assetId || undefined,
      nestAssetId: preset.assetId || undefined,
      face: face.face,
      gx: face.gx,
      gy: face.gy,
      dx: 0,
      dy: dyInicialParede(preset.assetId || 'office-tv-off'),
      size: { w: frame === 'none' ? span : preset.span, h: 1 },
      heightPx: frame === 'none' ? heightPx : preset.heightPx,
      screenInset: { ...preset.inset },
      screenCorners: corners,
      display,
      blendMode,
    };
    if (preset.assetId) {
      estado.palco.push({
        assetId: preset.assetId,
        papel: 'wall',
        face: face.face,
        gx: face.gx,
        gy: face.gy,
        dx: entry.dx,
        dy: entry.dy,
        espelhado: false,
      });
      paredePecaIx = estado.palco.length - 1;
    }
    estado.wallMedia.push(entry);
    iframeCalibIx = estado.wallMedia.length - 1;
    estado.modoPlantar = 'parede';
    estado.paredeSel = face;
    atualizarListaIframe();
    desenharPalco();
    gravarEstado(estado);
    if (urlPareceImagemLab(url) || /#chart|#table/i.test(url) || parseYoutubeUrl(url)) {
      void aplicarPreviewNest(iframeCalibIx);
    }
  }

  function exportarPresetIframe() {
    const mid = iframeCalibIx != null ? estado.wallMedia[iframeCalibIx] : null;
    if (!mid) {
      const hint = document.getElementById('iframe-hint');
      if (hint) hint.textContent = 'Selecione uma midia na lista para exportar.';
      return;
    }
    const preset = IFRAME_FRAMES[mid.frame] || IFRAME_FRAMES.none;
    const assetId = mid.nestAssetId || mid.mountAssetId || preset.assetId || 'custom';
    const corners = cantosDaMidia(mid);
    const warp = mid.warpGrid ? `,\n  warpGrid: ${JSON.stringify(mid.warpGrid)}` : '';
    const snippet = `'${assetId}': {\n  assetId: '${assetId}',\n  spriteW: ${preset.sw},\n  spriteH: ${preset.sh},\n  corners: ${JSON.stringify(corners)}${warp},\n},`;
    void navigator.clipboard?.writeText(snippet);
    const hint = document.getElementById('iframe-hint');
    if (hint) hint.textContent = 'Preset copiado para a area de transferencia (cole em SCREEN_NEST_PRESETS).';
    console.log(snippet);
  }

  function toggleWarpIframe() {
    const mid = iframeCalibIx != null ? estado.wallMedia[iframeCalibIx] : null;
    if (!mid) return;
    marcarUndo();
    if (mid.warpGrid) {
      delete mid.warpGrid;
    } else {
      mid.warpGrid = gradeApartirCantosLab(cantosDaMidia(mid), 3, 3);
    }
    desenharPalco();
    gravarEstado(estado);
  }

  function setBookTab(tab) {
    const tabs = ['assets', 'create', 'iframe', 'ambiente', 'temas'];
    const id = tabs.includes(tab) ? tab : 'assets';
    document.querySelectorAll('[data-book-tab]').forEach((b) => {
      b.classList.toggle('ativo', b.dataset.bookTab === id);
    });
    document.getElementById('pane-assets').hidden = id !== 'assets';
    const paneCreate = document.getElementById('pane-create');
    if (paneCreate) paneCreate.hidden = id !== 'create';
    const paneIframe = document.getElementById('pane-iframe');
    if (paneIframe) paneIframe.hidden = id !== 'iframe';
    document.getElementById('pane-ambiente').hidden = id !== 'ambiente';
    document.getElementById('pane-temas').hidden = id !== 'temas';
    nestVideoTabAtiva = id === 'iframe';
    if (id === 'iframe') {
      atualizarListaIframe();
      garantirNestVideoRaf();
    } else {
      pararNestVideoRaf();
    }
  }

  function setModoLab(modo) {
    const combinar = modo === 'combinar';
    if (combinar && marcandoAssento) setMarcandoAssento(false);
    setCombinando(combinar);
  }

  function jsonAtual() {
    return {
      ...catalogo,
      tilesetAtivo: estado.tilesetAtivo,
      pisoLivre: estado.pisoLivre,
      paredeLivre: estado.paredeLivre,
      assets: catalogo.assets.map((a) => ({
        ...a,
        uso: estado.usos[a.assetId] || a.uso,
      })),
      palcoPadrao: estado.palco,
      palcoGrade: { w: estado.grade.w, h: estado.grade.h },
      andares: estado.andares,
      subidaAndar: estado.subidaAndar,
    };
  }

  function jsonTemas() {
    const hoje = new Date().toISOString().slice(0, 10);
    return {
      versao: '1.5',
      data: hoje,
      notas:
        'Cada zonaKind e um ProtoComodo completo (grade + tileset + palco + calibracao). Persistido automaticamente pelo lab em packages/world-engine/src/biblia/temas-arquiteto.json. zonaKind landing = proto handcrafted para marketing/landing; nao entra no space-program nem na geracao do escritorio da Demo.',
      temas: estado.temas,
      politicaTiles: estado.politicaTiles,
    };
  }

  async function persistirCombosNoDisco(motivo) {
    const payload = jsonCombos();
    try {
      const res = await fetch(URL_PERSISTIR_COMBOS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        throw new Error(body.erro || 'HTTP ' + res.status);
      }
      return { ok: true, combinacoes: body.combinacoes, motivo };
    } catch (err) {
      console.warn('[lab] persistencia de combos no disco falhou:', err);
      return { ok: false, motivo };
    }
  }

  /**
   * Grava a biblia no disco do projeto via lab-server (POST /api/temas-arquiteto).
   * localStorage continua como rascunho local; o disco e a fonte para o Construtor.
   */
  async function persistirTemasNoDisco(motivo) {
    const payload = jsonTemas();
    const btn = document.getElementById('btn-salvar-tema');
    const statusEl = document.getElementById('tema-persist-status');
    function setStatus(txt, ok) {
      if (statusEl) {
        statusEl.textContent = txt;
        statusEl.dataset.ok = ok ? '1' : '0';
      }
      if (btn && motivo === 'salvar') {
        const prev = btn.dataset.label || btn.textContent;
        btn.dataset.label = prev;
        btn.textContent = ok ? 'salvo no disco' : 'falha no disco';
        setTimeout(() => {
          btn.textContent = btn.dataset.label || 'salvar tema';
        }, 1400);
      }
    }
    try {
      const res = await fetch(URL_PERSISTIR_TEMAS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        throw new Error(body.erro || 'HTTP ' + res.status);
      }
      setStatus(
        'disco Â· ' + (body.temas != null ? body.temas + ' temas' : 'ok') +
          (motivo ? ' Â· ' + motivo : ''),
        true,
      );
      const combos = await persistirCombosNoDisco(motivo);
      if (combos.ok && combos.combinacoes != null) {
        setStatus(
          'disco Â· ' + (body.temas != null ? body.temas + ' temas' : 'ok') +
            ' Â· ' + combos.combinacoes + ' combos' +
            (motivo ? ' Â· ' + motivo : ''),
          true,
        );
      }
      temasOrigem = 'disco';
      return true;
    } catch (err) {
      console.warn('[lab] persistencia no disco falhou:', err);
      setStatus(
        'disco offline â€” rode pnpm lab:iso (lab-server). localStorage ok.',
        false,
      );
      return false;
    }
  }

  function jsonCombos() {
    return {
      versao: '1.0',
      data: '2026-08-17',
      notas: 'Combinacoes do laboratorio. Ordem das camadas = atras para frente. Cole em combinacoes-laboratorio.json. Ainda nao entra no solver.',
      combinacoes: (estado.combos || []).map((c) => ({
        ...c,
        uso: estado.usos[c.assetId] || c.uso || 'aleatorio',
      })),
    };
  }

  function atualizarJsonOut() {
    document.getElementById('json-out').value = JSON.stringify(jsonAtual(), null, 2);
    gravarEstado(estado);
  }

  function atualizarCelulaTxt() {
    const el = document.getElementById('celula-txt');
    if (estado.combinando) {
      el.textContent = 'modo combinar: clique um card para adicionar no preview de baixo, depois arraste.';
      pintarListaParede();
      return;
    }
    if (marcandoAssento) {
      const h = assentoHover;
      const posto = (estado.postosTrabalho || []).find((p) => p.agentSlot === agentSlotAssento());
      const hoverTxt = h
        ? 'hover ' + h.gx + ',' + h.gy + ' q' + (h.qx || 0) + (h.qy || 0)
        : 'passe o mouse sobre um quarto do piso';
      const travadoTxt = posto
        ? ' Â· travado ' + posto.gx + ',' + posto.gy + ' q' + (posto.qx || 0) + (posto.qy || 0)
        : ' Â· nenhum assento travado';
      el.textContent =
        'marcar assento: clique esquerdo para travar, outra celula troca Â· Esc cancela modo Â· salve o tema depois. ' +
        hoverTxt +
        travadoTxt;
      pintarListaParede();
      return;
    }
    if (estado.modoPlantar === 'parede') {
      const sel = estado.paredeSel;
      if (!sel) {
        el.textContent = 'modo parede: clique a face NW (Wall_R no norte, Wall_L no oeste), depois um card. Arraste para alinhar.';
      } else {
        const pecas = pecasDaFace(sel).map((p) => {
          const s = specPorId(p.assetId);
          return s ? s.nome : p.assetId;
        });
        el.textContent =
          'face ' + sel.face + ' @ ' + sel.gx + ',' + sel.gy +
          (pecas.length ? ' â€” ' + pecas.join(', ') : ' â€” vazia. Clique um card para plantar, arraste para alinhar.');
      }
      pintarListaParede();
      return;
    }
    const ocupado = estado.palco
      .filter((p) => !itemEParede(p) && p.gx === estado.celula.gx && p.gy === estado.celula.gy)
      .map((p) => (specPorId(p.assetId) ? specPorId(p.assetId).nome : p.assetId));
    el.textContent = 'celula selecionada: ' + estado.celula.gx + ',' + estado.celula.gy +
      (ocupado.length ? ' â€” ' + ocupado.join(', ') : ' â€” vazia. Clique um card para plantar.');
    pintarListaParede();
  }

  function gradeW() {
    return estado.grade.w;
  }
  function gradeH() {
    return estado.grade.h;
  }
  function celulasDoPalco() {
    const celulas = [];
    for (let gy = 0; gy < gradeH(); gy++) {
      for (let gx = 0; gx < gradeW(); gx++) celulas.push({ gx, gy });
    }
    celulas.sort((a, b) => a.gx + a.gy - (b.gx + b.gy));
    return celulas;
  }
  let subidaMedida = null;
  function subidaEfetiva(bboxR) {
    if (typeof estado.subidaAndar === 'number') return estado.subidaAndar;
    if (typeof cal.subidaAndar === 'number') return cal.subidaAndar;
    if (bboxR) return Math.max(8, peR.y - bboxR.y);
    if (subidaMedida != null) return subidaMedida;
    return Math.max(8, peR.y - 8);
  }
  function cortarPalcoFora() {
    const w = gradeW();
    const h = gradeH();
    estado.palco = estado.palco.filter((p) => p.gx >= 0 && p.gy >= 0 && p.gx < w && p.gy < h);
    if (estado.celula.gx >= w) estado.celula.gx = w - 1;
    if (estado.celula.gy >= h) estado.celula.gy = h - 1;
    if (estado.celula.gx < 0) estado.celula.gx = 0;
    if (estado.celula.gy < 0) estado.celula.gy = 0;
  }
  function pintarBarraGrade() {
    const w = gradeW();
    const h = gradeH();
    const txtG = document.getElementById('txt-grade');
    const txtA = document.getElementById('txt-andares');
    const txtS = document.getElementById('txt-subida');
    const txtH = document.getElementById('txt-altura-parede');
    const hint = document.getElementById('grade-hint');
    const wrapS = document.getElementById('wrap-subida');
    if (txtG) txtG.textContent = w + ' × ' + h;
    if (txtA) txtA.textContent = String(estado.andares);
    const altura = clampAlturaParede(estado.alturaParede != null ? estado.alturaParede : 1);
    estado.alturaParede = altura;
    if (txtH) txtH.textContent = altura + '×';
    const gxPlus = document.getElementById('btn-gx-plus');
    const gxMinus = document.getElementById('btn-gx-minus');
    const gyPlus = document.getElementById('btn-gy-plus');
    const gyMinus = document.getElementById('btn-gy-minus');
    if (gxPlus) {
      gxPlus.disabled = w >= GRADE_MAX;
      gxPlus.title = w >= GRADE_MAX ? 'maximo ' + GRADE_MAX : 'Adiciona ' + coordsFaixa('gx', w, h);
    }
    if (gxMinus) {
      gxMinus.disabled = w <= 1;
      gxMinus.title = w <= 1 ? 'minimo 1' : 'Remove ' + coordsFaixa('gx', w - 1, h);
    }
    if (gyPlus) {
      gyPlus.disabled = h >= GRADE_MAX;
      gyPlus.title = h >= GRADE_MAX ? 'maximo ' + GRADE_MAX : 'Adiciona ' + coordsFaixa('gy', h, w);
    }
    if (gyMinus) {
      gyMinus.disabled = h <= 1;
      gyMinus.title = h <= 1 ? 'minimo 1' : 'Remove ' + coordsFaixa('gy', h - 1, w);
    }
    const aPlus = document.getElementById('btn-andar-plus');
    const aMinus = document.getElementById('btn-andar-minus');
    if (aPlus) aPlus.disabled = estado.andares >= ANDARES_MAX;
    if (aMinus) aMinus.disabled = estado.andares <= 1;
    const hPlus = document.getElementById('btn-altura-parede-plus');
    const hMinus = document.getElementById('btn-altura-parede-minus');
    if (hPlus) hPlus.disabled = altura >= ALTURA_PAREDE_MAX - 1e-9;
    if (hMinus) hMinus.disabled = altura <= ALTURA_PAREDE_MIN + 1e-9;
    if (wrapS) wrapS.hidden = estado.andares < 2;
    if (txtS) txtS.textContent = estado.andares < 2 ? '—' : String(subidaEfetiva(null)) + 'px';
    if (hint) {
      hint.textContent = w >= GRADE_MAX && h >= GRADE_MAX
        ? 'Palco no maximo ' + GRADE_MAX + '×' + GRADE_MAX + '. Paredes NW acompanham. Altura da parede ate ' + ALTURA_PAREDE_MAX + '×.'
        : '+gx adiciona ' + coordsFaixa('gx', w, h) + '. +gy adiciona ' + coordsFaixa('gy', h, w) +
          '. Paredes NW acompanham. Andar extra empilha com subida = pe.y − bbox.y da Wall_R.';
    }
  }
  function alterarGrade(dw, dh) {
    estado.grade = clampGrade({ w: gradeW() + dw, h: gradeH() + dh });
    cortarPalcoFora();
    pintarBarraGrade();
    desenharPalco();
  }
  function alterarAndares(d) {
    estado.andares = clampInt(estado.andares + d, 1, ANDARES_MAX);
    pintarBarraGrade();
    desenharPalco();
  }
  function alterarSubida(d) {
    const atual = subidaEfetiva(null);
    estado.subidaAndar = clampInt(atual + d, 16, 160);
    pintarBarraGrade();
    desenharPalco();
  }
  function alterarAlturaParede(d) {
    const atual = clampAlturaParede(estado.alturaParede != null ? estado.alturaParede : 1);
    estado.alturaParede = clampAlturaParede(atual + d * ALTURA_PAREDE_PASSO);
    pintarBarraGrade();
    desenharPalco();
  }

  async function blitSpecNoPalco(ctx, spec, item, diagnostico) {
    if (spec.camadas && spec.camadas.length) {
      for (const cam of spec.camadas) {
        const s = specPorId(cam.assetId);
        if (!s || s.camadas) continue;
        try {
          const img = await carregar(s.fileName);
          const bbox = await bboxDe(s.fileName);
          withOrigemOffset(cam.dx || 0, cam.dy || 0, () => {
            blitCatalogo(ctx, img, bbox, s, item, cal, diagnostico);
          });
        } catch { /* png ausente */ }
      }
      return;
    }
    try {
      const img = await carregar(spec.fileName);
      const bbox = await bboxDe(spec.fileName);
      blitCatalogo(ctx, img, bbox, spec, item, cal, diagnostico);
    } catch { /* png ausente */ }
  }

  async function blitPecaParede(ctx, item, spec, diagnostico) {
    const pe = peDaFace(item.face);
    const v = verticeDaFace(item.face, item.gx, item.gy);
    const dx = item.dx || 0;
    const dy = item.dy || 0;
    // Espelho so com flag explicita (Ctrl+E / botao). Drop na face L nao inverte sozinho.
    const espelhar = !!item.espelhado;
    async function blitUma(s, odx, ody) {
      if (!s || s.camadas || !s.fileName) return;
      try {
        const img = await carregar(s.fileName);
        const bbox = await bboxDe(s.fileName);
        withOrigemOffset(odx, ody, () => {
          const o = espelhar
            ? blitNaVerticeEspelhado(ctx, img, v.vx, v.vy, pe)
            : blitNaVertice(ctx, img, v.vx, v.vy, pe);
          if (diagnostico) {
            ctx.strokeStyle = 'rgba(255, 80, 200, 0.9)';
            if (espelhar) {
              const telaX = o.tela.x;
              const rx = telaX + pe.x - (bbox.x + bbox.w);
              ctx.strokeRect(rx, o.y + bbox.y, bbox.w, bbox.h);
            } else {
              ctx.strokeRect(o.x + bbox.x, o.y + bbox.y, bbox.w, bbox.h);
            }
            marcarPe(ctx, o.tela);
          }
        });
      } catch { /* png ausente */ }
    }
    if (spec.camadas && spec.camadas.length) {
      for (const cam of spec.camadas) {
        await blitUma(specPorId(cam.assetId), dx + (cam.dx || 0), dy + (cam.dy || 0));
      }
      return;
    }
    await blitUma(spec, dx, dy);
  }

  let geraPalco = 0;
  async function desenharPalco() {
    const eu = ++geraPalco;
    const cores = resolverCores(catalogo, estado);
    const pisoSrc = DIR_TILES + '/Floor_128_' + cores.piso + '.png';
    const wallLSrc = DIR_TILES + '/Wall_L_128_' + cores.parede + '.png';
    const wallRSrc = DIR_TILES + '/Wall_R_128_' + cores.parede + '.png';

    let piso;
    let wallL;
    let wallR;
    let porta;
    try {
      [piso, wallL, wallR, porta] = await Promise.all([
        carregar(pisoSrc),
        carregar(wallLSrc),
        carregar(wallRSrc),
        carregar(PORTA_VIDRO),
      ]);
    } catch (err) {
      document.getElementById('meta').textContent = String(err) +
        '\nPar de piso/parede inexistente: ' + cores.piso + ' / ' + cores.parede;
      return;
    }
    if (eu !== geraPalco) return;
    cortarPalcoFora();
    const bboxL = medirBbox(wallL);
    const bboxR = medirBbox(wallR);
    const bboxP = medirBbox(porta);
    const medidoR = peExtremo(silhuetaChao(wallR), 'esq');
    const medidoL = peExtremo(silhuetaChao(wallL), 'dir');
    const medidoP = peExtremo(silhuetaChao(porta), 'esq');

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const w = gradeW();
    const h = gradeH();
    const nAndares = estado.andares;
    subidaMedida = Math.max(8, peR.y - bboxR.y);
    const subida = subidaEfetiva(bboxR);
    const niveisPalco = clampAlturaParede(estado.alturaParede != null ? estado.alturaParede : 1);
    const faixaR = faixaFaceParede(wallR, bboxR, peR.y);
    encaixarPalco(canvas, w, h, nAndares, subida, estado.alturaParede, faixaR.passo);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const celulas = celulasDoPalco();
    const gxPorta = Math.floor((w - 1) / 2);
    // Altura da parede = niveis inteiros empilhados 1:1, fatiados sem emenda:
    // capo (topo iso + sua sombra) so no nivel mais alto; espessura (base) so
    // no nivel do chao; niveis repetem so a face limpa [limpo, pe.y].
    const niveisParede = niveisPalco;
    const faixaL = faixaFaceParede(wallL, bboxL, peL.y);

    function blitParedeEmpilhada(img, pe, faixa, vx, vy, bbox) {
      for (let nv = 0; nv < niveisParede; nv++) {
        const ultimo = nv === niveisParede - 1;
        withOrigemOffset(0, -nv * faixa.passo, () => {
          let o;
          if (niveisParede === 1) {
            o = blitNaVertice(ctx, img, vx, vy, pe);
          } else if (nv === 0) {
            // base: face limpa + espessura, sem capo nem sombra do capo
            o = blitNaVerticeFatia(ctx, img, vx, vy, pe, faixa.limpo, img.naturalHeight);
          } else if (ultimo) {
            // topo: capo + sombra + face, sem espessura
            o = blitNaVerticeFatia(ctx, img, vx, vy, pe, 0, pe.y + 1);
          } else {
            // meio: so a face limpa
            o = blitNaVerticeFatia(ctx, img, vx, vy, pe, faixa.limpo, pe.y + 1);
          }
          if (estado.diagnostico && nv === 0 && o) {
            ctx.strokeStyle = 'rgba(255, 80, 200, 0.9)';
            ctx.strokeRect(o.x + bbox.x, o.y + bbox.y, bbox.w, bbox.h);
            marcarPe(ctx, o.tela);
          }
        });
      }
    }

    function blitEstrutura(andar) {
      withOrigemOffset(0, -andar * subida, () => {
        for (const c of celulas) blitTile(ctx, piso, c.gx, c.gy, ancoraPiso);
        for (let gx = 0; gx < w; gx++) blitParedeEmpilhada(wallR, peR, faixaR, gx, 0, bboxR);
        if (andar === 0) {
          const vMeio = iso(gxPorta, 0);
          const oPorta = blitNoPe(
            ctx,
            porta,
            ORIGEM.x + vMeio.x + FOLGA_PORTA.x,
            ORIGEM.y + vMeio.y + FOLGA_PORTA.y,
            peP,
          );
          if (estado.diagnostico) {
            ctx.strokeStyle = 'rgba(255, 80, 200, 0.9)';
            ctx.strokeRect(oPorta.x + bboxP.x, oPorta.y + bboxP.y, bboxP.w, bboxP.h);
            marcarPe(ctx, oPorta.tela);
          }
        }
        for (let gy = 0; gy < h; gy++) blitParedeEmpilhada(wallL, peL, faixaL, 0, gy, bboxL);
      });
    }

    for (let a = nAndares - 1; a >= 0; a--) blitEstrutura(a);

    ultBboxWall = { R: bboxR, L: bboxL };

    const itensParede = estado.palco.filter((p) => {
      if (!itemEParede(p)) return false;
      if (p.face === 'R') return p.gx >= 0 && p.gx < w;
      return p.gy >= 0 && p.gy < h;
    });
    for (const item of itensParede) {
      if (eu !== geraPalco) return;
      const spec = specPorId(item.assetId);
      if (!spec) continue;
      await blitPecaParede(ctx, item, spec, estado.diagnostico);
    }

    // Ghosts das areas de tela (quad UV) + handles de calibracao.
    for (let mi = 0; mi < (estado.wallMedia || []).length; mi++) {
      const mid = estado.wallMedia[mi];
      if (!mid.face) continue;
      const preset = IFRAME_FRAMES[mid.frame] || IFRAME_FRAMES.none;
      const pe = peDaFace(mid.face);
      const v = verticeDaFace(mid.face, mid.gx, mid.gy);
      const topLeft = posBlitVertice(v.vx, v.vy, pe, mid.dx || 0, mid.dy || 0);
      let sw;
      let sh;
      if (mid.frame && mid.frame !== 'none') {
        sw = preset.sw;
        sh = preset.sh;
      } else {
        const span = mid.size?.w || preset.span;
        sw = span * (LARGURA_TILE / 2);
        sh = mid.heightPx || preset.heightPx;
      }
      const corners = cantosDaMidia(mid);
      const pt = (p) => ({ x: topLeft.x + p.u * sw, y: topLeft.y + p.v * sh });
      const tl = pt(corners.tl);
      const tr = pt(corners.tr);
      const br = pt(corners.br);
      const bl = pt(corners.bl);
      const preview = nestPreviewCache.get(mid.mediaId);
      const temPreview =
        preview && sourcePronto(preview) && (preview.status === 'ok' || preview.status === 'erro');
      if (temPreview) {
        blitNestWarp(ctx, preview.source, corners, topLeft, sw, sh, mid.warpGrid, mid.blendMode);
      }
      const calibrando = mi === iframeCalibIx;
      // Sem calibracao ativa: so o conteudo (sem barras/bolinhas).
      if (!calibrando) {
        if (!temPreview) {
          ctx.save();
          ctx.strokeStyle = '#7dd3fc';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(tl.x, tl.y);
          ctx.lineTo(tr.x, tr.y);
          ctx.lineTo(br.x, br.y);
          ctx.lineTo(bl.x, bl.y);
          ctx.closePath();
          ctx.stroke();
          ctx.fillStyle = 'rgba(125, 211, 252, 0.15)';
          ctx.fill();
          ctx.restore();
        }
        continue;
      }
      ctx.save();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(tl.x, tl.y);
      ctx.lineTo(tr.x, tr.y);
      ctx.lineTo(br.x, br.y);
      ctx.lineTo(bl.x, bl.y);
      ctx.closePath();
      ctx.stroke();
      if (!temPreview) {
        ctx.fillStyle = 'rgba(251, 191, 36, 0.18)';
        ctx.fill();
      }
      if (calibrando) {
        const handles = [
          ['tl', tl],
          ['tr', tr],
          ['br', br],
          ['bl', bl],
        ];
        if (mid.warpGrid && mid.warpGrid.points) {
          const { cols, rows, points } = mid.warpGrid;
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const p = points[r * cols + c];
              if (!p) continue;
              handles.push([`w:${r}:${c}`, pt(p)]);
            }
          }
        }
        for (const [id, hp] of handles) {
          ctx.fillStyle = id.startsWith('w:') ? '#a78bfa' : '#fbbf24';
          ctx.beginPath();
          ctx.arc(hp.x, hp.y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#0c1210';
          ctx.lineWidth = 1;
          ctx.setLineDash([]);
          ctx.stroke();
        }
        // Grip central (mover no espaco, estilo Word).
        const cx = (tl.x + tr.x + br.x + bl.x) / 4;
        const cy = (tl.y + tr.y + br.y + bl.y) / 4;
        ctx.setLineDash([]);
        ctx.strokeStyle = '#fbbf24';
        ctx.fillStyle = 'rgba(251, 191, 36, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 5, cy);
        ctx.lineTo(cx + 5, cy);
        ctx.moveTo(cx, cy - 5);
        ctx.lineTo(cx, cy + 5);
        ctx.stroke();
      }
      ctx.restore();
    }

    const itens = estado.palco
      .map((p, ix) => ({ ...p, spec: specPorId(p.assetId), _ix: ix }))
      .filter((p) => !itemEParede(p) && p.spec && p.gx >= 0 && p.gy >= 0 && p.gx < w && p.gy < h);
    // Empate de depth: indice no palco (igual ao `order` do Painter global).
    itens.sort((a, b) => {
      const da = a.gx + a.gy + (a.spec.papel === 'decor' ? 0.5 : 0);
      const db = b.gx + b.gy + (b.spec.papel === 'decor' ? 0.5 : 0);
      return da - db || a._ix - b._ix;
    });
    for (const item of itens) {
      if (eu !== geraPalco) return;
      await blitSpecNoPalco(ctx, item.spec, item, estado.diagnostico);
    }

    if (estado.postosTrabalho && estado.postosTrabalho.length) {
      for (const posto of estado.postosTrabalho) {
        const g = postoParaGrid(posto);
        losango(ctx, g.x, g.y, '#34d399', 'rgba(52, 211, 153, 0.25)', posto.passo || 1);
        desenharSetaFacingPosto(ctx, posto);
      }
    }

    atualizarAvisoPalco(estado.palco);

    // Grade / quartos: diagnostico tecnico OU modo marcar assento (selecao visual).
    if (estado.diagnostico || marcandoAssento) {
      for (const c of celulas) {
        for (let qy = 0; qy < 2; qy++) {
          for (let qx = 0; qx < 2; qx++) {
            const slot = { gx: c.gx, gy: c.gy, qx, qy };
            const hover = marcandoAssento && mesmaSubcelula(slot, assentoHover);
            const sel =
              estado.diagnostico &&
              c.gx === estado.celula.gx &&
              c.gy === estado.celula.gy &&
              qx === (estado.celula.qx || 0) &&
              qy === (estado.celula.qy || 0);
            const postoTravado = (estado.postosTrabalho || []).some(
              (p) =>
                p.gx === c.gx &&
                p.gy === c.gy &&
                (p.qx || 0) === qx &&
                (p.qy || 0) === qy,
            );
            const { stroke, fill } = estiloLosangoAssento({
              marcandoAssento,
              hover,
              sel,
              postoTravado,
            });
            losango(ctx, c.gx + qx * 0.5, c.gy + qy * 0.5, stroke, fill, 0.5);
          }
        }
        if (estado.diagnostico) {
          const p = iso(c.gx + 0.5, c.gy + 0.5);
          ctx.fillStyle = '#ff3b3b';
          ctx.beginPath();
          ctx.arc(ORIGEM.x + p.x, ORIGEM.y + p.y, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(200, 230, 255, 0.85)';
          ctx.font = '10px "IBM Plex Mono", ui-monospace, monospace';
          ctx.fillText(c.gx + ',' + c.gy, ORIGEM.x + p.x + 4, ORIGEM.y + p.y - 4);
        }
      }
    }
    perimetroGrade(ctx, w, h);

    // Destaque so da peca selecionada (nao da malha do piso).
    if (paredePecaIx >= 0 && paredePecaIx < estado.palco.length) {
      const peca = estado.palco[paredePecaIx];
      const rP = rectPecaSpec(peca, specPorId(peca.assetId));
      if (rP) {
        ctx.strokeStyle = '#c4a35a';
        ctx.lineWidth = 2;
        ctx.strokeRect(rP.x - 0.5, rP.y - 0.5, rP.w + 1, rP.h + 1);
        ctx.lineWidth = 1;
      }
    }
    if (estado.diagnostico && estado.paredeSel && ultBboxWall) {
      const sel = estado.paredeSel;
      const bboxF = sel.face === 'L' ? ultBboxWall.L : ultBboxWall.R;
      const rF = rectFace(sel.face, sel.gx, sel.gy, bboxF);
      ctx.strokeStyle = 'rgba(196, 163, 90, 0.7)';
      ctx.strokeRect(rF.x - 0.5, rF.y - 0.5, rF.w + 1, rF.h + 1);
    }

    document.getElementById('meta').textContent =
      'GRAVADO  rodada ' + (cal.rodada ?? '?') + '  plano ' + (cal.plano ?? '?') +
      '  |  ' + (cal === CALIBRACAO_FALLBACK ? 'fallback local' : 'JSON da demo') + '\n' +
      'ANCORA_PISO   ' + ancoraPiso.x + ',' + ancoraPiso.y + '\n' +
      'Wall_R peEsq ' + peR.x + ',' + peR.y + '  (PNG medido ' + medidoR.x + ',' + medidoR.y + ')\n' +
      'Wall_L peDir ' + peL.x + ',' + peL.y + '  (PNG medido ' + medidoL.x + ',' + medidoL.y + ')\n' +
      'Porta  peEsq ' + peP.x + ',' + peP.y + '  folga ' + FOLGA_PORTA.x + ',' + FOLGA_PORTA.y +
      '  (PNG medido ' + medidoP.x + ',' + medidoP.y + ')  gx=' + gxPorta + '\n' +
      'TEMA ' + cores.tileSetId + '  piso ' + cores.piso + '  parede ' + cores.parede + '\n' +
      'PALCO  ' + w + ' x ' + h + '  |  andares ' + nAndares +
      '  |  subida ' + subida + 'px' +
      (estado.subidaAndar == null && cal.subidaAndar == null ? ' (PNG Wall_R pe.y âˆ’ bbox.y)' : ' (override lab/JSON)') + '\n' +
      'POLITICA  ' + resumoPolitica(estado.politicaTiles) +
      (cores.previewZona ? '  |  palco mostra ' + nomeZonaTile(cores.previewZona) : '') + '\n' +
      'MESA ancora 64,68 (centro da face). BEBEDOURO pe 64,63 no vertice NW.' + '\n' +
      'alvo: mesa no centro do losango; bebedouro no esquadro; azul = quarto de celula.';
    atualizarCelulaTxt();
    atualizarJsonOut();
    pintarTemas();
    pintarBarraGrade();
    syncNestLiveOverlays();
  }

  function pintarTemas() {
    const box = document.getElementById('swatches-tema');
    if (box.dataset.ready === '1') {
      box.querySelectorAll('button').forEach((b) => {
        b.classList.toggle('ativo', b.dataset.id === estado.tilesetAtivo && !estado.pisoLivre && !estado.paredeLivre);
      });
      return;
    }
    box.dataset.ready = '1';
    for (const ts of catalogo.tilesets) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch';
      btn.dataset.id = ts.tileSetId;
      btn.classList.toggle('ativo', ts.tileSetId === estado.tilesetAtivo && !estado.pisoLivre && !estado.paredeLivre);
      btn.title = ts.tileSetId + ' (' + ts.piso + ' / ' + ts.parede + ')';
      btn.setAttribute('aria-label', 'Tema ' + ts.tileSetId);
      carregar(DIR_TILES + '/Floor_128_' + ts.piso + '.png').then((img) => {
        const b = medirBbox(img);
        btn.appendChild(thumb(img, b, 34, 24));
      }).catch(() => {
        btn.textContent = ts.tileSetId.slice(0, 3);
      });
      btn.addEventListener('click', () => {
        estado.tilesetAtivo = ts.tileSetId;
        estado.pisoLivre = null;
        estado.paredeLivre = null;
        document.getElementById('sel-piso').value = ts.piso;
        document.getElementById('sel-parede').value = ts.parede;
        desenharPalco();
      });
      box.appendChild(btn);
    }
  }

  async function montarSwatches(ids, dirPrefix, selId, boxId, campo) {
    const sel = document.getElementById(selId);
    const box = document.getElementById(boxId);
    sel.innerHTML = '';
    for (const nome of ids) {
      const opt = document.createElement('option');
      opt.value = nome;
      opt.textContent = nome;
      sel.appendChild(opt);
    }
    const atual = campo === 'pisoLivre'
      ? (estado.pisoLivre || resolverCores(catalogo, estado).piso)
      : (estado.paredeLivre || resolverCores(catalogo, estado).parede);
    sel.value = atual;
    sel.addEventListener('change', () => {
      estado[campo] = sel.value;
      desenharPalco();
    });

    const amostra = ids;
    for (const nome of amostra) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch';
      btn.title = nome;
      btn.setAttribute('aria-label', (campo === 'pisoLivre' ? 'Piso ' : 'Parede ') + nome);
      const src = campo === 'pisoLivre'
        ? DIR_TILES + '/Floor_128_' + nome + '.png'
        : DIR_TILES + '/Wall_R_128_' + nome + '.png';
      carregar(src).then((img) => {
        btn.appendChild(thumb(img, medirBbox(img), 34, 24));
      }).catch(() => {
        btn.textContent = nome.slice(0, 2);
      });
      btn.addEventListener('click', () => {
        estado[campo] = nome;
        sel.value = nome;
        desenharPalco();
      });
      box.appendChild(btn);
    }
  }

  function zonaPoliticaAtual() {
    const sel = document.getElementById('sel-zona-politica');
    return (sel && sel.value) || 'corridor';
  }

  function slotZona(id) {
    if (!estado.politicaTiles[id]) estado.politicaTiles[id] = slotTilesPadrao();
    return estado.politicaTiles[id];
  }

  function syncPreviewZona() {
    const chk = document.getElementById('chk-preview-zona');
    const id = zonaPoliticaAtual();
    const slot = slotZona(id);
    const querVer = chk ? chk.checked : true;
    estado.previewZona = querVer && slot.modo !== 'default' ? id : null;
  }

  function pintarPolitica() {
    const id = zonaPoliticaAtual();
    const slot = slotZona(id);
    const selModo = document.getElementById('sel-modo-zona');
    const bloco = document.getElementById('bloco-tiles-zona');
    const hint = document.getElementById('hint-zona');
    if (selModo) selModo.value = slot.modo;
    if (bloco) bloco.hidden = slot.modo === 'default';
    if (hint) {
      if (slot.modo === 'default') {
        hint.textContent = nomeZonaTile(id) + ': herda piso/parede do tema do arquiteto daquela sala.';
      } else if (slot.modo === 'unico') {
        hint.textContent = nomeZonaTile(id) + ': unico. Clique uma amostra. Piso ' +
          (slot.pisos[0] || '(tema)') + '  parede ' + (slot.paredes[0] || '(tema)');
      } else {
        hint.textContent = nomeZonaTile(id) + ': opcoes. Clique para marcar. Pisos [' +
          (slot.pisos.join(', ') || 'â€”') + ']  paredes [' + (slot.paredes.join(', ') || 'â€”') + ']';
      }
    }
    const boxP = document.getElementById('swatches-zona-piso');
    const boxW = document.getElementById('swatches-zona-parede');
    if (boxP) {
      boxP.querySelectorAll('button').forEach((b) => {
        b.classList.toggle('ativo', slot.pisos.indexOf(b.dataset.nome) >= 0);
      });
    }
    if (boxW) {
      boxW.querySelectorAll('button').forEach((b) => {
        b.classList.toggle('ativo', slot.paredes.indexOf(b.dataset.nome) >= 0);
      });
    }
    syncPreviewZona();
  }

  function setModoZona(modo) {
    const id = zonaPoliticaAtual();
    const slot = slotZona(id);
    slot.modo = modo === 'unico' || modo === 'opcoes' ? modo : 'default';
    if (slot.modo === 'default') {
      slot.pisos = [];
      slot.paredes = [];
    } else if (slot.modo === 'unico') {
      slot.pisos = slot.pisos.slice(0, 1);
      slot.paredes = slot.paredes.slice(0, 1);
    }
    estado.politicaTiles[id] = slot;
    pintarPolitica();
    desenharPalco();
  }

  function toggleTileZona(campo, nome) {
    const id = zonaPoliticaAtual();
    const slot = slotZona(id);
    if (slot.modo === 'default') return;
    let arr = slot[campo] || [];
    if (slot.modo === 'unico') arr = arr[0] === nome ? [] : [nome];
    else arr = arr.indexOf(nome) >= 0 ? arr.filter((x) => x !== nome) : arr.concat([nome]);
    slot[campo] = arr;
    estado.politicaTiles[id] = slot;
    pintarPolitica();
    desenharPalco();
  }

  function montarSelTemaZona() {
    const sel = document.getElementById('tema-zona');
    if (!sel || sel.dataset.ready === '1') return;
    sel.dataset.ready = '1';
    for (const z of ZONAS_TILE) {
      const opt = document.createElement('option');
      opt.value = z.id;
      opt.textContent = z.nome + ' (' + z.id + ')';
      sel.appendChild(opt);
    }
    sel.value = 'sala_user';
  }

  function montarSelZonas() {
    const sel = document.getElementById('sel-zona-politica');
    if (!sel || sel.dataset.ready === '1') return;
    sel.dataset.ready = '1';
    for (const z of ZONAS_TILE) {
      const opt = document.createElement('option');
      opt.value = z.id;
      opt.textContent = z.nome + ' (' + z.id + ')';
      sel.appendChild(opt);
    }
    sel.value = 'corridor';
    sel.addEventListener('change', () => {
      pintarPolitica();
      desenharPalco();
    });
  }

  async function montarSwatchesZona(ids, dirPrefix, boxId, campo) {
    const box = document.getElementById(boxId);
    if (!box) return;
    box.innerHTML = '';
    for (const nome of ids) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch';
      btn.dataset.nome = nome;
      btn.title = nome;
      btn.setAttribute('aria-label', campo + ' ' + nome);
      const src = DIR_TILES + '/' + dirPrefix + nome + '.png';
      carregar(src).then((img) => {
        btn.appendChild(thumb(img, medirBbox(img), 34, 24));
      }).catch(() => {
        btn.textContent = nome.slice(0, 2);
      });
      btn.addEventListener('click', () => toggleTileZona(campo, nome));
      box.appendChild(btn);
    }
  }

  function anexarInteracoesCard(btn, a) {
    btn.addEventListener('pointerdown', (ev) => {
      if (ev.target.closest('.usos')) return;
      if (ev.button != null && ev.button !== 0) return;
      arrasteCatalogo = {
        spec: a,
        x0: ev.clientX,
        y0: ev.clientY,
        moved: false,
        ghost: null,
      };
      btn.classList.add('dragging');
      btn.setPointerCapture?.(ev.pointerId);
      ev.preventDefault();
    });
    btn.addEventListener('click', (ev) => {
      if (ev.target.closest('.usos')) return;
      if (arrasteCatalogo && arrasteCatalogo.moved) return;
      if (estado.combinando) adicionarAoCompose(a);
      else {
        if (estado.paredeSel && a.papel === 'wall') {
          estado.modoPlantar = 'parede';
          plantar(a);
        } else if (a.papel !== 'wall') {
          estado.modoPlantar = 'piso';
          plantar(a);
        } else {
          const face = estado.paredeSel || { face: 'R', gx: Math.floor(gradeW() / 2), gy: 0 };
          estado.paredeSel = face;
          estado.modoPlantar = 'parede';
          plantar(a);
        }
      }
    });
  }

  function montarCardAsset(a, { mostrarUso = true } = {}) {
    const uso = estado.usos[a.assetId] || a.uso;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'card' + (uso === 'off' ? ' uso-off' : '') + (a.camadas ? ' combo' : '') + (a.papel === 'wall' ? ' card-wall' : '') + (a.origem === 'create' ? ' card-create' : '');
    btn.setAttribute('role', 'listitem');
    btn.dataset.id = a.assetId;
    if (assetEspelhavel(a)) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = 'espelho';
      btn.appendChild(badge);
    }
    const cv = document.createElement('canvas');
    cv.width = 140;
    cv.height = 72;
    cv.setAttribute('aria-hidden', 'true');
    btn.appendChild(cv);
    const nome = document.createElement('span');
    nome.className = 'nome';
    nome.textContent = a.nome;
    btn.appendChild(nome);
    const kind = document.createElement('span');
    kind.className = 'kind';
    kind.textContent = a.camadas
      ? a.kind + ' · ' + a.papel + ' · combo'
      : a.kind + ' · ' + a.papel + (a.origem === 'create' ? ' · create' : '');
    btn.appendChild(kind);
    if (mostrarUso) {
      const usos = document.createElement('div');
      usos.className = 'usos';
      for (const u of ['obrigatorio', 'aleatorio', 'off']) {
        const lab = document.createElement('label');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'uso-' + a.assetId;
        radio.value = u;
        radio.checked = uso === u;
        radio.addEventListener('click', (ev) => ev.stopPropagation());
        radio.addEventListener('change', (ev) => {
          ev.stopPropagation();
          estado.usos[a.assetId] = u;
          if (a.camadas) a.uso = u;
          btn.classList.toggle('uso-off', u === 'off');
          atualizarJsonOut();
        });
        lab.appendChild(radio);
        lab.appendChild(document.createTextNode(' ' + u));
        usos.appendChild(lab);
      }
      btn.appendChild(usos);
    }
    anexarInteracoesCard(btn, a);
    if (a.camadas) {
      preencherThumbCombo(cv, a);
    } else {
      carregar(a.fileName).then((img) => {
        const b = medirBbox(img);
        bboxPorSrc.set(a.fileName, b);
        const t = thumb(img, b, 140, 72);
        cv.getContext('2d').drawImage(t, 0, 0);
      }).catch(() => {
        const g = cv.getContext('2d');
        g.fillStyle = '#422';
        g.fillRect(0, 0, 140, 72);
        g.fillStyle = '#faa';
        g.font = '11px sans-serif';
        g.fillText('PNG ausente', 8, 40);
      });
    }
    return btn;
  }

  async function montarCards() {
    const root = document.getElementById('cards');
    if (!root) return;
    root.innerHTML = '';
    const q = (document.getElementById('filtro')?.value || '').trim().toLowerCase();
    const kindSel = document.getElementById('filtro-kind')?.value || '';
    const usoSel = document.getElementById('filtro-uso')?.value || '';
    const soEsp = !!document.getElementById('filtro-espelhavel')?.checked;
    const kinds = new Set();
    for (const a of assetsCatalogo()) {
      if (a.kind) kinds.add(a.kind);
      const blob = (a.nome + ' ' + a.kind + ' ' + a.assetId + ' ' + a.papel + (a.camadas ? ' combo' : '')).toLowerCase();
      if (q && !blob.includes(q)) continue;
      if (filtroPapel && a.papel !== filtroPapel) continue;
      if (kindSel && a.kind !== kindSel) continue;
      const uso = estado.usos[a.assetId] || a.uso;
      if (usoSel && uso !== usoSel) continue;
      if (soEsp && !assetEspelhavel(a)) continue;
      root.appendChild(montarCardAsset(a));
    }
    const selKind = document.getElementById('filtro-kind');
    if (selKind && selKind.options.length <= 1) {
      [...kinds].sort().forEach((k) => {
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = k;
        selKind.appendChild(opt);
      });
    }
  }

  async function montarCardsCreate() {
    const root = document.getElementById('cards-create');
    if (!root) return;
    root.innerHTML = '';
    const lista = estado.createdAssets || [];
    if (!lista.length) {
      const vazio = document.createElement('p');
      vazio.className = 'hint-combo';
      vazio.textContent = 'Nenhum asset gerado ainda. Rode o script gerar-created-assets.mjs.';
      root.appendChild(vazio);
      return;
    }
    for (const a of lista) {
      root.appendChild(montarCardAsset(a, { mostrarUso: true }));
    }
  }

  function pintarListaParede() {
    const root = document.getElementById('lista-parede');
    if (!root) return;
    root.innerHTML = '';
    if (estado.combinando) {
      root.hidden = true;
      return;
    }
    const pecas = estado.palco
      .map((p, i) => ({ p, i }))
      .filter((x) => itemEParede(x.p));
    if (!pecas.length) {
      root.hidden = true;
      return;
    }
    root.hidden = false;
    for (const { p, i } of pecas) {
      const s = specPorId(p.assetId);
      const row = document.createElement('div');
      row.className = 'chip' + (i === paredePecaIx ? ' sel' : '');
      const nome = document.createElement('span');
      nome.textContent = s ? s.nome : p.assetId;
      const meta = document.createElement('span');
      meta.className = 'meta-chip';
      meta.textContent =
        p.face +
        (p.espelhado ? ' ✦' : '') +
        ' dx ' +
        (p.dx || 0) +
        ' dy ' +
        (p.dy || 0);
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.textContent = 'remover';
      rm.addEventListener('click', (ev) => {
        ev.stopPropagation();
        removerPecaParede(i);
      });
      row.appendChild(nome);
      row.appendChild(meta);
      if (assetEspelhavel(s)) {
        const esp = document.createElement('button');
        esp.type = 'button';
        esp.textContent = 'espelhar';
        esp.title = 'Espelhar sprite e trocar face R↔L (Ctrl+E)';
        esp.addEventListener('click', (ev) => {
          ev.stopPropagation();
          espelharFacePeca(i);
        });
        row.appendChild(esp);
      }
      row.appendChild(rm);
      row.addEventListener('click', (ev) => {
        if (ev.target.closest('button')) return;
        paredePecaIx = i;
        estado.paredeSel = { face: p.face, gx: p.gx, gy: p.gy };
        pintarListaParede();
        pintarCamadasLocais();
        desenharPalco();
      });
      root.appendChild(row);
    }
    pintarCamadasLocais();
  }

  function removerPecaPalco(idx) {
    if (idx == null) idx = paredePecaIx;
    if (idx < 0 || idx >= estado.palco.length) return;
    marcarUndo();
    estado.palco.splice(idx, 1);
    if (paredePecaIx === idx) paredePecaIx = -1;
    else if (paredePecaIx > idx) paredePecaIx -= 1;
    desenharPalco();
    pintarListaParede();
    pintarCamadasLocais();
  }

  function removerPecaParede(idx) {
    if (idx == null) idx = paredePecaIx;
    if (idx < 0 || idx >= estado.palco.length || !itemEParede(estado.palco[idx])) return;
    removerPecaPalco(idx);
  }

  function plantar(spec) {
    if (spec.papel === 'wall' || estado.modoPlantar === 'parede') {
      const face = estado.paredeSel || { face: 'R', gx: Math.floor(gradeW() / 2), gy: 0 };
      estado.paredeSel = face;
      marcarUndo();
      const mesma = estado.palco.findIndex((p) =>
        itemEParede(p) && p.assetId === spec.assetId && mesmaFace(p, face),
      );
      if (mesma >= 0) {
        estado.palco.splice(mesma, 1);
        if (paredePecaIx === mesma) paredePecaIx = -1;
        else if (paredePecaIx > mesma) paredePecaIx -= 1;
        desenharPalco();
        pintarListaParede();
        return;
      }
      estado.palco.push({
        assetId: spec.assetId,
        papel: 'wall',
        face: face.face,
        gx: face.gx,
        gy: face.gy,
        dx: 0,
        dy: dyInicialParede(spec.assetId),
        espelhado: false,
      });
      paredePecaIx = estado.palco.length - 1;
      if (spec.fileName) bboxDe(spec.fileName).catch(() => undefined);
      desenharPalco();
      pintarListaParede();
      return;
    }
    const sel = estado.celula;
    if (sel.gx < 0 || sel.gx >= gradeW() || sel.gy < 0 || sel.gy >= gradeH()) return;
    const alvo = {
      assetId: spec.assetId,
      gx: sel.gx,
      gy: sel.gy,
      qx: 0,
      qy: 0,
      passo: 1,
      dx: 0,
      dy: 0,
    };
    if (spec.papel === 'decor') alvo.papel = 'decor';
    marcarUndo();
    estado.palco.push(alvo);
    paredePecaIx = estado.palco.length - 1;
    desenharPalco();
  }

  function sincronizarUiCores(cores) {
    const selPiso = document.getElementById('sel-piso');
    const selParede = document.getElementById('sel-parede');
    if (selPiso) selPiso.value = cores.pisoEfetivo || selPiso.value;
    if (selParede) selParede.value = cores.paredeEfetiva || selParede.value;
    pintarTemas();
    const boxPiso = document.getElementById('swatches-piso');
    const boxParede = document.getElementById('swatches-parede');
    if (boxPiso) {
      boxPiso.querySelectorAll('button').forEach((b) => {
        b.classList.toggle('ativo', b.dataset.nome === estado.pisoLivre);
      });
    }
    if (boxParede) {
      boxParede.querySelectorAll('button').forEach((b) => {
        b.classList.toggle('ativo', b.dataset.nome === estado.paredeLivre);
      });
    }
    const chkPrev = document.getElementById('chk-preview-zona');
    if (chkPrev) chkPrev.checked = false;
  }

  function atualizarAvisoPalco(palco) {
    const el = document.getElementById('palco-aviso');
    if (!el) return;
    const v = validarPalco(palco, specPorId);
    if (v.ok) {
      el.dataset.ok = '1';
      el.textContent = '';
      return;
    }
    el.dataset.ok = '0';
    el.textContent =
      v.missingAssetIds.length +
      ' peca(s) sem asset no catalogo/combos: ' +
      v.missingAssetIds.join(', ') +
      ' â€” recarregue combos ou reset JSON do repo.';
  }

  function aplicarTema(tema) {
    if (marcandoAssento) setMarcandoAssento(false);
    const t = normalizarTema(tema);

    estado.previewZona = null;
    estado.tilesetAtivo = t.tilesetAtivo || 'nordic-calm';
    const ts = catalogo.tilesets.find((x) => x.tileSetId === estado.tilesetAtivo) || catalogo.tilesets[0];
    const coresRestauradas = restaurarCoresDoTema(t, {
      piso: ts ? ts.piso : '',
      parede: ts ? ts.parede : '',
    });
    estado.pisoLivre = coresRestauradas.pisoLivre;
    estado.paredeLivre = coresRestauradas.paredeLivre;

    estado.grade = t.grade;
    estado.andares = t.andares;
    estado.subidaAndar = t.subidaAndar;
    estado.alturaParede = clampAlturaParede(t.alturaParede != null ? t.alturaParede : 1);
    estado.subdiv = true;
    estado.palco = t.palco.map((p) => ({ ...p }));
    estado.postosTrabalho = (t.postosTrabalho || []).slice();
    estado.wallMedia = (t.wallMedia || []).slice();
    assentoSlotAtivo = (estado.postosTrabalho[0] && estado.postosTrabalho[0].agentSlot) || 'seat-0';
    pintarSeletorAssentos();

    [...nestPreviewCache.keys()].forEach((id) => limparPreviewMidia(id));

    if (estado.celula.gx >= estado.grade.w) estado.celula.gx = Math.max(0, estado.grade.w - 1);
    if (estado.celula.gy >= estado.grade.h) estado.celula.gy = Math.max(0, estado.grade.h - 1);
    cortarPalcoFora();

    sincronizarUiCores(coresRestauradas);

    const nomeEl = document.getElementById('nome-tema');
    const prioEl = document.getElementById('tema-prioridade');
    const unicoEl = document.getElementById('tema-unico');
    const marcadoEl = document.getElementById('tema-marcado');
    const zonaEl = document.getElementById('tema-zona');
    const subdivEl = document.getElementById('chk-subdiv');
    if (nomeEl) nomeEl.value = t.nome || '';
    if (prioEl) prioEl.value = String(t.prioridade);
    if (unicoEl) unicoEl.checked = !!t.unicoNaAgencia;
    if (marcadoEl) marcadoEl.checked = !!t.marcadoParaGeracao;
    if (zonaEl) zonaEl.value = zonaKindOk(t.zonaKind);
    if (subdivEl) subdivEl.checked = true;

    atualizarAvisoPalco(estado.palco);
    atualizarListaIframe();
    autoAplicarPreviewsNest();

    desenharPalco();
  }

  function snapshotCalibracao() {
    return {
      rodada: cal.rodada,
      plano: cal.plano,
      ancoraPiso: cal.ancoraPiso || ANCORA_PISO,
      peWallR: cal.peWallR,
      peWallL: cal.peWallL,
      pePorta: cal.pePorta,
      folgaPorta: cal.folgaPorta,
      objetos: cal.objetos || {},
    };
  }

  function lerFormTema() {
    const prioEl = document.getElementById('tema-prioridade');
    const unicoEl = document.getElementById('tema-unico');
    const marcadoEl = document.getElementById('tema-marcado');
    const zonaEl = document.getElementById('tema-zona');
    return {
      prioridade: clampInt(prioEl ? prioEl.value : 5, 1, 9),
      unicoNaAgencia: !!(unicoEl && unicoEl.checked),
      marcadoParaGeracao: !!(marcadoEl && marcadoEl.checked),
      zonaKind: zonaKindOk(zonaEl ? zonaEl.value : 'sala_user'),
    };
  }

  function snapshotTema(nome) {
    const cores = resolverCores(catalogo, estado);
    const form = lerFormTema();
    return normalizarTema({
      id: slugTema(nome),
      nome: nome.trim(),
      tilesetAtivo: estado.tilesetAtivo,
      pisoLivre: estado.pisoLivre,
      paredeLivre: estado.paredeLivre,
      palco: estado.palco.map((p) => ({ ...p })),
      grade: { w: estado.grade.w, h: estado.grade.h },
      andares: estado.andares,
      subidaAndar: estado.subidaAndar,
      alturaParede: clampAlturaParede(estado.alturaParede != null ? estado.alturaParede : 1),
      subdiv: estado.subdiv !== false,
      prioridade: form.prioridade,
      unicoNaAgencia: form.unicoNaAgencia,
      marcadoParaGeracao: form.marcadoParaGeracao,
      zonaKind: form.zonaKind,
      piso: cores.piso,
      parede: cores.parede,
      calibracao: snapshotCalibracao(),
      postosTrabalho: normalizarPostosTrabalho(estado.postosTrabalho),
      wallMedia: (estado.wallMedia || []).slice(),
    });
  }

  function pintarListaTemas() {
    const root = document.getElementById('lista-temas');
    if (!root) return;
    root.innerHTML = '';
    if (!estado.temas.length) {
      const vazio = document.createElement('p');
      vazio.textContent = 'Nenhum tema salvo. Monte o palco e clique em salvar tema.';
      root.appendChild(vazio);
      return;
    }
    const porZona = {};
    for (const z of ZONAS_TILE) porZona[z.id] = [];
    for (const tema of estado.temas) {
      const zk = zonaKindOk(tema.zonaKind);
      if (!porZona[zk]) porZona[zk] = [];
      porZona[zk].push(tema);
    }
    const ordemZonas = [
      ...ZONAS_TILE.map((z) => z.id),
      ...Object.keys(porZona).filter((id) => !ZONAS_TILE.some((z) => z.id === id)),
    ];
    for (const zonaId of ordemZonas) {
      const grupo = porZona[zonaId] || [];
      if (!grupo.length) continue;
      const cab = document.createElement('div');
      cab.className = 'tema-grupo';
      cab.textContent = nomeZonaTile(zonaId) + ' · ' + zonaId;
      root.appendChild(cab);
      grupo.sort((a, b) =>
        (b.marcadoParaGeracao ? 1 : 0) - (a.marcadoParaGeracao ? 1 : 0) ||
        (b.prioridade || 0) - (a.prioridade || 0) ||
        a.nome.localeCompare(b.nome),
      );
      for (const tema of grupo) {
        const g = tema.grade || { w: '?', h: '?' };
        const row = document.createElement('div');
        row.className = 'tema-row' + (tema.marcadoParaGeracao ? ' tema-marcado' : '');
        row.setAttribute('role', 'listitem');
        const lab = document.createElement('span');
        lab.textContent =
          tema.nome +
          ' · ' + nomeZonaTile(zonaId) +
          ' · ' + g.w + 'x' + g.h +
          ' · P' + (tema.prioridade || 5) +
          (tema.unicoNaAgencia ? ' · unico' : '') +
          (tema.marcadoParaGeracao ? ' · MARCADO' : '') +
          ' · ' + (tema.palco || []).length + ' pecas' +
          ' · ' + (tema.piso || tema.tilesetAtivo) +
          (temasOrigem === 'localStorage' ? ' · rascunho local' : '');
        const marcarBtn = document.createElement('button');
        marcarBtn.type = 'button';
        marcarBtn.textContent = tema.marcadoParaGeracao ? 'desmarcar' : 'usar na geracao';
        marcarBtn.title = 'Marca esta opcao da zona para Viewtest/Room';
        marcarBtn.addEventListener('click', () => {
          const ativar = !tema.marcadoParaGeracao;
          for (const t of estado.temas) {
            if (t.zonaKind === tema.zonaKind) t.marcadoParaGeracao = false;
          }
          tema.marcadoParaGeracao = ativar;
          atualizarJsonOut();
          pintarListaTemas();
          void persistirTemasNoDisco('marcar');
        });
        const carregarBtn = document.createElement('button');
        carregarBtn.type = 'button';
        carregarBtn.textContent = 'carregar';
        carregarBtn.addEventListener('click', () => aplicarTema(tema));
        const apagarBtn = document.createElement('button');
        apagarBtn.type = 'button';
        apagarBtn.textContent = 'apagar';
        apagarBtn.addEventListener('click', () => {
          estado.temas = estado.temas.filter((x) => x.id !== tema.id);
          atualizarJsonOut();
          pintarListaTemas();
          void persistirTemasNoDisco('apagar');
        });
        row.appendChild(lab);
        row.appendChild(marcarBtn);
        row.appendChild(carregarBtn);
        row.appendChild(apagarBtn);
        root.appendChild(row);
      }
    }
  }

  async function preencherThumbCombo(cv, combo) {
    const g = cv.getContext('2d');
    g.fillStyle = '#222';
    g.fillRect(0, 0, 140, 72);
    for (const cam of combo.camadas || []) {
      const s = specPorId(cam.assetId);
      if (!s || !s.fileName) continue;
      try {
        const img = await carregar(s.fileName);
        const b = medirBbox(img);
        const t = thumb(img, b, 80, 56);
        g.drawImage(t, 30 + (cam.dx || 0) * 0.25, 8 + (cam.dy || 0) * 0.25);
      } catch { /* ignore */ }
    }
  }

  const canvasCompose = document.getElementById('palco-compose');
  const ctxCompose = canvasCompose ? canvasCompose.getContext('2d') : null;
  if (ctxCompose) ctxCompose.imageSmoothingEnabled = false;
  let geraCompose = 0;

  const DECOR_KINDS = { laptop: 1, monitor: 1, keyboard: 1, mouse: 1, books: 1, radio: 1 };

  /** Menor = desenhado primeiro = atras na perspectiva da camera. */
  function faixaDeCamada(spec) {
    if (!spec) return 2;
    if (spec.kind === 'rug') return 0;
    if (spec.kind === 'chair' || spec.kind === 'sofa') return 1;
    if (spec.papel === 'decor' || DECOR_KINDS[spec.kind]) return 3;
    return 2;
  }

  function indiceInsercao(spec) {
    const faixa = faixaDeCamada(spec);
    for (let i = 0; i < estado.composeCamadas.length; i++) {
      const s = specPorId(estado.composeCamadas[i].assetId);
      if (faixaDeCamada(s) > faixa) return i;
    }
    return estado.composeCamadas.length;
  }

  function retanguloCamada(cam, spec, bbox) {
    const item = { gx: 0, gy: 0, qx: 0, qy: 0, passo: 1 };
    const origem = {
      x: COMPOSE_ORIGEM.x + (cam.dx || 0),
      y: COMPOSE_ORIGEM.y + (cam.dy || 0),
    };
    const o = specDoItem(spec, cal);
    const { ox, oy, passo } = origemDoItem(item);
    let x;
    let y;
    if (o && o.modo === 'canto' && o.pe) {
      const v = iso(ox, oy);
      x = origem.x + v.x - o.pe.x;
      y = origem.y + v.y - o.pe.y;
    } else if (o && o.modo === 'centro' && o.ancora) {
      const c = iso(ox + passo / 2, oy + passo / 2);
      x = origem.x + c.x - o.ancora.x;
      y = origem.y + c.y - o.ancora.y;
    } else {
      const c = iso(ox + 0.5, oy + 0.5);
      x = origem.x + c.x - (bbox.x + bbox.w / 2);
      y = origem.y + c.y - (bbox.y + bbox.h);
    }
    return { x: x + bbox.x, y: y + bbox.y, w: bbox.w, h: bbox.h };
  }

  async function desenharCompose() {
    if (!ctxCompose || !canvasCompose) return;
    const eu = ++geraCompose;
    const pisoSrc = DIR_TILES + '/Floor_128_' + resolverCores(catalogo, estado).piso + '.png';
    let piso = null;
    try {
      piso = await carregar(pisoSrc);
    } catch { /* piso */ }
    const loaded = [];
    for (const cam of estado.composeCamadas) {
      const s = specPorId(cam.assetId);
      if (!s || s.camadas || !s.fileName) continue;
      try {
        const img = await carregar(s.fileName);
        const bbox = await bboxDe(s.fileName);
        loaded.push({ cam, s, img, bbox });
      } catch { /* png */ }
    }
    if (eu !== geraCompose) return;
    withOrigemAbs(COMPOSE_ORIGEM.x, COMPOSE_ORIGEM.y, () => {
      ctxCompose.clearRect(0, 0, canvasCompose.width, canvasCompose.height);
      if (piso) blitTile(ctxCompose, piso, 0, 0, ancoraPiso, 1);
      losango(ctxCompose, 0, 0, '#f5d76e', 'rgba(245, 215, 110, 0.08)', 1);
      const c = iso(0.5, 0.5);
      ctxCompose.fillStyle = '#ff3b3b';
      ctxCompose.beginPath();
      ctxCompose.arc(ORIGEM.x + c.x, ORIGEM.y + c.y, 2, 0, Math.PI * 2);
      ctxCompose.fill();
      const item = { gx: 0, gy: 0, qx: 0, qy: 0, passo: 1 };
      for (const L of loaded) {
        withOrigemOffset(L.cam.dx || 0, L.cam.dy || 0, () => {
          blitCatalogo(ctxCompose, L.img, L.bbox, L.s, item, cal, estado.diagnostico);
        });
      }
      if (composeSel >= 0 && composeSel < estado.composeCamadas.length) {
        const cam = estado.composeCamadas[composeSel];
        const s = specPorId(cam.assetId);
        const bbox = s && s.fileName ? bboxPorSrc.get(s.fileName) : null;
        if (s && bbox) {
          const r = retanguloCamada(cam, s, bbox);
          ctxCompose.strokeStyle = '#f5d76e';
          ctxCompose.lineWidth = 1;
          ctxCompose.strokeRect(r.x - 0.5, r.y - 0.5, r.w + 1, r.h + 1);
        }
      }
    });
  }

  function preencherFormCombo(spec) {
    const nomeEl = document.getElementById('combo-nome');
    const kindEl = document.getElementById('combo-kind');
    const papelEl = document.getElementById('combo-papel');
    const idEl = document.getElementById('combo-id');
    if (estado.composeCamadas.length !== 1) return;
    if (nomeEl && !nomeEl.value) nomeEl.value = spec.nome || '';
    if (kindEl) kindEl.value = spec.papel === 'decor' ? 'desk' : (spec.kind || 'desk');
    if (papelEl) papelEl.value = spec.papel === 'decor' ? 'prop' : (spec.papel || 'prop');
    if (idEl && !idEl.value && spec.assetId) idEl.value = spec.assetId + '-combo';
  }

  function adicionarAoCompose(spec) {
    marcarUndo();
    if (spec.camadas && spec.camadas.length) {
      for (const cam of spec.camadas) {
        estado.composeCamadas.push({
          assetId: cam.assetId,
          dx: cam.dx || 0,
          dy: cam.dy || 0,
        });
      }
      composeSel = estado.composeCamadas.length - 1;
    } else {
      const peca = {
        assetId: spec.assetId,
        dx: 0,
        dy: spec.papel === 'decor' ? -16 : 0,
      };
      const ix = indiceInsercao(spec);
      estado.composeCamadas.splice(ix, 0, peca);
      composeSel = ix;
      preencherFormCombo(spec);
    }
    if (spec.fileName) bboxDe(spec.fileName).catch(() => undefined);
    desenharCompose();
    pintarListaCamadas();
    gravarEstado(estado);
  }

  function selecionarCamada(idx) {
    composeSel = idx;
    pintarListaCamadas();
    desenharCompose();
  }

  function removerCamada(idx) {
    if (idx == null) idx = composeSel;
    if (idx < 0 || idx >= estado.composeCamadas.length) return;
    marcarUndo();
    estado.composeCamadas.splice(idx, 1);
    if (!estado.composeCamadas.length) composeSel = -1;
    else if (composeSel === idx) composeSel = Math.min(idx, estado.composeCamadas.length - 1);
    else if (composeSel > idx) composeSel -= 1;
    desenharCompose();
    pintarListaCamadas();
    gravarEstado(estado);
  }

  function moverCamada(dir) {
    const i = composeSel;
    const j = i + dir;
    if (i < 0 || j < 0 || j >= estado.composeCamadas.length) return;
    marcarUndo();
    const tmp = estado.composeCamadas[i];
    estado.composeCamadas[i] = estado.composeCamadas[j];
    estado.composeCamadas[j] = tmp;
    composeSel = j;
    desenharCompose();
    pintarListaCamadas();
    gravarEstado(estado);
  }

  function pintarListaCamadas() {
    const root = document.getElementById('lista-camadas');
    if (!root) return;
    root.innerHTML = '';
    if (!estado.composeCamadas.length) {
      const vazio = document.createElement('p');
      vazio.className = 'hint-combo';
      vazio.textContent = 'Nenhuma peca ainda. Clique um card para comecar.';
      root.appendChild(vazio);
      return;
    }
    const last = estado.composeCamadas.length - 1;
    estado.composeCamadas.forEach((cam, i) => {
      const s = specPorId(cam.assetId);
      const row = document.createElement('li');
      row.className = 'camada-row' + (i === composeSel ? ' sel' : '');
      row.setAttribute('role', 'listitem');
      const zlab = document.createElement('span');
      zlab.className = 'zlab';
      zlab.textContent = i === 0 ? 'atras' : (i === last ? 'frente' : String(i + 1));
      const nome = document.createElement('button');
      nome.type = 'button';
      nome.className = 'nome-cam';
      nome.textContent = (s ? s.nome : cam.assetId) + '  ' + (s ? s.kind : '');
      nome.addEventListener('click', () => selecionarCamada(i));
      const acoes = document.createElement('span');
      acoes.className = 'acoes';
      const bAtras = document.createElement('button');
      bAtras.type = 'button';
      bAtras.textContent = 'atras';
      bAtras.disabled = i === 0;
      bAtras.addEventListener('click', (ev) => {
        ev.stopPropagation();
        composeSel = i;
        moverCamada(-1);
      });
      const bFrente = document.createElement('button');
      bFrente.type = 'button';
      bFrente.textContent = 'frente';
      bFrente.disabled = i === last;
      bFrente.addEventListener('click', (ev) => {
        ev.stopPropagation();
        composeSel = i;
        moverCamada(1);
      });
      const bRem = document.createElement('button');
      bRem.type = 'button';
      bRem.textContent = 'remover';
      bRem.addEventListener('click', (ev) => {
        ev.stopPropagation();
        removerCamada(i);
      });
      acoes.appendChild(bAtras);
      acoes.appendChild(bFrente);
      acoes.appendChild(bRem);
      row.appendChild(zlab);
      row.appendChild(nome);
      row.appendChild(acoes);
      row.addEventListener('click', () => selecionarCamada(i));
      root.appendChild(row);
    });
  }

  function camadaSobPonto(px, py) {
    const folga = 10;
    for (let i = estado.composeCamadas.length - 1; i >= 0; i--) {
      const cam = estado.composeCamadas[i];
      const s = specPorId(cam.assetId);
      if (!s || !s.fileName) continue;
      const bbox = bboxPorSrc.get(s.fileName);
      if (!bbox) continue;
      const r = retanguloCamada(cam, s, bbox);
      if (px >= r.x - folga && px <= r.x + r.w + folga && py >= r.y - folga && py <= r.y + r.h + folga) {
        return i;
      }
    }
    return -1;
  }

  function aplicarPaineis() {
    document.querySelectorAll('details[data-painel]').forEach((el) => {
      const id = el.dataset.painel;
      el.open = !!(estado.paineis && estado.paineis[id]);
    });
  }

  function ligarPaineis() {
    document.querySelectorAll('details[data-painel]').forEach((el) => {
      el.addEventListener('toggle', () => {
        if (!estado.paineis) estado.paineis = paineisPadrao();
        estado.paineis[el.dataset.painel] = el.open;
        gravarEstado(estado);
      });
    });
    aplicarPaineis();
  }

  function setCombinando(on) {
    estado.combinando = !!on;
    const painel = document.getElementById('painel-combinar');
    const btn = document.getElementById('btn-combinar');
    const listaCam = document.getElementById('lista-camadas');
    const canvasPalco = document.getElementById('palco');
    const canvasComp = document.getElementById('palco-compose');
    const toolbarPalco = document.getElementById('toolbar-palco');
    const barraGrade = document.getElementById('barra-grade');
    const btnPalco = document.getElementById('btn-modo-palco');
    const btnComb = document.getElementById('btn-modo-combinar');
    if (painel) painel.hidden = !estado.combinando;
    if (listaCam) listaCam.hidden = !estado.combinando;
    if (canvasPalco) canvasPalco.hidden = !!estado.combinando;
    if (canvasComp) canvasComp.hidden = !estado.combinando;
    if (toolbarPalco) toolbarPalco.hidden = !!estado.combinando;
    if (barraGrade) barraGrade.hidden = !!estado.combinando;
    if (btn) {
      btn.classList.toggle('ativo', estado.combinando);
      btn.setAttribute('aria-pressed', estado.combinando ? 'true' : 'false');
    }
    if (btnPalco) {
      btnPalco.classList.toggle('ativo', !estado.combinando);
      btnPalco.setAttribute('aria-selected', estado.combinando ? 'false' : 'true');
    }
    if (btnComb) {
      btnComb.classList.toggle('ativo', estado.combinando);
      btnComb.setAttribute('aria-selected', estado.combinando ? 'true' : 'false');
    }
    if (estado.combinando) {
      desenharCompose();
      pintarListaCamadas();
    } else {
      pintarListaParede();
      desenharPalco();
    }
    atualizarCelulaTxt();
  }

  function kindsDoCatalogo() {
    return new Set(catalogo.assets.map((a) => a.kind));
  }

  function salvarCombinacao() {
    const nomeEl = document.getElementById('combo-nome');
    const kindEl = document.getElementById('combo-kind');
    const papelEl = document.getElementById('combo-papel');
    const idEl = document.getElementById('combo-id');
    const nome = (nomeEl.value || '').trim();
    let kind = (kindEl.value || '').trim();
    const papel = papelEl.value === 'decor' ? 'decor' : 'prop';
    let id = slugTema((idEl.value || nome).trim());
    if (!nome) {
      nomeEl.focus();
      return;
    }
    if (estado.composeCamadas.length < 2) {
      const b = document.getElementById('btn-compose-salvar');
      if (b) {
        const old = b.textContent;
        b.textContent = 'precisa de 2 pecas';
        setTimeout(() => { b.textContent = old; }, 1400);
      }
      return;
    }
    const kindsOk = kindsDoCatalogo();
    const primeira = specPorId(estado.composeCamadas[0].assetId);
    if (!kindsOk.has(kind)) kind = (primeira && primeira.kind) || 'desk';
    const baseId = id;
    let n = 2;
    while (catalogo.assets.some((a) => a.assetId === id)) {
      id = baseId + '-' + n;
      n += 1;
    }
    const combo = {
      assetId: id,
      nome: nome,
      kind: kind,
      papel: papel,
      uso: 'aleatorio',
      camadas: estado.composeCamadas.map((c) => ({
        assetId: c.assetId,
        dx: Math.round(c.dx || 0),
        dy: Math.round(c.dy || 0),
      })),
    };
    const ix = estado.combos.findIndex((c) => c.assetId === id);
    if (ix >= 0) estado.combos[ix] = combo;
    else estado.combos.push(combo);
    estado.usos[id] = combo.uso;
    idEl.value = id;
    kindEl.value = kind;
    montarCards();
    gravarEstado(estado);
    void persistirCombosNoDisco('combo');
  }

  if (canvasCompose) {
    canvasCompose.addEventListener('mousedown', (ev) => {
      const r = canvasCompose.getBoundingClientRect();
      const px = (ev.clientX - r.left) * (canvasCompose.width / r.width);
      const py = (ev.clientY - r.top) * (canvasCompose.height / r.height);
      const idx = camadaSobPonto(px, py);
      composeSel = idx;
      pintarListaCamadas();
      desenharCompose();
      if (idx < 0) return;
      const cam = estado.composeCamadas[idx];
      arraste = { idx, x0: px, y0: py, dx0: cam.dx || 0, dy0: cam.dy || 0 };
      canvasCompose.classList.add('arrastando');
      ev.preventDefault();
    });
    window.addEventListener('mousemove', (ev) => {
      if (!arraste) return;
      const r = canvasCompose.getBoundingClientRect();
      const px = (ev.clientX - r.left) * (canvasCompose.width / r.width);
      const py = (ev.clientY - r.top) * (canvasCompose.height / r.height);
      const cam = estado.composeCamadas[arraste.idx];
      if (!cam) return;
      if (!undoDoArraste) {
        marcarUndo();
        undoDoArraste = true;
      }
      cam.dx = Math.round(arraste.dx0 + (px - arraste.x0));
      cam.dy = Math.round(arraste.dy0 + (py - arraste.y0));
      desenharCompose();
    });
    window.addEventListener('mouseup', () => {
      if (arraste) {
        arraste = null;
        undoDoArraste = false;
        if (canvasCompose) canvasCompose.classList.remove('arrastando');
        gravarEstado(estado);
      }
    });
  }

  function pontoDoCanvas(cv, ev) {
    const r = cv.getBoundingClientRect();
    return {
      x: (ev.clientX - r.left) * (cv.width / r.width),
      y: (ev.clientY - r.top) * (cv.height / r.height),
    };
  }

  function geomMidiaCalib(mid) {
    const preset = IFRAME_FRAMES[mid.frame] || IFRAME_FRAMES.none;
    const pe = peDaFace(mid.face);
    const v = verticeDaFace(mid.face, mid.gx, mid.gy);
    const topLeft = posBlitVertice(v.vx, v.vy, pe, mid.dx || 0, mid.dy || 0);
    let sw;
    let sh;
    if (mid.frame && mid.frame !== 'none') {
      sw = preset.sw;
      sh = preset.sh;
    } else {
      const span = mid.size?.w || preset.span;
      sw = span * (LARGURA_TILE / 2);
      sh = mid.heightPx || preset.heightPx;
    }
    return { topLeft, sw, sh };
  }

  function cantosCenaDaMidia(mid) {
    const { topLeft, sw, sh } = geomMidiaCalib(mid);
    const corners = cantosDaMidia(mid);
    const pt = (p) => ({ x: topLeft.x + p.u * sw, y: topLeft.y + p.v * sh });
    return {
      tl: pt(corners.tl),
      tr: pt(corners.tr),
      br: pt(corners.br),
      bl: pt(corners.bl),
      topLeft,
      sw,
      sh,
      corners,
    };
  }

  function pontoEmPoligonoLab(p, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x;
      const yi = poly[i].y;
      const xj = poly[j].x;
      const yj = poly[j].y;
      const intersect = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi + 1e-12) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function hitHandleCalib(pt) {
    if (iframeCalibIx == null) return null;
    const mid = estado.wallMedia[iframeCalibIx];
    if (!mid || !mid.face) return null;
    const { topLeft, sw, sh, corners } = cantosCenaDaMidia(mid);
    if (!mid.screenCorners) mid.screenCorners = { ...corners };
    const candidates = [
      ['tl', corners.tl],
      ['tr', corners.tr],
      ['br', corners.br],
      ['bl', corners.bl],
    ];
    if (mid.warpGrid && mid.warpGrid.points) {
      const { cols, rows, points } = mid.warpGrid;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const p = points[r * cols + c];
          if (p) candidates.push([`w:${r}:${c}`, p]);
        }
      }
    }
    for (const [id, uv] of candidates) {
      const hx = topLeft.x + uv.u * sw;
      const hy = topLeft.y + uv.v * sh;
      if (Math.hypot(pt.x - hx, pt.y - hy) <= 10) return { id, mid };
    }
    return null;
  }

  /** Miolo do nest (nao nas alcas) — move no espaco como objeto Word. */
  function hitNestBody(pt) {
    const lista = estado.wallMedia || [];
    const ordem = [];
    if (iframeCalibIx != null && lista[iframeCalibIx]) ordem.push(iframeCalibIx);
    for (let i = lista.length - 1; i >= 0; i--) {
      if (i !== iframeCalibIx) ordem.push(i);
    }
    for (const ix of ordem) {
      const mid = lista[ix];
      if (!mid || !mid.face) continue;
      const q = cantosCenaDaMidia(mid);
      const poly = [q.tl, q.tr, q.br, q.bl];
      if (!pontoEmPoligonoLab(pt, poly)) continue;
      // Perto de alca do item selecionado: nao e body.
      if (ix === iframeCalibIx && hitHandleCalib(pt)) continue;
      return { ix, mid };
    }
    return null;
  }

  function syncMountComMidia(mid) {
    if (!mid.mountAssetId) return;
    const peca = estado.palco.find(
      (p) =>
        itemEParede(p) &&
        p.assetId === mid.mountAssetId &&
        p.face === mid.face &&
        p.gx === mid.gx &&
        p.gy === mid.gy,
    );
    if (peca) {
      peca.dx = mid.dx || 0;
      peca.dy = mid.dy || 0;
    }
  }

  canvas.addEventListener('pointerdown', (ev) => {
    if (estado.combinando) return;
    if (marcandoAssento) {
      const pt = pontoDoCanvas(canvas, ev);
      const cel = celulaAssentoSobPonto(pt.x, pt.y);
      if (cel) {
        travarAssentoEm(cel);
        pulouClickPalco = true;
      }
      ev.preventDefault();
      return;
    }
    const pt = pontoDoCanvas(canvas, ev);
    const hitCal = hitHandleCalib(pt);
    if (hitCal) {
      arrasteCalib = { id: hitCal.id, ix: iframeCalibIx };
      arrasteNest = null;
      arrasteParede = null;
      arrastePiso = null;
      canvas.classList.add('arrastando');
      ev.preventDefault();
      return;
    }
    const hitBody = hitNestBody(pt);
    if (hitBody) {
      iframeCalibIx = hitBody.ix;
      atualizarListaIframe();
      arrasteNest = {
        ix: hitBody.ix,
        x0: pt.x,
        y0: pt.y,
        dx0: hitBody.mid.dx || 0,
        dy0: hitBody.mid.dy || 0,
      };
      arrasteCalib = null;
      arrasteParede = null;
      arrastePiso = null;
      canvas.classList.add('arrastando');
      canvas.style.cursor = 'move';
      desenharPalco();
      ev.preventDefault();
      return;
    }
    const ix = pecaPalcoSobPonto(pt.x, pt.y);
    if (ix < 0) return;
    // Alt+clique em peca interativa: nao inicia arraste (popup no click).
    if (ev.altKey) {
      const specHit = specPorId(estado.palco[ix].assetId);
      if (acaoInterativaAbreOverlay(specHit?.interativo?.acao)) {
        paredePecaIx = ix;
        pulouClickPalco = false;
        pintarListaParede();
        pintarCamadasLocais();
        desenharPalco();
        ev.preventDefault();
        return;
      }
    }
    const peca = estado.palco[ix];
    paredePecaIx = ix;
    if (itemEParede(peca)) {
      estado.paredeSel = { face: peca.face, gx: peca.gx, gy: peca.gy };
      arrasteParede = { idx: ix, x0: pt.x, y0: pt.y, dx0: peca.dx || 0, dy0: peca.dy || 0 };
      arrastePiso = null;
    } else {
      estado.celula = {
        gx: peca.gx,
        gy: peca.gy,
        qx: peca.qx || 0,
        qy: peca.qy || 0,
      };
      arrastePiso = {
        idx: ix,
        x0: pt.x,
        y0: pt.y,
        dx0: peca.dx || 0,
        dy0: peca.dy || 0,
        gx0: peca.gx,
        gy0: peca.gy,
      };
      arrasteParede = null;
    }
    canvas.classList.add('arrastando');
    pintarListaParede();
    pintarCamadasLocais();
    desenharPalco();
    ev.preventDefault();
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (arrastePiso || arrasteParede || arrasteCatalogo || arrasteCalib || arrasteNest) return;
    if (marcandoAssento) {
      const pt = pontoDoCanvas(canvas, ev);
      const cel = celulaAssentoSobPonto(pt.x, pt.y);
      if (mesmaSubcelula(cel, assentoHover)) return;
      assentoHover = cel;
      atualizarCelulaTxt();
      desenharPalco();
      return;
    }
    // Cursor Word-like sobre o nest; pointer se Alt+hover em peca interativa.
    const pt = pontoDoCanvas(canvas, ev);
    if (hitHandleCalib(pt)) {
      canvas.style.cursor = 'nwse-resize';
    } else if (hitNestBody(pt)) {
      canvas.style.cursor = 'move';
    } else if (ev.altKey) {
      const ix = pecaPalcoSobPonto(pt.x, pt.y);
      const spec = ix >= 0 ? specPorId(estado.palco[ix].assetId) : null;
      canvas.style.cursor = acaoInterativaAbreOverlay(spec?.interativo?.acao) ? 'pointer' : '';
    } else {
      canvas.style.cursor = '';
    }
  });
  canvas.addEventListener('pointerleave', () => {
    if (!marcandoAssento || !assentoHover) return;
    assentoHover = null;
    atualizarCelulaTxt();
    desenharPalco();
  });

  window.addEventListener('pointermove', (ev) => {
    if (arrasteCatalogo) {
      const dx = ev.clientX - arrasteCatalogo.x0;
      const dy = ev.clientY - arrasteCatalogo.y0;
      if (!arrasteCatalogo.moved && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        arrasteCatalogo.moved = true;
        const ghost = document.createElement('canvas');
        ghost.className = 'ghost-drag';
        ghost.width = 96;
        ghost.height = 64;
        ghost.style.left = ev.clientX - 48 + 'px';
        ghost.style.top = ev.clientY - 32 + 'px';
        document.body.appendChild(ghost);
        arrasteCatalogo.ghost = ghost;
        const spec = arrasteCatalogo.spec;
        if (spec.camadas && spec.camadas.length) {
          void preencherThumbCombo(ghost, spec);
        } else if (spec.fileName) {
          carregar(spec.fileName).then((img) => {
            const b = medirBbox(img);
            const t = thumb(img, b, 96, 64);
            ghost.getContext('2d').drawImage(t, 0, 0);
          }).catch(() => undefined);
        }
      }
      if (arrasteCatalogo.ghost) {
        arrasteCatalogo.ghost.style.left = ev.clientX - 48 + 'px';
        arrasteCatalogo.ghost.style.top = ev.clientY - 32 + 'px';
      }
      return;
    }
    if (arrasteCalib) {
      const mid = estado.wallMedia[arrasteCalib.ix];
      if (!mid) return;
      const pt = pontoDoCanvas(canvas, ev);
      const { topLeft, sw, sh } = geomMidiaCalib(mid);
      if (!undoDoArraste) {
        marcarUndo();
        undoDoArraste = true;
      }
      // UV livre relativo ao sprite (−4..5): pode estourar o bezel / preencher tela maior.
      const UV_MIN = -4;
      const UV_MAX = 5;
      const u = Math.min(UV_MAX, Math.max(UV_MIN, (pt.x - topLeft.x) / sw));
      const v = Math.min(UV_MAX, Math.max(UV_MIN, (pt.y - topLeft.y) / sh));
      if (!mid.screenCorners) mid.screenCorners = cantosDaMidia(mid);
      if (arrasteCalib.id.startsWith('w:') && mid.warpGrid) {
        const parts = arrasteCalib.id.split(':');
        const r = Number(parts[1]);
        const c = Number(parts[2]);
        const ix = r * mid.warpGrid.cols + c;
        if (mid.warpGrid.points[ix]) mid.warpGrid.points[ix] = { u, v };
      } else if (mid.screenCorners[arrasteCalib.id]) {
        mid.screenCorners[arrasteCalib.id] = { u, v };
        const sc = mid.screenCorners;
        mid.screenInset = {
          u0: Math.min(sc.tl.u, sc.bl.u),
          v0: Math.min(sc.tl.v, sc.tr.v),
          u1: Math.max(sc.tr.u, sc.br.u),
          v1: Math.max(sc.bl.v, sc.br.v),
        };
      }
      pulouClickPalco = true;
      desenharPalco();
      return;
    }
    if (arrasteNest) {
      const mid = estado.wallMedia[arrasteNest.ix];
      if (!mid) return;
      const pt = pontoDoCanvas(canvas, ev);
      if (!undoDoArraste) {
        marcarUndo();
        undoDoArraste = true;
      }
      mid.dx = Math.round(arrasteNest.dx0 + (pt.x - arrasteNest.x0));
      mid.dy = Math.round(arrasteNest.dy0 + (pt.y - arrasteNest.y0));
      syncMountComMidia(mid);
      pulouClickPalco = true;
      desenharPalco();
      return;
    }
    if (arrasteParede) {
      const peca = estado.palco[arrasteParede.idx];
      if (!peca || !itemEParede(peca)) return;
      const pt = pontoDoCanvas(canvas, ev);
      if (!undoDoArraste) {
        marcarUndo();
        undoDoArraste = true;
      }
      peca.dx = Math.round(arrasteParede.dx0 + (pt.x - arrasteParede.x0));
      peca.dy = Math.round(arrasteParede.dy0 + (pt.y - arrasteParede.y0));
      // Mantem iframes ligados a esta moldura sincronizados.
      for (const mid of estado.wallMedia || []) {
        if (
          mid.mountAssetId === peca.assetId &&
          mid.face === peca.face &&
          mid.gx === peca.gx &&
          mid.gy === peca.gy
        ) {
          mid.dx = peca.dx;
          mid.dy = peca.dy;
        }
      }
      pulouClickPalco = true;
      desenharPalco();
      return;
    }
    if (arrastePiso) {
      const peca = estado.palco[arrastePiso.idx];
      if (!peca || itemEParede(peca)) return;
      const pt = pontoDoCanvas(canvas, ev);
      if (!undoDoArraste) {
        marcarUndo();
        undoDoArraste = true;
      }
      if (ev.shiftKey) {
        // Shift: snap legado aos quartis.
        const g = telaParaGrade(pt.x, pt.y, true);
        if (g.gx >= 0 && g.gx < gradeW() && g.gy >= 0 && g.gy < gradeH()) {
          peca.gx = g.gx;
          peca.gy = g.gy;
          peca.qx = g.qx || 0;
          peca.qy = g.qy || 0;
          peca.passo = 0.5;
          peca.dx = 0;
          peca.dy = 0;
          estado.celula = { gx: g.gx, gy: g.gy, qx: g.qx || 0, qy: g.qy || 0 };
          pulouClickPalco = true;
          desenharPalco();
        }
        return;
      }
      // Livre: pe acompanha o ponteiro relativo ao grab; rebaseia gx/gy.
      const a0 = ancoraTelaCelula(arrastePiso.gx0, arrastePiso.gy0);
      const footX = a0.x + arrastePiso.dx0 + (pt.x - arrastePiso.x0);
      const footY = a0.y + arrastePiso.dy0 + (pt.y - arrastePiso.y0);
      const g = telaParaGrade(footX, footY, false);
      if (g.gx >= 0 && g.gx < gradeW() && g.gy >= 0 && g.gy < gradeH()) {
        const off = offsetPisoDoPonto(footX, footY, g.gx, g.gy);
        peca.gx = g.gx;
        peca.gy = g.gy;
        peca.qx = 0;
        peca.qy = 0;
        peca.passo = 1;
        peca.dx = off.dx;
        peca.dy = off.dy;
        estado.celula = { gx: g.gx, gy: g.gy, qx: 0, qy: 0 };
        pulouClickPalco = true;
        desenharPalco();
      }
    }
  });
  window.addEventListener('pointerup', (ev) => {
    if (arrasteCatalogo) {
      const drag = arrasteCatalogo;
      arrasteCatalogo = null;
      document.querySelectorAll('.card.dragging').forEach((el) => el.classList.remove('dragging'));
      if (drag.ghost) drag.ghost.remove();
      if (drag.moved) {
        const alvo = estado.combinando ? canvasCompose : canvas;
        if (alvo && !alvo.hidden) {
          const r = alvo.getBoundingClientRect();
          if (
            ev.clientX >= r.left &&
            ev.clientX <= r.right &&
            ev.clientY >= r.top &&
            ev.clientY <= r.bottom
          ) {
            const px = (ev.clientX - r.left) * (alvo.width / r.width);
            const py = (ev.clientY - r.top) * (alvo.height / r.height);
            if (estado.combinando) adicionarAoCompose(drag.spec);
            else plantarNoPonto(drag.spec, px, py, ev.shiftKey);
            gravarEstado(estado);
            pintarListaParede();
            pintarCamadasLocais();
          }
        }
        pulouClickPalco = true;
      }
      return;
    }
    if (arrasteParede) {
      const peca = estado.palco[arrasteParede.idx];
      if (peca && itemEParede(peca)) {
        estado.palco[arrasteParede.idx] = rebasearAnexoParede(
          peca,
          gradeW(),
          gradeH(),
          { R: peR, L: peL },
        );
        estado.paredeSel = {
          face: estado.palco[arrasteParede.idx].face,
          gx: estado.palco[arrasteParede.idx].gx,
          gy: estado.palco[arrasteParede.idx].gy,
        };
        if (!anexoParedeValido(estado.palco[arrasteParede.idx])) {
          const status = document.getElementById('tema-persist-status');
          if (status) {
            status.dataset.ok = '0';
            status.textContent = 'anexo fora da parede; reposicione antes de salvar';
          }
        }
      }
      arrasteParede = null;
      undoDoArraste = false;
      canvas.classList.remove('arrastando');
      gravarEstado(estado);
      pintarListaParede();
      pintarCamadasLocais();
      desenharPalco();
      return;
    }
    if (arrasteCalib) {
      arrasteCalib = null;
      undoDoArraste = false;
      canvas.classList.remove('arrastando');
      canvas.style.cursor = '';
      gravarEstado(estado);
      desenharPalco();
      return;
    }
    if (arrasteNest) {
      arrasteNest = null;
      undoDoArraste = false;
      canvas.classList.remove('arrastando');
      canvas.style.cursor = '';
      gravarEstado(estado);
      desenharPalco();
      return;
    }
    if (arrastePiso) {
      arrastePiso = null;
      undoDoArraste = false;
      canvas.classList.remove('arrastando');
      gravarEstado(estado);
      pintarCamadasLocais();
      desenharPalco();
    }
  });

  canvas.addEventListener('click', (ev) => {
    if (pulouClickPalco) {
      pulouClickPalco = false;
      return;
    }
    if (estado.combinando) return;
    if (marcandoAssento) {
      // Fallback: se o pointerdown nao capturou, trava pelo click.
      const pt = pontoDoCanvas(canvas, ev);
      const cel = celulaAssentoSobPonto(pt.x, pt.y);
      if (cel) travarAssentoEm(cel);
      return;
    }
    const pt = pontoDoCanvas(canvas, ev);
    const ix = pecaPalcoSobPonto(pt.x, pt.y);
    // Alt+clique: abre overlay em pecas interativas (popup / live_pov).
    if (ev.altKey && ix >= 0) {
      const spec = specPorId(estado.palco[ix].assetId);
      if (acaoInterativaAbreOverlay(spec?.interativo?.acao)) {
        abrirPopupInterativo(spec.interativo);
        ev.preventDefault();
        return;
      }
    }
    if (ix >= 0) {
      const peca = estado.palco[ix];
      paredePecaIx = ix;
      if (itemEParede(peca)) {
        estado.paredeSel = { face: peca.face, gx: peca.gx, gy: peca.gy };
      } else {
        estado.celula = {
          gx: peca.gx,
          gy: peca.gy,
          qx: peca.qx || 0,
          qy: peca.qy || 0,
        };
      }
      atualizarCelulaTxt();
      pintarListaParede();
      pintarCamadasLocais();
      desenharPalco();
      return;
    }
    // Clique no chao vazio: limpa selecao. Nao captura celula/face â€”
    // isso atrapalhava o DnD e forÃ§ava overlays mentais de grade.
    paredePecaIx = -1;
    if (!estado.diagnostico) estado.paredeSel = null;
    atualizarCelulaTxt();
    pintarListaParede();
    pintarCamadasLocais();
    desenharPalco();
  });
  const bind = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  };
  bind('btn-gx-plus', () => alterarGrade(1, 0));
  bind('btn-gx-minus', () => alterarGrade(-1, 0));
  bind('btn-gy-plus', () => alterarGrade(0, 1));
  bind('btn-gy-minus', () => alterarGrade(0, -1));
  bind('btn-andar-plus', () => alterarAndares(1));
  bind('btn-andar-minus', () => alterarAndares(-1));
  bind('btn-subida-plus', () => alterarSubida(1));
  bind('btn-subida-minus', () => alterarSubida(-1));
  bind('btn-altura-parede-plus', () => alterarAlturaParede(1));
  bind('btn-altura-parede-minus', () => alterarAlturaParede(-1));
  pintarBarraGrade();
  const chkDiag = document.getElementById('chk-diag');
  if (chkDiag) {
    chkDiag.checked = !!estado.diagnostico;
    chkDiag.addEventListener('change', (ev) => {
      estado.diagnostico = ev.target.checked;
      desenharPalco();
    });
  }
  const chkSubdiv = document.getElementById('chk-subdiv');
  if (chkSubdiv) {
    chkSubdiv.checked = true;
    estado.subdiv = true;
  }
  function setModoPlantar(modo) {
    estado.modoPlantar = modo === 'parede' ? 'parede' : 'piso';
    const radioP = document.getElementById('radio-piso');
    const radioW = document.getElementById('radio-parede');
    if (radioP) radioP.checked = estado.modoPlantar === 'piso';
    if (radioW) radioW.checked = estado.modoPlantar === 'parede';
    if (canvas) canvas.style.cursor = 'grab';
    if (estado.modoPlantar === 'piso') {
      /* keep paredePecaIx for chip selection */
    }
    atualizarCelulaTxt();
    gravarEstado(estado);
    desenharPalco();
  }
  setModoPlantar(estado.modoPlantar);
  document.getElementById('btn-padrao').addEventListener('click', () => {
    marcarUndo();
    estado.palco = (catalogo.palcoPadrao || []).map(palcoItemNormalizado);
    estado.celula = { gx: 1, gy: 1, qx: 0, qy: 0 };
    desenharPalco();
  });
  document.getElementById('btn-limpar').addEventListener('click', () => {
    marcarUndo();
    estado.palco = [];
    desenharPalco();
  });
  document.getElementById('btn-reset').addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    const fresco = estadoDoCatalogo(catalogo, temasDoc.temas || []);
    Object.assign(estado, fresco);
    estado.usos = fresco.usos;
    estado.palco = fresco.palco;
    estado.temas = fresco.temas;
    estado.combos = (combosDoc.combinacoes || []).slice();
    estado.composeCamadas = [];
    estado.combinando = false;
    composeSel = -1;
    estado.subdiv = true;
    estado.modoPlantar = 'piso';
    estado.paredeSel = null;
    paredePecaIx = -1;
    estado.politicaTiles = normalizarPolitica(temasDoc.politicaTiles, catalogo);
    estado.previewZona = null;
    estado.postosTrabalho = [];
    estado.wallMedia = [];
    assentoSlotAtivo = 'seat-0';
    maxAssentos = 6;
    pintarSeletorAssentos();
    temasOrigem = 'disco';
    estado.paineis = paineisPadrao();
    document.getElementById('chk-diag').checked = false;
    const chkSub = document.getElementById('chk-subdiv');
    if (chkSub) chkSub.checked = true;
    estado.subdiv = true;
    const chkPrev = document.getElementById('chk-preview-zona');
    if (chkPrev) chkPrev.checked = true;
    document.getElementById('sel-piso').value = resolverCores(catalogo, estado).piso;
    document.getElementById('sel-parede').value = resolverCores(catalogo, estado).parede;
    const zonaTema = document.getElementById('tema-zona');
    if (zonaTema) zonaTema.value = 'sala_user';
    setModoPlantar('piso');
    setCombinando(false);
    aplicarPaineis();
    montarCards();
    pintarListaTemas();
    pintarPolitica();
    desenharPalco();
  });
  document.getElementById('btn-salvar-tema').addEventListener('click', async () => {
    const nome = document.getElementById('nome-tema').value.trim();
    if (!nome) {
      document.getElementById('nome-tema').focus();
      return;
    }
    const aviso = validarPalco(estado.palco, specPorId);
    if (!aviso.ok) {
      atualizarAvisoPalco(estado.palco);
      return;
    }
    const anexosInvalidos = estado.palco.filter((p) => itemEParede(p) && !anexoParedeValido(p));
    if (anexosInvalidos.length) {
      const status = document.getElementById('tema-persist-status');
      if (status) {
        status.dataset.ok = '0';
        status.textContent = anexosInvalidos.length + ' anexo(s) fora da parede; reposicione antes de salvar';
      }
      return;
    }
    const novo = snapshotTema(nome);
    if (novo.marcadoParaGeracao) {
      for (const t of estado.temas) {
        if (t.id !== novo.id && t.zonaKind === novo.zonaKind) t.marcadoParaGeracao = false;
      }
    }
    const ix = estado.temas.findIndex((t) => t.id === novo.id || t.nome === novo.nome);
    if (ix >= 0) estado.temas[ix] = novo;
    else estado.temas.push(novo);
    temasOrigem = 'localStorage';
    atualizarJsonOut();
    pintarListaTemas();
    await persistirTemasNoDisco('salvar');
  });
  const btnRecarregarDisco = document.getElementById('btn-recarregar-disco');
  if (btnRecarregarDisco) {
    btnRecarregarDisco.addEventListener('click', async () => {
      try {
        const res = await fetch(URL_PERSISTIR_TEMAS);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const doc = await res.json();
        estado.temas = (doc.temas || []).map(normalizarTema);
        estado.politicaTiles = normalizarPolitica(doc.politicaTiles, catalogo);
        temasOrigem = 'disco';
        gravarEstado(estado);
        pintarListaTemas();
        pintarPolitica();
        atualizarJsonOut();
        const statusEl = document.getElementById('tema-persist-status');
        if (statusEl) {
          statusEl.textContent = 'recarregado do disco Â· ' + estado.temas.length + ' temas';
          statusEl.dataset.ok = '1';
        }
      } catch (err) {
        const statusEl = document.getElementById('tema-persist-status');
        if (statusEl) {
          statusEl.textContent = 'falha ao recarregar â€” rode pnpm lab:iso';
          statusEl.dataset.ok = '0';
        }
        console.warn('[lab] recarregar do disco:', err);
      }
    });
  }
  const btnMarcarAssento = document.getElementById('btn-marcar-assento');
  if (btnMarcarAssento) {
    atualizarBotaoAssento();
    btnMarcarAssento.addEventListener('click', () => {
      setMarcandoAssento(!marcandoAssento);
    });
  }
  const selAssento = document.getElementById('assento-slot-ativo');
  if (selAssento) {
    pintarSeletorAssentos();
    selAssento.addEventListener('change', () => {
      assentoSlotAtivo = selAssento.value || ASSENTO_SLOT_PADRAO;
      desenharPalco();
    });
  }
  document.getElementById('btn-assento-add')?.addEventListener('click', adicionarSlotAssento);
  document.getElementById('btn-assento-del')?.addEventListener('click', removerSlotAssentoAtivo);
  const inputMaxAssentos = document.getElementById('assento-max');
  if (inputMaxAssentos) {
    inputMaxAssentos.addEventListener('change', () => {
      maxAssentos = clampMaxAssentos(inputMaxAssentos.value, MAX_ASSENTOS_PADRAO);
      inputMaxAssentos.value = String(maxAssentos);
      const postos = estado.postosTrabalho || [];
      if (postos.length > maxAssentos) {
        estado.postosTrabalho = normalizarPostosTrabalho(postos.slice(0, maxAssentos));
        if (!estado.postosTrabalho.some((p) => p.agentSlot === assentoSlotAtivo)) {
          assentoSlotAtivo = estado.postosTrabalho[0]?.agentSlot || 'seat-0';
        }
        gravarEstado(estado);
        desenharPalco();
      }
      pintarSeletorAssentos();
    });
  }
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && marcandoAssento) {
      setMarcandoAssento(false);
      ev.preventDefault();
      return;
    }
    if (marcandoAssento && !ev.ctrlKey && !ev.metaKey && (ev.key === 'q' || ev.key === 'Q' || ev.key === 'e' || ev.key === 'E')) {
      const slot = agentSlotAssento();
      const posto = estado.postosTrabalho.find((p) => p.agentSlot === slot);
      if (!posto) return;
      const giro = ev.key === 'q' || ev.key === 'Q' ? -1 : 1;
      const girado = girarFacingManual(posto, giro);
      Object.assign(posto, girado);
      estado.postosTrabalho = normalizarPostosTrabalho(estado.postosTrabalho);
      gravarEstado(estado);
      atualizarCelulaTxt();
      desenharPalco();
      ev.preventDefault();
    }
  });
  document.getElementById('btn-copiar-temas').addEventListener('click', async () => {
    const txt = JSON.stringify(jsonTemas(), null, 2);
    try {
      await navigator.clipboard.writeText(txt);
      document.getElementById('btn-copiar-temas').textContent = 'copiado';
      setTimeout(() => {
        document.getElementById('btn-copiar-temas').textContent = 'copiar temas JSON';
      }, 1200);
    } catch {
      document.getElementById('json-out').value = txt;
      document.getElementById('json-out').select();
    }
    await persistirTemasNoDisco('copiar');
  });
  document.getElementById('btn-copiar').addEventListener('click', async () => {
    const txt = document.getElementById('json-out').value;
    try {
      await navigator.clipboard.writeText(txt);
      document.getElementById('btn-copiar').textContent = 'copiado';
      setTimeout(() => {
        document.getElementById('btn-copiar').textContent = 'copiar JSON';
      }, 1200);
    } catch {
      document.getElementById('json-out').select();
    }
  });
  document.getElementById('filtro').addEventListener('input', () => montarCards());
  const filtroKind = document.getElementById('filtro-kind');
  if (filtroKind) filtroKind.addEventListener('change', () => montarCards());
  const filtroUso = document.getElementById('filtro-uso');
  if (filtroUso) filtroUso.addEventListener('change', () => montarCards());
  const filtroEsp = document.getElementById('filtro-espelhavel');
  if (filtroEsp) filtroEsp.addEventListener('change', () => montarCards());
  document.querySelectorAll('#filtros-papel .chip-filter').forEach((b) => {
    b.addEventListener('click', () => {
      filtroPapel = b.dataset.papel || '';
      document.querySelectorAll('#filtros-papel .chip-filter').forEach((x) => {
        x.classList.toggle('ativo', x === b);
      });
      montarCards();
    });
  });
  const btnModoPalco = document.getElementById('btn-modo-palco');
  const btnModoCombinar = document.getElementById('btn-modo-combinar');
  if (btnModoPalco) btnModoPalco.addEventListener('click', () => setModoLab('palco'));
  if (btnModoCombinar) btnModoCombinar.addEventListener('click', () => setModoLab('combinar'));
  const btnToggleBook = document.getElementById('btn-toggle-book');
  const btnBookEdge = document.getElementById('btn-book-edge');
  if (btnToggleBook) btnToggleBook.addEventListener('click', () => setBookOpen(!bookAberto));
  if (btnBookEdge) btnBookEdge.addEventListener('click', () => setBookOpen(!bookAberto));
  document.querySelectorAll('[data-book-tab]').forEach((b) => {
    b.addEventListener('click', () => setBookTab(b.dataset.bookTab));
  });
  const btnInfo = document.getElementById('btn-info-tec');
  if (btnInfo) {
    btnInfo.addEventListener('click', () => {
      const meta = document.getElementById('meta');
      if (!meta) return;
      meta.hidden = !meta.hidden;
      btnInfo.classList.toggle('ativo', !meta.hidden);
      btnInfo.setAttribute('aria-pressed', meta.hidden ? 'false' : 'true');
    });
  }
  const helpDrawer = document.getElementById('help-drawer');
  const btnHelp = document.getElementById('btn-help');
  const btnHelpClose = document.getElementById('btn-help-close');
  if (btnHelp && helpDrawer) {
    btnHelp.addEventListener('click', () => helpDrawer.classList.add('open'));
  }
  if (btnHelpClose && helpDrawer) {
    btnHelpClose.addEventListener('click', () => helpDrawer.classList.remove('open'));
  }
  if (helpDrawer) {
    helpDrawer.addEventListener('click', (ev) => {
      if (ev.target === helpDrawer) helpDrawer.classList.remove('open');
    });
  }
  const interactDrawer = document.getElementById('interact-drawer');
  const btnInteractClose = document.getElementById('btn-interact-close');
  if (btnInteractClose) {
    btnInteractClose.addEventListener('click', () => fecharPopupInterativo());
  }
  if (interactDrawer) {
    interactDrawer.addEventListener('click', (ev) => {
      if (ev.target === interactDrawer) fecharPopupInterativo();
    });
  }
  setBookTab('assets');
  setBookOpen(true);
  setCombinando(false);
  const btnCombinar = document.getElementById('btn-combinar');
  if (btnCombinar) {
    btnCombinar.addEventListener('click', () => setCombinando(!estado.combinando));
  }
  const btnComposeLimpar = document.getElementById('btn-compose-limpar');
  if (btnComposeLimpar) {
    btnComposeLimpar.addEventListener('click', () => {
      marcarUndo();
      estado.composeCamadas = [];
      composeSel = -1;
      desenharCompose();
      pintarListaCamadas();
      gravarEstado(estado);
    });
  }
  const btnComposeAtras = document.getElementById('btn-compose-atras');
  if (btnComposeAtras) {
    btnComposeAtras.addEventListener('click', () => moverCamada(-1));
  }
  const btnComposeFrente = document.getElementById('btn-compose-frente');
  if (btnComposeFrente) {
    btnComposeFrente.addEventListener('click', () => moverCamada(1));
  }
  const btnComposeRemover = document.getElementById('btn-compose-remover');
  if (btnComposeRemover) {
    btnComposeRemover.addEventListener('click', () => removerCamada());
  }
  window.addEventListener('keydown', (ev) => {
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const cmd = ev.ctrlKey || ev.metaKey;
    if (cmd && (ev.key === 'z' || ev.key === 'Z')) {
      ev.preventDefault();
      if (ev.shiftKey) refazer();
      else desfazer();
      return;
    }
    if (cmd && (ev.key === 'y' || ev.key === 'Y')) {
      ev.preventDefault();
      refazer();
      return;
    }
    // Ctrl/Cmd + E: espelha anexo de parede selecionado (badge espelho).
    // Inverte o sprite e leva para a outra face (R↔L) para encaixar na parede oposta.
    if (cmd && (ev.key === 'e' || ev.key === 'E')) {
      let ix = paredePecaIx;
      if (ix < 0 && estado.paredeSel) {
        ix = estado.palco.findIndex(
          (p) =>
            itemEParede(p) &&
            p.face === estado.paredeSel.face &&
            p.gx === estado.paredeSel.gx &&
            p.gy === estado.paredeSel.gy,
        );
      }
      if (ix >= 0) {
        const peca = estado.palco[ix];
        const spec = peca ? specPorId(peca.assetId) : null;
        if (assetEspelhavel(spec)) {
          espelharFacePeca(ix);
          ev.preventDefault();
        }
      }
      return;
    }
    // Escape: fecha popup interativo, depois limpa selecao (modo assento tem o outro listener).
    if (ev.key === 'Escape' && !marcandoAssento) {
      if (fecharPopupInterativo()) {
        ev.preventDefault();
        return;
      }
      if (limparSelecaoEditor()) ev.preventDefault();
      return;
    }
    const isDel = ev.key === 'Delete' || ev.key === 'Backspace';
    if (isDel) {
      // Delete, Backspace, Ctrl+Del / Cmd+Del: remove o selecionado.
      if (estado.combinando) removerCamada();
      else removerPecaPalco();
      ev.preventDefault();
      return;
    }
    // Ctrl/Cmd + ↑/↓: sobe/desce camada (palco e Combinar).
    if (cmd && (ev.key === 'ArrowUp' || ev.key === 'ArrowDown')) {
      const dir = ev.key === 'ArrowUp' ? 1 : -1;
      if (estado.combinando) moverCamada(dir);
      else if (paredePecaIx >= 0) moverPecaPalco(paredePecaIx, dir);
      ev.preventDefault();
      return;
    }
    if (estado.combinando) {
      if (ev.key === '[' || ev.key === 'PageDown') {
        moverCamada(-1);
        ev.preventDefault();
      } else if (ev.key === ']' || ev.key === 'PageUp') {
        moverCamada(1);
        ev.preventDefault();
      }
      return;
    }
    // Palco: z-order com [ ] / PageUp/PageDown (igual Combinar).
    if (paredePecaIx >= 0 && (ev.key === '[' || ev.key === 'PageDown')) {
      moverPecaPalco(paredePecaIx, -1);
      ev.preventDefault();
      return;
    }
    if (paredePecaIx >= 0 && (ev.key === ']' || ev.key === 'PageUp')) {
      moverPecaPalco(paredePecaIx, 1);
      ev.preventDefault();
      return;
    }
    // Anexo de parede: setas ajustam dx/dy em 1 px.
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight' || ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
      const ddx = ev.key === 'ArrowLeft' ? -1 : ev.key === 'ArrowRight' ? 1 : 0;
      const ddy = ev.key === 'ArrowUp' ? -1 : ev.key === 'ArrowDown' ? 1 : 0;
      if (nudgeAnexoSelecionado(ddx, ddy)) ev.preventDefault();
    }
  });
  const btnComposeSalvar = document.getElementById('btn-compose-salvar');
  if (btnComposeSalvar) {
    btnComposeSalvar.addEventListener('click', () => salvarCombinacao());
  }
  const btnCopiarCombos = document.getElementById('btn-copiar-combos');
  if (btnCopiarCombos) {
    btnCopiarCombos.addEventListener('click', async () => {
      const txt = JSON.stringify(jsonCombos(), null, 2);
      try {
        await navigator.clipboard.writeText(txt);
        btnCopiarCombos.textContent = 'copiado';
        setTimeout(() => {
          btnCopiarCombos.textContent = 'copiar combinacoes JSON';
        }, 1200);
      } catch {
        document.getElementById('json-out').value = txt;
        document.getElementById('json-out').select();
      }
      await persistirCombosNoDisco('copiar');
    });
  }
  await montarSwatches(catalogo.pisos, 'Floor_128_', 'sel-piso', 'swatches-piso', 'pisoLivre');
  await montarSwatches(catalogo.paredes, 'Wall_R_128_', 'sel-parede', 'swatches-parede', 'paredeLivre');
  montarSelTemaZona();
  montarSelZonas();
  await montarSwatchesZona(catalogo.pisos, 'Floor_128_', 'swatches-zona-piso', 'pisos');
  await montarSwatchesZona(catalogo.paredes, 'Wall_R_128_', 'swatches-zona-parede', 'paredes');
  const selModoZona = document.getElementById('sel-modo-zona');
  if (selModoZona) {
    selModoZona.addEventListener('change', () => setModoZona(selModoZona.value));
  }
  const chkPrevZona = document.getElementById('chk-preview-zona');
  if (chkPrevZona) {
    chkPrevZona.addEventListener('change', () => {
      syncPreviewZona();
      desenharPalco();
    });
  }
  pintarPolitica();
  await montarCards();
  await montarCardsCreate();
  pintarListaTemas();
  atualizarListaIframe();
  autoAplicarPreviewsNest();
  const btnIframePlantar = document.getElementById('btn-iframe-plantar');
  if (btnIframePlantar) btnIframePlantar.addEventListener('click', () => plantarIframeNaParede());
  const btnIframeCalib = document.getElementById('btn-iframe-calib');
  if (btnIframeCalib) {
    btnIframeCalib.addEventListener('click', () => {
      if (iframeCalibIx == null && (estado.wallMedia || []).length) iframeCalibIx = 0;
      const hint = document.getElementById('iframe-hint');
      if (hint) {
        hint.textContent = iframeCalibIx == null
          ? 'Plante uma midia antes de calibrar.'
          : 'Miolo = arrastar no espaço · cantos amarelos = UV · roxos = warp.';
      }
      atualizarListaIframe();
      desenharPalco();
    });
  }
  const btnIframeWarp = document.getElementById('btn-iframe-warp');
  if (btnIframeWarp) btnIframeWarp.addEventListener('click', () => toggleWarpIframe());
  const btnIframeExport = document.getElementById('btn-iframe-export');
  if (btnIframeExport) btnIframeExport.addEventListener('click', () => exportarPresetIframe());
  const selFrame = document.getElementById('iframe-frame');
  if (selFrame) {
    selFrame.addEventListener('change', () => {
      const p = IFRAME_FRAMES[selFrame.value] || IFRAME_FRAMES.none;
      const spanEl = document.getElementById('iframe-span');
      const hEl = document.getElementById('iframe-height');
      if (spanEl) spanEl.value = String(p.span);
      if (hEl) hEl.value = String(p.heightPx);
    });
  }
  await desenharPalco();
  atualizarAvisoPalco(estado.palco);
})().catch((err) => {
  document.getElementById('meta').textContent = String(err);
});
