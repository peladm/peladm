'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import StatsFilterPanel from '../../components/StatsFilterPanel';
import bolaVermelha from '../../../bola-vermelha.png';
import { getClienteSupabase, fetchAllRows } from '../../lib/supabase';
import { usePermissions } from '../../lib/usePermissions';
import { buscar_pelada_id } from '../../lib/credenciais';
import {
  PontuacaoEstatisticas,
  PONTUACAO_PADRAO,
  carregarPontuacaoEstatisticas,
  calcularPontosEstatisticas,
} from '../../lib/pontuacaoEstatisticas';

interface RankingItem {
  posicao: number;
  nome: string;
  valor: string | number;
}

interface EstatisticaRanking {
  id: string;
  ranking: RankingItem[];
}

interface Jogador {
  id: string;
  nome: string;
  apelido?: string;
  nivel?: number;
  foto_url?: string;
  status?: string | null;
}

interface Gol {
  id?: string;
  jogo_id: string;
  jogador_id: string;
  gol_contra_jogador_id?: string | null;
  assistencia?: string | null;
  time: 'A' | 'B';
}

interface Assistencia {
  id?: string;
  jogo_id: string;
  jogador_id: string;
  time: 'A' | 'B';
  gol_id?: string;
}

interface Jogo {
  id: string;
  sessao_id: string;
  time_a: string[];
  time_b: string[];
  placar_a: number;
  placar_b: number;
  created_at: string;
  gols?: Gol[];
  assistencias?: Assistencia[];
}

export default function IndividualPage() {
  const STORAGE_KEY = 'peladm:individual:state:v1';
  const router = useRouter();
  const { possuiPermissao, loading: loadingPermissoes } = usePermissions();
  const [loading, setLoading] = useState(true);

  // Dados brutos
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [jogosFiltrados, setJogosFiltrados] = useState<Jogo[]>([]);
  const [jogadores, setJogadores] = useState<{ [id: string]: Jogador }>({});
  const [rankings, setRankings] = useState<EstatisticaRanking[]>([]);
  const [pontuacaoEstatisticas, setPontuacaoEstatisticas] = useState<PontuacaoEstatisticas>(PONTUACAO_PADRAO);

  // Estados para filtros
  const [filtro, setFiltro] = useState<'atual' | 'mes' | 'ultimas' | 'ano' | 'historia'>('atual');
  const [dataSelecionada, setDataSelecionada] = useState('');
  const [datasDisponiveis, setDatasDisponiveis] = useState<string[]>([]);
  const [mesesDisponiveis, setMesesDisponiveis] = useState<string[]>([]);
  const [anosDisponiveis, setAnosDisponiveis] = useState<string[]>([]);
  const [periodoSelecionado, setPeriodoSelecionado] = useState('');
  const [quantidadePeladas, setQuantidadePeladas] = useState('5');
  const [apenasAtivos, setApenasAtivos] = useState(false);

  const [jogadorSelecionado, setJogadorSelecionado] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.filtro) setFiltro(saved.filtro);
      if (typeof saved.dataSelecionada === 'string') setDataSelecionada(saved.dataSelecionada);
      if (typeof saved.periodoSelecionado === 'string') setPeriodoSelecionado(saved.periodoSelecionado);
      if (typeof saved.quantidadePeladas === 'string') setQuantidadePeladas(saved.quantidadePeladas);
      if (typeof saved.apenasAtivos === 'boolean') setApenasAtivos(saved.apenasAtivos);
      if (typeof saved.jogadorSelecionado === 'string' || saved.jogadorSelecionado === null) setJogadorSelecionado(saved.jogadorSelecionado);
    } catch {
      // ignore invalid persisted state
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      filtro,
      dataSelecionada,
      periodoSelecionado,
      quantidadePeladas,
      apenasAtivos,
      jogadorSelecionado,
    }));
  }, [filtro, dataSelecionada, periodoSelecionado, quantidadePeladas, apenasAtivos, jogadorSelecionado]);

  useEffect(() => {
    if (!loadingPermissoes && !possuiPermissao('verEstatisticas')) {
      alert('🚫 Estatísticas indisponíveis para este cliente no momento.');
      router.push('/');
    }
  }, [loadingPermissoes, possuiPermissao, router]);

  useEffect(() => { carregarDados(); }, []);
  useEffect(() => { aplicarFiltro(); }, [filtro, dataSelecionada, periodoSelecionado, quantidadePeladas, jogos]);
  useEffect(() => { calcularRankings(); }, [jogosFiltrados, jogadores, pontuacaoEstatisticas, apenasAtivos]);

  const buscarJogador = (jogadorId: any): string => {
    if (typeof jogadorId === 'object' && jogadorId?.nome) {
      return jogadorId.apelido || jogadorId.nome;
    }
    const idStr = String(jogadorId);
    const jogador = jogadores[idStr];
    if (jogador) return jogador.apelido || jogador.nome;
    return idStr.substring(0, 8);
  };

  const ehJogadorAtivo = (jogadorId: any) => {
    if (!apenasAtivos) return true;
    if (typeof jogadorId === 'object' && jogadorId?.id) {
      const jogador = jogadores[String(jogadorId.id)];
      if (!jogador) return false;
      return jogador.status === undefined || jogador.status === null || jogador.status === 'ativo';
    }
    const idStr = String(jogadorId);
    const jogador = jogadores[idStr];
    if (!jogador) return false;
    return jogador.status === undefined || jogador.status === null || jogador.status === 'ativo';
  };

  const calcularDuracaoJogoSegundos = (jogo: Jogo): number => {
    const jogoAny = jogo as any;

    if (jogoAny.data_inicio && jogoAny.data_fim) {
      const inicio = new Date(jogoAny.data_inicio);
      const fim = new Date(jogoAny.data_fim);
      const duracaoMs = fim.getTime() - inicio.getTime();
      if (duracaoMs > 0) return Math.floor(duracaoMs / 1000);
    }

    if (typeof jogoAny.tempo_decorrido === 'number') {
      const tempoInicial = 600;
      const duracaoReal = tempoInicial - jogoAny.tempo_decorrido;
      return Math.max(0, Math.abs(duracaoReal));
    }

    return 600;
  };

  const derivarAssistenciasDeGols = (gols: Gol[]): Assistencia[] => {
    return gols
      .filter((g) => g.id && g.assistencia)
      .map((g) => ({
        id: `gol-assistencia-${g.id}`,
        jogo_id: g.jogo_id,
        jogador_id: g.assistencia as string,
        time: g.time,
        gol_id: g.id,
      }));
  };

  const carregarDados = async () => {
    try {
      setLoading(true);
      const peladaId = buscar_pelada_id();
      if (!peladaId) { router.push('/login'); return; }

      setPontuacaoEstatisticas(await carregarPontuacaoEstatisticas(peladaId));

      const clienteDb = await getClienteSupabase(peladaId);

      const jogosData = await fetchAllRows((from, to) =>
        clienteDb
          .from('jogos')
          .select('*')
          .eq('pelada_id', peladaId)
          .eq('status', 'finalizado')
          .order('created_at', { ascending: false })
          .range(from, to)
      );

      if (jogosData && jogosData.length > 0) {
        const datas = [...new Set(jogosData.map(jogo => {
          const d = new Date(jogo.created_at);
          return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }))];
        const meses = [...new Set(jogosData.map(jogo => {
          const d = new Date(jogo.created_at);
          return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        }))].sort().reverse();
        const anos = [...new Set(jogosData.map(jogo =>
          new Date(jogo.created_at).getFullYear().toString()
        ))].sort().reverse();

        setDatasDisponiveis(datas);
        setMesesDisponiveis(meses);
        setAnosDisponiveis(anos);

        // Paginação manual: o Supabase limita respostas a 1000 linhas por padrão,
        // e uma pelada com muito histórico facilmente ultrapassa isso.
        const jogosIds = jogosData.map(j => j.id);
        const golsData = await fetchAllRows((from, to) =>
          clienteDb
            .from('gols')
            .select('*')
            .eq('pelada_id', peladaId)
            .in('jogo_id', jogosIds)
            .range(from, to)
        );

        setJogos(jogosData.map(jogo => {
          const golsDoJogo = (golsData || []).filter(g => g.jogo_id === jogo.id) as Gol[];
          const assistenciasDerivadas = derivarAssistenciasDeGols(golsDoJogo);

          return {
            ...jogo,
            gols: golsDoJogo,
            assistencias: assistenciasDerivadas,
          };
        }));
      } else {
        setJogos([]);
      }

      const { data: jogadoresData } = await clienteDb
        .from('jogadores').select('*').eq('pelada_id', peladaId);

      if (jogadoresData) {
        const map: { [id: string]: Jogador } = {};
        jogadoresData.forEach(j => { map[j.id] = j; map[j.nome] = j; });
        setJogadores(map);
      }
    } catch (err) {
      console.error('Erro ao carregar dados individuais:', err);
    } finally {
      setLoading(false);
    }
  };

  const aplicarFiltro = () => {
    let filtered = [...jogos];
    const fmt = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    if (filtro === 'atual') {
      if (dataSelecionada) {
        filtered = jogos.filter(j => fmt(j.created_at) === dataSelecionada);
      } else if (jogos.length > 0) {
        const recente = jogos.reduce((p, c) => new Date(c.created_at) > new Date(p.created_at) ? c : p);
        filtered = jogos.filter(j => j.sessao_id === recente.sessao_id);
      }
    } else if (filtro === 'mes') {
      if (periodoSelecionado) {
        filtered = jogos.filter(j => {
          const d = new Date(j.created_at);
          return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` === periodoSelecionado;
        });
      } else {
        const limite = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        filtered = jogos.filter(j => new Date(j.created_at) >= limite);
      }
    } else if (filtro === 'ultimas') {
      const sessoes = [...new Set(jogos.map(j => j.sessao_id))]
        .map(sid => {
          const ultimo = jogos.filter(j => j.sessao_id === sid)
            .reduce((p, c) => new Date(c.created_at) > new Date(p.created_at) ? c : p);
          return { sid, data: new Date(ultimo.created_at) };
        })
        .sort((a, b) => b.data.getTime() - a.data.getTime())
        .slice(0, parseInt(quantidadePeladas))
        .map(s => s.sid);
      filtered = jogos.filter(j => sessoes.includes(j.sessao_id));
    } else if (filtro === 'historia') {
      filtered = [...jogos];
    } else if (filtro === 'ano') {
      if (periodoSelecionado) {
        filtered = jogos.filter(j => {
          const [ano, parte] = periodoSelecionado.split('-');
          const data = new Date(j.created_at);
          const anoJogo = data.getFullYear().toString();
          if (parte === undefined) return anoJogo === periodoSelecionado;
          if (anoJogo !== ano) return false;
          const mes = data.getMonth();
          if (parte === 's1') return mes < 6;
          if (parte === 's2') return mes >= 6;
          if (parte === 'q1') return mes <= 2;
          if (parte === 'q2') return mes >= 3 && mes <= 5;
          if (parte === 'q3') return mes >= 6 && mes <= 8;
          if (parte === 'q4') return mes >= 9 && mes <= 11;
          return false;
        });
      } else {
        const limite = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        filtered = jogos.filter(j => new Date(j.created_at) >= limite);
      }
    }
    setJogosFiltrados(filtered);
  };

  const calcularRankings = () => {
    if (jogosFiltrados.length === 0 || Object.keys(jogadores).length === 0) {
      setRankings([]);
      return;
    }

    const stats: { [nome: string]: any } = {};
    jogosFiltrados.forEach(jogo => {
      [...jogo.time_a, ...jogo.time_b].forEach(jogadorId => {
        const nome = buscarJogador(jogadorId);
        if (!stats[nome]) stats[nome] = { nome, jogos: 0, vitorias: 0, derrotas: 0, empates: 0, gols: 0, golsContra: 0, assistencias: 0, mvp: 0, deiteiRolei: 0 };
        stats[nome].jogos++;
        const noTimeA = jogo.time_a.includes(jogadorId);
        if (jogo.placar_a === jogo.placar_b) stats[nome].empates++;
        else if ((noTimeA && jogo.placar_a > jogo.placar_b) || (!noTimeA && jogo.placar_b > jogo.placar_a)) stats[nome].vitorias++;
        else stats[nome].derrotas++;
      });
      (jogo.gols || []).forEach(g => {
        if (g.jogador_id === 'gol_contra') {
          const autorId = g.gol_contra_jogador_id;
          if (!autorId) return;
          const autorNome = buscarJogador(autorId);
          if (stats[autorNome]) stats[autorNome].golsContra = (stats[autorNome].golsContra || 0) + 1;
          return;
        }
        const n = buscarJogador(g.jogador_id);
        if (stats[n]) stats[n].gols++;
      });
      (jogo.assistencias || []).forEach(a => { const n = buscarJogador(a.jogador_id); if (stats[n]) stats[n].assistencias++; });

      const venc = [...(jogo.placar_a > jogo.placar_b ? jogo.time_a : []), ...(jogo.placar_b > jogo.placar_a ? jogo.time_b : [])];
      venc.forEach(id => {
        const n = buscarJogador(id);
        if (!stats[n]) return;
        const fezGol = (jogo.gols || []).some(g => buscarJogador(g.jogador_id) === n);
        const deuAssist = (jogo.assistencias || []).some(a => buscarJogador(a.jogador_id) === n);
        if (fezGol || deuAssist) stats[n].mvp++;
        if (fezGol && deuAssist) stats[n].deiteiRolei++;
      });
    });

    // Hat-tricks
    const hatTricks: { [nome: string]: number } = {};
    jogosFiltrados.forEach(jogo => {
      const contrib: { [nome: string]: { gols: number; assists: number } } = {};
      (jogo.gols || []).forEach(g => { const n = buscarJogador(g.jogador_id); if (!contrib[n]) contrib[n] = { gols: 0, assists: 0 }; contrib[n].gols++; });
      (jogo.assistencias || []).forEach(a => { const n = buscarJogador(a.jogador_id); if (!contrib[n]) contrib[n] = { gols: 0, assists: 0 }; contrib[n].assists++; });
      Object.entries(contrib).forEach(([n, c]) => { if (c.gols >= 3 || c.assists >= 3) hatTricks[n] = (hatTricks[n] || 0) + 1; });
    });

    // Nota por sessão
    const sessoes = [...new Set(jogosFiltrados.map(j => j.sessao_id))];
    const notasPor: { [nome: string]: { total: number; count: number } } = {};
    sessoes.forEach(sid => {
      const jogsDia = jogosFiltrados.filter(j => j.sessao_id === sid);
      const jogsDiaSet = new Set<string>();
      jogsDia.forEach(j => [...j.time_a, ...j.time_b].forEach(id => jogsDiaSet.add(buscarJogador(id))));
      jogsDiaSet.forEach(nome => {
        let jogosNoDia = 0, vitorias = 0, empates = 0, golsDia = 0, assistsDia = 0, cleanSheetsDia = 0;
        let hatTrickNoDia = false, deiteiRoleiNoDia = false;
        jogsDia.forEach(jogo => {
          const todos = [...jogo.time_a, ...jogo.time_b];
          const jId = todos.find(id => buscarJogador(id) === nome);
          if (!jId) return;
          jogosNoDia++;
          const noA = jogo.time_a.includes(jId);
          const ganhou = (noA && jogo.placar_a > jogo.placar_b) || (!noA && jogo.placar_b > jogo.placar_a);
          const empatou = jogo.placar_a === jogo.placar_b;
          const clean = (noA && jogo.placar_b === 0) || (!noA && jogo.placar_a === 0);
          const gj = (jogo.gols || []).filter(g => buscarJogador(g.jogador_id) === nome).length;
          const aj = (jogo.assistencias || []).filter(a => buscarJogador(a.jogador_id) === nome).length;
          if (ganhou) vitorias++;
          if (empatou) empates++;
          if (clean) cleanSheetsDia++;
          golsDia += gj; assistsDia += aj;
          if (gj >= 3 || aj >= 3) hatTrickNoDia = true;
          if (gj > 0 && aj > 0) deiteiRoleiNoDia = true;
        });
        if (jogosNoDia === 0) return;
        const aprov = (vitorias * 3 + empates) / (jogosNoDia * 3);
        const cleanR = cleanSheetsDia / jogosNoDia;
        const isDefPuro = cleanSheetsDia > 0 && golsDia === 0 && assistsDia === 0;
        const teveMvp = jogsDia.some(jogo => {
          const todos = [...jogo.time_a, ...jogo.time_b];
          const jId = todos.find(id => buscarJogador(id) === nome);
          if (!jId) return false;
          const noA = jogo.time_a.includes(jId);
          const ganhou = (noA && jogo.placar_a > jogo.placar_b) || (!noA && jogo.placar_b > jogo.placar_a);
          const gj = (jogo.gols || []).filter(g => buscarJogador(g.jogador_id) === nome).length;
          const aj = (jogo.assistencias || []).filter(a => buscarJogador(a.jogador_id) === nome).length;
          return ganhou && (gj > 0 || aj > 0);
        });
        let extrasCount = [teveMvp, deiteiRoleiNoDia, hatTrickNoDia, cleanR === 1, isDefPuro].filter(Boolean).length;
        const cap = 4.0 + (5 - extrasCount) * 0.5;
        let nota = 3.0 + aprov * 5.0;
        nota += Math.min(golsDia * 0.5 + assistsDia * 0.4, cap);
        if (cleanR === 1) nota += 1.0; else if (cleanR > 0.5) nota += 0.5;
        if (isDefPuro) nota += 1.5;
        if (hatTrickNoDia) nota += 1.0;
        if (deiteiRoleiNoDia) nota += 1.0;
        if (teveMvp) nota += 1.0;
        nota = Math.min(nota, 10);
        if (!notasPor[nome]) notasPor[nome] = { total: 0, count: 0 };
        notasPor[nome].total += nota;
        notasPor[nome].count++;
      });
    });

    const invictoPorSessao: { [nome: string]: number } = {};
    const bolaMurchaPorSessao: { [nome: string]: number } = {};

    sessoes.forEach((sid) => {
      const jogosSessao = jogosFiltrados.filter((j) => j.sessao_id === sid);
      const statsSessao: {
        [nome: string]: {
          jogos: number;
          vitorias: number;
          derrotas: number;
          empates: number;
          gols: number;
          golsContra: number;
          assistencias: number;
        };
      } = {};

      jogosSessao.forEach((jogo) => {
        [...jogo.time_a, ...jogo.time_b].forEach((jogadorId) => {
          const nome = buscarJogador(jogadorId);
          if (!statsSessao[nome]) {
            statsSessao[nome] = { jogos: 0, vitorias: 0, derrotas: 0, empates: 0, gols: 0, golsContra: 0, assistencias: 0 };
          }

          statsSessao[nome].jogos++;

          const noTimeA = jogo.time_a.includes(jogadorId);
          if (jogo.placar_a === jogo.placar_b) statsSessao[nome].empates++;
          else if ((noTimeA && jogo.placar_a > jogo.placar_b) || (!noTimeA && jogo.placar_b > jogo.placar_a)) statsSessao[nome].vitorias++;
          else statsSessao[nome].derrotas++;
        });

        (jogo.gols || []).forEach((g) => {
          if (g.jogador_id === 'gol_contra') {
            const autorId = g.gol_contra_jogador_id;
            if (!autorId) return;
            const nomeAutor = buscarJogador(autorId);
            if (statsSessao[nomeAutor]) statsSessao[nomeAutor].golsContra++;
            return;
          }
          const nome = buscarJogador(g.jogador_id);
          if (statsSessao[nome]) statsSessao[nome].gols++;
        });

        (jogo.assistencias || []).forEach((a) => {
          const nome = buscarJogador(a.jogador_id);
          if (statsSessao[nome]) statsSessao[nome].assistencias++;
        });
      });

      Object.entries(statsSessao).forEach(([nome, s]) => {
        if (s.jogos > 0 && s.derrotas === 0) {
          invictoPorSessao[nome] = (invictoPorSessao[nome] || 0) + 1;
        }
      });

      const pontuacoesSessao = Object.entries(statsSessao)
        .filter(([, s]) => s.jogos > 0)
        .map(([nome, s]) => ({
          nome,
          pontos: calcularPontosEstatisticas({
            vitorias: s.vitorias,
            derrotas: s.derrotas,
            empates: s.empates,
            gols: s.gols,
            golsContra: s.golsContra,
            assistencias: s.assistencias,
            cleanSheets: 0,
          }, pontuacaoEstatisticas),
        }));

      if (pontuacoesSessao.length > 0) {
        const menorPontuacao = Math.min(...pontuacoesSessao.map((p) => p.pontos));
        pontuacoesSessao
          .filter((p) => p.pontos === menorPontuacao)
          .forEach((p) => {
            bolaMurchaPorSessao[p.nome] = (bolaMurchaPorSessao[p.nome] || 0) + 1;
          });
      }
    });

    const mk = (id: string, arr: RankingItem[]): EstatisticaRanking => ({ id, ranking: arr });
    const byVal = (key: string, fmt: (v: any) => string) =>
      Object.values(stats).filter((s: any) => s[key] > 0)
        .sort((a: any, b: any) => b[key] - a[key])
        .map((s: any, i) => ({ posicao: i + 1, nome: s.nome, valor: fmt(s[key]) }));

    const carregouTime = Object.values(stats)
      .map((s: any) => {
        const jogosSemVitoria = jogosFiltrados.filter((jogo) => {
          const todos = [...jogo.time_a, ...jogo.time_b];
          const jogadorId = todos.find(id => buscarJogador(id) === s.nome);
          if (!jogadorId) return false;
          const noA = jogo.time_a.includes(jogadorId);
          const ganhou = (noA && jogo.placar_a > jogo.placar_b) || (!noA && jogo.placar_b > jogo.placar_a);
          return !ganhou;
        });

        let contribuicoes = 0;
        jogosSemVitoria.forEach((jogo) => {
          const golsNoJogo = (jogo.gols || []).filter((g: any) => buscarJogador(g.jogador_id) === s.nome).length;
          const assistsNoJogo = (jogo.assistencias || []).filter((a: any) => buscarJogador(a.jogador_id) === s.nome).length;
          contribuicoes += golsNoJogo + assistsNoJogo;
        });

        const media = jogosSemVitoria.length > 0 ? contribuicoes / jogosSemVitoria.length : 0;
        return {
          nome: s.nome,
          media,
          contribuicoes,
          jogosSemVitoria: jogosSemVitoria.length,
        };
      })
      .filter((s) => s.jogosSemVitoria > 0)
      .sort((a, b) => b.media - a.media)
      .map((s, i) => ({
        posicao: i + 1,
        nome: s.nome,
        valor: `${s.contribuicoes}/${s.jogosSemVitoria} (${s.media.toFixed(2)})`,
      }));

    const invicto = Object.entries(invictoPorSessao)
      .sort(([, a], [, b]) => b - a)
      .map(([nome, vezes], i) => ({ posicao: i + 1, nome, valor: `${vezes}x` }));

    const bolaMurcha = Object.entries(bolaMurchaPorSessao)
      .sort(([, a], [, b]) => b - a)
      .map(([nome, vezes], i) => ({ posicao: i + 1, nome, valor: `${vezes}x` }));

    const soDerrota = Object.values(stats)
      .filter((s: any) => s.jogos > 0)
      .map((s: any) => ({
        nome: s.nome,
        derrotas: s.derrotas,
        jogos: s.jogos,
        percentual: (s.derrotas / s.jogos) * 100,
      }))
      .sort((a, b) => b.percentual - a.percentual)
      .map((s, i) => ({ posicao: i + 1, nome: s.nome, valor: `${s.derrotas}/${s.jogos} (${s.percentual.toFixed(0)}%)` }));

    setRankings([
      mk('artilheiro', byVal('gols', v => `${v} gols`)),
      mk('garcom', byVal('assistencias', v => `${v} assist.`)),
      mk('participacoesGols', Object.values(stats)
        .map((s: any) => ({ nome: s.nome, total: (s.gols || 0) + (s.assistencias || 0) }))
        .sort((a, b) => b.total - a.total)
        .map((s, i) => ({ posicao: i + 1, nome: s.nome, valor: `${s.total}` }))),
      mk('vitorioso', byVal('vitorias', v => `${v} vitórias`)),
      mk('derrotas', byVal('derrotas', v => `${v} derrotas`)),
      mk('soDerrota', soDerrota),
      mk('naoPerdi', invicto),
      mk('bolaMurcha', bolaMurcha),
      mk('carregouTime', carregouTime),
      mk('mvp', byVal('mvp', v => `${v} MVP`)),
      mk('deiteiRolei', byVal('deiteiRolei', v => `${v} vezes`)),
      mk('hatTricks', Object.entries(hatTricks).sort(([, a], [, b]) => b - a).map(([nome, count], i) => ({ posicao: i + 1, nome, valor: `${count}x` }))),
      mk('semSofrer', (() => {
        const r: any[] = [];
        Object.values(stats).forEach((s: any) => {
          let cnt = 0;
          jogosFiltrados.forEach(j => {
            const todos = [...j.time_a, ...j.time_b];
            const id = todos.find(id => buscarJogador(id) === s.nome);
            if (!id) return;
            const noA = j.time_a.includes(id);
            if ((noA && j.placar_b === 0) || (!noA && j.placar_a === 0)) cnt++;
          });
          if (cnt > 0) r.push({ nome: s.nome, cnt });
        });
        return r.sort((a, b) => b.cnt - a.cnt).map((x, i) => ({ posicao: i + 1, nome: x.nome, valor: `${x.cnt}` }));
      })()),
      mk('reiPelada', Object.values(stats)
        .map((s: any) => ({
          nome: s.nome,
          pts: calcularPontosEstatisticas({
            vitorias: s.vitorias,
            derrotas: s.derrotas,
            empates: s.empates,
            gols: s.gols,
            golsContra: s.golsContra || 0,
            assistencias: s.assistencias,
            cleanSheets: s.cleanSheets || 0,
          }, pontuacaoEstatisticas)
        }))
        .sort((a, b) => b.pts - a.pts).map((s, i) => ({ posicao: i + 1, nome: s.nome, valor: s.pts.toFixed(1) }))),
      mk('nota', Object.entries(notasPor)
        .map(([nome, d]) => ({ nome, media: d.count > 0 ? d.total / d.count : 0 }))
        .sort((a, b) => b.media - a.media)
        .map((s, i) => ({ posicao: i + 1, nome: s.nome, valor: s.media.toFixed(1) }))),
      mk('mediaGols', Object.values(stats)
        .map((s: any) => ({ nome: s.nome, media: s.jogos > 0 ? s.gols / s.jogos : 0 }))
        .sort((a, b) => b.media - a.media)
        .map((s, i) => ({ posicao: i + 1, nome: s.nome, valor: s.media.toFixed(2) }))),
      mk('decisivo', (() => {
        const decisivos: { [nome: string]: number } = {};
        Object.values(stats).forEach((s: any) => {
          let golsDecisivos = 0;
          jogosFiltrados.forEach((jogo: any) => {
            const todosIds = [...jogo.time_a, ...jogo.time_b];
            const jogadorId = todosIds.find(id => buscarJogador(id) === s.nome);
            if (!jogadorId) return;
            const noTimeA = jogo.time_a.includes(jogadorId);
            const venceu = (noTimeA && jogo.placar_a > jogo.placar_b) || (!noTimeA && jogo.placar_b > jogo.placar_a);
            if (venceu) {
              const golsNoJogo = (jogo.gols || []).filter((g: any) => buscarJogador(g.jogador_id) === s.nome).length;
              golsDecisivos += golsNoJogo;
            }
          });
          if (golsDecisivos > 0) decisivos[s.nome] = golsDecisivos;
        });
        return Object.entries(decisivos).sort(([, a], [, b]) => b - a).map(([nome, valor], i) => ({ posicao: i + 1, nome, valor: `${valor}` }));
      })()),
      mk('fominha', Object.values(stats)
        .filter((s: any) => s.jogos > 0)
        .sort((a: any, b: any) => b.jogos - a.jogos)
        .map((s: any, i) => ({ posicao: i + 1, nome: s.nome, valor: `${s.jogos}x` }))),
    ]);
  };

  const calcularEstatisticasJogador = (nomeJogador: string) => {
    if (!nomeJogador || jogosFiltrados.length === 0) return null;
    const stats = {
      nome: nomeJogador, jogos: 0, vitorias: 0, derrotas: 0, empates: 0,
      gols: 0, golsContra: 0, assistencias: 0, mvps: 0, hatTricks: 0, semSofrerGols: 0,
      aproveitamento: '0%', mediaGols: '0.00',
      detalhesJogos: [] as Array<{ resultado: 'vitoria' | 'empate' | 'derrota'; gols: number; assistencias: number; mvp: boolean; deiteiERolei: boolean; hatTrick: boolean; semSofrer: boolean }>
    };

    jogosFiltrados.forEach(jogo => {
      const todos = [...jogo.time_a, ...jogo.time_b];
      const jId = todos.find(id => buscarJogador(id) === nomeJogador);
      if (!jId) return;
      stats.jogos++;
      const noA = jogo.time_a.some(id => buscarJogador(id) === nomeJogador);
      let resultado: 'vitoria' | 'empate' | 'derrota' = 'derrota';
      let ganhou = false;
      if (jogo.placar_a === jogo.placar_b) { stats.empates++; resultado = 'empate'; }
      else if ((noA && jogo.placar_a > jogo.placar_b) || (!noA && jogo.placar_b > jogo.placar_a)) { stats.vitorias++; resultado = 'vitoria'; ganhou = true; }
      else { stats.derrotas++; }

      const gj = (jogo.gols || []).filter(g => buscarJogador(g.jogador_id) === nomeJogador).length;
      const gc = (jogo.gols || []).filter(
        g => g.jogador_id === 'gol_contra' && g.gol_contra_jogador_id && buscarJogador(g.gol_contra_jogador_id) === nomeJogador
      ).length;
      const aj = (jogo.assistencias || []).filter(a => buscarJogador(a.jogador_id) === nomeJogador).length;
      const hatTrick = gj >= 3 || aj >= 3;
      const mvp = ganhou && (gj > 0 || aj > 0);
      const deiteiERolei = ganhou && gj > 0 && aj > 0;
      const semSofrer = (noA && jogo.placar_b === 0) || (!noA && jogo.placar_a === 0);

      if (hatTrick) stats.hatTricks++;
      if (mvp) stats.mvps++;
      if (semSofrer) stats.semSofrerGols++;
      stats.gols += gj; stats.golsContra += gc; stats.assistencias += aj;
      stats.detalhesJogos.push({ resultado, gols: gj, assistencias: aj, mvp, deiteiERolei, hatTrick, semSofrer });
    });

    if (stats.jogos > 0) {
      const pts = stats.vitorias * 3 + stats.empates;
      stats.aproveitamento = `${((pts / (stats.jogos * 3)) * 100).toFixed(1)}%`;
      stats.mediaGols = (stats.gols / stats.jogos).toFixed(2);
    }
    return stats;
  };

  const getRanking = (id: string) => rankings.find(r => r.id === id)?.ranking || [];
  const posicao = (id: string, nome: string) => { const idx = getRanking(id).findIndex(r => r.nome === nome); return idx >= 0 ? idx + 1 : 0; };

  const labelFiltro = () => {
    if (dataSelecionada) return `Pelada: ${dataSelecionada}`;
    if (filtro === 'atual') return 'Pelada mais recente';
    if (filtro === 'ultimas') return `Últimas ${quantidadePeladas} peladas`;
    if (filtro === 'historia') return 'Histórico completo';
    if (filtro === 'mes') return periodoSelecionado || 'Todos os meses';
    if (filtro === 'ano') return periodoSelecionado || 'Todos os anos';
    return '';
  };

  const jogadoresDisponiveis = Array.from(new Set(
    jogosFiltrados
      .flatMap((jogo) => [...jogo.time_a, ...jogo.time_b])
      .filter((jogadorId) => ehJogadorAtivo(jogadorId))
      .map((id) => buscarJogador(id))
  ))
    .filter((nome) => nome && nome.length > 0)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));

  useEffect(() => {
    if (jogadorSelecionado && !jogadoresDisponiveis.includes(jogadorSelecionado)) {
      setJogadorSelecionado(null);
    }
  }, [jogadorSelecionado, jogadoresDisponiveis]);

  if (loadingPermissoes || loading) {
    return (
      <Layout title="Individual">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-5xl mb-4">👤</div>
            <div className="text-gray-600">Carregando...</div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Individual">
      <div className="max-w-4xl mx-auto px-2 py-3">
        <StatsFilterPanel
          filtro={filtro}
          setFiltro={setFiltro}
          dataSelecionada={dataSelecionada}
          setDataSelecionada={setDataSelecionada}
          periodoSelecionado={periodoSelecionado}
          setPeriodoSelecionado={setPeriodoSelecionado}
          quantidadePeladas={quantidadePeladas}
          setQuantidadePeladas={setQuantidadePeladas}
          apenasAtivos={apenasAtivos}
          setApenasAtivos={setApenasAtivos}
          datasDisponiveis={datasDisponiveis}
          mesesDisponiveis={mesesDisponiveis}
          anosDisponiveis={anosDisponiveis}
        />

        {/* Lista de Jogadores */}
        <section className="bg-white rounded-lg shadow-sm p-3 mb-4 border border-gray-200">
          <h3 className="text-base font-bold text-gray-800 mb-2">👤 Selecionar Jogador</h3>
          {jogadoresDisponiveis.length > 0 ? (
            <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
              {jogadoresDisponiveis.map((nome) => (
                <button
                  key={nome}
                  onClick={() => setJogadorSelecionado(nome)}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    jogadorSelecionado === nome
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'bg-white text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  {nome}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg px-3 py-3">
              Nenhum jogador disponível neste filtro.
            </div>
          )}
          <div className="mt-2 text-[11px] text-gray-500">Lista baseada no filtro atual.</div>
        </section>

        {/* Stats do jogador selecionado */}
        {jogadorSelecionado && (() => {
          const stats = calcularEstatisticasJogador(jogadorSelecionado);
          if (!stats) return null;

          const totalJogos = jogosFiltrados.length;
          const pontosRei = getRanking('reiPelada').find(r => r.nome === stats.nome)?.valor || '';
          const posRei = posicao('reiPelada', stats.nome);
          const vezesInvicto = getRanking('naoPerdi').find(r => r.nome === stats.nome)?.valor || '0x';
          const posInvicto = posicao('naoPerdi', stats.nome);
          const vezesBolaMurcha = getRanking('bolaMurcha').find(r => r.nome === stats.nome)?.valor || '0x';
          const posBolaMurcha = posicao('bolaMurcha', stats.nome);
          const jogadorData = Object.values(jogadores).find(j => (j.apelido || j.nome) === stats.nome);
          const estrelas = jogadorData?.nivel || 0;
          const fotoUrl = jogadorData?.foto_url;
          const derrotasSemVitoria = stats.detalhesJogos.filter(j => j.resultado === 'derrota').length;
          const empatesSemVitoria = stats.detalhesJogos.filter(j => j.resultado === 'empate').length;
          const golsSemVitoria = stats.detalhesJogos
            .filter(j => j.resultado !== 'vitoria')
            .reduce((acc, j) => acc + j.gols, 0);
          const assistenciasSemVitoria = stats.detalhesJogos
            .filter(j => j.resultado !== 'vitoria')
            .reduce((acc, j) => acc + j.assistencias, 0);

          return (
            <div className="mb-4">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg py-3 px-4 mb-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl font-black text-white leading-tight">{stats.nome}</h3>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {estrelas > 0 ? Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} className={`text-lg ${i < estrelas ? 'text-yellow-300' : 'text-blue-200'}`}>★</span>
                    )) : <span className="text-xs text-blue-100">Sem classificação</span>}
                  </div>
                </div>
              </div>

              {/* Badge filtro */}
              <div className="w-full bg-blue-600 rounded-lg px-4 py-1.5 flex items-center justify-center gap-2 shadow-sm mb-3">
                <span className="text-white text-xs font-bold">{labelFiltro()}</span>
              </div>

              {/* Linha 1: Jogos, Vitórias, Empates, Derrotas */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="bg-blue-50 p-2 rounded text-center flex flex-col justify-center min-h-[60px] border border-blue-200">
                  <div className="text-[11px] font-bold text-gray-600 leading-tight">JOGOS</div>
                  <div className="text-lg font-black text-blue-700">{stats.jogos}</div>
                </div>
                <div className="bg-green-50 p-2 rounded text-center flex flex-col justify-center min-h-[60px] border border-green-200">
                  <div className="text-[11px] font-bold text-gray-600 leading-tight">VITÓRIAS</div>
                  <div className="text-lg font-black text-green-700">{stats.vitorias}</div>
                </div>
                <div className="bg-yellow-50 p-2 rounded text-center flex flex-col justify-center min-h-[60px] border border-yellow-200">
                  <div className="text-[11px] font-bold text-gray-600 leading-tight">EMPATES</div>
                  <div className="text-lg font-black text-yellow-700">{stats.empates}</div>
                </div>
                <div className="bg-red-50 p-2 rounded text-center flex flex-col justify-center min-h-[60px] border border-red-200">
                  <div className="text-[11px] font-bold text-gray-600 leading-tight">DERROTAS</div>
                  <div className="text-lg font-black text-red-700">{stats.derrotas}</div>
                </div>
              </div>

              {/* Aproveitamento geral em % */}
              {(() => {
                const aproveitamento = stats.jogos > 0 ? ((stats.vitorias * 3 + stats.empates) / (stats.jogos * 3)) * 100 : 0;
                const percentual = Number.isFinite(aproveitamento) ? aproveitamento : 0;
                const totalSegundosJogados = jogosFiltrados.reduce((acc, jogo) => {
                  const todos = [...jogo.time_a, ...jogo.time_b];
                  const jId = todos.find(id => buscarJogador(id) === stats.nome);
                  if (!jId) return acc;
                  return acc + calcularDuracaoJogoSegundos(jogo);
                }, 0);
                const minutosJogados = Math.floor(totalSegundosJogados / 60);

                return (
                  <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-2 mb-3">
                    <div className="rounded-lg border border-emerald-200 bg-gradient-to-r from-emerald-50 to-lime-50 shadow-sm p-2">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="text-[10px] font-black uppercase tracking-wide text-emerald-700">Aproveitamento</div>
                        <div className="text-base font-black text-emerald-700">{percentual.toFixed(1)}%</div>
                      </div>
                      <div className="h-1.5 w-1/2 overflow-hidden rounded-full bg-emerald-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-600"
                          style={{ width: `${Math.min(100, Math.max(0, percentual))}%` }}
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 shadow-sm p-2 flex flex-col justify-center">
                      <div className="text-[9px] font-black uppercase tracking-wide text-emerald-700 leading-tight text-center">Minutos Jogados</div>
                      <div className="text-lg font-black text-emerald-800 leading-none text-center mt-1">{minutosJogados}</div>
                    </div>
                  </div>
                );
              })()}

              {/* Miolo compacto para print */}
              {(() => {
                const participacoes = stats.gols + stats.assistencias;
                const mediaGols = stats.jogos > 0 ? (stats.gols / stats.jogos) : 0;
                const mediaAssist = stats.jogos > 0 ? (stats.assistencias / stats.jogos) : 0;
                const mediaParticipacoes = stats.jogos > 0 ? (participacoes / stats.jogos) : 0;
                const percentualPresenca = jogosFiltrados.length > 0 ? ((stats.jogos / jogosFiltrados.length) * 100).toFixed(0) : '0';

                let decisivos = 0;
                let jogosComVitoria = 0;
                jogosFiltrados.forEach(jogo => {
                  const todos = [...jogo.time_a, ...jogo.time_b];
                  const jId = todos.find(id => buscarJogador(id) === stats.nome);
                  if (!jId) return;
                  const noA = jogo.time_a.includes(jId);
                  const venceu = (noA && jogo.placar_a > jogo.placar_b) || (!noA && jogo.placar_b > jogo.placar_a);
                  if (!venceu) return;
                  jogosComVitoria++;
                  decisivos += (jogo.gols || []).filter(g => buscarJogador(g.jogador_id) === stats.nome).length;
                });

                const carregou = stats.detalhesJogos
                  .filter(j => j.resultado !== 'vitoria')
                  .reduce((acc, j) => acc + j.gols + j.assistencias, 0);

                let maiorSequenciaInvicta = 0;
                let maiorSeqVitorias = 0;
                let maiorSeqEmpates = 0;
                let seqAtual = 0;
                let seqAtualVitorias = 0;
                let seqAtualEmpates = 0;

                stats.detalhesJogos.forEach((detalhe) => {
                  if (detalhe.resultado === 'derrota') {
                    if (seqAtual > maiorSequenciaInvicta) {
                      maiorSequenciaInvicta = seqAtual;
                      maiorSeqVitorias = seqAtualVitorias;
                      maiorSeqEmpates = seqAtualEmpates;
                    }
                    seqAtual = 0;
                    seqAtualVitorias = 0;
                    seqAtualEmpates = 0;
                    return;
                  }

                  seqAtual++;
                  if (detalhe.resultado === 'vitoria') seqAtualVitorias++;
                  if (detalhe.resultado === 'empate') seqAtualEmpates++;
                });

                if (seqAtual > maiorSequenciaInvicta) {
                  maiorSequenciaInvicta = seqAtual;
                  maiorSeqVitorias = seqAtualVitorias;
                  maiorSeqEmpates = seqAtualEmpates;
                }

                const cards = [
                  { id: 'gols', emoji: '⚽', titulo: 'Gols', valor: String(stats.gols), sub: `Media ${mediaGols.toFixed(2)} por partida`, sub2: `Em ${stats.jogos} jogos`, tone: 'positivo' },
                  { id: 'assist', emoji: '👟', titulo: 'Assistencias', valor: String(stats.assistencias), sub: `Media ${mediaAssist.toFixed(2)} por partida`, sub2: `Em ${stats.jogos} jogos`, tone: 'positivo' },
                  { id: 'part', emoji: '🥅', titulo: 'Participacoes em gols', valor: String(participacoes), sub: `Media ${mediaParticipacoes.toFixed(2)} por partida`, tone: 'positivo' },
                  { id: 'dec', emoji: '🎯', titulo: 'Gols decisivos', valor: String(decisivos), sub: `Gols que deram a vitoria em ${decisivos} de ${jogosComVitoria} jogos`, tone: 'positivo' },
                  { id: 'seqinv', emoji: '🔥', titulo: 'Maior sequencia invicta', valor: String(maiorSequenciaInvicta), sub: `${maiorSeqVitorias} vitorias e ${maiorSeqEmpates} empates`, tone: 'positivo' },
                  { id: 'carr', emoji: '🚛', titulo: 'Carregou o time', valor: String(carregou), sub: 'Gols + assistencias mesmo sem vitoria', tone: 'neutro' },
                  { id: 'muralha', emoji: '🛡️', titulo: 'Sem sofrer gols', valor: `${stats.semSofrerGols}/${stats.jogos}`, sub: 'Partidas sem sofrer gols', tone: 'positivo' },
                  { id: 'pres', emoji: '⚡', titulo: 'Presenca', valor: `${stats.jogos}/${jogosFiltrados.length}`, sub: `${percentualPresenca}% de presenca`, tone: 'neutro' },
                ];

                return (
                  <>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {cards.map((card) => {
                        const valorClass =
                          card.tone === 'positivo'
                            ? 'text-green-700'
                            : card.tone === 'neutro'
                              ? 'text-amber-600'
                              : 'text-red-700';

                        return (
                        <div
                          key={card.id}
                          className="h-[66px] rounded-lg border border-gray-200 bg-white p-2 shadow-sm flex flex-col justify-between"
                        >
                          <div className="grid grid-cols-[20px_1fr] items-center gap-1.5">
                            <div className="text-base leading-none">
                              {card.emoji}
                            </div>
                            <div className="text-[10px] font-bold uppercase tracking-wide text-gray-700 leading-tight">
                              {card.titulo}
                            </div>
                          </div>
                          <div className="grid grid-cols-[1fr_auto] items-end gap-1.5">
                            <div className="text-[10px] text-gray-600 leading-tight">
                              <div>{card.sub}</div>
                              {card.sub2 && <div>{card.sub2}</div>}
                            </div>
                            <div className={`text-[22px] leading-none font-black ${valorClass}`}>
                              {card.valor}
                            </div>
                          </div>
                        </div>
                      )})}
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="rounded-lg border border-amber-200 bg-amber-50 overflow-hidden">
                        <div className="text-[10px] font-bold text-gray-700 uppercase tracking-wide text-center py-1">MVP</div>
                        <div className="grid grid-cols-2 min-h-[42px]">
                          <div className="flex items-center justify-center text-2xl leading-none">⭐</div>
                          <div className="flex items-center justify-center text-2xl font-black leading-none text-green-700">{stats.mvps}</div>
                        </div>
                      </div>
                      <div className="rounded-lg border border-red-200 bg-red-50 overflow-hidden">
                        <div className="text-[10px] font-bold text-gray-700 uppercase tracking-wide text-center py-1">Gol Contra</div>
                        <div className="grid grid-cols-2 min-h-[42px]">
                          <div className="flex items-center justify-center">
                            <img src={bolaVermelha.src} alt="Gol contra" className="w-5 h-5" />
                          </div>
                          <div className="flex items-center justify-center text-2xl font-black leading-none text-red-700">{stats.golsContra}</div>
                        </div>
                      </div>
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 overflow-hidden">
                        <div className="text-[10px] font-bold text-gray-700 uppercase tracking-wide text-center py-1">Hat-Trick</div>
                        <div className="grid grid-cols-2 min-h-[42px]">
                          <div className="flex items-center justify-center text-2xl leading-none">🎩</div>
                          <div className="flex items-center justify-center text-2xl font-black leading-none text-green-700">{stats.hatTricks}</div>
                        </div>
                      </div>
                    </div>

                    <div className="w-full bg-blue-600 rounded-lg px-4 py-1.5 flex items-center justify-center shadow-sm mb-2">
                      <span className="text-white text-xs font-bold">Posição nos rankings</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {(() => {
                        const rankingCards = [
                          { id: 'reiPelada', titulo: 'Time da Pelada' },
                          { id: 'artilheiro', titulo: 'Artilharia' },
                          { id: 'garcom', titulo: 'Assistências' },
                          { id: 'participacoesGols', titulo: 'Part em Gols' },
                        ];
                        return rankingCards.map((card) => {
                          const ranking = getRanking(card.id);
                          const pos = posicao(card.id, stats.nome);
                          const posFormatada = `${pos > 0 ? `${pos}º` : '0º'}/${ranking.length}`;
                          return (
                            <div key={card.id} className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 shadow-sm flex flex-col items-center justify-center min-h-[66px]">
                              <div className="text-[9px] font-black uppercase tracking-wide text-emerald-700 text-center leading-tight mb-1.5">{card.titulo}</div>
                              <div className="text-base font-black text-emerald-800 leading-none">{posFormatada}</div>
                            </div>
                          );
                        });
                      })()}
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-px bg-gray-300 flex-1" />
                      <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Conexoes e Parcerias</span>
                      <div className="h-px bg-gray-300 flex-1" />
                    </div>
                  </>
                );
              })()}

              {/* Melhores Amigos */}
              {stats.detalhesJogos.length > 0 && (() => {
                // Calcular parceiros e adversários com mais detalhes
                const parceiroStats: { [nome: string]: { victorias: number; empates: number; derrotas: number; gols: number; assistenciasRecebidas: number; assistenciasGivens: number; participacoes: number; partidas: number; semSofrerGols: number } } = {};
                const adversarioStats: { [nome: string]: { victorias: number; derrotas: number; partidas: number } } = {};

                jogosFiltrados.forEach((jogo: any) => {
                  const todos = [...jogo.time_a, ...jogo.time_b];
                  const jId = todos.find(id => buscarJogador(id) === stats.nome);
                  if (!jId) return;

                  const noTimeA = jogo.time_a.includes(jId);
                  const timeJogador = noTimeA ? jogo.time_a : jogo.time_b;
                  const timeAdversario = noTimeA ? jogo.time_b : jogo.time_a;
                  const placarJogador = noTimeA ? jogo.placar_a : jogo.placar_b;
                  const placarAdversario = noTimeA ? jogo.placar_b : jogo.placar_a;
                  const venceu = placarJogador > placarAdversario;
                  const empatou = placarJogador === placarAdversario;
                  const sofreu = placarAdversario === 0;

                  // Parceiros
                  timeJogador.forEach((id: any) => {
                    const nome = buscarJogador(id);
                    if (nome === stats.nome) return;
                    if (!parceiroStats[nome]) parceiroStats[nome] = { victorias: 0, empates: 0, derrotas: 0, gols: 0, assistenciasRecebidas: 0, assistenciasGivens: 0, participacoes: 0, partidas: 0, semSofrerGols: 0 };
                    parceiroStats[nome].partidas++;
                    if (venceu) parceiroStats[nome].victorias++;
                    else if (empatou) parceiroStats[nome].empates++;
                    else parceiroStats[nome].derrotas++;
                    if (sofreu) parceiroStats[nome].semSofrerGols++;
                    const golsParceiro = (jogo.gols || []).filter((g: any) => buscarJogador(g.jogador_id) === nome).length;
                    parceiroStats[nome].gols += golsParceiro;
                    // Assistências: procurar assists que resultaram em gol de stats.nome ou nome
                    const assistPara = (jogo.assistencias || []).filter((a: any) => {
                      // Quem deu a assistência foi stats.nome, quem recebeu foi nome
                      if (buscarJogador(a.jogador_id) !== stats.nome) return false;
                      // Verificar se a assistência foi para um gol de 'nome'
                      const golAssistido = (jogo.gols || []).find((g: any) => g.id === a.gol_id);
                      return golAssistido && buscarJogador(golAssistido.jogador_id) === nome;
                    }).length;
                    const assistDe = (jogo.assistencias || []).filter((a: any) => {
                      // Quem deu a assistência foi nome, quem recebeu foi stats.nome
                      if (buscarJogador(a.jogador_id) !== nome) return false;
                      // Verificar se a assistência foi para um gol de stats.nome
                      const golAssistido = (jogo.gols || []).find((g: any) => g.id === a.gol_id);
                      return golAssistido && buscarJogador(golAssistido.jogador_id) === stats.nome;
                    }).length;
                    parceiroStats[nome].assistenciasRecebidas += assistDe;
                    parceiroStats[nome].assistenciasGivens += assistPara;
                    parceiroStats[nome].participacoes += golsParceiro + assistDe + assistPara;
                  });

                  // Adversários
                  timeAdversario.forEach((id: any) => {
                    const nome = buscarJogador(id);
                    if (!adversarioStats[nome]) adversarioStats[nome] = { victorias: 0, derrotas: 0, partidas: 0 };
                    adversarioStats[nome].partidas++;
                    if (venceu) adversarioStats[nome].derrotas++;
                    else adversarioStats[nome].victorias++;
                  });
                });

                const melhorAmigo = Object.entries(parceiroStats).sort(([, a], [, b]) => {
                  if (b.victorias !== a.victorias) return b.victorias - a.victorias;
                  if (b.participacoes !== a.participacoes) return b.participacoes - a.participacoes;
                  if (b.gols !== a.gols) return b.gols - a.gols;
                  return b.partidas - a.partidas;
                })[0];
                const maiorAssistRecebidas = Object.entries(parceiroStats).sort(([, a], [, b]) => b.assistenciasRecebidas - a.assistenciasRecebidas)[0];
                const maiorAssistGivens = Object.entries(parceiroStats).sort(([, a], [, b]) => b.assistenciasGivens - a.assistenciasGivens)[0];
                const maiorParceiroVitorias = Object.entries(parceiroStats).sort(([, a], [, b]) => (b.victorias - b.derrotas) - (a.victorias - a.derrotas))[0];
                const maiorParceiroDerrotas = Object.entries(parceiroStats).sort(([, a], [, b]) => b.derrotas - a.derrotas)[0];
                const maiorAdversarioDerrotas = Object.entries(adversarioStats).sort(([, a], [, b]) => b.derrotas - a.derrotas)[0];
                const maiorAdversarioVitorias = Object.entries(adversarioStats).sort(([, a], [, b]) => b.victorias - a.victorias)[0];

                const totalGolsComMelhorAmigo = melhorAmigo ? melhorAmigo[1].gols : 0;
                const totalAssistMelhorAmigo = melhorAmigo ? (melhorAmigo[1].assistenciasRecebidas + melhorAmigo[1].assistenciasGivens) : 0;

                return (
                  <div className="mt-8">
                    {melhorAmigo && (
                      <div className="mb-8 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div className="w-full">
                            <div className="text-xs font-bold text-green-700 uppercase tracking-wide mb-1">Melhor Amigo</div>
                            <div className="text-lg font-black text-gray-900 mb-2">{melhorAmigo[0]}</div>
                            <div className="text-sm text-gray-700 leading-relaxed">Jogando juntos temos <span className="font-bold text-green-700">{melhorAmigo[1].victorias}V</span> / <span className="font-bold text-green-700">{melhorAmigo[1].empates}E</span> / <span className="font-bold text-red-700">{melhorAmigo[1].derrotas}D</span> + <span className="font-bold text-emerald-600">{totalGolsComMelhorAmigo}</span> gols e <span className="font-bold text-blue-600">{totalAssistMelhorAmigo}</span> assistências, ficamos sem levar gols em <span className="font-bold text-purple-600">{melhorAmigo[1].semSofrerGols}</span> jogos de um total de <span className="font-bold">{melhorAmigo[1].partidas} jogos</span>.</div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className={`${maiorAssistRecebidas?.[1].assistenciasRecebidas > 0 ? 'bg-blue-50' : 'bg-blue-50 opacity-40'} border ${maiorAssistRecebidas?.[1].assistenciasRecebidas > 0 ? 'border-blue-200' : 'border-blue-100'} rounded-lg p-2.5`}>
                        <div className="text-xs font-bold text-blue-700 mb-0.5">Recebo Mais Assistências</div>
                        <div className="text-sm font-black text-gray-900 truncate">{maiorAssistRecebidas?.[1].assistenciasRecebidas > 0 ? maiorAssistRecebidas[0] : '—'}</div>
                        <div className="text-xs text-gray-600 mt-1">{maiorAssistRecebidas ? <><span className="font-bold">{maiorAssistRecebidas[1].assistenciasRecebidas}</span> assistências em <span className="font-bold">{maiorAssistRecebidas[1].partidas} jogos</span></> : '—'}</div>
                      </div>

                      <div className={`${maiorAssistGivens?.[1].assistenciasGivens > 0 ? 'bg-green-50' : 'bg-green-50 opacity-40'} border ${maiorAssistGivens?.[1].assistenciasGivens > 0 ? 'border-green-200' : 'border-green-100'} rounded-lg p-2.5`}>
                        <div className="text-xs font-bold text-green-700 mb-0.5">Gols com minhas assistências</div>
                        <div className="text-sm font-black text-gray-900 truncate">{maiorAssistGivens?.[1].assistenciasGivens > 0 ? maiorAssistGivens[0] : '—'}</div>
                        <div className="text-xs text-gray-600 mt-1">{maiorAssistGivens ? <><span className="font-bold">{maiorAssistGivens[1].assistenciasGivens}</span> assistências em <span className="font-bold">{maiorAssistGivens[1].partidas} jogos</span></> : '—'}</div>
                      </div>

                      <div className={`${maiorParceiroVitorias?.[1].victorias > 0 ? 'bg-purple-50' : 'bg-purple-50 opacity-40'} border ${maiorParceiroVitorias?.[1].victorias > 0 ? 'border-purple-200' : 'border-purple-100'} rounded-lg p-2.5`}>
                        <div className="text-xs font-bold text-purple-700 mb-0.5">Parceiro Vitorioso</div>
                        <div className="text-sm font-black text-gray-900 truncate">{maiorParceiroVitorias?.[1].victorias > 0 ? maiorParceiroVitorias[0] : '—'}</div>
                        <div className="text-xs text-gray-600 mt-1">{maiorParceiroVitorias ? <><span className="font-bold">{maiorParceiroVitorias[1].victorias}</span> vitórias em <span className="font-bold">{maiorParceiroVitorias[1].partidas} jogos</span></> : '—'}</div>
                      </div>

                      <div className={`${maiorParceiroDerrotas?.[1].derrotas > 0 ? 'bg-red-50' : 'bg-red-50 opacity-40'} border ${maiorParceiroDerrotas?.[1].derrotas > 0 ? 'border-red-200' : 'border-red-100'} rounded-lg p-2.5`}>
                        <div className="text-xs font-bold text-red-700 mb-0.5">Parceiro nas Derrotas</div>
                        <div className="text-sm font-black text-gray-900 truncate">{maiorParceiroDerrotas?.[1].derrotas > 0 ? maiorParceiroDerrotas[0] : '—'}</div>
                        <div className="text-xs text-gray-600 mt-1">{maiorParceiroDerrotas ? <><span className="font-bold">{maiorParceiroDerrotas[1].derrotas}</span> derrotas em <span className="font-bold">{maiorParceiroDerrotas[1].partidas} jogos</span></> : '—'}</div>
                      </div>

                      <div className={`${maiorAdversarioDerrotas?.[1].derrotas > 0 ? 'bg-yellow-50' : 'bg-yellow-50 opacity-40'} border ${maiorAdversarioDerrotas?.[1].derrotas > 0 ? 'border-yellow-200' : 'border-yellow-100'} rounded-lg p-2.5`}>
                        <div className="text-xs font-bold text-yellow-700 mb-0.5">Mais Derrotei</div>
                        <div className="text-sm font-black text-gray-900 truncate">{maiorAdversarioDerrotas?.[1].derrotas > 0 ? maiorAdversarioDerrotas[0] : '—'}</div>
                        <div className="text-xs text-gray-600 mt-1">{maiorAdversarioDerrotas ? <>Ganhei <span className="font-bold">{maiorAdversarioDerrotas[1].derrotas}</span> em <span className="font-bold">{maiorAdversarioDerrotas[1].partidas} jogos</span></> : '—'}</div>
                      </div>

                      <div className={`${maiorAdversarioVitorias?.[1].victorias > 0 ? 'bg-orange-50' : 'bg-orange-50 opacity-40'} border ${maiorAdversarioVitorias?.[1].victorias > 0 ? 'border-orange-200' : 'border-orange-100'} rounded-lg p-2.5`}>
                        <div className="text-xs font-bold text-orange-700 mb-0.5">Mais Perdi Para</div>
                        <div className="text-sm font-black text-gray-900 truncate">{maiorAdversarioVitorias?.[1].victorias > 0 ? maiorAdversarioVitorias[0] : '—'}</div>
                        <div className="text-xs text-gray-600 mt-1">{maiorAdversarioVitorias ? <>Perdi <span className="font-bold">{maiorAdversarioVitorias[1].victorias}</span> em <span className="font-bold">{maiorAdversarioVitorias[1].partidas} jogos</span></> : '—'}</div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {!jogadorSelecionado && (
          <div className="text-center py-12 text-gray-400">
            <span className="text-5xl block mb-3">👤</span>
            <p className="text-sm">Selecione um jogador acima para ver as estatísticas individuais</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
