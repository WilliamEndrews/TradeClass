/**
 * INTERNACIONALIZACAO (ADR-0011)
 *
 * O dicionario e plano, nao hierarquico: uma chave, uma string. Sem ICU,
 * sem pluralizacao complexa - a UI da TradeClass tem ~50 strings e nenhuma
 * precisa de regras de plural. Se um dia precisar, troca-se a implementacao
 * do `t()` sem mudar as chamadas.
 *
 * O idioma default e pt-BR (o produto nasceu em portugues). en-US e a segunda
 * lingua para demos internacionais. Adicionar um idioma novo = adicionar um
 * objeto ao dicionario, nada mais.
 */

export type Idioma = 'pt-BR' | 'en-US' | 'es-ES' | 'pseudo';

export const IDIOMAS: Idioma[] = ['pt-BR', 'en-US', 'es-ES', 'pseudo'];

export const ROTULO_IDIOMA: Record<Idioma, string> = {
  'pt-BR': 'Português',
  'en-US': 'English',
  'es-ES': 'Español',
  'pseudo': 'Pseudo',
};

type Dict = Record<string, string>;

const ptBR: Dict = {
  // Header
  'app.titulo': 'TradeClass',
  'app.subtitulo': 'Escritorio espacial para desks de trading com agentes de IA',
  'app.fonteMundo': 'Fonte do mundo',

  // Estados de conexao
  'conexao.local': 'simulando no navegador',
  'conexao.conectando': 'conectando ao servidor...',
  'conexao.conectado': 'servidor autoritativo',
  'conexao.reconectando': 'reconectando...',
  'conexao.falhou': 'servidor inalcancavel',

  // Aviso de fonte
  'app.servidorIndisponivel': 'Servidor {url} indisponivel. Simulando no navegador - o mundo mostrado NAO e o autoritativo.',

  // KPIs
  'kpi.execucoesAtivas': 'Execucoes ativas',
  'kpi.erros5min': 'Erros (5 min)',
  'kpi.tokensMin': 'Tokens / min',
  'kpi.aprovacoes': 'Aprovacoes',
  'kpi.pnlSessao': 'PnL sessao',
  'kpi.sinais': 'Sinais',
  'kpi.risco': 'Risco',

  // Painel de selecao (ADR-0009)
  'painel.selecao': 'Selecao',
  'painel.selecao.nenhuma': 'Nada selecionado — clique numa mesa, quadro ou tela.',
  'painel.selecao.agente': 'Agente: {nome}',
  'painel.selecao.mesa': 'Mesa: {id}',
  'painel.selecao.quadro': 'Quadro: {id}',
  'painel.selecao.midia': 'Tela {kind}: {id}',
  'painel.selecao.camera': 'Camera live: {id}',
  'painel.aba.config': 'Configuracoes',
  'painel.aba.contas': 'Contas',
  'painel.aba.agente': 'Agente',
  'painel.aba.grafico': 'Grafico',
  'painel.config.vazio': 'Selecione um objeto no floor para ver a configuracao.',
  'painel.config.agente': 'Configuracao do posto de {nome}.',
  'painel.config.prop': 'Objeto {kind} ({id}).',
  'painel.config.midia': 'Midia de parede {id}.',
  'painel.config.camera': 'POV da camera de cinema ({id}). Clique abre o modal live.',
  'livePov.titulo': 'Live trade — POV da camera',
  'livePov.fechar': 'Fechar',
  'livePov.viewers': '{n} assistindo',
  'livePov.agente': 'Desk {id}',
  'livePov.modoSimulado': 'Simulado · WebRTC em breve',
  'livePov.webrtcEmBreve': 'WebRTC chega no proximo ciclo — mesmo modal.',
  'painel.contas.nota': 'Conta do broker e URL do web terminal (iframes do floor).',
  'painel.contas.vazio': 'Nenhuma conta vinculada. Cole a URL https do terminal.',
  'painel.contas.nome': 'Nome da conta',
  'painel.contas.broker': 'Broker',
  'painel.contas.url': 'URL do web terminal',
  'painel.contas.salvar': 'Salvar conta',
  'painel.contas.salvando': 'Salvando…',
  'painel.contas.abrirPainel': 'Abrir no painel',
  'painel.contas.precisaToken': 'Conecte com JWT (landing / ?token=) para gravar a conta.',
  'painel.contas.falha': 'Nao foi possivel salvar a conta.',
  'painel.agente.vazio': 'Nenhum agente selecionado.',
  'painel.grafico.vazio': 'Clique numa tela de grafico na parede para abrir a serie.',
  'painel.grafico.serie': 'Serie {id} (feed API / mock).',
  'painel.propId': 'Prop',
  'painel.kind': 'Tipo',
  'painel.sala': 'Sala',
  'painel.dono': 'Dono',
  'painel.mediaId': 'Media',
  'painel.serie': 'Serie',
  'painel.saude': 'Saude',

  // Orcamento
  'orcamento.custoDia': 'Custo do dia',
  'orcamento.nota': 'Estourar o teto apaga as luzes do predio - o custo deixa de ser numero e passa a ser consequencia visivel.',

  // Dashboard
  'dashboard.titulo': 'Visao do floor',
  'dashboard.nota': 'KPIs de trade e operacao atualizados a cada tick.',
  'dashboard.historico': 'Historico',

  // Aprovacoes
  'aprovacao.titulo': 'Intervencao humana necessaria',
  'aprovacao.bloqueado': '{nome} esta bloqueado na sua porta.',
  'aprovacao.liberar': 'Liberar',

  // Listas de agentes
  'agentes.titulo': 'Agentes',
  'agentes.internaTitulo': 'Equipe interna',
  'agentes.notaInterna': 'Zelador e Tecnico sao behavior trees deterministicas, sem LLM: chamar um modelo para decidir "ir varrer" seria custo sem beneficio.',

  // Atividades
  'atividade.idle': 'disponivel',
  'atividade.walking': 'deslocando',
  'atividade.working': 'executando',
  'atividade.resting': 'em descanso',
  'atividade.waiting_approval': 'AGUARDA APROVACAO',
  'atividade.blocked': 'bloqueado',
  'atividade.sweeping': 'limpando',
  'atividade.repairing': 'reparando',
  'atividade.talking': 'em reuniao',

  // Fatos recentes
  'fatos.titulo': 'Fatos recentes',
  'fatos.nota': 'Nenhum pixel sem fato: tudo que o escritorio mostra vem de um evento desta lista.',

  // Controles
  'controles.titulo': 'Controles',
  'controles.pausar': 'Pausar',
  'controles.retomar': 'Retomar',
  'controles.novoEscritorio': 'Novo escritorio',
  'controles.semente': 'Semente',
  'controles.notaSemente': 'A mesma semente sempre gera exatamente a mesma planta. E o que torna o modo Replay possivel e os testes confiaveis.',
  'controles.layoutValido': 'Layout valido: todas as invariantes geometricas satisfeitas.',
  'controles.violacoes': '{n} violacao(oes) de invariante no layout:',

  // Legenda
  'legenda.fila': 'pilha na mesa = profundidade de fila',
  'legenda.calor': 'mesa quente = retentativas e loops',
  'legenda.luz': 'luz apagada = falha de dependencia',
  'legenda.lixo': 'lixo = trabalho concluido nao coletado',

  // Descricao de eventos
  'evento.discovered': 'novo agente descoberto: {nome} ({framework})',
  'evento.runStarted': '{nome} iniciou {label}',
  'evento.runFinished': '{nome} concluiu em {duracao}s [{status}]',
  'evento.errorRaised': '{nome} falhou: {kind} ({severity})',
  'evento.approvalRequested': '{nome} aguarda aprovacao humana',
  'evento.queueObserved': '{nome} com fila de {depth}',
  'evento.execucao': 'execucao',

  // Canvas
  'canvas.ariaLabel': 'Planta do escritorio dos agentes',

  // Camera
  'camera.reset': 'Resetar camera',
  'camera.dica': 'Scroll = zoom | Arrastar = pan | Clique = selecionar',
  'camera.dicaMobile': 'Vista top-down | Arrastar = pan | Toque = selecionar',

  // SimFirma
  'simfirma.titulo': 'SimFirma (what-if)',
  'simfirma.duracao': 'Duracao (ms)',
  'simfirma.carga': 'Carga (1x a 100x)',
  'simfirma.token': 'Token JWT',
  'simfirma.rodar': 'Rodar cenario',
  'simfirma.rodando': 'Simulando...',
  'simfirma.ticks': 'ticks',
  'simfirma.tMundo': 'tempo do mundo',
  'simfirma.requerRemoto': 'SimFirma so funciona com servidor remoto.',

  // Idioma
  'i18ma.seletor': 'Idioma',

  // Trade / selecao
  'trade.pnlSessao': 'PnL da sessao',
  'trade.sinais': 'Sinais',
  'trade.risco': 'Risco',
  'tabs.config': 'Configuracoes',
  'tabs.contas': 'Contas',
  'tabs.agente': 'Agente',
  'tabs.grafico': 'Grafico',
  'selecao.nenhuma': 'Nada selecionado — clique numa mesa, quadro ou grafico de parede.',
  'selecao.mesa': 'Mesa selecionada',
  'selecao.quadro': 'Quadro selecionado',
  'view.mobile': 'Vista mobile (planta)',
  'view.desktop': 'Vista isometrica',
};

const enUS: Dict = {
  // Header
  'app.titulo': 'TradeClass',
  'app.subtitulo': 'Spatial control plane for trading desks with AI agents',
  'app.fonteMundo': 'World source',

  // Estados de conexao
  'conexao.local': 'simulating in browser',
  'conexao.conectando': 'connecting to server...',
  'conexao.conectado': 'authoritative server',
  'conexao.reconectando': 'reconnecting...',
  'conexao.falhou': 'server unreachable',

  // Aviso de fonte
  'app.servidorIndisponivel': 'Server {url} unavailable. Simulating in browser - the world shown is NOT the authoritative one.',

  // KPIs
  'kpi.execucoesAtivas': 'Active runs',
  'kpi.erros5min': 'Errors (5 min)',
  'kpi.tokensMin': 'Tokens / min',
  'kpi.aprovacoes': 'Approvals',
  'kpi.pnlSessao': 'Session PnL',
  'kpi.sinais': 'Signals',
  'kpi.risco': 'Risk',

  // Selection panel (ADR-0009)
  'painel.selecao': 'Selection',
  'painel.selecao.nenhuma': 'Nothing selected — click a desk, board or wall screen.',
  'painel.selecao.agente': 'Agent: {nome}',
  'painel.selecao.mesa': 'Desk: {id}',
  'painel.selecao.quadro': 'Board: {id}',
  'painel.selecao.midia': 'Screen {kind}: {id}',
  'painel.selecao.camera': 'Live camera: {id}',
  'painel.aba.config': 'Settings',
  'painel.aba.contas': 'Accounts',
  'painel.aba.agente': 'Agent',
  'painel.aba.grafico': 'Chart',
  'painel.config.vazio': 'Select an object on the floor to see its settings.',
  'painel.config.agente': 'Desk settings for {nome}.',
  'painel.config.prop': 'Object {kind} ({id}).',
  'painel.config.midia': 'Wall media {id}.',
  'painel.config.camera': 'Cinema camera POV ({id}). Click opens the live modal.',
  'livePov.titulo': 'Live trade — camera POV',
  'livePov.fechar': 'Close',
  'livePov.viewers': '{n} watching',
  'livePov.agente': 'Desk {id}',
  'livePov.modoSimulado': 'Simulated · WebRTC soon',
  'livePov.webrtcEmBreve': 'WebRTC lands next cycle — same modal slot.',
  'painel.contas.nota': 'Broker account and web-terminal URL (floor iframes).',
  'painel.contas.vazio': 'No linked account. Paste the https terminal URL.',
  'painel.contas.nome': 'Account name',
  'painel.contas.broker': 'Broker',
  'painel.contas.url': 'Web terminal URL',
  'painel.contas.salvar': 'Save account',
  'painel.contas.salvando': 'Saving…',
  'painel.contas.abrirPainel': 'Open in panel',
  'painel.contas.precisaToken': 'Connect with a JWT (landing / ?token=) to save the account.',
  'painel.contas.falha': 'Could not save the account.',
  'painel.agente.vazio': 'No agent selected.',
  'painel.grafico.vazio': 'Click a wall chart screen to open the series.',
  'painel.grafico.serie': 'Series {id} (API feed / mock).',
  'painel.propId': 'Prop',
  'painel.kind': 'Kind',
  'painel.sala': 'Room',
  'painel.dono': 'Owner',
  'painel.mediaId': 'Media',
  'painel.serie': 'Series',
  'painel.saude': 'Health',

  // Budget
  'orcamento.custoDia': 'Daily cost',
  'orcamento.nota': 'Exceeding the ceiling turns off the building lights - cost stops being a number and becomes a visible consequence.',

  // Dashboard
  'dashboard.titulo': 'Floor view',
  'dashboard.nota': 'Trade and ops KPIs updated every tick.',
  'dashboard.historico': 'History',

  // Approvals
  'aprovacao.titulo': 'Human intervention required',
  'aprovacao.bloqueado': '{nome} is blocked at your door.',
  'aprovacao.liberar': 'Release',

  // Listas de agentes
  'agentes.titulo': 'Agents',
  'agentes.internaTitulo': 'Internal team',
  'agentes.notaInterna': 'Janitor and Technician are deterministic behavior trees, no LLM: calling a model to decide "go sweep" would be cost without benefit.',

  // Atividades
  'atividade.idle': 'available',
  'atividade.walking': 'moving',
  'atividade.working': 'executing',
  'atividade.resting': 'on break',
  'atividade.waiting_approval': 'AWAITING APPROVAL',
  'atividade.blocked': 'blocked',
  'atividade.sweeping': 'sweeping',
  'atividade.repairing': 'repairing',
  'atividade.talking': 'in meeting',

  // Fatos recentes
  'fatos.titulo': 'Recent events',
  'fatos.nota': 'No pixel without a fact: everything the office shows comes from an event in this list.',

  // Controles
  'controles.titulo': 'Controls',
  'controles.pausar': 'Pause',
  'controles.retomar': 'Resume',
  'controles.novoEscritorio': 'New office',
  'controles.semente': 'Seed',
  'controles.notaSemente': 'The same seed always generates exactly the same floor plan. This is what makes Replay mode possible and tests reliable.',
  'controles.layoutValido': 'Valid layout: all geometric invariants satisfied.',
  'controles.violacoes': '{n} invariant violation(s) in layout:',

  // Legenda
  'legenda.fila': 'stack on desk = queue depth',
  'legenda.calor': 'hot desk = retries and loops',
  'legenda.luz': 'light off = dependency failure',
  'legenda.lixo': 'trash = completed work not collected',

  // Descricao de eventos
  'evento.discovered': 'new agent discovered: {nome} ({framework})',
  'evento.runStarted': '{nome} started {label}',
  'evento.runFinished': '{nome} finished in {duracao}s [{status}]',
  'evento.errorRaised': '{nome} failed: {kind} ({severity})',
  'evento.approvalRequested': '{nome} awaiting human approval',
  'evento.queueObserved': '{nome} has queue depth of {depth}',
  'evento.execucao': 'execution',

  // Canvas
  'canvas.ariaLabel': 'Floor plan of the agents office',

  // Camera
  'camera.reset': 'Reset camera',
  'camera.dica': 'Scroll = zoom | Drag = pan | Click = select',
  'camera.dicaMobile': 'Top-down view | Drag = pan | Tap = select',

  // SimFirma
  'simfirma.titulo': 'SimFirma (what-if)',
  'simfirma.duracao': 'Duration (ms)',
  'simfirma.carga': 'Load (1x to 100x)',
  'simfirma.token': 'JWT token',
  'simfirma.rodar': 'Run scenario',
  'simfirma.rodando': 'Simulating...',
  'simfirma.ticks': 'ticks',
  'simfirma.tMundo': 'world time',
  'simfirma.requerRemoto': 'SimFirma only works with a remote server.',

  // Idioma
  'i18ma.seletor': 'Language',

  'trade.pnlSessao': 'Session PnL',
  'trade.sinais': 'Signals',
  'trade.risco': 'Risk',
  'tabs.config': 'Settings',
  'tabs.contas': 'Accounts',
  'tabs.agente': 'Agent',
  'tabs.grafico': 'Chart',
  'selecao.nenhuma': 'Nothing selected — click a desk, board or wall chart.',
  'selecao.mesa': 'Desk selected',
  'selecao.quadro': 'Board selected',
  'view.mobile': 'Mobile view (floor plan)',
  'view.desktop': 'Isometric view',
};

const esES: Dict = {
  // Header
  'app.titulo': 'TradeClass',
  'app.subtitulo': 'Oficina espacial para desks de trading con agentes de IA',
  'app.fonteMundo': 'Fuente del mundo',

  // Estados de conexion
  'conexao.local': 'simulando en el navegador',
  'conexao.conectando': 'conectando al servidor...',
  'conexao.conectado': 'servidor autoritativo',
  'conexao.reconectando': 'reconectando...',
  'conexao.falhou': 'servidor inalcanzable',

  // Aviso de fuente
  'app.servidorIndisponivel': 'Servidor {url} no disponible. Simulando en el navegador - el mundo mostrado NO es el autoritativo.',

  // KPIs
  'kpi.execucoesAtivas': 'Ejecuciones activas',
  'kpi.erros5min': 'Errores (5 min)',
  'kpi.tokensMin': 'Tokens / min',
  'kpi.aprovacoes': 'Aprobaciones',
  'kpi.pnlSessao': 'PnL sesion',
  'kpi.sinais': 'Senales',
  'kpi.risco': 'Riesgo',

  // Panel de seleccion (ADR-0009)
  'painel.selecao': 'Seleccion',
  'painel.selecao.nenhuma': 'Nada seleccionado — haga clic en un escritorio, tablero o pantalla.',
  'painel.selecao.agente': 'Agente: {nome}',
  'painel.selecao.mesa': 'Escritorio: {id}',
  'painel.selecao.quadro': 'Tablero: {id}',
  'painel.selecao.midia': 'Pantalla {kind}: {id}',
  'painel.selecao.camera': 'Camara live: {id}',
  'painel.aba.config': 'Configuracion',
  'painel.aba.contas': 'Cuentas',
  'painel.aba.agente': 'Agente',
  'painel.aba.grafico': 'Grafico',
  'painel.config.vazio': 'Seleccione un objeto en el floor para ver la configuracion.',
  'painel.config.agente': 'Configuracion del puesto de {nome}.',
  'painel.config.prop': 'Objeto {kind} ({id}).',
  'painel.config.midia': 'Media de pared {id}.',
  'painel.config.camera': 'POV de la camara de cine ({id}). El clic abre el modal live.',
  'livePov.titulo': 'Live trade — POV de la camara',
  'livePov.fechar': 'Cerrar',
  'livePov.viewers': '{n} viendo',
  'livePov.agente': 'Escritorio {id}',
  'livePov.modoSimulado': 'Simulado · WebRTC pronto',
  'livePov.webrtcEmBreve': 'WebRTC llega en el proximo ciclo — mismo modal.',
  'painel.contas.nota': 'Cuenta del broker y URL del web terminal (iframes del floor).',
  'painel.contas.vazio': 'Ninguna cuenta vinculada. Pega la URL https del terminal.',
  'painel.contas.nome': 'Nombre de la cuenta',
  'painel.contas.broker': 'Broker',
  'painel.contas.url': 'URL del web terminal',
  'painel.contas.salvar': 'Guardar cuenta',
  'painel.contas.salvando': 'Guardando…',
  'painel.contas.abrirPainel': 'Abrir en el panel',
  'painel.contas.precisaToken': 'Conecta con JWT (landing / ?token=) para guardar la cuenta.',
  'painel.contas.falha': 'No se pudo guardar la cuenta.',
  'painel.agente.vazio': 'Ningun agente seleccionado.',
  'painel.grafico.vazio': 'Haga clic en una pantalla de grafico para abrir la serie.',
  'painel.grafico.serie': 'Serie {id} (feed API / mock).',
  'painel.propId': 'Prop',
  'painel.kind': 'Tipo',
  'painel.sala': 'Sala',
  'painel.dono': 'Duenio',
  'painel.mediaId': 'Media',
  'painel.serie': 'Serie',
  'painel.saude': 'Salud',

  // Presupuesto
  'orcamento.custoDia': 'Costo del dia',
  'orcamento.nota': 'Superar el techo apaga las luces del edificio - el costo deja de ser un numero y pasa a ser una consecuencia visible.',

  // Dashboard
  'dashboard.titulo': 'Vista del floor',
  'dashboard.nota': 'KPIs de trade y operacion actualizados en cada tick.',
  'dashboard.historico': 'Historial',

  // Aprobaciones
  'aprovacao.titulo': 'Intervencion humana necesaria',
  'aprovacao.bloqueado': '{nome} esta bloqueado en su puerta.',
  'aprovacao.liberar': 'Liberar',

  // Listas de agentes
  'agentes.titulo': 'Agentes',
  'agentes.internaTitulo': 'Equipo interno',
  'agentes.notaInterna': 'El Conserje y el Tecnico son behavior trees deterministicos, sin LLM: llamar a un modelo para decidir "ir a barrer" seria costo sin beneficio.',

  // Actividades
  'atividade.idle': 'disponible',
  'atividade.walking': 'desplazandose',
  'atividade.working': 'ejecutando',
  'atividade.resting': 'en descanso',
  'atividade.waiting_approval': 'ESPERA APROBACION',
  'atividade.blocked': 'bloqueado',
  'atividade.sweeping': 'limpiando',
  'atividade.repairing': 'reparando',
  'atividade.talking': 'en reunion',

  // Hechos recientes
  'fatos.titulo': 'Hechos recientes',
  'fatos.nota': 'Ningun pixel sin hecho: todo lo que la oficina muestra viene de un evento de esta lista.',

  // Controles
  'controles.titulo': 'Controles',
  'controles.pausar': 'Pausar',
  'controles.retomar': 'Reanudar',
  'controles.novoEscritorio': 'Nueva oficina',
  'controles.semente': 'Semilla',
  'controles.notaSemente': 'La misma semilla siempre genera exactamente la misma planta. Esto es lo que hace posible el modo Replay y los tests confiables.',
  'controles.layoutValido': 'Layout valido: todas las invariantes geometricas satisfechas.',
  'controles.violacoes': '{n} violacion(es) de invariante en el layout:',

  // Leyenda
  'legenda.fila': 'pila en el escritorio = profundidad de la cola',
  'legenda.calor': 'escritorio caliente = reintentos y loops',
  'legenda.luz': 'luz apagada = falla de dependencia',
  'legenda.lixo': 'basura = trabajo completado no recolectado',

  // Descripcion de eventos
  'evento.discovered': 'nuevo agente descubierto: {nome} ({framework})',
  'evento.runStarted': '{nome} inicio {label}',
  'evento.runFinished': '{nome} finalizo en {duracao}s [{status}]',
  'evento.errorRaised': '{nome} fallo: {kind} ({severity})',
  'evento.approvalRequested': '{nome} espera aprobacion humana',
  'evento.queueObserved': '{nome} tiene cola de {depth}',
  'evento.execucao': 'ejecucion',

  // Canvas
  'canvas.ariaLabel': 'Plano de la oficina de los agentes',

  // Camara
  'camera.reset': 'Resetear camara',
  'camera.dica': 'Scroll = zoom | Arrastrar = pan | Clic = seleccionar',
  'camera.dicaMobile': 'Vista top-down | Arrastrar = pan | Toque = seleccionar',

  // SimFirma
  'simfirma.titulo': 'SimFirma (what-if)',
  'simfirma.duracao': 'Duracion (ms)',
  'simfirma.carga': 'Carga (1x a 100x)',
  'simfirma.token': 'Token JWT',
  'simfirma.rodar': 'Ejecutar escenario',
  'simfirma.rodando': 'Simulando...',
  'simfirma.ticks': 'ticks',
  'simfirma.tMundo': 'tiempo del mundo',
  'simfirma.requerRemoto': 'SimFirma solo funciona con servidor remoto.',

  // Idioma
  'i18ma.seletor': 'Idioma',

  'trade.pnlSessao': 'PnL de la sesion',
  'trade.sinais': 'Senales',
  'trade.risco': 'Riesgo',
  'tabs.config': 'Configuracion',
  'tabs.contas': 'Cuentas',
  'tabs.agente': 'Agente',
  'tabs.grafico': 'Grafico',
  'selecao.nenhuma': 'Nada seleccionado — haga clic en un escritorio, tablero o grafico de pared.',
  'selecao.mesa': 'Escritorio seleccionado',
  'selecao.quadro': 'Tablero seleccionado',
  'view.mobile': 'Vista movil (planta)',
  'view.desktop': 'Vista isometrica',
};

const DICCIONARIOS: Record<Idioma, Dict> = {
  'pt-BR': ptBR,
  'en-US': enUS,
  'es-ES': esES,
  'pseudo': ptBR,
};

/**
 * Aplica pseudo-localizacao: expande o texto ~30% e acentua vogais para
 * revelar quebras de layout antes de contratar tradutores.
 */
function pseudoLocalizar(s: string): string {
  const m: Record<string, string> = {
    a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú',
    A: 'Á', E: 'É', I: 'Í', O: 'Ó', U: 'Ú',
  };
  const acentuado = s.split('').map((c) => m[c] ?? c).join('');
  return `[!! ${acentuado} !!]`;
}

/**
 * Traduz uma chave, substituindo {placeholders} por valores.
 * Se a chave nao existe no idioma, cai para pt-BR. Se nao existe em nenhum,
 * devolve a chave crua - melhor que crashar a UI por uma string faltante.
 */
export function traduzir(idioma: Idioma, chave: string, vars?: Record<string, string | number>): string {
  const dict = DICCIONARIOS[idioma] ?? ptBR;
  let s = dict[chave] ?? ptBR[chave] ?? chave;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(`{${k}}`, String(v));
    }
  }
  if (idioma === 'pseudo') {
    s = pseudoLocalizar(s);
  }
  return s;
}
