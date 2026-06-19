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
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg p-5 mb-3">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-2xl font-black text-white">{stats.nome}</h3>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {estrelas > 0 ? Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} className={`text-xl ${i < estrelas ? 'text-yellow-300' : 'text-blue-200'}`}>★</span>
                    )) : <span className="text-sm text-blue-100">Sem classificação</span>}
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

              {/* Linha 2: Gols com detalhes */}
              {(() => {
                const particidasComGol = stats.detalhesJogos.filter(j => j.gols > 0).length;
                const mediaGols = stats.jogos > 0 ? stats.gols / stats.jogos : 0;
                const posGols = posicao('artilheiro', stats.nome);
                return (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">⚽</span>
                      <div className="flex-1">
                        <div className="text-sm text-gray-700 leading-tight">
                          <span className="font-black text-gray-900">{stats.gols}</span>
                          <span className="text-gray-600"> gols em </span>
                          <span className="font-black text-gray-900">{stats.jogos}</span>
                          <span className="text-gray-600"> partidas</span>
                        </div>
                        <div className="text-xs text-gray-500 leading-tight">
                          Média: <span className="font-bold text-gray-700">{mediaGols.toFixed(2)}</span> gols por partida
                        </div>
                      </div>
                      {posGols > 0 && (
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 border border-blue-300 flex-shrink-0">
                          <span className="text-xs font-black text-blue-700">{posGols}º</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Linha 3: Assistências com detalhes */}
              {(() => {
                const participacaoComAssist = stats.detalhesJogos.filter(j => j.assistencias > 0).length;
                const mediaAssist = stats.jogos > 0 ? stats.assistencias / stats.jogos : 0;
                const posAssist = posicao('garcom', stats.nome);
                return (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">👟</span>
                      <div className="flex-1">
                        <div className="text-sm text-gray-700 leading-tight">
                          <span className="font-black text-gray-900">{stats.assistencias}</span>
                          <span className="text-gray-600"> assists em </span>
                          <span className="font-black text-gray-900">{stats.jogos}</span>
                          <span className="text-gray-600"> partidas</span>
                        </div>
                        <div className="text-xs text-gray-500 leading-tight">
                          Média: <span className="font-bold text-gray-700">{mediaAssist.toFixed(2)}</span> assists por partida
                        </div>
                      </div>
                      {posAssist > 0 && (
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 border border-blue-300 flex-shrink-0">
                          <span className="text-xs font-black text-blue-700">{posAssist}º</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Linha 4: MVPs com detalhes */}
              {(() => {
                const posMvp = posicao('mvp', stats.nome);
                return (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">⭐</span>
                      <div className="flex-1">
                        <div className="text-sm text-gray-700 leading-tight">
                          <span className="font-black text-gray-900">{stats.mvps}</span>
                          <span className="text-gray-600">/</span>
                          <span className="font-black text-gray-900">{stats.vitorias}</span>
                          <span className="text-gray-600"> vitórias com gol/assist</span>
                        </div>
                      </div>
                      {posMvp > 0 && (
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-yellow-100 border border-yellow-300 flex-shrink-0">
                          <span className="text-xs font-black text-yellow-700">{posMvp}º</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Linha 5: Decisivo */}
              {(() => {
                let decisivos = 0;
                let jogosComVitoria = 0;
                jogosFiltrados.forEach(jogo => {
                  const todos = [...jogo.time_a, ...jogo.time_b];
                  const jId = todos.find(id => buscarJogador(id) === stats.nome);
                  if (!jId) return;
                  const noA = jogo.time_a.includes(jId);
                  const venceu = (noA && jogo.placar_a > jogo.placar_b) || (!noA && jogo.placar_b > jogo.placar_a);
                  if (venceu) {
                    jogosComVitoria++;
                    const gols = (jogo.gols || []).filter(g => buscarJogador(g.jogador_id) === stats.nome).length;
                    decisivos += gols;
                  }
                });
                const posDec = posicao('decisivo', stats.nome);
                return (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🎯</span>
                      <div className="flex-1">
                        <div className="text-sm text-gray-700 leading-tight">
                          <span className="font-black text-gray-900">{decisivos}</span>
                          <span className="text-gray-600"> gols em </span>
                          <span className="font-black text-gray-900">{jogosComVitoria}</span>
                          <span className="text-gray-600"> jogos que deram vitória</span>
                        </div>
                      </div>
                      {posDec > 0 && (
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-100 border border-red-300 flex-shrink-0">
                          <span className="text-xs font-black text-red-700">{posDec}º</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Linha 6: Carregou o Time */}
              {(() => {
                const carregou = stats.detalhesJogos
                  .filter(j => j.resultado !== 'vitoria')
                  .reduce((acc, j) => acc + j.gols + j.assistencias, 0);
                const jogosComContrib = stats.detalhesJogos.filter(j => j.resultado !== 'vitoria' && (j.gols > 0 || j.assistencias > 0)).length;
                const posCarr = posicao('carregouTime', stats.nome);
                return (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🚛</span>
                      <div className="flex-1">
                        <div className="text-sm text-gray-700 leading-tight">
                          <span className="font-black text-gray-900">{carregou}</span>
                          <span className="text-gray-600"> contribuições em </span>
                          <span className="font-black text-gray-900">{stats.jogos}</span>
                          <span className="text-gray-600"> partidas</span>
                        </div>
                      </div>
                      {posCarr > 0 && (
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 border border-blue-300 flex-shrink-0">
                          <span className="text-xs font-black text-blue-700">{posCarr}º</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Linha 7: Muralha com detalhes */}
              {(() => {
                const posMuralha = posicao('semSofrer', stats.nome);
                return (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🛡️</span>
                      <div className="flex-1">
                        <div className="text-sm text-gray-700 leading-tight">
                          <span className="font-black text-gray-900">{stats.semSofrerGols}</span>
                          <span className="text-gray-600">/</span>
                          <span className="font-black text-gray-900">{stats.jogos}</span>
                          <span className="text-gray-600"> partidas sem levar gols</span>
                        </div>
                      </div>
                      {posMuralha > 0 && (
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-100 border border-green-300 flex-shrink-0">
                          <span className="text-xs font-black text-green-700">{posMuralha}º</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Linha 8: Fominha com detalhes */}
              {(() => {
                const posFominha = posicao('fominha', stats.nome);
                const percentualPresenca = stats.jogos > 0 ? ((stats.jogos / jogosFiltrados.length) * 100).toFixed(0) : '0';
                return (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 mb-8">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">⚡</span>
                      <div className="flex-1">
                        <div className="text-sm text-gray-700 leading-tight">
                          <span className="font-black text-gray-900">{stats.jogos}</span>
                          <span className="text-gray-600">/</span>
                          <span className="font-black text-gray-900">{jogosFiltrados.length}</span>
                          <span className="text-gray-600"> partidas jogadas</span>
                        </div>
                        <div className="text-xs text-gray-500 leading-tight">
                          Presença: <span className="font-bold text-gray-700">{percentualPresenca}%</span>
                        </div>
                      </div>
                      {posFominha > 0 && (
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-100 border border-purple-300 flex-shrink-0">
                          <span className="text-xs font-black text-purple-700">{posFominha}º</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Linha 9: Stats únicas - Invicto, Hat-Trick, Rei da Pelada */}
              {(() => {
                const partidasComHatTrick = stats.detalhesJogos.filter(j => j.hatTrick).length;
                return (
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-orange-50 p-3 rounded text-center flex flex-col justify-center min-h-[72px] border border-orange-200">
                      <div className="text-2xl mb-1">🔥</div>
                      <div className="text-xs font-bold text-gray-600">INVICTO</div>
                      <div className="text-lg font-black text-orange-700">{vezesInvicto}</div>
                      <div className="text-[10px] text-gray-500">sessões</div>
                    </div>
                    <div className="bg-green-50 p-3 rounded text-center flex flex-col justify-center min-h-[72px] border border-green-200">
                      <div className="text-2xl mb-1">🎩</div>
                      <div className="text-xs font-bold text-gray-600">HAT-TRICK</div>
                      <div className="text-lg font-black text-green-700">{stats.hatTricks}</div>
                      <div className="text-[10px] text-gray-500">{partidasComHatTrick} {partidasComHatTrick === 1 ? 'partida' : 'partidas'}</div>
                    </div>
                    <div className="bg-yellow-50 p-3 rounded text-center flex flex-col justify-center min-h-[72px] border border-yellow-200">
                      <div className="text-2xl mb-1">👑</div>
                      <div className="text-xs font-bold text-gray-600">REI DA PELADA</div>
                      <div className="text-lg font-black text-yellow-700">{posRei > 0 ? posRei + 'º' : '—'}</div>
                      <div className="text-[10px] text-gray-500">{pontosRei} pontos</div>
                    </div>
                  </div>
                );
              })()}

              {/* Melhores Amigos */}
              {stats.detalhesJogos.length > 0 && (() => {
                // Calcular parceiros e adversários com mais detalhes
                const parceiroStats: { [nome: string]: { victorias: number; empates: number; derrotas: number; gols: number; assistenciasRecebidas: number; assistenciasGivens: number; partidas: number; semSofrerGols: number } } = {};
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
                    if (!parceiroStats[nome]) parceiroStats[nome] = { victorias: 0, empates: 0, derrotas: 0, gols: 0, assistenciasRecebidas: 0, assistenciasGivens: 0, partidas: 0, semSofrerGols: 0 };
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

                const melhorAmigo = Object.entries(parceiroStats).sort(([, a], [, b]) => b.victorias - a.victorias)[0];
                const maiorAssistRecebidas = Object.entries(parceiroStats).sort(([, a], [, b]) => b.assistenciasRecebidas - a.assistenciasRecebidas)[0];
                const maiorAssistGivens = Object.entries(parceiroStats).sort(([, a], [, b]) => b.assistenciasGivens - a.assistenciasGivens)[0];
                const maiorParceiroVitorias = Object.entries(parceiroStats).sort(([, a], [, b]) => (b.victorias - b.derrotas) - (a.victorias - a.derrotas))[0];
                const maiorParceiroDerrotas = Object.entries(parceiroStats).sort(([, a], [, b]) => b.derrotas - a.derrotas)[0];
                const maiorAdversarioDerrotas = Object.entries(adversarioStats).sort(([, a], [, b]) => b.derrotas - a.derrotas)[0];
                const maiorAdversarioVitorias = Object.entries(adversarioStats).sort(([, a], [, b]) => b.victorias - a.victorias)[0];

                const totalGolsComMelhorAmigo = melhorAmigo ? jogosFiltrados.reduce((acc, jogo) => {
                  const todos = [...jogo.time_a, ...jogo.time_b];
                  const jId = todos.find(id => buscarJogador(id) === stats.nome);
                  if (!jId) return acc;
                  const noTimeA = jogo.time_a.includes(jId);
                  const timeJogador = noTimeA ? jogo.time_a : jogo.time_b;
                  if (!timeJogador.some(id => buscarJogador(id) === melhorAmigo[0])) return acc;
                  
                  // Gols com participação mútua: um fez o gol e o outro deu assistência
                  const golsComAssist = (jogo.gols || []).filter((g: any) => {
                    const golPor = buscarJogador(g.jogador_id);
                    // Gol de stats.nome com assistência de melhorAmigo[0]
                    if (golPor === stats.nome) {
                      return (jogo.assistencias || []).some((a: any) => {
                        if (buscarJogador(a.jogador_id) !== melhorAmigo[0]) return false;
                        const golAssistido = (jogo.gols || []).find((gol: any) => gol.id === a.gol_id);
                        return golAssistido && buscarJogador(golAssistido.jogador_id) === stats.nome;
                      });
                    }
                    // Gol de melhorAmigo[0] com assistência de stats.nome
                    if (golPor === melhorAmigo[0]) {
                      return (jogo.assistencias || []).some((a: any) => {
                        if (buscarJogador(a.jogador_id) !== stats.nome) return false;
                        const golAssistido = (jogo.gols || []).find((gol: any) => gol.id === a.gol_id);
                        return golAssistido && buscarJogador(golAssistido.jogador_id) === melhorAmigo[0];
                      });
                    }
                    return false;
                  }).length;
                  
                  return acc + golsComAssist;
                }, 0) : 0;

                const totalAssistMelhorAmigo = melhorAmigo ? jogosFiltrados.reduce((acc, jogo) => {
                  const todos = [...jogo.time_a, ...jogo.time_b];
                  const jId = todos.find(id => buscarJogador(id) === stats.nome);
                  if (!jId) return acc;
                  const noTimeA = jogo.time_a.includes(jId);
                  const timeJogador = noTimeA ? jogo.time_a : jogo.time_b;
                  if (!timeJogador.some(id => buscarJogador(id) === melhorAmigo[0])) return acc;
                  
                  // Assistências com participação mútua: assistência que resultou em gol de um dos dois
                  const assistComGol = (jogo.assistencias || []).filter((a: any) => {
                    const assistPor = buscarJogador(a.jogador_id);
                    // Assistência de stats.nome para gol de melhorAmigo[0]
                    if (assistPor === stats.nome) {
                      return (jogo.gols || []).some((g: any) => {
                        if (buscarJogador(g.jogador_id) !== melhorAmigo[0]) return false;
                        return (jogo.assistencias || []).some((ass: any) => ass.gol_id === g.id && buscarJogador(ass.jogador_id) === stats.nome);
                      });
                    }
                    // Assistência de melhorAmigo[0] para gol de stats.nome
                    if (assistPor === melhorAmigo[0]) {
                      return (jogo.gols || []).some((g: any) => {
                        if (buscarJogador(g.jogador_id) !== stats.nome) return false;
                        return (jogo.assistencias || []).some((ass: any) => ass.gol_id === g.id && buscarJogador(ass.jogador_id) === melhorAmigo[0]);
                      });
                    }
                    return false;
                  }).length;
                  
                  return acc + assistComGol;
                }, 0) : 0;

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
            <p className="text-sm">Busque um jogador acima para ver as estatísticas individuais</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
