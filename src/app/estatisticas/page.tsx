'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../lib/usePermissions';

interface EstatisticasJogador {
  nome: string;
  partidas: number;
  peladas: number; // Número de dias/sessões diferentes
  totalPeladas: number; // Total de peladas que aconteceram
  golsIndividuais: number; // Gols realmente marcados pelo jogador
  golsDecisivos: number; // Gols da vitória
  presenca: number; // % de presença
  diasSeguidos: number; // Maior sequência de dias consecutivos
  regularidade: number; // Média de jogos por pelada
  jogosMVP: number; // Jogos com gol + vitória
  jogosRuins: number; // Sem gol + derrota
  jogosDeTurno: number; // Jogos onde fez diferença (gol decisivo ou salvou empate)
  vitorias: number;
  empates: number;
  derrotas: number;
  aproveitamento: number;
  mediaGolsIndividuais: number; // Média de gols individuais por jogo
  mediaGolsPorPelada: number; // Média de gols por dia/sessão
  hatTricks: number; // Jogos com 3+ gols
  sequenciaGols: number; // Maior sequência marcando gols
  jogosSemMarcar: number; // Jogos sem marcar gol
  sequenciaVitorias: number;
  sequenciaDerrotas: number;
  sequenciaSemPerder: number;
  sequenciaSemVencer: number; // Sequência ATUAL sem vencer (derrotas + empates)
  taxaVitoria: number; // %
  ultimos5: string; // Ex: "V-V-E-D-V"
  ultimos10: string;
  ultimos5Detalhado: Array<{resultado: string; cor: string}>; // [{resultado: 'V', cor: 'green'}, ...]
  ultimos10Detalhado: Array<{resultado: string; cor: string}>;
  aproveitamentoUltimos5: number;
  golsUltimos5: number;
  posicaoArtilheiro?: number;
  posicaoVitorioso?: number;
  posicaoFominha?: number;
  posicaoReiDaPelada?: number;
  posicaoMediaGols?: number;
  posicaoTaxaVitoria?: number;
  posicaoPresenca?: number;
  posicaoRegularidade?: number;
  posicaoMVP?: number;
  posicaoHatTricks?: number;
  posicaoGolsDecisivos?: number;
  posicaoSemPerder?: number;
  posicaoSemVencer?: number;
  posicaoJogosRuins?: number;
  posicaoSemMarcar?: number;
}

interface RankingJogador {
  nome: string;
  valor: number;
  emoji?: string;
}

interface RankingsColetivos {
  artilheiro: RankingJogador[];
  vitorioso: RankingJogador[];
  fominha: RankingJogador[];
  reiDaPelada: RankingJogador[];
}

export default function EstatisticasPage() {
  const router = useRouter();
  const { possuiPermissao, nomePlano, loading: loadingPermissoes } = usePermissions();
  const [busca, setBusca] = useState('');
  const [jogadorSelecionado, setJogadorSelecionado] = useState<string | null>(null);
  const [estatisticas, setEstatisticas] = useState<EstatisticasJogador | null>(null);
  const [todosJogadores, setTodosJogadores] = useState<string[]>([]);
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [rankings, setRankings] = useState<RankingsColetivos | null>(null);
  const [rankingExpandido, setRankingExpandido] = useState<{
    tipo: 'artilheiro' | 'vitorioso' | 'fominha' | 'reiDaPelada' | 'mediaGols' | 'taxaVitoria' | 'presenca' | 'mvp' | 'hatTricks' | 'golsDecisivos' | 'semPerder' | 'semVencer' | 'jogosRuins' | 'semMarcar' | null;
    dados: RankingJogador[];
  }>({ tipo: null, dados: [] });

  // Bloquear acesso para plano FREE
  useEffect(() => {
    if (!loadingPermissoes && !possuiPermissao('verEstatisticas')) {
      alert(`🚫 Estatísticas não disponíveis no plano ${nomePlano}. Faça upgrade para Gold ou Premium!`);
      router.push('/');
    }
  }, [loadingPermissoes, possuiPermissao, nomePlano, router]);

  useEffect(() => {
    carregarJogadores();
    carregarRankings();
  }, []);

  useEffect(() => {
    if (busca.trim() === '') {
      setSugestoes([]);
      return;
    }

    const filtrados = todosJogadores.filter(nome =>
      nome.toLowerCase().includes(busca.toLowerCase())
    );
    setSugestoes(filtrados.slice(0, 5));
  }, [busca, todosJogadores]);

  const carregarJogadores = async () => {
    try {
      const userData = localStorage.getItem('user');
      if (!userData) {
        router.push('/login');
        return;
      }

      const user = JSON.parse(userData);
      const peladaId = user.id;

      // Buscar todos os jogadores do banco (filtrar por pelada_id)
      const { data: jogadoresData, error } = await supabase
        .from('jogadores')
        .select('id, nome')
        .eq('pelada_id', peladaId)
        .order('nome', { ascending: true });

      if (error) {
        console.error('Erro ao buscar jogadores:', error);
        return;
      }

      if (jogadoresData) {
        console.log('Jogadores carregados:', jogadoresData);
        const nomes = jogadoresData.map(j => j.nome);
        setTodosJogadores(nomes);
      }
    } catch (error) {
      console.error('Erro ao carregar jogadores:', error);
    }
  };

  const carregarRankings = async () => {
    try {
      const userData = localStorage.getItem('user');
      if (!userData) return;

      const user = JSON.parse(userData);
      const peladaId = user.id;

      // Buscar todos os jogadores
      const { data: jogadoresData } = await supabase
        .from('jogadores')
        .select('id, nome')
        .eq('pelada_id', peladaId);

      if (!jogadoresData) return;

      // Buscar todos os jogos finalizados
      const { data: jogos } = await supabase
        .from('jogos')
        .select('*')
        .eq('status', 'finalizado');

      if (!jogos) return;

      // Buscar todos os gols
      const jogosIds = jogos.map(j => j.id);
      const { data: todosGols } = await supabase
        .from('gols')
        .select('*')
        .in('jogo_id', jogosIds);

      // Calcular estatísticas por jogador
      const estatisticasPorJogador = jogadoresData.map(jogador => {
        const jogosDoJogador = jogos.filter(jogo =>
          jogo.time_a?.includes(jogador.id) || jogo.time_b?.includes(jogador.id)
        );

        const golsDoJogador = (todosGols || []).filter(g => g.jogador_id === jogador.id);
        const totalGols = golsDoJogador.length;

        let vitorias = 0;
        jogosDoJogador.forEach(jogo => {
          const noTimeA = jogo.time_a?.includes(jogador.id);
          const placarA = jogo.placar_a || 0;
          const placarB = jogo.placar_b || 0;

          if ((noTimeA && placarA > placarB) || (!noTimeA && placarB > placarA)) {
            vitorias++;
          }
        });

        const pontuacaoRei = vitorias + totalGols;

        return {
          nome: jogador.nome,
          gols: totalGols,
          vitorias,
          partidas: jogosDoJogador.length,
          pontuacaoRei
        };
      });

      // Criar rankings top 3
      const artilheiro = estatisticasPorJogador
        .sort((a, b) => b.gols - a.gols)
        .slice(0, 3)
        .map(j => ({ nome: j.nome, valor: j.gols }));

      const vitorioso = estatisticasPorJogador
        .sort((a, b) => b.vitorias - a.vitorias)
        .slice(0, 3)
        .map(j => ({ nome: j.nome, valor: j.vitorias }));

      const fominha = estatisticasPorJogador
        .sort((a, b) => b.partidas - a.partidas)
        .slice(0, 3)
        .map(j => ({ nome: j.nome, valor: j.partidas }));

      const reiDaPelada = estatisticasPorJogador
        .sort((a, b) => b.pontuacaoRei - a.pontuacaoRei)
        .slice(0, 3)
        .map(j => ({ nome: j.nome, valor: j.pontuacaoRei }));

      setRankings({
        artilheiro,
        vitorioso,
        fominha,
        reiDaPelada
      });

    } catch (error) {
      console.error('Erro ao carregar rankings:', error);
    }
  };

  const calcularEstatisticas = async (nomeJogador: string) => {
    try {
      setLoading(true);
      const userData = localStorage.getItem('user');
      if (!userData) return;

      const user = JSON.parse(userData);
      const peladaId = user.id;

      // Buscar ID do jogador pelo nome
      const { data: jogadorData } = await supabase
        .from('jogadores')
        .select('id')
        .eq('nome', nomeJogador)
        .eq('pelada_id', peladaId)
        .single();

      if (!jogadorData) {
        console.error('Jogador não encontrado:', nomeJogador);
        setLoading(false);
        return;
      }

      const jogadorId = jogadorData.id;

      // Buscar todos os jogos (banco dedicado premium)
      const { data: jogos } = await supabase
        .from('jogos')
        .select('*')
        .eq('status', 'finalizado')
        .order('created_at', { ascending: true });

      if (!jogos) return;

      // Calcular total de peladas (todas as datas únicas)
      const todasDatasUnicas = new Set(jogos.map(j => j.created_at.split('T')[0]));
      const totalPeladas = todasDatasUnicas.size;

      // Buscar todos os gols do jogador selecionado
      const jogosIds = jogos.map(j => j.id);
      const { data: golsData } = await supabase
        .from('gols')
        .select('*')
        .in('jogo_id', jogosIds)
        .eq('jogador_id', jogadorId);

      // Buscar TODOS os gols para cálculo de rankings
      const { data: todosGolsData } = await supabase
        .from('gols')
        .select('*')
        .in('jogo_id', jogosIds);

      // Filtrar jogos onde o jogador participou (usando ID)
      const jogosDoJogador = jogos.filter(jogo =>
        jogo.time_a?.includes(jogadorId) || jogo.time_b?.includes(jogadorId)
      );

      // Calcular peladas (dias/sessões únicas onde jogou)
      const datasUnicas = new Set(jogosDoJogador.map(j => j.created_at.split('T')[0]));
      const peladas = datasUnicas.size;

      let vitorias = 0;
      let empates = 0;
      let derrotas = 0;
      let golsIndividuais = golsData?.length || 0;
      let golsDecisivos = 0;
      let hatTricks = 0;
      let jogosSemMarcar = 0;
      let jogosMVP = 0;
      let jogosRuins = 0;
      let jogosDeTurno = 0;

      // Estatísticas de sequências
      let sequenciaAtualVitorias = 0;
      let sequenciaAtualDerrotas = 0;
      let sequenciaAtualSemPerder = 0;
      let sequenciaAtualSemVencer = 0;
      let sequenciaAtualGols = 0;
      let sequenciaVitorias = 0;
      let sequenciaDerrotas = 0;
      let sequenciaSemPerder = 0;
      let sequenciaSemVencer = 0;
      let sequenciaGols = 0;

      const resultadosUltimos10: string[] = [];
      const resultadosUltimos10Detalhado: Array<{resultado: string; cor: string}> = [];

      jogosDoJogador.forEach(jogo => {
        const noTimeA = jogo.time_a?.includes(jogadorId);
        const placarA = jogo.placar_a || 0;
        const placarB = jogo.placar_b || 0;

        // Contar gols individuais no jogo
        const golsNoJogo = (golsData || []).filter(g => g.jogo_id === jogo.id).length;
        
        // Hat-trick
        if (golsNoJogo >= 3) hatTricks++;
        
        // Jogos sem marcar
        if (golsNoJogo === 0) jogosSemMarcar++;

        // Sequência de gols
        if (golsNoJogo > 0) {
          sequenciaAtualGols++;
          sequenciaGols = Math.max(sequenciaGols, sequenciaAtualGols);
        } else {
          sequenciaAtualGols = 0;
        }

        // Resultado do jogo
        let resultado = '';
        let cor = '';
        if (placarA === placarB) {
          empates++;
          resultado = 'E';
          cor = 'yellow';
          sequenciaAtualVitorias = 0;
          sequenciaAtualDerrotas = 0;
          sequenciaAtualSemPerder++;
          sequenciaAtualSemVencer++;
        } else if ((noTimeA && placarA > placarB) || (!noTimeA && placarB > placarA)) {
          vitorias++;
          resultado = 'V';
          cor = 'green';
          sequenciaAtualVitorias++;
          sequenciaAtualDerrotas = 0;
          sequenciaAtualSemPerder++;
          sequenciaAtualSemVencer = 0;
          sequenciaVitorias = Math.max(sequenciaVitorias, sequenciaAtualVitorias);
          
          // Gol decisivo: vitória por 1 gol de diferença e jogador marcou
          const diferencaGols = noTimeA ? (placarA - placarB) : (placarB - placarA);
          if (diferencaGols === 1 && golsNoJogo > 0) {
            golsDecisivos++;
            jogosDeTurno++; // Fez diferença
          }
          
          // MVP: marcou gol E venceu
          if (golsNoJogo > 0) {
            jogosMVP++;
          }
        } else {
          derrotas++;
          resultado = 'D';
          cor = 'red';
          sequenciaAtualVitorias = 0;
          sequenciaAtualDerrotas++;
          sequenciaAtualSemPerder = 0;
          sequenciaAtualSemVencer++;
          sequenciaDerrotas = Math.max(sequenciaDerrotas, sequenciaAtualDerrotas);
          
          // Jogo ruim: sem gol E derrota
          if (golsNoJogo === 0) {
            jogosRuins++;
          }
        }

        sequenciaSemPerder = Math.max(sequenciaSemPerder, sequenciaAtualSemPerder);
        sequenciaSemVencer = Math.max(sequenciaSemVencer, sequenciaAtualSemVencer);
        resultadosUltimos10.push(resultado);
        resultadosUltimos10Detalhado.push({resultado, cor});
      });

      const partidas = jogosDoJogador.length;
      const pontosGanhos = vitorias * 3 + empates;
      const pontosMaximos = partidas * 3;
      const aproveitamento = pontosMaximos > 0 ? (pontosGanhos / pontosMaximos) * 100 : 0;
      const mediaGolsIndividuais = partidas > 0 ? golsIndividuais / partidas : 0;
      const mediaGolsPorPelada = peladas > 0 ? golsIndividuais / peladas : 0;
      const taxaVitoria = partidas > 0 ? (vitorias / partidas) * 100 : 0;
      const presenca = totalPeladas > 0 ? (peladas / totalPeladas) * 100 : 0;
      const regularidade = peladas > 0 ? partidas / peladas : 0;
      
      // Calcular dias seguidos (sequência de datas consecutivas)
      const datasOrdenadas = Array.from(datasUnicas).sort();
      let diasSeguidosMax = 0;
      let diasSeguidosAtual = 1;
      
      for (let i = 1; i < datasOrdenadas.length; i++) {
        const dataAnterior = new Date(datasOrdenadas[i - 1]);
        const dataAtual = new Date(datasOrdenadas[i]);
        const diffDias = Math.floor((dataAtual.getTime() - dataAnterior.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDias === 1) {
          diasSeguidosAtual++;
          diasSeguidosMax = Math.max(diasSeguidosMax, diasSeguidosAtual);
        } else {
          diasSeguidosAtual = 1;
        }
      }
      
      const diasSeguidos = datasOrdenadas.length > 0 ? Math.max(diasSeguidosMax, 1) : 0;

      console.log('Cálculos:', {
        jogosMVP,
        jogosRuins,
        jogosDeTurno,
        presenca,
        diasSeguidos,
        regularidade
      });

      // Últimos jogos
      const ultimos10 = resultadosUltimos10.slice(-10).join('-');
      const ultimos5 = resultadosUltimos10.slice(-5).join('-');
      
      // Aproveitamento e gols dos últimos 5
      const jogosUltimos5 = jogosDoJogador.slice(-5);
      let vitoriasU5 = 0;
      let empatesU5 = 0;
      let golsU5 = 0;
      
      jogosUltimos5.forEach(jogo => {
        const noTimeA = jogo.time_a?.includes(jogadorId);
        const placarA = jogo.placar_a || 0;
        const placarB = jogo.placar_b || 0;
        
        if (placarA === placarB) empatesU5++;
        else if ((noTimeA && placarA > placarB) || (!noTimeA && placarB > placarA)) vitoriasU5++;
        
        golsU5 += (golsData || []).filter(g => g.jogo_id === jogo.id).length;
      });

      const aproveitamentoUltimos5 = jogosUltimos5.length > 0 
        ? ((vitoriasU5 * 3 + empatesU5) / (jogosUltimos5.length * 3)) * 100 
        : 0;

      // Calcular posições nos rankings coletivos - CALCULAR PARA TODOS OS JOGADORES
      let posicaoArtilheiro, posicaoVitorioso, posicaoFominha, posicaoReiDaPelada;
      let posicaoMediaGols, posicaoTaxaVitoria, posicaoPresenca, posicaoRegularidade;
      let posicaoMVP, posicaoHatTricks, posicaoGolsDecisivos, posicaoSemPerder;
      let posicaoSemVencer, posicaoJogosRuins, posicaoSemMarcar;

      // Buscar todos jogadores para calcular TODOS os rankings
      const { data: todosJogadores } = await supabase
        .from('jogadores')
        .select('id, nome')
        .eq('pelada_id', peladaId);

      if (todosJogadores) {
        interface EstatisticasRanking {
          nome: string;
          gols: number;
          vitorias: number;
          partidas: number;
          pontuacaoRei: number;
          mediaGols: number;
          taxaVitoria: number;
          presenca: number;
          regularidade: number;
          jogosMVP: number;
          hatTricks: number;
          golsDecisivos: number;
          sequenciaSemPerder: number;
          sequenciaSemVencer: number;
          jogosRuins: number;
          jogosSemMarcar: number;
          [key: string]: string | number; // Index signature para acesso dinâmico
        }

        const estatisticasTodosJogadores: EstatisticasRanking[] = [];

        for (const jogador of todosJogadores) {
          const jogosJogador = jogos.filter(jogo =>
            jogo.time_a?.includes(jogador.id) || jogo.time_b?.includes(jogador.id)
          );

          if (jogosJogador.length === 0) continue;

          const golsJogador = (todosGolsData || []).filter(g => g.jogador_id === jogador.id);
          const totalGols = golsJogador.length;
          const mediaGols = totalGols / jogosJogador.length;

            let vitoriasJogador = 0;
            let jogosMVPJogador = 0;
            let golsDecisivosJogador = 0;
            let hatTricksJogador = 0;
            let jogosRuinsJogador = 0;
            let jogosSemMarcarJogador = 0;
            let sequenciaSemPerderJogador = 0;
            let sequenciaAtual = 0;
            let sequenciaSemVencerJogador = 0;
            let sequenciaSemVencerAtual = 0;

            const datasJogos = new Set();

            jogosJogador.forEach(jogo => {
              const noTimeA = jogo.time_a?.includes(jogador.id);
              const placarA = jogo.placar_a || 0;
              const placarB = jogo.placar_b || 0;
              const golsNoJogo = golsJogador.filter(g => g.jogo_id === jogo.id).length;

              if (jogo.created_at) {
                datasJogos.add(new Date(jogo.created_at).toDateString());
              }

              const venceu = (noTimeA && placarA > placarB) || (!noTimeA && placarB > placarA);
              const perdeu = (noTimeA && placarA < placarB) || (!noTimeA && placarB < placarA);

              if (venceu) {
                vitoriasJogador++;
                sequenciaAtual++;
                sequenciaSemPerderJogador = Math.max(sequenciaSemPerderJogador, sequenciaAtual);
                sequenciaSemVencerAtual = 0;
                if (golsNoJogo > 0) jogosMVPJogador++;
              } else {
                sequenciaAtual = 0;
                sequenciaSemVencerAtual++;
              }

              if (golsNoJogo >= 3) hatTricksJogador++;
              if (golsNoJogo === 0) {
                jogosSemMarcarJogador++;
                if (perdeu) jogosRuinsJogador++;
              }

              // Gols decisivos
              if (venceu && Math.abs(placarA - placarB) === 1 && golsNoJogo > 0) {
                golsDecisivosJogador++;
              }
            });

            sequenciaSemVencerJogador = sequenciaSemVencerAtual;

            const taxaVitoria = (vitoriasJogador / jogosJogador.length) * 100;
            const presencaJogador = (datasJogos.size / totalPeladas) * 100;
            const regularidadeJogador = datasJogos.size > 0 ? jogosJogador.length / datasJogos.size : 0;
            const pontuacaoRei = vitoriasJogador + totalGols;

            estatisticasTodosJogadores.push({
              nome: jogador.nome,
              gols: totalGols,
              vitorias: vitoriasJogador,
              partidas: jogosJogador.length,
              pontuacaoRei,
              mediaGols,
              taxaVitoria,
              presenca: presencaJogador,
              regularidade: regularidadeJogador,
              jogosMVP: jogosMVPJogador,
              hatTricks: hatTricksJogador,
              golsDecisivos: golsDecisivosJogador,
              sequenciaSemPerder: sequenciaSemPerderJogador,
              sequenciaSemVencer: sequenciaSemVencerJogador,
              jogosRuins: jogosRuinsJogador,
              jogosSemMarcar: jogosSemMarcarJogador
            });
        }

        // Calcular TODAS as posições
        const calcularPosicao = (metrica: string, ordem: 'DESC' | 'ASC' = 'DESC') => {
          const sorted = [...estatisticasTodosJogadores].sort((a, b) => 
            ordem === 'DESC' ? b[metrica] - a[metrica] : a[metrica] - b[metrica]
          );
          return sorted.findIndex(j => j.nome === nomeJogador) + 1;
        };

        // Calcular todas as posições usando todos os jogadores
        posicaoArtilheiro = calcularPosicao('gols');
        posicaoVitorioso = calcularPosicao('vitorias');
        posicaoFominha = calcularPosicao('partidas');
        posicaoReiDaPelada = calcularPosicao('pontuacaoRei');
        posicaoMediaGols = calcularPosicao('mediaGols');
        posicaoTaxaVitoria = calcularPosicao('taxaVitoria');
        posicaoPresenca = calcularPosicao('presenca');
        posicaoRegularidade = calcularPosicao('regularidade');
        posicaoMVP = calcularPosicao('jogosMVP');
        posicaoHatTricks = calcularPosicao('hatTricks');
        posicaoGolsDecisivos = calcularPosicao('golsDecisivos');
        posicaoSemPerder = calcularPosicao('sequenciaSemPerder');
        posicaoSemVencer = calcularPosicao('sequenciaSemVencer', 'ASC'); // Menor é melhor
        posicaoJogosRuins = calcularPosicao('jogosRuins', 'ASC'); // Menor é melhor
        posicaoSemMarcar = calcularPosicao('jogosSemMarcar', 'ASC'); // Menor é melhor
      }

      setEstatisticas({
        nome: nomeJogador,
        partidas,
        peladas,
        totalPeladas,
        golsIndividuais,
        golsDecisivos,
        presenca,
        diasSeguidos,
        regularidade,
        jogosMVP,
        jogosRuins,
        jogosDeTurno,
        vitorias,
        empates,
        derrotas,
        aproveitamento,
        mediaGolsIndividuais,
        mediaGolsPorPelada,
        hatTricks,
        sequenciaGols,
        jogosSemMarcar,
        sequenciaVitorias,
        sequenciaDerrotas,
        sequenciaSemPerder,
        sequenciaSemVencer: sequenciaAtualSemVencer, // Mostra a sequência atual, não o máximo
        taxaVitoria,
        ultimos5,
        ultimos10,
        ultimos5Detalhado: resultadosUltimos10Detalhado.slice(-5),
        ultimos10Detalhado: resultadosUltimos10Detalhado.slice(-10),
        aproveitamentoUltimos5,
        golsUltimos5: golsU5,
        posicaoArtilheiro,
        posicaoVitorioso,
        posicaoFominha,
        posicaoReiDaPelada,
        posicaoMediaGols,
        posicaoTaxaVitoria,
        posicaoPresenca,
        posicaoRegularidade,
        posicaoMVP,
        posicaoHatTricks,
        posicaoGolsDecisivos,
        posicaoSemPerder,
        posicaoSemVencer,
        posicaoJogosRuins,
        posicaoSemMarcar
      });
    } catch (error) {
      console.error('Erro ao calcular estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  const selecionarJogador = (nome: string) => {
    setJogadorSelecionado(nome);
    setBusca(nome);
    setSugestoes([]);
    calcularEstatisticas(nome);
  };

  const limparBusca = () => {
    setBusca('');
    setJogadorSelecionado(null);
    setEstatisticas(null);
    setSugestoes([]);
  };

  const expandirRanking = async (tipo: 'artilheiro' | 'vitorioso' | 'fominha' | 'reiDaPelada' | 'mediaGols' | 'taxaVitoria' | 'presenca' | 'mvp' | 'hatTricks' | 'golsDecisivos' | 'semPerder' | 'semVencer' | 'jogosRuins' | 'semMarcar') => {
    try {
      const userData = localStorage.getItem('user');
      if (!userData) return;

      const user = JSON.parse(userData);
      const peladaId = user.id;

      // Buscar todos os jogadores
      const { data: jogadoresData } = await supabase
        .from('jogadores')
        .select('id, nome')
        .eq('pelada_id', peladaId);

      if (!jogadoresData) return;

      // Buscar todos os jogos finalizados
      const { data: jogos } = await supabase
        .from('jogos')
        .select('*')
        .eq('status', 'finalizado')
        .order('created_at', { ascending: true });

      if (!jogos) return;

      // Buscar todos os gols
      const jogosIds = jogos.map(j => j.id);
      const { data: todosGols } = await supabase
        .from('gols')
        .select('*')
        .in('jogo_id', jogosIds);

      const todasDatasUnicas = new Set(jogos.map(j => j.created_at.split('T')[0]));
      const totalPeladas = todasDatasUnicas.size;

      // Calcular estatísticas completas por jogador
      const estatisticasPorJogador = jogadoresData.map(jogador => {
        const jogosDoJogador = jogos.filter(jogo =>
          jogo.time_a?.includes(jogador.id) || jogo.time_b?.includes(jogador.id)
        );

        if (jogosDoJogador.length === 0) {
          return {
            nome: jogador.nome,
            gols: 0,
            vitorias: 0,
            partidas: 0,
            pontuacaoRei: 0,
            mediaGols: 0,
            taxaVitoria: 0,
            presenca: 0,
            regularidade: 0,
            jogosMVP: 0,
            hatTricks: 0,
            golsDecisivos: 0,
            sequenciaSemPerder: 0,
            sequenciaSemVencer: 0,
            jogosRuins: 0,
            jogosSemMarcar: 0
          };
        }

        const golsDoJogador = (todosGols || []).filter(g => g.jogador_id === jogador.id);
        const totalGols = golsDoJogador.length;

        const datasJogos = new Set(jogosDoJogador.map(j => j.created_at.split('T')[0]));
        const peladas = datasJogos.size;

        let vitorias = 0;
        let jogosMVP = 0;
        let golsDecisivos = 0;
        let hatTricks = 0;
        let jogosRuins = 0;
        let jogosSemMarcar = 0;
        let sequenciaSemPerder = 0;
        let sequenciaAtual = 0;
        let sequenciaSemVencer = 0;
        let sequenciaSemVencerAtual = 0;

        jogosDoJogador.forEach(jogo => {
          const noTimeA = jogo.time_a?.includes(jogador.id);
          const placarA = jogo.placar_a || 0;
          const placarB = jogo.placar_b || 0;
          const golsNoJogo = golsDoJogador.filter(g => g.jogo_id === jogo.id).length;

          const venceu = (noTimeA && placarA > placarB) || (!noTimeA && placarB > placarA);
          const perdeu = (noTimeA && placarA < placarB) || (!noTimeA && placarB < placarA);
          const empatou = placarA === placarB;

          if (venceu) {
            vitorias++;
            sequenciaAtual++;
            sequenciaSemPerder = Math.max(sequenciaSemPerder, sequenciaAtual);
            sequenciaSemVencerAtual = 0;
            if (golsNoJogo > 0) jogosMVP++;
            
            const diferencaGols = noTimeA ? (placarA - placarB) : (placarB - placarA);
            if (diferencaGols === 1 && golsNoJogo > 0) golsDecisivos++;
          } else if (empatou) {
            sequenciaAtual++;
            sequenciaSemPerder = Math.max(sequenciaSemPerder, sequenciaAtual);
            sequenciaSemVencerAtual++;
          } else {
            sequenciaAtual = 0;
            sequenciaSemVencerAtual++;
          }

          if (golsNoJogo >= 3) hatTricks++;
          if (golsNoJogo === 0) {
            jogosSemMarcar++;
            if (perdeu) jogosRuins++;
          }
        });

        sequenciaSemVencer = sequenciaSemVencerAtual;

        const pontuacaoRei = vitorias + totalGols;
        const mediaGols = totalGols / jogosDoJogador.length;
        const taxaVitoria = (vitorias / jogosDoJogador.length) * 100;
        const presenca = (peladas / totalPeladas) * 100;
        const regularidade = peladas > 0 ? jogosDoJogador.length / peladas : 0;

        return {
          nome: jogador.nome,
          gols: totalGols,
          vitorias,
          partidas: jogosDoJogador.length,
          pontuacaoRei,
          mediaGols,
          taxaVitoria,
          presenca,
          regularidade,
          jogosMVP,
          hatTricks,
          golsDecisivos,
          sequenciaSemPerder,
          sequenciaSemVencer,
          jogosRuins,
          jogosSemMarcar
        };
      });

      let dadosOrdenados: RankingJogador[] = [];

      switch (tipo) {
        case 'artilheiro':
          dadosOrdenados = estatisticasPorJogador
            .sort((a, b) => b.gols - a.gols)
            .map(j => ({ nome: j.nome, valor: j.gols }));
          break;
        case 'vitorioso':
          dadosOrdenados = estatisticasPorJogador
            .sort((a, b) => b.vitorias - a.vitorias)
            .map(j => ({ nome: j.nome, valor: j.vitorias }));
          break;
        case 'fominha':
          dadosOrdenados = estatisticasPorJogador
            .sort((a, b) => b.partidas - a.partidas)
            .map(j => ({ nome: j.nome, valor: j.partidas }));
          break;
        case 'reiDaPelada':
          dadosOrdenados = estatisticasPorJogador
            .sort((a, b) => b.pontuacaoRei - a.pontuacaoRei)
            .map(j => ({ nome: j.nome, valor: j.pontuacaoRei }));
          break;
        case 'mediaGols':
          dadosOrdenados = estatisticasPorJogador
            .filter(j => j.partidas > 0)
            .sort((a, b) => b.mediaGols - a.mediaGols)
            .map(j => ({ nome: j.nome, valor: j.mediaGols }));
          break;
        case 'taxaVitoria':
          dadosOrdenados = estatisticasPorJogador
            .filter(j => j.partidas > 0)
            .sort((a, b) => b.taxaVitoria - a.taxaVitoria)
            .map(j => ({ nome: j.nome, valor: j.taxaVitoria }));
          break;
        case 'presenca':
          dadosOrdenados = estatisticasPorJogador
            .sort((a, b) => b.presenca - a.presenca)
            .map(j => ({ nome: j.nome, valor: j.presenca }));
          break;
        case 'mvp':
          dadosOrdenados = estatisticasPorJogador
            .sort((a, b) => b.jogosMVP - a.jogosMVP)
            .map(j => ({ nome: j.nome, valor: j.jogosMVP }));
          break;
        case 'hatTricks':
          dadosOrdenados = estatisticasPorJogador
            .sort((a, b) => b.hatTricks - a.hatTricks)
            .map(j => ({ nome: j.nome, valor: j.hatTricks }));
          break;
        case 'golsDecisivos':
          dadosOrdenados = estatisticasPorJogador
            .sort((a, b) => b.golsDecisivos - a.golsDecisivos)
            .map(j => ({ nome: j.nome, valor: j.golsDecisivos }));
          break;
        case 'semPerder':
          dadosOrdenados = estatisticasPorJogador
            .sort((a, b) => b.sequenciaSemPerder - a.sequenciaSemPerder)
            .map(j => ({ nome: j.nome, valor: j.sequenciaSemPerder }));
          break;
        case 'semVencer':
          dadosOrdenados = estatisticasPorJogador
            .sort((a, b) => a.sequenciaSemVencer - b.sequenciaSemVencer)
            .map(j => ({ nome: j.nome, valor: j.sequenciaSemVencer }));
          break;
        case 'jogosRuins':
          dadosOrdenados = estatisticasPorJogador
            .sort((a, b) => a.jogosRuins - b.jogosRuins)
            .map(j => ({ nome: j.nome, valor: j.jogosRuins }));
          break;
        case 'semMarcar':
          dadosOrdenados = estatisticasPorJogador
            .sort((a, b) => a.jogosSemMarcar - b.jogosSemMarcar)
            .map(j => ({ nome: j.nome, valor: j.jogosSemMarcar }));
          break;
      }

      setRankingExpandido({ tipo, dados: dadosOrdenados });
    } catch (error) {
      console.error('Erro ao expandir ranking:', error);
    }
  };

  return (
    <Layout 
      title="Estatísticas"
      onAdminClick={() => {
        // Redirecionar para resultados e sinalizar que deve abrir modal admin
        sessionStorage.setItem('abrirAdminResultados', 'true');
        router.push('/resultados');
      }}
    >
      <div className="max-w-2xl mx-auto p-4">
        {/* Posições nos Rankings - FIXO NO TOPO */}
        {estatisticas && (
          <h5 className="text-lg font-semibold text-gray-700 mb-3 text-center">
            📊 Posições de {estatisticas.nome}
          </h5>
        )}
        {estatisticas ? (
          // MODO: Jogador pesquisado - mostra posições
          <div className="grid grid-cols-2 gap-3 mb-6">
            {/* 1. Artilheiro */}
            <div className="bg-gray-50 rounded-lg border border-gray-200 flex h-20">
              <div className="w-2/5 flex items-center justify-center">
                <div className="text-3xl">⚽</div>
              </div>
              <div className="w-3/5 flex flex-col items-center justify-center p-2">
                <div className="text-lg font-bold text-gray-800">{estatisticas.posicaoArtilheiro || '-'}º</div>
                <div className="text-[10px] text-gray-600 text-center leading-tight">ARTILHEIRO</div>
              </div>
            </div>

            {/* 2. Vitorioso */}
            <div className="bg-gray-50 rounded-lg border border-gray-200 flex h-20">
              <div className="w-2/5 flex items-center justify-center">
                <div className="text-3xl">🏆</div>
              </div>
              <div className="w-3/5 flex flex-col items-center justify-center p-2">
                <div className="text-lg font-bold text-gray-800">{estatisticas.posicaoVitorioso || '-'}º</div>
                <div className="text-[10px] text-gray-600 text-center leading-tight">VITORIOSO</div>
              </div>
            </div>

            {/* 3. Média de Gols */}
            <div className="bg-gray-50 rounded-lg border border-gray-200 flex h-20">
              <div className="w-2/5 flex items-center justify-center">
                <div className="text-3xl">📊</div>
              </div>
              <div className="w-3/5 flex flex-col items-center justify-center p-2">
                <div className="text-lg font-bold text-gray-800">{estatisticas.posicaoMediaGols || '-'}º</div>
                <div className="text-[10px] text-gray-600 text-center leading-tight">MÉDIA GOLS</div>
              </div>
            </div>

            {/* 4. Fominha */}
            <div className="bg-gray-50 rounded-lg border border-gray-200 flex h-20">
              <div className="w-2/5 flex items-center justify-center">
                <div className="text-3xl">🏃</div>
              </div>
              <div className="w-3/5 flex flex-col items-center justify-center p-2">
                <div className="text-lg font-bold text-gray-800">{estatisticas.posicaoFominha || '-'}º</div>
                <div className="text-[10px] text-gray-600 text-center leading-tight">FOMINHA</div>
              </div>
            </div>

            {/* 5. Rei da Pelada */}
            <div className="bg-gray-50 rounded-lg border border-gray-200 flex h-20">
              <div className="w-2/5 flex items-center justify-center">
                <div className="text-3xl">👑</div>
              </div>
              <div className="w-3/5 flex flex-col items-center justify-center p-2">
                <div className="text-lg font-bold text-gray-800">{estatisticas.posicaoReiDaPelada || '-'}º</div>
                <div className="text-[10px] text-gray-600 text-center leading-tight">REI DA PELADA</div>
              </div>
            </div>

            {/* 6. MVP */}
            <div className="bg-gray-50 rounded-lg border border-gray-200 flex h-20">
              <div className="w-2/5 flex items-center justify-center">
                <div className="text-3xl">🌟</div>
              </div>
              <div className="w-3/5 flex flex-col items-center justify-center p-2">
                <div className="text-lg font-bold text-gray-800">{estatisticas.posicaoMVP || '-'}º</div>
                <div className="text-[10px] text-gray-600 text-center leading-tight">MVP</div>
              </div>
            </div>

            {/* 7. Hat-tricks */}
            <div className="bg-gray-50 rounded-lg border border-gray-200 flex h-20">
              <div className="w-2/5 flex items-center justify-center">
                <div className="text-3xl">🎩</div>
              </div>
              <div className="w-3/5 flex flex-col items-center justify-center p-2">
                <div className="text-lg font-bold text-gray-800">{estatisticas.posicaoHatTricks || '-'}º</div>
                <div className="text-[10px] text-gray-600 text-center leading-tight">HAT-TRICKS</div>
              </div>
            </div>

            {/* 8. Gols Decisivos */}
            <div className="bg-gray-50 rounded-lg border border-gray-200 flex h-20">
              <div className="w-2/5 flex items-center justify-center">
                <div className="text-3xl">💎</div>
              </div>
              <div className="w-3/5 flex flex-col items-center justify-center p-2">
                <div className="text-lg font-bold text-gray-800">{estatisticas.posicaoGolsDecisivos || '-'}º</div>
                <div className="text-[10px] text-gray-600 text-center leading-tight">DECISIVOS</div>
              </div>
            </div>

            {/* 9. Taxa de Vitória */}
            <div className="bg-gray-50 rounded-lg border border-gray-200 flex h-20">
              <div className="w-2/5 flex items-center justify-center">
                <div className="text-3xl">🎯</div>
              </div>
              <div className="w-3/5 flex flex-col items-center justify-center p-2">
                <div className="text-lg font-bold text-gray-800">{estatisticas.posicaoTaxaVitoria || '-'}º</div>
                <div className="text-[10px] text-gray-600 text-center leading-tight">TAXA VITÓRIA</div>
              </div>
            </div>

            {/* 10. Presença */}
            <div className="bg-gray-50 rounded-lg border border-gray-200 flex h-20">
              <div className="w-2/5 flex items-center justify-center">
                <div className="text-3xl">📆</div>
              </div>
              <div className="w-3/5 flex flex-col items-center justify-center p-2">
                <div className="text-lg font-bold text-gray-800">{estatisticas.posicaoPresenca || '-'}º</div>
                <div className="text-[10px] text-gray-600 text-center leading-tight">PRESENÇA</div>
              </div>
            </div>

            {/* 11. Sem Perder */}
            <div className="bg-gray-50 rounded-lg border border-gray-200 flex h-20">
              <div className="w-2/5 flex items-center justify-center">
                <div className="text-3xl">🛡️</div>
              </div>
              <div className="w-3/5 flex flex-col items-center justify-center p-2">
                <div className="text-lg font-bold text-gray-800">{estatisticas.posicaoSemPerder || '-'}º</div>
                <div className="text-[10px] text-gray-600 text-center leading-tight">SEM PERDER</div>
              </div>
            </div>

            {/* 12. Sem Vencer */}
            <div className="bg-gray-50 rounded-lg border border-gray-200 flex h-20">
              <div className="w-2/5 flex items-center justify-center">
                <div className="text-3xl">📉</div>
              </div>
              <div className="w-3/5 flex flex-col items-center justify-center p-2">
                <div className="text-lg font-bold text-gray-800">{estatisticas.posicaoSemVencer || '-'}º</div>
                <div className="text-[10px] text-gray-600 text-center leading-tight">SEM VENCER</div>
              </div>
            </div>
          </div>
        ) : (
          // MODO: Sem jogador - mostra botões clicáveis para abrir rankings
          <div className="grid grid-cols-2 gap-3 mb-6">
            {/* 1. Artilheiro */}
            <button
              onClick={() => expandirRanking('artilheiro')}
              className="bg-gray-50 rounded-lg border border-gray-200 flex h-20 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <div className="w-2/5 flex items-center justify-center">
                <div className="text-3xl">⚽</div>
              </div>
              <div className="w-3/5 flex flex-col items-center justify-center p-2">
                <div className="text-[10px] text-gray-600 text-center leading-tight">ARTILHEIRO</div>
              </div>
            </button>

            {/* 2. Vitorioso */}
            <button
              onClick={() => expandirRanking('vitorioso')}
              className="bg-gray-50 rounded-lg border border-gray-200 flex h-20 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <div className="w-2/5 flex items-center justify-center">
                <div className="text-3xl">🏆</div>
              </div>
              <div className="w-3/5 flex flex-col items-center justify-center p-2">
                <div className="text-[10px] text-gray-600 text-center leading-tight">VITORIOSO</div>
              </div>
            </button>

            {/* 3. Média de Gols */}
            <button
              onClick={() => expandirRanking('mediaGols')}
              className="bg-gray-50 rounded-lg border border-gray-200 flex h-20 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <div className="w-2/5 flex items-center justify-center">
                <div className="text-3xl">📊</div>
              </div>
              <div className="w-3/5 flex flex-col items-center justify-center p-2">
                <div className="text-[10px] text-gray-600 text-center leading-tight">MÉDIA GOLS</div>
              </div>
            </button>

            {/* 4. Fominha */}
            <button
              onClick={() => expandirRanking('fominha')}
              className="bg-gray-50 rounded-lg border border-gray-200 flex h-20 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <div className="w-2/5 flex items-center justify-center">
                <div className="text-3xl">🏃</div>
              </div>
              <div className="w-3/5 flex flex-col items-center justify-center p-2">
                <div className="text-[10px] text-gray-600 text-center leading-tight">FOMINHA</div>
              </div>
            </button>

            {/* 5. Rei da Pelada */}
            <button
              onClick={() => expandirRanking('reiDaPelada')}
              className="bg-gray-50 rounded-lg border border-gray-200 flex h-20 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <div className="w-2/5 flex items-center justify-center">
                <div className="text-3xl">👑</div>
              </div>
              <div className="w-3/5 flex flex-col items-center justify-center p-2">
                <div className="text-[10px] text-gray-600 text-center leading-tight">REI DA PELADA</div>
              </div>
            </button>

            {/* 6. MVP */}
            <button
              onClick={() => expandirRanking('mvp')}
              className="bg-gray-50 rounded-lg border border-gray-200 flex h-20 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <div className="w-2/5 flex items-center justify-center">
                <div className="text-3xl">🌟</div>
              </div>
              <div className="w-3/5 flex flex-col items-center justify-center p-2">
                <div className="text-[10px] text-gray-600 text-center leading-tight">MVP</div>
              </div>
            </button>

            {/* 7. Hat-tricks */}
            <button
              onClick={() => expandirRanking('hatTricks')}
              className="bg-gray-50 rounded-lg border border-gray-200 flex h-20 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <div className="w-2/5 flex items-center justify-center">
                <div className="text-3xl">🎩</div>
              </div>
              <div className="w-3/5 flex flex-col items-center justify-center p-2">
                <div className="text-[10px] text-gray-600 text-center leading-tight">HAT-TRICKS</div>
              </div>
            </button>

            {/* 8. Gols Decisivos */}
            <button
              onClick={() => expandirRanking('golsDecisivos')}
              className="bg-gray-50 rounded-lg border border-gray-200 flex h-20 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <div className="w-2/5 flex items-center justify-center">
                <div className="text-3xl">💎</div>
              </div>
              <div className="w-3/5 flex flex-col items-center justify-center p-2">
                <div className="text-[10px] text-gray-600 text-center leading-tight">DECISIVOS</div>
              </div>
            </button>

            {/* 9. Taxa de Vitória */}
            <button
              onClick={() => expandirRanking('taxaVitoria')}
              className="bg-gray-50 rounded-lg border border-gray-200 flex h-20 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <div className="w-2/5 flex items-center justify-center">
                <div className="text-3xl">🎯</div>
              </div>
              <div className="w-3/5 flex flex-col items-center justify-center p-2">
                <div className="text-[10px] text-gray-600 text-center leading-tight">TAXA VITÓRIA</div>
              </div>
            </button>

            {/* 10. Presença */}
            <button
              onClick={() => expandirRanking('presenca')}
              className="bg-gray-50 rounded-lg border border-gray-200 flex h-20 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <div className="w-2/5 flex items-center justify-center">
                <div className="text-3xl">📆</div>
              </div>
              <div className="w-3/5 flex flex-col items-center justify-center p-2">
                <div className="text-[10px] text-gray-600 text-center leading-tight">PRESENÇA</div>
              </div>
            </button>

            {/* 11. Sem Perder */}
            <button
              onClick={() => expandirRanking('semPerder')}
              className="bg-gray-50 rounded-lg border border-gray-200 flex h-20 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <div className="w-2/5 flex items-center justify-center">
                <div className="text-3xl">🛡️</div>
              </div>
              <div className="w-3/5 flex flex-col items-center justify-center p-2">
                <div className="text-[10px] text-gray-600 text-center leading-tight">SEM PERDER</div>
              </div>
            </button>

            {/* 12. Sem Vencer */}
            <button
              onClick={() => expandirRanking('semVencer')}
              className="bg-gray-50 rounded-lg border border-gray-200 flex h-20 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <div className="w-2/5 flex items-center justify-center">
                <div className="text-3xl">📉</div>
              </div>
              <div className="w-3/5 flex flex-col items-center justify-center p-2">
                <div className="text-[10px] text-gray-600 text-center leading-tight">SEM VENCER</div>
              </div>
            </button>
          </div>
        )}

        {/* Modal Ranking Expandido */}
        {rankingExpandido.tipo && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-4 text-white">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">
                    {rankingExpandido.tipo === 'artilheiro' && '👑 ARTILHEIRO - Ranking Completo'}
                    {rankingExpandido.tipo === 'vitorioso' && '🏆 VITORIOSO - Ranking Completo'}
                    {rankingExpandido.tipo === 'fominha' && '⚽ FOMINHA - Ranking Completo'}
                    {rankingExpandido.tipo === 'reiDaPelada' && '👑 REI DA PELADA - Ranking Completo'}
                    {rankingExpandido.tipo === 'mediaGols' && '📊 MÉDIA DE GOLS - Ranking Completo'}
                    {rankingExpandido.tipo === 'taxaVitoria' && '💯 TAXA DE VITÓRIA - Ranking Completo'}
                    {rankingExpandido.tipo === 'presenca' && '📆 PRESENÇA - Ranking Completo'}
                    {rankingExpandido.tipo === 'regularidade' && '🔄 REGULARIDADE - Ranking Completo'}
                    {rankingExpandido.tipo === 'mvp' && '🌟 MVP - Ranking Completo'}
                    {rankingExpandido.tipo === 'hatTricks' && '🎩 HAT-TRICKS - Ranking Completo'}
                    {rankingExpandido.tipo === 'golsDecisivos' && '💎 GOLS DECISIVOS - Ranking Completo'}
                    {rankingExpandido.tipo === 'semPerder' && '🛡️ SEM PERDER - Ranking Completo'}
                    {rankingExpandido.tipo === 'semVencer' && '📉 SEM VENCER - Ranking Completo'}
                    {rankingExpandido.tipo === 'jogosRuins' && '😞 JOGOS RUINS - Ranking Completo'}
                    {rankingExpandido.tipo === 'semMarcar' && '❌ SEM MARCAR - Ranking Completo'}
                  </h3>
                  <button
                    onClick={() => setRankingExpandido({ tipo: null, dados: [] })}
                    className="text-white hover:text-gray-200 text-2xl"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="overflow-y-auto max-h-[calc(80vh-80px)] p-4">
                <div className="space-y-2">
                  {rankingExpandido.dados.map((jogador, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        idx < 3 ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50 border border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}º`}
                        </span>
                        <span className="text-sm font-medium text-gray-800">{jogador.nome}</span>
                      </div>
                      <span className="text-sm font-bold text-orange-600">
                        {typeof jogador.valor === 'number' && jogador.valor % 1 !== 0 
                          ? jogador.valor.toFixed(2) 
                          : jogador.valor}
                        {rankingExpandido.tipo === 'artilheiro' && ' gols'}
                        {rankingExpandido.tipo === 'vitorioso' && ' vitórias'}
                        {rankingExpandido.tipo === 'fominha' && ' jogos'}
                        {rankingExpandido.tipo === 'reiDaPelada' && ' pts'}
                        {rankingExpandido.tipo === 'taxaVitoria' && '%'}
                        {rankingExpandido.tipo === 'presenca' && '%'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Busca */}
        <section className="bg-white rounded-xl shadow-md border border-gray-200 p-4 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">🔍 Buscar Jogador</h3>
          
          <div className="relative">
            <div className="flex gap-2">
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Digite o nome do jogador..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              {busca && (
                <button
                  onClick={limparBusca}
                  className="px-4 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Sugestões */}
            {sugestoes.length > 0 && (
              <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {sugestoes.map(nome => (
                  <button
                    key={nome}
                    onClick={() => selecionarJogador(nome)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                  >
                    {nome}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">⏳</div>
            <div className="text-gray-600">Calculando estatísticas...</div>
          </div>
        )}

        {/* Estatísticas do jogador */}
        {!loading && estatisticas && (
          <div className="space-y-4">
            {/* Estatísticas Básicas */}
            <section className="bg-white rounded-xl shadow-md border border-gray-200 p-4">
              <h5 className="text-lg font-semibold text-gray-700 mb-3 text-center">Estatísticas Básicas</h5>
              <div className="grid grid-cols-2 gap-3">
                {/* Partidas */}
                <div className="bg-gray-50 rounded-lg border border-gray-200 flex h-20">
                  <div className="w-2/5 flex items-center justify-center">
                    <div className="text-3xl">🥅</div>
                  </div>
                  <div className="w-3/5 flex flex-col items-center justify-center p-2">
                    <div className="text-lg font-bold text-gray-800">{estatisticas?.partidas || 0}</div>
                    <div className="text-[10px] text-gray-600 text-center leading-tight">PARTIDAS</div>
                  </div>
                </div>

                {/* Peladas */}
                <div className="bg-gray-50 rounded-lg border border-gray-200 flex h-20">
                  <div className="w-2/5 flex items-center justify-center">
                    <div className="text-3xl">📅</div>
                  </div>
                  <div className="w-3/5 flex flex-col items-center justify-center p-2">
                    <div className="text-lg font-bold text-gray-800">{estatisticas?.peladas || 0}/{estatisticas?.totalPeladas || 0}</div>
                    <div className="text-[10px] text-gray-600 text-center leading-tight">PELADAS</div>
                  </div>
                </div>

                {/* Gols Individuais */}
                <div className="bg-gray-50 rounded-lg border border-gray-200 flex h-20">
                  <div className="w-2/5 flex items-center justify-center">
                    <div className="text-3xl">⚽</div>
                  </div>
                  <div className="w-3/5 flex flex-col items-center justify-center p-2">
                    <div className="text-lg font-bold text-gray-800">{estatisticas?.golsIndividuais || 0}</div>
                    <div className="text-[10px] text-gray-600 text-center leading-tight">GOLS</div>
                  </div>
                </div>

                {/* Média Gols/Jogo */}
                <div className="bg-gray-50 rounded-lg border border-gray-200 flex h-20">
                  <div className="w-2/5 flex items-center justify-center">
                    <div className="text-3xl">📊</div>
                  </div>
                  <div className="w-3/5 flex flex-col items-center justify-center p-2">
                    <div className="text-lg font-bold text-gray-800">{(estatisticas?.mediaGolsIndividuais || 0).toFixed(2)}</div>
                    <div className="text-[10px] text-gray-600 text-center leading-tight">MÉDIA/JOGO</div>
                  </div>
                </div>

                {/* Média Gols/Pelada */}
                <div className="bg-gray-50 rounded-lg border border-gray-200 flex h-20">
                  <div className="w-2/5 flex items-center justify-center">
                    <div className="text-3xl">📈</div>
                  </div>
                  <div className="w-3/5 flex flex-col items-center justify-center p-2">
                    <div className="text-lg font-bold text-gray-800">{(estatisticas?.mediaGolsPorPelada || 0).toFixed(2)}</div>
                    <div className="text-[10px] text-gray-600 text-center leading-tight">MÉDIA/PELADA</div>
                  </div>
                </div>

                {/* Hat-tricks */}
                <div className="bg-gray-50 rounded-lg border border-gray-200 flex h-20">
                  <div className="w-2/5 flex items-center justify-center">
                    <div className="text-3xl">🎩</div>
                  </div>
                  <div className="w-3/5 flex flex-col items-center justify-center p-2">
                    <div className="text-lg font-bold text-gray-800">{estatisticas?.hatTricks || 0}</div>
                    <div className="text-[10px] text-gray-600 text-center leading-tight">HAT-TRICKS</div>
                  </div>
                </div>

                {/* Gols Decisivos */}
                <div className="bg-gray-50 rounded-lg border border-gray-200 flex h-20">
                  <div className="w-2/5 flex items-center justify-center">
                    <div className="text-3xl">🎯</div>
                  </div>
                  <div className="w-3/5 flex flex-col items-center justify-center p-2">
                    <div className="text-lg font-bold text-gray-800">{estatisticas?.golsDecisivos || 0}</div>
                    <div className="text-[10px] text-gray-600 text-center leading-tight">GOLS DECISIVOS</div>
                  </div>
                </div>

                {/* Jogos Sem Marcar */}
                <div className="bg-gray-50 rounded-lg border border-gray-200 flex h-20">
                  <div className="w-2/5 flex items-center justify-center">
                    <div className="text-3xl">❌</div>
                  </div>
                  <div className="w-3/5 flex flex-col items-center justify-center p-2">
                    <div className="text-lg font-bold text-gray-800">{estatisticas?.jogosSemMarcar || 0}</div>
                    <div className="text-[10px] text-gray-600 text-center leading-tight">SEM GOL</div>
                  </div>
                </div>

                {/* Presença */}
                <div className="bg-gray-50 rounded-lg border border-gray-200 flex h-20">
                  <div className="w-2/5 flex items-center justify-center">
                    <div className="text-3xl">📆</div>
                  </div>
                  <div className="w-3/5 flex flex-col items-center justify-center p-2">
                    <div className="text-lg font-bold text-gray-800">{(estatisticas.presenca || 0).toFixed(1)}%</div>
                    <div className="text-[10px] text-gray-600 text-center leading-tight">PRESENÇA</div>
                  </div>
                </div>

                {/* Dias Seguidos */}
                <div className="bg-gray-50 rounded-lg border border-gray-200 flex h-20">
                  <div className="w-2/5 flex items-center justify-center">
                    <div className="text-3xl">🔥</div>
                  </div>
                  <div className="w-3/5 flex flex-col items-center justify-center p-2">
                    <div className="text-lg font-bold text-gray-800">{estatisticas.diasSeguidos || 0}</div>
                    <div className="text-[10px] text-gray-600 text-center leading-tight">DIAS SEGUIDOS</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Vitórias e Derrotas + Forma Atual */}
            <section className="bg-white rounded-xl shadow-md border border-gray-200 p-4">
              <h5 className="text-lg font-semibold text-gray-700 mb-3 text-center">Vitórias e Derrotas</h5>
              
            {/* Estatísticas em linha */}
              <div className="flex justify-between gap-2 mb-4">
                {/* Vitórias */}
                <div className="flex-1 bg-gray-50 rounded-lg border border-gray-200 p-2 text-center">
                  <div className="text-xl font-bold text-green-600">{estatisticas?.vitorias || 0}</div>
                  <div className="text-[9px] text-gray-600 leading-tight">VITÓRIAS</div>
                </div>

                {/* Empates */}
                <div className="flex-1 bg-gray-50 rounded-lg border border-gray-200 p-2 text-center">
                  <div className="text-xl font-bold text-yellow-600">{estatisticas?.empates || 0}</div>
                  <div className="text-[9px] text-gray-600 leading-tight">EMPATES</div>
                </div>

                {/* Derrotas */}
                <div className="flex-1 bg-gray-50 rounded-lg border border-gray-200 p-2 text-center">
                  <div className="text-xl font-bold text-red-600">{estatisticas?.derrotas || 0}</div>
                  <div className="text-[9px] text-gray-600 leading-tight">DERROTAS</div>
                </div>

                {/* Taxa de Vitória */}
                <div className="flex-1 bg-gray-50 rounded-lg border border-gray-200 p-2 text-center">
                  <div className="text-xl font-bold text-gray-800">{(estatisticas.taxaVitoria || 0).toFixed(1)}%</div>
                  <div className="text-[9px] text-gray-600 leading-tight">TAXA</div>
                </div>
              </div>

            {/* Forma Atual */}
              <div className="space-y-3">
                {/* Últimos 5 */}
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold text-gray-700">Últimos 5 Jogos</span>
                    <div className="flex gap-1">
                      {(estatisticas.ultimos5Detalhado || []).map((item, idx) => (
                        <div
                          key={idx}
                          className={`w-5 h-5 rounded-full ${
                            item.cor === 'green' ? 'bg-green-500' :
                            item.cor === 'yellow' ? 'bg-yellow-400' : 'bg-red-500'
                          }`}
                          title={item.resultado === 'V' ? 'Vitória' : item.resultado === 'E' ? 'Empate' : 'Derrota'}
                        ></div>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-between text-[9px] text-gray-600">
                    <span>Aproveitamento: {(estatisticas.aproveitamentoUltimos5 || 0).toFixed(1)}%</span>
                    <span>Gols: {estatisticas.golsUltimos5 || 0}</span>
                  </div>
                </div>

                {/* Últimos 10 */}
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-gray-700">Últimos 10 Jogos</span>
                    <div className="flex gap-1">
                      {(estatisticas.ultimos10Detalhado || []).map((item, idx) => (
                        <div
                          key={idx}
                          className={`w-5 h-5 rounded-full ${
                            item.cor === 'green' ? 'bg-green-500' :
                            item.cor === 'yellow' ? 'bg-yellow-400' : 'bg-red-500'
                          }`}
                          title={item.resultado === 'V' ? 'Vitória' : item.resultado === 'E' ? 'Empate' : 'Derrota'}
                        ></div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

            {/* Sequências (sem título separado) */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                {/* Seq Vitórias */}
                <div className="bg-gray-50 rounded-lg border border-gray-200 flex h-20">
                  <div className="w-2/5 flex items-center justify-center">
                    <div className="text-3xl">🏆</div>
                  </div>
                  <div className="w-3/5 flex flex-col items-center justify-center p-2">
                    <div className="text-lg font-bold text-gray-800">{estatisticas?.sequenciaVitorias || 0}</div>
                    <div className="text-[10px] text-gray-600 text-center leading-tight">SEQ. VITÓRIAS</div>
                  </div>
                </div>

                {/* Seq Derrotas */}
                <div className="bg-gray-50 rounded-lg border border-gray-200 flex h-20">
                  <div className="w-2/5 flex items-center justify-center">
                    <div className="text-3xl">📉</div>
                  </div>
                  <div className="w-3/5 flex flex-col items-center justify-center p-2">
                    <div className="text-lg font-bold text-gray-800">{estatisticas?.sequenciaDerrotas || 0}</div>
                    <div className="text-[10px] text-gray-600 text-center leading-tight">SEQ. DERROTAS</div>
                  </div>
                </div>

                {/* Seq Sem Perder */}
                <div className="bg-gray-50 rounded-lg border border-gray-200 flex h-20">
                  <div className="w-2/5 flex items-center justify-center">
                    <div className="text-3xl">🛡️</div>
                  </div>
                  <div className="w-3/5 flex flex-col items-center justify-center p-2">
                    <div className="text-lg font-bold text-gray-800">{estatisticas?.sequenciaSemPerder || 0}</div>
                    <div className="text-[10px] text-gray-600 text-center leading-tight">SEM PERDER</div>
                  </div>
                </div>

                {/* Seq Sem Vencer */}
                <div className="bg-gray-50 rounded-lg border border-gray-200 flex h-20">
                  <div className="w-2/5 flex items-center justify-center">
                    <div className="text-3xl">🚫</div>
                  </div>
                  <div className="w-3/5 flex flex-col items-center justify-center p-2">
                    <div className="text-lg font-bold text-gray-800">{estatisticas.sequenciaSemVencer || 0}</div>
                    <div className="text-[10px] text-gray-600 text-center leading-tight">SEM VENCER</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Performance */}
            <section className="bg-white rounded-xl shadow-md border border-gray-200 p-4">
              <h5 className="text-lg font-semibold text-gray-700 mb-3 text-center">Performance</h5>
              <div className="grid grid-cols-2 gap-3">
                {/* Regularidade */}
                <div className="bg-gray-50 rounded-lg border border-gray-200 flex h-20">
                  <div className="w-2/5 flex items-center justify-center">
                    <div className="text-3xl">🔄</div>
                  </div>
                  <div className="w-3/5 flex flex-col items-center justify-center p-2">
                    <div className="text-lg font-bold text-gray-800">{(estatisticas.regularidade || 0).toFixed(1)}</div>
                    <div className="text-[10px] text-gray-600 text-center leading-tight">JOGOS/PELADA</div>
                  </div>
                </div>

                {/* MVP */}
                <div className="bg-gray-50 rounded-lg border border-gray-200 flex h-20">
                  <div className="w-2/5 flex items-center justify-center">
                    <div className="text-3xl">🌟</div>
                  </div>
                  <div className="w-3/5 flex flex-col items-center justify-center p-2">
                    <div className="text-lg font-bold text-gray-800">{estatisticas.jogosMVP || 0}</div>
                    <div className="text-[10px] text-gray-600 text-center leading-tight">MVP (GOL+VIT)</div>
                  </div>
                </div>

                {/* Jogos Ruins */}
                <div className="bg-gray-50 rounded-lg border border-gray-200 flex h-20">
                  <div className="w-2/5 flex items-center justify-center">
                    <div className="text-3xl">😞</div>
                  </div>
                  <div className="w-3/5 flex flex-col items-center justify-center p-2">
                    <div className="text-lg font-bold text-gray-800">{estatisticas.jogosRuins || 0}</div>
                    <div className="text-[10px] text-gray-600 text-center leading-tight">RUINS (0GOL+DER)</div>
                  </div>
                </div>

                {/* Jogos de Turno */}
                <div className="bg-gray-50 rounded-lg border border-gray-200 flex h-20">
                  <div className="w-2/5 flex items-center justify-center">
                    <div className="text-3xl">💎</div>
                  </div>
                  <div className="w-3/5 flex flex-col items-center justify-center p-2">
                    <div className="text-lg font-bold text-gray-800">{estatisticas.jogosDeTurno || 0}</div>
                    <div className="text-[10px] text-gray-600 text-center leading-tight">DECISIVOS</div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Estado vazio */}
        {!loading && !estatisticas && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Busque um jogador</h3>
            <p className="text-gray-600">Digite o nome de um jogador para ver suas estatísticas</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
