'use client';

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Layout from '../../../components/Layout';
import {
  ParticipanteTorneioLocal,
  EventoPartidaTorneio,
  PartidaAtivaTorneio,
  EstatisticaJogadorTorneio,
  obterTorneioAtivoLocal,
  obterEquipesTorneioLocal,
  obterPartidasTorneioLocal,
  salvarPartidasTorneioLocal,
  obterJogadoresEquipesLocal,
  salvarPartidaAtivaTorneio,
  obterPartidaAtivaTorneio,
  limparPartidaAtivaTorneio,
  obterEstatisticasTorneio,
  salvarEstatisticasTorneio,
  obterRegrasCompeticaoLocal,
  salvarHistoricoEventosPartida,
  obterTodosHistoricosPartidas,
} from '../../../lib/torneioLocalService';
import { buscar_pelada_id } from '../../../lib/credenciais';

function gerarId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ─── Tipos locais ──────────────────────────────────────────────────────────────
type SeletorTipo = 'gol' | 'assistencia' | null;

interface JogadorComEquipe extends ParticipanteTorneioLocal {
  equipeId: string;
  equipeNome: string;
  equipeEmoji: string;
}

const CORES_EMOJIS = ['🔴', '🔵', '🟢', '🟡', '🟠', '🟣', '⚫', '⚪'];

const COR_EMOJI_MAP: Record<string, string> = {
  '🔴': '#ef4444', '🔵': '#3b82f6', '🟢': '#22c55e', '🟡': '#eab308',
  '🟠': '#f97316', '🟣': '#a855f7', '⚫': '#374151', '⚪': '#d1d5db', '⭐': '#f59e0b',
};

function corDoEmoji(emoji: string | null | undefined): string {
  if (!emoji) return '#94a3b8';
  return COR_EMOJI_MAP[emoji] ?? '#94a3b8';
}

function ShirtSVG({ color, size = 44 }: { color: string; size?: number }) {
  const stroke = color === '#FFFFFF' || color === '#d1d5db' ? '#94a3b8' : color;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 8C14 8 16 6 18 6C20 6 20 8 24 8C28 8 28 6 30 6C32 6 34 8 34 8L38 14V16L36 18V38C36 40 34 42 32 42H16C14 42 12 40 12 38V18L10 16V14L14 8Z"
        fill={color} stroke={stroke} strokeWidth="1.5" />
    </svg>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────

function PartidaTorneioPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const partidaIdParam = searchParams?.get('id');

  const [torneioId, setTorneioId] = useState<string | null>(null);
  const [peladaId, setPeladaId] = useState('default');
  const [isLoading, setIsLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Dados da partida
  const [equipeAId, setEquipeAId] = useState('');
  const [equipeBId, setEquipeBId] = useState('');
  const [equipeANome, setEquipeANome] = useState('');
  const [equipeBNome, setEquipeBNome] = useState('');
  const [equipeAEmoji, setEquipeAEmoji] = useState('🔴');
  const [equipeBEmoji, setEquipeBEmoji] = useState('🔵');
  const [golsA, setGolsA] = useState(0);
  const [golsB, setGolsB] = useState(0);
  const [eventos, setEventos] = useState<EventoPartidaTorneio[]>([]);
  const [jogadoresA, setJogadoresA] = useState<JogadorComEquipe[]>([]);
  const [jogadoresB, setJogadoresB] = useState<JogadorComEquipe[]>([]);

  // UI state
  const [seletorVisivel, setSeletorVisivel] = useState<'A' | 'B' | null>(null);
  const [tipoEvento, setTipoEvento] = useState<SeletorTipo>(null);
  const [golPendente, setGolPendente] = useState<EventoPartidaTorneio | null>(null);
  const [modalFinalizar, setModalFinalizar] = useState(false);
  const [modalCancelar, setModalCancelar] = useState(false);

  // Timer
  const [tempoTotal, setTempoTotal] = useState(600); // fallback 10min
  const [segundos, setSegundos] = useState(0);
  const [timerRodando, setTimerRodando] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const segundosRef = useRef(0);
  const timerRodandoRef = useRef(false);
  const rodandoDesdeRef = useRef<number | null>(null);

  // Mata-mata / prorrogação
  const [isProrrogacao, setIsProrrogacao] = useState(false);
  const [empateDecisao, setEmpateDecisao] = useState<'prorrogacao' | 'penaltis'>('penaltis');
  const [fasePartida, setFasePartida] = useState('');
  const [tempoProrrogacao, setTempoProrrogacao] = useState(300); // fallback 5min

  const iniciadaEm = useRef(new Date().toISOString());

  const carregar = useCallback(() => {
    const torneio = obterTorneioAtivoLocal();
    if (!torneio) { router.replace('/modo-torneio'); return; }
    setTorneioId(torneio.id);

    const pid = buscar_pelada_id() || 'default';
    setPeladaId(pid);

    if (!partidaIdParam) { setErro('Partida não encontrada'); setIsLoading(false); return; }

    const partidas = obterPartidasTorneioLocal(torneio.id);
    const partida = partidas.find((p) => p.id === partidaIdParam);
    if (!partida) { setErro('Partida não encontrada'); setIsLoading(false); return; }
    if (partida.status === 'finalizada') { setErro('Esta partida já foi finalizada'); setIsLoading(false); return; }
    setFasePartida(partida.fase);

    const equipes = obterEquipesTorneioLocal(torneio.id);
    const eqA = equipes.find((e) => e.id === partida.equipe_a_id);
    const eqB = equipes.find((e) => e.id === partida.equipe_b_id);
    const idxA = equipes.findIndex((e) => e.id === partida.equipe_a_id);
    const idxB = equipes.findIndex((e) => e.id === partida.equipe_b_id);

    setEquipeAId(partida.equipe_a_id);
    setEquipeBId(partida.equipe_b_id);
    setEquipeANome(eqA?.nome ?? 'Time A');
    setEquipeBNome(eqB?.nome ?? 'Time B');
    setEquipeAEmoji(eqA?.cor ?? CORES_EMOJIS[idxA] ?? '🔴');
    setEquipeBEmoji(eqB?.cor ?? CORES_EMOJIS[idxB] ?? '🔵');

    const mapaJogadores = obterJogadoresEquipesLocal(torneio.id);
    const toJ = (p: ParticipanteTorneioLocal, eId: string, eNome: string, eEmoji: string): JogadorComEquipe => ({
      ...p, equipeId: eId, equipeNome: eNome, equipeEmoji: eEmoji,
    });

    setJogadoresA((mapaJogadores[partida.equipe_a_id] ?? eqA?.jogadores ?? []).map(
      (p) => toJ(p, partida.equipe_a_id, eqA?.nome ?? 'Time A', eqA?.cor ?? CORES_EMOJIS[idxA] ?? '🔴'),
    ));
    setJogadoresB((mapaJogadores[partida.equipe_b_id] ?? eqB?.jogadores ?? []).map(
      (p) => toJ(p, partida.equipe_b_id, eqB?.nome ?? 'Time B', eqB?.cor ?? CORES_EMOJIS[idxB] ?? '🔵'),
    ));

    // Tempo de partida das regras
    const regras = obterRegrasCompeticaoLocal(torneio.id);
    const tempoProrr = (regras?.tempo_prorrogacao ?? 5) * 60;
    setTempoProrrogacao(tempoProrr);
    setEmpateDecisao(regras?.empate_decisao ?? 'penaltis');

    // Verificar se é prorrogação (partida_ativa marcada)
    const pAtivaTemp = obterPartidaAtivaTorneio();
    const ehProrr = !!(pAtivaTemp && pAtivaTemp.partidaId === partidaIdParam && pAtivaTemp.isProrrogacao);
    setIsProrrogacao(ehProrr);

    const minutos = ehProrr ? (regras?.tempo_prorrogacao ?? 5) : (regras?.tempo_partida ?? 10);
    const numTempos = ehProrr ? (regras?.tempos_prorrogacao ?? 1) : (regras?.tempos_partida ?? 1);
    const total = minutos * 60 * numTempos;
    setTempoTotal(total);

    // Verificar se há estado salvo
    const pAtiva = obterPartidaAtivaTorneio();
    if (pAtiva && pAtiva.partidaId === partidaIdParam) {
      setGolsA(pAtiva.golsA);
      setGolsB(pAtiva.golsB);
      setEventos(pAtiva.eventos);
      iniciadaEm.current = pAtiva.iniciadaEm;
      const seg = pAtiva.segundos ?? 0;
      // Se o timer estava rodando, calcular segundos que passaram enquanto estava fora
      let segRestaurado = seg;
      if (pAtiva.timerRodando && pAtiva.rodandoDesde) {
        const decorrido = Math.floor((Date.now() - pAtiva.rodandoDesde) / 1000);
        segRestaurado = seg + decorrido;
      }
      setSegundos(segRestaurado);
      segundosRef.current = segRestaurado;
      if (pAtiva.timerRodando) {
        setTimerRodando(true);
        timerRodandoRef.current = true;
        rodandoDesdeRef.current = Date.now();
      }
    } else {
      // Iniciar nova partida ativa
      const nova: PartidaAtivaTorneio = {
        partidaId: partidaIdParam,
        torneioId: torneio.id,
        peladaId: pid,
        equipeAId: partida.equipe_a_id,
        equipeBId: partida.equipe_b_id,
        golsA: 0,
        golsB: 0,
        eventos: [],
        iniciadaEm: iniciadaEm.current,
      };
      salvarPartidaAtivaTorneio(nova);
      window.dispatchEvent(new CustomEvent('partida-torneio-changed'));
    }

    setIsLoading(false);
  }, [router, partidaIdParam]);

  useEffect(() => { carregar(); }, [carregar]);

  // Timer — countdown
  useEffect(() => {
    if (timerRodando) {
      if (!rodandoDesdeRef.current) rodandoDesdeRef.current = Date.now();
      timerRodandoRef.current = true;
      timerRef.current = setInterval(() => {
        setSegundos((s) => {
          const next = s + 1;
          segundosRef.current = next;
          return next;
        });
      }, 1000);
    } else {
      timerRodandoRef.current = false;
      rodandoDesdeRef.current = null;
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRodando]);

  // Salvar estado completo ao sair da página
  useEffect(() => {
    return () => {
      if (!torneioId || !partidaIdParam) return;
      const pAtiva = obterPartidaAtivaTorneio();
      if (pAtiva && pAtiva.partidaId === partidaIdParam) {
        salvarPartidaAtivaTorneio({
          ...pAtiva,
          segundos: segundosRef.current,
          timerRodando: timerRodandoRef.current,
          rodandoDesde: timerRodandoRef.current ? (rodandoDesdeRef.current ?? Date.now()) : undefined,
        });
      }
    };
  }, [torneioId, partidaIdParam]);

  // Persistir estado a cada mudança
  const persistir = useCallback((ga: number, gb: number, ev: EventoPartidaTorneio[]) => {
    if (!torneioId || !partidaIdParam) return;
    const pid = buscar_pelada_id() || 'default';
    salvarPartidaAtivaTorneio({
      partidaId: partidaIdParam,
      torneioId,
      peladaId: pid,
      equipeAId,
      equipeBId,
      golsA: ga,
      golsB: gb,
      eventos: ev,
      iniciadaEm: iniciadaEm.current,
      segundos: segundosRef.current,
      timerRodando: timerRodandoRef.current,
      rodandoDesde: timerRodandoRef.current ? (rodandoDesdeRef.current ?? undefined) : undefined,
    });
  }, [torneioId, partidaIdParam, equipeAId, equipeBId]);

  // ── Registrar gol por time (sem jogadores) ────────────────────────────────
  const registrarGolSemJogador = (equipe: 'A' | 'B') => {
    const equipeId = equipe === 'A' ? equipeAId : equipeBId;
    const equipeNome = equipe === 'A' ? equipeANome : equipeBNome;
    const ev: EventoPartidaTorneio = {
      id: gerarId(),
      tipo: 'gol',
      jogadorId: 'anonimo',
      jogadorNome: equipeNome,
      equipeId,
      timestamp: new Date().toISOString(),
    };
    const novoGolsA = equipe === 'A' ? golsA + 1 : golsA;
    const novoGolsB = equipe === 'B' ? golsB + 1 : golsB;
    const novosEventos = [...eventos, ev];
    if (equipe === 'A') setGolsA(novoGolsA);
    else setGolsB(novoGolsB);
    setEventos(novosEventos);
    persistir(novoGolsA, novoGolsB, novosEventos);
    setSeletorVisivel(null);
    setTipoEvento(null);
  };

  // ── Selecionar jogador ───────────────────────────────────────────────────
  const selecionarJogador = (jogador: JogadorComEquipe) => {
    if (!tipoEvento) return;

    if (tipoEvento === 'gol') {
      const isGolContra = jogador.id.startsWith('gc_');
      // Registrar gol, depois perguntar assistência (exceto gol contra)
      const ev: EventoPartidaTorneio = {
        id: gerarId(),
        tipo: 'gol',
        jogadorId: isGolContra ? 'gc' : jogador.id,
        jogadorNome: isGolContra ? 'Gol Contra' : jogador.nome,
        equipeId: jogador.equipeId,
        timestamp: new Date().toISOString(),
      };
      const equipe = jogador.equipeId === equipeAId ? 'A' : 'B';
      const novoGolsA = equipe === 'A' ? golsA + 1 : golsA;
      const novoGolsB = equipe === 'B' ? golsB + 1 : golsB;
      const novosEventos = [...eventos, ev];
      if (equipe === 'A') setGolsA(novoGolsA);
      else setGolsB(novoGolsB);
      setEventos(novosEventos);
      persistir(novoGolsA, novoGolsB, novosEventos);
      if (isGolContra) {
        // Gol contra não tem assistência
        setSeletorVisivel(null);
        setTipoEvento(null);
      } else {
        setGolPendente(ev);
        setTipoEvento('assistencia');
      }
    } else if (tipoEvento === 'assistencia' && golPendente) {
      const ev: EventoPartidaTorneio = {
        id: gerarId(),
        tipo: 'assistencia',
        jogadorId: jogador.id,
        jogadorNome: jogador.nome,
        equipeId: jogador.equipeId,
        timestamp: new Date().toISOString(),
        golId: golPendente.id,
      };
      const novosEventos = [...eventos, ev];
      setEventos(novosEventos);
      persistir(golsA, golsB, novosEventos);
      setGolPendente(null);
      setTipoEvento(null);
      setSeletorVisivel(null);
    }
  };

  const pularAssistencia = () => {
    setGolPendente(null);
    setTipoEvento(null);
    setSeletorVisivel(null);
  };

  // ── Desfazer último evento ─────────────────────────────────────────────
  const desfazer = () => {
    const ultimo = eventos[eventos.length - 1];
    if (!ultimo) return;
    let novoGolsA = golsA;
    let novoGolsB = golsB;
    if (ultimo.tipo === 'gol') {
      if (ultimo.equipeId === equipeAId) novoGolsA = Math.max(0, golsA - 1);
      else novoGolsB = Math.max(0, golsB - 1);
    }
    const novosEventos = eventos.slice(0, -1);
    setGolsA(novoGolsA);
    setGolsB(novoGolsB);
    setEventos(novosEventos);
    persistir(novoGolsA, novoGolsB, novosEventos);
  };

  // ── Finalizar partida ────────────────────────────────────────────────────
  const confirmarFinalizar = () => {
    if (!torneioId || !partidaIdParam) return;

    const isFaseMM = !['Liga', 'Turno', 'Returno', 'Grupos'].includes(fasePartida);
    const empateMM = isFaseMM && golsA === golsB;

    const partidas = obterPartidasTorneioLocal(torneioId);

    if (empateMM) {
      // Determinar próximo passo
      const proximoDesempate: 'prorrogacao' | 'penaltis' =
        isProrrogacao ? 'penaltis' : empateDecisao === 'prorrogacao' ? 'prorrogacao' : 'penaltis';

      const atualizadas = partidas.map((p) =>
        p.id !== partidaIdParam ? p : {
          ...p,
          gols_a: golsA, gols_b: golsB,
          status: 'aguardando_desempate' as const,
          proximo_desempate: proximoDesempate,
          vencedor_id: null,
          updated_at: new Date().toISOString(),
        }
      );
      salvarPartidasTorneioLocal(torneioId, atualizadas);

      salvarHistoricoEventosPartida(torneioId, {
        partidaId: partidaIdParam,
        eventos,
        finalizadaEm: new Date().toISOString(),
      });

      limparPartidaAtivaTorneio();
      window.dispatchEvent(new CustomEvent('partida-torneio-changed'));
      router.push('/modo-torneio/painel?aba=jogos');
      return;
    }

    const atualizadas = partidas.map((p) => {
      if (p.id !== partidaIdParam) return p;
      const vencedor = golsA > golsB ? equipeAId : golsB > golsA ? equipeBId : null;
      return { ...p, gols_a: golsA, gols_b: golsB, status: 'finalizada' as const, vencedor_id: vencedor, proximo_desempate: undefined, updated_at: new Date().toISOString() };
    });
    salvarPartidasTorneioLocal(torneioId, atualizadas);

    // Salvar histórico de eventos desta partida
    salvarHistoricoEventosPartida(torneioId, {
      partidaId: partidaIdParam,
      eventos,
      finalizadaEm: new Date().toISOString(),
    });

    // Recalcular stats do zero a partir de TODOS os históricos (evita duplicação ao editar partida)
    const todosHistoricos = obterTodosHistoricosPartidas(torneioId);
    const equipesMap = Object.fromEntries(obterEquipesTorneioLocal(torneioId).map(e => [e.id, e.nome]));
    const mapaStats: Record<string, EstatisticaJogadorTorneio> = {};
    todosHistoricos.forEach((hist) => {
      hist.eventos.forEach((ev) => {
        if (ev.jogadorId === 'anonimo') return;
        if (!mapaStats[ev.jogadorId]) {
          const equipeNome = hist.partidaId === partidaIdParam
            ? (ev.equipeId === equipeAId ? equipeANome : equipeBNome)
            : (equipesMap[ev.equipeId] ?? '');
          mapaStats[ev.jogadorId] = { jogadorId: ev.jogadorId, nome: ev.jogadorNome, equipeId: ev.equipeId, equipeNome, gols: 0, assistencias: 0 };
        }
        if (ev.tipo === 'gol') mapaStats[ev.jogadorId].gols++;
        else if (ev.tipo === 'assistencia') mapaStats[ev.jogadorId].assistencias++;
      });
    });
    salvarEstatisticasTorneio(torneioId, Object.values(mapaStats));

    limparPartidaAtivaTorneio();
    window.dispatchEvent(new CustomEvent('partida-torneio-changed'));
    router.push('/modo-torneio/painel?aba=jogos');
  };

  const confirmarCancelar = () => {
    limparPartidaAtivaTorneio();
    window.dispatchEvent(new CustomEvent('partida-torneio-changed'));
    router.back();
  };

  // ── Cores e stats por jogador ─────────────────────────────────────────────
  const corA = corDoEmoji(equipeAEmoji);
  const corB = corDoEmoji(equipeBEmoji);

  const golsPorJogador = useMemo(() => {
    const m: Record<string, number> = {};
    eventos.filter((e) => e.tipo === 'gol' && e.jogadorId !== 'anonimo').forEach((e) => { m[e.jogadorId] = (m[e.jogadorId] ?? 0) + 1; });
    return m;
  }, [eventos]);

  const assistenciasPorJogador = useMemo(() => {
    const m: Record<string, number> = {};
    eventos.filter((e) => e.tipo === 'assistencia').forEach((e) => { m[e.jogadorId] = (m[e.jogadorId] ?? 0) + 1; });
    return m;
  }, [eventos]);

  // ── Timer display (countdown) ────────────────────────────────────────────────────
  const restante = Math.max(0, tempoTotal - segundos);
  const mm = String(Math.floor(restante / 60)).padStart(2, '0');
  const ss = String(restante % 60).padStart(2, '0');
  const timerAcabou = restante === 0;

  // ── Loading / Erro ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Layout title="Partida">
        <div className="flex items-center justify-center h-40">
          <p className="text-gray-400 text-sm">Carregando...</p>
        </div>
      </Layout>
    );
  }

  if (erro) {
    return (
      <Layout title="Partida">
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">⚠️</p>
          <p className="font-semibold text-gray-600">{erro}</p>
          <button onClick={() => router.back()} className="mt-4 px-5 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200">Voltar</button>
        </div>
      </Layout>
    );
  }

  const temJogadores = jogadoresA.length > 0 || jogadoresB.length > 0;

  const aSelectando = seletorVisivel === 'A' && tipoEvento !== null;
  const bSelectando = seletorVisivel === 'B' && tipoEvento !== null;

  return (
    <Layout title="Partida">

      {/* ── PLACAR ──────────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 12 }}>
        <div style={{ background: 'white', borderRadius: 20, padding: '16px 20px 14px', border: isProrrogacao ? '2px solid #f59e0b' : '1px solid #e5e7eb' }}>

          {/* Badge prorrogação */}
          {isProrrogacao && (
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <span style={{ display: 'inline-block', background: '#fef3c7', color: '#d97706', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 99, border: '1px solid #fbbf24' }}>⏱ Prorrogação</span>
            </div>
          )}

          {/* Cronômetro */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 16 }}>
            <button
              onClick={() => { setSegundos(0); segundosRef.current = 0; }}
              style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 11px', color: '#6b7280', fontSize: 18, cursor: 'pointer' }}
            >↺</button>
            <span
              className={!timerRodando && !timerAcabou ? 'animate-pulse' : ''}
              style={{ fontFamily: 'monospace', fontSize: 36, fontWeight: 700, color: timerAcabou ? '#ef4444' : !timerRodando ? '#f59e0b' : '#111827', letterSpacing: 2, lineHeight: 1 }}
            >{mm}:{ss}</span>
            <button
              onClick={() => !timerAcabou && setTimerRodando((r) => !r)}
              className={!timerRodando && !timerAcabou ? 'animate-pulse' : ''}
              style={{ background: timerRodando ? '#f3f4f6' : !timerAcabou ? '#fef3c7' : '#f3f4f6', border: timerRodando ? '1px solid #e5e7eb' : !timerAcabou ? '1.5px solid #fbbf24' : '1px solid #e5e7eb', borderRadius: 8, padding: '6px 11px', color: timerRodando ? '#16a34a' : !timerAcabou ? '#d97706' : '#6b7280', fontSize: 18, cursor: timerAcabou ? 'not-allowed' : 'pointer', opacity: timerAcabou ? 0.5 : 1 }}
            >{timerRodando ? '⏸' : '▶'}</button>
          </div>

          {/* Placar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Gols */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 64, height: 64, borderRadius: 14, background: corA, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 16px ${corA}55` }}>
                <span style={{ fontSize: 32, fontWeight: 900, color: '#fff' }}>{golsA}</span>
              </div>
              <span style={{ color: '#6b7280', fontSize: 22, fontWeight: 700 }}>×</span>
              <div style={{ width: 64, height: 64, borderRadius: 14, background: corB, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 16px ${corB}55` }}>
                <span style={{ fontSize: 32, fontWeight: 900, color: '#fff' }}>{golsB}</span>
              </div>
            </div>
          </div>


        </div>
      </section>

      {/* ── BANNER GOL / ASSISTÊNCIA ─────────────────────────────────────── */}
      {(tipoEvento === 'gol' || tipoEvento === 'assistencia') && (
        <div style={{
          marginBottom: 10, borderRadius: 12, padding: '10px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: tipoEvento === 'gol' ? '#fefce8' : '#ecfdf5',
          border: `2px solid ${tipoEvento === 'gol' ? '#eab308' : '#10b981'}`,
        }}>
          <span style={{ fontSize: 20 }}>{tipoEvento === 'gol' ? '⚽' : '👟'}</span>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: tipoEvento === 'gol' ? '#854d0e' : '#065f46' }}>
            Selecione quem fez o{' '}
            <span style={{ color: tipoEvento === 'gol' ? '#ca8a04' : '#059669', fontWeight: 800, textTransform: 'uppercase' }}>
              {tipoEvento === 'gol' ? 'GOL' : 'ASSISTÊNCIA'}
            </span>
          </p>
        </div>
      )}

      {/* ── JOGADORES ────────────────────────────────────────────────────── */}
      {temJogadores && (
        <section style={{ marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>

            {/* Time A */}
            <div style={{ background: 'white', borderRadius: 14, border: `2px solid ${aSelectando ? corA : '#e5e7eb'}`, overflow: 'hidden', transition: 'border-color .2s' }}>
              <div style={{ padding: '10px', background: corA, display: 'flex', justifyContent: 'center' }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{equipeANome}</p>
              </div>
              {jogadoresA.map((j) => {
                const g = golsPorJogador[j.id] ?? 0;
                const a = assistenciasPorJogador[j.id] ?? 0;
                return (
                  <button key={j.id}
                    onClick={() => aSelectando ? selecionarJogador(j) : undefined}
                    style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '11px 8px', background: aSelectando ? '#fef9c3' : 'transparent', border: 'none', borderBottom: '1px solid #f3f4f6', cursor: aSelectando ? 'pointer' : 'default', transition: 'background .15s' }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>{j.nome}</span>
                    {(g > 0 || a > 0) && <span style={{ fontSize: 11, flexShrink: 0, marginLeft: 2 }}>{g > 0 ? '⚽'.repeat(Math.min(g, 3)) : ''}{a > 0 ? '👟'.repeat(Math.min(a, 3)) : ''}</span>}
                  </button>
                );
              })}
              {aSelectando && tipoEvento === 'gol' && (
                <button
                  onClick={() => selecionarJogador({ id: `gc_A_${gerarId()}`, nome: 'Gol Contra', equipeId: equipeAId, equipeNome: equipeANome, equipeEmoji: '', status: 'confirmado', torneioId: '' } as unknown as JogadorComEquipe)}
                  style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '11px 8px', background: '#fef3c7', border: 'none', borderTop: '1px dashed #fbbf24', cursor: 'pointer', transition: 'background .15s' }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#b45309' }}>⚠️ Gol Contra</span>
                </button>
              )}
              {aSelectando && tipoEvento === 'assistencia' && (
                <button
                  onClick={pularAssistencia}
                  style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '11px 8px', background: '#f3f4f6', border: 'none', borderTop: '1px dashed #d1d5db', cursor: 'pointer', transition: 'background .15s' }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280' }}>🚫 Sem Assistência</span>
                </button>
              )}
            </div>

            {/* Time B */}
            <div style={{ background: 'white', borderRadius: 14, border: `2px solid ${bSelectando ? corB : '#e5e7eb'}`, overflow: 'hidden', transition: 'border-color .2s' }}>
              <div style={{ padding: '10px', background: corB, display: 'flex', justifyContent: 'center' }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{equipeBNome}</p>
              </div>
              {jogadoresB.map((j) => {
                const g = golsPorJogador[j.id] ?? 0;
                const a = assistenciasPorJogador[j.id] ?? 0;
                return (
                  <button key={j.id}
                    onClick={() => bSelectando ? selecionarJogador(j) : undefined}
                    style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '11px 8px', background: bSelectando ? '#fef9c3' : 'transparent', border: 'none', borderBottom: '1px solid #f3f4f6', cursor: bSelectando ? 'pointer' : 'default', transition: 'background .15s' }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>{j.nome}</span>
                    {(g > 0 || a > 0) && <span style={{ fontSize: 11, flexShrink: 0, marginLeft: 2 }}>{g > 0 ? '⚽'.repeat(Math.min(g, 3)) : ''}{a > 0 ? '👟'.repeat(Math.min(a, 3)) : ''}</span>}
                  </button>
                );
              })}
              {bSelectando && tipoEvento === 'gol' && (
                <button
                  onClick={() => selecionarJogador({ id: `gc_B_${gerarId()}`, nome: 'Gol Contra', equipeId: equipeBId, equipeNome: equipeBNome, equipeEmoji: '', status: 'confirmado', torneioId: '' } as unknown as JogadorComEquipe)}
                  style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '11px 8px', background: '#fef3c7', border: 'none', borderTop: '1px dashed #fbbf24', cursor: 'pointer', transition: 'background .15s' }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#b45309' }}>⚠️ Gol Contra</span>
                </button>
              )}
              {bSelectando && tipoEvento === 'assistencia' && (
                <button
                  onClick={pularAssistencia}
                  style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '11px 8px', background: '#f3f4f6', border: 'none', borderTop: '1px dashed #d1d5db', cursor: 'pointer', transition: 'background .15s' }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280' }}>🚫 Sem Assistência</span>
                </button>
              )}
            </div>
          </div>

        </section>
      )}

      {/* ── GOL / VAR ────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => { if (temJogadores) { setSeletorVisivel('A'); setTipoEvento('gol'); } else registrarGolSemJogador('A'); }}
          style={{ padding: '12px 0', borderRadius: 12, background: corA, border: 'none', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >Gol ⚽</button>
        <button
          onClick={desfazer}
          disabled={eventos.length === 0}
          style={{ padding: '12px 14px', borderRadius: 12, background: '#e5e7eb', border: 'none', color: '#6b7280', fontWeight: 700, fontSize: 14, cursor: eventos.length === 0 ? 'not-allowed' : 'pointer', opacity: eventos.length === 0 ? 0.4 : 1, whiteSpace: 'nowrap' }}
        >VAR</button>
        <button
          onClick={() => { if (temJogadores) { setSeletorVisivel('B'); setTipoEvento('gol'); } else registrarGolSemJogador('B'); }}
          style={{ padding: '12px 0', borderRadius: 12, background: corB, border: 'none', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >Gol ⚽</button>
      </div>

      {/* ── AÇÕES ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        <button
          onClick={() => setModalFinalizar(true)}
          style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '14px 0', borderRadius: 14, background: 'linear-gradient(135deg,#22c55e,#16a34a)', border: 'none', color: 'white', fontWeight: 700, fontSize: 16, cursor: 'pointer', boxShadow: '0 4px 14px rgba(34,197,94,.3)' }}
        >
          <span>🏁</span><span>Finalizar Partida</span>
        </button>
        <button
          onClick={() => setModalCancelar(true)}
          style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', alignSelf: 'center' }}
        >
          Cancelar partida
        </button>
      </div>

      {/* ── HISTÓRICO DE EVENTOS ────────────────────────────────────────── */}
      {eventos.length > 0 && (() => {
        // Construir pares: cada gol com sua assist linkada
        const assistPorGolId = new Map(eventos.filter((e) => e.tipo === 'assistencia' && e.golId).map((e) => [e.golId!, e]));
        const assistSemGol = eventos.filter((e) => e.tipo === 'assistencia' && !e.golId);
        // Itens a exibir: gols (com assist embutida) + assists sem gol vinculado
        const itens: { gol: EventoPartidaTorneio; assist: EventoPartidaTorneio | null }[] = [
          ...eventos.filter((e) => e.tipo === 'gol').map((g) => ({ gol: g, assist: assistPorGolId.get(g.id) ?? null })),
          ...assistSemGol.map((a) => ({ gol: a, assist: null })),
        ];
        // Inverter para mostrar o mais recente primeiro
        const itensInvertidos = [...itens].reverse();
        return (
          <section style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: '0 4px' }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Eventos</p>
              <button onClick={desfazer} style={{ fontSize: 12, color: '#ef4444', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>↩ Desfazer</button>
            </div>
            <div style={{ background: 'white', borderRadius: 14, border: '1px solid #f3f4f6', overflow: 'hidden' }}>
              {itensInvertidos.map(({ gol, assist }, i) => (
                <div key={gol.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderTop: i > 0 ? '1px solid #f9fafb' : 'none' }}>
                  <span style={{ fontSize: 18 }}>⚽</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1f2937' }}>{gol.tipo === 'gol' ? gol.jogadorNome : gol.jogadorNome}</span>
                    {assist && <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 6 }}>👟 {assist.jogadorNome}</span>}
                  </div>
                  <span style={{ fontSize: 16 }}>{gol.equipeId === equipeAId ? equipeAEmoji : equipeBEmoji}</span>
                </div>
              ))}
            </div>
          </section>
        );
      })()}



      {/* ── MODAL FINALIZAR ──────────────────────────────────────────────── */}
      {modalFinalizar && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
          <div style={{ backgroundColor: 'white', borderRadius: 24, padding: 28, maxWidth: 400, width: '100%' }}>
            <h3 style={{ margin: '0 0 8px', fontWeight: 900, fontSize: 20, textAlign: 'center', color: '#111827' }}>Finalizar Partida?</h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, margin: '24px 0' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 48, fontWeight: 900, color: corA }}>{golsA}</p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280', fontWeight: 600 }}>{equipeANome}</p>
              </div>
              <span style={{ fontSize: 24, color: '#d1d5db', fontWeight: 700 }}>×</span>
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 48, fontWeight: 900, color: corB }}>{golsB}</p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280', fontWeight: 600 }}>{equipeBNome}</p>
              </div>
            </div>
            <p style={{ margin: '0 0 24px', fontSize: 14, textAlign: 'center', color: '#6b7280' }}>
              {golsA > golsB
                ? `${equipeANome} vence!`
                : golsB > golsA
                  ? `${equipeBNome} vence!`
                  : !['Liga', 'Turno', 'Returno', 'Grupos'].includes(fasePartida)
                    ? `Empate — vai para ${isProrrogacao || empateDecisao !== 'prorrogacao' ? 'penalidades' : 'prorrogação'}!`
                    : 'Empate!'}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setModalFinalizar(false)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '1px solid #e5e7eb', background: 'transparent', color: '#6b7280', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Voltar</button>
              <button onClick={confirmarFinalizar} style={{ flex: 1, padding: '12px 0', borderRadius: 12, background: '#22c55e', border: 'none', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CANCELAR ───────────────────────────────────────────────── */}
      {modalCancelar && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
          <div style={{ backgroundColor: 'white', borderRadius: 24, padding: 28, maxWidth: 380, width: '100%' }}>
            <h3 style={{ margin: '0 0 8px', fontWeight: 900, fontSize: 20, textAlign: 'center', color: '#111827' }}>Cancelar Partida?</h3>
            <p style={{ margin: '0 0 24px', fontSize: 14, textAlign: 'center', color: '#6b7280' }}>O progresso desta partida será perdido.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setModalCancelar(false)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '1px solid #e5e7eb', background: 'transparent', color: '#6b7280', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Não</button>
              <button onClick={confirmarCancelar} style={{ flex: 1, padding: '12px 0', borderRadius: 12, background: '#ef4444', border: 'none', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Sim, Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}


export default function PartidaTorneioPageWrapper() {
  return (
    <Suspense fallback={null}>
      <PartidaTorneioPage />
    </Suspense>
  );
}
