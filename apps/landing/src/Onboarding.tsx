import { useState, type FormEvent } from 'react';
import {
  conectarCodigo,
  onboardEmpresa,
  simularAgencia,
  snippetEventos,
  snippetOtlp,
  urlDemoComToken,
  vincularTerminal,
  type RespostaPonte,
} from './api';

export type FaseOnboarding = 'escolher' | 'nova' | 'codigo' | 'ponte' | 'terminal';

type Props = {
  fase: FaseOnboarding;
  sessao: RespostaPonte | null;
  onFase: (fase: FaseOnboarding) => void;
  onSessao: (s: RespostaPonte) => void;
};

export default function Onboarding({ fase, sessao, onFase, onSessao }: Props) {
  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [contaLabel, setContaLabel] = useState('Mesa principal');
  const [brokerNome, setBrokerNome] = useState('');
  const [contaLogin, setContaLogin] = useState('');
  const [contaServer, setContaServer] = useState('');
  const [terminalUrl, setTerminalUrl] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [simulando, setSimulando] = useState(false);
  const [simOk, setSimOk] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  async function copiar(rotulo: string, texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(rotulo);
      window.setTimeout(() => setCopiado(null), 1600);
    } catch {
      setErro('nao foi possivel copiar');
    }
  }

  async function criar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const r = await onboardEmpresa(nome);
      onSessao(r);
      onFase('ponte');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'falha ao criar');
    } finally {
      setEnviando(false);
    }
  }

  async function conectar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const r = await conectarCodigo(codigo);
      onSessao(r);
      onFase('ponte');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'codigo nao encontrado');
    } finally {
      setEnviando(false);
    }
  }

  async function vincular(e: FormEvent) {
    e.preventDefault();
    if (!sessao) return;
    setErro(null);
    setEnviando(true);
    try {
      await vincularTerminal(sessao.token, {
        label: contaLabel.trim() || 'Mesa principal',
        brokerName: brokerNome.trim() || 'Broker',
        accountLogin: contaLogin.trim() || undefined,
        serverName: contaServer.trim() || undefined,
        webTerminalUrl: terminalUrl.trim(),
      });
      window.location.assign(urlDemoComToken(sessao.token));
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'falha ao vincular terminal');
    } finally {
      setEnviando(false);
    }
  }

  async function simular() {
    if (!sessao) return;
    setErro(null);
    setSimOk(null);
    setSimulando(true);
    try {
      const r = await simularAgencia(sessao.tenant.tenantId);
      setSimOk(
        `${r.eventos} eventos da agencia demo. Abra o escritorio para ver a planta.`,
      );
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'falha ao simular');
    } finally {
      setSimulando(false);
    }
  }

  return (
    <div className="onboard" role="dialog" aria-labelledby="onboard-titulo">
      {fase === 'escolher' && (
        <>
          <h2 id="onboard-titulo">Entrar no escritorio</h2>
          <p className="onboard-lead">
            Identifique a empresa ou cole o codigo. A telemetria so entra depois
            desta ponte.
          </p>
          <div className="onboard-portas">
            <button type="button" className="onboard-btn" onClick={() => onFase('nova')}>
              Nova empresa
            </button>
            <button type="button" className="onboard-btn onboard-btn--ghost" onClick={() => onFase('codigo')}>
              Ja tenho codigo
            </button>
          </div>
        </>
      )}

      {fase === 'nova' && (
        <form onSubmit={criar}>
          <h2 id="onboard-titulo">Nova empresa</h2>
          <p className="onboard-lead">Um nome. O servidor gera o codigo e a sessao.</p>
          <label className="onboard-label" htmlFor="empresa">
            Nome da empresa
          </label>
          <input
            id="empresa"
            className="onboard-input"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoFocus
            required
            minLength={1}
            placeholder="Acme"
          />
          {erro && <p className="onboard-erro">{erro}</p>}
          <div className="onboard-acoes">
            <button type="button" className="onboard-btn onboard-btn--ghost" onClick={() => onFase('escolher')}>
              voltar
            </button>
            <button type="submit" className="onboard-btn" disabled={enviando}>
              {enviando ? 'criando…' : 'criar escritorio'}
            </button>
          </div>
        </form>
      )}

      {fase === 'codigo' && (
        <form onSubmit={conectar}>
          <h2 id="onboard-titulo">Ja tenho codigo</h2>
          <p className="onboard-lead">O codigo e o tenantId — o mesmo de x-tenant-id no OTLP.</p>
          <label className="onboard-label" htmlFor="codigo">
            Codigo
          </label>
          <input
            id="codigo"
            className="onboard-input"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            autoFocus
            required
            placeholder="tenantId"
            autoComplete="off"
          />
          {erro && <p className="onboard-erro">{erro}</p>}
          <div className="onboard-acoes">
            <button type="button" className="onboard-btn onboard-btn--ghost" onClick={() => onFase('escolher')}>
              voltar
            </button>
            <button type="submit" className="onboard-btn" disabled={enviando}>
              {enviando ? 'conectando…' : 'conectar'}
            </button>
          </div>
        </form>
      )}

      {fase === 'ponte' && sessao && (
        <>
          <h2 id="onboard-titulo">Ponte pronta</h2>
          <p className="onboard-lead">
            Escritorio de <strong>{sessao.tenant.displayName}</strong> no ar.
            Simule agora ou aponte telemetria real depois.
          </p>
          <dl className="onboard-dl">
            <div>
              <dt>Codigo</dt>
              <dd>
                <code>{sessao.tenant.tenantId}</code>
                <button
                  type="button"
                  className="onboard-copy"
                  onClick={() => void copiar('codigo', sessao.tenant.tenantId)}
                >
                  {copiado === 'codigo' ? 'copiado' : 'copiar'}
                </button>
              </dd>
            </div>
            <div>
              <dt>OTLP (cliente com OpenTelemetry)</dt>
              <dd>
                <pre>{snippetOtlp(sessao.tenant.tenantId)}</pre>
                <button
                  type="button"
                  className="onboard-copy"
                  onClick={() => void copiar('otlp', snippetOtlp(sessao.tenant.tenantId))}
                >
                  {copiado === 'otlp' ? 'copiado' : 'copiar'}
                </button>
              </dd>
            </div>
            <div>
              <dt>Eventos nativos (sem OTLP)</dt>
              <dd>
                <pre>{snippetEventos(sessao.tenant.tenantId)}</pre>
                <button
                  type="button"
                  className="onboard-copy"
                  onClick={() => void copiar('events', snippetEventos(sessao.tenant.tenantId))}
                >
                  {copiado === 'events' ? 'copiado' : 'copiar'}
                </button>
              </dd>
            </div>
          </dl>
          {erro && <p className="onboard-erro">{erro}</p>}
          {simOk && <p className="onboard-ok">{simOk}</p>}
          <div className="onboard-acoes onboard-acoes--ponte">
            <button
              type="button"
              className="onboard-btn"
              disabled={simulando}
              onClick={() => void simular()}
            >
              {simulando ? 'simulando…' : 'Simular agencia'}
            </button>
            <button type="button" className="onboard-btn" onClick={() => onFase('terminal')}>
              vincular terminal
            </button>
            <a className="onboard-btn onboard-btn--link" href={urlDemoComToken(sessao.token)}>
              pular e entrar
            </a>
          </div>
        </>
      )}

      {fase === 'terminal' && sessao && (
        <form onSubmit={(e) => void vincular(e)}>
          <h2 id="onboard-titulo">Vincular terminal</h2>
          <p className="onboard-lead">
            Cole a URL https do web terminal do broker. Os iframes do Room
            passam a mostrar essa tela. Feed de velas vem da API (mock agora).
          </p>
          <label className="onboard-label" htmlFor="conta-label">
            Nome da conta
          </label>
          <input
            id="conta-label"
            className="onboard-input"
            value={contaLabel}
            onChange={(e) => setContaLabel(e.target.value)}
            required
          />
          <label className="onboard-label" htmlFor="broker-nome">
            Broker
          </label>
          <input
            id="broker-nome"
            className="onboard-input"
            value={brokerNome}
            onChange={(e) => setBrokerNome(e.target.value)}
            required
            placeholder="Exness, XM, ..."
          />
          <label className="onboard-label" htmlFor="conta-login">
            Login (rotulo)
          </label>
          <input
            id="conta-login"
            className="onboard-input"
            value={contaLogin}
            onChange={(e) => setContaLogin(e.target.value)}
            placeholder="12345678"
          />
          <label className="onboard-label" htmlFor="conta-server">
            Servidor
          </label>
          <input
            id="conta-server"
            className="onboard-input"
            value={contaServer}
            onChange={(e) => setContaServer(e.target.value)}
            placeholder="Broker-Live"
          />
          <label className="onboard-label" htmlFor="terminal-url">
            URL do web terminal
          </label>
          <input
            id="terminal-url"
            className="onboard-input"
            type="url"
            value={terminalUrl}
            onChange={(e) => setTerminalUrl(e.target.value)}
            required
            placeholder="https://…"
          />
          {erro && <p className="onboard-erro">{erro}</p>}
          <div className="onboard-acoes">
            <button type="button" className="onboard-btn onboard-btn--ghost" onClick={() => onFase('ponte')}>
              voltar
            </button>
            <a className="onboard-btn onboard-btn--link" href={urlDemoComToken(sessao.token)}>
              pular
            </a>
            <button className="onboard-btn" type="submit" disabled={enviando}>
              {enviando ? 'salvando…' : 'salvar e entrar'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
