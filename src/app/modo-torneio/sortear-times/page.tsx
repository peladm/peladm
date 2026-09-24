'use client';

import { useMemo, useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Layout from '../../../components/Layout';
import {
  ParticipanteTorneioLocal,
  EquipeTorneioLocal,
  obterParticipantesTorneioLocal,
  obterRegrasCompeticaoLocal,
  obterTorneioRascunhoOuAtivoLocal,
  ativarTorneioLocal,
  salvarEquipesTorneioLocal,
  salvarJogadoresEquipesLocal,
  obterJogadoresEquipesLocal,
} from '../../../lib/torneioLocalService';
import { buscar_pelada_id } from '../../../lib/credenciais';
import { sortearNomesUnicos } from '../../../lib/nomesTimesTorneio';

// ─── Constantes ──────────────────────────────────────────────────────────────

const CORES_EMOJIS = ['🔴', '🔵', '🟢', '🟡', '🟠', '🟣', '⚫', '⚪'];

const COR_EMOJI_MAP: Record<string, string> = {
  '🔴': '#ef4444', '🔵': '#3b82f6', '🟢': '#22c55e', '🟡': '#eab308',
  '🟠': '#f97316', '🟣': '#a855f7', '⚫': '#374151', '⚪': '#9ca3af',
};

function corDoEmoji(emoji: string): string {
  return COR_EMOJI_MAP[emoji] ?? '#6b7280';
}

const NIVEL_LABELS: Record<number, string> = {
  5: '⭐⭐⭐⭐⭐  Nível 5',
  4: '⭐⭐⭐⭐  Nível 4',
  3: '⭐⭐⭐  Nível 3',
  2: '⭐⭐  Nível 2',
  1: '⭐  Nível 1',
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TimeJogador = ParticipanteTorneioLocal & {
  goleiroSlot?: boolean;
  goleiroPendente?: boolean;
  manualSlot?: boolean;
};

interface TimeSorteado {
  id: string;
  nome: string;
  jogadores: TimeJogador[];
  nivelMedio: number;
  corEmoji: string;
}

interface TimeEditando {
  id: string;
  nome: string;
  corEmoji: string;
  jogadoresNomes: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function gerarId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function embaralhar<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Algoritmo idêntico ao executarSorteioEquilibrado da tela de sorteio tradicional.
 * Greedy com limite de extremos (máx 1 jogador 5⭐ e 1 jogador 2⭐ por time).
 */
function sortearEquilibrado(
  jogadores: ParticipanteTorneioLocal[],
  numeroTimes: number,
  jogadoresPorTime: number,
  incluirGoleiro: boolean = false,
): TimeSorteado[] {
  // Separar por nível e embaralhar cada grupo
  const porNivel: Record<number, ParticipanteTorneioLocal[]> = { 5: [], 4: [], 3: [], 2: [], 1: [] };
  jogadores.forEach((j) => {
    const n = j.nivel ?? 3;
    const grupo = porNivel[n] ?? porNivel[3];
    grupo.push(j);
  });
  [1, 2, 3, 4, 5].forEach((n) => {
    porNivel[n] = embaralhar(porNivel[n]);
  });

  const total = jogadores.length;
  const jogadoresDeLinhaPorTime = jogadoresPorTime;
  const totalJogadoresDeLinha = numeroTimes * jogadoresDeLinhaPorTime;

  // Verificar se há jogadores suficientes para os jogadores de linha
  if (total < totalJogadoresDeLinha) {
    throw new Error(`Não há jogadores suficientes. Necessário: ${totalJogadoresDeLinha}, disponível: ${total}`);
  }

  const limitesPorTime = Array.from({ length: numeroTimes }, (_, i) => {
    if (total % jogadoresDeLinhaPorTime !== 0 && i === numeroTimes - 1) {
      return total % jogadoresDeLinhaPorTime;
    }
    return jogadoresDeLinhaPorTime;
  });

  const nomesZoeiros = sortearNomesUnicos(numeroTimes);
  const times: TimeSorteado[] = Array.from({ length: numeroTimes }, (_, i) => ({
    id: gerarId(),
    nome: nomesZoeiros[i],
    jogadores: [],
    nivelMedio: 0,
    corEmoji: CORES_EMOJIS[i] ?? '⭐',
  }));

  const somasTimes = times.map(() => 0);
  const extremos5 = times.map(() => 0);
  const extremos2 = times.map(() => 0);

  // Fase 1 — distribuir 5⭐ (máx 1 por time)
  const reserva5: ParticipanteTorneioLocal[] = [];
  for (const j of porNivel[5]) {
    let melhor = -1;
    let menor = Infinity;
    for (let t = 0; t < numeroTimes; t++) {
      if (
        times[t].jogadores.length < limitesPorTime[t] &&
        extremos5[t] === 0 &&
        somasTimes[t] < menor
      ) {
        menor = somasTimes[t];
        melhor = t;
      }
    }
    if (melhor >= 0) {
      times[melhor].jogadores.push(j);
      somasTimes[melhor] += j.nivel;
      extremos5[melhor]++;
    } else {
      reserva5.push(j);
    }
  }

  // Fase 1b — distribuir 2⭐ (máx 1 por time)
  const reserva2: ParticipanteTorneioLocal[] = [];
  for (const j of porNivel[2]) {
    let melhor = -1;
    let menor = Infinity;
    for (let t = 0; t < numeroTimes; t++) {
      if (
        times[t].jogadores.length < limitesPorTime[t] &&
        extremos2[t] === 0 &&
        somasTimes[t] < menor
      ) {
        menor = somasTimes[t];
        melhor = t;
      }
    }
    if (melhor >= 0) {
      times[melhor].jogadores.push(j);
      somasTimes[melhor] += j.nivel;
      extremos2[melhor]++;
    } else {
      reserva2.push(j);
    }
  }

  // Fase 2 — distribuir 4⭐, 3⭐, 1⭐ greedy
  for (const nivel of [4, 3, 1]) {
    for (const j of porNivel[nivel]) {
      let melhor = -1;
      let menor = Infinity;
      for (let t = 0; t < numeroTimes; t++) {
        if (times[t].jogadores.length < limitesPorTime[t] && somasTimes[t] < menor) {
          menor = somasTimes[t];
          melhor = t;
        }
      }
      if (melhor >= 0) {
        times[melhor].jogadores.push(j);
        somasTimes[melhor] += j.nivel;
      }
    }
  }

  // Fase 3 — alocar reservas de extremos (se sobraram)
  for (const j of [...reserva5, ...reserva2]) {
    let melhor = -1;
    let menor = Infinity;
    for (let t = 0; t < numeroTimes; t++) {
      if (times[t].jogadores.length < limitesPorTime[t] && somasTimes[t] < menor) {
        menor = somasTimes[t];
        melhor = t;
      }
    }
    if (melhor >= 0) {
      times[melhor].jogadores.push(j);
      somasTimes[melhor] += j.nivel;
    }
  }

  // Fase 4 — adicionar goleiros ou placeholders
  if (incluirGoleiro) {
    const usados = new Set(times.flatMap((time) => time.jogadores.map((j) => j.id)));
    const jogadoresRestantes = jogadores.filter((j) => !usados.has(j.id));
    const goleirosDisponiveis = embaralhar(jogadoresRestantes);

    for (let t = 0; t < numeroTimes; t++) {
      const time = times[t];
      if (goleirosDisponiveis.length > 0) {
        const goleiro = goleirosDisponiveis.shift()!;
        time.jogadores.push(goleiro);
        somasTimes[t] += goleiro.nivel;
      } else {
        const placeholder: TimeJogador = {
          id: `goleiro_pendente_${time.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          torneio_id: jogadores[0]?.torneio_id ?? 'local',
          pelada_id: jogadores[0]?.pelada_id ?? 'default',
          jogador_id: `goleiro_pendente_${time.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          nome: '',
          nivel: 3,
          status: 'confirmado',
          origem: 'avulso',
          created_at: new Date().toISOString(),
          goleiroSlot: true,
          goleiroPendente: true,
        };
        time.jogadores.push(placeholder);
      }
    }
  }

  // Calculando médias e embaralhando jogadores dentro de cada time
  times.forEach((time, i) => {
    time.jogadores = embaralhar(time.jogadores);
    time.nivelMedio =
      time.jogadores.length > 0 ? somasTimes[i] / time.jogadores.length : 0;
  });

  return times;
}

// ─── Componente de estrelas ───────────────────────────────────────────────────

function Estrelas({ nivel }: { nivel: number }) {
  return (
    <span className="text-xs">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < nivel ? 'text-yellow-400' : 'text-gray-300'}>
          ★
        </span>
      ))}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function SortearTimesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modoProntos = searchParams?.get('modo') === 'prontos';

  const [torneioId, setTorneioId] = useState<string | null>(null);
  const [participantes, setParticipantes] = useState<ParticipanteTorneioLocal[]>([]);
  const [jogadoresPorTime, setJogadoresPorTime] = useState(5);
  const [quantidadeTimes, setQuantidadeTimes] = useState(6);
  const [incluirGoleiro, setIncluirGoleiro] = useState(false);
  const [timesFormados, setTimesFormados] = useState<TimeSorteado[]>([]);
  const [timesEditando, setTimesEditando] = useState<TimeEditando[]>([]);
  const [timesConfirmados, setTimesConfirmados] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const resultadoSorteioRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (timesFormados.length === 0 || timesConfirmados) return;
    const timer = window.setTimeout(() => {
      resultadoSorteioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [timesFormados, timesConfirmados]);

  const pendenciasContagem = timesFormados.reduce((count, time) => {
    return count + time.jogadores.filter((j) => !j.nome.trim()).length;
  }, 0);

  useEffect(() => {
    const torneio = obterTorneioRascunhoOuAtivoLocal();
    if (!torneio) {
      router.replace('/modo-torneio');
      return;
    }
    setTorneioId(torneio.id);

    const regras = obterRegrasCompeticaoLocal(torneio.id);
    if (regras) {
      setJogadoresPorTime(regras.jogadores_por_time);
      setQuantidadeTimes(regras.quantidade_times);
      setIncluirGoleiro(regras.incluir_goleiro);

      // Modo Times Prontos: inicializa grid de edição
      if (searchParams?.get('modo') === 'prontos') {
        const qT = regras.quantidade_times;
        const qJ = regras.jogadores_por_time + (regras.incluir_goleiro ? 1 : 0);
        const nomesZoeiros = sortearNomesUnicos(qT);
        setTimesEditando(Array.from({ length: qT }, (_, i) => ({
          id: gerarId(),
          nome: nomesZoeiros[i],
          corEmoji: CORES_EMOJIS[i] ?? '⭐',
          jogadoresNomes: Array(qJ).fill(''),
        })));
      }
    }

    const todos = obterParticipantesTorneioLocal(torneio.id);
    const confirmados = todos.filter((p) => p.status === 'confirmado');
    setParticipantes(confirmados);

    // Se já existem equipes salvas (voltou para a tela), reconstruir o resultado fixo
    const peladaId = buscar_pelada_id() || 'default';
    const equipesRaw = localStorage.getItem(`equipes_torneio_${peladaId}_${torneio.id}`);
    if (equipesRaw) {
      try {
        const equipes: EquipeTorneioLocal[] = JSON.parse(equipesRaw);
        if (equipes.length > 0) {
          // Reconstrói TimeSorteado com jogadores salvos
          const mapa = obterJogadoresEquipesLocal(torneio.id);
          const times: TimeSorteado[] = equipes.map((e, i) => {
            const jogadores = mapa[e.id] ?? [];
            const nivelMedio = jogadores.length > 0
              ? jogadores.reduce((sum, j) => sum + (j.nivel ?? 3), 0) / jogadores.length
              : 0;
            return {
              id: e.id,
              nome: e.nome,
              jogadores,
              nivelMedio,
              corEmoji: e.cor ?? CORES_EMOJIS[i] ?? '⭐',
            };
          });
          setTimesFormados(times);
          setTimesConfirmados(true);
        }
      } catch { /* ignora */ }
    }

    setIsLoading(false);
  }, [router]);

  // Agrupar participantes por nível
  const porNivel = useMemo(() => {
    const grupos: Record<number, ParticipanteTorneioLocal[]> = { 5: [], 4: [], 3: [], 2: [], 1: [] };
    participantes.forEach((p) => {
      const n = p.nivel ?? 3;
      if (grupos[n]) grupos[n].push(p);
      else grupos[3].push(p);
    });
    // Ordenar cada nível alfabeticamente para exibição
    [1, 2, 3, 4, 5].forEach((n) => {
      grupos[n].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    });
    return grupos;
  }, [participantes]);

  const niveisComJogadores = [5, 4, 3, 2, 1].filter((n) => porNivel[n].length > 0);

  const sortear = () => {
    const times = sortearEquilibrado(participantes, quantidadeTimes, jogadoresPorTime, incluirGoleiro);
    setTimesFormados(times);
    setTimesConfirmados(false);
  };

  const abrirEscolhaManual = () => {
    const nomesZoeiros = sortearNomesUnicos(quantidadeTimes);
    const times: TimeSorteado[] = Array.from({ length: quantidadeTimes }, (_, i) => ({
      id: gerarId(),
      nome: nomesZoeiros[i],
      jogadores: Array.from({ length: jogadoresPorTime + (incluirGoleiro ? 1 : 0) }, (_, slotIndex) => {
        const isGoleiro = incluirGoleiro && slotIndex === jogadoresPorTime;
        const placeholder: TimeJogador = {
          id: `manual_${i}_${slotIndex}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          torneio_id: participantes[0]?.torneio_id ?? 'local',
          pelada_id: participantes[0]?.pelada_id ?? 'default',
          jogador_id: `manual_${i}_${slotIndex}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          nome: '',
          nivel: 3,
          status: 'confirmado',
          origem: 'avulso',
          created_at: new Date().toISOString(),
          goleiroSlot: isGoleiro,
          goleiroPendente: isGoleiro,
          manualSlot: !isGoleiro,
        };
        return placeholder;
      }),
      nivelMedio: 0,
      corEmoji: CORES_EMOJIS[i] ?? '⭐',
    }));
    setTimesFormados(times);
    setTimesConfirmados(false);
  };

  const resortear = () => {
    const times = sortearEquilibrado(participantes, quantidadeTimes, jogadoresPorTime, incluirGoleiro);
    setTimesFormados(times);
    setTimesConfirmados(false);
  };

  const confirmar = () => {
    if (!torneioId) return;
    const peladaId = buscar_pelada_id() || 'default';
    const now = new Date().toISOString();

    const equipes: EquipeTorneioLocal[] = timesFormados.map((time, i) => ({
      id: time.id,
      torneio_id: torneioId,
      pelada_id: peladaId,
      nome: time.nome,
      sigla: null,
      cor: CORES_EMOJIS[i] ?? null,
      jogadores: time.jogadores,
      pontos: 0,
      saldo_gols: 0,
      gols_pro: 0,
      gols_contra: 0,
      vitorias: 0,
      empates: 0,
      derrotas: 0,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      sync_status: 'local_only',
      version: 1,
    }));

    salvarEquipesTorneioLocal(torneioId, equipes);
    // Salvar também os jogadores de cada time para uso no painel
    const mapaJogadores: Record<string, import('../../../lib/torneioLocalService').ParticipanteTorneioLocal[]> = {};
    timesFormados.forEach((time) => { 
      mapaJogadores[time.id] = time.jogadores.map(j => ({
        ...j,
        posicao: j.goleiroSlot ? 'goleiro' : 'linha'
      }));
    });
    salvarJogadoresEquipesLocal(torneioId, mapaJogadores);
    ativarTorneioLocal(torneioId);
    setTimesConfirmados(true);
    // Notifica o Layout para re-ler os steps do torneio
    window.dispatchEvent(new CustomEvent('torneio-steps-changed'));
  };

  const compartilharTimesWhatsApp = () => {
    if (timesFormados.length === 0) return;

    let texto = '*TIMES DO TORNEIO*\n\n';

    timesFormados.forEach((time, index) => {
      texto += `*Time ${index + 1} - ${time.nome}*\n`;
      [...time.jogadores.filter((j) => !j.goleiroSlot), ...time.jogadores.filter((j) => j.goleiroSlot)].forEach((jogador) => {
        texto += `- ${jogador.nome || 'Jogador sem nome'}${jogador.goleiroSlot ? ' (G)' : ''}\n`;
      });
      texto += '\n';
    });

    const textoEncoded = encodeURIComponent(texto + 'Bora jogar!');
    window.open(`https://wa.me/?text=${textoEncoded}`, '_blank');
  };

  const iniciarTorneio = () => {
    if (torneioId) ativarTorneioLocal(torneioId);
    router.push('/modo-torneio/painel');
  };

  const confirmarProntos = () => {
    if (!torneioId) return;
    const peladaId = buscar_pelada_id() || 'default';
    const now = new Date().toISOString();

    const participantesGerados: ParticipanteTorneioLocal[] = [];
    const timesCompletos: TimeSorteado[] = timesEditando.map((te) => {
      const jogadores: ParticipanteTorneioLocal[] = te.jogadoresNomes.map((nome, ji) => {
        const p: ParticipanteTorneioLocal = {
          id: `part_${te.id}_${ji}`,
          torneio_id: torneioId,
          pelada_id: peladaId,
          jogador_id: `jog_${te.id}_${ji}`,
          nome: nome.trim() || `Jogador ${ji + 1}`,
          nivel: 3,
          status: 'confirmado',
          origem: 'avulso',
          created_at: now,
        };
        participantesGerados.push(p);
        return p;
      });
      return { id: te.id, nome: te.nome, jogadores, nivelMedio: 3, corEmoji: te.corEmoji };
    });

    import('../../../lib/torneioLocalService').then(({ salvarParticipantesTorneioLocal }) => {
      salvarParticipantesTorneioLocal(torneioId, participantesGerados);
    });

    const equipes: EquipeTorneioLocal[] = timesCompletos.map((time) => ({
      id: time.id,
      torneio_id: torneioId,
      pelada_id: peladaId,
      nome: time.nome,
      sigla: null,
      cor: time.corEmoji,
      jogadores: time.jogadores,
      pontos: 0, saldo_gols: 0, gols_pro: 0, gols_contra: 0,
      vitorias: 0, empates: 0, derrotas: 0,
      created_at: now, updated_at: now, deleted_at: null,
      sync_status: 'local_only', version: 1,
    }));
    salvarEquipesTorneioLocal(torneioId, equipes);
    const mapaJogadores: Record<string, ParticipanteTorneioLocal[]> = {};
    timesCompletos.forEach((t) => { 
      mapaJogadores[t.id] = t.jogadores.map(j => ({
        ...j,
        posicao: 'linha'
      }));
    });
    salvarJogadoresEquipesLocal(torneioId, mapaJogadores);
    ativarTorneioLocal(torneioId);
    setTimesFormados(timesCompletos);
    setTimesConfirmados(true);
    window.dispatchEvent(new CustomEvent('torneio-steps-changed'));
  };

  if (isLoading) {
    return (
      <Layout title="Sortear Times">
        <div className="flex items-center justify-center h-40">
          <p className="text-gray-400 text-sm">Carregando participantes...</p>
        </div>
      </Layout>
    );
  }

  // ── VISTA FINAL: times já confirmados ─────────────────────────────────────
  if (timesConfirmados) {
    return (
      <Layout title="Sortear Times">
        <div ref={resultadoSorteioRef}>
          {/* Header */}
          <section className="mb-4">
            <div className="bg-gray-800 border-emerald-600 rounded-2xl shadow-2xl p-4 sm:p-5 border-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">✅</span>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  Times Confirmados
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-gray-300">
                {timesFormados.length} times prontos &nbsp;·&nbsp; toque em{' '}
                <span className="text-yellow-400 font-bold">🏆 Iniciar</span> no rodapé para começar
              </p>
            </div>
          </section>

          {/* Lista de times — compacta para leitura rápida de nomes compostos */}
          <div className="flex flex-col gap-3 mb-24">
            {timesFormados
              .filter((t) => t.jogadores.length > 0 || timesConfirmados)
              .map((time) => {
                const cor = corDoEmoji(time.corEmoji);
                return (
                <div
                  key={time.id}
                  className="bg-white border-2 rounded-2xl overflow-hidden shadow-sm"
                  style={{ borderColor: cor + '55' }}
                >
                  {/* Cabeçalho colorido */}
                  <div className="flex items-center justify-between px-4 py-3" style={{ background: cor + '18' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: cor }} />
                      <span className="text-base font-bold" style={{ color: cor }}>{time.nome}</span>
                    </div>
                    {time.nivelMedio > 0 && (
                      <div className="flex items-center gap-1 text-xs font-semibold" style={{ color: cor }}>
                        <span>{Array.from({ length: 5 }).map((_, i) => (
                          <span key={i} style={{ color: i < Math.round(time.nivelMedio) ? cor : '#d1d5db' }}>★</span>
                        ))}</span>
                        <span className="text-gray-500 font-normal">{time.nivelMedio.toFixed(1).replace('.', ',')} · {time.jogadores.length} jog.</span>
                      </div>
                    )}
                  </div>
                  {/* Jogadores */}
                  <div className="px-4 py-3">
                    {time.jogadores.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {[...time.jogadores.filter((j) => !j.goleiroSlot), ...time.jogadores.filter((j) => j.goleiroSlot)].map((j, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100"
                          >
                            <span className="text-xs font-bold text-gray-400 w-5 text-right">{idx + 1}.</span>
                            <span className="text-sm font-medium text-gray-800 flex-1 min-w-0 truncate">{j.nome}</span>
                            {j.goleiroSlot ? (
                              <span className="text-[11px] font-semibold text-sky-600 uppercase shrink-0">Goleiro</span>
                            ) : j.nivel != null ? (
                              <span className="text-xs shrink-0">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <span key={i} style={{ color: i < j.nivel ? '#facc15' : '#e5e7eb' }}>★</span>
                                ))}
                              </span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 text-center py-2">{jogadoresPorTime} jogadores</p>
                    )}
                  </div>
                </div>
                );
              })}
          </div>

          {/* Rodapé fixo do modal */}
          <div className="fixed bottom-0 left-0 right-0 z-50 px-5 pb-5 pointer-events-none">
            <div className="mx-auto w-full max-w-2xl pointer-events-auto rounded-t-2xl border border-gray-200 bg-white/98 backdrop-blur-sm shadow-2xl p-4">
              {pendenciasContagem > 0 && (
                <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700 mb-3">
                  Existem <strong>{pendenciasContagem}</strong> campo{pendenciasContagem !== 1 ? 's' : ''} pendente{pendenciasContagem !== 1 ? 's' : ''}. Preencha tudo antes de confirmar.
                </div>
              )}

              <div className="grid grid-cols-[1fr_auto] gap-3">
                <button
                  onClick={() => { setTimesConfirmados(false); setTimesFormados([]); }}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-sm font-semibold bg-white border-2 border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-800 transition-all"
                >
                  <span>🔄</span>
                  <span>Refazer Sorteio</span>
                </button>

                <button
                  onClick={compartilharTimesWhatsApp}
                  className="w-12 h-12 rounded-xl bg-green-500 hover:bg-green-600 text-white flex items-center justify-center shadow-md transition-all"
                  title="Compartilhar no WhatsApp"
                >
                  <span className="text-xl">💬</span>
                </button>
              </div>
            </div>
          </div>


        </div>
      </Layout>
    );
  }

  // ── VISTA TIMES PRONTOS: inserção manual por time ───────────────────────────
  if (modoProntos && !timesConfirmados) {
    return (
      <Layout title="Sortear Times">
        <section className="mb-4">
          <div className="bg-gray-800 border-gray-700 rounded-2xl shadow-2xl p-4 sm:p-5 border-2">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              <span className="text-sky-400">Times</span>{' '}
              <span className="text-white">já Prontos</span>
            </h2>
            <p className="text-xs sm:text-sm mt-1 text-gray-300">
              Preencha os jogadores de cada time e confirme para iniciar.
            </p>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {timesEditando.map((time, ti) => (
            <div key={time.id} className="bg-white border-2 border-gray-100 rounded-2xl p-4 shadow-sm hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md transition-all duration-200">
              <div className="text-center mb-3 pb-2 border-b border-gray-100">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <span className="text-base flex-shrink-0">{time.corEmoji}</span>
                  <input
                    type="text"
                    value={time.nome}
                    onChange={(e) => {
                      const updated = [...timesEditando];
                      updated[ti] = { ...updated[ti], nome: e.target.value };
                      setTimesEditando(updated);
                    }}
                    className="text-sm font-bold text-emerald-600 bg-transparent text-center w-full outline-none border-b border-transparent focus:border-emerald-300"
                  />
                </div>
                <p className="text-xs text-gray-400">{jogadoresPorTime} jogadores</p>
              </div>
              <div className="space-y-1">
                {time.jogadoresNomes.map((nome, ji) => (
                  <div key={ji} className="p-2 bg-gray-50 rounded-lg border border-gray-100 text-center">
                    <input
                      type="text"
                      value={nome}
                      onChange={(e) => {
                        const updated = [...timesEditando];
                        const nomes = [...updated[ti].jogadoresNomes];
                        nomes[ji] = e.target.value;
                        updated[ti] = { ...updated[ti], jogadoresNomes: nomes };
                        setTimesEditando(updated);
                      }}
                      placeholder={`Jogador ${ji + 1}`}
                      className="w-full text-sm text-gray-800 bg-transparent text-center outline-none placeholder:text-gray-300"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <section className="mb-6">
          <button
            onClick={confirmarProntos}
            className="w-full rounded-xl shadow-md p-3.5 font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700 active:scale-95 transition-all animate-pulse"
          >
            Iniciar Pelada
          </button>
        </section>
      </Layout>
    );
  }

  // ── VISTA INICIAL: seleção e sorteio ──────────────────────────────────────
  return (
    <Layout title="Sortear Times">
      {/* Header */}
      <section className="mb-4">
        <div className="bg-gray-800 border-gray-700 rounded-2xl shadow-2xl p-4 sm:p-5 border-2">
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            <span className="text-sky-400">Sortear</span>{' '}
            <span className="text-white">Times</span>
          </h2>
          <p className="text-xs sm:text-sm mt-1 text-gray-300">
            <span className="text-sky-400 font-bold">{participantes.length} jogadores</span>
            {' '}confirmados &nbsp;·&nbsp;
            <span className="text-white font-bold">{quantidadeTimes} times</span>
            {' '}de{' '}
            <span className="text-white font-bold">{jogadoresPorTime}</span>
          </p>
        </div>
      </section>

      {/* Blocos por nível */}
      {participantes.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">👥</p>
          <p className="font-semibold">Nenhum participante confirmado</p>
          <p className="text-sm mt-1">
            <button
              type="button"
              onClick={() => router.push('/modo-torneio/participantes')}
              className="text-sky-500 underline"
            >
              Voltar para participantes
            </button>
          </p>
        </div>
      ) : (
        <div className="space-y-4 mb-6">
          {niveisComJogadores.map((nivel) => {
            const jogadores = porNivel[nivel];
            return (
              <section key={nivel} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <span className="text-sm font-bold text-gray-700">
                    {NIVEL_LABELS[nivel]}
                  </span>
                  <span className="text-xs font-semibold text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">
                    {jogadores.length}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 p-3">
                  {jogadores.map((j) => (
                    <div
                      key={j.id}
                      className="rounded-xl px-3 py-2 bg-gray-50 border border-gray-200"
                    >
                      <p className="font-semibold text-sm leading-tight text-gray-700 truncate">{j.nome}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Estrelas nivel={j.nivel} />
                        {j.origem === 'avulso' && (
                          <span className="text-xs text-sky-500">· avulso</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Botão Sortear */}
      {participantes.length > 0 && (
        <section className="mb-6">
          <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
            <button
              onClick={sortear}
              className="w-full flex items-center justify-center gap-3 py-4 px-5 rounded-xl text-base font-semibold bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all duration-200"
            >
              <span className="text-xl">🎲</span>
              <span>Sortear Times</span>
            </button>
            <button
              onClick={abrirEscolhaManual}
              className="w-full mt-3 flex items-center justify-center gap-3 py-4 px-5 rounded-xl text-base font-semibold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-all duration-200"
            >
              <span className="text-xl">✏️</span>
              <span>Escolher Times Manualmente</span>
            </button>
          </div>
        </section>
      )}

      {/* Resultado do sorteio na página */}
      {timesFormados.length > 0 && !timesConfirmados && (
        <section ref={resultadoSorteioRef} className="mt-6 mb-6">
          <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-3xl shadow-2xl border-2 border-emerald-400 overflow-hidden">
            <div className="px-4 py-5 sm:px-6">
              <div className="flex items-center gap-3 text-white">
                <span className="text-3xl">⚽</span>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">Resultado do Sorteio</h2>
                  <p className="text-sm text-emerald-50 mt-1">Os times foram formados. Confira abaixo e confirme para iniciar.</p>
                </div>
              </div>
            </div>

            {/* Times — lista vertical compacta */}
            <div className="bg-gray-50 px-4 py-5 sm:px-6 space-y-3">
              {timesFormados
                .filter((time) => time.jogadores.length > 0)
                .map((time, idx) => {
                  const cor = corDoEmoji(time.corEmoji);
                  const jogadores = [...time.jogadores.filter((j) => !j.goleiroSlot), ...time.jogadores.filter((j) => j.goleiroSlot)];
                  return (
                    <div key={time.id} className="bg-white rounded-2xl border-2 shadow-sm overflow-hidden transition-all hover:shadow-md" style={{ borderColor: cor + '55' }}>
                      <div className="px-4 py-3 flex items-center justify-between gap-3" style={{ background: cor + '15' }}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-2xl shrink-0">{time.corEmoji}</span>
                          <div className="min-w-0">
                            <p className="font-black text-base truncate" style={{ color: cor }}>{time.nome}</p>
                            <p className="text-xs text-gray-500 font-semibold">{time.nivelMedio.toFixed(1).replace('.', ',')} · {jogadores.length} jog.</p>
                          </div>
                        </div>
                        <span className="shrink-0 text-sm font-bold px-3 py-1 rounded-full" style={{ color: cor, background: cor + '20' }}>#{String(idx + 1).padStart(2, '0')}</span>
                      </div>
                      <div className="px-4 py-3 text-sm text-gray-700">
                        <div className="flex flex-wrap gap-1">
                          {jogadores.map((j, i) => (
                            <span key={i} className="inline-block">
                              <span className={`font-medium ${j.goleiroSlot ? 'text-sky-600' : 'text-gray-800'}`}>
                                {j.nome || 'Jogador sem nome'}
                              </span>
                              {j.goleiroSlot && <span className="text-[10px] ml-1 font-bold text-sky-600">🧤</span>}
                              {i < jogadores.length - 1 && <span className="mx-1 text-gray-300">•</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Avisos e botões */}
            <div className="px-4 py-5 sm:px-6 space-y-3 border-t border-gray-200">
              {pendenciasContagem > 0 && (
                <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
                  ⚠️ <strong>{pendenciasContagem}</strong> campo{pendenciasContagem !== 1 ? 's' : ''} pendente{pendenciasContagem !== 1 ? 's' : ''}. Preencha antes de confirmar.
                </div>
              )}

              <div className="grid grid-cols-[1fr_auto] gap-3">
                <button
                  onClick={resortear}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
                >
                  <span>🔄</span> Re-sortear
                </button>
                <button
                  onClick={compartilharTimesWhatsApp}
                  className="w-12 h-12 flex items-center justify-center rounded-xl bg-green-500 text-white hover:bg-green-600 transition-all shadow-md"
                  title="Compartilhar no WhatsApp"
                >
                  💬
                </button>
              </div>

              <button
                onClick={confirmar}
                disabled={pendenciasContagem > 0}
                className={`w-full py-4 px-5 rounded-xl text-base font-bold transition-all duration-200 ${
                  pendenciasContagem > 0
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-lg active:scale-95'
                }`}
              >
                🚀 Iniciar Pelada
              </button>
            </div>
          </div>
        </section>
      )}
    </Layout>
  );
}


export default function SortearTimesPageWrapper() {
  return (
    <Suspense fallback={null}>
      <SortearTimesPage />
    </Suspense>
  );
}
