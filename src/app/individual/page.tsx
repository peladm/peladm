'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { getClienteSupabase } from '../../lib/supabase';
import { usePermissions } from '../../lib/usePermissions';
import { buscar_pelada_id } from '../../lib/credenciais';

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
}

interface Gol {
  jogo_id: string;
  jogador_id: string;
  time: 'A' | 'B';
}

interface Assistencia {
  jogo_id: string;
  jogador_id: string;
  time: 'A' | 'B';
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
  const { possuiPermissao, nomePlano, loading: loadingPermissoes } = usePermissions();
  const [loading, setLoading] = useState(true);

  // Dados brutos
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [jogosFiltrados, setJogosFiltrados] = useState<Jogo[]>([]);
  const [jogadores, setJogadores] = useState<{ [id: string]: Jogador }>({});
  const [rankings, setRankings] = useState<EstatisticaRanking[]>([]);

  // Estados para filtros
  const [filtro, setFiltro] = useState<'atual' | 'mes' | 'ultimas' | 'ano' | 'historia'>('atual');
  const [dataSelecionada, setDataSelecionada] = useState('');
  const [datasDisponiveis, setDatasDisponiveis] = useState<string[]>([]);
  const [mesesDisponiveis, setMesesDisponiveis] = useState<string[]>([]);
  const [anosDisponiveis, setAnosDisponiveis] = useState<string[]>([]);
  const [periodoSelecionado, setPeriodoSelecionado] = useState('');
  const [quantidadePeladas, setQuantidadePeladas] = useState('3');

  // Estados de busca do jogador
  const [buscaJogador, setBuscaJogador] = useState('');
  const [jogadorSelecionado, setJogadorSelecionado] = useState<string | null>(null);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.filtro) setFiltro(saved.filtro);
      if (typeof saved.dataSelecionada === 'string') setDataSelecionada(saved.dataSelecionada);
      if (typeof saved.periodoSelecionado === 'string') setPeriodoSelecionado(saved.periodoSelecionado);
      if (typeof saved.quantidadePeladas === 'string') setQuantidadePeladas(saved.quantidadePeladas);
      if (typeof saved.buscaJogador === 'string') setBuscaJogador(saved.buscaJogador);
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
      buscaJogador,
      jogadorSelecionado,
    }));
  }, [filtro, dataSelecionada, periodoSelecionado, quantidadePeladas, buscaJogador, jogadorSelecionado]);

  useEffect(() => {
    if (!loadingPermissoes && !possuiPermissao('verEstatisticas')) {
      alert(`🚫 Estatísticas não disponível no plano ${nomePlano}. Faça upgrade para Gold ou Premium!`);
      router.push('/');
    }
  }, [loadingPermissoes, possuiPermissao, nomePlano, router]);

  useEffect(() => { carregarDados(); }, []);
  useEffect(() => { aplicarFiltro(); }, [filtro, dataSelecionada, periodoSelecionado, quantidadePeladas, jogos]);
  useEffect(() => { calcularRankings(); }, [jogosFiltrados, jogadores]);

  // Fechar sugestões ao clicar fora
  useEffect(() => {
    const handleClickOutside = () => setMostrarSugestoes(false);
    if (mostrarSugestoes) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [mostrarSugestoes]);

  const buscarJogador = (jogadorId: any): string => {
    if (typeof jogadorId === 'object' && jogadorId?.nome) {
      return jogadorId.apelido || jogadorId.nome;
    }
    const idStr = String(jogadorId);
    const jogador = jogadores[idStr];
    if (jogador) return jogador.apelido || jogador.nome;
    return idStr.substring(0, 8);
  };

  const carregarDados = async () => {
    try {
      setLoading(true);
      const peladaId = buscar_pelada_id();
      if (!peladaId) { router.push('/login'); return; }

      const clienteDb = await getClienteSupabase(peladaId);

      const { data: jogosData } = await clienteDb
        .from('jogos')
        .select('*')
        .eq('status', 'finalizado')
        .order('created_at', { ascending: false });

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

        const jogosIds = jogosData.map(j => j.id);
        const { data: golsData } = await clienteDb.from('gols').select('*').in('jogo_id', jogosIds);
        const { data: assistenciasData } = await clienteDb.from('assistencias').select('*').in('jogo_id', jogosIds);

        setJogos(jogosData.map(jogo => ({
          ...jogo,
          gols: (golsData || []).filter(g => g.jogo_id === jogo.id),
          assistencias: (assistenciasData || []).filter(a => a.jogo_id === jogo.id),
        })));
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
        filtered = jogos.filter(j => new Date(j.created_at).getFullYear().toString() === periodoSelecionado);
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
        if (!stats[nome]) stats[nome] = { nome, jogos: 0, vitorias: 0, derrotas: 0, empates: 0, gols: 0, assistencias: 0, mvp: 0, deiteiRolei: 0 };
        stats[nome].jogos++;
        const noTimeA = jogo.time_a.includes(jogadorId);
        if (jogo.placar_a === jogo.placar_b) stats[nome].empates++;
        else if ((noTimeA && jogo.placar_a > jogo.placar_b) || (!noTimeA && jogo.placar_b > jogo.placar_a)) stats[nome].vitorias++;
        else stats[nome].derrotas++;
      });
      (jogo.gols || []).forEach(g => { const n = buscarJogador(g.jogador_id); if (stats[n]) stats[n].gols++; });
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
          assistencias: number;
        };
      } = {};

      jogosSessao.forEach((jogo) => {
        [...jogo.time_a, ...jogo.time_b].forEach((jogadorId) => {
          const nome = buscarJogador(jogadorId);
          if (!statsSessao[nome]) {
            statsSessao[nome] = { jogos: 0, vitorias: 0, derrotas: 0, empates: 0, gols: 0, assistencias: 0 };
          }

          statsSessao[nome].jogos++;

          const noTimeA = jogo.time_a.includes(jogadorId);
          if (jogo.placar_a === jogo.placar_b) statsSessao[nome].empates++;
          else if ((noTimeA && jogo.placar_a > jogo.placar_b) || (!noTimeA && jogo.placar_b > jogo.placar_a)) statsSessao[nome].vitorias++;
          else statsSessao[nome].derrotas++;
        });

        (jogo.gols || []).forEach((g) => {
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
          pontos: s.vitorias + s.gols * 0.5 + s.assistencias * 0.5 + s.empates * 0.5 - s.derrotas * 0.5,
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
        .map((s: any) => ({ nome: s.nome, pts: s.vitorias + s.gols * 0.5 + s.assistencias * 0.5 + s.empates * 0.5 - s.derrotas * 0.5 }))
        .sort((a, b) => b.pts - a.pts).map((s, i) => ({ posicao: i + 1, nome: s.nome, valor: s.pts.toFixed(1) }))),
      mk('nota', Object.entries(notasPor)
        .map(([nome, d]) => ({ nome, media: d.count > 0 ? d.total / d.count : 0 }))
        .sort((a, b) => b.media - a.media)
        .map((s, i) => ({ posicao: i + 1, nome: s.nome, valor: s.media.toFixed(1) }))),
      mk('mediaGols', Object.values(stats)
        .map((s: any) => ({ nome: s.nome, media: s.jogos > 0 ? s.gols / s.jogos : 0 }))
        .sort((a, b) => b.media - a.media)
        .map((s, i) => ({ posicao: i + 1, nome: s.nome, valor: s.media.toFixed(2) }))),
    ]);
  };

  const calcularEstatisticasJogador = (nomeJogador: string) => {
    if (!nomeJogador || jogosFiltrados.length === 0) return null;
    const stats = {
      nome: nomeJogador, jogos: 0, vitorias: 0, derrotas: 0, empates: 0,
      gols: 0, assistencias: 0, mvps: 0, hatTricks: 0, semSofrerGols: 0,
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
      const aj = (jogo.assistencias || []).filter(a => buscarJogador(a.jogador_id) === nomeJogador).length;
      const hatTrick = gj >= 3 || aj >= 3;
      const mvp = ganhou && (gj > 0 || aj > 0);
      const deiteiERolei = ganhou && gj > 0 && aj > 0;
      const semSofrer = (noA && jogo.placar_b === 0) || (!noA && jogo.placar_a === 0);

      if (hatTrick) stats.hatTricks++;
      if (mvp) stats.mvps++;
      if (semSofrer) stats.semSofrerGols++;
      stats.gols += gj; stats.assistencias += aj;
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
      <div className="max-w-4xl mx-auto px-4 py-3">
        {/* Filtros */}
        <section className="bg-white rounded-xl shadow-md p-4 mb-4 border border-gray-300">
          <div className="mb-3">
            <button
              onClick={() => { setFiltro('atual'); setDataSelecionada(''); setPeriodoSelecionado(''); }}
              className={`w-full py-2 px-3 rounded-lg text-sm font-semibold transition-colors ${filtro === 'atual' ? 'bg-green-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'}`}
            >
              ⚡ Atual (Pelada mais recente)
            </button>
          </div>
          <div className="mb-3 grid grid-cols-4 gap-2">
            {(['mes', 'ultimas', 'ano', 'historia'] as const).map(f => (
              <button key={f}
                onClick={() => { setFiltro(f); setDataSelecionada(''); setPeriodoSelecionado(''); if (f === 'ultimas') setQuantidadePeladas('3'); }}
                className={`py-2 px-2 rounded-lg text-xs font-semibold transition-colors ${filtro === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'}`}
              >
                {f === 'mes' ? 'Mês' : f === 'ultimas' ? 'Últimas' : f === 'ano' ? 'Ano' : 'História'}
              </button>
            ))}
          </div>
          <div>
            {filtro === 'atual' && (
              <select value={dataSelecionada} onChange={e => setDataSelecionada(e.target.value)} className="w-full py-2 px-3 rounded-lg border border-gray-300 text-sm">
                <option value="">🔍 Selecionar pelada específica</option>
                {datasDisponiveis.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            )}
            {filtro === 'mes' && (
              <select value={periodoSelecionado} onChange={e => setPeriodoSelecionado(e.target.value)} className="w-full py-2 px-3 rounded-lg border border-gray-300 text-sm">
                <option value="">📅 Selecionar mês específico</option>
                {mesesDisponiveis.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            )}
            {filtro === 'ultimas' && (
              <select value={quantidadePeladas} onChange={e => setQuantidadePeladas(e.target.value)} className="w-full py-2 px-3 rounded-lg border border-gray-300 text-sm">
                {['2', '3', '4', '5'].map(n => <option key={n} value={n}>📊 Últimas {n} peladas</option>)}
              </select>
            )}
            {filtro === 'ano' && (
              <select value={periodoSelecionado} onChange={e => setPeriodoSelecionado(e.target.value)} className="w-full py-2 px-3 rounded-lg border border-gray-300 text-sm">
                <option value="">📅 Selecionar ano específico</option>
                {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            )}
          </div>
        </section>

        {/* Campo de Busca */}
        <section className="bg-white rounded-lg shadow-sm p-4 mb-4 border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-3">🔍 Buscar Jogador</h3>
          <div className="relative" onClick={e => e.stopPropagation()}>
            <input
              type="text"
              value={buscaJogador}
              onChange={e => { setBuscaJogador(e.target.value); setMostrarSugestoes(true); setJogadorSelecionado(null); }}
              onFocus={() => setMostrarSugestoes(true)}
              placeholder="Digite o nome do jogador..."
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {mostrarSugestoes && buscaJogador && (() => {
              const nomes = Array.from(new Set(
                Object.values(jogadores).map(j => j.apelido || j.nome)
                  .filter(n => n.toLowerCase().includes(buscaJogador.toLowerCase()))
              )).slice(0, 10);
              return (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-sm max-h-48 overflow-y-auto">
                  {nomes.length > 0 ? nomes.map((n, i) => (
                    <button key={`${n}-${i}`}
                      onClick={() => { setBuscaJogador(n); setJogadorSelecionado(n); setMostrarSugestoes(false); }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    >
                      <span className="text-gray-800">{n}</span>
                    </button>
                  )) : (
                    <div className="px-4 py-3 text-gray-500 text-sm">Nenhum jogador encontrado</div>
                  )}
                </div>
              );
            })()}
          </div>
        </section>

        {/* Stats do jogador selecionado */}
        {jogadorSelecionado && (() => {
          const stats = calcularEstatisticasJogador(jogadorSelecionado);
          if (!stats) return null;

          const totalJogos = jogosFiltrados.length;
          const notaJogador = getRanking('nota').find(r => r.nome === stats.nome)?.valor || null;
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
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-24 h-24 rounded-lg overflow-hidden bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-4xl font-bold text-blue-700 border-2 border-blue-300 shadow-sm flex-shrink-0">
                    {fotoUrl ? <img src={fotoUrl} alt={stats.nome} className="w-full h-full object-cover" /> : stats.nome.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-gray-800 mb-1 break-words">{stats.nome}</h3>
                    <div className="flex items-center gap-1">
                      {estrelas > 0 ? Array.from({ length: 5 }).map((_, i) => (
                        <span key={i} className={`text-lg ${i < estrelas ? 'text-yellow-500' : 'text-gray-300'}`}>★</span>
                      )) : <span className="text-xs text-gray-400">Sem classificação</span>}
                    </div>
                  </div>
                  <div style={{ width: '72px', height: '96px', flexShrink: 0 }} className="bg-gradient-to-br from-amber-50 to-yellow-100 border-2 border-amber-400 rounded-lg shadow-md flex flex-col items-center justify-center gap-1">
                    <div className="text-xs font-semibold text-amber-700">NOTA</div>
                    <span className="text-2xl font-bold text-amber-600">{notaJogador ?? '--'}</span>
                    <div className="text-[10px] text-amber-600 font-medium">{notaJogador ? 'por pelada' : 'sem dados'}</div>
                  </div>
                </div>
              </div>

              {/* Badge filtro */}
              <div className="w-full bg-blue-600 rounded-lg px-4 py-1.5 flex items-center justify-center gap-2 shadow-sm mb-3">
                <span className="text-white text-xs font-medium">Filtro:</span>
                <span className="text-white text-xs font-bold">{labelFiltro()}</span>
              </div>

              {/* Grid de estatísticas */}
              <div className="grid grid-cols-3 gap-2 text-xs mb-4">
                {[
                  { label: 'Jogos', val: `${stats.jogos} / ${totalJogos}`, bg: 'bg-blue-50', text: 'text-blue-700' },
                  { label: 'Vitórias', val: `${stats.vitorias}${posicao('vitorioso', stats.nome) > 0 ? ` / ${posicao('vitorioso', stats.nome)}º` : ''}`, bg: 'bg-green-50', text: 'text-green-700' },
                  { label: 'Empates', val: `${stats.empates}`, bg: 'bg-yellow-50', text: 'text-yellow-700' },
                  { label: 'Derrotas', val: `${stats.derrotas}${posicao('derrotas', stats.nome) > 0 ? ` / ${posicao('derrotas', stats.nome)}º` : ''}`, bg: 'bg-red-50', text: 'text-red-700' },
                  { label: 'Aproveitamento', val: stats.aproveitamento, bg: 'bg-green-50', text: 'text-green-700' },
                  { label: 'Sem Sofrer Gols', val: `${stats.semSofrerGols}${posicao('semSofrer', stats.nome) > 0 ? ` / ${posicao('semSofrer', stats.nome)}º` : ''}`, bg: 'bg-green-50', text: 'text-green-700' },
                  { label: 'Gols', val: `${stats.gols}${posicao('artilheiro', stats.nome) > 0 ? ` / ${posicao('artilheiro', stats.nome)}º` : ''}`, bg: 'bg-blue-50', text: 'text-blue-700' },
                  { label: 'Média de Gols', val: `${stats.mediaGols}${posicao('mediaGols', stats.nome) > 0 ? ` / ${posicao('mediaGols', stats.nome)}º` : ''}`, bg: 'bg-blue-50', text: 'text-blue-700' },
                  { label: 'Assistências', val: `${stats.assistencias}${posicao('garcom', stats.nome) > 0 ? ` / ${posicao('garcom', stats.nome)}º` : ''}`, bg: 'bg-blue-50', text: 'text-blue-700' },
                  { label: 'Hat-trick', val: `${stats.hatTricks}${posicao('hatTricks', stats.nome) > 0 ? ` / ${posicao('hatTricks', stats.nome)}º` : ''}`, bg: 'bg-green-50', text: 'text-green-700' },
                  { label: 'Invicto', val: `${vezesInvicto}${posInvicto > 0 ? ` / ${posInvicto}º` : ''}`, bg: 'bg-orange-50', text: 'text-orange-700' },
                  { label: 'Bola Murcha', val: `${vezesBolaMurcha}${posBolaMurcha > 0 ? ` / ${posBolaMurcha}º` : ''}`, bg: 'bg-red-50', text: 'text-red-700' },
                ].map((item, i) => (
                  <div key={i} className={`${item.bg} p-3 rounded text-center flex flex-col justify-center min-h-[72px]`}>
                    <div className="text-gray-600 mb-0.5">{item.label}</div>
                    <div className={`text-lg font-bold ${item.text}`}>{item.val}</div>
                  </div>
                ))}
                <div className="col-span-3 grid grid-cols-2 gap-2">
                  <div className="bg-orange-50 p-3 rounded text-center flex flex-col justify-center min-h-[72px]">
                    <div className="text-gray-600 mb-0.5">MVPs</div>
                    <div className="text-lg font-bold text-orange-700">{stats.mvps}{posicao('mvp', stats.nome) > 0 ? ` / ${posicao('mvp', stats.nome)}º` : ''}</div>
                  </div>
                  <div className="bg-orange-50 p-3 rounded text-center flex flex-col justify-center min-h-[72px]">
                    <div className="text-gray-600 mb-1">Participação sem Vitória</div>
                    <div className="text-sm font-bold leading-snug">
                      <span className="text-red-700">{derrotasSemVitoria}D</span>
                      <span className="text-gray-600"> e </span>
                      <span className="text-yellow-600">{empatesSemVitoria}E</span>
                      <span className="text-gray-600"> = </span>
                      <span className="text-green-700">{golsSemVitoria}G</span>
                      <span className="text-gray-600"> e </span>
                      <span className="text-green-700">{assistenciasSemVitoria}A</span>
                    </div>
                  </div>
                </div>
                <div className="bg-yellow-50 p-3 rounded text-center col-span-3 border border-yellow-200 min-h-[72px] flex flex-col justify-center">
                  <div className="text-gray-600 mb-0.5">👑 Rei da Pelada 👑</div>
                  <div className="text-xl font-bold text-yellow-700">{posRei > 0 ? `${posRei}º Lugar com ${pontosRei}` : 'Fora do ranking'}</div>
                </div>
              </div>

              {/* Histórico de partidas */}
              {stats.detalhesJogos.length > 0 && (() => {
                const notaHist = getRanking('nota').find(r => r.nome === stats.nome)?.valor || null;
                return (
                  <div className="mt-8 mb-6">
                    <div className="rounded-lg border border-gray-200 overflow-hidden shadow-sm mb-3">
                      <div className="px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-base">📋</span>
                          <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Histórico de Partidas</h4>
                        </div>
                        <div className="flex gap-2">
                          <span className="w-4 h-4 rounded-full bg-red-500 inline-block shadow-sm"></span>
                          <span className="w-4 h-4 rounded-full bg-yellow-400 inline-block shadow-sm"></span>
                          <span className="w-4 h-4 rounded-full bg-green-500 inline-block shadow-sm"></span>
                        </div>
                      </div>
                      <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 flex items-center justify-center gap-2">
                        <span className="text-gray-700 text-xs font-medium">Filtro:</span>
                        <span className="text-gray-800 text-xs font-bold">{labelFiltro()}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 justify-center">
                      {[...stats.detalhesJogos].reverse().map((jogo, index) => {
                        const numJogo = stats.detalhesJogos.length - index;
                        const bg = jogo.resultado === 'vitoria' ? 'bg-green-500' : jogo.resultado === 'empate' ? 'bg-yellow-400' : 'bg-red-500';
                        const badges: string[] = [];
                        if (jogo.gols > 0) badges.push('⚽'.repeat(jogo.gols));
                        if (jogo.assistencias > 0) badges.push('👟'.repeat(jogo.assistencias));
                        if (jogo.semSofrer) badges.push('🛡️');
                        if (jogo.hatTrick) badges.push('🎩');
                        if (jogo.deiteiERolei) badges.push('🎯');
                        if (jogo.mvp) badges.push('⭐');
                        return (
                          <div key={index} className={`${bg} rounded-lg px-2 py-1.5 flex flex-col items-center min-w-[36px]`} title={`Jogo ${numJogo}`}>
                            <span className="text-white font-bold text-[13px] leading-none">{numJogo}</span>
                            {badges.length > 0 && (
                              <div className="flex flex-wrap justify-center gap-px mt-1">
                                {badges.map((b, i) => <span key={i} className="text-[14px] leading-none">{b}</span>)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600 justify-center">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block"></span>Vitória</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block"></span>Empate</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>Derrota</span>
                      <span>⚽ Gol</span>
                      <span>👟 Assistências</span>
                      <span>🛡️ Sem Sofrer Gols</span>
                      <span>🎩 Hat-trick</span>
                      <span>🎯 Deitei e Rolei</span>
                      <span>⭐ MVP</span>
                    </div>
                  </div>
                );
              })()}

              {/* Resultados dos Jogos */}
              {stats.detalhesJogos.length > 0 && (
                <div className="mt-8">
                  <div className="rounded-lg border border-gray-200 overflow-hidden shadow-sm mb-3">
                    <div className="px-4 py-3 flex items-center justify-between bg-gray-50">
                      <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wide">📊 Resultados dos Jogos</h4>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {jogosFiltrados.map((jogo, index) => {
                      const nomeJogador = stats.nome;
                      const todosIds = [...jogo.time_a, ...jogo.time_b];
                      const jId = todosIds.find(id => buscarJogador(id) === nomeJogador);
                      if (!jId) return null;

                      const emTimeA = jogo.time_a.includes(jId);
                      const timeDoJogador = emTimeA ? 'A' : 'B';
                      const venceu = (timeDoJogador === 'A' && jogo.placar_a > jogo.placar_b) || (timeDoJogador === 'B' && jogo.placar_b > jogo.placar_a);
                      const empatou = jogo.placar_a === jogo.placar_b;

                      // Emojis do jogador pesquisado nessa partida
                      const golsJog = (jogo.gols || []).filter(g => buscarJogador(g.jogador_id) === nomeJogador).length;
                      const assistJog = (jogo.assistencias || []).filter(a => buscarJogador(a.jogador_id) === nomeJogador).length;
                      const hatTrick = golsJog >= 3 || assistJog >= 3;
                      const mvp = venceu && (golsJog > 0 || assistJog > 0);
                      const deiteiERolei = venceu && golsJog > 0 && assistJog > 0;
                      const semSofrer = (emTimeA && jogo.placar_b === 0) || (!emTimeA && jogo.placar_a === 0);
                      const emojisJog: string[] = [];
                      if (golsJog > 0) emojisJog.push('⚽'.repeat(golsJog));
                      if (assistJog > 0) emojisJog.push('👟'.repeat(assistJog));
                      if (semSofrer) emojisJog.push('🛡️');
                      if (hatTrick) emojisJog.push('🎩');
                      if (deiteiERolei) emojisJog.push('🎯');
                      if (mvp) emojisJog.push('⭐');

                      return (
                        <div key={jogo.id} className="pb-4 border-b border-gray-200 last:border-b-0">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-gray-500">Jogo #{jogosFiltrados.length - index}</span>
                            <span className={`text-xs font-bold px-2 py-1 rounded ${venceu ? 'bg-green-100 text-green-700' : empatou ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                              {venceu ? '✅ VITÓRIA' : empatou ? '➖ EMPATE' : '❌ DERROTA'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-2xl font-bold" style={{color: emTimeA ? '#16a34a' : '#9ca3af'}}>{jogo.placar_a}</div>
                            <div className="text-gray-400 font-semibold">VS</div>
                            <div className="text-2xl font-bold" style={{color: !emTimeA ? '#16a34a' : '#9ca3af'}}>{jogo.placar_b}</div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className={`rounded p-2 ${emTimeA ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                              <div className="font-semibold mb-1 text-center text-gray-700">Time 1</div>
                              {jogo.time_a.map((jogadorId, i) => {
                                const nomeJ = buscarJogador(jogadorId);
                                const isDestaque = nomeJ === nomeJogador;
                                const golsJ = (jogo.gols || []).filter(g => g.jogador_id === jogadorId && g.time === 'A').length;
                                return (
                                  <div key={i} className={isDestaque ? 'font-bold text-green-700 bg-green-100 px-1 rounded mb-0.5' : 'text-gray-700 mb-0.5'}>
                                    {nomeJ}{isDestaque
                                      ? (emojisJog.length > 0 ? ` ${emojisJog.join(' ')}` : '')
                                      : (golsJ > 0 ? ` ⚽${golsJ}` : '')}
                                  </div>
                                );
                              })}
                            </div>
                            <div className={`rounded p-2 ${!emTimeA ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                              <div className="font-semibold mb-1 text-center text-gray-700">Time 2</div>
                              {jogo.time_b.map((jogadorId, i) => {
                                const nomeJ = buscarJogador(jogadorId);
                                const isDestaque = nomeJ === nomeJogador;
                                const golsJ = (jogo.gols || []).filter(g => g.jogador_id === jogadorId && g.time === 'B').length;
                                return (
                                  <div key={i} className={isDestaque ? 'font-bold text-green-700 bg-green-100 px-1 rounded mb-0.5' : 'text-gray-700 mb-0.5'}>
                                    {nomeJ}{isDestaque
                                      ? (emojisJog.length > 0 ? ` ${emojisJog.join(' ')}` : '')
                                      : (golsJ > 0 ? ` ⚽${golsJ}` : '')}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {!jogadorSelecionado && (
          <div className="text-center py-12 text-gray-400">
            <span className="text-5xl block mb-3">👤</span>
            <p className="text-sm">Busque um jogador acima para ver as estatísticas individuais</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
