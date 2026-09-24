export { desenharProto, desenharProtoEm, medidaProto } from './desenhar-proto';
export type { PecaPalcoItem } from './types';
export { CATALOGO, COMBOS, coresDoTema, calibracaoDoTema, specPorId } from './catalogo';
export {
  FRAME_PRESETS,
  presetDaFrame,
  retanguloTelaNoSprite,
  retanguloTelaWallMedia,
  posicaoMediaParede,
  type FramePreset,
  type RetanguloTela,
} from './wall-media-frame';
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
} from './screen-nest';
