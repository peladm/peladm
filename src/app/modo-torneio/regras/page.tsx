'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../../components/Layout';
import {
  FormatoCompeticao,
  ModalidadeCompeticao,
  RegrasCompeticaoLocal,
  iniciarCompeticaoLocalAPartirSetup,
  limparSetupCompeticaoLocal,
  obterSetupCompeticaoLocal,
  salvarRegrasCompeticaoLocal,
} from '../../../lib/torneioLocalService';
import { buscar_pelada_id } from '../../../lib/credenciais';
import { MetodoChaveamento, obterLabelMetodo, obterDescricaoMetodo } from '../../../lib/bracketService';

const descricaoFormato: Record<FormatoCompeticao, string> = {
  grupos_mata_mata: 'Fase de grupos seguida de mata-mata.',
  mata_mata: 'Eliminacao direta do inicio ao fim.',
  pontos_corridos: 'Todos contra todos com classificacao por pontos.',
  pontos_corridos_mata_mata: 'Liga inicial + fase final em mata-mata.',
};

const tituloModalidade: Record<ModalidadeCompeticao, string> = {
  torneio: 'Torneio',
  campeonato: 'Campeonato',
};

type CriterioKey = 'vitorias' | 'saldo_gols' | 'gols_pro' | 'gols_contra';

interface CriterioOrdenavel {
  key: CriterioKey;
  label: string;
  enabled: boolean;
}

const CRITERIOS_BASE: CriterioOrdenavel[] = [
  { key: 'vitorias', label: 'Vitorias', enabled: true },
  { key: 'saldo_gols', label: 'Saldo de gols', enabled: true },
  { key: 'gols_pro', label: 'Gols pro', enabled: true },
  { key: 'gols_contra', label: 'Gols contra (menos sofre, melhor)', enabled: true },
];

export default function RegrasModoTorneioPage() {
  const router = useRouter();
  const [setupValido, setSetupValido] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [modalidade, setModalidade] = useState<ModalidadeCompeticao>('torneio');
  const [formato, setFormato] = useState<FormatoCompeticao>('grupos_mata_mata');

  const [nomeCompeticao, setNomeCompeticao] = useState('');
  const [jogadoresPorTime, setJogadoresPorTime] = useState(5);
  const [quantidadeTimes, setQuantidadeTimes] = useState(6);
  const [tempoPartida, setTempoPartida] = useState(10);
  const [criteriosDesempate, setCriteriosDesempate] = useState<CriterioOrdenavel[]>(CRITERIOS_BASE);
  const [idaVolta, setIdaVolta] = useState(false);
  const [classificamGrupo, setClassificamGrupo] = useState(2);
  const [quantidadeGrupos, setQuantidadeGrupos] = useState(2);
  const [classificamLiga, setClassificamLiga] = useState(4);
  const [repescagem, setRepescagem] = useState(false);
  const [mataMataFormato, setMataMataFormato] = useState<'jogo_unico' | 'ida_e_volta'>('jogo_unico');
  const [finalFormato, setFinalFormato] = useState<'jogo_unico' | 'ida_e_volta'>('jogo_unico');
  const [disputaTerceiro, setDisputaTerceiro] = useState<'nao' | 'jogo_unico' | 'ida_e_volta'>('nao');
  const [empateDecisao, setEmpateDecisao] = useState<'prorrogacao' | 'penaltis'>('penaltis');
  const [temposPartida, setTemposPartida] = useState<1 | 2>(1);
  const [tempoProrrogacao, setTempoProrrogacao] = useState(5);
  const [temposProrrogacao, setTemposProrrogacao] = useState<1 | 2>(1);
  const [metodoChaveamento, setMetodoChaveamento] = useState<MetodoChaveamento>('melhor_vs_pior');
  const [showModalConfirmar, setShowModalConfirmar] = useState(false);

  useEffect(() => {
    const setup = obterSetupCompeticaoLocal();

    if (!setup) {
      setSetupValido(false);
      router.replace('/modo-torneio');
      return;
    }

    setSetupValido(true);
    setModalidade(setup.modalidade);
    setFormato(setup.formato);
    setNomeCompeticao('');

    if (setup.formato === 'mata_mata') {
      setClassificamGrupo(0);
    }

    if (setup.formato === 'pontos_corridos') {
      setClassificamGrupo(0);
      setIdaVolta(false);
    }
  }, [router]);

  const aspectosPrincipais = useMemo(() => {
    const base = [
      `Modalidade: ${tituloModalidade[modalidade]}`,
      `Formato: ${descricaoFormato[formato]}`,
    ];

    if (formato === 'mata_mata') {
      base.push('Nao ha fase de grupos.');
      base.push('Cada confronto elimina um time.');
    }

    if (formato === 'pontos_corridos') {
      base.push('Classificacao geral por pontos.');
      base.push('Sem fase eliminatoria final.');
    }

    if (formato === 'pontos_corridos_mata_mata') {
      base.push('Primeira fase em liga (pontos corridos).');
      base.push('Fase final com os melhores em mata-mata.');
    }

    return base;
  }, [formato, modalidade]);

  const mostrarClassificados = formato === 'grupos_mata_mata';
  const mostrarMataMata = formato !== 'pontos_corridos';

  // Grupos possíveis: mínimo 2 grupos, mínimo 3 times por grupo
  const gruposPossiveis = useMemo(() => {
    const possiveis: number[] = [];
    for (let g = 2; g <= Math.floor(quantidadeTimes / 3); g++) {
      possiveis.push(g);
    }
    return possiveis;
  }, [quantidadeTimes]);

  const gruposIdeal = useMemo(() => {
    if (gruposPossiveis.length === 0) return 2;
    const potencias2 = gruposPossiveis.filter((g) => g > 1 && (g & (g - 1)) === 0);
    if (potencias2.length > 0) return potencias2[potencias2.length - 1];
    return gruposPossiveis[gruposPossiveis.length - 1];
  }, [gruposPossiveis]);

  const timesPorGrupoAtual = useMemo(() => {
    if (!quantidadeGrupos) return 0;
    return Math.floor(quantidadeTimes / quantidadeGrupos);
  }, [quantidadeTimes, quantidadeGrupos]);

  const classificadosPossiveis = useMemo(() => {
    if (timesPorGrupoAtual < 2) return [];
    const possiveis: number[] = [];
    for (let c = 1; c < timesPorGrupoAtual; c++) possiveis.push(c);
    return possiveis;
  }, [timesPorGrupoAtual]);

  const classificadosIdeal = useMemo(() => {
    if (classificadosPossiveis.length === 0) return 1;
    if (classificadosPossiveis.includes(2)) return 2;
    return classificadosPossiveis[0];
  }, [classificadosPossiveis]);

  const faseEliminatoriaLabel = (total: number): string => {
    if (total === 2) return 'Final';
    if (total === 4) return 'Semi Finais';
    if (total === 8) return 'Quartas de Final';
    if (total === 16) return 'Oitavas de Final';
    return `Rodada de ${total}`;
  };

  const jogosPorFase = useMemo(() => {
    const fatorMM = mataMataFormato === 'ida_e_volta' ? 2 : 1;
    const fatorFinal = finalFormato === 'ida_e_volta' ? 2 : 1;
    const jogos3o = disputaTerceiro === 'nao' ? 0 : disputaTerceiro === 'ida_e_volta' ? 2 : 1;
    const fatorIda = idaVolta ? 2 : 1;

    if (formato === 'grupos_mata_mata') {
      const tpg = Math.floor(quantidadeTimes / quantidadeGrupos);
      const grupos = ((tpg * (tpg - 1)) / 2) * fatorIda * quantidadeGrupos;
      const timesEM = classificamGrupo * quantidadeGrupos;
      const mm = timesEM > 1 ? (timesEM - 2) * fatorMM + fatorFinal + jogos3o : 0;
      return { grupos, liga: 0, mm };
    }
    if (formato === 'mata_mata') {
      const mm = quantidadeTimes > 1 ? (quantidadeTimes - 2) * fatorMM + fatorFinal + jogos3o : 0;
      return { grupos: 0, liga: 0, mm };
    }
    if (formato === 'pontos_corridos') {
      const liga = ((quantidadeTimes * (quantidadeTimes - 1)) / 2) * fatorIda;
      return { grupos: 0, liga, mm: 0 };
    }
    if (formato === 'pontos_corridos_mata_mata') {
      const liga = ((quantidadeTimes * (quantidadeTimes - 1)) / 2) * fatorIda;
      const mm = classificamLiga > 1 ? (classificamLiga - 2) * fatorMM + fatorFinal + jogos3o : 0;
      return { grupos: 0, liga, mm };
    }
    return { grupos: 0, liga: 0, mm: 0 };
  }, [formato, quantidadeTimes, quantidadeGrupos, classificamGrupo, classificamLiga, idaVolta, mataMataFormato, finalFormato, disputaTerceiro]);

  const totalJogos = jogosPorFase.grupos + jogosPorFase.liga + jogosPorFase.mm;

  // Auto-selecionar ideal quando quantidadeTimes muda
  useEffect(() => {
    if (!mostrarClassificados || gruposPossiveis.length === 0) return;
    if (!gruposPossiveis.includes(quantidadeGrupos)) {
      setQuantidadeGrupos(gruposIdeal);
    }
  }, [gruposPossiveis, gruposIdeal, mostrarClassificados]);

  useEffect(() => {
    if (!mostrarClassificados || classificadosPossiveis.length === 0) return;
    if (!classificadosPossiveis.includes(classificamGrupo)) {
      setClassificamGrupo(classificadosIdeal);
    }
  }, [classificadosPossiveis, classificadosIdeal, mostrarClassificados]);

  useEffect(() => {
    if (formato !== 'pontos_corridos_mata_mata') return;
    const maxPar = Math.floor((quantidadeTimes - 1) / 2) * 2;
    setClassificamLiga((curr) => {
      if (maxPar < 2) return 2;
      if (curr > maxPar || curr % 2 !== 0) {
        return [4, 2, 8, 6].find((n) => n <= maxPar) ?? 2;
      }
      return curr;
    });
  }, [quantidadeTimes, formato]);

  const toggleCriterio = (key: CriterioKey) => {
    setCriteriosDesempate((prev) => prev.map((item) => (
      item.key === key ? { ...item, enabled: !item.enabled } : item
    )));
  };

  const moverCriterio = (index: number, direcao: 'up' | 'down') => {
    setCriteriosDesempate((prev) => {
      const next = [...prev];
      const alvo = direcao === 'up' ? index - 1 : index + 1;
      if (alvo < 0 || alvo >= next.length) return prev;
      const temp = next[index];
      next[index] = next[alvo];
      next[alvo] = temp;
      return next;
    });
  };

  const confirmarRegras = () => {
    if (!setupValido || salvando) return;

    if (!nomeCompeticao.trim()) {
      alert('Informe o nome da competicao.');
      return;
    }

    if (!jogadoresPorTime || jogadoresPorTime < 1) {
      alert('Informe a quantidade de jogadores por time.');
      return;
    }
    if (!quantidadeTimes || quantidadeTimes < 2) {
      alert('Informe a quantidade de times (mínimo 2).');
      return;
    }
    if (!tempoPartida || tempoPartida < 1) {
      alert('Informe o tempo de partida.');
      return;
    }

    setSalvando(true);

    try {
      const setup = obterSetupCompeticaoLocal();
      if (!setup) {
        router.replace('/modo-torneio');
        return;
      }

      const torneio = iniciarCompeticaoLocalAPartirSetup(setup, nomeCompeticao.trim());

      const peladaId = buscar_pelada_id() || 'default';
      const timestamp = new Date().toISOString();
      const criteriosAtivos = criteriosDesempate.filter((item) => item.enabled).map((item) => item.key);

      const regras: RegrasCompeticaoLocal = {
        torneio_id: torneio.id,
        pelada_id: peladaId,
        modalidade,
        formato,
        jogadores_por_time: jogadoresPorTime,
        quantidade_times: quantidadeTimes,
        tempo_partida: tempoPartida,
        tempos_partida: temposPartida,
        tempo_prorrogacao: mostrarMataMata && empateDecisao === 'prorrogacao' ? tempoProrrogacao : undefined,
        tempos_prorrogacao: mostrarMataMata && empateDecisao === 'prorrogacao' ? temposProrrogacao : undefined,
        pontos_vitoria: 3,
        pontos_empate: 1,
        pontos_derrota: 0,
        criterio_desempate: criteriosAtivos[0] || 'vitorias',
        criterios_desempate: criteriosAtivos,
        ida_e_volta: idaVolta,
        classificam_por_grupo: mostrarClassificados ? classificamGrupo : 0,
        classificam_liga: (formato === 'pontos_corridos' || formato === 'pontos_corridos_mata_mata') ? classificamLiga : undefined,
        jogos_mata_mata_unicos: mostrarMataMata ? mataMataFormato === 'jogo_unico' : false,
        final_jogo_unico: mostrarMataMata ? finalFormato === 'jogo_unico' : false,
        mata_mata_formato: mostrarMataMata ? mataMataFormato : undefined,
        final_formato: mostrarMataMata ? finalFormato : undefined,
        disputa_terceiro_lugar: mostrarMataMata ? disputaTerceiro : 'nao',
        empate_decisao: mostrarMataMata ? empateDecisao : undefined,
        metodo_chaveamento: mostrarMataMata ? metodoChaveamento : undefined,
        quantidade_grupos: mostrarClassificados ? quantidadeGrupos : undefined,
        repescagem: mostrarClassificados ? repescagem : undefined,
        created_at: timestamp,
        updated_at: timestamp,
        sync_status: 'local_only',
        version: 1,
      };

      salvarRegrasCompeticaoLocal(regras);

      // Redirecionar para participantes
      router.replace('/modo-torneio/participantes');
    } catch (error) {
      console.error('Erro ao salvar regras da competicao:', error);
      alert('❌ Nao foi possivel salvar as regras agora.');
    } finally {
      setSalvando(false);
    }
  };

  const cancelarFluxo = () => {
    limparSetupCompeticaoLocal();
    router.replace('/modo-torneio');
  };

  return (
    <Layout title="Regras do Torneio">
      <section className="mb-6">
        <div className="bg-gray-800 border-gray-700 rounded-2xl shadow-2xl p-5 sm:p-6 border-2">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            <span className="text-sky-400">Regras da</span>{' '}
            <span className="text-white">Competicao</span>
          </h2>
          <p className="text-sm sm:text-base mt-1 text-white">Tela unica para Torneio e Campeonato</p>
        </div>
      </section>

      <section className="mb-5">
        <div className="bg-white border border-sky-100 rounded-2xl shadow-md p-4 sm:p-5">
          <h3 className="font-black text-sky-800 mb-2">Aspectos pre-definidos</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            {aspectosPrincipais.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-sky-600">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mb-5">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-md p-4 sm:p-5">
          <label className="block text-sm font-semibold text-gray-700 mb-1">Nome da competicao</label>
          <input
            type="text"
            value={nomeCompeticao}
            onChange={(e) => setNomeCompeticao(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:border-sky-500"
            placeholder="Obrigatório"
            required
          />
        </div>
      </section>

      <section className="mb-5">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-md p-4 sm:p-5">
          <h3 className="font-black text-gray-800 mb-4">Bloco 1 — Regras Gerais da Partida</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Jogadores por time</label>
              <input
                type="number"
                value={jogadoresPorTime}
                onChange={(e) => setJogadoresPorTime(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Quantidade de times
              </label>
              <input
                type="number"
                value={quantidadeTimes}
                onChange={(e) => setQuantidadeTimes(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:border-sky-500"
              />
              {jogadoresPorTime > 0 && quantidadeTimes > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  {quantidadeTimes} times × {jogadoresPorTime} jogadores ={' '}
                  <span className="font-semibold text-sky-700">{quantidadeTimes * jogadoresPorTime} jogadores no total</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Tempo de partida (minutos)</label>
              <input
                type="number"
                value={tempoPartida}
                onChange={(e) => setTempoPartida(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Estrutura do tempo</label>
              <div className="flex gap-2">
                {([1, 2] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setTemposPartida(n)}
                    className={`flex-1 py-2 rounded-lg border-2 font-semibold text-sm transition-all ${
                      temposPartida === n
                        ? 'border-sky-500 bg-sky-500 text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-sky-300'
                    }`}
                  >
                    {n === 1 ? 'Tempo único' : `2 tempos (${tempoPartida}min cada)`}
                  </button>
                ))}
              </div>
              {temposPartida === 2 && (
                <p className="text-xs text-sky-600 mt-1 font-medium">Total: {tempoPartida * 2} min por partida</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {mostrarClassificados && (
      <section className="mb-5">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-md p-4 sm:p-5">
          <h3 className="font-black text-gray-800 mb-4">Bloco 2 — Fase de Grupos</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {mostrarClassificados && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Quantidade de grupos</label>
                {gruposPossiveis.length === 0 ? (
                  <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    Precisa de pelo menos 6 times para usar fase de grupos (min. 3 por grupo).
                  </p>
                ) : (
                  <>
                    <div className="flex gap-2 flex-wrap">
                      {gruposPossiveis.map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setQuantidadeGrupos(g)}
                          className={`w-10 h-10 rounded-lg border-2 font-bold text-sm transition-all ${
                            quantidadeGrupos === g
                              ? 'border-sky-500 bg-sky-500 text-white'
                              : 'border-gray-300 bg-white text-gray-700 hover:border-sky-300'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5">
                      {quantidadeTimes % quantidadeGrupos === 0
                        ? `${timesPorGrupoAtual} times por grupo`
                        : `${Math.floor(quantidadeTimes / quantidadeGrupos)}–${Math.ceil(quantidadeTimes / quantidadeGrupos)} times por grupo (distribuição desigual)`}
                    </p>
                  </>
                )}
              </div>
            )}

            {mostrarClassificados && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Classificam por grupo</label>
                {classificadosPossiveis.length === 0 ? (
                  <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    Defina a quantidade de grupos primeiro.
                  </p>
                ) : (
                  <>
                    <div className="flex gap-2 flex-wrap">
                      {classificadosPossiveis.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setClassificamGrupo(c)}
                          className={`w-10 h-10 rounded-lg border-2 font-bold text-sm transition-all ${
                            classificamGrupo === c
                              ? 'border-sky-500 bg-sky-500 text-white'
                              : 'border-gray-300 bg-white text-gray-700 hover:border-sky-300'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5">
                      {classificamGrupo * quantidadeGrupos} times avançam no total{classificamGrupo * quantidadeGrupos > 1 && <span className="ml-1 text-sky-600 font-medium">· Eliminatórias = {faseEliminatoriaLabel(classificamGrupo * quantidadeGrupos)}</span>}
                    </p>
                    {(() => { const t = classificamGrupo * quantidadeGrupos; return t > 1 && (t & (t - 1)) !== 0; })() && (
                      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mt-2">
                        ⚠️ {classificamGrupo * quantidadeGrupos} times não é potência de 2 — o chaveamento ficará irregular (alguns times entram direto em rodadas mais avançadas).
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Partidas de ida e volta</label>
              <select
                value={idaVolta ? 'sim' : 'nao'}
                onChange={(e) => setIdaVolta(e.target.value === 'sim')}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:border-sky-500 bg-white"
              >
                <option value="nao">Nao</option>
                <option value="sim">Sim</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Criterios de desempate (ordenacao manual)</label>
              <div className="space-y-2">
                {criteriosDesempate.map((criterioItem, index) => (
                  <div
                    key={criterioItem.key}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 flex items-center gap-2"
                  >
                    <input
                      type="checkbox"
                      checked={criterioItem.enabled}
                      onChange={() => toggleCriterio(criterioItem.key)}
                      className="h-4 w-4"
                    />
                    <span className={`text-sm flex-1 ${criterioItem.enabled ? 'text-gray-800' : 'text-gray-400'}`}>
                      {criterioItem.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => moverCriterio(index, 'up')}
                      disabled={index === 0}
                      className="px-2 py-1 rounded border border-gray-200 text-xs disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moverCriterio(index, 'down')}
                      disabled={index === criteriosDesempate.length - 1}
                      className="px-2 py-1 rounded border border-gray-200 text-xs disabled:opacity-40"
                    >
                      ↓
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>
      )}

      {(formato === 'pontos_corridos' || formato === 'pontos_corridos_mata_mata') && (
      <section className="mb-5">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-md p-4 sm:p-5">
          <h3 className="font-black text-gray-800 mb-4">Bloco 3 — Liga (Pontos Corridos)</h3>

          <div className="space-y-5">

            {/* 1 - Turno e Returno */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Rodadas</label>
              <div className="flex gap-2">
                {([false, true] as const).map((val) => (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => setIdaVolta(val)}
                    className={`flex-1 py-2 rounded-lg border-2 font-semibold text-sm transition-all ${
                      idaVolta === val
                        ? 'border-sky-500 bg-sky-500 text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-sky-300'
                    }`}
                  >
                    {val ? 'Turno e Returno' : 'Turno Único'}
                  </button>
                ))}
              </div>
            </div>

            {/* 2 - Quantos se classificam (só pontos_corridos_mata_mata) */}
            {formato === 'pontos_corridos_mata_mata' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Quantos se classificam</label>
                <div className="flex gap-2 flex-wrap">
                  {Array.from({ length: Math.floor((quantidadeTimes - 1) / 2) }, (_, i) => (i + 1) * 2).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setClassificamLiga(n)}
                      className={`w-10 h-10 rounded-lg border-2 font-bold text-sm transition-all ${
                        classificamLiga === n
                          ? 'border-sky-500 bg-sky-500 text-white'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-sky-300'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1.5">
                  {classificamLiga} times avançam para o mata-mata{classificamLiga > 1 && <span className="ml-1 text-sky-600 font-medium">· Eliminatórias = {faseEliminatoriaLabel(classificamLiga)}</span>}
                </p>
                {(classificamLiga & (classificamLiga - 1)) !== 0 && (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mt-2">
                    ⚠️ {classificamLiga} times não é potência de 2 — o chaveamento ficará irregular (alguns times entram direto em rodadas mais avançadas).
                  </p>
                )}
              </div>
            )}

            {/* 3 - Critérios de desempate */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Critérios de desempate (ordem de prioridade)</label>
              <div className="space-y-2">
                {criteriosDesempate.map((criterioItem, index) => (
                  <div
                    key={criterioItem.key}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 flex items-center gap-2"
                  >
                    <input
                      type="checkbox"
                      checked={criterioItem.enabled}
                      onChange={() => toggleCriterio(criterioItem.key)}
                      className="h-4 w-4"
                    />
                    <span className={`text-sm flex-1 ${criterioItem.enabled ? 'text-gray-800' : 'text-gray-400'}`}>
                      {criterioItem.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => moverCriterio(index, 'up')}
                      disabled={index === 0}
                      className="px-2 py-1 rounded border border-gray-200 text-xs disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moverCriterio(index, 'down')}
                      disabled={index === criteriosDesempate.length - 1}
                      className="px-2 py-1 rounded border border-gray-200 text-xs disabled:opacity-40"
                    >
                      ↓
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>
      )}

      {mostrarMataMata && (
        <section className="mb-5">
          <div className="bg-white border border-gray-200 rounded-2xl shadow-md p-4 sm:p-5">
            <h3 className="font-black text-gray-800 mb-4">Bloco 4 — Fase Eliminatória</h3>

            <div className="space-y-5">

              {/* 1 - Método de chaveamento */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Método de chaveamento</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(['aleatorio', 'cruzamento_grupos', 'melhor_vs_pior', 'classificacao_geral'] as MetodoChaveamento[])
                    .filter((m) =>
                      formato === 'pontos_corridos_mata_mata'
                        ? m !== 'cruzamento_grupos'
                        : true
                    )
                    .map((metodo) => (
                    <button
                      key={metodo}
                      type="button"
                      onClick={() => setMetodoChaveamento(metodo)}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        metodoChaveamento === metodo
                          ? 'border-sky-500 bg-sky-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <p className={`font-semibold text-sm ${metodoChaveamento === metodo ? 'text-sky-700' : 'text-gray-800'}`}>
                        {obterLabelMetodo(metodo)}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{obterDescricaoMetodo(metodo)}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2 - Mata-Mata */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Mata-Mata</label>
                <div className="flex gap-2">
                  {(['jogo_unico', 'ida_e_volta'] as const).map((op) => (
                    <button
                      key={op}
                      type="button"
                      onClick={() => setMataMataFormato(op)}
                      className={`flex-1 py-2 rounded-lg border-2 font-semibold text-sm transition-all ${
                        mataMataFormato === op
                          ? 'border-sky-500 bg-sky-500 text-white'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-sky-300'
                      }`}
                    >
                      {op === 'jogo_unico' ? 'Jogo Único' : 'Ida e Volta'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3 - Final */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Final</label>
                <div className="flex gap-2">
                  {(['jogo_unico', 'ida_e_volta'] as const).map((op) => (
                    <button
                      key={op}
                      type="button"
                      onClick={() => setFinalFormato(op)}
                      className={`flex-1 py-2 rounded-lg border-2 font-semibold text-sm transition-all ${
                        finalFormato === op
                          ? 'border-sky-500 bg-sky-500 text-white'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-sky-300'
                      }`}
                    >
                      {op === 'jogo_unico' ? 'Jogo Único' : 'Ida e Volta'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4 - Disputa do 3º lugar */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Disputa do 3º lugar</label>
                <div className="flex gap-2">
                  {(['nao', 'jogo_unico', 'ida_e_volta'] as const).map((op) => (
                    <button
                      key={op}
                      type="button"
                      onClick={() => setDisputaTerceiro(op)}
                      className={`flex-1 py-2 rounded-lg border-2 font-semibold text-sm transition-all ${
                        disputaTerceiro === op
                          ? 'border-sky-500 bg-sky-500 text-white'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-sky-300'
                      }`}
                    >
                      {op === 'nao' ? 'Não' : op === 'jogo_unico' ? 'Jogo Único' : 'Ida e Volta'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 5 - Em caso de empate */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Em caso de empate</label>
                <div className="flex gap-2">
                  {(['prorrogacao', 'penaltis'] as const).map((op) => (
                    <button
                      key={op}
                      type="button"
                      onClick={() => setEmpateDecisao(op)}
                      className={`flex-1 py-2 rounded-lg border-2 font-semibold text-sm transition-all ${
                        empateDecisao === op
                          ? 'border-sky-500 bg-sky-500 text-white'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-sky-300'
                      }`}
                    >
                      {op === 'prorrogacao' ? 'Prorrogação' : 'Pênaltis'}
                    </button>
                  ))}
                </div>
                {empateDecisao === 'prorrogacao' && (
                  <div className="mt-3 space-y-3 bg-gray-50 border border-gray-200 rounded-xl p-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Tempo da prorrogação (minutos)</label>
                      <input
                        type="number"
                        min={1}
                        value={tempoProrrogacao}
                        onChange={(e) => setTempoProrrogacao(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:border-sky-500 text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Estrutura da prorrogação</label>
                      <div className="flex gap-2">
                        {([1, 2] as const).map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setTemposProrrogacao(n)}
                            className={`flex-1 py-1.5 rounded-lg border-2 font-semibold text-xs transition-all ${
                              temposProrrogacao === n
                                ? 'border-sky-500 bg-sky-500 text-white'
                                : 'border-gray-300 bg-white text-gray-700 hover:border-sky-300'
                            }`}
                          >
                            {n === 1 ? 'Tempo único' : `2 tempos (${tempoProrrogacao}min cada)`}
                          </button>
                        ))}
                      </div>
                      {temposProrrogacao === 2 && (
                        <p className="text-xs text-sky-600 mt-1 font-medium">Total: {tempoProrrogacao * 2} min de prorrogação</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </section>
      )}

      <section className="mb-4">
        <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-semibold text-sky-800">Quantidade de jogos</p>
              <p className="text-xs text-sky-500 mt-0.5">Baseado nas regras configuradas</p>
            </div>
            <span className="text-4xl font-black text-sky-600">{totalJogos}</span>
          </div>
          <div className="flex gap-3 flex-wrap text-xs text-sky-700 border-t border-sky-200 pt-2">
            {jogosPorFase.grupos > 0 && <span>{jogosPorFase.grupos} de grupos</span>}
            {jogosPorFase.liga > 0 && <span>{jogosPorFase.liga} de liga</span>}
            {jogosPorFase.mm > 0 && <span className="font-semibold">{jogosPorFase.mm} de mata-mata</span>}
            {tempoPartida > 0 && totalJogos > 0 && (
              <span className="ml-auto font-semibold text-sky-600">≈ {totalJogos * tempoPartida} min no total</span>
            )}
          </div>
        </div>
      </section>

      <section className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={cancelarFluxo}
          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl shadow-md p-3 font-semibold transition-colors"
        >
          Cancelar
        </button>

        <button
          onClick={() => setShowModalConfirmar(true)}
          disabled={!setupValido || salvando}
          className={`w-full rounded-xl shadow-md p-3 font-semibold transition-colors ${
            !setupValido || salvando
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700'
          }`}
        >
          {salvando ? 'Salvando...' : 'Confirmar regras e iniciar'}
        </button>
      </section>

      {showModalConfirmar && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col">
            <div className="p-5 overflow-y-auto flex-1">
              <h3 className="font-black text-gray-800 text-lg mb-0.5">Resumo das Regras</h3>
              <p className="text-xs text-gray-400 mb-4">Revise antes de confirmar.</p>

              <div className="space-y-3 text-sm">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="font-bold text-gray-700 mb-1.5">Competição</p>
                  <div className="space-y-1 text-gray-600">
                    <p><span className="text-gray-400">Nome:</span> {nomeCompeticao}</p>
                    <p><span className="text-gray-400">Modalidade:</span> {tituloModalidade[modalidade]}</p>
                    <p><span className="text-gray-400">Formato:</span> {descricaoFormato[formato]}</p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="font-bold text-gray-700 mb-1.5">Partida</p>
                  <div className="space-y-1 text-gray-600">
                    <p><span className="text-gray-400">Times:</span> {quantidadeTimes} × {jogadoresPorTime} jogadores = <strong>{quantidadeTimes * jogadoresPorTime}</strong> no total</p>
                    <p><span className="text-gray-400">Tempo:</span> {tempoPartida} min por jogo</p>
                  </div>
                </div>

                {mostrarClassificados && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="font-bold text-gray-700 mb-1.5">Fase de Grupos</p>
                    <div className="space-y-1 text-gray-600">
                      <p><span className="text-gray-400">Grupos:</span> {quantidadeGrupos} × {timesPorGrupoAtual} times</p>
                      <p><span className="text-gray-400">Classificam:</span> {classificamGrupo}/grupo → {classificamGrupo * quantidadeGrupos} times</p>
                      <p><span className="text-gray-400">Rodadas:</span> {idaVolta ? 'Turno e returno' : 'Turno único'}</p>
                    </div>
                  </div>
                )}

                {(formato === 'pontos_corridos' || formato === 'pontos_corridos_mata_mata') && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="font-bold text-gray-700 mb-1.5">Liga</p>
                    <div className="space-y-1 text-gray-600">
                      <p><span className="text-gray-400">Rodadas:</span> {idaVolta ? 'Turno e returno' : 'Turno único'}</p>
                      {formato === 'pontos_corridos_mata_mata' && (
                        <p><span className="text-gray-400">Classificam:</span> {classificamLiga} times para o mata-mata</p>
                      )}
                    </div>
                  </div>
                )}

                {mostrarMataMata && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="font-bold text-gray-700 mb-1.5">Fase Eliminatória</p>
                    <div className="space-y-1 text-gray-600">
                      <p><span className="text-gray-400">Método:</span> {obterLabelMetodo(metodoChaveamento)}</p>
                      <p><span className="text-gray-400">Mata-mata:</span> {mataMataFormato === 'jogo_unico' ? 'Jogo único' : 'Ida e volta'}</p>
                      <p><span className="text-gray-400">Final:</span> {finalFormato === 'jogo_unico' ? 'Jogo único' : 'Ida e volta'}</p>
                      <p><span className="text-gray-400">3º lugar:</span> {disputaTerceiro === 'nao' ? 'Não' : disputaTerceiro === 'jogo_unico' ? 'Jogo único' : 'Ida e volta'}</p>
                      <p><span className="text-gray-400">Empate:</span> {empateDecisao === 'prorrogacao' ? 'Prorrogação' : 'Pênaltis'}</p>
                    </div>
                  </div>
                )}

                <div className="bg-sky-50 border border-sky-200 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sky-700 mb-1">Total de Jogos</p>
                      <div className="space-y-0.5 text-xs text-sky-600">
                        {jogosPorFase.grupos > 0 && <p>{jogosPorFase.grupos} de grupos</p>}
                        {jogosPorFase.liga > 0 && <p>{jogosPorFase.liga} de liga</p>}
                        {jogosPorFase.mm > 0 && <p>{jogosPorFase.mm} de mata-mata</p>}
                        {tempoPartida > 0 && <p className="text-sky-500 pt-0.5">≈ {totalJogos * tempoPartida} min no total</p>}
                      </div>
                    </div>
                    <span className="text-4xl font-black text-sky-600">{totalJogos}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-4 border-t border-gray-100">
              <button
                onClick={() => setShowModalConfirmar(false)}
                className="flex-1 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={() => { setShowModalConfirmar(false); confirmarRegras(); }}
                disabled={salvando}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold text-sm hover:from-emerald-600 hover:to-teal-700 transition-colors disabled:opacity-50"
              >
                {salvando ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
