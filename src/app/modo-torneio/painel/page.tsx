'use client';

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Layout from '../../../components/Layout';
import {
  EquipeTorneioLocal,
  PartidaTorneioLocal,
  RegrasCompeticaoLocal,
  TorneioLocal,
  ParticipanteTorneioLocal,
  JogadoresEquipeMap,
  EstatisticaJogadorTorneio,
  EventoPartidaTorneio,
  HistoricoEventosPartidaTorneio,
  obterEquipesTorneioLocal,
  obterPartidasTorneioLocal,
  obterRegrasCompeticaoLocal,
  obterTorneioAtivoLocal,
  salvarEquipesTorneioLocal,
  salvarPartidasTorneioLocal,
  salvarRegrasCompeticaoLocal,
  obterJogadoresEquipesLocal,
  salvarJogadoresEquipesLocal,
  obterEstatisticasTorneio,
  obterParticipantesTorneioLocal,
  obterPartidaAtivaTorneio,
  salvarPartidaAtivaTorneio,
  obterTodosHistoricosPartidas,
  salvarSnapshotTorneio,
  obterSnapshotTorneio,
  encerrarTorneioLocal,
  obterTorneiosEncerrados,
} from '../../../lib/torneioLocalService';
import { buscar_pelada_id } from '../../../lib/credenciais';
import { validarSenhaPelada } from '../../../lib/supabase';

type Aba = 'painel' | 'times' | 'jogos' | 'classificacao' | 'chaveamento' | 'estatisticas';

const CORES_EMOJIS = ['🔴', '🔵', '🟢', '🟡', '🟠', '🟣', '⚫', '⚪'];

function gerarId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

const COR_EMOJI_MAP: Record<string, string> = {
  '🔴': '#ef4444',
  '🔵': '#3b82f6',
  '🟢': '#22c55e',
  '🟡': '#eab308',
  '🟠': '#f97316',
  '🟣': '#a855f7',
  '⚫': '#374151',
  '⚪': '#d1d5db',
  '⭐': '#f59e0b',
};

function corDoTime(cor: string | null | undefined): string {
  if (!cor) return '#94a3b8';
  return COR_EMOJI_MAP[cor] ?? '#94a3b8';
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function gerarPartidas(equipes: EquipeTorneioLocal[], torneioId: string, peladaId: string, rodadas: number): PartidaTorneioLocal[] {
  const now = new Date().toISOString();
  const partidas: PartidaTorneioLocal[] = [];

  // Algoritmo de Berger: distribui os confrontos em rodadas equilibradas
  // (cada time joga uma vez por rodada, times diferentes na sequência)
  const n = equipes.length;
  const lista = [...equipes];
  // Se n é ímpar, adiciona um "bye" virtual
  if (n % 2 !== 0) lista.push({ id: '__bye__' } as EquipeTorneioLocal);
  const m = lista.length;
  const numRodadasBase = m - 1;

  for (let fase = 1; fase <= rodadas; fase++) {
    const faseLabel = rodadas > 1 ? (fase === 1 ? 'Turno' : 'Returno') : 'Liga';
    const fixo = lista[0];
    const rotativos = lista.slice(1);

    for (let r = 0; r < numRodadasBase; r++) {
      const rodadaNum = (fase - 1) * numRodadasBase + r + 1;
      const rotAtual = [...rotativos.slice(r), ...rotativos.slice(0, r)];
      const pares: [EquipeTorneioLocal, EquipeTorneioLocal][] = [[fixo, rotAtual[0]]];
      for (let k = 1; k < m / 2; k++) {
        pares.push([rotAtual[k], rotAtual[m - 1 - k]]);
      }
      pares.forEach(([a, b]) => {
        if (a.id === '__bye__' || b.id === '__bye__') return;
        // No returno inverte as posições
        const [eqA, eqB] = fase % 2 === 0 ? [b, a] : [a, b];
        partidas.push({ id: gerarId(), torneio_id: torneioId, pelada_id: peladaId, fase: faseLabel, rodada: rodadaNum, equipe_a_id: eqA.id, equipe_b_id: eqB.id, gols_a: 0, gols_b: 0, status: 'agendada', data_partida: null, vencedor_id: null, created_at: now, updated_at: now, deleted_at: null, sync_status: 'local_only', version: 1 });
      });
    }
  }
  return partidas;
}

const CRITERIO_COL: Record<string, { abbrev: string; key: string }> = {
  pontos: { abbrev: 'Pts', key: 'pts' },
  vitorias: { abbrev: 'V', key: 'v' },
  empates: { abbrev: 'E', key: 'emp' },
  derrotas: { abbrev: 'D', key: 'd' },
  saldo_gols: { abbrev: 'SG', key: 'saldo' },
  gols_pro: { abbrev: 'GP', key: 'gp' },
  gols_contra: { abbrev: 'GC', key: 'gc' },
  total_cartoes: { abbrev: 'Ct', key: 'cartoes' },
  jogos: { abbrev: 'J', key: 'j' },
};

const CRITERIO_ASC = new Set(['gols_contra', 'total_cartoes']);

function buildColunas(criterios: string[]) {
  // Colunas = J + Pts + somente os critérios selecionados (confronto_direto não é coluna visual)
  return ['jogos', 'pontos', ...criterios.filter((c) => c !== 'pontos' && c !== 'confronto_direto' && CRITERIO_COL[c])]
    .filter((c, i, arr) => arr.indexOf(c) === i);
}

function PainelTorneioPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [torneio, setTorneio] = useState<TorneioLocal | null>(null);
  const [equipes, setEquipes] = useState<EquipeTorneioLocal[]>([]);
  const [partidas, setPartidas] = useState<PartidaTorneioLocal[]>([]);
  const [regras, setRegras] = useState<RegrasCompeticaoLocal | null>(null);
  const [jogadoresPorEquipe, setJogadoresPorEquipe] = useState<JogadoresEquipeMap>({});
  const [todosParticipantes, setTodosParticipantes] = useState<ParticipanteTorneioLocal[]>([]);
  const [stats, setStats] = useState<EstatisticaJogadorTorneio[]>([]);
  const [abaAtiva, setAbaAtiva] = useState<Aba>('painel');
  const [isLoading, setIsLoading] = useState(true);
  const [temPartidaAtiva, setTemPartidaAtiva] = useState(false);
  const [desempateSorteio, setDesempateSorteio] = useState<Record<string, number>>({});

  const [editandoTimeId, setEditandoTimeId] = useState<string | null>(null);
  // Modais do painel
  const [modalEditarRegras, setModalEditarRegras] = useState(false);
  const [regrasTempo, setRegrasTempo] = useState(10);
  const [regrasEmpate, setRegrasEmpate] = useState<'prorrogacao' | 'penaltis'>('penaltis');
  const [regrasTemposPartida, setRegrasTemposPartida] = useState<1 | 2>(1);
  const [regrasTempoProrrogacao, setRegrasTempoProrrogacao] = useState(5);
  const [modalSalvar, setModalSalvar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [ultimoSalvo, setUltimoSalvo] = useState<string | null>(null);
  const [modalEncerrar, setModalEncerrar] = useState(false);
  const [encerrando, setEncerrando] = useState(false);
  const [senhaEncerrar, setSenhaEncerrar] = useState('');
  const [erroSenhaEncerrar, setErroSenhaEncerrar] = useState('');
  const [modalFechar, setModalFechar] = useState(false);
  const [isReadonly, setIsReadonly] = useState(false);
  const [modalTimesAberto, setModalTimesAberto] = useState(false);
  const [modalCampeao, setModalCampeao] = useState(false);
  const [modalDestaques, setModalDestaques] = useState(false);
  const campeaoMostradoRef = useRef(false);
  const [nomeEditando, setNomeEditando] = useState('');
  const [modalTimeId, setModalTimeId] = useState<string | null>(null);
  const [jogadorParaTrocar, setJogadorParaTrocar] = useState<ParticipanteTorneioLocal | null>(null);
  const [modoSubstituicao, setModoSubstituicao] = useState(false);
  const [partidaResultadoId, setPartidaResultadoId] = useState<string | null>(null);
  const [golsA, setGolsA] = useState('0');
  const [golsB, setGolsB] = useState('0');
  const [peladaId, setPeladaId] = useState('default');
  const [historicosMap, setHistoricosMap] = useState<Record<string, HistoricoEventosPartidaTorneio>>({});
  const [modalDetalhesPartidaId, setModalDetalhesPartidaId] = useState<string | null>(null);
  const [modalEditarPartidaId, setModalEditarPartidaId] = useState<string | null>(null);
  const [editarModoPenaltis, setEditarModoPenaltis] = useState(false);
  const [senhaEditar, setSenhaEditar] = useState('');
  const [erroSenhaEditar, setErroSenhaEditar] = useState('');
  const [carregandoSenha, setCarregandoSenha] = useState(false);
  const [rodadasAbertas, setRodadasAbertas] = useState<Set<string>>(new Set());
  const [statsExpandidas, setStatsExpandidas] = useState<Set<string>>(new Set());
  const [showProbabilidades, setShowProbabilidades] = useState(false);

  const carregar = useCallback(() => {
    const readonlyParam = searchParams?.get('readonly');
    const torneioIdParam = searchParams?.get('torneioId');

    if (readonlyParam === '1' && torneioIdParam) {
      setIsReadonly(true);
      const snap = obterSnapshotTorneio(torneioIdParam);
      if (!snap) { router.replace('/modo-torneio'); return; }
      const pid = buscar_pelada_id() || 'default';
      setPeladaId(pid);
      setTorneio(snap.torneio);
      setEquipes(snap.equipes);
      setPartidas(snap.partidas);
      setRegras(snap.regras);
      if (snap.regras) {
        setRegrasTempo(snap.regras.tempo_partida ?? 10);
        setRegrasEmpate((snap.regras.empate_decisao as 'prorrogacao' | 'penaltis') ?? 'penaltis');
        setRegrasTemposPartida((snap.regras.tempos_partida as 1 | 2) ?? 1);
        setRegrasTempoProrrogacao(snap.regras.tempo_prorrogacao ?? 5);
      }
      setUltimoSalvo(snap.savedAt);
      const mapaFinal: JogadoresEquipeMap = {};
      snap.equipes.forEach((e) => {
        mapaFinal[e.id] = e.jogadores && e.jogadores.length > 0 ? e.jogadores : [];
      });
      setJogadoresPorEquipe(mapaFinal);
      setStats(snap.estatisticas);
      const mapa: Record<string, HistoricoEventosPartidaTorneio> = {};
      snap.historicos.forEach((h) => { mapa[h.partidaId] = h; });
      setHistoricosMap(mapa);
      setTemPartidaAtiva(false);
      setDesempateSorteio({});
      setIsLoading(false);
      return;
    }

    const t = obterTorneioAtivoLocal();
    if (!t) { router.replace('/modo-torneio'); return; }
    setTorneio(t);
    const pid = buscar_pelada_id() || 'default';
    setPeladaId(pid);
    const eq = obterEquipesTorneioLocal(t.id);
    setEquipes(eq);
    const r = obterRegrasCompeticaoLocal(t.id);
    setRegras(r);
    if (r) {
      setRegrasTempo(r.tempo_partida ?? 10);
      setRegrasEmpate((r.empate_decisao as 'prorrogacao' | 'penaltis') ?? 'penaltis');
      setRegrasTemposPartida((r.tempos_partida as 1 | 2) ?? 1);
      setRegrasTempoProrrogacao(r.tempo_prorrogacao ?? 5);
    }
    const snap = obterSnapshotTorneio(t.id);
    if (snap) setUltimoSalvo(snap.savedAt);
    // Jogadores: fonte primária = equipe.jogadores (salvo desde a confirmação)
    // Fallback: mapa separado legado (torneios antigos)
    const mapaLegado = obterJogadoresEquipesLocal(t.id);
    const mapaFinal: JogadoresEquipeMap = {};
    eq.forEach((e) => {
      mapaFinal[e.id] = e.jogadores && e.jogadores.length > 0 ? e.jogadores : (mapaLegado[e.id] ?? []);
    });
    setJogadoresPorEquipe(mapaFinal);
    setTodosParticipantes(obterParticipantesTorneioLocal(t.id));
    setStats(obterEstatisticasTorneio(t.id));
    try {
      const rawSorteio = localStorage.getItem(`desempate_sorteio_${t.id}`);
      setDesempateSorteio(rawSorteio ? JSON.parse(rawSorteio) : {});
    } catch { setDesempateSorteio({}); }
    const pAtiva = obterPartidaAtivaTorneio();
    setTemPartidaAtiva(!!(pAtiva && pAtiva.torneioId === t.id));
    let pts = obterPartidasTorneioLocal(t.id);
    if (pts.length === 0 && eq.length >= 2) {
      const rodadas = r?.ida_e_volta ? 2 : 1;
      pts = gerarPartidas(eq, t.id, pid, rodadas);
      salvarPartidasTorneioLocal(t.id, pts);
    } else if (pts.length > 0 && eq.length >= 3 && pts.every((p) => p.rodada === 1)) {
      // Migração: torneio criado antes do algoritmo de Berger — redistribuir rodadas
      const rodadas = r?.ida_e_volta ? 2 : 1;
      const novas = gerarPartidas(eq, t.id, pid, rodadas);
      const porPar = new Map<string, PartidaTorneioLocal>();
      pts.forEach((p) => {
        porPar.set(`${p.equipe_a_id}_${p.equipe_b_id}`, p);
        porPar.set(`${p.equipe_b_id}_${p.equipe_a_id}`, p);
      });
      pts = novas.map((nova) => {
        const existente = porPar.get(`${nova.equipe_a_id}_${nova.equipe_b_id}`);
        return existente
          ? { ...nova, id: existente.id, gols_a: existente.gols_a, gols_b: existente.gols_b, status: existente.status, vencedor_id: existente.vencedor_id }
          : nova;
      });
      salvarPartidasTorneioLocal(t.id, pts);
    }
    setPartidas(pts);
    // Carregar históricos de eventos por partida
    const historicos = obterTodosHistoricosPartidas(t.id);
    const mapa: Record<string, HistoricoEventosPartidaTorneio> = {};
    historicos.forEach((h) => { mapa[h.partidaId] = h; });
    setHistoricosMap(mapa);
    setIsLoading(false);
  }, [router, searchParams]);

  useEffect(() => {
    carregar();
    const tab = searchParams?.get('aba') as Aba | null;
    if (tab) setAbaAtiva(tab);
  }, [carregar, searchParams]);

  useEffect(() => {
    const handler = () => carregar();
    window.addEventListener('partida-torneio-changed', handler);
    return () => window.removeEventListener('partida-torneio-changed', handler);
  }, [carregar]);

  // Sync aba via searchParams changes
  useEffect(() => {
    const tab = searchParams?.get('aba') as Aba | null;
    if (tab && tab !== abaAtiva) setAbaAtiva(tab);
  }, [searchParams, abaAtiva]);

  const criterios = useMemo(() => regras?.criterios_desempate ?? ['pontos', 'vitorias', 'saldo_gols', 'gols_pro'], [regras]);

  const cartoesPorEquipe = useMemo(() => {
    const totals: Record<string, number> = {};
    Object.values(historicosMap).forEach((history) => {
      history.eventos.forEach((event) => {
        if (event.tipo !== 'cartao') return;
        totals[event.equipeId] = (totals[event.equipeId] ?? 0) + 1;
      });
    });
    return totals;
  }, [historicosMap]);

  const classificacao = useMemo(() => {
    return [...equipes].map((e) => {
      const jogadas = partidas.filter((p) => p.status === 'finalizada' && (p.equipe_a_id === e.id || p.equipe_b_id === e.id));
      let pts = 0, v = 0, emp = 0, d = 0, gp = 0, gc = 0;
      jogadas.forEach((p) => {
        const somos_a = p.equipe_a_id === e.id;
        const nGp = somos_a ? p.gols_a : p.gols_b;
        const nGc = somos_a ? p.gols_b : p.gols_a;
        gp += nGp; gc += nGc;
        if (nGp > nGc) { pts += (regras?.pontos_vitoria ?? 3); v++; }
        else if (nGp === nGc) { pts += (regras?.pontos_empate ?? 1); emp++; }
        else { pts += (regras?.pontos_derrota ?? 0); d++; }
      });
      return { ...e, pts, v, emp, d, gp, gc, saldo: gp - gc, j: jogadas.length, cartoes: cartoesPorEquipe[e.id] ?? 0 };
    }).sort((a, b) => {
      // 1. Critérios selecionados pelo usuário
      for (const c of criterios) {
        if (c === 'total_cartoes' && !regras?.registrar_cartoes) continue;
        const col = CRITERIO_COL[c]; if (!col) continue;
        const av = (a as unknown as Record<string, number>)[col.key] ?? 0;
        const bv = (b as unknown as Record<string, number>)[col.key] ?? 0;
        if (bv !== av) return CRITERIO_ASC.has(c) ? av - bv : bv - av;
      }
      // 2. Confronto direto — sempre aplicado, independente de configuração
      const diretas = partidas.filter(
        (p) => p.status === 'finalizada' &&
          ((p.equipe_a_id === a.id && p.equipe_b_id === b.id) ||
           (p.equipe_a_id === b.id && p.equipe_b_id === a.id))
      );
      if (diretas.length > 0) {
        let ptsA = 0, ptsB = 0, sgA = 0;
        diretas.forEach((p) => {
          const aEhA = p.equipe_a_id === a.id;
          const ga = aEhA ? p.gols_a : p.gols_b;
          const gb = aEhA ? p.gols_b : p.gols_a;
          if (ga > gb) ptsA += (regras?.pontos_vitoria ?? 3);
          else if (ga === gb) { ptsA += (regras?.pontos_empate ?? 1); ptsB += (regras?.pontos_empate ?? 1); }
          else ptsB += (regras?.pontos_vitoria ?? 3);
          sgA += ga - gb;
        });
        if (ptsA !== ptsB) return ptsA > ptsB ? -1 : 1;
        if (sgA !== 0) return sgA > 0 ? -1 : 1;
      }
      // 3. Sorteio persistido — último recurso (gerado pelo botão 🎲)
      const da = desempateSorteio[a.id] ?? Infinity;
      const db = desempateSorteio[b.id] ?? Infinity;
      if (da !== db) return da - db;
      // 4. Alfabético como fallback estável enquanto não houver sorteio
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });
  }, [equipes, partidas, regras, criterios, desempateSorteio, cartoesPorEquipe]);

  const equipeById = (id: string) => equipes.find((e) => e.id === id);

  const suplentes = useMemo(() => todosParticipantes.filter((p) => p.status === 'reserva'), [todosParticipantes]);

  const salvarNomeTime = (id: string) => {
    if (!torneio) return;
    const atualizadas = equipes.map((e) => e.id === id ? { ...e, nome: nomeEditando.trim() || e.nome } : e);
    salvarEquipesTorneioLocal(torneio.id, atualizadas);
    setEquipes(atualizadas);
    setEditandoTimeId(null);
  };

  const trocarJogador = (suplente: ParticipanteTorneioLocal) => {
    if (!torneio || !modalTimeId || !jogadorParaTrocar) return;
    const mapa = { ...jogadoresPorEquipe };
    const jogadoresTime = [...(mapa[modalTimeId] ?? [])];
    const idx = jogadoresTime.findIndex((j) => j.id === jogadorParaTrocar.id);
    if (idx >= 0) {
      jogadoresTime[idx] = { ...suplente, status: 'confirmado' };
      mapa[modalTimeId] = jogadoresTime;
      const novosParticipantes = todosParticipantes.map((p) => {
        if (p.id === suplente.id) return { ...p, status: 'confirmado' as const };
        if (p.id === jogadorParaTrocar.id) return { ...p, status: 'reserva' as const };
        return p;
      });
      salvarJogadoresEquipesLocal(torneio.id, mapa);
      // Atualiza também equipe.jogadores na estrutura da equipe
      const equipesAtualizadas = equipes.map((e) =>
        e.id === modalTimeId ? { ...e, jogadores: mapa[modalTimeId] } : e
      );
      salvarEquipesTorneioLocal(torneio.id, equipesAtualizadas);
      setEquipes(equipesAtualizadas);
      setJogadoresPorEquipe(mapa);
      setTodosParticipantes(novosParticipantes);
    }
    setJogadorParaTrocar(null);
  };

  const removerJogador = (jogador: ParticipanteTorneioLocal) => {
    if (!torneio || !modalTimeId) return;
    const mapa = { ...jogadoresPorEquipe };
    const jogadoresTime = [...(mapa[modalTimeId] ?? [])].filter((j) => j.id !== jogador.id);
    mapa[modalTimeId] = jogadoresTime;
    const novosParticipantes = todosParticipantes.map((p) =>
      p.id === jogador.id ? { ...p, status: 'reserva' as const } : p
    );
    salvarJogadoresEquipesLocal(torneio.id, mapa);
    const equipesAtualizadas = equipes.map((e) =>
      e.id === modalTimeId ? { ...e, jogadores: mapa[modalTimeId] } : e
    );
    salvarEquipesTorneioLocal(torneio.id, equipesAtualizadas);
    setEquipes(equipesAtualizadas);
    setJogadoresPorEquipe(mapa);
    setTodosParticipantes(novosParticipantes);
  };

  const adicionarJogador = (suplente: ParticipanteTorneioLocal) => {
    if (!torneio || !modalTimeId) return;
    const mapa = { ...jogadoresPorEquipe };
    const jogadoresTime = [...(mapa[modalTimeId] ?? []), { ...suplente, status: 'confirmado' as const }];
    mapa[modalTimeId] = jogadoresTime;
    const novosParticipantes = todosParticipantes.map((p) =>
      p.id === suplente.id ? { ...p, status: 'confirmado' as const } : p
    );
    salvarJogadoresEquipesLocal(torneio.id, mapa);
    const equipesAtualizadas = equipes.map((e) =>
      e.id === modalTimeId ? { ...e, jogadores: mapa[modalTimeId] } : e
    );
    salvarEquipesTorneioLocal(torneio.id, equipesAtualizadas);
    setEquipes(equipesAtualizadas);
    setJogadoresPorEquipe(mapa);
    setTodosParticipantes(novosParticipantes);
  };

  const lancarResultado = (partidaId: string) => {
    if (!torneio) return;
    const ga = parseInt(golsA) || 0;
    const gb = parseInt(golsB) || 0;
    const atualizadas = partidas.map((p) => {
      if (p.id !== partidaId) return p;
      const vencedor = ga > gb ? p.equipe_a_id : gb > ga ? p.equipe_b_id : null;
      return { ...p, gols_a: ga, gols_b: gb, status: 'finalizada' as const, vencedor_id: vencedor, updated_at: new Date().toISOString() };
    });
    salvarPartidasTorneioLocal(torneio.id, atualizadas);
    setPartidas(atualizadas);
    setPartidaResultadoId(null);
  };

  const confirmarEditarPartida = async () => {
    if (!modalEditarPartidaId || !torneio) return;
    setCarregandoSenha(true);
    setErroSenhaEditar('');
    const valida = await validarSenhaPelada(senhaEditar);
    setCarregandoSenha(false);
    if (!valida) { setErroSenhaEditar('Senha incorreta'); return; }

    const p = partidas.find((x) => x.id === modalEditarPartidaId);
    if (!p) return;

    if (editarModoPenaltis) {
      // Reabrir como pênaltis: volta para aguardando_desempate, apaga resultado de pênaltis
      const atualizadas = partidas.map((x) =>
        x.id === modalEditarPartidaId
          ? { ...x, status: 'aguardando_desempate' as const, vencedor_id: null, penaltis_kicks: [], proximo_desempate: 'penaltis' as const, updated_at: new Date().toISOString() }
          : x
      );
      salvarPartidasTorneioLocal(torneio.id, atualizadas);
      setPartidas(atualizadas);
      setModalEditarPartidaId(null);
      setModalDetalhesPartidaId(null);
      setSenhaEditar('');
      setEditarModoPenaltis(false);
      window.dispatchEvent(new CustomEvent('partida-torneio-changed'));
      router.push(`/modo-torneio/penaltis?id=${modalEditarPartidaId}`);
      return;
    }

    // Reverter status da partida para agendada
    const atualizadas = partidas.map((x) =>
      x.id === modalEditarPartidaId
        ? { ...x, status: 'agendada' as const, gols_a: 0, gols_b: 0, vencedor_id: null, penaltis_kicks: [], updated_at: new Date().toISOString() }
        : x
    );
    salvarPartidasTorneioLocal(torneio.id, atualizadas);
    setPartidas(atualizadas);

    // Restaurar partida_ativa a partir do histórico (mantém gols/eventos para edição)
    const hist = historicosMap[modalEditarPartidaId];
    const pid = buscar_pelada_id() || 'default';
    salvarPartidaAtivaTorneio({
      partidaId: modalEditarPartidaId,
      torneioId: torneio.id,
      peladaId: pid,
      equipeAId: p.equipe_a_id,
      equipeBId: p.equipe_b_id,
      golsA: p.gols_a,
      golsB: p.gols_b,
      eventos: hist?.eventos ?? [],
      iniciadaEm: new Date().toISOString(),
      segundos: 0,
      timerRodando: false,
    });

    setModalEditarPartidaId(null);
    setModalDetalhesPartidaId(null);
    setSenhaEditar('');
    setEditarModoPenaltis(false);
    window.dispatchEvent(new CustomEvent('partida-torneio-changed'));
    router.push(`/modo-torneio/partida?id=${modalEditarPartidaId}`);
  };

  const sortearEmpates = () => {
    if (!torneio) return;
    const mapa: Record<string, number> = {};
    equipes.forEach((e) => { mapa[e.id] = Math.random(); });
    localStorage.setItem(`desempate_sorteio_${torneio.id}`, JSON.stringify(mapa));
    setDesempateSorteio(mapa);
  };

  const iniciarProrrogacao = (p: PartidaTorneioLocal) => {
    if (!torneio) return;
    const pid = buscar_pelada_id() || 'default';
    const hist = historicosMap[p.id];
    const atualizadas = partidas.map((x) =>
      x.id !== p.id ? x : { ...x, status: 'agendada' as const, updated_at: new Date().toISOString() }
    );
    salvarPartidasTorneioLocal(torneio.id, atualizadas);
    setPartidas(atualizadas);
    salvarPartidaAtivaTorneio({
      partidaId: p.id,
      torneioId: torneio.id,
      peladaId: pid,
      equipeAId: p.equipe_a_id,
      equipeBId: p.equipe_b_id,
      golsA: p.gols_a,
      golsB: p.gols_b,
      eventos: hist?.eventos ?? [],
      iniciadaEm: new Date().toISOString(),
      segundos: 0,
      timerRodando: false,
      isProrrogacao: true,
    });
    window.dispatchEvent(new CustomEvent('partida-torneio-changed'));
    router.push(`/modo-torneio/partida?id=${p.id}`);
  };

  const iniciarPenaltis = (p: PartidaTorneioLocal) => {
    router.push(`/modo-torneio/penaltis?id=${p.id}`);
  };

  const classificamLiga = regras?.classificam_liga ?? Math.min(4, Math.floor(equipes.length / 2));
  const classificadosPreview = classificacao.slice(0, classificamLiga);
  const confrontosPreview = useMemo(() => {
    const total = classificadosPreview.length;
    const pares: { a: typeof classificadosPreview[0]; b: typeof classificadosPreview[0] }[] = [];
    for (let i = 0; i < Math.floor(total / 2); i++) {
      pares.push({ a: classificadosPreview[i], b: classificadosPreview[total - 1 - i] });
    }
    return pares;
  }, [classificadosPreview]);

  const partidasMM = partidas.filter((p) => !['Liga', 'Turno', 'Returno', 'Grupos'].includes(p.fase));
  const colunasTabela = buildColunas(criterios);

  // Campeão = vencedor da partida 'Final' já finalizada
  const campeao = useMemo(() => {
    const final = partidasMM.find((p) => p.fase === 'Final' && p.status === 'finalizada' && p.vencedor_id);
    if (!final) return null;
    return equipes.find((e) => e.id === final.vencedor_id) ?? null;
  }, [partidasMM, equipes]);

  // Vice-campeão = perdedor da Final
  const viceCampeao = useMemo(() => {
    const final = partidasMM.find((p) => p.fase === 'Final' && p.status === 'finalizada' && p.vencedor_id);
    if (!final || !campeao) return null;
    const viceId = final.equipe_a_id === campeao.id ? final.equipe_b_id : final.equipe_a_id;
    return equipes.find((e) => e.id === viceId) ?? null;
  }, [partidasMM, equipes, campeao]);

  // Artilheiro e melhor assistente
  const artilheiro = useMemo(() => [...stats].filter((s) => s.gols > 0).sort((a, b) => b.gols - a.gols)[0] ?? null, [stats]);
  const melhorAssistente = useMemo(() => [...stats].filter((s) => s.assistencias > 0).sort((a, b) => b.assistencias - a.assistencias)[0] ?? null, [stats]);

  // Stats dos jogadores do time campeão (mesclado com lista de jogadores)
  const statsCampeao = useMemo(() => {
    if (!campeao) return [];
    const jogadores = jogadoresPorEquipe[campeao.id] ?? [];
    return jogadores.map((j) => {
      const s = stats.find((x) => x.jogadorId === j.id);
      return { id: j.id, nome: j.nome, gols: s?.gols ?? 0, assistencias: s?.assistencias ?? 0 };
    }).sort((a, b) => (b.gols + b.assistencias) - (a.gols + a.assistencias));
  }, [campeao, jogadoresPorEquipe, stats]);

  // Stats dos jogadores do vice-campeão
  const statsVice = useMemo(() => {
    if (!viceCampeao) return [];
    const jogadores = jogadoresPorEquipe[viceCampeao.id] ?? [];
    return jogadores.map((j) => {
      const s = stats.find((x) => x.jogadorId === j.id);
      return { id: j.id, nome: j.nome, gols: s?.gols ?? 0, assistencias: s?.assistencias ?? 0 };
    }).sort((a, b) => (b.gols + b.assistencias) - (a.gols + a.assistencias));
  }, [viceCampeao, jogadoresPorEquipe, stats]);

  // Auto-mostrar modal do campeão uma vez por sessão
  useEffect(() => {
    if (campeao && !campeaoMostradoRef.current) {
      campeaoMostradoRef.current = true;
      setModalCampeao(true);
    }
  }, [campeao]);

  // Liga completa = todas as partidas de fase de liga finalizadas
  const ligaCompleta = useMemo(() => {
    const ligaPartidas = partidas.filter((p) => ['Liga', 'Turno', 'Returno', 'Grupos'].includes(p.fase));
    return ligaPartidas.length > 0 && ligaPartidas.every((p) => p.status === 'finalizada');
  }, [partidas]);

  // Probabilidades — análise por time do que falta para classificar/ser eliminado
  const probabilidades = useMemo(() => {
    if (classificacao.length < 2 || classificamLiga <= 0 || classificamLiga >= classificacao.length) return null;
    const fasesLiga = ['Liga', 'Turno', 'Returno', 'Grupos'];
    const jogosFinalizados = partidas.filter((p) => p.status === 'finalizada' && fasesLiga.includes(p.fase));
    if (jogosFinalizados.length === 0) return [];  // zona existe mas sem jogos ainda → array vazio (exibe placeholder)
    const pontosVitoria = regras?.pontos_vitoria ?? 3;
    const restante = (id: string) =>
      partidas.filter((p) => p.status !== 'finalizada' && fasesLiga.includes(p.fase) && (p.equipe_a_id === id || p.equipe_b_id === id)).length;
    const maxPtsTime = (e: { id: string; pts: number }) => e.pts + restante(e.id) * pontosVitoria;
    const cutTeam = classificacao[classificamLiga];
    const lastInZone = classificacao[classificamLiga - 1];
    return classificacao.map((e, i) => {
      const naZona = i < classificamLiga;
      const jogosRest = restante(e.id);
      let icone: string;
      let mensagem: string;
      let cor: 'verde' | 'vermelho' | 'amarelo' | 'roxo';
      if (naZona) {
        const ameaca = !cutTeam || e.pts > maxPtsTime(cutTeam);
        if (ameaca) {
          if (i === 0 && classificacao.length > 1 && e.pts > maxPtsTime(classificacao[1])) {
            icone = '👑'; cor = 'roxo'; mensagem = '1º lugar garantido';
          } else {
            icone = '✅'; cor = 'verde'; mensagem = 'Classificado matematicamente';
          }
        } else if (jogosRest === 0) {
          icone = '✅'; cor = 'verde'; mensagem = 'Classificado (fase encerrada)';
        } else {
          const ptsFaltam = maxPtsTime(cutTeam) - e.pts + 1;
          const vitsNecessarias = Math.ceil(ptsFaltam / pontosVitoria);
          icone = '🟡'; cor = 'amarelo';
          if (ptsFaltam <= 1) mensagem = `1 ponto garante a vaga`;
          else if (vitsNecessarias >= jogosRest) mensagem = `Precisa vencer os ${jogosRest} jogo${jogosRest === 1 ? '' : 's'}`;
          else mensagem = `Precisa de ≥${ptsFaltam} pts em ${jogosRest} jogo${jogosRest === 1 ? '' : 's'}`;
        }
      } else {
        const maxE = maxPtsTime(e);
        if (maxE < lastInZone.pts) {
          icone = '❌'; cor = 'vermelho'; mensagem = 'Eliminado matematicamente';
        } else if (jogosRest === 0) {
          icone = '❌'; cor = 'vermelho'; mensagem = 'Eliminado (fase encerrada)';
        } else {
          const ptsFaltam = lastInZone.pts - e.pts + 1;
          icone = '🔶'; cor = 'amarelo';
          if (maxE === lastInZone.pts) mensagem = `Vencer tudo e torcer`;
          else if (ptsFaltam <= pontosVitoria) mensagem = `Vencer o próximo e torcer`;
          else mensagem = `Precisa de ${ptsFaltam} pts e torcer`;
        }
      }
      return { id: e.id, nome: e.nome, cor: e.cor, posicao: i + 1, icone, mensagem, corStatus: cor, naZona };
    });
  }, [classificacao, classificamLiga, partidas, regras]);

  // Empate técnico real = dois times adjacentes que são inseparáveis por TODOS os critérios + confronto direto + sorteio
  const temEmpateReal = useMemo(() => {
    if (classificacao.length < 2) return false;
    type ClassItem = typeof classificacao[0];
    const iguais = (a: ClassItem, b: ClassItem): boolean => {
      for (const c of criterios) {
        const col = CRITERIO_COL[c];
        if (!col) continue;
        const av = (a as unknown as Record<string, number>)[col.key] ?? 0;
        const bv = (b as unknown as Record<string, number>)[col.key] ?? 0;
        if (av !== bv) return false;
      }
      // confronto direto
      const diretas = partidas.filter(
        (p) => p.status === 'finalizada' &&
          ((p.equipe_a_id === a.id && p.equipe_b_id === b.id) ||
           (p.equipe_a_id === b.id && p.equipe_b_id === a.id))
      );
      if (diretas.length > 0) {
        let ptsA = 0, ptsB = 0, sgA = 0;
        diretas.forEach((p) => {
          const aEhA = p.equipe_a_id === a.id;
          const ga = aEhA ? p.gols_a : p.gols_b;
          const gb = aEhA ? p.gols_b : p.gols_a;
          if (ga > gb) ptsA += (regras?.pontos_vitoria ?? 3);
          else if (ga === gb) { ptsA += (regras?.pontos_empate ?? 1); ptsB += (regras?.pontos_empate ?? 1); }
          else ptsB += (regras?.pontos_vitoria ?? 3);
          sgA += ga - gb;
        });
        if (ptsA !== ptsB) return false;
        if (sgA !== 0) return false;
      }
      // sorteio já aplicado separa?
      const da = desempateSorteio[a.id] ?? Infinity;
      const db = desempateSorteio[b.id] ?? Infinity;
      if (da !== Infinity && db !== Infinity && da !== db) return false;
      return true;
    };
    return classificacao.some((e, i) => i > 0 && iguais(classificacao[i - 1], e));
  }, [classificacao, criterios, partidas, regras, desempateSorteio]);

  // ── Helpers mata-mata ──────────────────────────────────────────────────────
  const nomePrimeiraFaseMM = (n: number) => {
    if (n <= 2) return 'Final';
    if (n <= 4) return 'Semifinal';
    if (n <= 8) return 'Quartas de Final';
    return 'Fase Eliminatória';
  };
  const proximaFaseMM = (atual: string) => {
    if (atual === 'Quartas de Final') return 'Semifinal';
    if (atual === 'Semifinal') return 'Final';
    return null;
  };
  const criarPartidaMM = (aId: string, bId: string, fase: string): PartidaTorneioLocal => {
    const now = new Date().toISOString();
    return { id: gerarId(), torneio_id: torneio!.id, pelada_id: peladaId, fase, rodada: 1, equipe_a_id: aId, equipe_b_id: bId, gols_a: 0, gols_b: 0, status: 'agendada', data_partida: null, vencedor_id: null, created_at: now, updated_at: now, deleted_at: null, sync_status: 'local_only', version: 1 };
  };

  // Efeito 1 — gerar primeira fase do mata-mata ao finalizar a liga
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!torneio || !ligaCompleta || partidasMM.length > 0) return;
    const classificados = classificacao.slice(0, classificamLiga);
    if (classificados.length < 2) return;
    const n = classificados.length;
    const fase = nomePrimeiraFaseMM(n);
    const novos: PartidaTorneioLocal[] = [];
    for (let i = 0; i < Math.floor(n / 2); i++) {
      novos.push(criarPartidaMM(classificados[i].id, classificados[n - 1 - i].id, fase));
    }
    if (novos.length === 0) return;
    const todas = [...partidas, ...novos];
    salvarPartidasTorneioLocal(torneio.id, todas);
    setPartidas(todas);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ligaCompleta, torneio?.id, partidasMM.length]);

  // Efeito 2 — ao concluir uma fase do MM, gerar a próxima (Final + 3º lugar)
  const mmStatusKey = partidasMM.map((p) => `${p.id}:${p.status}:${p.vencedor_id ?? ''}`).join('|');
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!torneio || partidasMM.length === 0) return;
    const fases = Array.from(new Set(partidasMM.map((p) => p.fase)));
    for (const fase of fases) {
      const jogos = partidasMM.filter((p) => p.fase === fase);
      if (!jogos.every((p) => p.status === 'finalizada')) continue;
      const proxFase = proximaFaseMM(fase);
      if (!proxFase) continue;
      if (partidasMM.some((p) => p.fase === proxFase)) continue;
      // Gerar jogos da próxima fase
      const novos: PartidaTorneioLocal[] = [];
      const vencedores = jogos.map((j) => j.vencedor_id).filter(Boolean) as string[];
      const perdedores = jogos.map((j) => j.equipe_a_id === j.vencedor_id ? j.equipe_b_id : j.equipe_a_id);
      // Final: vencedores cruzados
      for (let i = 0; i < Math.floor(vencedores.length / 2) * 2; i += 2) {
        novos.push(criarPartidaMM(vencedores[i], vencedores[i + 1] ?? vencedores[i], proxFase));
      }
      if (vencedores.length % 2 !== 0 && vencedores.length > 0) {
        novos.push(criarPartidaMM(vencedores[vencedores.length - 1], vencedores[0], proxFase));
      }
      // 3º lugar (se habilitado)
      if ((regras?.disputa_terceiro_lugar ?? 'jogo_unico') !== 'nao' && perdedores.length >= 2) {
        for (let i = 0; i < Math.floor(perdedores.length / 2) * 2; i += 2) {
          novos.push(criarPartidaMM(perdedores[i], perdedores[i + 1], '3º Lugar'));
        }
      }
      if (novos.length > 0) {
        const todas = [...partidas, ...novos];
        salvarPartidasTorneioLocal(torneio.id, todas);
        setPartidas(todas);
      }
      break; // processa uma fase por vez
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mmStatusKey, torneio?.id]);

  // Prévia da próxima fase (Final/3º Lugar) enquanto a fase atual está em andamento
  const previewProximaFase = useMemo(() => {
    if (partidasMM.length === 0) return null;
    const fases = Array.from(new Set(partidasMM.map((p) => p.fase)));
    for (const fase of fases) {
      const jogos = partidasMM.filter((p) => p.fase === fase);
      if (jogos.every((p) => p.status === 'finalizada')) continue; // fase já concluída
      const proxFase = proximaFaseMM(fase);
      if (!proxFase) return null;
      if (partidasMM.some((p) => p.fase === proxFase)) return null; // já gerado
      // Montar rascunho da final / 3º
      const vencedores = jogos.map((j) =>
        j.status === 'finalizada' ? (j.vencedor_id ? equipes.find((e) => e.id === j.vencedor_id) ?? null : null) : null
      );
      const perdedores = jogos.map((j) =>
        j.status === 'finalizada' ? equipes.find((e) => e.id === (j.equipe_a_id === j.vencedor_id ? j.equipe_b_id : j.equipe_a_id)) ?? null : null
      );
      const pairsFinais: { a: EquipeTorneioLocal | null; b: EquipeTorneioLocal | null; labelA: string; labelB: string }[] = [];
      for (let i = 0; i < Math.floor(jogos.length / 2) * 2; i += 2) {
        const jA = jogos[i]; const jB = jogos[i + 1];
        pairsFinais.push({
          a: vencedores[i],
          b: vencedores[i + 1] ?? null,
          labelA: vencedores[i] ? vencedores[i]!.nome : `Vencedor de ${equipes.find(e=>e.id===jA.equipe_a_id)?.nome ?? '?'} × ${equipes.find(e=>e.id===jA.equipe_b_id)?.nome ?? '?'}`,
          labelB: vencedores[i + 1] ? vencedores[i + 1]!.nome : `Vencedor de ${equipes.find(e=>e.id===jB?.equipe_a_id)?.nome ?? '?'} × ${equipes.find(e=>e.id===jB?.equipe_b_id)?.nome ?? '?'}`,
        });
      }
      const pairsTerceiro: typeof pairsFinais = [];
      if ((regras?.disputa_terceiro_lugar ?? 'jogo_unico') !== 'nao' && perdedores.length >= 2) {
        for (let i = 0; i < Math.floor(jogos.length / 2) * 2; i += 2) {
          const jA = jogos[i]; const jB = jogos[i + 1];
          pairsTerceiro.push({
            a: perdedores[i],
            b: perdedores[i + 1] ?? null,
            labelA: perdedores[i] ? perdedores[i]!.nome : `Perdedor de ${equipes.find(e=>e.id===jA.equipe_a_id)?.nome ?? '?'} × ${equipes.find(e=>e.id===jA.equipe_b_id)?.nome ?? '?'}`,
            labelB: perdedores[i + 1] ? perdedores[i + 1]!.nome : `Perdedor de ${equipes.find(e=>e.id===jB?.equipe_a_id)?.nome ?? '?'} × ${equipes.find(e=>e.id===jB?.equipe_b_id)?.nome ?? '?'}`,
          });
        }
      }
      return { proxFase, pairsFinais, pairsTerceiro };
    }
    return null;
  }, [partidasMM, equipes, regras]);

  const todosJogosFinalizados = partidas.length > 0 && partidas.every(
    (p) => p.status === 'finalizada' || p.status === 'cancelada'
  );

  const salvarRegras = () => {
    if (!torneio || !regras) return;
    const atualizadas = {
      ...regras,
      tempo_partida: regrasTempo,
      empate_decisao: regrasEmpate,
      tempos_partida: regrasTemposPartida,
      tempo_prorrogacao: regrasEmpate === 'prorrogacao' ? regrasTempoProrrogacao : regras.tempo_prorrogacao,
    };
    salvarRegrasCompeticaoLocal(atualizadas);
    setRegras(atualizadas);
    setModalEditarRegras(false);
  };

  const executarSalvar = () => {
    if (!torneio) return;
    setSalvando(true);
    const snap = salvarSnapshotTorneio(torneio.id);
    setUltimoSalvo(snap.savedAt);
    setSalvando(false);
    setModalSalvar(false);
  };

  const executarEncerrar = async () => {
    if (!torneio) return;
    setErroSenhaEncerrar('');
    if (!senhaEncerrar.trim()) {
      setErroSenhaEncerrar('Digite sua senha para confirmar.');
      return;
    }
    setEncerrando(true);
    try {
      const valida = await validarSenhaPelada(senhaEncerrar);
      if (!valida) {
        setErroSenhaEncerrar('Senha incorreta.');
        setEncerrando(false);
        return;
      }
      encerrarTorneioLocal(torneio.id);
      setModalEncerrar(false);
      setSenhaEncerrar('');
      router.push('/modo-torneio');
    } catch {
      setErroSenhaEncerrar('Erro ao validar senha.');
    } finally {
      setEncerrando(false);
    }
  };

  const executarFechar = (salvarAntes: boolean) => {
    if (salvarAntes && torneio) salvarSnapshotTorneio(torneio.id);
    setModalFechar(false);
    router.push('/');
  };

  if (isLoading) {
    return (
      <Layout title="Painel do Torneio">
        <div className="flex items-center justify-center h-40">
          <p className="text-gray-400 text-sm">Carregando torneio...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Painel do Torneio">
      {/* Header */}
      <section className="mb-4">
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-4 sm:p-5">
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">🏆 {torneio?.nome || 'Torneio'}</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {equipes.length} times · {partidas.length} jogos{regras && <> · {regras.formato.replace(/_/g, ' ')}</>}
            {!isReadonly && temPartidaAtiva && <span className="ml-2 text-amber-400 font-bold animate-pulse">⚽ Partida em andamento</span>}
            {isReadonly && <span className="ml-2 text-amber-400 font-semibold">🔒 Apenas leitura</span>}
          </p>
        </div>
      </section>

      {/* ── PAINEL ─────────────────────────────────────────────────────────── */}
      {abaAtiva === 'painel' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {isReadonly ? (
            /* ── Modo consulta ── */
            <>
              <div style={{ background: '#1e293b', border: '1.5px solid rgba(234,179,8,0.3)', borderRadius: 18, padding: '18px 20px', textAlign: 'center' }}>
                <span style={{ fontSize: 32 }}>🔒</span>
                <p style={{ margin: '8px 0 4px', fontWeight: 800, fontSize: 15, color: '#f1f5f9' }}>Torneio Encerrado</p>
                <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>Modo somente leitura — consulte todas as abas</p>
                {torneio?.data_fim && (
                  <p style={{ margin: '6px 0 0', fontSize: 11, color: '#64748b' }}>
                    Encerrado em {new Date(torneio.data_fim).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </p>
                )}
              </div>
              {campeao && (
                <button
                  onClick={() => setModalDestaques(true)}
                  style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)', border: '1.5px solid rgba(234,179,8,0.5)', borderRadius: 18, padding: '16px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}
                >
                  <span style={{ fontSize: 30, filter: 'drop-shadow(0 0 10px rgba(234,179,8,0.9))' }}>🏆</span>
                  <div style={{ textAlign: 'left', flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#eab308', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Card do torneio</p>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 900, color: '#fff' }}>Destaques do Torneio</p>
                    <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>Campeão · Artilheiro · Assistências</p>
                  </div>
                  <span style={{ fontSize: 20 }}>✨</span>
                </button>
              )}
              {(() => {
                const tid = searchParams?.get('torneioId') ?? '';
                const base = `/modo-torneio/painel?readonly=1&torneioId=${tid}`;
                const abas = [
                  { id: 'jogos', emoji: '📅', label: 'Jogos' },
                  { id: 'classificacao', emoji: '📊', label: 'Tabela' },
                  { id: 'chaveamento', emoji: '🏆', label: 'Chaveamento' },
                  { id: 'estatisticas', emoji: '🌟', label: 'Stats' },
                ];
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {abas.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => router.push(`${base}&aba=${a.id}`)}
                        style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: '12px 10px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
                      >
                        <span style={{ fontSize: 22 }}>{a.emoji}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>{a.label}</span>
                      </button>
                    ))}
                  </div>
                );
              })()}
              <button
                onClick={() => router.push('/modo-torneio')}
                style={{ background: 'transparent', border: '1px solid #334155', borderRadius: 14, padding: '12px 0', color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                ← Voltar à home dos torneios
              </button>
            </>
          ) : (
            /* ── Modo edição ── */
            <>
          {/* Grade 2x2 de cards de ação */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {/* Editar Times */}
            <button onClick={() => router.push('/modo-torneio/painel?aba=times')} style={{ background: 'white', border: '1.5px solid #e5e7eb', borderRadius: 18, padding: '18px 14px', cursor: 'pointer', textAlign: 'left' }}>
              <img src="/campo-de-futebol.png" alt="Campo de futebol" style={{ width: 28, height: 28, objectFit: 'contain' }} />
              <p style={{ margin: '8px 0 2px', fontWeight: 800, fontSize: 14, color: '#111827' }}>Times</p>
              <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{equipes.length} times · renomear, trocar jogadores</p>
            </button>

            {/* Editar Regras */}
            <button onClick={() => setModalEditarRegras(true)} style={{ background: 'white', border: '1.5px solid #e5e7eb', borderRadius: 18, padding: '18px 14px', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: 28 }}>⚙️</span>
              <p style={{ margin: '8px 0 2px', fontWeight: 800, fontSize: 14, color: '#111827' }}>Regras</p>
              <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{regrasTempo}min · {regrasEmpate === 'penaltis' ? 'pênaltis' : 'prorrogação'}</p>
            </button>

            {/* Salvar / Sync */}
            <button onClick={() => setModalSalvar(true)} style={{ background: 'white', border: '1.5px solid #3b82f6', borderRadius: 18, padding: '18px 14px', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: 28 }}>💾</span>
              <p style={{ margin: '8px 0 2px', fontWeight: 800, fontSize: 14, color: '#3b82f6' }}>Salvar / Sync</p>
              <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>
                {ultimoSalvo
                  ? `Salvo ${new Date(ultimoSalvo).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                  : 'Nunca salvo'}
              </p>
            </button>

            {/* Encerrar Torneio */}
            <button
              onClick={() => todosJogosFinalizados && setModalEncerrar(true)}
              disabled={!todosJogosFinalizados}
              style={{
                background: todosJogosFinalizados ? 'white' : '#f9fafb',
                border: `1.5px solid ${todosJogosFinalizados ? '#ef4444' : '#e5e7eb'}`,
                borderRadius: 18,
                padding: '18px 14px',
                cursor: todosJogosFinalizados ? 'pointer' : 'not-allowed',
                textAlign: 'left',
                opacity: todosJogosFinalizados ? 1 : 0.5,
              }}
            >
              <span style={{ fontSize: 28 }}>🏆</span>
              <p style={{ margin: '8px 0 2px', fontWeight: 800, fontSize: 14, color: todosJogosFinalizados ? '#ef4444' : '#9ca3af' }}>Encerrar</p>
              <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{todosJogosFinalizados ? 'Todos os jogos finalizados' : 'Aguardando jogos'}</p>
            </button>
          </div>

          {/* Destaques do Torneio — só visível quando há campeão */}
          {campeao && (
            <button
              onClick={() => setModalDestaques(true)}
              style={{
                background: 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)',
                border: '1.5px solid rgba(234,179,8,0.5)',
                borderRadius: 18,
                padding: '16px 18px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
              }}
            >
              <span style={{ fontSize: 30, filter: 'drop-shadow(0 0 10px rgba(234,179,8,0.9))' }}>🏆</span>
              <div style={{ textAlign: 'left', flex: 1 }}>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#eab308', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Card do torneio</p>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 900, color: '#fff' }}>Destaques do Torneio</p>
                <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>Campeão · Artilheiro · Assistências</p>
              </div>
              <span style={{ fontSize: 20 }}>✨</span>
            </button>
          )}

          {/* Fechar Torneio */}
          <button
            onClick={() => setModalFechar(true)}
            style={{ background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 14, padding: '12px 0', color: '#9ca3af', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            ← Fechar torneio e voltar ao início
          </button>
            </>
          )}
        </div>
      )}

      {/* ── TIMES ─────────────────────────────────────────────────────────── */}
      {abaAtiva === 'times' && (
        <div className="space-y-3">
          {equipes.map((equipe, i) => {
            const jogadores = jogadoresPorEquipe[equipe.id] ?? [];
            return (
              <div key={equipe.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
                {editandoTimeId === equipe.id ? (
                  <div className="flex gap-2">
                    <input autoFocus type="text" value={nomeEditando} onChange={(e) => setNomeEditando(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && salvarNomeTime(equipe.id)} className="flex-1 px-3 py-1.5 rounded-lg border border-sky-400 outline-none text-sm font-semibold" />
                    <button onClick={() => salvarNomeTime(equipe.id)} className="px-3 py-1.5 rounded-lg bg-sky-500 text-white text-sm font-semibold">Salvar</button>
                    <button onClick={() => setEditandoTimeId(null)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-sm">✕</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{equipe.cor ?? CORES_EMOJIS[i] ?? '⭐'}</span>
                      <div>
                        <p className="font-bold text-gray-800">{equipe.nome}</p>
                        <p className="text-xs text-gray-400">
                          {classificacao.find((c) => c.id === equipe.id)?.j ?? 0} jogos · {classificacao.find((c) => c.id === equipe.id)?.pts ?? 0} pts{jogadores.length > 0 && <> · {jogadores.length} jogadores</>}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setModalTimeId(equipe.id); setJogadorParaTrocar(null); setModoSubstituicao(false); }} className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:border-emerald-300 hover:text-emerald-600 transition-colors" title="Ver jogadores">👥</button>
                      {!isReadonly && (
                        <>
                          <button onClick={() => { setModalTimeId(equipe.id); setJogadorParaTrocar(null); setModoSubstituicao(true); }} className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:border-amber-300 hover:text-amber-600 transition-colors" title="Substituir jogadores">🔁</button>
                          <button onClick={() => { setEditandoTimeId(equipe.id); setNomeEditando(equipe.nome); }} className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:border-sky-300 hover:text-sky-600 transition-colors" title="Renomear time">✏️</button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {equipes.length === 0 && <div className="text-center py-10 text-gray-400"><p>Nenhum time cadastrado</p></div>}
        </div>
      )}

      {/* ── MODAL DETALHES DA PARTIDA ───────────────────────────────────── */}
      {modalDetalhesPartidaId && (() => {
        const p = partidas.find((x) => x.id === modalDetalhesPartidaId);
        if (!p) return null;
        const eqA = equipes.find((e) => e.id === p.equipe_a_id);
        const eqB = equipes.find((e) => e.id === p.equipe_b_id);
        const cA = corDoTime(eqA?.cor);
        const cB = corDoTime(eqB?.cor);
        const hist = historicosMap[p.id];
        const eventos = hist?.eventos ?? [];
        const gols = eventos.filter((e) => e.tipo === 'gol');
        const assists = eventos.filter((e) => e.tipo === 'assistencia');
        const decididaPorPen = p.status === 'finalizada' && p.gols_a === p.gols_b && !!p.vencedor_id;
        const temKicks = !!(p.penaltis_kicks && p.penaltis_kicks.length > 0);

        // Contagens por jogador
        const golsPorJogador: Record<string, number> = {};
        const assistsPorJogador: Record<string, number> = {};
        const cartoesPorJogador: Record<string, { amarelo: number; vermelho: number; azul: number }> = {};
        gols.forEach((e) => { golsPorJogador[e.jogadorId] = (golsPorJogador[e.jogadorId] ?? 0) + 1; });
        assists.forEach((e) => { assistsPorJogador[e.jogadorId] = (assistsPorJogador[e.jogadorId] ?? 0) + 1; });
        eventos.filter((e): e is EventoPartidaTorneio => e.tipo === 'cartao').forEach((e) => {
          const tipo = (e.cartaoTipo ?? 'amarelo') as 'amarelo' | 'vermelho' | 'azul';
          if (!cartoesPorJogador[e.jogadorId]) cartoesPorJogador[e.jogadorId] = { amarelo: 0, vermelho: 0, azul: 0 };
          cartoesPorJogador[e.jogadorId][tipo] = (cartoesPorJogador[e.jogadorId][tipo] ?? 0) + 1;
        });

        // Lista de jogadores de cada time (fonte: jogadoresPorEquipe ou eventos)
        const jogA = jogadoresPorEquipe[p.equipe_a_id] ?? [];
        const jogB = jogadoresPorEquipe[p.equipe_b_id] ?? [];

        // Se não há jogadores cadastrados, monta lista a partir dos eventos
        const nomesA: { id: string; nome: string }[] = jogA.length > 0
          ? jogA.map((j) => ({ id: j.id, nome: j.nome }))
          : [...new Map(eventos.filter((e) => e.equipeId === p.equipe_a_id).map((e) => [e.jogadorId, { id: e.jogadorId, nome: e.jogadorNome }])).values()];
        const nomesB: { id: string; nome: string }[] = jogB.length > 0
          ? jogB.map((j) => ({ id: j.id, nome: j.nome }))
          : [...new Map(eventos.filter((e) => e.equipeId === p.equipe_b_id).map((e) => [e.jogadorId, { id: e.jogadorId, nome: e.jogadorNome }])).values()];

        const temHistorico = eventos.length > 0;

        return (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 9999 }} onClick={() => setModalDetalhesPartidaId(null)}>
            <div style={{ backgroundColor: 'white', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>

              {/* Header com placar */}
              <div style={{ padding: '20px 20px 0' }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-gray-800">Detalhes da partida</h3>
                  <button onClick={() => setModalDetalhesPartidaId(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 font-bold">✕</button>
                </div>

                {/* Placar centralizado */}
                <div className="flex items-center gap-2 mb-4">
                  <div style={{ flex: 1, backgroundColor: hexToRgba(cA, 0.1), border: `2px solid ${hexToRgba(cA, 0.35)}`, borderRadius: 12, padding: '8px 10px', textAlign: 'center' }}>
                    <p style={{ margin: 0, color: cA, fontWeight: 800, fontSize: 13, lineHeight: 1.3 }}>{eqA?.cor ?? ''} {eqA?.nome ?? '?'}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb', flexShrink: 0 }}>
                    <span style={{ fontSize: 22, fontWeight: 900, color: p.gols_a > p.gols_b ? '#16a34a' : p.gols_a < p.gols_b ? '#f87171' : '#374151' }}>{p.gols_a}</span>
                    <span style={{ color: '#d1d5db', fontWeight: 700 }}>×</span>
                    <span style={{ fontSize: 22, fontWeight: 900, color: p.gols_b > p.gols_a ? '#16a34a' : p.gols_b < p.gols_a ? '#f87171' : '#374151' }}>{p.gols_b}</span>
                  </div>
                  <div style={{ flex: 1, backgroundColor: hexToRgba(cB, 0.1), border: `2px solid ${hexToRgba(cB, 0.35)}`, borderRadius: 12, padding: '8px 10px', textAlign: 'center' }}>
                    <p style={{ margin: 0, color: cB, fontWeight: 800, fontSize: 13, lineHeight: 1.3 }}>{eqB?.cor ?? ''} {eqB?.nome ?? '?'}</p>
                  </div>
                </div>
              </div>

              <div style={{ padding: '0 20px 24px' }}>
                {/* ── Times lado a lado ── */}
                {(nomesA.length > 0 || nomesB.length > 0) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                    {/* Time A */}
                    <div style={{ background: '#f9fafb', borderRadius: 14, overflow: 'hidden', border: `1.5px solid ${hexToRgba(cA, 0.25)}` }}>
                      <div style={{ background: cA, padding: '7px 10px', textAlign: 'center' }}>
                        <p style={{ margin: 0, color: '#fff', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{eqA?.nome ?? 'Time A'}</p>
                      </div>
                      {nomesA.map((j) => {
                        const g = golsPorJogador[j.id] ?? 0;
                        const a = assistsPorJogador[j.id] ?? 0;
                        const cartoes = cartoesPorJogador[j.id] ?? { amarelo: 0, vermelho: 0, azul: 0 };
                        return (
                          <div key={j.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#1f2937', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.nome}</span>
                            {(g > 0 || a > 0 || cartoes.amarelo > 0 || cartoes.vermelho > 0 || cartoes.azul > 0) && (
                              <span style={{ fontSize: 11, flexShrink: 0, marginLeft: 4 }}>
                                {g > 0 && <span>{'⚽'.repeat(Math.min(g, 3))}{g > 3 ? `×${g}` : ''}</span>}
                                {a > 0 && <span>{'👟'.repeat(Math.min(a, 3))}{a > 3 ? `×${a}` : ''}</span>}
                                {cartoes.amarelo > 0 && <span>{'🟨'.repeat(Math.min(cartoes.amarelo, 3))}{cartoes.amarelo > 3 ? `×${cartoes.amarelo}` : ''}</span>}
                                {cartoes.vermelho > 0 && <span>{'🟥'.repeat(Math.min(cartoes.vermelho, 3))}{cartoes.vermelho > 3 ? `×${cartoes.vermelho}` : ''}</span>}
                                {cartoes.azul > 0 && <span>{'🟦'.repeat(Math.min(cartoes.azul, 3))}{cartoes.azul > 3 ? `×${cartoes.azul}` : ''}</span>}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Time B */}
                    <div style={{ background: '#f9fafb', borderRadius: 14, overflow: 'hidden', border: `1.5px solid ${hexToRgba(cB, 0.25)}` }}>
                      <div style={{ background: cB, padding: '7px 10px', textAlign: 'center' }}>
                        <p style={{ margin: 0, color: '#fff', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{eqB?.nome ?? 'Time B'}</p>
                      </div>
                      {nomesB.map((j) => {
                        const g = golsPorJogador[j.id] ?? 0;
                        const a = assistsPorJogador[j.id] ?? 0;
                        const cartoes = cartoesPorJogador[j.id] ?? { amarelo: 0, vermelho: 0, azul: 0 };
                        return (
                          <div key={j.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#1f2937', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.nome}</span>
                            {(g > 0 || a > 0 || cartoes.amarelo > 0 || cartoes.vermelho > 0 || cartoes.azul > 0) && (
                              <span style={{ fontSize: 11, flexShrink: 0, marginLeft: 4 }}>
                                {g > 0 && <span>{'⚽'.repeat(Math.min(g, 3))}{g > 3 ? `×${g}` : ''}</span>}
                                {a > 0 && <span>{'👟'.repeat(Math.min(a, 3))}{a > 3 ? `×${a}` : ''}</span>}
                                {cartoes.amarelo > 0 && <span>{'🟨'.repeat(Math.min(cartoes.amarelo, 3))}{cartoes.amarelo > 3 ? `×${cartoes.amarelo}` : ''}</span>}
                                {cartoes.vermelho > 0 && <span>{'🟥'.repeat(Math.min(cartoes.vermelho, 3))}{cartoes.vermelho > 3 ? `×${cartoes.vermelho}` : ''}</span>}
                                {cartoes.azul > 0 && <span>{'🟦'.repeat(Math.min(cartoes.azul, 3))}{cartoes.azul > 3 ? `×${cartoes.azul}` : ''}</span>}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Linha do tempo de eventos ── */}
                {temHistorico && (() => {
                  const CARTAO_EMOJI_MAP: Record<string, string> = { amarelo: '🟨', vermelho: '🟥', azul: '🟦' };
                  const CARTAO_LABEL: Record<string, string> = { amarelo: 'amarelo', vermelho: 'vermelho', azul: 'azul' };
                  const assistPorGolId = new Map(eventos.filter((e) => e.tipo === 'assistencia' && e.golId).map((e) => [e.golId!, e]));
                  const assistSemGol = eventos.filter((e: EventoPartidaTorneio) => e.tipo === 'assistencia' && !e.golId);
                  const cartoes = eventos.filter((e: EventoPartidaTorneio) => e.tipo === 'cartao');
                  const itens: Array<{ tipo: 'gol' | 'assistencia' | 'cartao'; evento: EventoPartidaTorneio; assist?: EventoPartidaTorneio | null }> = [
                    ...eventos.filter((e: EventoPartidaTorneio) => e.tipo === 'gol').map((g: EventoPartidaTorneio) => ({ tipo: 'gol' as const, evento: g, assist: assistPorGolId.get(g.id) ?? null })),
                    ...assistSemGol.map((a: EventoPartidaTorneio) => ({ tipo: 'assistencia' as const, evento: a })),
                    ...cartoes.map((c: EventoPartidaTorneio) => ({ tipo: 'cartao' as const, evento: c })),
                  ];
                  return (
                    <div style={{ marginBottom: 16 }}>
                      <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Eventos</p>
                      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #f3f4f6', overflow: 'hidden' }}>
                        {itens.map(({ tipo, evento, assist }, i) => {
                          const isA = evento.equipeId === p.equipe_a_id;
                          const cor = isA ? cA : cB;
                          const emoji = tipo === 'gol' ? '⚽' : tipo === 'assistencia' ? '👟' : CARTAO_EMOJI_MAP[(evento as any).cartaoTipo ?? 'amarelo'];
                          return (
                            <div key={evento.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderTop: i > 0 ? '1px solid #f9fafb' : 'none' }}>
                              <span style={{ fontSize: 15 }}>{emoji}</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#1f2937' }}>{evento.jogadorNome}</span>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                                  {tipo === 'gol' && <span style={{ fontSize: 12, color: '#9ca3af' }}>Gol</span>}
                                  {tipo === 'assistencia' && <span style={{ fontSize: 12, color: '#9ca3af' }}>Assistência</span>}
                                  {tipo === 'cartao' && <span style={{ fontSize: 12, color: '#9ca3af' }}>Cartão {CARTAO_LABEL[(evento as any).cartaoTipo ?? 'amarelo']}</span>}
                                  {tipo === 'gol' && assist && <span style={{ fontSize: 12, color: '#9ca3af' }}>👟 {assist.jogadorNome}</span>}
                                </div>
                              </div>
                              <span style={{ fontSize: 10, color: cor, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{isA ? eqA?.nome : eqB?.nome}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {!temHistorico && nomesA.length === 0 && nomesB.length === 0 && (
                  <p className="text-center text-gray-400 text-sm py-4">Nenhum evento registrado nesta partida</p>
                )}

                {/* ── Pênaltis ── */}
                {temKicks && (() => {
                  const penA = p.penaltis_kicks!.filter(k => k.equipe === 'A');
                  const penB = p.penaltis_kicks!.filter(k => k.equipe === 'B');
                  const golsPA = penA.filter(k => k.resultado === 'gol').length;
                  const golsPB = penB.filter(k => k.resultado === 'gol').length;
                  return (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pênaltis</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 10px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                          <span style={{ fontSize: 15, fontWeight: 900, color: golsPA > golsPB ? '#16a34a' : '#6b7280' }}>{golsPA}</span>
                          <span style={{ color: '#d1d5db', fontWeight: 700, fontSize: 13 }}>×</span>
                          <span style={{ fontSize: 15, fontWeight: 900, color: golsPB > golsPA ? '#16a34a' : '#6b7280' }}>{golsPB}</span>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {(['A', 'B'] as const).map(eq => {
                          const kicks = eq === 'A' ? penA : penB;
                          const cor = eq === 'A' ? cA : cB;
                          const nomeEq = eq === 'A' ? eqA?.nome : eqB?.nome;
                          return (
                            <div key={eq} style={{ background: '#f9fafb', borderRadius: 14, overflow: 'hidden', border: `1.5px solid ${cor}30` }}>
                              <div style={{ background: cor, padding: '5px 8px', textAlign: 'center' }}>
                                <p style={{ margin: 0, color: '#fff', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{nomeEq}</p>
                              </div>
                              {kicks.map((k, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                                  <div style={{ width: 20, height: 20, flexShrink: 0, borderRadius: 99, background: k.resultado === 'gol' ? '#dcfce7' : '#fee2e2', border: `2px solid ${k.resultado === 'gol' ? '#22c55e' : '#ef4444'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, color: k.resultado === 'gol' ? '#16a34a' : '#dc2626' }}>
                                    {k.resultado === 'gol' ? '✓' : '✗'}
                                  </div>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.jogadorNome}</span>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Editar partida — oculto em modo readonly */}
                {!isReadonly && ((decididaPorPen || temKicks) ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button
                      onClick={() => { setModalEditarPartidaId(p.id); setEditarModoPenaltis(false); setSenhaEditar(''); setErroSenhaEditar(''); }}
                      className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-semibold hover:border-sky-300 hover:text-sky-600 transition-colors"
                    >
                      ✏️ Editar placar da partida
                    </button>
                    <button
                      onClick={() => { setModalEditarPartidaId(p.id); setEditarModoPenaltis(true); setSenhaEditar(''); setErroSenhaEditar(''); }}
                      className="w-full py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-semibold hover:border-red-400 hover:text-red-600 transition-colors"
                    >
                      🥅 Refazer pênaltis
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setModalEditarPartidaId(p.id); setEditarModoPenaltis(false); setSenhaEditar(''); setErroSenhaEditar(''); }}
                    className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-semibold hover:border-sky-300 hover:text-sky-600 transition-colors"
                  >
                    ✏️ Editar partida
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── MODAL SENHA — EDITAR PARTIDA ─────────────────────────────────── */}
      {modalEditarPartidaId && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 20 }}>
          <div style={{ backgroundColor: 'white', borderRadius: 20, padding: 28, maxWidth: 360, width: '100%' }}>
            <h3 style={{ margin: '0 0 6px', fontWeight: 900, fontSize: 18, color: '#111827', textAlign: 'center' }}>
              {editarModoPenaltis ? 'Refazer pênaltis' : 'Editar partida'}
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280', textAlign: 'center' }}>
              {editarModoPenaltis
                ? 'Confirme sua senha para reabrir a disputa de pênaltis.'
                : 'Confirme sua senha para reabrir a partida e corrigir os eventos.'}
            </p>
            <input
              type="password"
              placeholder="Sua senha"
              value={senhaEditar}
              onChange={(e) => { setSenhaEditar(e.target.value); setErroSenhaEditar(''); }}
              onKeyDown={(e) => e.key === 'Enter' && confirmarEditarPartida()}
              autoFocus
              style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${erroSenhaEditar ? '#ef4444' : '#e5e7eb'}`, fontSize: 15, outline: 'none', boxSizing: 'border-box', marginBottom: 6 }}
            />
            {erroSenhaEditar && <p style={{ margin: '0 0 12px', fontSize: 12, color: '#ef4444', textAlign: 'center' }}>{erroSenhaEditar}</p>}
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button
                onClick={() => { setModalEditarPartidaId(null); setEditarModoPenaltis(false); setSenhaEditar(''); setErroSenhaEditar(''); }}
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '1px solid #e5e7eb', background: 'transparent', color: '#6b7280', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
              >Cancelar</button>
              <button
                onClick={confirmarEditarPartida}
                disabled={carregandoSenha || !senhaEditar}
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, background: '#3b82f6', border: 'none', color: 'white', fontWeight: 700, fontSize: 14, cursor: carregandoSenha || !senhaEditar ? 'not-allowed' : 'pointer', opacity: carregandoSenha || !senhaEditar ? 0.6 : 1 }}
              >{carregandoSenha ? 'Verificando...' : 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de jogadores */}
      {modalTimeId && (() => {
        const equipe = equipes.find((e) => e.id === modalTimeId);
        const jogadores = jogadoresPorEquipe[modalTimeId] ?? [];
        const emTroca = !!jogadorParaTrocar;

        const partidasTime = partidas.filter((p) => p.status === 'finalizada' && (p.equipe_a_id === modalTimeId || p.equipe_b_id === modalTimeId));
        const resultadosTime = partidasTime.reduce((acc, p) => {
          const somosA = p.equipe_a_id === modalTimeId;
          const golsPro = somosA ? p.gols_a : p.gols_b;
          const golsContra = somosA ? p.gols_b : p.gols_a;
          acc.gp += golsPro;
          acc.gc += golsContra;
          if (golsPro > golsContra) acc.v++;
          else if (golsPro === golsContra) acc.e++;
          else acc.d++;
          return acc;
        }, { j: partidasTime.length, v: 0, e: 0, d: 0, gp: 0, gc: 0 });
        const statsPorJogador = jogadores.map((j) => {
          const stat = stats.find((s) => s.jogadorId === j.id);
          const eventos = partidasTime.flatMap((p) => (historicosMap[p.id]?.eventos ?? []).filter((ev) => ev.jogadorId === j.id));
          const gols = stat?.gols ?? eventos.filter((ev) => ev.tipo === 'gol').length;
          const assistencias = stat?.assistencias ?? eventos.filter((ev) => ev.tipo === 'assistencia').length;
          const mvp = new Set(partidasTime.filter((p) => (historicosMap[p.id]?.eventos ?? []).some((ev) => ev.jogadorId === j.id && (ev.tipo === 'gol' || ev.tipo === 'assistencia'))).map((p) => p.id)).size;
          const cartoes = eventos.filter((ev) => ev.tipo === 'cartao');
          const amarelo = cartoes.filter((ev) => ev.cartaoTipo === 'amarelo').length;
          const vermelho = cartoes.filter((ev) => ev.cartaoTipo === 'vermelho').length;
          const azul = cartoes.filter((ev) => ev.cartaoTipo === 'azul').length;
          return {
            ...j,
            gols,
            assistencias,
            mvp,
            amarelo,
            vermelho,
            azul,
          };
        });

        const jogadoresOrdenados = [...statsPorJogador].sort((a, b) => {
          const aGoleiro = a.posicao === 'goleiro' || a.goleiroSlot;
          const bGoleiro = b.posicao === 'goleiro' || b.goleiroSlot;
          if (aGoleiro !== bGoleiro) return aGoleiro ? 1 : -1;
          return a.nome.localeCompare(b.nome, 'pt-BR');
        });

        const modoSubstituicaoAtivo = modoSubstituicao && !emTroca;

        return (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 9999 }} onClick={() => { setModalTimeId(null); setJogadorParaTrocar(null); setModoSubstituicao(false); }}>
            <div style={{ backgroundColor: 'white', borderRadius: '24px 24px 0 0', padding: '24px', width: '100%', maxWidth: '640px', maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-800">{equipe?.cor ?? '⭐'} {equipe?.nome ?? 'Time'}</h3>
                <button onClick={() => { setModalTimeId(null); setJogadorParaTrocar(null); setModoSubstituicao(false); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 font-bold">✕</button>
              </div>
              {!emTroca ? (
                <>
                  <div className="mb-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estatísticas gerais do time:</div>
                  <div className="mb-4 text-xs text-gray-500">
                    {resultadosTime.j} Jogos · {resultadosTime.v} V · {resultadosTime.e} E · {resultadosTime.d} D · {resultadosTime.gp} GP · {resultadosTime.gc} GC
                  </div>
                  {modoSubstituicaoAtivo && (
                    <>
                      <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                        Clique em um jogador para iniciar a substituição e depois escolha um suplente.
                      </div>
                      <button onClick={() => { setModoSubstituicao(false); setJogadorParaTrocar(null); }} className="mb-4 px-4 py-2 rounded-xl border border-amber-200 text-amber-700 text-sm font-semibold hover:bg-amber-50 transition-colors">
                        Cancelar modo de substituição
                      </button>
                    </>
                  )}
                  {jogadoresOrdenados.length === 0 ? (
                    <div className="text-center py-5">
                      <p className="text-sm text-gray-500 mb-3">Os jogadores não foram registrados neste sorteio.</p>
                      <p className="text-xs text-gray-400 mb-4">Volte à tela de Sorteio, refaça e confirme os times para associar os jogadores.</p>
                      <button
                        onClick={() => { setModalTimeId(null); router.push('/modo-torneio/sortear-times'); }}
                        className="px-4 py-2 rounded-xl bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 transition-colors"
                      >
                        🎲 Ir para Sorteio
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-3xl border border-gray-100 bg-gray-50">
                      <div className="grid grid-cols-[3.8fr_0.8fr_0.8fr_0.8fr_0.7fr_0.7fr_0.7fr] gap-2 p-3 text-xs text-gray-500 font-semibold uppercase tracking-wide">
                        <span className="text-left">&nbsp;</span>
                        <span className="text-center">⚽</span>
                        <span className="text-center">👟</span>
                        <span className="text-center">⭐</span>
                        <span className="text-center">🟨</span>
                        <span className="text-center">🟥</span>
                        <span className="text-center">🟦</span>
                      </div>
                      <div className="divide-y divide-gray-100 bg-white">
                        {jogadoresOrdenados.map((j) => {
                          const isZero = (value: number | undefined) => (value ?? 0) === 0;
                          const icon = j.posicao === 'goleiro' || j.goleiroSlot ? '🧤' : '';
                          const podeSelecionar = modoSubstituicaoAtivo;
                          return (
                            <div key={j.id} className={`grid grid-cols-[3.8fr_0.8fr_0.8fr_0.8fr_0.7fr_0.7fr_0.7fr] items-center gap-2 px-3 py-3 ${podeSelecionar ? 'cursor-pointer hover:bg-amber-50 transition-colors' : ''}`} onClick={() => podeSelecionar && setJogadorParaTrocar(j)}>
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-base">{icon}</span>
                                <span className="truncate text-sm font-semibold text-gray-800">{j.nome}</span>
                              </div>
                              <span className={`text-center text-sm ${isZero(j.gols) ? 'text-gray-400' : 'text-gray-600'} font-medium`}>{j.gols ?? 0}</span>
                              <span className={`text-center text-sm ${isZero(j.assistencias) ? 'text-gray-400' : 'text-gray-600'} font-medium`}>{j.assistencias ?? 0}</span>
                              <span className={`text-center text-sm ${isZero(j.mvp) ? 'text-gray-400' : 'text-gray-600'} font-medium`}>{j.mvp ?? 0}</span>
                              <span className={`text-center text-sm ${isZero(j.amarelo) ? 'text-gray-400' : 'text-gray-600'} font-medium`}>{j.amarelo ?? 0}</span>
                              <span className={`text-center text-sm ${isZero(j.vermelho) ? 'text-gray-400' : 'text-gray-600'} font-medium`}>{j.vermelho ?? 0}</span>
                              <span className={`text-center text-sm ${isZero(j.azul) ? 'text-gray-400' : 'text-gray-600'} font-medium`}>{j.azul ?? 0}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {suplentes.length === 0 && <p className="text-xs text-gray-400 text-center mt-2">Nenhum suplente disponível</p>}
                </>
              ) : (
                <>
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-sm text-amber-700">Trocando <strong>{jogadorParaTrocar.nome}</strong> por:</p>
                  </div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Suplentes disponíveis</p>
                  <div className="space-y-2 mb-3">
                    {suplentes.map((s) => (
                      <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{s.nome}</p>
                          <p className="text-xs text-gray-400">{Array.from({ length: 5 }).map((_, k) => k < (s.nivel ?? 3) ? '★' : '☆').join('')}</p>
                        </div>
                        <button onClick={() => trocarJogador(s)} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-colors">Confirmar</button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setJogadorParaTrocar(null)} className="w-full py-2 rounded-xl border border-gray-200 text-gray-500 text-sm font-semibold">Cancelar troca</button>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── JOGOS ─────────────────────────────────────────────────────────── */}
      {abaAtiva === 'jogos' && (
        <div className="space-y-3">
          {Array.from(new Set(
            partidas
              .filter((p) => ['Liga', 'Turno', 'Returno', 'Grupos'].includes(p.fase))
              .map((p) => `${p.rodada}-${p.fase}`)
          )).map((chave) => {
            const parts = chave.split('-');
            const rodada = parseInt(parts[0]);
            const fase = parts.slice(1).join('-');
            const lote = partidas.filter((p) => p.rodada === rodada && p.fase === fase);
            const rodadaFechada = lote.length > 0 && lote.every((p) => p.status === 'finalizada');
            const oculta = rodadaFechada && !rodadasAbertas.has(chave);
            return (
              <section key={chave}>
                <button
                  className="w-full flex items-center justify-between px-1 mb-2"
                  onClick={() => {
                    if (!rodadaFechada) return;
                    setRodadasAbertas((prev) => {
                      const next = new Set(prev);
                      if (next.has(chave)) next.delete(chave); else next.add(chave);
                      return next;
                    });
                  }}
                  style={{ cursor: rodadaFechada ? 'pointer' : 'default', background: 'none', border: 'none', padding: 0 }}
                >
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                    {fase} — Rodada {rodada}
                    {rodadaFechada && <span className="text-emerald-400">✓</span>}
                  </p>
                  {rodadaFechada && (
                    <span className="text-gray-400 text-xs font-bold" style={{ display: 'inline-block', transition: 'transform 0.2s', transform: oculta ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▼</span>
                  )}
                </button>
                {!oculta && (
                  <div className="space-y-2">
                    {lote.map((p) => {
                      const eqA = equipeById(p.equipe_a_id);
                      const eqB = equipeById(p.equipe_b_id);
                      const finalizada = p.status === 'finalizada';
                      const editando = partidaResultadoId === p.id;
                      const corA = corDoTime(eqA?.cor);
                      const corB = corDoTime(eqB?.cor);
                      const decididoPorPenLiga = finalizada && p.gols_a === p.gols_b && !!p.vencedor_id;
                      const penKicksLiga = p.penaltis_kicks ?? [];
                      const gPALiga = penKicksLiga.filter(k => k.equipe === 'A' && k.resultado === 'gol').length;
                      const gPBLiga = penKicksLiga.filter(k => k.equipe === 'B' && k.resultado === 'gol').length;
                      return (
                        <div key={p.id} className={`bg-white rounded-2xl border shadow-sm p-3 ${finalizada ? 'border-emerald-100' : 'border-gray-100'}`}>
                          {editando ? (
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <div className="flex-1 text-center"><p className="text-xs font-bold text-gray-700">{eqA?.nome ?? '?'}</p></div>
                                <input type="number" min={0} value={golsA} onChange={(e) => setGolsA(e.target.value)} className="w-14 text-center text-lg font-black border-2 border-sky-400 rounded-xl outline-none py-1" />
                                <span className="text-gray-400 font-bold">×</span>
                                <input type="number" min={0} value={golsB} onChange={(e) => setGolsB(e.target.value)} className="w-14 text-center text-lg font-black border-2 border-sky-400 rounded-xl outline-none py-1" />
                                <div className="flex-1 text-center"><p className="text-xs font-bold text-gray-700">{eqB?.nome ?? '?'}</p></div>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => setPartidaResultadoId(null)} className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm font-semibold">Cancelar</button>
                                <button onClick={() => lancarResultado(p.id)} className="flex-1 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600">Confirmar</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {/* Time A */}
                              <div className="flex-1 flex justify-end">
                                <div style={{ backgroundColor: hexToRgba(corA, 0.12), border: `1.5px solid ${hexToRgba(corA, 0.35)}`, borderRadius: 8, padding: '4px 10px', width: '100%', overflow: 'hidden' }}>
                                  <p style={{ color: corA, fontWeight: 700, fontSize: 13, textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{eqA?.nome ?? '?'}</p>
                                </div>
                              </div>
                              {/* Centro: resultado ou botão */}
                              {finalizada ? (
                                <button
                                  onClick={() => setModalDetalhesPartidaId(p.id)}
                                  className="flex flex-col items-center gap-0.5 px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-200 hover:border-sky-300 transition-colors"
                                  title="Ver detalhes"
                                >
                                  <div className="flex items-center gap-1">
                                    <span className={`text-lg font-black ${decididoPorPenLiga ? (p.vencedor_id === p.equipe_a_id ? 'text-emerald-600' : 'text-gray-400') : p.gols_a > p.gols_b ? 'text-emerald-600' : p.gols_a < p.gols_b ? 'text-red-400' : 'text-gray-500'}`}>{p.gols_a}</span>
                                    <span className="text-gray-300 text-sm font-bold">×</span>
                                    <span className={`text-lg font-black ${decididoPorPenLiga ? (p.vencedor_id === p.equipe_b_id ? 'text-emerald-600' : 'text-gray-400') : p.gols_b > p.gols_a ? 'text-emerald-600' : p.gols_b < p.gols_a ? 'text-red-400' : 'text-gray-500'}`}>{p.gols_b}</span>
                                  </div>
                                  {decididoPorPenLiga && (
                                    penKicksLiga.length > 0
                                      ? <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.03em' }}>🥅 {gPALiga} × {gPBLiga} pen</span>
                                      : <span style={{ fontSize: 9, fontWeight: 700, color: '#d1d5db', letterSpacing: '0.04em' }}>🥅 PEN</span>
                                  )}
                                </button>
                              ) : (
                                !isReadonly && <button onClick={() => router.push(`/modo-torneio/partida?id=${p.id}&autoStart=true`)} className="px-4 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 active:scale-95 transition-all shadow-sm">⚽ Jogar</button>
                              )}
                              {/* Time B */}
                              <div className="flex-1 flex justify-start">
                                <div style={{ backgroundColor: hexToRgba(corB, 0.12), border: `1.5px solid ${hexToRgba(corB, 0.35)}`, borderRadius: 8, padding: '4px 10px', width: '100%', overflow: 'hidden' }}>
                                  <p style={{ color: corB, fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{eqB?.nome ?? '?'}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}

          {/* ── Mata-Mata ao final da agenda ── */}
          <section className="pt-2">
            <div className="flex items-center gap-2 px-1 mb-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">⚔️ Mata-Mata</p>
            </div>
            {partidasMM.length > 0 ? (
              <div className="space-y-4">
                {Array.from(new Set(partidasMM.map((p) => p.fase))).map((faseM) => (
                  <div key={faseM}>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 px-1">{faseM}</p>
                    <div className="space-y-2">
                      {partidasMM.filter((p) => p.fase === faseM).map((p) => {
                        const eqA = equipeById(p.equipe_a_id);
                        const eqB = equipeById(p.equipe_b_id);
                        const finalizada = p.status === 'finalizada' && (p.gols_a !== p.gols_b || !!p.vencedor_id);
                        const empateFinalizado = p.status === 'finalizada' && p.gols_a === p.gols_b && !p.vencedor_id;
                        const aguardando = p.status === 'aguardando_desempate' || empateFinalizado;
                        const decididoPorPen = finalizada && p.gols_a === p.gols_b && !!p.vencedor_id;
                        const proxDesempate = p.proximo_desempate ?? (regras?.empate_decisao === 'prorrogacao' ? 'prorrogacao' : 'penaltis');
                        const corA = corDoTime(eqA?.cor);
                        const corB = corDoTime(eqB?.cor);
                        const mmPenKicks = p.penaltis_kicks ?? [];
                        const mmGPA = mmPenKicks.filter(k => k.equipe === 'A' && k.resultado === 'gol').length;
                        const mmGPB = mmPenKicks.filter(k => k.equipe === 'B' && k.resultado === 'gol').length;
                        const mmTemKicks = mmPenKicks.length > 0;
                        return (
                          <div key={p.id} className={`bg-white rounded-2xl border shadow-sm p-3 ${finalizada ? 'border-emerald-100' : aguardando ? 'border-amber-200' : 'border-gray-100'}`}>
                            {aguardando && (
                              <div className="text-center mb-2">
                                <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-3 py-0.5">⏸ Aguardando desempate</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <div className="flex-1 flex justify-end">
                                <div style={{ backgroundColor: hexToRgba(corA, 0.12), border: `1.5px solid ${hexToRgba(corA, 0.35)}`, borderRadius: 8, padding: '4px 10px', width: '100%', overflow: 'hidden' }}>
                                  <p style={{ color: corA, fontWeight: 700, fontSize: 13, textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{eqA?.nome ?? '?'}</p>
                                </div>
                              </div>
                              {finalizada ? (
                                <button onClick={() => setModalDetalhesPartidaId(p.id)} className="flex flex-col items-center gap-0.5 px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-200 hover:border-sky-300 transition-colors" title="Ver detalhes">
                                  <div className="flex items-center gap-1">
                                    <span className={`text-lg font-black ${decididoPorPen ? (p.vencedor_id === p.equipe_a_id ? 'text-emerald-600' : 'text-gray-400') : p.gols_a > p.gols_b ? 'text-emerald-600' : p.gols_a < p.gols_b ? 'text-red-400' : 'text-gray-500'}`}>{p.gols_a}</span>
                                    <span className="text-gray-300 text-sm font-bold">×</span>
                                    <span className={`text-lg font-black ${decididoPorPen ? (p.vencedor_id === p.equipe_b_id ? 'text-emerald-600' : 'text-gray-400') : p.gols_b > p.gols_a ? 'text-emerald-600' : p.gols_b < p.gols_a ? 'text-red-400' : 'text-gray-500'}`}>{p.gols_b}</span>
                                  </div>
                                  {decididoPorPen && (
                                    mmTemKicks
                                      ? <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.03em' }}>🥅 {mmGPA} × {mmGPB} pen</span>
                                      : <span style={{ fontSize: 9, fontWeight: 700, color: '#d1d5db', letterSpacing: '0.04em' }}>🥅 PEN</span>
                                  )}
                                </button>
                              ) : aguardando ? (
                                <div className="flex flex-col items-center gap-1.5">
                                  <div className="flex items-center gap-1 px-3 py-1 bg-amber-50 rounded-xl border border-amber-200">
                                    <span className="text-base font-black text-amber-600">{p.gols_a}</span>
                                    <span className="text-amber-300 text-xs font-bold">×</span>
                                    <span className="text-base font-black text-amber-600">{p.gols_b}</span>
                                  </div>
                                  {proxDesempate === 'prorrogacao' ? (
                                    !isReadonly && <button onClick={() => iniciarProrrogacao(p)} className="px-3 py-1 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 active:scale-95 transition-all">⏱ Prorrogação</button>
                                  ) : (
                                    !isReadonly && <button onClick={() => iniciarPenaltis(p)} className="px-3 py-1 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-600 active:scale-95 transition-all">🥅 Penalidades</button>
                                  )}
                                </div>
                              ) : (
                                !isReadonly && <button onClick={() => router.push(`/modo-torneio/partida?id=${p.id}&autoStart=true`)} className="px-4 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 active:scale-95 transition-all shadow-sm">⚽ Jogar</button>
                              )}
                              <div className="flex-1 flex justify-start">
                                <div style={{ backgroundColor: hexToRgba(corB, 0.12), border: `1.5px solid ${hexToRgba(corB, 0.35)}`, borderRadius: 8, padding: '4px 10px', width: '100%', overflow: 'hidden' }}>
                                  <p style={{ color: corB, fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{eqB?.nome ?? '?'}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Prévia da próxima fase (Final / 3º Lugar) enquanto a fase atual corre */}
                {previewProximaFase && (
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 px-1 flex items-center gap-1.5">
                      {previewProximaFase.proxFase}
                      <span className="text-amber-400 font-normal normal-case">· prévia</span>
                    </p>
                    <div className="space-y-2">
                      {previewProximaFase.pairsFinais.map((c, i) => (
                        <div key={`final-${i}`} className="bg-white rounded-2xl border border-dashed border-amber-200 shadow-sm p-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 text-right">
                              <p className="text-sm font-bold text-gray-700">{c.a ? `${c.a.cor ?? '⭐'} ` : ''}{c.labelA}</p>
                            </div>
                            <div className="px-2 py-1 bg-amber-50 rounded-lg"><span className="text-xs font-bold text-amber-400">VS</span></div>
                            <div className="flex-1 text-left">
                              <p className="text-sm font-bold text-gray-700">{c.b ? `${c.b.cor ?? '⭐'} ` : ''}{c.labelB}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                      {previewProximaFase.pairsTerceiro.map((c, i) => (
                        <div key={`3rd-${i}`} className="bg-white rounded-2xl border border-dashed border-gray-200 shadow-sm p-3">
                          <p className="text-xs text-gray-400 text-center mb-1.5 font-semibold">3º Lugar</p>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 text-right">
                              <p className="text-sm font-semibold text-gray-500">{c.a ? `${c.a.cor ?? '⭐'} ` : ''}{c.labelA}</p>
                            </div>
                            <div className="px-2 py-1 bg-gray-100 rounded-lg"><span className="text-xs font-bold text-gray-400">VS</span></div>
                            <div className="flex-1 text-left">
                              <p className="text-sm font-semibold text-gray-500">{c.b ? `${c.b.cor ?? '⭐'} ` : ''}{c.labelB}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : confrontosPreview.length === 0 ? (
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-center">
                <p className="text-2xl mb-1">🏆</p>
                <p className="text-sm font-semibold text-amber-700">Nenhum jogo finalizado ainda</p>
                <p className="text-xs text-amber-500 mt-0.5">Jogue as rodadas para ver a prévia</p>
              </div>
            ) : (
              <div>
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-3">
                  <p className="text-sm text-amber-700 font-semibold">Prévia — se o torneio terminasse agora</p>
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 px-1">
                  {confrontosPreview.length === 1 ? 'Final' : confrontosPreview.length === 2 ? 'Semifinal' : 'Quartas de Final'}
                </p>
                <div className="space-y-2">
                  {confrontosPreview.map((c, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 text-right">
                          <p className="text-sm font-bold text-gray-800">{c.a.cor ?? '⭐'} {c.a.nome}</p>
                          <p className="text-xs text-gray-400">{classificacao.indexOf(c.a) + 1}º</p>
                        </div>
                        <div className="px-3 py-1 bg-gray-100 rounded-xl"><span className="text-xs font-bold text-gray-400">VS</span></div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-bold text-gray-800">{c.b.cor ?? '⭐'} {c.b.nome}</p>
                          <p className="text-xs text-gray-400">{classificacao.indexOf(c.b) + 1}º</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {partidas.length === 0 && <div className="text-center py-10 text-gray-400"><p className="text-4xl mb-3">📅</p><p>Nenhum jogo gerado ainda</p></div>}

          {/* Banner do campeão */}
          {campeao && (
            <button
              onClick={() => setModalCampeao(true)}
              style={{ width: '100%', background: 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)', border: '1.5px solid rgba(234,179,8,0.4)', borderRadius: 18, padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}
            >
              <span style={{ fontSize: 28, filter: 'drop-shadow(0 0 8px rgba(234,179,8,0.8))' }}>🏆</span>
              <div style={{ textAlign: 'left', flex: 1 }}>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#eab308', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Campeão</p>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 900, color: '#fff' }}>{campeao.cor ?? '⭐'} {campeao.nome}</p>
              </div>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>ver ›</span>
            </button>
          )}
        </div>
      )}

      {/* ── CLASSIFICAÇÃO ─────────────────────────────────────────────────── */}
      {abaAtiva === 'classificacao' && (
        <div>
          {classificacao.length === 0 ? (
            <div className="text-center py-10 text-gray-400"><p className="text-4xl mb-3">📊</p><p>Nenhum dado disponível</p></div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-2 py-2 text-xs font-bold text-gray-400 w-6">#</th>
                    <th className="text-left px-2 py-2 text-xs font-bold text-gray-500 uppercase">Time</th>
                    {colunasTabela.map((c) => (
                      <th key={c} className={`text-center px-2 py-2 text-xs font-bold uppercase whitespace-nowrap ${c === 'pontos' ? 'text-sky-600' : 'text-gray-500'}`}>{CRITERIO_COL[c].abbrev}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {classificacao.map((e, i) => (
                    <tr key={e.id} className={i > 0 ? 'border-t border-gray-50' : ''}>
                      <td className="px-2 py-3"><span className="text-xs font-black text-gray-300">{i + 1}</span></td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base flex-shrink-0">{e.cor ?? '⭐'}</span>
                          <span className="text-sm font-semibold text-gray-800">{e.nome}</span>
                        </div>
                      </td>
                      {colunasTabela.map((c) => {
                        const col = CRITERIO_COL[c];
                        const val = (e as unknown as Record<string, number>)[col.key] ?? 0;
                        const isSaldo = c === 'saldo_gols';
                        return (
                          <td key={c} className={`text-center px-2 py-3 text-sm whitespace-nowrap ${c === 'pontos' ? 'font-black text-sky-600' : isSaldo && val > 0 ? 'font-semibold text-emerald-600' : isSaldo && val < 0 ? 'font-semibold text-red-500' : 'text-gray-500'}`}>
                            {isSaldo && val > 0 ? `+${val}` : val}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {classificamLiga > 0 && classificacao.length > classificamLiga && (
                <div className="px-3 py-2 border-t border-dashed border-amber-200 bg-amber-50">
                  <p className="text-xs text-amber-600 font-semibold">↑ Top {classificamLiga} classificados para mata-mata</p>
                </div>
              )}
              {classificacao.some((e, i) => i > 0 && classificacao[i - 1].pts === e.pts) && (
                <div className="px-3 py-2 border-t border-gray-50 flex items-center justify-between">
                  {temEmpateReal ? (
                    <p className="text-xs text-amber-600 font-semibold">⚠️ Empate técnico detectado</p>
                  ) : (
                    <p className="text-xs text-gray-400">Mesmos pontos, mas critérios os separam</p>
                  )}
                  <button
                    onClick={sortearEmpates}
                    disabled={!temEmpateReal || !ligaCompleta}
                    title={!ligaCompleta ? 'Aguarde todas as rodadas serem concluídas' : !temEmpateReal ? 'Não há empate técnico real' : 'Sortear desempate'}
                    className={`text-xs font-semibold flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${temEmpateReal && ligaCompleta ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50' : 'text-gray-300 cursor-not-allowed'}`}
                  >🎲 Sortear desempate</button>
                </div>
              )}
              {probabilidades !== null && (
                <div className="border-t border-gray-100">
                  <button
                    onClick={() => setShowProbabilidades((v) => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    <span>📊 Probabilidades</span>
                    <span className="text-gray-400">{showProbabilidades ? '▲' : '▼'}</span>
                  </button>
                  {showProbabilidades && (
                    <div className="px-3 pb-3 space-y-1.5">
                      {probabilidades.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-1">Jogue a 1ª partida para ver as projeções</p>
                      ) : probabilidades.map((p) => (
                        <div key={p.id} className="flex items-center gap-2">
                          <span className="text-sm flex-shrink-0 w-5 text-center">{p.icone}</span>
                          <span className="flex-shrink-0 text-base">{p.cor ?? '⭐'}</span>
                          <span className={`text-xs font-semibold flex-shrink-0 ${p.corStatus === 'roxo' ? 'text-purple-700' : p.corStatus === 'verde' ? 'text-emerald-700' : p.corStatus === 'vermelho' ? 'text-red-600' : 'text-amber-700'}`}>{p.nome}</span>
                          <span className={`text-xs ml-auto text-right ${p.corStatus === 'roxo' ? 'text-purple-500' : p.corStatus === 'verde' ? 'text-emerald-500' : p.corStatus === 'vermelho' ? 'text-red-400' : 'text-amber-600'}`}>{p.mensagem}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── MATA-MATA ─────────────────────────────────────────────────────── */}
      {abaAtiva === 'chaveamento' && (
        <div>
          {partidasMM.length > 0 ? (
            <div className="space-y-3">
              {Array.from(new Set(partidasMM.map((p) => p.fase))).map((fase) => (
                <section key={fase}>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 px-1">{fase}</p>
                  <div className="space-y-2">
                    {partidasMM.filter((p) => p.fase === fase).map((p) => {
                      const eqA = equipeById(p.equipe_a_id);
                      const eqB = equipeById(p.equipe_b_id);
                      const finalizada = p.status === 'finalizada';
                      return (
                        <div key={p.id} className={`bg-white rounded-2xl border shadow-sm p-3 ${finalizada ? 'border-emerald-100' : 'border-gray-100'}`}>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 text-right"><p className="text-sm font-bold text-gray-800">{eqA?.nome ?? '?'}</p></div>
                            {finalizada ? (
                              <div className="flex items-center gap-1 px-3 py-1 bg-gray-50 rounded-xl border border-gray-100">
                                <span className={`text-lg font-black ${p.gols_a > p.gols_b ? 'text-emerald-600' : 'text-gray-500'}`}>{p.gols_a}</span>
                                <span className="text-gray-300 text-sm">×</span>
                                <span className={`text-lg font-black ${p.gols_b > p.gols_a ? 'text-emerald-600' : 'text-gray-500'}`}>{p.gols_b}</span>
                              </div>
                            ) : !isReadonly ? (
                              <button onClick={() => router.push(`/modo-torneio/partida?id=${p.id}&autoStart=true`)} className="px-4 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 active:scale-95 transition-all shadow-sm">⚽ Jogar</button>
                            ) : null}
                            <div className="flex-1 text-left"><p className="text-sm font-bold text-gray-800">{eqB?.nome ?? '?'}</p></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div>
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-4">
                <p className="text-sm text-amber-700 font-semibold">Prévia — Mata-Mata</p>
                <p className="text-xs text-amber-600 mt-0.5">Duelos se o torneio terminasse agora</p>
              </div>
              {confrontosPreview.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <p className="text-4xl mb-3">🏆</p>
                  <p className="font-semibold">Nenhum jogo finalizado ainda</p>
                  <p className="text-sm mt-1">Jogue na aba Jogos para ver a prévia</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 px-1">
                    {confrontosPreview.length === 1 ? 'Final' : confrontosPreview.length === 2 ? 'Semifinal' : 'Quartas de Final'}
                  </p>
                  {confrontosPreview.map((c, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 text-right">
                          <p className="text-sm font-bold text-gray-800">{c.a.cor ?? '⭐'} {c.a.nome}</p>
                          <p className="text-xs text-gray-400">{classificacao.indexOf(c.a) + 1}º</p>
                        </div>
                        <div className="px-3 py-1 bg-gray-100 rounded-xl"><span className="text-xs font-bold text-gray-400">VS</span></div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-bold text-gray-800">{c.b.cor ?? '⭐'} {c.b.nome}</p>
                          <p className="text-xs text-gray-400">{classificacao.indexOf(c.b) + 1}º</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── ESTATÍSTICAS ──────────────────────────────────────────────────── */}
      {abaAtiva === 'estatisticas' && (
        <div className="space-y-5">
          {[
            { titulo: 'Artilharia', emoji: '⚽', field: 'gols' as const, cor: 'text-emerald-600', badge: '⚽' },
            { titulo: 'Assistências', emoji: '👟', field: 'assistencias' as const, cor: 'text-blue-600', badge: '👟' },
          ].map(({ titulo, emoji, field, cor, badge }) => {
            const lista = [...stats].filter((s) => s[field] > 0).sort((a, b) => b[field] - a[field]);
            const expandida = statsExpandidas.has(titulo);
            const exibir = expandida ? lista : lista.slice(0, 3);
            return (
              <section key={titulo}>
                <button
                  className="w-full flex items-center justify-between mb-3"
                  onClick={() => setStatsExpandidas((prev) => { const n = new Set(prev); if (n.has(titulo)) n.delete(titulo); else n.add(titulo); return n; })}
                  style={{ background: 'none', border: 'none', padding: '0 4px', cursor: 'pointer' }}
                >
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                    <span>{emoji}</span> {titulo}
                  </h3>
                  {lista.length > 3 && (
                    <span className="text-xs font-semibold text-sky-500 flex items-center gap-1">
                      {expandida ? 'ver menos' : `ver todos (${lista.length})`}
                      <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: expandida ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
                    </span>
                  )}
                </button>
                {lista.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center text-gray-400">
                    <p className="text-3xl mb-2">{emoji}</p>
                    <p className="text-sm">Nenhum registro ainda</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {exibir.map((s, i) => (
                      <div key={s.jogadorId} className={`flex items-center px-4 py-3 gap-3 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                        <span className="text-base w-6 text-center">
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="font-black text-gray-300">{i + 1}</span>}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-800 truncate">
                            <span className="text-gray-400 font-normal">{s.equipeNome} · </span>{s.nome}
                          </p>
                        </div>
                        <span className={`text-base font-bold ${cor}`}>{s[field]} {badge}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}

          {/* Participações G+A */}
          {(() => {
            const titulo = 'Participações (G+A)';
            const lista = [...stats].filter((s) => s.gols + s.assistencias > 0).sort((a, b) => (b.gols + b.assistencias) - (a.gols + a.assistencias));
            const expandida = statsExpandidas.has(titulo);
            const exibir = expandida ? lista : lista.slice(0, 3);
            return (
              <section>
                <button
                  className="w-full flex items-center justify-between mb-3"
                  onClick={() => setStatsExpandidas((prev) => { const n = new Set(prev); if (n.has(titulo)) n.delete(titulo); else n.add(titulo); return n; })}
                  style={{ background: 'none', border: 'none', padding: '0 4px', cursor: 'pointer' }}
                >
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                    <span>🌟</span> {titulo}
                  </h3>
                  {lista.length > 3 && (
                    <span className="text-xs font-semibold text-sky-500 flex items-center gap-1">
                      {expandida ? 'ver menos' : `ver todos (${lista.length})`}
                      <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: expandida ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
                    </span>
                  )}
                </button>
                {lista.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center text-gray-400">
                    <p className="text-3xl mb-2">🌟</p><p className="text-sm">Nenhuma participação ainda</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {exibir.map((s, i) => (
                      <div key={s.jogadorId} className={`flex items-center px-4 py-3 gap-3 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                        <span className="text-base w-6 text-center">
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="font-black text-gray-300">{i + 1}</span>}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-800 truncate">
                            <span className="text-gray-400 font-normal">{s.equipeNome} · </span>{s.nome}
                          </p>
                        </div>
                        <div className="flex gap-2 text-sm font-bold">
                          <span className="text-emerald-600">{s.gols}⚽</span>
                          <span className="text-blue-500">{s.assistencias}👟</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })()}

          {/* Goleiros Menos Vazados */}
          {(() => {
            const titulo = 'Goleiros Menos Vazados';
            
            // Construir mapa de goleiros verificando posicao nos jogadores
            const goleirosSet = new Set<string>();
            Object.values(jogadoresPorEquipe).forEach((jogadores) => {
              jogadores.forEach((j) => {
                if (j.posicao === 'goleiro' || j.goleiroSlot) {
                  goleirosSet.add(j.id);
                }
              });
            });
            
            console.log('🥅 DEBUG Goleiros Menos Vazados:', {
              goleirosIdentificados: Array.from(goleirosSet),
              statsTotal: stats.length,
              jogadoresPorEquipe: Object.keys(jogadoresPorEquipe).length,
              statsComGolsSofridos: stats.filter(s => s.golsSofridos !== undefined).length
            });
            
            // Criar entry para cada goleiro (mesmo que sem stats)
            const goleirosStats: EstatisticaJogadorTorneio[] = [];
            Object.entries(jogadoresPorEquipe).forEach(([equipeId, jogadores]) => {
              const goleiro = jogadores.find(j => j.posicao === 'goleiro' || j.goleiroSlot);
              if (goleiro) {
                const statExistente = stats.find(s => s.jogadorId === goleiro.id);
                const equipeNome = classificacao.find(e => e.id === equipeId)?.nome ?? '';
                
                // Calcular gols sofridos pelo time do goleiro em partidas finalizadas
                const golsSofridos = partidas
                  .filter(p => p.status === 'finalizada')
                  .reduce((total, p) => {
                    if (p.equipe_a_id === equipeId) return total + (p.gols_b ?? 0);
                    if (p.equipe_b_id === equipeId) return total + (p.gols_a ?? 0);
                    return total;
                  }, 0);
                
                goleirosStats.push(statExistente || {
                  jogadorId: goleiro.id,
                  nome: goleiro.nome,
                  equipeId,
                  equipeNome,
                  gols: 0,
                  assistencias: 0,
                  jogos: 0,
                  golsSofridos: 0,
                });
                
                // Sobrescrever golsSofridos com o valor calculado
                goleirosStats[goleirosStats.length - 1].golsSofridos = golsSofridos;
              }
            });
            
            // Ordenar todos os goleiros por: 1) gols sofridos (menor primeiro), 2) colocação do time
            const listaRanqueada = [...goleirosStats].sort((a, b) => {
              const vasadasA = a.golsSofridos ?? 0;
              const vasadasB = b.golsSofridos ?? 0;
              
              if (vasadasA !== vasadasB) return vasadasA - vasadasB;
              
              // Desempate: colocação do time na classificação
              const posicaoA = classificacao.findIndex((e) => e.id === a.equipeId) + 1;
              const posicaoB = classificacao.findIndex((e) => e.id === b.equipeId) + 1;
              return posicaoA - posicaoB;
            });
            
            // Combinar: apenas a lista ranqueada
            const listaCombinada = listaRanqueada;
            
            const expandida = statsExpandidas.has(titulo);
            const exibir = expandida ? listaCombinada : listaCombinada.slice(0, 3);
            return goleirosStats.length > 0 ? (
              <section>
                <button
                  className="w-full flex items-center justify-between mb-3"
                  onClick={() => setStatsExpandidas((prev) => { const n = new Set(prev); if (n.has(titulo)) n.delete(titulo); else n.add(titulo); return n; })}
                  style={{ background: 'none', border: 'none', padding: '0 4px', cursor: 'pointer' }}
                >
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                    <span>🥅</span> {titulo}
                  </h3>
                  {goleirosStats.length > 3 && (
                    <span className="text-xs font-semibold text-sky-500 flex items-center gap-1">
                      {expandida ? 'ver menos' : `ver todos (${goleirosStats.length})`}
                      <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: expandida ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
                    </span>
                  )}
                </button>
                {exibir.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center text-gray-400">
                    <p className="text-3xl mb-2">🥅</p>
                    <p className="text-sm">Nenhum goleiro registrado</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {exibir.map((s, i) => {
                      return (
                        <div key={s.jogadorId} className={`flex items-center px-4 py-3 gap-3 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                          <span className="text-base w-6 text-center">
                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="font-black text-gray-300">{i + 1}</span>}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-gray-800 truncate">
                              <span className="text-gray-400 font-normal">{s.equipeNome} · </span>{s.nome}
                            </p>
                          </div>
                          <span className="text-base font-bold text-indigo-600">{s.golsSofridos ?? 0}🥅</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            ) : null;
          })()}

          {/* Stats de times */}
          {(() => {
            const comJogos = classificacao.filter((e) => e.j > 0);
            const goleador = comJogos.length > 0 ? [...comJogos].sort((a, b) => b.gp - a.gp)[0] : null;
            const menosVazado = comJogos.length > 0 ? [...comJogos].sort((a, b) => a.gc - b.gc)[0] : null;
            const invictos = comJogos.filter((e) => e.d === 0);
            const items: { emoji: string; titulo: string; valor: string; sub: string; cor: string }[] = [];
            const fasesLigaGol = ['Liga', 'Turno', 'Returno', 'Grupos'];
            const partidasFinalizadas = partidas.filter((p) => p.status === 'finalizada' && fasesLigaGol.includes(p.fase));
            let maiorGoleada: { placar: string; nomeA: string; nomeB: string; diff: number; total: number } | null = null;
            partidasFinalizadas.forEach((p) => {
              const diff = Math.abs(p.gols_a - p.gols_b);
              const total = p.gols_a + p.gols_b;
              if (diff >= 3 && (!maiorGoleada || diff > maiorGoleada.diff || (diff === maiorGoleada.diff && total > maiorGoleada.total))) {
                const eqA = equipes.find((e) => e.id === p.equipe_a_id);
                const eqB = equipes.find((e) => e.id === p.equipe_b_id);
                maiorGoleada = { placar: `${p.gols_a} × ${p.gols_b}`, nomeA: eqA?.nome ?? '?', nomeB: eqB?.nome ?? '?', diff, total };
              }
            });
            if (goleador) items.push({ emoji: '⚽', titulo: 'Time Goleador', valor: goleador.nome, sub: `${goleador.gp} gol${goleador.gp === 1 ? '' : 's'} marcado${goleador.gp === 1 ? '' : 's'}`, cor: 'text-emerald-600' });
            if (menosVazado) items.push({ emoji: '🧱', titulo: 'Menos Vazado', valor: menosVazado.nome, sub: `${menosVazado.gc} gol${menosVazado.gc === 1 ? '' : 's'} sofrido${menosVazado.gc === 1 ? '' : 's'}`, cor: 'text-sky-600' });
            if (invictos.length > 0) items.push({
              emoji: '🛡️',
              titulo: invictos.length === 1 ? 'Time Invicto' : `${invictos.length} Times Invictos`,
              valor: invictos.map((e) => e.nome).join(' · '),
              sub: invictos.length === 1 ? `${invictos[0].j} jogo${invictos[0].j === 1 ? '' : 's'} sem perder` : 'sem derrotas',
              cor: 'text-purple-600',
            });
            if (maiorGoleada) items.push({ emoji: '💥', titulo: 'Maior Goleada', valor: `${(maiorGoleada as {nomeA:string}).nomeA}  ${(maiorGoleada as {placar:string}).placar}  ${(maiorGoleada as {nomeB:string}).nomeB}`, sub: '', cor: 'text-rose-600' });
            return (
              <section>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide flex items-center gap-2 mb-3 px-1">
                  <span>🏟️</span> Times
                </h3>
                {items.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center text-gray-400">
                    <p className="text-3xl mb-2">🏟️</p>
                    <p className="text-sm">Nenhum jogo finalizado ainda</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {items.map((item, i) => (
                      <div key={item.titulo} className={`flex items-center px-4 py-3 gap-3 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                        <span className="text-xl w-7 text-center flex-shrink-0">{item.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">{item.titulo}</p>
                          <p className="font-semibold text-sm text-gray-800">{item.valor}</p>
                        </div>
                        <span className={`text-xs font-semibold ${item.cor} text-right flex-shrink-0`}>{item.sub}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })()}

          {/* Hat Trick */}
          {(() => {
            type HatTrick = { jogadorId: string; nome: string; equipeNome: string; quantidade: number; tipo: 'gol' | 'assistencia'; jogo: string };
            const hatTricks: HatTrick[] = [];
            partidas
              .filter((p) => p.status === 'finalizada')
              .forEach((p) => {
                const hist = historicosMap[p.id];
                if (!hist) return;
                const eqA = equipes.find((e) => e.id === p.equipe_a_id);
                const eqB = equipes.find((e) => e.id === p.equipe_b_id);
                const jogo = `${eqA?.nome ?? '?'} ${p.gols_a}×${p.gols_b} ${eqB?.nome ?? '?'}`;
                const contagem: Record<string, { nome: string; equipeId: string; gols: number; assists: number }> = {};
                hist.eventos.forEach((ev) => {
                  if (ev.jogadorId === 'anonimo' || ev.jogadorId === 'gc') return;
                  if (!contagem[ev.jogadorId]) contagem[ev.jogadorId] = { nome: ev.jogadorNome, equipeId: ev.equipeId, gols: 0, assists: 0 };
                  if (ev.tipo === 'gol') contagem[ev.jogadorId].gols++;
                  else if (ev.tipo === 'assistencia') contagem[ev.jogadorId].assists++;
                });
                Object.entries(contagem).forEach(([id, c]) => {
                  const eq = equipes.find((e) => e.id === c.equipeId);
                  const equipeNome = eq?.nome ?? '';
                  if (c.gols >= 3) hatTricks.push({ jogadorId: `${p.id}_${id}_gol`, nome: c.nome, equipeNome, quantidade: c.gols, tipo: 'gol', jogo });
                  if (c.assists >= 3) hatTricks.push({ jogadorId: `${p.id}_${id}_assist`, nome: c.nome, equipeNome, quantidade: c.assists, tipo: 'assistencia', jogo });
                });
              });
            return (
              <section>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide flex items-center gap-2 mb-3 px-1">
                  <span>🎩</span> Hat Tricks
                </h3>
                {hatTricks.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center text-gray-400">
                    <p className="text-3xl mb-2">🎩</p>
                    <p className="text-sm">Nenhum hat trick ainda</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {hatTricks.map((h, i) => (
                      <div key={h.jogadorId} className={`flex items-start px-4 py-3 gap-3 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                        <span className="text-base w-6 text-center flex-shrink-0 mt-0.5">{h.tipo === 'gol' ? '⚽' : '👟'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-800">
                            <span className="text-gray-400 font-normal">{h.equipeNome} · </span>{h.nome}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5 truncate">{h.jogo}</p>
                        </div>
                        <span className={`text-sm font-black flex-shrink-0 ${h.tipo === 'gol' ? 'text-emerald-600' : 'text-blue-500'}`}>{h.quantidade}{h.tipo === 'gol' ? '⚽' : '👟'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })()}
        </div>
      )}
      {/* ── MODAL EDITAR REGRAS ───────────────────────────────────────────── */}
      {modalEditarRegras && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 9999 }} onClick={() => setModalEditarRegras(false)}>
          <div style={{ background: 'white', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 600, padding: 24 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontWeight: 900, fontSize: 18 }}>Editar Regras</h3>
              <button onClick={() => setModalEditarRegras(false)} style={{ background: '#f3f4f6', border: 'none', borderRadius: 99, width: 32, height: 32, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>✕</button>
            </div>
            {/* Tempo de jogo */}
            <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#6b7280' }}>Tempo de jogo (minutos)</p>
            <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
              {[5, 7, 8, 10, 12, 15, 20].map((t) => (
                <button
                  key={t}
                  onClick={() => setRegrasTempo(t)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 10,
                    border: `2px solid ${regrasTempo === t ? '#374151' : '#e5e7eb'}`,
                    background: regrasTempo === t ? '#f3f4f6' : 'white',
                    fontWeight: regrasTempo === t ? 900 : 500,
                    fontSize: 14,
                    cursor: 'pointer',
                    color: regrasTempo === t ? '#111827' : '#6b7280',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Estrutura do tempo */}
            <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#6b7280' }}>Estrutura do tempo</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {([1, 2] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => setRegrasTemposPartida(n)}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 12, fontSize: 13, cursor: 'pointer', fontWeight: regrasTemposPartida === n ? 800 : 500,
                    border: `2px solid ${regrasTemposPartida === n ? '#0ea5e9' : '#e5e7eb'}`,
                    background: regrasTemposPartida === n ? '#f0f9ff' : 'white',
                    color: regrasTemposPartida === n ? '#0369a1' : '#6b7280',
                  }}
                >
                  {n === 1 ? 'Tempo único' : `2 tempos (${regrasTempo}min cada)`}
                </button>
              ))}
            </div>
            {regrasTemposPartida === 2 && (
              <p style={{ margin: '-14px 0 20px', fontSize: 12, color: '#0ea5e9', fontWeight: 600 }}>Total: {regrasTempo * 2} min por partida</p>
            )}

            {/* Decisão de empate */}
            <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#6b7280' }}>Decisão de empate (mata-mata)</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: regrasEmpate === 'prorrogacao' ? 16 : 24 }}>
              <button
                onClick={() => setRegrasEmpate('prorrogacao')}
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: `2px solid ${regrasEmpate === 'prorrogacao' ? '#f59e0b' : '#e5e7eb'}`, background: regrasEmpate === 'prorrogacao' ? '#fffbeb' : 'white', fontWeight: regrasEmpate === 'prorrogacao' ? 800 : 500, fontSize: 14, cursor: 'pointer', color: regrasEmpate === 'prorrogacao' ? '#b45309' : '#6b7280' }}
              >⏱ Prorrogação</button>
              <button
                onClick={() => setRegrasEmpate('penaltis')}
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: `2px solid ${regrasEmpate === 'penaltis' ? '#ef4444' : '#e5e7eb'}`, background: regrasEmpate === 'penaltis' ? '#fef2f2' : 'white', fontWeight: regrasEmpate === 'penaltis' ? 800 : 500, fontSize: 14, cursor: 'pointer', color: regrasEmpate === 'penaltis' ? '#dc2626' : '#6b7280' }}
              >🥅 Pênaltis</button>
            </div>

            {/* Tempo de prorrogação — só aparece se prorrogação selecionada */}
            {regrasEmpate === 'prorrogacao' && (
              <>
                <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#6b7280' }}>Tempo de prorrogação (minutos)</p>
                <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
                  {[3, 5, 7, 10, 15].map((t) => (
                    <button
                      key={t}
                      onClick={() => setRegrasTempoProrrogacao(t)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 10,
                        border: `2px solid ${regrasTempoProrrogacao === t ? '#f59e0b' : '#e5e7eb'}`,
                        background: regrasTempoProrrogacao === t ? '#fffbeb' : 'white',
                        fontWeight: regrasTempoProrrogacao === t ? 900 : 500,
                        fontSize: 14,
                        cursor: 'pointer',
                        color: regrasTempoProrrogacao === t ? '#b45309' : '#6b7280',
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </>
            )}
            <button
              onClick={salvarRegras}
              style={{ width: '100%', padding: '14px 0', borderRadius: 14, background: '#111827', color: 'white', fontWeight: 900, fontSize: 15, border: 'none', cursor: 'pointer' }}
            >Salvar alterações</button>
          </div>
        </div>
      )}

      {/* ── MODAL SALVAR / SYNC ───────────────────────────────────────────── */}
      {modalSalvar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }} onClick={() => setModalSalvar(false)}>
          <div style={{ background: 'white', borderRadius: 20, padding: 28, maxWidth: 360, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}><span style={{ fontSize: 48 }}>💾</span></div>
            <h3 style={{ textAlign: 'center', margin: '0 0 8px', fontWeight: 900, fontSize: 18 }}>Salvar progresso</h3>
            <p style={{ textAlign: 'center', color: '#6b7280', fontSize: 13, margin: '0 0 20px', lineHeight: 1.5 }}>
              Salva o estado atual localmente. Ao retornar ao app, o torneio pode ser retomado deste ponto.
            </p>
            {ultimoSalvo && (
              <p style={{ textAlign: 'center', color: '#d1d5db', fontSize: 11, margin: '0 0 16px' }}>
                Último save: {new Date(ultimoSalvo).toLocaleString('pt-BR')}
              </p>
            )}
            <button
              disabled
              style={{ opacity: 0.4, width: '100%', padding: '12px 0', borderRadius: 12, border: '1.5px solid #e5e7eb', background: 'white', color: '#9ca3af', fontSize: 13, fontWeight: 700, marginBottom: 10, cursor: 'not-allowed' }}
            >☁️ Sync (em breve)</button>
            <button
              onClick={executarSalvar}
              disabled={salvando}
              style={{ width: '100%', padding: '14px 0', borderRadius: 14, background: '#3b82f6', color: 'white', fontWeight: 900, fontSize: 15, border: 'none', cursor: salvando ? 'not-allowed' : 'pointer' }}
            >
              {salvando ? 'Salvando...' : '💾 Salvar localmente'}
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL ENCERRAR TORNEIO ────────────────────────────────────────── */}
      {modalEncerrar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }} onClick={() => !encerrando && (setModalEncerrar(false), setSenhaEncerrar(''), setErroSenhaEncerrar(''))}>
          <div style={{ background: 'white', borderRadius: 20, padding: 28, maxWidth: 360, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}><span style={{ fontSize: 48 }}>🏆</span></div>
            <h3 style={{ textAlign: 'center', margin: '0 0 8px', fontWeight: 900, fontSize: 18 }}>Encerrar Torneio</h3>
            <p style={{ textAlign: 'center', color: '#6b7280', fontSize: 13, margin: '0 0 20px', lineHeight: 1.5 }}>
              O torneio será encerrado e ficará disponível para consulta. Esta ação não pode ser desfeita.
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#374151' }}>
                Digite sua senha para confirmar
              </label>
              <input
                type="password"
                value={senhaEncerrar}
                onChange={(e) => { setSenhaEncerrar(e.target.value); setErroSenhaEncerrar(''); }}
                onKeyDown={(e) => e.key === 'Enter' && executarEncerrar()}
                placeholder="Sua senha"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `2px solid ${erroSenhaEncerrar ? '#ef4444' : '#e5e7eb'}`, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                disabled={encerrando}
                autoFocus
              />
              {erroSenhaEncerrar && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#ef4444' }}>{erroSenhaEncerrar}</p>}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setModalEncerrar(false); setSenhaEncerrar(''); setErroSenhaEncerrar(''); }}
                disabled={encerrando}
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '1px solid #e5e7eb', background: 'transparent', color: '#6b7280', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
              >Cancelar</button>
              <button
                onClick={executarEncerrar}
                disabled={encerrando}
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, background: '#ef4444', color: 'white', fontWeight: 900, fontSize: 14, border: 'none', cursor: encerrando ? 'not-allowed' : 'pointer', opacity: encerrando ? 0.7 : 1 }}
              >
                {encerrando ? 'Verificando...' : '🏆 Encerrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL FECHAR TORNEIO ──────────────────────────────────────────── */}
      {modalFechar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }} onClick={() => setModalFechar(false)}>
          <div style={{ background: 'white', borderRadius: 20, padding: 28, maxWidth: 360, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ textAlign: 'center', margin: '0 0 8px', fontWeight: 900, fontSize: 18 }}>Fechar torneio?</h3>
            <p style={{ textAlign: 'center', color: '#6b7280', fontSize: 13, margin: '0 0 20px', lineHeight: 1.5 }}>
              Deseja salvar o progresso antes de sair?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={() => executarFechar(true)}
                style={{ width: '100%', padding: '14px 0', borderRadius: 14, background: '#3b82f6', color: 'white', fontWeight: 900, fontSize: 14, border: 'none', cursor: 'pointer' }}
              >💾 Salvar e fechar</button>
              <button
                onClick={() => executarFechar(false)}
                style={{ width: '100%', padding: '12px 0', borderRadius: 12, border: '1px solid #e5e7eb', background: 'transparent', color: '#6b7280', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
              >Fechar sem salvar</button>
              <button
                onClick={() => setModalFechar(false)}
                style={{ width: '100%', padding: '10px 0', borderRadius: 12, background: 'transparent', border: 'none', color: '#d1d5db', fontSize: 13, cursor: 'pointer' }}
              >Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DESTAQUES DO TORNEIO ─────────────────────────────────── */}
      {modalDestaques && campeao && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10200, display: 'flex', flexDirection: 'column' }}>
          {/* Card = 100% da tela, scrollável, área "imprimível" */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              background: 'linear-gradient(160deg, #0d0d1a 0%, #0f3460 55%, #1a0a2e 100%)',
              position: 'relative',
            }}
          >
            {/* Estrelinhas decorativas de fundo */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
              {['10%,6%','88%,4%','5%,35%','92%,30%','50%,12%','78%,55%','22%,65%','62%,82%','40%,45%','15%,88%'].map((pos, i) => {
                const [left, top] = pos.split(',');
                const size = i % 3 === 0 ? 4 : i % 2 === 0 ? 3 : 2;
                return <div key={i} style={{ position: 'absolute', left, top, width: size, height: size, borderRadius: '50%', background: '#eab308', opacity: 0.15 + (i * 0.03) }} />;
              })}
              {/* Arcos decorativos de luz */}
              <div style={{ position: 'absolute', top: -120, left: '50%', transform: 'translateX(-50%)', width: 400, height: 240, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(234,179,8,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
            </div>

            <div style={{ maxWidth: 500, margin: '0 auto', padding: '0 0 24px', position: 'relative' }}>
              {/* Header: label + nome torneio à esquerda, logo à direita */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 24px 16px', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.18em' }}>Destaques do Torneio</p>
                  <p style={{ margin: '3px 0 0', fontSize: 15, fontWeight: 800, color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{torneio?.nome}</p>
                </div>
                {/* Logo com fundo branco circular */}
                <div style={{ flexShrink: 0, width: 60, height: 60, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 18px rgba(234,179,8,0.4), 0 0 0 2px rgba(234,179,8,0.25)', overflow: 'hidden' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo.png" alt="logo" style={{ width: 56, height: 56, objectFit: 'contain' }} />
                </div>
              </div>

              {/* Divisor dourado */}
              <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(234,179,8,0.7), transparent)', margin: '0 24px 20px' }} />

              {/* Troféu + Campeão */}
              <div style={{ textAlign: 'center', padding: '0 24px' }}>
                <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 8, filter: 'drop-shadow(0 0 28px rgba(234,179,8,1))' }}>🏆</div>
                <p style={{ margin: '0 0 3px', fontSize: 11, fontWeight: 800, color: '#eab308', textTransform: 'uppercase', letterSpacing: '0.2em' }}>🥇 Campeão</p>
                <p style={{ margin: '0 0 16px', fontSize: 28, fontWeight: 900, color: '#fff', textShadow: '0 0 40px rgba(234,179,8,0.6)', lineHeight: 1.2 }}>
                  {campeao.nome}
                </p>
              </div>

              {/* Jogadores do campeão */}
              {statsCampeao.length > 0 && (
                <div style={{ margin: '0 24px 20px', background: 'rgba(255,255,255,0.06)', borderRadius: 18, border: '1px solid rgba(234,179,8,0.2)', overflow: 'hidden' }}>
                  {statsCampeao.map((j, idx) => (
                    <div
                      key={j.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '10px 16px',
                        borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                        gap: 10,
                      }}
                    >
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', width: 16, flexShrink: 0, textAlign: 'center' }}>{idx + 1}</span>
                      <span style={{ flex: 1, textAlign: 'left', fontSize: 14, fontWeight: j.gols > 0 || j.assistencias > 0 ? 700 : 500, color: j.gols > 0 || j.assistencias > 0 ? '#fff' : 'rgba(255,255,255,0.4)' }}>
                        {j.nome}
                      </span>
                      <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
                        {j.gols > 0 && (
                          <span style={{ fontSize: 13, fontWeight: 800, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span>⚽</span><span>{j.gols}</span>
                          </span>
                        )}
                        {j.assistencias > 0 && (
                          <span style={{ fontSize: 13, fontWeight: 800, color: '#93c5fd', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span>👟</span><span>{j.assistencias}</span>
                          </span>
                        )}
                        {j.gols === 0 && j.assistencias === 0 && (
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.18)' }}>—</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Divisor sutil */}
              <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)', margin: '0 24px 16px' }} />

              {/* Vice-campeão */}
              {viceCampeao && (
                <div style={{ margin: '0 24px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ fontSize: 20, marginTop: 1, flexShrink: 0 }}>🥈</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Vice-campeão</p>
                      <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800, color: 'rgba(255,255,255,0.6)' }}>{viceCampeao.nome}</p>
                      {statsVice.length > 0 && (
                        <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.38)', lineHeight: 1.6 }}>
                          {statsVice.map((j) => j.nome).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Destaques individuais */}
              {(artilheiro || melhorAssistente) && (
                <>
                  <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)', margin: '0 24px 16px' }} />
                  <div style={{ margin: '0 24px 20px', display: 'grid', gridTemplateColumns: artilheiro && melhorAssistente ? '1fr 1fr' : '1fr', gap: 10 }}>
                    {artilheiro && (
                      <div style={{ background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 16, padding: '12px 14px', display: 'flex', flexDirection: 'column' }}>
                        <p style={{ margin: '0 0 8px', fontSize: 9, fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.13em' }}>⚽ Artilheiro</p>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: '#fff', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artilheiro.nome}</p>
                            {(() => { const nomeTime = equipes.find(e => e.id === artilheiro.equipeId)?.nome; return nomeTime ? <p style={{ margin: '3px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nomeTime}</p> : null; })()}
                          </div>
                          <div style={{ flexShrink: 0, textAlign: 'center' }}>
                            <p style={{ margin: 0, fontSize: 32, fontWeight: 900, color: '#4ade80', lineHeight: 1 }}>{artilheiro.gols}</p>
                            <p style={{ margin: '1px 0 0', fontSize: 9, fontWeight: 600, color: 'rgba(74,222,128,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>gols</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {melhorAssistente && (
                      <div style={{ background: 'rgba(147,197,253,0.07)', border: '1px solid rgba(147,197,253,0.2)', borderRadius: 16, padding: '12px 14px', display: 'flex', flexDirection: 'column' }}>
                        <p style={{ margin: '0 0 8px', fontSize: 9, fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.13em' }}>👟 Assistências</p>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: '#fff', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{melhorAssistente.nome}</p>
                            {(() => { const nomeTime = equipes.find(e => e.id === melhorAssistente.equipeId)?.nome; return nomeTime ? <p style={{ margin: '3px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nomeTime}</p> : null; })()}
                          </div>
                          <div style={{ flexShrink: 0, textAlign: 'center' }}>
                            <p style={{ margin: 0, fontSize: 32, fontWeight: 900, color: '#93c5fd', lineHeight: 1 }}>{melhorAssistente.assistencias}</p>
                            <p style={{ margin: '1px 0 0', fontSize: 9, fontWeight: 600, color: 'rgba(147,197,253,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>passes</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Rodapé com branding */}
              <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(234,179,8,0.3), transparent)', margin: '0 24px 12px' }} />
              <div style={{ padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.2)', fontWeight: 500 }}>peladaplay.com</p>
                <div style={{ display: 'flex', gap: 5 }}>
                  {['⭐','⭐','⭐','⭐','⭐'].map((s, i) => <span key={i} style={{ fontSize: 8, opacity: 0.25 }}>{s}</span>)}
                </div>
              </div>
            </div>
          </div>

          {/* Botão fechar — FORA do card, não aparece no print */}
          <button
            onClick={() => setModalDestaques(false)}
            style={{
              flexShrink: 0,
              padding: '16px 0',
              background: '#111827',
              color: 'rgba(255,255,255,0.5)',
              fontWeight: 700,
              fontSize: 14,
              border: 'none',
              cursor: 'pointer',
              letterSpacing: '0.02em',
            }}
          >
            ✕ Fechar
          </button>
        </div>
      )}
      {/* ── MODAL CAMPEÃO ─────────────────────────────────────────────────── */}
      {modalCampeao && campeao && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10100, padding: 20 }}
          onClick={() => setModalCampeao(false)}
        >
          <div
            style={{ background: 'linear-gradient(145deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)', borderRadius: 24, padding: '36px 28px 28px', maxWidth: 360, width: '100%', textAlign: 'center', boxShadow: '0 0 60px rgba(234,179,8,0.35)', border: '1.5px solid rgba(234,179,8,0.3)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Troféu animado */}
            <div style={{ fontSize: 72, lineHeight: 1, marginBottom: 12, filter: 'drop-shadow(0 0 20px rgba(234,179,8,0.8))' }}>🏆</div>

            <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 700, color: '#eab308', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Campeão do torneio</p>

            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>{torneio?.nome}</p>

            <p style={{ margin: '0 0 12px', fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>
              {campeao.nome}
            </p>

            {statsCampeao.length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: '10px 14px', marginBottom: 16, textAlign: 'center' }}>
                {statsCampeao.map((j) => (
                  <div key={j.id} style={{ padding: '3px 0' }}>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>{j.nome}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Partições douradas decorativas */}
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 24 }}>
              {['🥇', '🎉', '⭐', '🎉', '🥇'].map((e, i) => (
                <span key={i} style={{ fontSize: 18, opacity: 0.8 }}>{e}</span>
              ))}
            </div>

            <button
              onClick={() => setModalCampeao(false)}
              style={{ width: '100%', padding: '14px 0', borderRadius: 14, background: '#eab308', color: '#1a1a2e', fontWeight: 900, fontSize: 15, border: 'none', cursor: 'pointer', letterSpacing: '0.02em' }}
            >
              🏆 Fechar
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}


export default function PainelTorneioPageWrapper() {
  return (
    <Suspense fallback={null}>
      <PainelTorneioPage />
    </Suspense>
  );
}
