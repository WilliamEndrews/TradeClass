/**
 * @tradeclass/iso-office
 *
 * Pipeline do escritorio isometrico do lab (painter, temas, 1 Boss + 1 copa),
 * sem o shell do Viewtest. Cliente e servidor usam as mesmas funcoes.
 */

export {
  selecionarPedido,
  seedDoPedido,
  seedDaGeracao,
  saltAleatorio,
  escolherTemaPonderado,
  assinaturaTemas,
  COPAS_OBRIGATORIAS,
  type PedidoGeracao,
  type ZonaPedido,
  type ProtoEscolhido,
} from './selecionar-pedido';

export {
  montarAgencia,
  montarAgenciaGeracao,
  montarAgenciaDeProtos,
  empacotarProtosFixos,
  assinaturaAgencia,
  type AgenciaMontada,
  type SlotAgencia,
  type RectAgencia,
  type CelulaAgencia,
} from './montar-agencia';

export {
  listarPlantas,
  obterPlanta,
  carregarPlanta,
  bindingsDaPlanta,
  elencoDaPlanta,
  PLANTAS_FIXAS,
  type PlantaFixa,
  type PlantaSala,
  type PlantaDesk,
} from './plants';

export {
  construirEspacoAgencia,
  ordenarElencoCliente,
  assinaturaElenco,
  celulasOcupadasPorProps,
  pontosDeInteresseNaSala,
  celulasDePasseio,
  celulasWalkableNaSala,
  agentIdsDosPostos,
  KINDS_INTERESSE,
  type CenarioEspacial,
  type AgenteEspacial,
  type PontoInteresse,
  type LayoutDaAgencia,
} from './espaco-agencia';

export {
  montarSalaLanding,
  listarQuadrosLanding,
  IDS_QUADROS_LANDING,
  type SalaLanding,
  type IdQuadroLanding,
} from './montar-sala-landing';

export {
  seriesIdDaEspecialidade,
  bindingDaEspecialidade,
  SPECIALTY_SYMBOLS,
} from '@tradeclass/contracts';

export {
  montarMundoIso,
  montarMundoDaPlanta,
  ancorarElencoNaPlanta,
  agenciaDeLayout,
  elencoIdsDoLayout,
  elencoParaPlanta,
  assinaturaElencoDe,
  resolverColisaoLab,
  COLAR_LAB,
  AGENTE_PLACEHOLDER,
  PLANTA_PADRAO_TRADECLASS,
  type MundoIso,
} from './montar-mundo';

export {
  compilarCenaIso,
  validarCenaIso,
  prepararCenaIso,
  prepararOclusoresParede,
  renderizarCenaIso,
  passoDoTrecho,
  type RenderCommand,
  type CenaIso,
  type CenaIsoPreparada,
  type OpcoesCena,
  type Bounds,
  type OclusorParede,
  type StripBaked,
} from './cena-isometrica';

export { desenharAgencia } from './desenhar-agencia';

export { OclusaoCorredor, oclusorNaFrente, type RetanguloTela } from './oclusao-parede';

export { desenharAtores, projetarAtorSentado } from './desenhar-atores';

export { iso, LARGURA_TILE, ALTURA_TILE, type Pt } from './proto-blit/iso';
export { resolverSpecLab, calibracaoDoTema, coresDoTema } from './proto-blit/catalogo';
export {
  FRAME_PRESETS,
  presetDaFrame,
  retanguloTelaWallMedia,
  posicaoMediaParede,
  type FramePreset,
  type RetanguloTela as RetanguloTelaMidia,
} from './proto-blit/wall-media-frame';
export {
  SCREEN_NEST_PRESETS,
  nestPresetPorAsset,
  nestPresetIds,
  resolverCantosTela,
  quadrilateroTelaWallMedia,
  aabbDoQuad,
  pontoEmPoligono,
  quadComoPoligono,
  homografiaMatrix3d,
  homografiaMatriz,
  aplicarHomografia,
  cssBlendMode,
  urlPareceImagem,
  resolverDisplay,
  exportarPresetSnippet,
  gradeApartirCantos,
  type ScreenNestPreset,
  type CantosResolvidos,
  type QuadTela,
} from './proto-blit/screen-nest';
