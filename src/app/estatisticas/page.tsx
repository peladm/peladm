'use client';

import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { getClienteSupabase } from '../../lib/supabase';
import { buscar_pelada_id } from '../../lib/credenciais';

interface Jogador {
  id: string;
  nome: string;
  gols: number;
  vitorias: number;
  jogos: number;
}

interface RankingItem {
  nome: string;
  valor: number | string;
  detalhes?: string;
}

export default function Estatisticas() {
  const [rankings, setRankings] = useState<{[key: string]: RankingItem[]}>({});
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [rankingSelecionado, setRankingSelecionado] = useState<{titulo: string; emoji: string; dados: RankingItem[]} | null>(null);
  const [busca, setBusca] = useState('');
  const [jogadoresFiltrados, setJogadoresFiltrados] = useState<Jogador[]>([]);
  const [todosJogadores, setTodosJogadores] = useState<Jogador[]>([]);
  const [jogadorSelecionado, setJogadorSelecionado] = useState<Jogador | null>(null);
  const [dadosCompletos, setDadosCompletos] = useState<{jogos: any[], gols: any[], sessoes: any[]}>({jogos: [], gols: [], sessoes: []});
  
  // Estados para comparação
  const [modoComparacao, setModoComparacao] = useState(false);
  const [busca2, setBusca2] = useState('');
  const [jogadoresFiltrados2, setJogadoresFiltrados2] = useState<Jogador[]>([]);
  const [jogador2Selecionado, setJogador2Selecionado] = useState<Jogador | null>(null);

  useEffect(() => {
    carregarEstatisticas();
  }, []);

  function abrirModal(titulo: string, emoji: string, chave: string) {
    setRankingSelecionado({
      titulo,
      emoji,
      dados: rankings[chave] || []
    });
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setRankingSelecionado(null);
  }

  // Função para obter posição do jogador em um ranking
  function obterPosicaoJogador(chaveRanking: string): string | null {
    if (!jogadorSelecionado || !rankings[chaveRanking]) return null;
    const posicao = rankings[chaveRanking].findIndex(item => item.nome === jogadorSelecionado.nome);
    return posicao !== -1 ? `${posicao + 1}º` : null;
  }

  // Função para obter posições de ambos jogadores (comparação)
  function obterPosicoesComparacao(chaveRanking: string): { pos1: string, pos2: string } | null {
    if (!jogadorSelecionado || !jogador2Selecionado || !rankings[chaveRanking]) return null;
    const posicao1 = rankings[chaveRanking].findIndex(item => item.nome === jogadorSelecionado.nome);
    const posicao2 = rankings[chaveRanking].findIndex(item => item.nome === jogador2Selecionado.nome);
    if (posicao1 === -1 || posicao2 === -1) return null;
    return { pos1: `${posicao1 + 1}º`, pos2: `${posicao2 + 1}º` };
  }

  // Filtro de pesquisa
  useEffect(() => {
    if (busca.trim() === '') {
      setJogadoresFiltrados([]);
      return;
    }
    
    const termo = busca.toLowerCase();
    const filtrados = todosJogadores.filter(j => 
      j.nome.toLowerCase().includes(termo)
    ).slice(0, 5); // Limitar a 5 resultados
    
    setJogadoresFiltrados(filtrados);
  }, [busca, todosJogadores]);

  // Filtro de pesquisa jogador 2
  useEffect(() => {
    if (busca2.trim() === '') {
      setJogadoresFiltrados2([]);
      return;
    }
    
    const termo = busca2.toLowerCase();
    const filtrados = todosJogadores.filter(j => 
      j.nome.toLowerCase().includes(termo) && j.id !== jogadorSelecionado?.id
    ).slice(0, 5);
    
    setJogadoresFiltrados2(filtrados);
  }, [busca2, todosJogadores, jogadorSelecionado]);


  // Calcular estatísticas individuais
  function calcularEstatisticasIndividuais(jogador: Jogador) {
    const { jogos, gols, sessoes } = dadosCompletos;
    
    // Helper para verificar se jogador está no time
    const jogadorEstaNoTime = (time: any[]): boolean => {
      if (!time || time.length === 0) return false;
      if (typeof time[0] === 'string') {
        return time.includes(jogador.id) || time.includes(jogador.nome);
      }
      return time.some((p: any) => 
        (typeof p === 'object' && (p.nome === jogador.nome || p.id === jogador.id)) ||
        (typeof p === 'string' && (p === jogador.id || p === jogador.nome))
      );
    };
    
    // Jogos do jogador
    const jogosDoJogador = jogos.filter(jogo => 
      jogadorEstaNoTime(jogo.time_a) || jogadorEstaNoTime(jogo.time_b)
    );
    
    // Sessões em que jogou
    const sessoesJogadas = new Set(jogosDoJogador.map(j => j.sessao_id)).size;
    const totalSessoes = sessoes.length;
    
    // MVP (gol + vitória)
    let mvpCount = 0;
    jogosDoJogador.forEach(jogo => {
      const isTimeA = jogadorEstaNoTime(jogo.time_a);
      const isTimeB = jogadorEstaNoTime(jogo.time_b);
      const fezGol = gols.some(g => g.jogo_id === jogo.id && g.jogador_id === jogador.id);
      if (fezGol) {
        const venceu = (isTimeA && jogo.placar_a > jogo.placar_b) || 
                       (isTimeB && jogo.placar_b > jogo.placar_a);
        if (venceu) mvpCount++;
      }
    });
    
    // Hat-Tricks
    let hatTricksCount = 0;
    jogosDoJogador.forEach(jogo => {
      const golsNoJogo = gols.filter(g => g.jogo_id === jogo.id && g.jogador_id === jogador.id).length;
      if (golsNoJogo >= 3) hatTricksCount++;
    });
    
    // Gols Decisivos
    let decisivosCount = 0;
    jogosDoJogador.forEach(jogo => {
      const diff = Math.abs(jogo.placar_a - jogo.placar_b);
      if (diff !== 1) return;
      const isTimeA = jogadorEstaNoTime(jogo.time_a);
      const isTimeB = jogadorEstaNoTime(jogo.time_b);
      const venceu = (isTimeA && jogo.placar_a > jogo.placar_b) || 
                     (isTimeB && jogo.placar_b > jogo.placar_a);
      if (venceu) {
        const fezGol = gols.some(g => g.jogo_id === jogo.id && g.jogador_id === jogador.id);
        if (fezGol) decisivosCount++;
      }
    });
    
    // Média de gols por jogo
    const mediaGolsJogo = jogador.jogos > 0 ? (jogador.gols / jogador.jogos).toFixed(2) : '0.00';
    
    // Média de gols por sessão
    const mediaGolsSessao = sessoesJogadas > 0 ? (jogador.gols / sessoesJogadas).toFixed(2) : '0.00';
    
    return {
      partidas: jogador.jogos,
      peladas: `${sessoesJogadas}/${totalSessoes}`,
      gols: jogador.gols,
      golsDecisivos: decisivosCount,
      mediaJogo: mediaGolsJogo,
      mediaPelada: mediaGolsSessao,
      hatTricks: hatTricksCount,
      mvp: mvpCount,
      jogosDoJogador // Para calcular últimos jogos
    };
  }

  // Calcular estatísticas de últimos jogos
  function calcularHistoricoJogos(jogador: Jogador) {
    const { jogos, gols } = dadosCompletos;
    
    const jogadorEstaNoTime = (time: any[]): boolean => {
      if (!time || time.length === 0) return false;
      if (typeof time[0] === 'string') {
        return time.includes(jogador.id) || time.includes(jogador.nome);
      }
      return time.some((p: any) => 
        (typeof p === 'object' && (p.nome === jogador.nome || p.id === jogador.id)) ||
        (typeof p === 'string' && (p === jogador.id || p === jogador.nome))
      );
    };
    
    // Jogos do jogador ordenados do mais recente
    const jogosDoJogador = jogos
      .filter(jogo => jogadorEstaNoTime(jogo.time_a) || jogadorEstaNoTime(jogo.time_b))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    // Calcular vitórias, empates, derrotas
    let vitorias = 0, empates = 0, derrotas = 0;
    jogosDoJogador.forEach(jogo => {
      const isTimeA = jogadorEstaNoTime(jogo.time_a);
      if (jogo.placar_a === jogo.placar_b) {
        empates++;
      } else if ((isTimeA && jogo.placar_a > jogo.placar_b) || (!isTimeA && jogo.placar_b > jogo.placar_a)) {
        vitorias++;
      } else {
        derrotas++;
      }
    });
    
    const taxaVitoria = jogosDoJogador.length > 0 ? ((vitorias / jogosDoJogador.length) * 100).toFixed(1) : '0.0';
    
    // Últimos 5 jogos
    const ultimos5 = jogosDoJogador.slice(0, 5).map(jogo => {
      const isTimeA = jogadorEstaNoTime(jogo.time_a);
      const golsJogador = gols.filter(g => g.jogo_id === jogo.id && g.jogador_id === jogador.id).length;
      
      let resultado: 'V' | 'E' | 'D';
      if (jogo.placar_a === jogo.placar_b) {
        resultado = 'E';
      } else if ((isTimeA && jogo.placar_a > jogo.placar_b) || (!isTimeA && jogo.placar_b > jogo.placar_a)) {
        resultado = 'V';
      } else {
        resultado = 'D';
      }
      
      return { resultado, gols: golsJogador };
    });
    
    const aproveitamentoUltimos5 = ultimos5.length > 0 
      ? ((ultimos5.filter(j => j.resultado === 'V').length / ultimos5.length) * 100).toFixed(1)
      : '0.0';
    
    const golsUltimos5 = ultimos5.reduce((sum, j) => sum + j.gols, 0);
    
    // Sequência atual de vitórias
    let seqVitorias = 0;
    for (const jogo of jogosDoJogador) {
      const isTimeA = jogadorEstaNoTime(jogo.time_a);
      const venceu = (isTimeA && jogo.placar_a > jogo.placar_b) || (!isTimeA && jogo.placar_b > jogo.placar_a);
      if (venceu) seqVitorias++;
      else break;
    }
    
    // Sequência atual de derrotas
    let seqDerrotas = 0;
    for (const jogo of jogosDoJogador) {
      const isTimeA = jogadorEstaNoTime(jogo.time_a);
      const perdeu = (isTimeA && jogo.placar_a < jogo.placar_b) || (!isTimeA && jogo.placar_b < jogo.placar_a);
      if (perdeu) seqDerrotas++;
      else break;
    }
    
    // Sequência sem perder
    let seqSemPerder = 0;
    for (const jogo of jogosDoJogador) {
      const isTimeA = jogadorEstaNoTime(jogo.time_a);
      const perdeu = (isTimeA && jogo.placar_a < jogo.placar_b) || (!isTimeA && jogo.placar_b < jogo.placar_a);
      if (!perdeu) seqSemPerder++;
      else break;
    }
    
    // Sequência sem vencer
    let seqSemVencer = 0;
    for (const jogo of jogosDoJogador) {
      const isTimeA = jogadorEstaNoTime(jogo.time_a);
      const venceu = (isTimeA && jogo.placar_a > jogo.placar_b) || (!isTimeA && jogo.placar_b > jogo.placar_a);
      if (!venceu) seqSemVencer++;
      else break;
    }
    
    return {
      vitorias,
      empates,
      derrotas,
      taxaVitoria,
      ultimos5,
      aproveitamentoUltimos5,
      golsUltimos5,
      seqVitorias,
      seqDerrotas,
      seqSemPerder,
      seqSemVencer
    };
  }

  async function carregarEstatisticas() {
    try {
      const clienteDb = await getClienteSupabase();
      if (!clienteDb) return;

      const pelada_id = buscar_pelada_id();
      if (!pelada_id) return;

      // Buscar jogadores com suas estatísticas básicas
      const { data: jogadores, error } = await clienteDb
        .from('jogadores')
        .select('id, nome, gols, vitorias, jogos')
        .eq('pelada_id', pelada_id)
        .gt('jogos', 0);

      if (error || !jogadores) {
        console.error('Erro ao buscar jogadores:', error);
        return;
      }

      // Buscar todas as sessões (não apenas a ativa)
      const { data: sessoes } = await clienteDb
        .from('sessoes')
        .select('id')
        .eq('pelada_id', pelada_id)
        .order('created_at', { ascending: false });

      let todosJogos: any[] = [];
      if (sessoes && sessoes.length > 0) {
        // Buscar jogos de todas as sessões
        const sessaoIds = sessoes.map(s => s.id);
        
        const { data, error: erroJogos } = await clienteDb
          .from('jogos')
          .select('*')
          .in('sessao_id', sessaoIds)
          .order('created_at', { ascending: false });

        if (erroJogos) {
          console.error('Erro ao buscar jogos:', erroJogos);
        } else {
          todosJogos = data || [];
        }
      }

      // Buscar todos os gols (buscar todos e filtrar depois)
      const { data: todosGols } = await clienteDb
        .from('gols')
        .select('*');

      console.log('Jogadores:', jogadores);
      console.log('Total Jogos:', todosJogos?.length);
      console.log('Jogos:', todosJogos);
      console.log('Total Gols:', todosGols?.length);
      console.log('Sample Gol:', todosGols?.[0]);
      console.log('Sample Jogador:', jogadores?.[0]);

      // Armazenar todos os jogadores para pesquisa
      setTodosJogadores(jogadores || []);
      
      // Armazenar dados completos para cálculos individuais
      setDadosCompletos({
        jogos: todosJogos,
        gols: todosGols || [],
        sessoes: sessoes || []
      });

      // Verificar estrutura do jogador_id nos gols
      if (todosGols && todosGols.length > 0) {
        console.log('Todos jogador_id únicos:', [...new Set(todosGols.map(g => g.jogador_id))]);
      }

      const totalJogosPelada = todosJogos?.length || 1;

      // Calcular rankings
      calcularRankings(jogadores, totalJogosPelada, todosJogos || [], todosGols || []);
      
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  }

  function calcularRankings(jogadores: Jogador[], totalJogosPelada: number, jogos: any[], gols: any[]) {
    const novosRankings: {[key: string]: RankingItem[]} = {};

    // Helper: verificar se jogador está no time (aceita array de IDs ou objetos)
    const jogadorEstaNoTime = (time: any[], jogador: Jogador): boolean => {
      if (!time || time.length === 0) return false;
      
      // Se o primeiro elemento é string, é array de IDs
      if (typeof time[0] === 'string') {
        return time.includes(jogador.id) || time.includes(jogador.nome);
      }
      
      // Se não, é array de objetos
      return time.some((p: any) => 
        (typeof p === 'object' && (p.nome === jogador.nome || p.id === jogador.id)) ||
        (typeof p === 'string' && (p === jogador.id || p === jogador.nome))
      );
    };

    // Calcular sessões por jogador
    const totalSessoes = new Set(jogos.map(j => j.sessao_id)).size;
    const sessoesJogadorMap = new Map<string, number>();
    jogadores.forEach(jogador => {
      const jogosDoJogador = jogos.filter(jogo => 
        jogadorEstaNoTime(jogo.time_a, jogador) || jogadorEstaNoTime(jogo.time_b, jogador)
      );
      const sessoesUnicas = new Set(jogosDoJogador.map(j => j.sessao_id)).size;
      sessoesJogadorMap.set(jogador.id, sessoesUnicas);
    });

    // 1. Artilharia
    novosRankings.artilharia = jogadores
      .sort((a, b) => b.gols - a.gols)
      .map(j => ({ nome: j.nome, valor: j.gols, detalhes: 'gols' }));

    // 2. Vitorioso
    novosRankings.vitorioso = jogadores
      .sort((a, b) => b.vitorias - a.vitorias)
      .map(j => ({ nome: j.nome, valor: j.vitorias, detalhes: 'vitórias' }));

    // 6. Média de Gols
    novosRankings.mediaGols = jogadores
      .map(j => ({ ...j, media: j.jogos > 0 ? (j.gols / j.jogos) : 0 }))
      .sort((a, b) => b.media - a.media)
      .map(j => ({ nome: j.nome, valor: j.media.toFixed(2), detalhes: 'gols/jogo' }));

    // 3. Fominha (quem tem mais jogos)
    novosRankings.fominha = jogadores
      .sort((a, b) => b.jogos - a.jogos)
      .map(j => ({ nome: j.nome, valor: j.jogos, detalhes: 'jogos' }));

    // 37. MVP (gol + vitória no mesmo jogo)
    const mvpData = jogadores.map(j => {
      let mvpCount = 0;
      
      console.log(`\n🏆 Calculando MVP para ${j.nome} (ID: ${j.id})`);
      
      jogos.forEach(jogo => {
        const isTimeA = jogadorEstaNoTime(jogo.time_a, j);
        const isTimeB = jogadorEstaNoTime(jogo.time_b, j);
        
        console.log(`  Jogo ${jogo.id?.substring(0, 8)}: TimeA=${isTimeA}, TimeB=${isTimeB}`);
        
        if (!isTimeA && !isTimeB) return;
        
        // Verificar se fez gol nesse jogo
        const golsNoJogo = gols.filter(g => g.jogo_id === jogo.id && g.jogador_id === j.id);
        const fezGol = golsNoJogo.length > 0;
        
        console.log(`    Gols no jogo: ${golsNoJogo.length}`, golsNoJogo);
        console.log(`    Placar: ${jogo.placar_a} x ${jogo.placar_b}`);
        
        if (fezGol) {
          // Verificar se seu time venceu
          const venceu = (isTimeA && jogo.placar_a > jogo.placar_b) || 
                         (isTimeB && jogo.placar_b > jogo.placar_a);
          console.log(`    Venceu: ${venceu}`);
          if (venceu) mvpCount++;
        }
      });
      
      console.log(`  Total MVP: ${mvpCount}`);
      
      return { ...j, mvp: mvpCount };
    });
    novosRankings.mvp = mvpData
      .sort((a, b) => b.mvp - a.mvp)
      .map(j => ({ nome: j.nome, valor: j.mvp, detalhes: 'jogos MVP' }));

    // 18. Hat-Tricks (jogos com 3+ gols)
    const hatTricksData = jogadores.map(j => {
      let hatTricksCount = 0;
      
      jogos.forEach(jogo => {
        const golsNoJogo = gols.filter(g => g.jogo_id === jogo.id && g.jogador_id === j.id).length;
        if (golsNoJogo >= 3) hatTricksCount++;
      });
      
      return { ...j, hatTricks: hatTricksCount };
    });
    novosRankings.hatTricks = hatTricksData
      .sort((a, b) => b.hatTricks - a.hatTricks)
      .map(j => ({ nome: j.nome, valor: j.hatTricks, detalhes: 'hat-tricks' }));

    // 19. Gols Decisivos (gol da vitória por 1 de diferença)
    const golsDecisivosData = jogadores.map(j => {
      let decisivosCount = 0;
      
      jogos.forEach(jogo => {
        const diff = Math.abs(jogo.placar_a - jogo.placar_b);
        if (diff !== 1) return;
        
        const isTimeA = jogadorEstaNoTime(jogo.time_a, j);
        const isTimeB = jogadorEstaNoTime(jogo.time_b, j);
        
        if (!isTimeA && !isTimeB) return;
        
        const venceu = (isTimeA && jogo.placar_a > jogo.placar_b) || 
                       (isTimeB && jogo.placar_b > jogo.placar_a);
        
        if (venceu) {
          // Verificar se fez gol nesse jogo
          const fezGol = gols.some(g => g.jogo_id === jogo.id && g.jogador_id === j.id);
          if (fezGol) decisivosCount++;
        }
      });
      
      return { ...j, decisivos: decisivosCount };
    });
    novosRankings.golsDecisivos = golsDecisivosData
      .sort((a, b) => b.decisivos - a.decisivos)
      .map(j => ({ nome: j.nome, valor: j.decisivos, detalhes: 'gols decisivos' }));

    // 11. Sem Perder (sequência atual sem derrota)
    const semPerderData = jogadores.map(j => {
      let sequencia = 0;
      
      const jogosDoJogador = jogos
        .filter(jogo => jogadorEstaNoTime(jogo.time_a, j) || jogadorEstaNoTime(jogo.time_b, j))
        .sort((a, b) => new Date(b.created_at || b.data).getTime() - new Date(a.created_at || a.data).getTime());
      
      for (const jogo of jogosDoJogador) {
        const isTimeA = jogadorEstaNoTime(jogo.time_a, j);
        const venceu = (isTimeA && jogo.placar_a > jogo.placar_b) || 
                       (!isTimeA && jogo.placar_b > jogo.placar_a);
        const empatou = jogo.placar_a === jogo.placar_b;
        
        if (venceu || empatou) {
          sequencia++;
        } else {
          break;
        }
      }
      
      return { ...j, sequencia };
    });
    novosRankings.semPerder = semPerderData
      .sort((a, b) => b.sequencia - a.sequencia)
      .map(j => ({ nome: j.nome, valor: j.sequencia, detalhes: 'jogos' }));

    // 12. Sem Vencer (sequência atual sem vitória)
    const semVencerData = jogadores.map(j => {
      let sequencia = 0;
      
      const jogosDoJogador = jogos
        .filter(jogo => jogadorEstaNoTime(jogo.time_a, j) || jogadorEstaNoTime(jogo.time_b, j))
        .sort((a, b) => new Date(b.created_at || b.data).getTime() - new Date(a.created_at || a.data).getTime());
      
      for (const jogo of jogosDoJogador) {
        const isTimeA = jogadorEstaNoTime(jogo.time_a, j);
        const venceu = (isTimeA && jogo.placar_a > jogo.placar_b) || 
                       (!isTimeA && jogo.placar_b > jogo.placar_a);
        
        if (!venceu) {
          sequencia++;
        } else {
          break;
        }
      }
      
      return { ...j, sequencia };
    });
    novosRankings.semVencer = semVencerData
      .sort((a, b) => b.sequencia - a.sequencia)
      .map(j => ({ nome: j.nome, valor: j.sequencia, detalhes: 'jogos' }));

    // 7. Taxa de Vitória
    novosRankings.taxaVitoria = jogadores
      .map(j => ({ ...j, taxa: j.jogos > 0 ? (j.vitorias / j.jogos * 100) : 0 }))
      .sort((a, b) => b.taxa - a.taxa)
      .map(j => ({ nome: j.nome, valor: j.taxa.toFixed(1) + '%', detalhes: 'vitórias' }));

    // 28. Presença (% de sessões que participou)
    novosRankings.presenca = jogadores
      .map(j => {
        const sessoesJogadas = sessoesJogadorMap.get(j.id) || 0;
        const percentual = totalSessoes > 0 ? (sessoesJogadas / totalSessoes * 100) : 0;
        return { nome: j.nome, valor: percentual.toFixed(1) + '%', detalhes: `${sessoesJogadas}/${totalSessoes}`, percentual };
      })
      .sort((a, b) => b.percentual - a.percentual)
      .map(({ nome, valor, detalhes }) => ({ nome, valor, detalhes }));

    // 38. Rei da Pelada (Gols + Vitórias)
    novosRankings.reiDaPelada = jogadores
      .map(j => ({ ...j, pontos: j.gols + j.vitorias }))
      .sort((a, b) => b.pontos - a.pontos)
      .map(j => ({ nome: j.nome, valor: j.pontos, detalhes: `${j.gols}G + ${j.vitorias}V` }));

    setRankings(novosRankings);
  }

  if (loading) {
    return (
      <Layout title="Estatísticas">
        <div className="p-4 text-center">
          <p className="text-gray-600">Carregando estatísticas...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Estatísticas">
      <div className="p-4 pb-20">
        <div className="grid grid-cols-2 gap-3">
          {/* Artilharia */}
          <button
            onClick={() => abrirModal('Artilharia', '⚽', 'artilharia')}
            className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow active:scale-95 flex h-16"
          >
            <div className="w-2/5 flex items-center justify-center">
              <span className="text-3xl">⚽</span>
            </div>
            <div className="w-3/5 flex flex-col items-center justify-center border-l border-gray-100">
              <h2 className="text-xs font-bold text-gray-800 text-center">Artilharia</h2>
              {jogador2Selecionado && obterPosicoesComparacao('artilharia') ? (
                <div className="text-xs font-semibold">
                  <span className="text-blue-600">{obterPosicoesComparacao('artilharia')?.pos1}</span>
                  <span className="text-gray-400 mx-1">|</span>
                  <span className="text-orange-600">{obterPosicoesComparacao('artilharia')?.pos2}</span>
                </div>
              ) : obterPosicaoJogador('artilharia') ? (
                <span className="text-xs text-blue-600 font-semibold">{obterPosicaoJogador('artilharia')}</span>
              ) : null}
            </div>
          </button>

          {/* Vitorioso */}
          <button
            onClick={() => abrirModal('Vitorioso', '🏆', 'vitorioso')}
            className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow active:scale-95 flex h-16"
          >
            <div className="w-2/5 flex items-center justify-center">
              <span className="text-3xl">🏆</span>
            </div>
            <div className="w-3/5 flex flex-col items-center justify-center border-l border-gray-100">
              <h2 className="text-xs font-bold text-gray-800 text-center">Vitorioso</h2>
              {jogador2Selecionado && obterPosicoesComparacao('vitorioso') ? (
                <div className="text-xs font-semibold">
                  <span className="text-blue-600">{obterPosicoesComparacao('vitorioso')?.pos1}</span>
                  <span className="text-gray-400 mx-1">|</span>
                  <span className="text-orange-600">{obterPosicoesComparacao('vitorioso')?.pos2}</span>
                </div>
              ) : obterPosicaoJogador('vitorioso') ? (
                <span className="text-xs text-blue-600 font-semibold">{obterPosicaoJogador('vitorioso')}</span>
              ) : null}
            </div>
          </button>

          {/* Média de Gols */}
          <button
            onClick={() => abrirModal('Média de Gols', '📊', 'mediaGols')}
            className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow active:scale-95 flex h-16"
          >
            <div className="w-2/5 flex items-center justify-center">
              <span className="text-3xl">📊</span>
            </div>
            <div className="w-3/5 flex flex-col items-center justify-center border-l border-gray-100">
              <h2 className="text-xs font-bold text-gray-800 text-center">Média de Gols</h2>
              {jogador2Selecionado && obterPosicoesComparacao('mediaGols') ? (
                <div className="text-xs font-semibold">
                  <span className="text-blue-600">{obterPosicoesComparacao('mediaGols')?.pos1}</span>
                  <span className="text-gray-400 mx-1">|</span>
                  <span className="text-orange-600">{obterPosicoesComparacao('mediaGols')?.pos2}</span>
                </div>
              ) : obterPosicaoJogador('mediaGols') ? (
                <span className="text-xs text-blue-600 font-semibold">{obterPosicaoJogador('mediaGols')}</span>
              ) : null}
            </div>
          </button>

          {/* Fominha */}
          <button
            onClick={() => abrirModal('Fominha', '🎮', 'fominha')}
            className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow active:scale-95 flex h-16"
          >
            <div className="w-2/5 flex items-center justify-center">
              <span className="text-3xl">🎮</span>
            </div>
            <div className="w-3/5 flex flex-col items-center justify-center border-l border-gray-100">
              <h2 className="text-xs font-bold text-gray-800 text-center">Fominha</h2>
              {jogador2Selecionado && obterPosicoesComparacao('fominha') ? (
                <div className="text-xs font-semibold">
                  <span className="text-blue-600">{obterPosicoesComparacao('fominha')?.pos1}</span>
                  <span className="text-gray-400 mx-1">|</span>
                  <span className="text-orange-600">{obterPosicoesComparacao('fominha')?.pos2}</span>
                </div>
              ) : obterPosicaoJogador('fominha') ? (
                <span className="text-xs text-blue-600 font-semibold">{obterPosicaoJogador('fominha')}</span>
              ) : null}
            </div>
          </button>

          {/* Rei da Pelada */}
          <button
            onClick={() => abrirModal('Rei da Pelada', '👑', 'reiDaPelada')}
            className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow active:scale-95 flex h-16"
          >
            <div className="w-2/5 flex items-center justify-center">
              <span className="text-3xl">👑</span>
            </div>
            <div className="w-3/5 flex flex-col items-center justify-center border-l border-gray-100">
              <h2 className="text-xs font-bold text-gray-800 text-center">Rei da Pelada</h2>
              {jogador2Selecionado && obterPosicoesComparacao('reiDaPelada') ? (
                <div className="text-xs font-semibold">
                  <span className="text-blue-600">{obterPosicoesComparacao('reiDaPelada')?.pos1}</span>
                  <span className="text-gray-400 mx-1">|</span>
                  <span className="text-orange-600">{obterPosicoesComparacao('reiDaPelada')?.pos2}</span>
                </div>
              ) : obterPosicaoJogador('reiDaPelada') ? (
                <span className="text-xs text-blue-600 font-semibold">{obterPosicaoJogador('reiDaPelada')}</span>
              ) : null}
            </div>
          </button>

          {/* MVP */}
          <button
            onClick={() => abrirModal('MVP', '⭐', 'mvp')}
            className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow active:scale-95 flex h-16"
          >
            <div className="w-2/5 flex items-center justify-center">
              <span className="text-3xl">⭐</span>
            </div>
            <div className="w-3/5 flex flex-col items-center justify-center border-l border-gray-100">
              <h2 className="text-xs font-bold text-gray-800 text-center">MVP</h2>
              {jogador2Selecionado && obterPosicoesComparacao('mvp') ? (
                <div className="text-xs font-semibold">
                  <span className="text-blue-600">{obterPosicoesComparacao('mvp')?.pos1}</span>
                  <span className="text-gray-400 mx-1">|</span>
                  <span className="text-orange-600">{obterPosicoesComparacao('mvp')?.pos2}</span>
                </div>
              ) : obterPosicaoJogador('mvp') ? (
                <span className="text-xs text-blue-600 font-semibold">{obterPosicaoJogador('mvp')}</span>
              ) : null}
            </div>
          </button>

          {/* Hat-Tricks */}
          <button
            onClick={() => abrirModal('Hat-Tricks', '🎩', 'hatTricks')}
            className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow active:scale-95 flex h-16"
          >
            <div className="w-2/5 flex items-center justify-center">
              <span className="text-3xl">🎩</span>
            </div>
            <div className="w-3/5 flex flex-col items-center justify-center border-l border-gray-100">
              <h2 className="text-xs font-bold text-gray-800 text-center">Hat-Tricks</h2>
              {jogador2Selecionado && obterPosicoesComparacao('hatTricks') ? (
                <div className="text-xs font-semibold">
                  <span className="text-blue-600">{obterPosicoesComparacao('hatTricks')?.pos1}</span>
                  <span className="text-gray-400 mx-1">|</span>
                  <span className="text-orange-600">{obterPosicoesComparacao('hatTricks')?.pos2}</span>
                </div>
              ) : obterPosicaoJogador('hatTricks') ? (
                <span className="text-xs text-blue-600 font-semibold">{obterPosicaoJogador('hatTricks')}</span>
              ) : null}
            </div>
          </button>

          {/* Gols Decisivos */}
          <button
            onClick={() => abrirModal('Gols Decisivos', '🎯', 'golsDecisivos')}
            className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow active:scale-95 flex h-16"
          >
            <div className="w-2/5 flex items-center justify-center">
              <span className="text-3xl">🎯</span>
            </div>
            <div className="w-3/5 flex flex-col items-center justify-center border-l border-gray-100">
              <h2 className="text-xs font-bold text-gray-800 text-center">Gols Decisivos</h2>
              {jogador2Selecionado && obterPosicoesComparacao('golsDecisivos') ? (
                <div className="text-xs font-semibold">
                  <span className="text-blue-600">{obterPosicoesComparacao('golsDecisivos')?.pos1}</span>
                  <span className="text-gray-400 mx-1">|</span>
                  <span className="text-orange-600">{obterPosicoesComparacao('golsDecisivos')?.pos2}</span>
                </div>
              ) : obterPosicaoJogador('golsDecisivos') ? (
                <span className="text-xs text-blue-600 font-semibold">{obterPosicaoJogador('golsDecisivos')}</span>
              ) : null}
            </div>
          </button>

          {/* Taxa de Vitória */}
          <button
            onClick={() => abrirModal('Taxa de Vitória', '📈', 'taxaVitoria')}
            className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow active:scale-95 flex h-16"
          >
            <div className="w-2/5 flex items-center justify-center">
              <span className="text-3xl">📈</span>
            </div>
            <div className="w-3/5 flex flex-col items-center justify-center border-l border-gray-100">
              <h2 className="text-xs font-bold text-gray-800 text-center">Taxa de Vitória</h2>
              {jogador2Selecionado && obterPosicoesComparacao('taxaVitoria') ? (
                <div className="text-xs font-semibold">
                  <span className="text-blue-600">{obterPosicoesComparacao('taxaVitoria')?.pos1}</span>
                  <span className="text-gray-400 mx-1">|</span>
                  <span className="text-orange-600">{obterPosicoesComparacao('taxaVitoria')?.pos2}</span>
                </div>
              ) : obterPosicaoJogador('taxaVitoria') ? (
                <span className="text-xs text-blue-600 font-semibold">{obterPosicaoJogador('taxaVitoria')}</span>
              ) : null}
            </div>
          </button>

          {/* Presença */}
          <button
            onClick={() => abrirModal('Presença', '📅', 'presenca')}
            className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow active:scale-95 flex h-16"
          >
            <div className="w-2/5 flex items-center justify-center">
              <span className="text-3xl">📅</span>
            </div>
            <div className="w-3/5 flex flex-col items-center justify-center border-l border-gray-100">
              <h2 className="text-xs font-bold text-gray-800 text-center">Presença</h2>
              {jogador2Selecionado && obterPosicoesComparacao('presenca') ? (
                <div className="text-xs font-semibold">
                  <span className="text-blue-600">{obterPosicoesComparacao('presenca')?.pos1}</span>
                  <span className="text-gray-400 mx-1">|</span>
                  <span className="text-orange-600">{obterPosicoesComparacao('presenca')?.pos2}</span>
                </div>
              ) : obterPosicaoJogador('presenca') ? (
                <span className="text-xs text-blue-600 font-semibold">{obterPosicaoJogador('presenca')}</span>
              ) : null}
            </div>
          </button>

          {/* Sem Perder */}
          <button
            onClick={() => abrirModal('Sem Perder', '🛡️', 'semPerder')}
            className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow active:scale-95 flex h-16"
          >
            <div className="w-2/5 flex items-center justify-center">
              <span className="text-3xl">🛡️</span>
            </div>
            <div className="w-3/5 flex flex-col items-center justify-center border-l border-gray-100">
              <h2 className="text-xs font-bold text-gray-800 text-center">Sem Perder</h2>
              {jogador2Selecionado && obterPosicoesComparacao('semPerder') ? (
                <div className="text-xs font-semibold">
                  <span className="text-blue-600">{obterPosicoesComparacao('semPerder')?.pos1}</span>
                  <span className="text-gray-400 mx-1">|</span>
                  <span className="text-orange-600">{obterPosicoesComparacao('semPerder')?.pos2}</span>
                </div>
              ) : obterPosicaoJogador('semPerder') ? (
                <span className="text-xs text-blue-600 font-semibold">{obterPosicaoJogador('semPerder')}</span>
              ) : null}
            </div>
          </button>

          {/* Sem Vencer */}
          <button
            onClick={() => abrirModal('Sem Vencer', '❌', 'semVencer')}
            className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow active:scale-95 flex h-16"
          >
            <div className="w-2/5 flex items-center justify-center">
              <span className="text-3xl">❌</span>
            </div>
            <div className="w-3/5 flex flex-col items-center justify-center border-l border-gray-100">
              <h2 className="text-xs font-bold text-gray-800 text-center">Sem Vencer</h2>
              {jogador2Selecionado && obterPosicoesComparacao('semVencer') ? (
                <div className="text-xs font-semibold">
                  <span className="text-blue-600">{obterPosicoesComparacao('semVencer')?.pos1}</span>
                  <span className="text-gray-400 mx-1">|</span>
                  <span className="text-orange-600">{obterPosicoesComparacao('semVencer')?.pos2}</span>
                </div>
              ) : obterPosicaoJogador('semVencer') ? (
                <span className="text-xs text-blue-600 font-semibold">{obterPosicaoJogador('semVencer')}</span>
              ) : null}
            </div>
          </button>
        </div>

        {/* Campo de Pesquisa de Jogador */}
        <div className="mt-8 mb-6">
          <h3 className="text-lg font-bold text-gray-800 mb-3">🔍 Estatísticas Individuais</h3>
          <div className="relative">
            <input
              type="text"
              placeholder="Digite o nome do jogador..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            
            {/* Lista de sugestões */}
            {jogadoresFiltrados.length > 0 && (
              <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {jogadoresFiltrados.map(jogador => (
                  <button
                    key={jogador.id}
                    onClick={() => {
                      setJogadorSelecionado(jogador);
                      setBusca('');
                      setJogadoresFiltrados([]);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors"
                  >
                    <div className="font-semibold text-gray-800">{jogador.nome}</div>
                    <div className="text-xs text-gray-500">
                      {jogador.jogos} jogos • {jogador.gols} gols • {jogador.vitorias} vitórias
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Botão de Comparar */}
          {jogadorSelecionado && !modoComparacao && (
            <button
              onClick={() => setModoComparacao(true)}
              className="mt-3 w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-2 px-4 rounded-lg font-bold flex items-center justify-center gap-2 hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg"
            >
              <span className="text-xl">⚖️</span>
              Comparar com outro jogador
            </button>
          )}

          {/* Campo de busca do segundo jogador */}
          {modoComparacao && (
            <div className="relative mt-3">
              <input
                type="text"
                placeholder="Digite o nome do segundo jogador..."
                value={busca2}
                onChange={(e) => setBusca2(e.target.value)}
                className="w-full px-4 py-3 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              
              {/* Lista de sugestões jogador 2 */}
              {jogadoresFiltrados2.length > 0 && (
                <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {jogadoresFiltrados2.map(jogador => (
                    <button
                      key={jogador.id}
                      onClick={() => {
                        setJogador2Selecionado(jogador);
                        setBusca2('');
                        setJogadoresFiltrados2([]);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-purple-50 border-b border-gray-100 last:border-b-0 transition-colors"
                    >
                      <div className="font-semibold text-gray-800">{jogador.nome}</div>
                      <div className="text-xs text-gray-500">
                        {jogador.jogos} jogos • {jogador.gols} gols • {jogador.vitorias} vitórias
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Botão cancelar comparação */}
              <button
                onClick={() => {
                  setModoComparacao(false);
                  setJogador2Selecionado(null);
                  setBusca2('');
                }}
                className="mt-2 w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancelar Comparação
              </button>
            </div>
          )}
        </div>

        {/* Exibição do jogador ou comparação */}
        {jogadorSelecionado && (() => {
          const stats = calcularEstatisticasIndividuais(jogadorSelecionado);
          const stats2 = jogador2Selecionado ? calcularEstatisticasIndividuais(jogador2Selecionado) : null;
          const historico = calcularHistoricoJogos(jogadorSelecionado);
          const historico2 = jogador2Selecionado ? calcularHistoricoJogos(jogador2Selecionado) : null;
          
          return (
            <>
              <div className="sticky top-0 z-20 bg-gray-50 py-3 shadow-sm">
                <div className="flex items-center justify-between">
                  {jogador2Selecionado ? (
                    <div className="flex-1 text-center">
                      <h4 className="text-lg font-bold text-gray-800">
                        <span className="text-blue-600">{jogadorSelecionado.nome}</span>
                        <span className="mx-2">⚔️</span>
                        <span className="text-orange-600">{jogador2Selecionado.nome}</span>
                      </h4>
                      {(() => {
                        let pontos1 = 0, pontos2 = 0;
                        
                        // Estatísticas individuais
                        if (stats.partidas > stats2.partidas) pontos1++; else if (stats2.partidas > stats.partidas) pontos2++;
                        if (stats.gols > stats2.gols) pontos1++; else if (stats2.gols > stats.gols) pontos2++;
                        if (stats.golsDecisivos > stats2.golsDecisivos) pontos1++; else if (stats2.golsDecisivos > stats.golsDecisivos) pontos2++;
                        if (parseFloat(stats.mediaJogo) > parseFloat(stats2.mediaJogo)) pontos1++; else if (parseFloat(stats2.mediaJogo) > parseFloat(stats.mediaJogo)) pontos2++;
                        if (parseFloat(stats.mediaPelada) > parseFloat(stats2.mediaPelada)) pontos1++; else if (parseFloat(stats2.mediaPelada) > parseFloat(stats.mediaPelada)) pontos2++;
                        if (stats.hatTricks > stats2.hatTricks) pontos1++; else if (stats2.hatTricks > stats.hatTricks) pontos2++;
                        if (stats.mvp > stats2.mvp) pontos1++; else if (stats2.mvp > stats.mvp) pontos2++;
                        
                        // Histórico de jogos
                        if (historico.vitorias > historico2.vitorias) pontos1++; else if (historico2.vitorias > historico.vitorias) pontos2++;
                        if (historico.empates > historico2.empates) pontos1++; else if (historico2.empates > historico.empates) pontos2++;
                        if (historico.derrotas < historico2.derrotas) pontos1++; else if (historico2.derrotas < historico.derrotas) pontos2++; // Menos derrotas é melhor
                        if (parseFloat(historico.taxaVitoria) > parseFloat(historico2.taxaVitoria)) pontos1++; else if (parseFloat(historico2.taxaVitoria) > parseFloat(historico.taxaVitoria)) pontos2++;
                        
                        // Últimos 5 jogos
                        if (parseFloat(historico.aproveitamentoUltimos5) > parseFloat(historico2.aproveitamentoUltimos5)) pontos1++; else if (parseFloat(historico2.aproveitamentoUltimos5) > parseFloat(historico.aproveitamentoUltimos5)) pontos2++;
                        if (historico.golsUltimos5 > historico2.golsUltimos5) pontos1++; else if (historico2.golsUltimos5 > historico.golsUltimos5) pontos2++;
                        
                        // Sequências
                        if (historico.seqVitorias > historico2.seqVitorias) pontos1++; else if (historico2.seqVitorias > historico.seqVitorias) pontos2++;
                        if (historico.seqDerrotas < historico2.seqDerrotas) pontos1++; else if (historico2.seqDerrotas < historico.seqDerrotas) pontos2++; // Menos derrotas é melhor
                        if (historico.seqSemPerder > historico2.seqSemPerder) pontos1++; else if (historico2.seqSemPerder > historico.seqSemPerder) pontos2++;
                        if (historico.seqSemVencer < historico2.seqSemVencer) pontos1++; else if (historico2.seqSemVencer < historico.seqSemVencer) pontos2++; // Menos jogos sem vencer é melhor
                        
                        return (
                          <div className="text-2xl font-bold mt-1">
                            <span className="text-blue-600">{pontos1}</span>
                            <span className="text-gray-400 mx-2">|</span>
                            <span className="text-orange-600">{pontos2}</span>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <h4 className="text-lg font-bold text-gray-800 text-center flex-1">{jogadorSelecionado.nome}</h4>
                  )}
                  <button
                    onClick={() => {
                      setJogadorSelecionado(null);
                      setJogador2Selecionado(null);
                      setModoComparacao(false);
                    }}
                    className="text-gray-500 hover:text-gray-700 text-xl"
                  >
                    ✕
                  </button>
                </div>
              </div>
                
                <div className="mt-4">
                  {/* Grid de estatísticas individuais */}
                  <div className="grid grid-cols-2 gap-3">
                  {/* Partidas */}
                  <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow flex h-16">
                    <div className="w-2/5 flex items-center justify-center">
                      <span className="text-2xl">⚽</span>
                    </div>
                    <div className="w-3/5 flex flex-col items-center justify-center border-l border-gray-100">
                      <h2 className="text-xs font-bold text-gray-800">Partidas</h2>
                      {stats2 ? (
                        <p className="text-xs font-bold">
                          <span className="text-blue-600">{stats.partidas}</span>
                          <span className="text-gray-400 mx-1">|</span>
                          <span className="text-orange-600">{stats2.partidas}</span>
                        </p>
                      ) : (
                        <p className="text-lg font-bold text-blue-600">{stats.partidas}</p>
                      )}
                    </div>
                  </div>

                  {/* Peladas (Sessões) */}
                  <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow flex h-16">
                    <div className="w-2/5 flex items-center justify-center">
                      <span className="text-2xl">🏆</span>
                    </div>
                    <div className="w-3/5 flex flex-col items-center justify-center border-l border-gray-100">
                      <h2 className="text-xs font-bold text-gray-800">Peladas</h2>
                      {stats2 ? (
                        <p className="text-xs font-bold">
                          <span className="text-blue-600">{stats.peladas}</span>
                          <span className="text-gray-400 mx-1">|</span>
                          <span className="text-orange-600">{stats2.peladas}</span>
                        </p>
                      ) : (
                        <p className="text-lg font-bold text-blue-600">{stats.peladas}</p>
                      )}
                    </div>
                  </div>

                  {/* Gols */}
                  <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow flex h-16">
                    <div className="w-2/5 flex items-center justify-center">
                      <span className="text-2xl">⚽</span>
                    </div>
                    <div className="w-3/5 flex flex-col items-center justify-center border-l border-gray-100">
                      <h2 className="text-xs font-bold text-gray-800">Gols</h2>
                      {stats2 ? (
                        <p className="text-xs font-bold">
                          <span className="text-blue-600">{stats.gols}</span>
                          <span className="text-gray-400 mx-1">|</span>
                          <span className="text-orange-600">{stats2.gols}</span>
                        </p>
                      ) : (
                        <p className="text-lg font-bold text-blue-600">{stats.gols}</p>
                      )}
                    </div>
                  </div>

                  {/* Gols Decisivos */}
                  <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow flex h-16">
                    <div className="w-2/5 flex items-center justify-center">
                      <span className="text-2xl">🎯</span>
                    </div>
                    <div className="w-3/5 flex flex-col items-center justify-center border-l border-gray-100">
                      <h2 className="text-xs font-bold text-gray-800">Gols Decisivos</h2>
                      {stats2 ? (
                        <p className="text-xs font-bold">
                          <span className="text-blue-600">{stats.golsDecisivos}</span>
                          <span className="text-gray-400 mx-1">|</span>
                          <span className="text-orange-600">{stats2.golsDecisivos}</span>
                        </p>
                      ) : (
                        <p className="text-lg font-bold text-blue-600">{stats.golsDecisivos}</p>
                      )}
                    </div>
                  </div>

                  {/* Média/Jogo */}
                  <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow flex h-16">
                    <div className="w-2/5 flex items-center justify-center">
                      <span className="text-2xl">📊</span>
                    </div>
                    <div className="w-3/5 flex flex-col items-center justify-center border-l border-gray-100">
                      <h2 className="text-xs font-bold text-gray-800">Média/Jogo</h2>
                      {stats2 ? (
                        <p className="text-xs font-bold">
                          <span className="text-blue-600">{stats.mediaJogo}</span>
                          <span className="text-gray-400 mx-1">|</span>
                          <span className="text-orange-600">{stats2.mediaJogo}</span>
                        </p>
                      ) : (
                        <p className="text-lg font-bold text-blue-600">{stats.mediaJogo}</p>
                      )}
                    </div>
                  </div>

                  {/* Média/Pelada */}
                  <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow flex h-16">
                    <div className="w-2/5 flex items-center justify-center">
                      <span className="text-2xl">📈</span>
                    </div>
                    <div className="w-3/5 flex flex-col items-center justify-center border-l border-gray-100">
                      <h2 className="text-xs font-bold text-gray-800">Média/Pelada</h2>
                      {stats2 ? (
                        <p className="text-xs font-bold">
                          <span className="text-blue-600">{stats.mediaPelada}</span>
                          <span className="text-gray-400 mx-1">|</span>
                          <span className="text-orange-600">{stats2.mediaPelada}</span>
                        </p>
                      ) : (
                        <p className="text-lg font-bold text-blue-600">{stats.mediaPelada}</p>
                      )}
                    </div>
                  </div>

                  {/* Hat-Tricks */}
                  <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow flex h-16">
                    <div className="w-2/5 flex items-center justify-center">
                      <span className="text-2xl">🎩</span>
                    </div>
                    <div className="w-3/5 flex flex-col items-center justify-center border-l border-gray-100">
                      <h2 className="text-xs font-bold text-gray-800">Hat-Tricks</h2>
                      {stats2 ? (
                        <p className="text-xs font-bold">
                          <span className="text-blue-600">{stats.hatTricks}</span>
                          <span className="text-gray-400 mx-1">|</span>
                          <span className="text-orange-600">{stats2.hatTricks}</span>
                        </p>
                      ) : (
                        <p className="text-lg font-bold text-blue-600">{stats.hatTricks}</p>
                      )}
                    </div>
                  </div>

                  {/* MVP's */}
                  <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow flex h-16">
                    <div className="w-2/5 flex items-center justify-center">
                      <span className="text-2xl">⭐</span>
                    </div>
                    <div className="w-3/5 flex flex-col items-center justify-center border-l border-gray-100">
                      <h2 className="text-xs font-bold text-gray-800">MVP's</h2>
                      {stats2 ? (
                        <p className="text-xs font-bold">
                          <span className="text-blue-600">{stats.mvp}</span>
                          <span className="text-gray-400 mx-1">|</span>
                          <span className="text-orange-600">{stats2.mvp}</span>
                        </p>
                      ) : (
                        <p className="text-lg font-bold text-blue-600">{stats.mvp}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Histórico de Jogos */}
                {(() => {
                  return (
                    <div className="mt-6">
                      <h4 className="text-lg font-bold text-gray-800 mb-4 text-center">Histórico de Jogos</h4>
                      
                      {/* Resumo de Vitórias/Empates/Derrotas */}
                      <div className="grid grid-cols-4 gap-3 mb-4">
                        <div className="bg-white rounded-lg shadow p-4 flex flex-col items-center justify-center">
                          {stats2 ? (
                            <p className="text-sm font-bold mb-1">
                              <span className="text-blue-600">{historico.vitorias}</span>
                              <span className="text-gray-400 mx-1">|</span>
                              <span className="text-orange-600">{historico2.vitorias}</span>
                            </p>
                          ) : (
                            <p className="text-xl font-bold text-green-600 mb-1">{historico.vitorias}</p>
                          )}
                          <h2 className="text-xs font-semibold text-gray-600 uppercase">Vitórias</h2>
                        </div>

                        <div className="bg-white rounded-lg shadow p-4 flex flex-col items-center justify-center">
                          {stats2 ? (
                            <p className="text-sm font-bold mb-1">
                              <span className="text-blue-600">{historico.empates}</span>
                              <span className="text-gray-400 mx-1">|</span>
                              <span className="text-orange-600">{historico2.empates}</span>
                            </p>
                          ) : (
                            <p className="text-xl font-bold text-orange-500 mb-1">{historico.empates}</p>
                          )}
                          <h2 className="text-xs font-semibold text-gray-600 uppercase">Empates</h2>
                        </div>

                        <div className="bg-white rounded-lg shadow p-4 flex flex-col items-center justify-center">
                          {stats2 ? (
                            <p className="text-sm font-bold mb-1">
                              <span className="text-blue-600">{historico.derrotas}</span>
                              <span className="text-gray-400 mx-1">|</span>
                              <span className="text-orange-600">{historico2.derrotas}</span>
                            </p>
                          ) : (
                            <p className="text-xl font-bold text-red-600 mb-1">{historico.derrotas}</p>
                          )}
                          <h2 className="text-xs font-semibold text-gray-600 uppercase">Derrotas</h2>
                        </div>

                        <div className="bg-white rounded-lg shadow p-4 flex flex-col items-center justify-center">
                          {stats2 ? (
                            <p className="text-sm font-bold mb-1">
                              <span className="text-blue-600">{historico.taxaVitoria}%</span>
                              <span className="text-gray-400 mx-1">|</span>
                              <span className="text-orange-600">{historico2.taxaVitoria}%</span>
                            </p>
                          ) : (
                            <p className="text-xl font-bold text-blue-600 mb-1">{historico.taxaVitoria}%</p>
                          )}
                          <h2 className="text-xs font-semibold text-gray-600 uppercase">Taxa</h2>
                        </div>
                      </div>

                      {/* Últimos 5 Jogos */}
                      <div className="bg-white rounded-lg shadow p-4 mb-4">
                        {stats2 ? (
                          <>
                            {/* Jogador 1 */}
                            <div className="mb-4">
                              <div className="flex items-center justify-between mb-3">
                                <h5 className="text-sm font-bold text-blue-600">{jogadorSelecionado.nome}</h5>
                                <div className="flex items-center space-x-2">
                                  {[...Array(5)].map((_, index) => {
                                    const jogo = historico.ultimos5[4 - index];
                                    return (
                                      <div
                                        key={index}
                                        className={`w-6 h-6 rounded-full ${
                                          !jogo ? 'bg-gray-200' :
                                          jogo.resultado === 'V' ? 'bg-green-500' : 
                                          jogo.resultado === 'E' ? 'bg-yellow-500' : 'bg-red-500'
                                        }`}
                                        title={jogo ? `${jogo.resultado === 'V' ? 'Vitória' : jogo.resultado === 'E' ? 'Empate' : 'Derrota'} - ${jogo.gols} gol(s)` : 'Sem jogo'}
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                              <div className="flex justify-between text-xs text-gray-600">
                                <span>Aproveitamento: {historico.aproveitamentoUltimos5}%</span>
                                <span>Gols: {historico.golsUltimos5}</span>
                              </div>
                            </div>
                            
                            {/* Jogador 2 */}
                            <div className="pt-4 border-t border-gray-100">
                              <div className="flex items-center justify-between mb-3">
                                <h5 className="text-sm font-bold text-orange-600">{jogador2Selecionado?.nome}</h5>
                                <div className="flex items-center space-x-2">
                                  {[...Array(5)].map((_, index) => {
                                    const jogo = historico2.ultimos5[4 - index];
                                    return (
                                      <div
                                        key={index}
                                        className={`w-6 h-6 rounded-full ${
                                          !jogo ? 'bg-gray-200' :
                                          jogo.resultado === 'V' ? 'bg-green-500' : 
                                          jogo.resultado === 'E' ? 'bg-yellow-500' : 'bg-red-500'
                                        }`}
                                        title={jogo ? `${jogo.resultado === 'V' ? 'Vitória' : jogo.resultado === 'E' ? 'Empate' : 'Derrota'} - ${jogo.gols} gol(s)` : 'Sem jogo'}
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                              <div className="flex justify-between text-xs text-gray-600">
                                <span>Aproveitamento: {historico2.aproveitamentoUltimos5}%</span>
                                <span>Gols: {historico2.golsUltimos5}</span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center justify-between mb-3">
                              <h5 className="text-sm font-bold text-gray-800">Últimos 5 Jogos</h5>
                              <div className="flex items-center space-x-2">
                                {[...Array(5)].map((_, index) => {
                                  const jogo = historico.ultimos5[4 - index];
                                  return (
                                    <div
                                      key={index}
                                      className={`w-6 h-6 rounded-full ${
                                        !jogo ? 'bg-gray-200' :
                                        jogo.resultado === 'V' ? 'bg-green-500' : 
                                        jogo.resultado === 'E' ? 'bg-yellow-500' : 'bg-red-500'
                                      }`}
                                      title={jogo ? `${jogo.resultado === 'V' ? 'Vitória' : jogo.resultado === 'E' ? 'Empate' : 'Derrota'} - ${jogo.gols} gol(s)` : 'Sem jogo'}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                            <div className="flex justify-between text-xs text-gray-600">
                              <span>Aproveitamento: {historico.aproveitamentoUltimos5}%</span>
                              <span>Gols: {historico.golsUltimos5}</span>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Sequências */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow flex h-16">
                          <div className="w-2/5 flex items-center justify-center">
                            <span className="text-2xl">🔥</span>
                          </div>
                          <div className="w-3/5 flex flex-col items-center justify-center border-l border-gray-100">
                            <h2 className="text-xs font-bold text-gray-800">Seq. Vitórias</h2>
                            {stats2 ? (
                              <p className="text-sm font-bold">
                                <span className="text-green-600">{historico.seqVitorias}</span>
                                <span className="text-gray-400 mx-1">|</span>
                                <span className="text-green-600">{historico2.seqVitorias}</span>
                              </p>
                            ) : (
                              <p className="text-lg font-bold text-green-600">{historico.seqVitorias}</p>
                            )}
                          </div>
                        </div>

                        <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow flex h-16">
                          <div className="w-2/5 flex items-center justify-center">
                            <span className="text-2xl">💔</span>
                          </div>
                          <div className="w-3/5 flex flex-col items-center justify-center border-l border-gray-100">
                            <h2 className="text-xs font-bold text-gray-800">Seq. Derrotas</h2>
                            {stats2 ? (
                              <p className="text-sm font-bold">
                                <span className="text-red-600">{historico.seqDerrotas}</span>
                                <span className="text-gray-400 mx-1">|</span>
                                <span className="text-red-600">{historico2.seqDerrotas}</span>
                              </p>
                            ) : (
                              <p className="text-lg font-bold text-red-600">{historico.seqDerrotas}</p>
                            )}
                          </div>
                        </div>

                        <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow flex h-16">
                          <div className="w-2/5 flex items-center justify-center">
                            <span className="text-2xl">🛡️</span>
                          </div>
                          <div className="w-3/5 flex flex-col items-center justify-center border-l border-gray-100">
                            <h2 className="text-xs font-bold text-gray-800">Sem Perder</h2>
                            {stats2 ? (
                              <p className="text-xs font-bold">
                                <span className="text-blue-600">{historico.seqSemPerder}</span>
                                <span className="text-gray-400 mx-1">|</span>
                                <span className="text-orange-600">{historico2.seqSemPerder}</span>
                              </p>
                            ) : (
                              <p className="text-lg font-bold text-blue-600">{historico.seqSemPerder}</p>
                            )}
                          </div>
                        </div>

                        <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow flex h-16">
                          <div className="w-2/5 flex items-center justify-center">
                            <span className="text-2xl">⚠️</span>
                          </div>
                          <div className="w-3/5 flex flex-col items-center justify-center border-l border-gray-100">
                            <h2 className="text-xs font-bold text-gray-800">Sem Vencer</h2>
                            {stats2 ? (
                              <p className="text-sm font-bold">
                                <span className="text-orange-600">{historico.seqSemVencer}</span>
                                <span className="text-gray-400 mx-1">|</span>
                                <span className="text-orange-600">{historico2.seqSemVencer}</span>
                              </p>
                            ) : (
                              <p className="text-lg font-bold text-orange-600">{historico.seqSemVencer}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                </div>

                {/* Botão de Baixar */}
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={async () => {
                      if (!jogadorSelecionado) return;
                      
                      try {
                        const html2canvas = (await import('html2canvas')).default;
                        const historico = calcularHistoricoJogos(jogadorSelecionado);
                        
                        // Verificar se é comparação
                        if (jogador2Selecionado && stats2 && historico2) {
                          // MODO COMPARAÇÃO
                          const rankingsJ1 = obterPosicoesComparacao('artilharia');
                          const rankingsJ2 = obterPosicoesComparacao('vitorioso');
                          const rankingsJ3 = obterPosicoesComparacao('mediaGols');
                          const rankingsJ4 = obterPosicoesComparacao('reiDaPelada');
                          const rankingsJ5 = obterPosicoesComparacao('mvp');
                          const rankingsJ6 = obterPosicoesComparacao('hatTricks');
                          const rankingsJ7 = obterPosicoesComparacao('golsDecisivos');
                          const rankingsJ8 = obterPosicoesComparacao('fominha');
                          
                          // Calcular placar (17 estatísticas)
                          let pontos1 = 0, pontos2 = 0;
                          
                          // Estatísticas individuais (7)
                          if (stats.partidas > stats2.partidas) pontos1++; else if (stats2.partidas > stats.partidas) pontos2++;
                          if (stats.gols > stats2.gols) pontos1++; else if (stats2.gols > stats.gols) pontos2++;
                          if (stats.golsDecisivos > stats2.golsDecisivos) pontos1++; else if (stats2.golsDecisivos > stats.golsDecisivos) pontos2++;
                          if (parseFloat(stats.mediaJogo) > parseFloat(stats2.mediaJogo)) pontos1++; else if (parseFloat(stats2.mediaJogo) > parseFloat(stats.mediaJogo)) pontos2++;
                          if (parseFloat(stats.mediaPelada) > parseFloat(stats2.mediaPelada)) pontos1++; else if (parseFloat(stats2.mediaPelada) > parseFloat(stats.mediaPelada)) pontos2++;
                          if (stats.hatTricks > stats2.hatTricks) pontos1++; else if (stats2.hatTricks > stats.hatTricks) pontos2++;
                          if (stats.mvp > stats2.mvp) pontos1++; else if (stats2.mvp > stats.mvp) pontos2++;
                          
                          // Histórico de jogos (4)
                          if (historico.vitorias > historico2.vitorias) pontos1++; else if (historico2.vitorias > historico.vitorias) pontos2++;
                          if (historico.empates > historico2.empates) pontos1++; else if (historico2.empates > historico.empates) pontos2++;
                          if (historico.derrotas < historico2.derrotas) pontos1++; else if (historico2.derrotas < historico.derrotas) pontos2++;
                          if (parseFloat(historico.taxaVitoria) > parseFloat(historico2.taxaVitoria)) pontos1++; else if (parseFloat(historico2.taxaVitoria) > parseFloat(historico.taxaVitoria)) pontos2++;
                          
                          // Últimos 5 jogos (2)
                          if (parseFloat(historico.aproveitamentoUltimos5) > parseFloat(historico2.aproveitamentoUltimos5)) pontos1++; else if (parseFloat(historico2.aproveitamentoUltimos5) > parseFloat(historico.aproveitamentoUltimos5)) pontos2++;
                          if (historico.golsUltimos5 > historico2.golsUltimos5) pontos1++; else if (historico2.golsUltimos5 > historico.golsUltimos5) pontos2++;
                          
                          // Sequências (4)
                          if (historico.seqVitorias > historico2.seqVitorias) pontos1++; else if (historico2.seqVitorias > historico.seqVitorias) pontos2++;
                          if (historico.seqDerrotas < historico2.seqDerrotas) pontos1++; else if (historico2.seqDerrotas < historico.seqDerrotas) pontos2++;
                          if (historico.seqSemPerder > historico2.seqSemPerder) pontos1++; else if (historico2.seqSemPerder > historico.seqSemPerder) pontos2++;
                          if (historico.seqSemVencer < historico2.seqSemVencer) pontos1++; else if (historico2.seqSemVencer < historico.seqSemVencer) pontos2++;
                          
                          const container = document.createElement('div');
                          container.style.cssText = 'position: fixed; left: -9999px; top: 0; width: 480px; padding: 20px; background: #f3f4f6; font-family: system-ui, -apple-system, sans-serif;';
                          
                          container.innerHTML = `
                            <!-- Header com Placar -->
                            <div style="background: white; border-radius: 16px; padding: 20px; margin-bottom: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.15); text-align: center;">
                              <h3 style="font-size: 20px; font-weight: bold; color: #1f2937; margin: 0 0 10px 0;">
                                <span style="color: #2563eb;">${jogadorSelecionado.nome}</span>
                                <span style="margin: 0 10px;">⚔️</span>
                                <span style="color: #ea580c;">${jogador2Selecionado.nome}</span>
                              </h3>
                              <div style="font-size: 32px; font-weight: bold;">
                                <span style="color: #2563eb;">${pontos1}</span>
                                <span style="color: #9ca3af; margin: 0 10px;">|</span>
                                <span style="color: #ea580c;">${pontos2}</span>
                              </div>
                            </div>
                            
                            <!-- Rankings Gerais -->
                            <div style="background: white; border-radius: 16px; padding: 16px; margin-bottom: 20px; box-shadow: 0 6px 16px rgba(0,0,0,0.12);">
                              <h4 style="font-size: 16px; font-weight: bold; color: #1f2937; text-align: center; margin: 0 0 12px 0;">📊 Rankings Gerais</h4>
                              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                <div style="padding: 8px; background: #f9fafb; border-radius: 8px; text-align: center;">
                                  <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">⚽ Artilharia</div>
                                  <div style="font-size: 13px; font-weight: bold;">
                                    <span style="color: #2563eb;">${rankingsJ1?.pos1 || '-'}</span>
                                    <span style="color: #9ca3af; margin: 0 6px;">|</span>
                                    <span style="color: #ea580c;">${rankingsJ1?.pos2 || '-'}</span>
                                  </div>
                                </div>
                                <div style="padding: 8px; background: #f9fafb; border-radius: 8px; text-align: center;">
                                  <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">🏆 Vitorioso</div>
                                  <div style="font-size: 13px; font-weight: bold;">
                                    <span style="color: #2563eb;">${rankingsJ2?.pos1 || '-'}</span>
                                    <span style="color: #9ca3af; margin: 0 6px;">|</span>
                                    <span style="color: #ea580c;">${rankingsJ2?.pos2 || '-'}</span>
                                  </div>
                                </div>
                                <div style="padding: 8px; background: #f9fafb; border-radius: 8px; text-align: center;">
                                  <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">📊 Média Gols</div>
                                  <div style="font-size: 13px; font-weight: bold;">
                                    <span style="color: #2563eb;">${rankingsJ3?.pos1 || '-'}</span>
                                    <span style="color: #9ca3af; margin: 0 6px;">|</span>
                                    <span style="color: #ea580c;">${rankingsJ3?.pos2 || '-'}</span>
                                  </div>
                                </div>
                                <div style="padding: 8px; background: #f9fafb; border-radius: 8px; text-align: center;">
                                  <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">👑 Rei Pelada</div>
                                  <div style="font-size: 13px; font-weight: bold;">
                                    <span style="color: #2563eb;">${rankingsJ4?.pos1 || '-'}</span>
                                    <span style="color: #9ca3af; margin: 0 6px;">|</span>
                                    <span style="color: #ea580c;">${rankingsJ4?.pos2 || '-'}</span>
                                  </div>
                                </div>
                                <div style="padding: 8px; background: #f9fafb; border-radius: 8px; text-align: center;">
                                  <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">⭐ MVP</div>
                                  <div style="font-size: 13px; font-weight: bold;">
                                    <span style="color: #2563eb;">${rankingsJ5?.pos1 || '-'}</span>
                                    <span style="color: #9ca3af; margin: 0 6px;">|</span>
                                    <span style="color: #ea580c;">${rankingsJ5?.pos2 || '-'}</span>
                                  </div>
                                </div>
                                <div style="padding: 8px; background: #f9fafb; border-radius: 8px; text-align: center;">
                                  <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">🎩 Hat-Tricks</div>
                                  <div style="font-size: 13px; font-weight: bold;">
                                    <span style="color: #2563eb;">${rankingsJ6?.pos1 || '-'}</span>
                                    <span style="color: #9ca3af; margin: 0 6px;">|</span>
                                    <span style="color: #ea580c;">${rankingsJ6?.pos2 || '-'}</span>
                                  </div>
                                </div>
                                <div style="padding: 8px; background: #f9fafb; border-radius: 8px; text-align: center;">
                                  <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">🎯 Decisivos</div>
                                  <div style="font-size: 13px; font-weight: bold;">
                                    <span style="color: #2563eb;">${rankingsJ7?.pos1 || '-'}</span>
                                    <span style="color: #9ca3af; margin: 0 6px;">|</span>
                                    <span style="color: #ea580c;">${rankingsJ7?.pos2 || '-'}</span>
                                  </div>
                                </div>
                                <div style="padding: 8px; background: #f9fafb; border-radius: 8px; text-align: center;">
                                  <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">🎮 Fominha</div>
                                  <div style="font-size: 13px; font-weight: bold;">
                                    <span style="color: #2563eb;">${rankingsJ8?.pos1 || '-'}</span>
                                    <span style="color: #9ca3af; margin: 0 6px;">|</span>
                                    <span style="color: #ea580c;">${rankingsJ8?.pos2 || '-'}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <!-- Estatísticas Comparadas -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 24px;">
                              <div style="background: white; border-radius: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.12); display: flex; height: 64px;">
                                <div style="width: 40%; display: flex; align-items: center; justify-content: center; font-size: 26px;">⚽</div>
                                <div style="width: 60%; display: flex; flex-direction: column; align-items: center; justify-content: center; border-left: 1px solid #e5e7eb;">
                                  <div style="font-size: 11px; font-weight: bold; color: #4b5563;">Partidas</div>
                                  <div style="font-size: 18px; font-weight: bold;">
                                    <span style="color: #2563eb;">${stats.partidas}</span>
                                    <span style="color: #9ca3af;"> | </span>
                                    <span style="color: #ea580c;">${stats2.partidas}</span>
                                  </div>
                                </div>
                              </div>
                              
                              <div style="background: white; border-radius: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.12); display: flex; height: 64px;">
                                <div style="width: 40%; display: flex; align-items: center; justify-content: center; font-size: 26px;">🏆</div>
                                <div style="width: 60%; display: flex; flex-direction: column; align-items: center; justify-content: center; border-left: 1px solid #e5e7eb;">
                                  <div style="font-size: 11px; font-weight: bold; color: #4b5563;">Peladas</div>
                                  <div style="font-size: 18px; font-weight: bold;">
                                    <span style="color: #2563eb;">${stats.peladas}</span>
                                    <span style="color: #9ca3af;"> | </span>
                                    <span style="color: #ea580c;">${stats2.peladas}</span>
                                  </div>
                                </div>
                              </div>
                              
                              <div style="background: white; border-radius: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.12); display: flex; height: 64px;">
                                <div style="width: 40%; display: flex; align-items: center; justify-content: center; font-size: 26px;">⚽</div>
                                <div style="width: 60%; display: flex; flex-direction: column; align-items: center; justify-content: center; border-left: 1px solid #e5e7eb;">
                                  <div style="font-size: 11px; font-weight: bold; color: #4b5563;">Gols</div>
                                  <div style="font-size: 18px; font-weight: bold;">
                                    <span style="color: #2563eb;">${stats.gols}</span>
                                    <span style="color: #9ca3af;"> | </span>
                                    <span style="color: #ea580c;">${stats2.gols}</span>
                                  </div>
                                </div>
                              </div>
                              
                              <div style="background: white; border-radius: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.12); display: flex; height: 64px;">
                                <div style="width: 40%; display: flex; align-items: center; justify-content: center; font-size: 26px;">🎯</div>
                                <div style="width: 60%; display: flex; flex-direction: column; align-items: center; justify-content: center; border-left: 1px solid #e5e7eb;">
                                  <div style="font-size: 11px; font-weight: bold; color: #4b5563;">Gols Decisivos</div>
                                  <div style="font-size: 18px; font-weight: bold;">
                                    <span style="color: #2563eb;">${stats.golsDecisivos}</span>
                                    <span style="color: #9ca3af;"> | </span>
                                    <span style="color: #ea580c;">${stats2.golsDecisivos}</span>
                                  </div>
                                </div>
                              </div>
                              
                              <div style="background: white; border-radius: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.12); display: flex; height: 64px;">
                                <div style="width: 40%; display: flex; align-items: center; justify-content: center; font-size: 26px;">📊</div>
                                <div style="width: 60%; display: flex; flex-direction: column; align-items: center; justify-content: center; border-left: 1px solid #e5e7eb;">
                                  <div style="font-size: 11px; font-weight: bold; color: #4b5563;">Média/Jogo</div>
                                  <div style="font-size: 18px; font-weight: bold;">
                                    <span style="color: #2563eb;">${stats.mediaJogo}</span>
                                    <span style="color: #9ca3af;"> | </span>
                                    <span style="color: #ea580c;">${stats2.mediaJogo}</span>
                                  </div>
                                </div>
                              </div>
                              
                              <div style="background: white; border-radius: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.12); display: flex; height: 64px;">
                                <div style="width: 40%; display: flex; align-items: center; justify-content: center; font-size: 26px;">📈</div>
                                <div style="width: 60%; display: flex; flex-direction: column; align-items: center; justify-content: center; border-left: 1px solid #e5e7eb;">
                                  <div style="font-size: 11px; font-weight: bold; color: #4b5563;">Média/Pelada</div>
                                  <div style="font-size: 18px; font-weight: bold;">
                                    <span style="color: #2563eb;">${stats.mediaPelada}</span>
                                    <span style="color: #9ca3af;"> | </span>
                                    <span style="color: #ea580c;">${stats2.mediaPelada}</span>
                                  </div>
                                </div>
                              </div>
                              
                              <div style="background: white; border-radius: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.12); display: flex; height: 64px;">
                                <div style="width: 40%; display: flex; align-items: center; justify-content: center; font-size: 26px;">🎩</div>
                                <div style="width: 60%; display: flex; flex-direction: column; align-items: center; justify-content: center; border-left: 1px solid #e5e7eb;">
                                  <div style="font-size: 11px; font-weight: bold; color: #4b5563;">Hat-Tricks</div>
                                  <div style="font-size: 18px; font-weight: bold;">
                                    <span style="color: #2563eb;">${stats.hatTricks}</span>
                                    <span style="color: #9ca3af;"> | </span>
                                    <span style="color: #ea580c;">${stats2.hatTricks}</span>
                                  </div>
                                </div>
                              </div>
                              
                              <div style="background: white; border-radius: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.12); display: flex; height: 64px;">
                                <div style="width: 40%; display: flex; align-items: center; justify-content: center; font-size: 26px;">⭐</div>
                                <div style="width: 60%; display: flex; flex-direction: column; align-items: center; justify-content: center; border-left: 1px solid #e5e7eb;">
                                  <div style="font-size: 11px; font-weight: bold; color: #4b5563;">MVP's</div>
                                  <div style="font-size: 18px; font-weight: bold;">
                                    <span style="color: #2563eb;">${stats.mvp}</span>
                                    <span style="color: #9ca3af;"> | </span>
                                    <span style="color: #ea580c;">${stats2.mvp}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <!-- Histórico de Jogos -->
                            <div style="margin-top: 24px;">
                              <h4 style="font-size: 20px; font-weight: bold; color: #1f2937; margin-bottom: 18px; text-align: center;">Histórico de Jogos</h4>
                              
                              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 18px;">
                                <div style="background: white; border-radius: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.12); padding: 16px; text-align: center;">
                                  <div style="font-size: 18px; font-weight: bold; margin-bottom: 6px;">
                                    <span style="color: #2563eb;">${historico.vitorias}</span>
                                    <span style="color: #9ca3af;"> | </span>
                                    <span style="color: #ea580c;">${historico2.vitorias}</span>
                                  </div>
                                  <div style="font-size: 10px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Vitórias</div>
                                </div>
                                <div style="background: white; border-radius: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.12); padding: 16px; text-align: center;">
                                  <div style="font-size: 18px; font-weight: bold; margin-bottom: 6px;">
                                    <span style="color: #2563eb;">${historico.empates}</span>
                                    <span style="color: #9ca3af;"> | </span>
                                    <span style="color: #ea580c;">${historico2.empates}</span>
                                  </div>
                                  <div style="font-size: 10px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Empates</div>
                                </div>
                                <div style="background: white; border-radius: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.12); padding: 16px; text-align: center;">
                                  <div style="font-size: 18px; font-weight: bold; margin-bottom: 6px;">
                                    <span style="color: #2563eb;">${historico.derrotas}</span>
                                    <span style="color: #9ca3af;"> | </span>
                                    <span style="color: #ea580c;">${historico2.derrotas}</span>
                                  </div>
                                  <div style="font-size: 10px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Derrotas</div>
                                </div>
                                <div style="background: white; border-radius: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.12); padding: 16px; text-align: center;">
                                  <div style="font-size: 18px; font-weight: bold; margin-bottom: 6px;">
                                    <span style="color: #2563eb;">${historico.taxaVitoria}%</span>
                                    <span style="color: #9ca3af;"> | </span>
                                    <span style="color: #ea580c;">${historico2.taxaVitoria}%</span>
                                  </div>
                                  <div style="font-size: 10px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Taxa</div>
                                </div>
                              </div>
                              
                              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                                <div style="background: white; border-radius: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.12); display: flex; height: 64px;">
                                  <div style="width: 40%; display: flex; align-items: center; justify-content: center; font-size: 26px;">🔥</div>
                                  <div style="width: 60%; display: flex; flex-direction: column; align-items: center; justify-content: center; border-left: 1px solid #e5e7eb;">
                                    <div style="font-size: 11px; font-weight: bold; color: #4b5563;">Seq. Vitórias</div>
                                    <div style="font-size: 18px; font-weight: bold;">
                                      <span style="color: #2563eb;">${historico.seqVitorias}</span>
                                      <span style="color: #9ca3af;"> | </span>
                                      <span style="color: #ea580c;">${historico2.seqVitorias}</span>
                                    </div>
                                  </div>
                                </div>
                                
                                <div style="background: white; border-radius: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.12); display: flex; height: 64px;">
                                  <div style="width: 40%; display: flex; align-items: center; justify-content: center; font-size: 26px;">💔</div>
                                  <div style="width: 60%; display: flex; flex-direction: column; align-items: center; justify-content: center; border-left: 1px solid #e5e7eb;">
                                    <div style="font-size: 11px; font-weight: bold; color: #4b5563;">Seq. Derrotas</div>
                                    <div style="font-size: 18px; font-weight: bold;">
                                      <span style="color: #2563eb;">${historico.seqDerrotas}</span>
                                      <span style="color: #9ca3af;"> | </span>
                                      <span style="color: #ea580c;">${historico2.seqDerrotas}</span>
                                    </div>
                                  </div>
                                </div>
                                
                                <div style="background: white; border-radius: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.12); display: flex; height: 64px;">
                                  <div style="width: 40%; display: flex; align-items: center; justify-content: center; font-size: 26px;">🛡️</div>
                                  <div style="width: 60%; display: flex; flex-direction: column; align-items: center; justify-content: center; border-left: 1px solid #e5e7eb;">
                                    <div style="font-size: 11px; font-weight: bold; color: #4b5563;">Sem Perder</div>
                                    <div style="font-size: 18px; font-weight: bold;">
                                      <span style="color: #2563eb;">${historico.seqSemPerder}</span>
                                      <span style="color: #9ca3af;"> | </span>
                                      <span style="color: #ea580c;">${historico2.seqSemPerder}</span>
                                    </div>
                                  </div>
                                </div>
                                
                                <div style="background: white; border-radius: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.12); display: flex; height: 64px;">
                                  <div style="width: 40%; display: flex; align-items: center; justify-content: center; font-size: 26px;">⚠️</div>
                                  <div style="width: 60%; display: flex; flex-direction: column; align-items: center; justify-content: center; border-left: 1px solid #e5e7eb;">
                                    <div style="font-size: 11px; font-weight: bold; color: #4b5563;">Sem Vencer</div>
                                    <div style="font-size: 18px; font-weight: bold;">
                                      <span style="color: #2563eb;">${historico.seqSemVencer}</span>
                                      <span style="color: #9ca3af;"> | </span>
                                      <span style="color: #ea580c;">${historico2.seqSemVencer}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          `;
                          
                          document.body.appendChild(container);
                          await new Promise(resolve => setTimeout(resolve, 100));
                          
                          const canvas = await html2canvas(container, {
                            scale: 2,
                            backgroundColor: '#f3f4f6',
                            logging: false
                          });
                          
                          document.body.removeChild(container);
                          
                          canvas.toBlob((blob) => {
                            if (!blob) {
                              alert('Erro ao gerar imagem');
                              return;
                            }
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            const dataAtual = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
                            link.download = `comparacao-${jogadorSelecionado.nome.replace(/\s+/g, '-')}-vs-${jogador2Selecionado.nome.replace(/\s+/g, '-')}-${dataAtual}.png`;
                            link.href = url;
                            link.click();
                            URL.revokeObjectURL(url);
                          }, 'image/png', 1.0);
                          
                          return;
                        }
                        
                        // MODO INDIVIDUAL
                        // Obter posições nos rankings
                        const rankingsJogador = {
                          artilharia: obterPosicaoJogador('artilharia') || '-',
                          vitorioso: obterPosicaoJogador('vitorioso') || '-',
                          mediaGols: obterPosicaoJogador('mediaGols') || '-',
                          fominha: obterPosicaoJogador('fominha') || '-',
                          reiDaPelada: obterPosicaoJogador('reiDaPelada') || '-',
                          mvp: obterPosicaoJogador('mvp') || '-',
                          hatTricks: obterPosicaoJogador('hatTricks') || '-',
                          golsDecisivos: obterPosicaoJogador('golsDecisivos') || '-',
                        };
                        
                        // Cria container temporário com estilos inline
                        const container = document.createElement('div');
                        container.style.cssText = 'position: fixed; left: -9999px; top: 0; width: 400px; padding: 20px; background: #f3f4f6; font-family: system-ui, -apple-system, sans-serif;';
                        
                        container.innerHTML = `
                          <div style="background: white; border-radius: 16px; padding: 20px; margin-bottom: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.15);">
                            <h3 style="font-size: 26px; font-weight: bold; color: #1f2937; text-align: center; margin: 0;">${jogadorSelecionado.nome}</h3>
                          </div>
                          
                          <!-- Rankings Gerais -->
                          <div style="background: white; border-radius: 16px; padding: 16px; margin-bottom: 20px; box-shadow: 0 6px 16px rgba(0,0,0,0.12);">
                            <h4 style="font-size: 16px; font-weight: bold; color: #1f2937; text-align: center; margin: 0 0 12px 0;">📊 Rankings Gerais</h4>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                              <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px; background: #f9fafb; border-radius: 8px;">
                                <span style="font-size: 12px; color: #6b7280;">⚽ Artilharia</span>
                                <span style="font-size: 14px; font-weight: bold; color: #2563eb;">${rankingsJogador.artilharia}</span>
                              </div>
                              <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px; background: #f9fafb; border-radius: 8px;">
                                <span style="font-size: 12px; color: #6b7280;">🏆 Vitorioso</span>
                                <span style="font-size: 14px; font-weight: bold; color: #2563eb;">${rankingsJogador.vitorioso}</span>
                              </div>
                              <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px; background: #f9fafb; border-radius: 8px;">
                                <span style="font-size: 12px; color: #6b7280;">📊 Média Gols</span>
                                <span style="font-size: 14px; font-weight: bold; color: #2563eb;">${rankingsJogador.mediaGols}</span>
                              </div>
                              <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px; background: #f9fafb; border-radius: 8px;">
                                <span style="font-size: 12px; color: #6b7280;">👑 Rei Pelada</span>
                                <span style="font-size: 14px; font-weight: bold; color: #2563eb;">${rankingsJogador.reiDaPelada}</span>
                              </div>
                              <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px; background: #f9fafb; border-radius: 8px;">
                                <span style="font-size: 12px; color: #6b7280;">⭐ MVP</span>
                                <span style="font-size: 14px; font-weight: bold; color: #2563eb;">${rankingsJogador.mvp}</span>
                              </div>
                              <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px; background: #f9fafb; border-radius: 8px;">
                                <span style="font-size: 12px; color: #6b7280;">🎩 Hat-Tricks</span>
                                <span style="font-size: 14px; font-weight: bold; color: #2563eb;">${rankingsJogador.hatTricks}</span>
                              </div>
                              <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px; background: #f9fafb; border-radius: 8px;">
                                <span style="font-size: 12px; color: #6b7280;">🎯 Gols Decisivos</span>
                                <span style="font-size: 14px; font-weight: bold; color: #2563eb;">${rankingsJogador.golsDecisivos}</span>
                              </div>
                              <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px; background: #f9fafb; border-radius: 8px;">
                                <span style="font-size: 12px; color: #6b7280;">🎮 Fominha</span>
                                <span style="font-size: 14px; font-weight: bold; color: #2563eb;">${rankingsJogador.fominha}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 24px;">
                            <div style="background: white; border-radius: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.12); display: flex; height: 64px; transition: all 0.3s;">
                              <div style="width: 40%; display: flex; align-items: center; justify-content: center; font-size: 26px;">⚽</div>
                              <div style="width: 60%; display: flex; flex-direction: column; align-items: center; justify-content: center; border-left: 1px solid #e5e7eb;">
                                <div style="font-size: 11px; font-weight: bold; color: #4b5563;">Partidas</div>
                                <div style="font-size: 20px; font-weight: bold; color: #2563eb;">${stats.partidas}</div>
                              </div>
                            </div>
                            
                            <div style="background: white; border-radius: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.12); display: flex; height: 64px;">
                              <div style="width: 40%; display: flex; align-items: center; justify-content: center; font-size: 26px;">🏆</div>
                              <div style="width: 60%; display: flex; flex-direction: column; align-items: center; justify-content: center; border-left: 1px solid #e5e7eb;">
                                <div style="font-size: 11px; font-weight: bold; color: #4b5563;">Peladas</div>
                                <div style="font-size: 20px; font-weight: bold; color: #2563eb;">${stats.peladas}</div>
                              </div>
                            </div>
                            
                            <div style="background: white; border-radius: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.12); display: flex; height: 64px;">
                              <div style="width: 40%; display: flex; align-items: center; justify-content: center; font-size: 26px;">⚽</div>
                              <div style="width: 60%; display: flex; flex-direction: column; align-items: center; justify-content: center; border-left: 1px solid #e5e7eb;">
                                <div style="font-size: 11px; font-weight: bold; color: #4b5563;">Gols</div>
                                <div style="font-size: 20px; font-weight: bold; color: #2563eb;">${stats.gols}</div>
                              </div>
                            </div>
                            
                            <div style="background: white; border-radius: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.12); display: flex; height: 64px;">
                              <div style="width: 40%; display: flex; align-items: center; justify-content: center; font-size: 26px;">🎯</div>
                              <div style="width: 60%; display: flex; flex-direction: column; align-items: center; justify-content: center; border-left: 1px solid #e5e7eb;">
                                <div style="font-size: 11px; font-weight: bold; color: #4b5563;">Gols Decisivos</div>
                                <div style="font-size: 20px; font-weight: bold; color: #2563eb;">${stats.golsDecisivos}</div>
                              </div>
                            </div>
                            
                            <div style="background: white; border-radius: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.12); display: flex; height: 64px;">
                              <div style="width: 40%; display: flex; align-items: center; justify-content: center; font-size: 26px;">📊</div>
                              <div style="width: 60%; display: flex; flex-direction: column; align-items: center; justify-content: center; border-left: 1px solid #e5e7eb;">
                                <div style="font-size: 11px; font-weight: bold; color: #4b5563;">Média/Jogo</div>
                                <div style="font-size: 20px; font-weight: bold; color: #2563eb;">${stats.mediaJogo}</div>
                              </div>
                            </div>
                            
                            <div style="background: white; border-radius: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.12); display: flex; height: 64px;">
                              <div style="width: 40%; display: flex; align-items: center; justify-content: center; font-size: 26px;">📈</div>
                              <div style="width: 60%; display: flex; flex-direction: column; align-items: center; justify-content: center; border-left: 1px solid #e5e7eb;">
                                <div style="font-size: 11px; font-weight: bold; color: #4b5563;">Média/Pelada</div>
                                <div style="font-size: 20px; font-weight: bold; color: #2563eb;">${stats.mediaPelada}</div>
                              </div>
                            </div>
                            
                            <div style="background: white; border-radius: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.12); display: flex; height: 64px;">
                              <div style="width: 40%; display: flex; align-items: center; justify-content: center; font-size: 26px;">🎩</div>
                              <div style="width: 60%; display: flex; flex-direction: column; align-items: center; justify-content: center; border-left: 1px solid #e5e7eb;">
                                <div style="font-size: 11px; font-weight: bold; color: #4b5563;">Hat-Tricks</div>
                                <div style="font-size: 20px; font-weight: bold; color: #2563eb;">${stats.hatTricks}</div>
                              </div>
                            </div>
                            
                            <div style="background: white; border-radius: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.12); display: flex; height: 64px;">
                              <div style="width: 40%; display: flex; align-items: center; justify-content: center; font-size: 26px;">⭐</div>
                              <div style="width: 60%; display: flex; flex-direction: column; align-items: center; justify-content: center; border-left: 1px solid #e5e7eb;">
                                <div style="font-size: 11px; font-weight: bold; color: #4b5563;">MVP's</div>
                                <div style="font-size: 20px; font-weight: bold; color: #2563eb;">${stats.mvp}</div>
                              </div>
                            </div>
                          </div>
                          
                          <div style="margin-top: 24px;">
                            <h4 style="font-size: 20px; font-weight: bold; color: #1f2937; margin-bottom: 18px; text-align: center;">Histórico de Jogos</h4>
                            
                            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 18px;">
                              <div style="background: white; border-radius: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.12); padding: 16px; text-align: center;">
                                <div style="font-size: 22px; font-weight: bold; color: #16a34a; margin-bottom: 6px;">${historico.vitorias}</div>
                                <div style="font-size: 10px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Vitórias</div>
                              </div>
                              <div style="background: white; border-radius: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.12); padding: 16px; text-align: center;">
                                <div style="font-size: 22px; font-weight: bold; color: #f97316; margin-bottom: 6px;">${historico.empates}</div>
                                <div style="font-size: 10px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Empates</div>
                              </div>
                              <div style="background: white; border-radius: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.12); padding: 16px; text-align: center;">
                                <div style="font-size: 22px; font-weight: bold; color: #dc2626; margin-bottom: 6px;">${historico.derrotas}</div>
                                <div style="font-size: 10px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Derrotas</div>
                              </div>
                              <div style="background: white; border-radius: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.12); padding: 16px; text-align: center;">
                                <div style="font-size: 22px; font-weight: bold; color: #2563eb; margin-bottom: 6px;">${historico.taxaVitoria}%</div>
                                <div style="font-size: 10px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Taxa</div>
                              </div>
                            </div>
                            
                            <div style="background: white; border-radius: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.12); padding: 18px; margin-bottom: 18px;">
                              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                                <div style="font-size: 15px; font-weight: bold; color: #1f2937;">Últimos 5 Jogos</div>
                                <div style="display: flex; gap: 8px;">
                                  ${[...Array(5)].map((_, i) => {
                                    const jogo = historico.ultimos5[4 - i];
                                    const cor = !jogo ? '#e5e7eb' : jogo.resultado === 'V' ? '#22c55e' : jogo.resultado === 'E' ? '#eab308' : '#ef4444';
                                    return `<div style="width: 26px; height: 26px; border-radius: 50%; background: ${cor};"></div>`;
                                  }).join('')}
                                </div>
                              </div>
                              <div style="display: flex; justify-content: space-between; font-size: 13px; color: #6b7280;">
                                <span>Aproveitamento: ${historico.aproveitamentoUltimos5}%</span>
                                <span>Gols: ${historico.golsUltimos5}</span>
                              </div>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                              <div style="background: white; border-radius: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.12); display: flex; height: 64px;">
                                <div style="width: 40%; display: flex; align-items: center; justify-content: center; font-size: 26px;">🔥</div>
                                <div style="width: 60%; display: flex; flex-direction: column; align-items: center; justify-content: center; border-left: 1px solid #e5e7eb;">
                                  <div style="font-size: 11px; font-weight: bold; color: #4b5563;">Seq. Vitórias</div>
                                  <div style="font-size: 20px; font-weight: bold; color: #16a34a;">${historico.seqVitorias}</div>
                                </div>
                              </div>
                              
                              <div style="background: white; border-radius: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.12); display: flex; height: 64px;">
                                <div style="width: 40%; display: flex; align-items: center; justify-content: center; font-size: 26px;">💔</div>
                                <div style="width: 60%; display: flex; flex-direction: column; align-items: center; justify-content: center; border-left: 1px solid #e5e7eb;">
                                  <div style="font-size: 11px; font-weight: bold; color: #4b5563;">Seq. Derrotas</div>
                                  <div style="font-size: 20px; font-weight: bold; color: #dc2626;">${historico.seqDerrotas}</div>
                                </div>
                              </div>
                              
                              <div style="background: white; border-radius: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.12); display: flex; height: 64px;">
                                <div style="width: 40%; display: flex; align-items: center; justify-content: center; font-size: 26px;">🛡️</div>
                                <div style="width: 60%; display: flex; flex-direction: column; align-items: center; justify-content: center; border-left: 1px solid #e5e7eb;">
                                  <div style="font-size: 11px; font-weight: bold; color: #4b5563;">Sem Perder</div>
                                  <div style="font-size: 20px; font-weight: bold; color: #2563eb;">${historico.seqSemPerder}</div>
                                </div>
                              </div>
                              
                              <div style="background: white; border-radius: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.12); display: flex; height: 64px;">
                                <div style="width: 40%; display: flex; align-items: center; justify-content: center; font-size: 26px;">⚠️</div>
                                <div style="width: 60%; display: flex; flex-direction: column; align-items: center; justify-content: center; border-left: 1px solid #e5e7eb;">
                                  <div style="font-size: 11px; font-weight: bold; color: #4b5563;">Sem Vencer</div>
                                  <div style="font-size: 20px; font-weight: bold; color: #f97316;">${historico.seqSemVencer}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        `;
                        
                        document.body.appendChild(container);
                        await new Promise(resolve => setTimeout(resolve, 100));
                        
                        const canvas = await html2canvas(container, {
                          scale: 2,
                          backgroundColor: '#f3f4f6',
                          logging: false
                        });
                        
                        document.body.removeChild(container);
                        
                        canvas.toBlob((blob) => {
                          if (!blob) {
                            alert('Erro ao gerar imagem');
                            return;
                          }
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          const dataAtual = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
                          link.download = `estatisticas-${jogadorSelecionado.nome.replace(/\s+/g, '-')}-${dataAtual}.png`;
                          link.href = url;
                          link.click();
                          URL.revokeObjectURL(url);
                        }, 'image/png', 1.0);
                        
                      } catch (error) {
                        console.error('Erro ao gerar imagem:', error);
                        alert('Erro ao gerar imagem. Tente novamente.');
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl text-base font-bold transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Baixar Estatísticas
                  </button>
                </div>
              </>
            );
          })()}

        {/* Modal de Ranking */}
        {modalAberto && rankingSelecionado && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={fecharModal}
          >
            <div 
              className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header do Modal */}
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{rankingSelecionado.emoji}</span>
                    <h2 className="text-xl font-bold text-white">{rankingSelecionado.titulo}</h2>
                  </div>
                  {jogadorSelecionado && (() => {
                    const posicao = rankingSelecionado.dados.findIndex(item => item.nome === jogadorSelecionado.nome);
                    if (posicao !== -1) {
                      return (
                        <div className="ml-12 text-sm text-blue-100">
                          {jogadorSelecionado.nome} - {posicao + 1}º lugar
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
                <button 
                  onClick={fecharModal}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full w-8 h-8 flex items-center justify-center"
                >
                  ✕
                </button>
              </div>

              {/* Lista do Ranking */}
              <div className="overflow-y-auto max-h-[calc(80vh-80px)]">
                {rankingSelecionado.dados.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    Nenhum dado disponível
                  </div>
                ) : (
                  <div className="p-4">
                    {rankingSelecionado.dados.map((item, idx) => (
                      <div 
                        key={idx} 
                        className={`flex justify-between items-center py-3 px-3 rounded ${
                          idx === 0 ? 'bg-yellow-50 border border-yellow-200' :
                          idx === 1 ? 'bg-gray-50 border border-gray-200' :
                          idx === 2 ? 'bg-orange-50 border border-orange-200' :
                          'border-b border-gray-100'
                        } mb-2 last:mb-0`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`font-bold text-lg ${
                            idx === 0 ? 'text-yellow-600' :
                            idx === 1 ? 'text-gray-500' :
                            idx === 2 ? 'text-orange-600' :
                            'text-gray-400'
                          }`}>
                            {idx + 1}º
                          </span>
                          <div>
                            <span className="text-gray-800 font-medium">{item.nome}</span>
                            {item.detalhes && (
                              <span className="text-xs text-gray-500 ml-2">({item.detalhes})</span>
                            )}
                          </div>
                        </div>
                        <span className={`font-bold text-lg ${
                          idx === 0 ? 'text-yellow-600' :
                          idx === 1 ? 'text-gray-600' :
                          idx === 2 ? 'text-orange-600' :
                          'text-blue-600'
                        }`}>
                          {item.valor}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}