/**
 * Debugpreview — bancada isolada para colar temas do lab no blueprint.
 */

import { useRef, useState, type FormEvent } from 'react';
import {
  carregarPlanta,
  listarPlantas,
  type AgenciaMontada as AgenciaPlanta,
} from '@tradeclass/iso-office/planta';
import { PreviewStage } from './PreviewStage';
import {
  assinaturaAgencia,
  montarAgenciaGeracao,
  type AgenciaMontada,
} from './montar-agencia';
import { saltAleatorio, type PedidoGeracao } from './selecionar-pedido';
import type { Historia } from './tarefa-especial/historias';
import { sortearHistoria } from './tarefa-especial/sortear';

const HISTORICO_MAX = 8;
const TENTATIVAS_MAX = 12;
const PLANTAS = listarPlantas();

export default function App() {
  const [plantaId, setPlantaId] = useState(PLANTAS[0]?.id ?? 'macro-desk');
  const [salas, setSalas] = useState(1);
  const [agencia, setAgencia] = useState<AgenciaMontada | null>(null);
  const [vazioSemTemas, setVazioSemTemas] = useState(false);
  const [geracao, setGeracao] = useState(0);
  const [tarefaEspecial, setTarefaEspecial] = useState<Historia | null>(null);
  const historicoRef = useRef<string[]>([]);

  function aplicarAgencia(escolhida: AgenciaMontada | AgenciaPlanta | null) {
    setAgencia(escolhida as AgenciaMontada | null);
    setVazioSemTemas(escolhida !== null && escolhida.slots.length === 0);
  }

  function onCarregarPlanta(ev: FormEvent) {
    ev.preventDefault();
    setTarefaEspecial(null);
    const proxima = geracao + 1;
    setGeracao(proxima);
    const escolhida = carregarPlanta(plantaId, 20260915 + proxima);
    aplicarAgencia(escolhida);
  }

  function gerarAgencia(pedido: PedidoGeracao, proxima: number): AgenciaMontada | null {
    let escolhida: AgenciaMontada | null = null;
    for (let t = 0; t < TENTATIVAS_MAX; t++) {
      const salt = saltAleatorio();
      const candidata = montarAgenciaGeracao(pedido, proxima, salt);
      if (!candidata) {
        escolhida = null;
        break;
      }
      if (candidata.slots.length === 0) {
        escolhida = candidata;
        break;
      }
      const sig = assinaturaAgencia(candidata);
      if (!historicoRef.current.includes(sig) || t === TENTATIVAS_MAX - 1) {
        escolhida = candidata;
        historicoRef.current = [sig, ...historicoRef.current].slice(0, HISTORICO_MAX);
        break;
      }
    }
    return escolhida;
  }

  function onGerarSpam(ev: FormEvent) {
    ev.preventDefault();
    const pedido: PedidoGeracao = {
      salas: Math.max(1, Math.floor(Number(salas)) || 1),
    };
    setSalas(pedido.salas);
    setTarefaEspecial(null);

    const proxima = geracao + 1;
    setGeracao(proxima);

    const escolhida = gerarAgencia(pedido, proxima);
    aplicarAgencia(escolhida);
  }

  function onTarefaEspecial() {
    const pedido: PedidoGeracao = { salas: 3 };
    setSalas(3);
    const proxima = geracao + 1;
    setGeracao(proxima);

    const salt = saltAleatorio();
    const historia = sortearHistoria(salt);
    const escolhida = gerarAgencia(pedido, proxima);
    setTarefaEspecial(historia);
    aplicarAgencia(escolhida);
  }

  function onResetar() {
    setSalas(1);
    setPlantaId(PLANTAS[0]?.id ?? 'macro-desk');
    setAgencia(null);
    setVazioSemTemas(false);
    setGeracao(0);
    setTarefaEspecial(null);
    historicoRef.current = [];
  }

  return (
    <div className="shell">
      <header className="chrome">
        <div className="chrome-brand">
          <h1 className="brand">Debugpreview</h1>
          <p className="tagline">bancada de tilesets</p>
        </div>

        <form className="dash" onSubmit={onCarregarPlanta} aria-label="Planta fixa">
          <label className="dash-field">
            <span className="dash-q">Planta</span>
            <select
              className="dash-input"
              name="planta"
              value={plantaId}
              onChange={(e) => setPlantaId(e.target.value)}
            >
              {PLANTAS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
          <p className="dash-hint" title="Catalogo fixo sem RNG">
            plantas fixas (sem spam)
          </p>
          <button className="dash-gerar" type="submit">
            Carregar planta
          </button>
          <button className="dash-reset" type="button" onClick={onResetar}>
            Resetar
          </button>
        </form>

        <form className="dash" onSubmit={onGerarSpam} aria-label="Pedido de geracao RNG">
          <label className="dash-field">
            <span className="dash-q">Gerar N salas (legado)</span>
            <input
              className="dash-input"
              type="number"
              name="salas"
              min={1}
              step={1}
              value={salas}
              onChange={(e) => setSalas(Number(e.target.value))}
            />
          </label>
          <button className="dash-tarefa" type="submit" title="Selecao RNG de temas">
            Gerar RNG
          </button>
          <button
            className="dash-tarefa"
            type="button"
            onClick={onTarefaEspecial}
            title="Sorteia uma historia colaborativa com 3 agentes"
          >
            Tarefa especial
          </button>
        </form>
      </header>
      <main className="stage-wrap">
        <PreviewStage
          agencia={agencia}
          vazioSemTemas={vazioSemTemas}
          tarefaEspecial={tarefaEspecial}
        />
      </main>
    </div>
  );
}
