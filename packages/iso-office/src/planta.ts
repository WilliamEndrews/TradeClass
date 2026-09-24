/**
 * Superficie sem DOM: planta + elenco. O servidor importa daqui para nao
 * puxar Canvas/Image do painter.
 */

export {
  selecionarPedido,
  seedDoPedido,
  seedDaGeracao,
  COPAS_OBRIGATORIAS,
  type PedidoGeracao,
  type ZonaPedido,
  type ProtoEscolhido,
} from './selecionar-pedido';

export {
  montarAgencia,
  montarAgenciaGeracao,
  montarAgenciaDeProtos,
  assinaturaAgencia,
  type AgenciaMontada,
} from './montar-agencia';

export {
  construirEspacoAgencia,
  ordenarElencoCliente,
  type CenarioEspacial,
  type AgenteEspacial,
} from './espaco-agencia';

export {
  listarPlantas,
  carregarPlanta,
  obterPlanta,
  bindingsDaPlanta,
  elencoDaPlanta,
  type PlantaFixa,
} from './plants';

export {
  montarMundoIso,
  agenciaDeLayout,
  elencoIdsDoLayout,
  elencoParaPlanta,
  assinaturaElencoDe,
  resolverColisaoLab,
  COLAR_LAB,
  AGENTE_PLACEHOLDER,
  type MundoIso,
} from './montar-mundo';

export { resolverSpecLab } from './proto-blit/catalogo';
