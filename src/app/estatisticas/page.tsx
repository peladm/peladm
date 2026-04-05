'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { getClienteSupabase } from '../../lib/supabase';
import { usePermissions } from '../../lib/usePermissions';
import { buscar_pelada_id } from '../../lib/credenciais';

interface Estatistica {
  id: string;
  emoji: string;
  icone?: string;
  nome: string;
  descricao: string;
  primeiroColocado: string;
  ranking: RankingItem[];
}

interface RankingItem {
  posicao: number;
  nome: string;
  valor: string | number;
}

interface Jogador {
  id: string;
  nome: string;
  apelido?: string;
  nivel?: number; // Classificação do jogador (1-5)
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

export default function Estatisticas() {
  const DEBUG = false;
  const STORAGE_KEY = 'peladm:estatisticas:state:v1';
  const router = useRouter();
  const { possuiPermissao, nomePlano, loading: loadingPermissoes } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [estatisticas, setEstatisticas] = useState<Estatistica[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [estatisticaSelecionada, setEstatisticaSelecionada] = useState<Estatistica | null>(null);

  // Dados brutos
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [jogosFiltrados, setJogosFiltrados] = useState<Jogo[]>([]);
  const [jogadores, setJogadores] = useState<{ [id: string]: Jogador }>({});

  // Estados para filtros
  const [filtro, setFiltro] = useState<'atual' | 'mes' | 'ultimas' | 'ano' | 'historia'>('atual');
  const [dataSelecionada, setDataSelecionada] = useState('');
  const [datasDisponiveis, setDatasDisponiveis] = useState<string[]>([]);
  const [mesesDisponiveis, setMesesDisponiveis] = useState<string[]>([]);
  const [anosDisponiveis, setAnosDisponiveis] = useState<string[]>([]);
  const [periodoSelecionado, setPeriodoSelecionado] = useState('');
  const [quantidadePeladas, setQuantidadePeladas] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.filtro) setFiltro(saved.filtro);
      if (typeof saved.dataSelecionada === 'string') setDataSelecionada(saved.dataSelecionada);
      if (typeof saved.periodoSelecionado === 'string') setPeriodoSelecionado(saved.periodoSelecionado);
      if (typeof saved.quantidadePeladas === 'string') setQuantidadePeladas(saved.quantidadePeladas);
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
    }));
  }, [filtro, dataSelecionada, periodoSelecionado, quantidadePeladas]);

  // Bloquear acesso para plano FREE
  useEffect(() => {
    if (!loadingPermissoes && !possuiPermissao('verEstatisticas')) {
      alert(`🚫 Estatísticas não disponível no plano ${nomePlano}. Faça upgrade para Premium!`);
      router.push('/');
    }
  }, [loadingPermissoes, possuiPermissao, nomePlano, router]);

  useEffect(() => {
    carregarDados();
  }, []);

  useEffect(() => {
    aplicarFiltro();
  }, [filtro, dataSelecionada, periodoSelecionado, quantidadePeladas, jogos]);

  useEffect(() => {
    calcularEstatisticas();
  }, [jogosFiltrados, jogadores]);

  const abrirModal = (estatistica: Estatistica) => {
    setEstatisticaSelecionada(estatistica);
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setEstatisticaSelecionada(null);
  };

  const obterCoresEstatistica = (id: string) => {
    const negativas = new Set(['soDerrota', 'bolaMurcha']);

    if (negativas.has(id)) {
      return {
        fundoNome: 'bg-gradient-to-br from-red-50 to-rose-100',
        textoNome: 'text-red-700',
      };
    }

    return {
      fundoNome: 'bg-gradient-to-br from-green-50 to-emerald-100',
      textoNome: 'text-green-700',
    };
  };

  const buscarJogador = (jogadorId: any): string => {
    // Se for objeto com nome, retornar nome diretamente
    if (typeof jogadorId === 'object' && jogadorId?.nome) {
      return jogadorId.apelido || jogadorId.nome;
    }
    
    // Se for string, buscar no map
    const idStr = String(jogadorId);
    const jogador = jogadores[idStr];
    
    if (jogador) {
      return jogador.apelido || jogador.nome;
    }
    
    // Fallback: retornar os primeiros 8 caracteres do ID
    if (DEBUG) console.warn(`⚠️ Jogador não encontrado para ID: ${idStr.substring(0, 20)}`);
    return idStr.substring(0, 8);
  };

  const formatarPrimeiroColocado = (ranking: RankingItem[]): string => {
    if (ranking.length === 0) return '-';
    
    const primeiro = ranking[0];
    
    // Contar quantos jogadores têm o mesmo valor do primeiro
    const empatados = ranking.filter(item => item.valor === primeiro.valor);
    
    if (empatados.length === 1) {
      // Sem empate
      return primeiro.nome;
    } else if (empatados.length === 2) {
      // Empate entre 2: mostrar "Nome1 / Nome2"
      return `${empatados[0].nome} / ${empatados[1].nome}`;
    } else {
      // Empate entre 3 ou mais: mostrar "Nome1 e +X"
      const outrosEmpatados = empatados.length - 1;
      return `${primeiro.nome} e +${outrosEmpatados}`;
    }
  };

  const aplicarFiltro = () => {
    let filtered = [...jogos];

    const formatarData = (dataString: string) => {
      const data = new Date(dataString);
      return data.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit',
        year: 'numeric'
      });
    };

    if (filtro === 'atual') {
      if (dataSelecionada) {
        filtered = jogos.filter(jogo => formatarData(jogo.created_at) === dataSelecionada);
      } else if (jogos.length > 0) {
        const jogoMaisRecente = jogos.reduce((prev, current) => {
          return new Date(current.created_at) > new Date(prev.created_at) ? current : prev;
        });
        filtered = jogos.filter(jogo => jogo.sessao_id === jogoMaisRecente.sessao_id);
      }
    } else if (filtro === 'mes') {
      if (periodoSelecionado) {
        filtered = jogos.filter(jogo => {
          const data = new Date(jogo.created_at);
          const mes = String(data.getMonth() + 1).padStart(2, '0');
          const ano = data.getFullYear();
          return `${mes}/${ano}` === periodoSelecionado;
        });
      } else {
        const hoje = new Date();
        const umMesAtras = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);
        filtered = jogos.filter(jogo => new Date(jogo.created_at) >= umMesAtras);
      }
    } else if (filtro === 'ultimas') {
      // Pegar as últimas N sessões únicas
      const sessoesUnicas = [...new Set(jogos.map(j => j.sessao_id))];
      const sessoesOrdenadas = sessoesUnicas
        .map(sessaoId => {
          const jogosDaSessao = jogos.filter(j => j.sessao_id === sessaoId);
          const dataRecente = jogosDaSessao.reduce((prev, curr) => 
            new Date(curr.created_at) > new Date(prev.created_at) ? curr : prev
          );
          return { sessaoId, data: new Date(dataRecente.created_at) };
        })
        .sort((a, b) => b.data.getTime() - a.data.getTime());
      
      const quantidadeNum = parseInt(quantidadePeladas);
      const sessoesParaFiltrar = sessoesOrdenadas.slice(0, quantidadeNum).map(s => s.sessaoId);
      filtered = jogos.filter(jogo => sessoesParaFiltrar.includes(jogo.sessao_id));
    } else if (filtro === 'historia') {
      // Retornar todos os jogos (sem filtro)
      filtered = [...jogos];
    } else if (filtro === 'ano') {
      if (periodoSelecionado) {
        filtered = jogos.filter(jogo => {
          const data = new Date(jogo.created_at);
          return data.getFullYear().toString() === periodoSelecionado;
        });
      } else {
        const hoje = new Date();
        const anoAtras = new Date(hoje.getTime() - 365 * 24 * 60 * 60 * 1000);
        filtered = jogos.filter(jogo => new Date(jogo.created_at) >= anoAtras);
      }
    }

    setJogosFiltrados(filtered);
  };

  const calcularEstatisticas = () => {
    if (jogosFiltrados.length === 0 || Object.keys(jogadores).length === 0) {
      setEstatisticas([]);
      return;
    }

    // Coletar estatísticas por jogador
    const stats: { [nome: string]: any } = {};

    jogosFiltrados.forEach((jogo, jogoIndex) => {
      [...jogo.time_a, ...jogo.time_b].forEach(jogadorId => {
        const nome = buscarJogador(jogadorId);
        if (!stats[nome]) {
          stats[nome] = { 
            nome, 
            jogos: 0, 
            vitorias: 0, 
            derrotas: 0, 
            empates: 0, 
            gols: 0,
            assistencias: 0,
            mvp: 0,
            deiteiRolei: 0,
            sequenciaInvicta: 0,
            sequenciaAtual: 0,
            ultimosResultados: [] as string[]
          };
        }

        stats[nome].jogos++;
        const noTimeA = jogo.time_a.includes(jogadorId);
        
        if (jogo.placar_a === jogo.placar_b) {
          stats[nome].empates++;
          stats[nome].sequenciaAtual++;
          stats[nome].ultimosResultados.push('E');
        } else if ((noTimeA && jogo.placar_a > jogo.placar_b) || (!noTimeA && jogo.placar_b > jogo.placar_a)) {
          stats[nome].vitorias++;
          stats[nome].sequenciaAtual++;
          stats[nome].ultimosResultados.push('V');
        } else {
          stats[nome].derrotas++;
          if (stats[nome].sequenciaAtual > stats[nome].sequenciaInvicta) {
            stats[nome].sequenciaInvicta = stats[nome].sequenciaAtual;
          }
          stats[nome].sequenciaAtual = 0;
          stats[nome].ultimosResultados.push('D');
        }
      });

      // Contar gols
      (jogo.gols || []).forEach(gol => {
        const nome = buscarJogador(gol.jogador_id);
        if (stats[nome]) {
          stats[nome].gols++;
        }
      });
      
      // Contar assistências
      (jogo.assistencias || []).forEach(assist => {
        const nome = buscarJogador(assist.jogador_id);
        if (stats[nome]) {
          stats[nome].assistencias++;
        }
      });
      
      // Calcular MVP (vitória + gol OU assistência)
      const vencedoresTimeA = jogo.placar_a > jogo.placar_b ? jogo.time_a : [];
      const vencedoresTimeB = jogo.placar_b > jogo.placar_a ? jogo.time_b : [];
      const vencedores = [...vencedoresTimeA, ...vencedoresTimeB];
      
      if (vencedores.length > 0 && jogoIndex === 0) {
        if (DEBUG) console.log('🎯 Debug MVP - Primeiro jogo:', {
          jogoId: jogo.id,
          placarA: jogo.placar_a,
          placarB: jogo.placar_b,
          timeABruto: jogo.time_a,
          timeBBruto: jogo.time_b,
          vencedores: vencedores.map(v => ({ 
            valorBruto: v, 
            tipo: typeof v
          })),
          golsBruto: jogo.gols || [],
          assistenciasBruto: jogo.assistencias || []
        });
        
        if (DEBUG) console.log('🔍 Testando buscarJogador nos vencedores:');
        vencedores.forEach(v => {
          if (DEBUG) console.log(`  - Input: ${JSON.stringify(v)} → Output: "${buscarJogador(v)}"`);
        });
        
        if (jogo.gols && jogo.gols.length > 0) {
          if (DEBUG) console.log('🔍 Testando buscarJogador nos gols:');
          jogo.gols.forEach(g => {
            if (DEBUG) console.log(`  - Input UUID: "${g.jogador_id}" → Output: "${buscarJogador(g.jogador_id)}"`);
          });
        }
      }
      
      let mvpContador = 0;
      
      vencedores.forEach(jogadorId => {
        const nomeVencedor = buscarJogador(jogadorId);
        if (stats[nomeVencedor]) {
          // Comparar pelo NOME do jogador (convertendo UUID dos gols/assists para nome)
          const fezGol = (jogo.gols || []).some(g => {
            const nomeGoleador = buscarJogador(g.jogador_id);
            const match = nomeGoleador === nomeVencedor;
            if (jogoIndex === 0) {
              if (DEBUG) console.log(`   Comparando gol: "${nomeGoleador}" === "${nomeVencedor}" = ${match}`);
            }
            return match;
          });
          
          const deuAssist = (jogo.assistencias || []).some(a => {
            const nomeAssistente = buscarJogador(a.jogador_id);
            const match = nomeAssistente === nomeVencedor;
            if (jogoIndex === 0) {
              if (DEBUG) console.log(`   Comparando assist: "${nomeAssistente}" === "${nomeVencedor}" = ${match}`);
            }
            return match;
          });
          
          if (jogoIndex === 0) {
            if (DEBUG) console.log(`   Jogador ${nomeVencedor}: fezGol=${fezGol}, deuAssist=${deuAssist}`);
          }
          
          if (fezGol || deuAssist) {
            stats[nomeVencedor].mvp++;
            mvpContador++;
            if (jogoIndex === 0) {
              if (DEBUG) console.log(`   ✅ MVP encontrado:`, nomeVencedor, { fezGol, deuAssist });
            }
          }
          
          // Deitei e Rolei (vitória + gol + assistência)
          if (fezGol && deuAssist) {
            stats[nomeVencedor].deiteiRolei++;
          }
        }
      });
      
      if (jogoIndex === 0) {
        if (DEBUG) console.log(`🎯 Total de MVPs no primeiro jogo: ${mvpContador}`);
      }
    });

    // Finalizar sequências invictas
    Object.values(stats).forEach((s: any) => {
      if (s.sequenciaAtual > s.sequenciaInvicta) {
        s.sequenciaInvicta = s.sequenciaAtual;
      }
    });

    // Log de MVPs totalizados
    const totalMVPs = Object.values(stats).reduce((sum: number, s: any) => sum + (s.mvp || 0), 0);
    if (DEBUG) console.log(`🎯 TOTAL DE MVPs CALCULADOS: ${totalMVPs}`);
    const jogadoresComMVP = Object.values(stats).filter((s: any) => s.mvp > 0);
    if (DEBUG) console.log(`🎯 Jogadores com MVP:`, jogadoresComMVP.map((s: any) => `${s.nome}: ${s.mvp}`));

    // 1. ARTILHEIRO
    const artilheiro = Object.values(stats)
      .filter((s: any) => s.gols > 0)
      .sort((a: any, b: any) => b.gols - a.gols)
      .map((s: any, idx) => ({ posicao: idx + 1, nome: s.nome, valor: `${s.gols} gols` }));

    // 2. GARÇOM (assistências)
    const garcom = Object.values(stats)
      .filter((s: any) => s.assistencias > 0)
      .sort((a: any, b: any) => b.assistencias - a.assistencias)
      .map((s: any, idx) => ({ posicao: idx + 1, nome: s.nome, valor: `${s.assistencias} assist.` }));

    // 3. VITORIOSO
    const vitorioso = Object.values(stats)
      .filter((s: any) => s.vitorias > 0)
      .sort((a: any, b: any) => b.vitorias - a.vitorias)
      .map((s: any, idx) => ({ posicao: idx + 1, nome: s.nome, valor: `${s.vitorias} vitórias` }));

    // 4. SÓ DERROTA
    const soDerrota = Object.values(stats)
      .filter((s: any) => s.derrotas > 0)
      .map((s: any) => ({
        nome: s.nome,
        derrotas: s.derrotas,
        jogos: s.jogos,
        percentual: s.jogos > 0 ? (s.derrotas / s.jogos) * 100 : 0,
      }))
      .sort((a: any, b: any) => {
        const diffPct = b.percentual - a.percentual;
        if (Math.abs(diffPct) > 0.01) return diffPct;
        return b.derrotas - a.derrotas;
      })
      .map((s: any, idx) => ({
        posicao: idx + 1,
        nome: s.nome,
        valor: `${s.derrotas}/${s.jogos} Derrotas (${s.percentual.toFixed(0)}%)`,
      }));

    // 5. MVP (vitória + gol ou assistência)
    const mvp = Object.values(stats)
      .filter((s: any) => s.mvp > 0)
      .sort((a: any, b: any) => b.mvp - a.mvp)
      .map((s: any, idx) => ({ posicao: idx + 1, nome: s.nome, valor: `${s.mvp} MVP` }));

    // 6. HAT-TRICKS (3+ gols e/ou assistências no mesmo jogo)
    const hatTricks: { [nome: string]: number } = {};
    const hatTricksDetalhes: { [nome: string]: { gols: number; assists: number }[] } = {};
    jogosFiltrados.forEach(jogo => {
      const contribuicaoPorJogador: { [nome: string]: { gols: number; assists: number } } = {};
      (jogo.gols || []).forEach(gol => {
        const nome = buscarJogador(gol.jogador_id);
        if (!contribuicaoPorJogador[nome]) contribuicaoPorJogador[nome] = { gols: 0, assists: 0 };
        contribuicaoPorJogador[nome].gols++;
      });
      (jogo.assistencias || []).forEach(assist => {
        const nome = buscarJogador(assist.jogador_id);
        if (!contribuicaoPorJogador[nome]) contribuicaoPorJogador[nome] = { gols: 0, assists: 0 };
        contribuicaoPorJogador[nome].assists++;
      });
      Object.entries(contribuicaoPorJogador).forEach(([nome, c]) => {
        if (c.gols >= 3 || c.assists >= 3) {
          hatTricks[nome] = (hatTricks[nome] || 0) + 1;
          if (!hatTricksDetalhes[nome]) hatTricksDetalhes[nome] = [];
          hatTricksDetalhes[nome].push(c);
        }
      });
    });
    const hatTricksRanking = Object.entries(hatTricks)
      .sort(([, a], [, b]) => b - a)
      .map(([nome, count], idx) => {
        const detalhes = hatTricksDetalhes[nome] || [];
        const partes: string[] = [];
        const totalGols = detalhes.reduce((s, d) => s + d.gols, 0);
        const totalAssists = detalhes.reduce((s, d) => s + d.assists, 0);
        if (totalGols > 0) partes.push(`${totalGols} gol${totalGols > 1 ? 's' : ''}`);
        if (totalAssists > 0) partes.push(`${totalAssists} assist${totalAssists > 1 ? 's' : ''}`);
        return { posicao: idx + 1, nome, valor: `${count}x (${partes.join(' + ')})` };
      });

    // 7. SEM SOFRER GOLS
    const semSofrerGols: { [nome: string]: { jogos: number; semSofrer: number } } = {};
    
    jogosFiltrados.forEach(jogo => {
      const todosJogadores = [...jogo.time_a, ...jogo.time_b];
      
      todosJogadores.forEach(jogadorId => {
        const nome = buscarJogador(jogadorId);
        if (!semSofrerGols[nome]) {
          semSofrerGols[nome] = { jogos: 0, semSofrer: 0 };
        }
        
        semSofrerGols[nome].jogos++;
        
        // Verificar se estava no time que não sofreu gols
        const noTimeA = jogo.time_a.includes(jogadorId);
        const noTimeB = jogo.time_b.includes(jogadorId);
        
        if ((noTimeA && jogo.placar_b === 0) || (noTimeB && jogo.placar_a === 0)) {
          semSofrerGols[nome].semSofrer++;
        }
      });
    });
    
    const semSofrerGolsRanking = Object.entries(semSofrerGols)
      .map(([nome, data]) => ({
        nome,
        semSofrer: data.semSofrer,
        percentual: data.jogos > 0 ? ((data.semSofrer / data.jogos) * 100).toFixed(1) : '0.0'
      }))
      .sort((a, b) => {
        // Ordenar por quantidade absoluta primeiro, depois por % como desempate
        const countDiff = b.semSofrer - a.semSofrer;
        if (countDiff !== 0) return countDiff;
        return parseFloat(b.percentual) - parseFloat(a.percentual);
      })
      .map((s, idx) => ({ 
        posicao: idx + 1, 
        nome: s.nome, 
        valor: `${s.semSofrer} jogos (${s.percentual}%)` 
      }));

    // 8. NÃO PERDI PELADA
    const naoPerdi = Object.values(stats)
      .filter((s: any) => s.derrotas === 0)
      .sort((a: any, b: any) => b.jogos - a.jogos)
      .map((s: any, idx) => {
        const detalhes = s.empates > 0 ? `${s.vitorias}V e ${s.empates}E` : `${s.vitorias}V`;
        return { posicao: idx + 1, nome: s.nome, valor: `${s.jogos}J = ${detalhes}` };
      });

    // 8.5 CARREGOU O TIME (impacto ofensivo em jogos sem vitória: derrota ou empate)
    const carregouTime = Object.values(stats)
      .map((s: any) => {
        let pontos = 0;
        let jogosComImpacto = 0;

        jogosFiltrados.forEach((jogo: any) => {
          const todosIds = [...jogo.time_a, ...jogo.time_b];
          const jogadorId = todosIds.find(id => buscarJogador(id) === s.nome);
          if (!jogadorId) return;

          const noTimeA = jogo.time_a.includes(jogadorId);
          const venceu = (noTimeA && jogo.placar_a > jogo.placar_b) || (!noTimeA && jogo.placar_b > jogo.placar_a);
          if (venceu) return;

          const golsNoJogo = (jogo.gols || []).filter((g: any) => buscarJogador(g.jogador_id) === s.nome).length;
          const assistsNoJogo = (jogo.assistencias || []).filter((a: any) => buscarJogador(a.jogador_id) === s.nome).length;
          const pontosNoJogo = golsNoJogo + assistsNoJogo;

          if (pontosNoJogo > 0) {
            pontos += pontosNoJogo;
            jogosComImpacto++;
          }
        });

        return {
          nome: s.nome,
          pontos,
          jogosComImpacto,
        };
      })
      .filter((s: any) => s.pontos > 0)
      .sort((a: any, b: any) => {
        const diffPontos = b.pontos - a.pontos;
        if (diffPontos !== 0) return diffPontos;
        return b.jogosComImpacto - a.jogosComImpacto;
      })
      .map((s: any, idx) => ({
        posicao: idx + 1,
        nome: s.nome,
        valor: `${s.pontos} pts (${s.jogosComImpacto} jogos)`,
      }));

    // 9. REI DA PELADA
    const reiPelada = Object.values(stats)
      .map((s: any) => ({
        nome: s.nome,
        pontos: s.vitorias + (s.gols * 0.5) + (s.assistencias * 0.5) + (s.empates * 0.5) - (s.derrotas * 0.5)
      }))
      .sort((a, b) => b.pontos - a.pontos)
      .map((s, idx) => ({ posicao: idx + 1, nome: s.nome, valor: `${s.pontos.toFixed(1)} pts` }));

    // 10. BOLA MURCHA (oposto do Rei da Pelada)
    const bolaMurcha = Object.values(stats)
      .map((s: any) => ({
        nome: s.nome,
        pontos: s.vitorias + (s.gols * 0.5) + (s.assistencias * 0.5) + (s.empates * 0.5) - (s.derrotas * 0.5)
      }))
      .sort((a, b) => a.pontos - b.pontos)
      .map((s, idx) => ({ posicao: idx + 1, nome: s.nome, valor: `${s.pontos.toFixed(1)} pts` }));

    // 11. NOTA (média por sessão/dia de pelada)
    const sessoes = [...new Set(jogosFiltrados.map(j => j.sessao_id))];
    const notasPorJogador: { [nome: string]: { total: number; count: number } } = {};
    sessoes.forEach(sessaoId => {
      const jogosDaSessao = jogosFiltrados.filter(j => j.sessao_id === sessaoId);
      // Coletar todos os jogadores que participaram da sessão
      const jogadoresDaSessao = new Set<string>();
      jogosDaSessao.forEach(j => {
        [...j.time_a, ...j.time_b].forEach(id => jogadoresDaSessao.add(buscarJogador(id)));
      });
      jogadoresDaSessao.forEach(nome => {
        let jogosNaDia = 0, vitorias = 0, empates = 0, golsDia = 0, assistsDia = 0;
        let cleanSheetsDia = 0, hatTrickNoDia = false, deiteiRoleiNoDia = false;
        jogosDaSessao.forEach(jogo => {
          const todosIds = [...jogo.time_a, ...jogo.time_b];
          const jogadorId = todosIds.find(id => buscarJogador(id) === nome);
          if (!jogadorId) return;
          jogosNaDia++;
          const noTimeA = jogo.time_a.includes(jogadorId);
          const vitoria = (noTimeA && jogo.placar_a > jogo.placar_b) || (!noTimeA && jogo.placar_b > jogo.placar_a);
          const empate = jogo.placar_a === jogo.placar_b;
          const cleanSheet = (noTimeA && jogo.placar_b === 0) || (!noTimeA && jogo.placar_a === 0);
          const golsNoJogo = (jogo.gols || []).filter((g: any) => buscarJogador(g.jogador_id) === nome).length;
          const assistsNoJogo = (jogo.assistencias || []).filter((a: any) => buscarJogador(a.jogador_id) === nome).length;
          if (vitoria) vitorias++;
          if (empate) empates++;
          if (cleanSheet) cleanSheetsDia++;
          golsDia += golsNoJogo;
          assistsDia += assistsNoJogo;
          if (golsNoJogo >= 3 || assistsNoJogo >= 3) hatTrickNoDia = true;
          if (golsNoJogo > 0 && assistsNoJogo > 0) deiteiRoleiNoDia = true;
        });
        if (jogosNaDia === 0) return;
        const aprov = (vitorias * 3 + empates) / (jogosNaDia * 3);
        const cleanSheetRatio = cleanSheetsDia / jogosNaDia;
        const isDefensorPuro = cleanSheetsDia > 0 && golsDia === 0 && assistsDia === 0;
        // Calcular teveMvp aqui para usar no count de extras
        const teveMvp = jogosDaSessao.some(jogo => {
          const todosIds = [...jogo.time_a, ...jogo.time_b];
          const jogadorId = todosIds.find(id => buscarJogador(id) === nome);
          if (!jogadorId) return false;
          const noTimeA = jogo.time_a.includes(jogadorId);
          const vitoria = (noTimeA && jogo.placar_a > jogo.placar_b) || (!noTimeA && jogo.placar_b > jogo.placar_a);
          const golsNoJogo = (jogo.gols || []).filter((g: any) => buscarJogador(g.jogador_id) === nome).length;
          const assistsNoJogo = (jogo.assistencias || []).filter((a: any) => buscarJogador(a.jogador_id) === nome).length;
          return vitoria && (golsNoJogo > 0 || assistsNoJogo > 0);
        });
        // Contar extras para definir cap dinâmico de gols+assists
        let extrasCount = 0;
        if (teveMvp) extrasCount++;
        if (deiteiRoleiNoDia) extrasCount++;
        if (hatTrickNoDia) extrasCount++;
        if (cleanSheetRatio === 1) extrasCount++;
        if (isDefensorPuro) extrasCount++;
        const golAssistCap = 4.0 + (5 - extrasCount) * 0.5;
        let nota = 3.0 + aprov * 5.0;
        nota += Math.min(golsDia * 0.5 + assistsDia * 0.4, golAssistCap);
        if (cleanSheetRatio === 1) nota += 1.0;
        else if (cleanSheetRatio > 0.5) nota += 0.5;
        if (isDefensorPuro) nota += 1.5;
        if (hatTrickNoDia) nota += 1.0;
        if (deiteiRoleiNoDia) nota += 1.0;
        if (teveMvp) nota += 1.0;
        nota = Math.min(nota, 10);
        if (!notasPorJogador[nome]) notasPorJogador[nome] = { total: 0, count: 0 };
        notasPorJogador[nome].total += nota;
        notasPorJogador[nome].count++;
      });
    });
    const notaRanking = Object.entries(notasPorJogador)
      .map(([nome, data]) => ({ nome, media: data.count > 0 ? data.total / data.count : 0 }))
      .sort((a, b) => b.media - a.media)
      .map((s, idx) => ({ posicao: idx + 1, nome: s.nome, valor: s.media.toFixed(1) }));

    // 12. ZERO IMPACTO (jogos sem gol e sem assistência)
    const zeroImpacto = Object.values(stats)
      .map((s: any) => {
        const jogosSemImpacto = jogosFiltrados.reduce((acc: number, jogo: any) => {
          const todosIds = [...jogo.time_a, ...jogo.time_b];
          const jogadorId = todosIds.find(id => buscarJogador(id) === s.nome);
          if (!jogadorId) return acc;

          const golsNoJogo = (jogo.gols || []).filter((g: any) => buscarJogador(g.jogador_id) === s.nome).length;
          const assistsNoJogo = (jogo.assistencias || []).filter((a: any) => buscarJogador(a.jogador_id) === s.nome).length;

          // Só conta como zero impacto se não fez gol/assist E o time dele sofreu gol
          // (clean sheet = impacto defensivo, não conta como zero impacto)
          const noTimeA = jogo.time_a.includes(jogadorId);
          const golsSofridos = noTimeA ? jogo.placar_b : jogo.placar_a;
          const teveImpactoDefensivo = golsSofridos === 0;

          if (golsNoJogo === 0 && assistsNoJogo === 0 && !teveImpactoDefensivo) return acc + 1;
          return acc;
        }, 0);

        const percentual = s.jogos > 0 ? ((jogosSemImpacto / s.jogos) * 100).toFixed(0) : '0';

        return {
          nome: s.nome,
          jogosSemImpacto,
          jogos: s.jogos,
          percentual,
        };
      })
      .filter((s: any) => s.jogosSemImpacto > 0)
      .sort((a: any, b: any) => {
        const diffCount = b.jogosSemImpacto - a.jogosSemImpacto;
        if (diffCount !== 0) return diffCount;
        return parseFloat(b.percentual) - parseFloat(a.percentual);
      })
      .map((s: any, idx) => ({
        posicao: idx + 1,
        nome: s.nome,
        valor: `${s.jogosSemImpacto} jogos (${s.percentual}%)`
      }));

    // 12. MÉDIA DE GOLS
    const mediaGols = Object.values(stats)
      .map((s: any) => ({
        nome: s.nome,
        media: s.jogos > 0 ? (s.gols / s.jogos).toFixed(2) : '0.00'
      }))
      .sort((a, b) => parseFloat(b.media) - parseFloat(a.media))
      .map((s, idx) => ({ posicao: idx + 1, nome: s.nome, valor: s.media }));

    // 13. SEQUÊNCIA INVICTA
    const sequenciaInvicta = Object.values(stats)
      .filter((s: any) => s.sequenciaInvicta > 0)
      .sort((a: any, b: any) => b.sequenciaInvicta - a.sequenciaInvicta)
      .map((s: any, idx) => ({ posicao: idx + 1, nome: s.nome, valor: `${s.sequenciaInvicta} jogos` }));

    // 15. DEITEI E ROLEI (vitória + gol + assistência na mesma partida)
    const deiteiRolei = Object.values(stats)
      .filter((s: any) => s.deiteiRolei > 0)
      .sort((a: any, b: any) => b.deiteiRolei - a.deiteiRolei)
      .map((s: any, idx) => ({ posicao: idx + 1, nome: s.nome, valor: `${s.deiteiRolei} vezes` }));

    // Montar array de estatísticas
    const estatisticasCalculadas: Estatistica[] = [
      { id: 'artilheiro', emoji: '⚽', nome: 'Artilheiro', descricao: 'Quem marcou mais gols', primeiroColocado: formatarPrimeiroColocado(artilheiro), ranking: artilheiro },
      { id: 'mediaGols', emoji: '📊', nome: 'Média de Gols', descricao: 'Maior média de gols por jogo', primeiroColocado: formatarPrimeiroColocado(mediaGols), ranking: mediaGols },
      { id: 'garcom', emoji: '👟', nome: 'Assistências', descricao: 'Quem mais deu assistências', primeiroColocado: formatarPrimeiroColocado(garcom), ranking: garcom },
      { id: 'hatTricks', emoji: '🎩', nome: 'Hat-Trick', descricao: '3+ gols ou 3+ assistências no mesmo jogo', primeiroColocado: formatarPrimeiroColocado(hatTricksRanking), ranking: hatTricksRanking },
      { id: 'mvp', emoji: '⭐', nome: 'MVP', descricao: 'Vitória + gol/assist na mesma partida', primeiroColocado: formatarPrimeiroColocado(mvp), ranking: mvp },
      { id: 'deiteiRolei', emoji: '🎯', nome: 'Deitei e Rolei', descricao: 'Vitória + gol + assist no mesmo jogo', primeiroColocado: formatarPrimeiroColocado(deiteiRolei), ranking: deiteiRolei },
      { id: 'vitorioso', emoji: '🏆', nome: 'Vitorioso', descricao: 'Quem conquistou mais vitórias', primeiroColocado: formatarPrimeiroColocado(vitorioso), ranking: vitorioso },
      { id: 'carregouTime', emoji: '🚛', nome: 'Carregou o Time', descricao: 'Impacto ofensivo em jogos sem vitória (derrota + empate)', primeiroColocado: formatarPrimeiroColocado(carregouTime), ranking: carregouTime },
      { id: 'naoPerdi', emoji: '🔥', nome: 'Invicto', descricao: 'Jogou e nunca perdeu', primeiroColocado: formatarPrimeiroColocado(naoPerdi), ranking: naoPerdi },
      { id: 'semSofrerGols', emoji: '🛡️', nome: 'Muralha', descricao: 'Maior % de jogos sem levar gols', primeiroColocado: formatarPrimeiroColocado(semSofrerGolsRanking), ranking: semSofrerGolsRanking },
      { id: 'zeroImpacto', emoji: '🚫', nome: 'Zero Impacto', descricao: 'Mais jogos sem gol, sem assist e sem clean sheet', primeiroColocado: formatarPrimeiroColocado(zeroImpacto), ranking: zeroImpacto },
      { id: 'soDerrota', emoji: '❌', nome: 'Só Derrota', descricao: 'Maior % de derrotas (derrotas / jogos)', primeiroColocado: formatarPrimeiroColocado(soDerrota), ranking: soDerrota },
      { id: 'nota', emoji: '🏅', nome: 'Nota', descricao: 'Média de desempenho por pelada (0–10)', primeiroColocado: formatarPrimeiroColocado(notaRanking), ranking: notaRanking },
      { id: 'reiPelada', emoji: '👑', nome: 'Rei da Pelada', descricao: 'Maior pontuação geral', primeiroColocado: formatarPrimeiroColocado(reiPelada), ranking: reiPelada },
      { id: 'bolaMurcha', emoji: '', icone: '/bolamurcha.png', nome: 'Bola Murcha', descricao: 'Menor pontuação geral no filtro (oposto do Rei)', primeiroColocado: formatarPrimeiroColocado(bolaMurcha), ranking: bolaMurcha },
    ];

    setEstatisticas(estatisticasCalculadas);
  };

  const carregarDados = async () => {
    try {
      setLoading(true);
      const peladaId = buscar_pelada_id();
      if (!peladaId) {
        router.push('/login');
        return;
      }

      const clienteDb = await getClienteSupabase(peladaId);
      if (!clienteDb) {
        console.error('? Erro ao obter cliente Supabase');
        return;
      }

      // Buscar jogos para popular filtros
      const { data: jogosData } = await clienteDb
        .from('jogos')
        .select('*')
        .eq('status', 'finalizado')
        .order('created_at', { ascending: false });

      if (jogosData && jogosData.length > 0) {
        // Extrair datas, meses e anos
        const datas = [...new Set(jogosData.map(jogo => {
          const data = new Date(jogo.created_at);
          return data.toLocaleDateString('pt-BR', { 
            day: '2-digit', 
            month: '2-digit',
            year: 'numeric'
          });
        }))];
        
        const meses = [...new Set(jogosData.map(jogo => {
          const data = new Date(jogo.created_at);
          const mes = String(data.getMonth() + 1).padStart(2, '0');
          const ano = data.getFullYear();
          return `${mes}/${ano}`;
        }))].sort().reverse();
        
        const anos = [...new Set(jogosData.map(jogo => {
          const data = new Date(jogo.created_at);
          return data.getFullYear().toString();
        }))].sort().reverse();
        
        setDatasDisponiveis(datas);
        setMesesDisponiveis(meses);
        setAnosDisponiveis(anos);

        // Buscar gols e assistências de todos os jogos
        const jogosIds = jogosData.map(j => j.id);
        const { data: golsData } = await clienteDb
          .from('gols')
          .select('*')
          .in('jogo_id', jogosIds);
        
        const { data: assistenciasData } = await clienteDb
          .from('assistencias')
          .select('*')
          .in('jogo_id', jogosIds);

        // Associar gols e assistências aos jogos  
        const jogosCompletos = jogosData.map(jogo => ({
          ...jogo,
          gols: (golsData || []).filter(g => g.jogo_id === jogo.id),
          assistencias: (assistenciasData || []).filter(a => a.jogo_id === jogo.id)
        }));

        if (DEBUG) console.log('📊 Debug MVP - Total de jogos:', jogosCompletos.length);
        if (DEBUG) console.log('📊 Debug MVP - Gols carregados:', golsData?.length || 0);
        if (DEBUG) console.log('📊 Debug MVP - Assistências carregadas:', assistenciasData?.length || 0);
        const jogoComGols = jogosCompletos.find(j => j.gols?.length > 0);
        if (jogoComGols) {
          if (DEBUG) console.log('📊 Debug MVP - Exemplo de jogo com gols:', jogoComGols.id, 'Gols:', jogoComGols.gols);
        }

        setJogos(jogosCompletos);
      } else {
        setJogos([]);
      }

      // Buscar todos os jogadores
      const { data: jogadoresData } = await clienteDb
        .from('jogadores')
        .select('*')
        .eq('pelada_id', peladaId);
      
      if (jogadoresData) {
        const jogadoresMap: { [id: string]: Jogador } = {};
        jogadoresData.forEach(j => {
          jogadoresMap[j.id] = j;
          jogadoresMap[j.nome] = j;
        });
        if (DEBUG) console.log('👥 Jogadores carregados:', jogadoresData.length);
        if (DEBUG) console.log('👥 Exemplo UUID→Nome:', Object.keys(jogadoresMap).slice(0, 3).map(k => `${k} → ${jogadoresMap[k].nome || jogadoresMap[k].apelido}`));
        setJogadores(jogadoresMap);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loadingPermissoes || loading) {
    return (
      <Layout title="Estatísticas">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-5xl mb-4">📊</div>
            <div className="text-gray-600">Carregando estatísticas...</div>
          </div>
        </div>
      </Layout>
    );
  }

  const reiPeladaEstatistica = estatisticas.find((estatistica) => estatistica.id === 'reiPelada');
  const estatisticasVisiveis = ['artilheiro', 'mediaGols', 'garcom', 'mvp', 'vitorioso', 'naoPerdi', 'carregouTime', 'semSofrerGols', 'soDerrota', 'bolaMurcha'];
  const outrasEstatisticas = estatisticas.filter(
    (estatistica) => estatistica.id !== 'reiPelada' && estatisticasVisiveis.includes(estatistica.id)
  );
  const podiumReiPelada = reiPeladaEstatistica?.ranking.slice(0, 3) || [];
  const primeiroLugar = podiumReiPelada[0];
  const segundoLugar = podiumReiPelada[1];
  const terceiroLugar = podiumReiPelada[2];

  return (
    <Layout title="Estatísticas">
      <div className="max-w-4xl mx-auto px-4 py-3">
        {/* Header com filtros */}
        <section className="bg-white rounded-xl shadow-md p-4 mb-4 border border-gray-300">
          {/* Bloco 1: Pelada Atual */}
          <div className="mb-3">
            <button
              onClick={() => {
                setFiltro('atual');
                setDataSelecionada('');
                setPeriodoSelecionado('');
              }}
              className={`w-full py-2 px-3 rounded-lg text-sm font-semibold transition-colors ${
                filtro === 'atual'
                  ? 'bg-green-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
              }`}
            >
              ⚡ Atual (Pelada mais recente)
            </button>
          </div>

          {/* Bloco 2: Períodos */}
          <div className="mb-3">
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => {
                  setFiltro('mes');
                  setDataSelecionada('');
                  setPeriodoSelecionado('');
                }}
                className={`py-2 px-2 rounded-lg text-xs font-semibold transition-colors ${
                  filtro === 'mes'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                }`}
              >
                Mês
              </button>
              <button
                onClick={() => {
                  setFiltro('ultimas');
                  setDataSelecionada('');
                  setPeriodoSelecionado('');
                  setQuantidadePeladas('3');
                }}
                className={`py-2 px-2 rounded-lg text-xs font-semibold transition-colors ${
                  filtro === 'ultimas'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                }`}
              >
                Últimas
              </button>
              <button
                onClick={() => {
                  setFiltro('ano');
                  setDataSelecionada('');
                  setPeriodoSelecionado('');
                }}
                className={`py-2 px-2 rounded-lg text-xs font-semibold transition-colors ${
                  filtro === 'ano'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                }`}
              >
                Ano
              </button>
              <button
                onClick={() => {
                  setFiltro('historia');
                  setDataSelecionada('');
                  setPeriodoSelecionado('');
                }}
                className={`py-2 px-2 rounded-lg text-xs font-semibold transition-colors ${
                  filtro === 'historia'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                }`}
              >
                História
              </button>
            </div>
          </div>

          {/* Bloco 3: Select dinâmico baseado no filtro */}
          <div>
            {filtro === 'atual' && (
              <select
                value={dataSelecionada}
                onChange={(e) => setDataSelecionada(e.target.value)}
                className="w-full py-2 px-3 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="">🔍 Selecionar pelada específica</option>
                {datasDisponiveis.map(data => (
                  <option key={data} value={data}>{data}</option>
                ))}
              </select>
            )}
            
            {filtro === 'mes' && (
              <select
                value={periodoSelecionado}
                onChange={(e) => setPeriodoSelecionado(e.target.value)}
                className="w-full py-2 px-3 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">📅 Selecionar mês específico</option>
                {mesesDisponiveis.map(mes => (
                  <option key={mes} value={mes}>{mes}</option>
                ))}
              </select>
            )}
            
            {filtro === 'ultimas' && (
              <select
                value={quantidadePeladas}
                onChange={(e) => setQuantidadePeladas(e.target.value)}
                className="w-full py-2 px-3 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="2">📊 Últimas 2 peladas</option>
                <option value="3">📊 Últimas 3 peladas</option>
                <option value="4">📊 Últimas 4 peladas</option>
                <option value="5">📊 Últimas 5 peladas</option>
              </select>
            )}
            
            {filtro === 'ano' && (
              <select
                value={periodoSelecionado}
                onChange={(e) => setPeriodoSelecionado(e.target.value)}
                className="w-full py-2 px-3 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">📅 Selecionar ano específico</option>
                {anosDisponiveis.map(ano => (
                  <option key={ano} value={ano}>{ano}</option>
                ))}
              </select>
            )}
          </div>
        </section>

        {/* Badge do filtro ativo */}
        {(() => {
          let label = '';
          if (filtro === 'atual') label = 'Pelada mais recente';
          else if (filtro === 'ultimas') label = `Últimas ${quantidadePeladas} peladas`;
          else if (filtro === 'historia') label = 'Histórico completo';
          else if (filtro === 'mes') label = periodoSelecionado ? periodoSelecionado : 'Todos os meses';
          else if (filtro === 'ano') label = periodoSelecionado ? periodoSelecionado : 'Todos os anos';
          if (dataSelecionada) label = `Pelada: ${dataSelecionada}`;
          return (
            <div className="flex items-center justify-center mb-3">
              <div className="w-full bg-green-500 rounded-lg px-4 py-1.5 flex items-center justify-center gap-2 shadow-sm">
                <span className="text-white text-xs font-medium">Filtro:</span>
                <span className="text-white text-xs font-bold">{label}</span>
              </div>
            </div>
          );
        })()}

        {/* Destaque principal: Rei da Pelada */}
        {reiPeladaEstatistica && (
          <button
            onClick={() => abrirModal(reiPeladaEstatistica)}
            className="w-full mb-4 bg-white rounded-2xl shadow-md hover:shadow-lg transition-all active:scale-[0.99] overflow-hidden border border-amber-200"
          >
            <div className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 px-4 py-2 border-b border-amber-200">
              <div className="flex items-center justify-center gap-2">
                <h2 className="text-[13px] font-black tracking-wide text-amber-950">REI DA PELADA</h2>
              </div>
            </div>

            <div className="px-3 pt-2 pb-1.5 bg-gradient-to-br from-amber-50 via-white to-yellow-50">
              <div className="flex items-end justify-center gap-2 min-h-[118px]">
                <div className="flex-1 max-w-[88px]">
                  {segundoLugar ? (
                    <div className="text-center">
                      <div className="min-h-[20px] flex items-end justify-center px-1">
                        <div className="text-[11px] leading-tight font-bold text-slate-700 break-words line-clamp-2">{segundoLugar.nome}</div>
                      </div>
                      <div className="text-[10px] font-semibold text-slate-500 mt-0">{segundoLugar.valor}</div>
                      <div className="mt-0.5 h-15 rounded-t-xl bg-gradient-to-b from-slate-200 to-slate-300 flex items-center justify-center shadow-inner border border-slate-300">
                        <span className="text-base font-bold text-slate-600">2º</span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full" />
                  )}
                </div>

                <div className="flex-1 max-w-[104px]">
                  {primeiroLugar ? (
                    <div className="text-center">
                      <div className="min-h-[22px] flex items-end justify-center px-1">
                        <div className="text-sm leading-tight font-black text-amber-950 break-words line-clamp-2">{primeiroLugar.nome}</div>
                      </div>
                      <div className="text-[11px] font-bold text-amber-700 mt-0">{primeiroLugar.valor}</div>
                      <div className="mt-0.5 h-20 rounded-t-xl bg-gradient-to-b from-yellow-300 to-amber-400 flex items-center justify-center shadow-inner border border-amber-300">
                        <span className="text-3xl">👑</span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full" />
                  )}
                </div>

                <div className="flex-1 max-w-[88px]">
                  {terceiroLugar ? (
                    <div className="text-center">
                      <div className="min-h-[20px] flex items-end justify-center px-1">
                        <div className="text-[11px] leading-tight font-bold text-orange-800 break-words line-clamp-2">{terceiroLugar.nome}</div>
                      </div>
                      <div className="text-[10px] font-semibold text-orange-600 mt-0">{terceiroLugar.valor}</div>
                      <div className="mt-0.5 h-11 rounded-t-xl bg-gradient-to-b from-orange-200 to-orange-300 flex items-center justify-center shadow-inner border border-orange-300">
                        <span className="text-sm font-bold text-orange-700">3º</span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full" />
                  )}
                </div>
              </div>
            </div>
          </button>
        )}

        {/* Grid de Estatísticas */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {outrasEstatisticas.length > 0 ? (
            outrasEstatisticas.map((estatistica) => (
              (() => {
                const cores = obterCoresEstatistica(estatistica.id);
                return (
              <button
                key={estatistica.id}
                onClick={() => abrirModal(estatistica)}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all active:scale-95 overflow-hidden border border-gray-200"
              >
                {/* Linha 1: Emoji (25%) + Nome (75%) */}
                <div className="flex items-center border-b border-gray-100 p-1.5">
                  <div className="w-1/4 flex items-center justify-center">
                    {estatistica.icone ? (
                      <img src={estatistica.icone} alt={estatistica.nome} className="w-8 h-8 object-contain scale-[2]" />
                    ) : (
                      <span className="text-2xl">{estatistica.emoji}</span>
                    )}
                  </div>
                  <div className="w-3/4 flex items-center justify-center px-1">
                    <h3 className="text-xs font-bold text-black text-center leading-tight">
                      {estatistica.nome}
                    </h3>
                  </div>
                </div>
                
                {/* Linha 2: Nome do 1º colocado (100%) */}
                <div className={`py-1.5 px-2 ${
                  estatistica.primeiroColocado === '-' 
                    ? 'bg-gray-100' 
                    : cores.fundoNome
                }`}>
                  <p className={`text-xs font-semibold text-center truncate ${
                    estatistica.primeiroColocado === '-'
                      ? 'text-black'
                      : cores.textoNome
                  }`}>
                    {estatistica.primeiroColocado}
                  </p>
                </div>
              </button>
                );
              })()
            ))
          ) : (
            <div className="col-span-2 text-center py-12">
              <div className="text-5xl mb-3">📊</div>
              <p className="text-gray-600">Nenhuma estatística disponível</p>
            </div>
          )}
        </div>

        {/* Modal de Ranking Completo */}
        {modalAberto && estatisticaSelecionada && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={fecharModal}
          >
            <div 
              className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header do Modal */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {estatisticaSelecionada.icone ? (
                      <img src={estatisticaSelecionada.icone} alt={estatisticaSelecionada.nome} className="w-10 h-10 object-contain" />
                    ) : (
                      <span className="text-3xl">{estatisticaSelecionada.emoji}</span>
                    )}
                    <h3 className="text-lg font-bold text-white">{estatisticaSelecionada.nome}</h3>
                  </div>
                  <button 
                    onClick={fecharModal}
                    className="text-white text-2xl hover:text-gray-200 transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-sm text-blue-100 ml-12">{estatisticaSelecionada.descricao}</p>
              </div>

              {/* Ranking */}
              <div className="p-4 overflow-y-auto max-h-[60vh]">
                {estatisticaSelecionada.ranking.length > 0 ? (
                  <div className="space-y-2">
                    {estatisticaSelecionada.ranking.map((item) => {
                      const isTop3 = item.posicao <= 3;
                      const medalha = item.posicao === 1 ? '🥇' : item.posicao === 2 ? '🥈' : item.posicao === 3 ? '🥉' : '';
                      const bgColor = item.posicao === 1 
                        ? 'bg-gradient-to-r from-yellow-100 to-yellow-200' 
                        : item.posicao === 2 
                        ? 'bg-gradient-to-r from-gray-100 to-gray-200'
                        : item.posicao === 3
                        ? 'bg-gradient-to-r from-orange-100 to-orange-200'
                        : 'bg-gray-50';
                      
                      return (
                        <div 
                          key={item.posicao}
                          className={`flex items-center justify-between p-3 rounded-lg ${bgColor} border border-gray-200`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-gray-700 w-8">
                              {isTop3 ? medalha : `${item.posicao}º`}
                            </span>
                            <span className="text-sm font-medium text-gray-800">{item.nome}</span>
                          </div>
                          <span className="text-sm font-bold text-blue-600">{item.valor}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>Nenhum dado disponível</p>
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
