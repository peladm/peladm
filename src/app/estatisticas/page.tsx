'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import StatsFilterPanel from '../../components/StatsFilterPanel';
import bolaVermelha from '../../../bola-vermelha.png';
import { getClienteSupabase, supabase, fetchAllRows } from '../../lib/supabase';
import { usePermissions } from '../../lib/usePermissions';
import { buscar_pelada_id } from '../../lib/credenciais';
import {
  PontuacaoEstatisticas,
  PONTUACAO_PADRAO,
  carregarPontuacaoEstatisticas,
  calcularPontosEstatisticas,
} from '../../lib/pontuacaoEstatisticas';

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
  jogosAmostra?: number;
  minutosAmostra?: number;
  confiabilidadeAmostra?: 'Alta' | 'Média' | 'Baixa';
  elegivelRanking?: boolean;
}

interface Jogador {
  id: string;
  nome: string;
  apelido?: string;
  nivel?: number; // Classificação do jogador (1-5)
  status?: 'ativo' | 'inativo' | string;
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

export default function Estatisticas() {
  const DEBUG = false;
  const STORAGE_KEY = 'peladm:estatisticas:state:v1';
  const router = useRouter();
  const { possuiPermissao, loading: loadingPermissoes } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [estatisticas, setEstatisticas] = useState<Estatistica[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [estatisticaSelecionada, setEstatisticaSelecionada] = useState<Estatistica | null>(null);

  // Dados brutos
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [jogosFiltrados, setJogosFiltrados] = useState<Jogo[]>([]);
  const [jogadores, setJogadores] = useState<{ [id: string]: Jogador }>({});
  const [jogadoresPorTime, setJogadoresPorTime] = useState(5); // padrão
  const [statsCompletos, setStatsCompletos] = useState<{ [nome: string]: any }>({}); // Stats detalhados por jogador
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
    }));
  }, [filtro, dataSelecionada, periodoSelecionado, quantidadePeladas, apenasAtivos]);

  // Bloquear acesso quando o cliente não tiver permissão
  useEffect(() => {
    if (!loadingPermissoes && !possuiPermissao('verEstatisticas')) {
      alert('🚫 Estatísticas indisponíveis para este cliente no momento.');
      router.push('/');
    }
  }, [loadingPermissoes, possuiPermissao, router]);

  useEffect(() => {
    carregarDados();
  }, []);

  useEffect(() => {
    aplicarFiltro();
  }, [filtro, dataSelecionada, periodoSelecionado, quantidadePeladas, jogos]);

  useEffect(() => {
    calcularEstatisticas();
  }, [jogosFiltrados, jogadores, pontuacaoEstatisticas, apenasAtivos]);

  const abrirModal = (estatistica: Estatistica) => {
    setEstatisticaSelecionada(estatistica);
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setEstatisticaSelecionada(null);
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

  const classificarConfiabilidadeAmostra = (jogosAmostra: number, minutosAmostra: number): 'Alta' | 'Média' | 'Baixa' => {
    if (jogosAmostra >= 12 || minutosAmostra >= 120) return 'Alta';
    if (jogosAmostra >= 6 || minutosAmostra >= 60) return 'Média';
    return 'Baixa';
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
          const [ano, parte] = periodoSelecionado.split('-');
          const data = new Date(jogo.created_at);
          const anoJogo = data.getFullYear().toString();
          if (parte === undefined) {
            return anoJogo === periodoSelecionado;
          }
          if (anoJogo !== ano) {
            return false;
          }
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
    const jogadoresAtivosIds = new Set<string>();
    const jogadoresAtivosNomes = new Set<string>();

    if (apenasAtivos) {
      Object.values(jogadores).forEach((j) => {
        const isAtivo = j.status === undefined || j.status === null || j.status === 'ativo';
        if (isAtivo) {
          jogadoresAtivosIds.add(String(j.id));
          if (j.nome) jogadoresAtivosNomes.add(j.apelido || j.nome);
        }
      });
    }

    const ehJogadorAtivo = (jogadorId: any) => {
      if (!apenasAtivos) return true;
      if (typeof jogadorId === 'object') {
        if (jogadorId?.id && jogadoresAtivosIds.has(String(jogadorId.id))) return true;
        const nome = jogadorId.apelido || jogadorId.nome;
        return nome ? jogadoresAtivosNomes.has(nome) : false;
      }
      const idStr = String(jogadorId);
      if (jogadoresAtivosIds.has(idStr)) return true;
      const nome = buscarJogador(jogadorId);
      return nome ? jogadoresAtivosNomes.has(nome) : false;
    };

    jogosFiltrados.forEach((jogo, jogoIndex) => {
      const duracaoJogoSegundos = calcularDuracaoJogoSegundos(jogo);
      [...jogo.time_a, ...jogo.time_b].forEach(jogadorId => {
        if (!ehJogadorAtivo(jogadorId)) return;
        const nome = buscarJogador(jogadorId);
        if (!stats[nome]) {
          stats[nome] = { 
            nome, 
            jogos: 0, 
            vitorias: 0, 
            derrotas: 0, 
            empates: 0, 
            gols: 0,
            golsContra: 0,
            assistencias: 0,
            mvp: 0,
            cleanSheets: 0,
            deiteiRolei: 0,
            sequenciaInvicta: 0,
            sequenciaAtual: 0,
            ultimosResultados: [] as string[],
            minutosJogados: 0,
          };
        }

        stats[nome].jogos++;
        stats[nome].minutosJogados += Math.floor(duracaoJogoSegundos / 60);
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
        
        // Contar clean sheets (time não levou gols em vitória ou empate)
        const golsSofridos = noTimeA ? jogo.placar_b : jogo.placar_a;
        const venceu = (noTimeA && jogo.placar_a > jogo.placar_b) || (!noTimeA && jogo.placar_b > jogo.placar_a);
        const empatou = jogo.placar_a === jogo.placar_b;
        if (golsSofridos === 0 && (venceu || empatou)) {
          stats[nome].cleanSheets++;
        }
      });

      // Contar gols
      (jogo.gols || []).forEach(gol => {
        if (gol.jogador_id === 'gol_contra') {
          const autorId = gol.gol_contra_jogador_id;
          if (!autorId || !ehJogadorAtivo(autorId)) return;
          const nomeAutor = buscarJogador(autorId);
          if (stats[nomeAutor]) {
            stats[nomeAutor].golsContra = (stats[nomeAutor].golsContra || 0) + 1;
          }
          return;
        }

        if (!ehJogadorAtivo(gol.jogador_id)) return;
        const nome = buscarJogador(gol.jogador_id);
        if (stats[nome]) {
          stats[nome].gols++;
        }
      });
      
      // Contar assistências
      (jogo.assistencias || []).forEach(assist => {
        if (!ehJogadorAtivo(assist.jogador_id)) return;
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

    const enriquecerRanking = (ranking: RankingItem[], id: string): RankingItem[] => {
      const anotado = ranking.map((item) => {
        const dados = stats[item.nome];
        const jogosAmostra = dados?.jogos || 0;
        const minutosAmostra = dados?.minutosJogados || 0;
        return {
          ...item,
          jogosAmostra,
          minutosAmostra,
          confiabilidadeAmostra: classificarConfiabilidadeAmostra(jogosAmostra, minutosAmostra),
        };
      });

      return anotado.map((item, idx) => ({ ...item, posicao: idx + 1 }));
    };

    const obterSessoesOrdenadas = (jogosBase: Jogo[]) => {
      const sessoes = [...new Set(jogosBase.map((j) => j.sessao_id))];
      return sessoes
        .map((sessaoId) => {
          const jogosSessao = jogosBase.filter((j) => j.sessao_id === sessaoId);
          const dataRecente = jogosSessao.reduce((prev, curr) =>
            new Date(curr.created_at) > new Date(prev.created_at) ? curr : prev
          );
          return { sessaoId, data: new Date(dataRecente.created_at) };
        })
        .sort((a, b) => b.data.getTime() - a.data.getTime());
    };

    const calcularLideresSimples = (jogosBase: Jogo[]) => {
      const statsBase: { [nome: string]: any } = {};
      jogosBase.forEach((jogo) => {
        const golsPorNome: { [nome: string]: number } = {};
        const assistsPorNome: { [nome: string]: number } = {};

        (jogo.gols || []).forEach((gol) => {
          if (gol.jogador_id === 'gol_contra') {
            const autorId = gol.gol_contra_jogador_id;
            if (!autorId || !ehJogadorAtivo(autorId)) return;
            const autorNome = buscarJogador(autorId);
            if (!statsBase[autorNome]) {
              statsBase[autorNome] = { nome: autorNome, jogos: 0, vitorias: 0, derrotas: 0, empates: 0, gols: 0, assistencias: 0, golsContra: 0, cleanSheets: 0, mvp: 0, decisivo: 0, carregou: 0, hatTricks: 0 };
            }
            statsBase[autorNome].golsContra++;
            return;
          }
          if (!ehJogadorAtivo(gol.jogador_id)) return;
          const nome = buscarJogador(gol.jogador_id);
          golsPorNome[nome] = (golsPorNome[nome] || 0) + 1;
          if (!statsBase[nome]) {
            statsBase[nome] = { nome, jogos: 0, vitorias: 0, derrotas: 0, empates: 0, gols: 0, assistencias: 0, golsContra: 0, cleanSheets: 0, mvp: 0, decisivo: 0, carregou: 0, hatTricks: 0 };
          }
          statsBase[nome].gols++;
        });

        (jogo.assistencias || []).forEach((assist) => {
          if (!ehJogadorAtivo(assist.jogador_id)) return;
          const nome = buscarJogador(assist.jogador_id);
          assistsPorNome[nome] = (assistsPorNome[nome] || 0) + 1;
          if (!statsBase[nome]) {
            statsBase[nome] = { nome, jogos: 0, vitorias: 0, derrotas: 0, empates: 0, gols: 0, assistencias: 0, golsContra: 0, cleanSheets: 0, mvp: 0, decisivo: 0, carregou: 0, hatTricks: 0 };
          }
          statsBase[nome].assistencias++;
        });

        [...jogo.time_a, ...jogo.time_b].forEach((jogadorId) => {
          if (!ehJogadorAtivo(jogadorId)) return;
          const nome = buscarJogador(jogadorId);
          if (!statsBase[nome]) {
            statsBase[nome] = { nome, jogos: 0, vitorias: 0, derrotas: 0, empates: 0, gols: 0, assistencias: 0, golsContra: 0, cleanSheets: 0, mvp: 0, decisivo: 0, carregou: 0, hatTricks: 0 };
          }

          statsBase[nome].jogos++;
          const noTimeA = jogo.time_a.includes(jogadorId);
          const venceu = (noTimeA && jogo.placar_a > jogo.placar_b) || (!noTimeA && jogo.placar_b > jogo.placar_a);
          const empatou = jogo.placar_a === jogo.placar_b;
          const golsSofridos = noTimeA ? jogo.placar_b : jogo.placar_a;

          if (empatou) statsBase[nome].empates++;
          else if (venceu) statsBase[nome].vitorias++;
          else statsBase[nome].derrotas++;

          if (golsSofridos === 0 && (venceu || empatou)) statsBase[nome].cleanSheets++;

          const gols = golsPorNome[nome] || 0;
          const assists = assistsPorNome[nome] || 0;

          if (venceu && (gols > 0 || assists > 0)) statsBase[nome].mvp++;
          if (venceu && gols > 0) statsBase[nome].decisivo += gols;
          if (!venceu && gols + assists > 0) statsBase[nome].carregou += gols + assists;
          if (gols >= 3 || assists >= 3) statsBase[nome].hatTricks++;
        });
      });

      const listaElegivel = Object.values(statsBase)
        .map((s: any) => ({
          ...s,
          participacoes: (s.gols || 0) + (s.assistencias || 0),
          pontos: calcularPontosEstatisticas(s, pontuacaoEstatisticas),
          aproveitamento: s.jogos > 0 ? (s.vitorias / s.jogos) : 0,
        }));

      const lider = (arr: any[]) => arr.length > 0 ? arr[0].nome : '';

      const classificacao = [...listaElegivel].sort((a: any, b: any) => {
        if (b.pontos !== a.pontos) return b.pontos - a.pontos;
        if (b.gols !== a.gols) return b.gols - a.gols;
        if (a.golsContra !== b.golsContra) return a.golsContra - b.golsContra;
        if (b.assistencias !== a.assistencias) return b.assistencias - a.assistencias;
        if (b.vitorias !== a.vitorias) return b.vitorias - a.vitorias;
        if (a.derrotas !== b.derrotas) return a.derrotas - b.derrotas;
        if (b.cleanSheets !== a.cleanSheets) return b.cleanSheets - a.cleanSheets;
        if (b.empates !== a.empates) return b.empates - a.empates;
        return a.jogos - b.jogos;
      });

      return {
        artilheiro: lider([...listaElegivel].sort((a: any, b: any) => b.gols - a.gols)),
        garcom: lider([...listaElegivel].sort((a: any, b: any) => b.assistencias - a.assistencias)),
        participacoesGols: lider([...listaElegivel].sort((a: any, b: any) => b.participacoes - a.participacoes)),
        decisivo: lider([...listaElegivel].sort((a: any, b: any) => b.decisivo - a.decisivo)),
        vitorioso: lider([...listaElegivel].sort((a: any, b: any) => b.vitorias - a.vitorias || b.aproveitamento - a.aproveitamento)),
        carregouTime: lider([...listaElegivel].sort((a: any, b: any) => b.carregou - a.carregou)),
        semSofrerGols: lider([...listaElegivel].sort((a: any, b: any) => b.cleanSheets - a.cleanSheets)),
        fominha: lider([...listaElegivel].sort((a: any, b: any) => b.jogos - a.jogos)),
        bolaMurcha: classificacao.length > 0 ? classificacao[classificacao.length - 1].nome : '',
        reiPelada: lider(classificacao),
        mvp: lider([...listaElegivel].sort((a: any, b: any) => b.mvp - a.mvp)),
        golsContra: lider([...listaElegivel].sort((a: any, b: any) => b.golsContra - a.golsContra)),
        hatTricks: lider([...listaElegivel].sort((a: any, b: any) => b.hatTricks - a.hatTricks)),
      };
    };

    // Log de MVPs totalizados
    const totalMVPs = Object.values(stats).reduce((sum: number, s: any) => sum + (s.mvp || 0), 0);
    if (DEBUG) console.log(`🎯 TOTAL DE MVPs CALCULADOS: ${totalMVPs}`);
    const jogadoresComMVP = Object.values(stats).filter((s: any) => s.mvp > 0);
    if (DEBUG) console.log(`🎯 Jogadores com MVP:`, jogadoresComMVP.map((s: any) => `${s.nome}: ${s.mvp}`));

    // 1. ARTILHEIRO
    const artilheiro = Object.values(stats)
      .filter((s: any) => s.gols > 0)
      .sort((a: any, b: any) => b.gols - a.gols)
      .map((s: any, idx) => { 
        const media = s.jogos > 0 ? (s.gols / s.jogos).toFixed(2) : '0.00';
        return { 
          posicao: idx + 1, 
          nome: s.nome, 
          valor: `${s.gols} gols em ${s.jogos} jogos, média de ${media}`,
          gols: s.gols,
          jogos: s.jogos,
          media: media
        };
      });

    // 2. GARÇOM (assistências)
    const garcom = Object.values(stats)
      .filter((s: any) => s.assistencias > 0)
      .sort((a: any, b: any) => b.assistencias - a.assistencias)
      .map((s: any, idx) => { 
        const media = s.jogos > 0 ? (s.assistencias / s.jogos).toFixed(2) : '0.00';
        return { 
          posicao: idx + 1, 
          nome: s.nome, 
          valor: `${s.assistencias} assistências em ${s.jogos} jogos, média de ${media}`,
          assistencias: s.assistencias,
          jogos: s.jogos,
          media: media
        };
      });

    // 2.5 PARTICIPAÇÕES EM GOLS (gols + assistências)
    const participacoesGols = Object.values(stats)
      .map((s: any) => {
        const participacoes = (s.gols || 0) + (s.assistencias || 0);
        const media = s.jogos > 0 ? (participacoes / s.jogos).toFixed(2) : '0.00';
        return {
          nome: s.nome,
          jogos: s.jogos,
          participacoes,
          gols: s.gols || 0,
          assistencias: s.assistencias || 0,
          media
        };
      })
      .filter((s: any) => s.participacoes > 0)
      .sort((a: any, b: any) => {
        if (b.participacoes !== a.participacoes) return b.participacoes - a.participacoes;
        if (b.gols !== a.gols) return b.gols - a.gols;
        return b.assistencias - a.assistencias;
      })
      .map((s: any, idx) => ({
        posicao: idx + 1,
        nome: s.nome,
        valor: `${s.participacoes} participações em ${s.jogos} jogos, média de ${s.media}`,
        participacoes: s.participacoes,
        gols: s.gols,
        assistencias: s.assistencias,
        jogos: s.jogos,
        media: s.media
      }));

    // 3. VITORIOSO
    const vitorioso = Object.values(stats)
      .filter((s: any) => s.vitorias > 0)
      .sort((a: any, b: any) => {
        // Ordenar por quantidade de vitórias primeiro
        const diffVitorias = b.vitorias - a.vitorias;
        if (diffVitorias !== 0) return diffVitorias;
        // Em caso de empate, melhor aproveitamento
        const aproveitamentoB = b.jogos > 0 ? (b.vitorias / b.jogos) * 100 : 0;
        const aproveitamentoA = a.jogos > 0 ? (a.vitorias / a.jogos) * 100 : 0;
        return aproveitamentoB - aproveitamentoA;
      })
      .map((s: any, idx) => ({ 
        posicao: idx + 1, 
        nome: s.nome, 
        valor: `${s.vitorias} vitórias em ${s.jogos} jogos`,
        vitorias: s.vitorias,
        jogos: s.jogos,
        aproveitamento: s.jogos > 0 ? ((s.vitorias / s.jogos) * 100).toFixed(1) : '0.0'
      }));

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
      .map((s: any, idx) => ({ 
        posicao: idx + 1, 
        nome: s.nome, 
        valor: `${s.mvp} de ${s.jogos} jogos com participações em gols`,
        mvp: s.mvp,
        jogos: s.jogos
      }));

    // 5.5 GOL CONTRA (autor do gol contra)
    const golsContraRanking = Object.values(stats)
      .filter((s: any) => (s.golsContra || 0) > 0)
      .sort((a: any, b: any) => {
        const diff = (b.golsContra || 0) - (a.golsContra || 0);
        if (diff !== 0) return diff;
        return b.jogos - a.jogos;
      })
      .map((s: any, idx) => ({
        posicao: idx + 1,
        nome: s.nome,
        valor: `${s.golsContra} gol${s.golsContra > 1 ? 's' : ''} contra em ${s.jogos} jogos`,
        golsContra: s.golsContra,
        jogos: s.jogos,
      }));

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
        jogos: data.jogos,
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
        valor: `${s.semSofrer} jogos sem sofrer gols (${s.percentual}%)`,
        semSofrer: s.semSofrer,
        jogos: s.jogos,
        percentual: s.percentual
      }));

    // 8.5 CARREGOU O TIME (impacto ofensivo em jogos sem vitória: derrota ou empate)
    const carregouTime = Object.values(stats)
      .map((s: any) => {
        let pontos = 0;
        let jogosComImpacto = 0;
        let golsComImpacto = 0;
        let assistenciasComImpacto = 0;
        let derrotasTotal = 0;
        let derrotasComImpacto = 0;

        jogosFiltrados.forEach((jogo: any) => {
          const todosIds = [...jogo.time_a, ...jogo.time_b];
          const jogadorId = todosIds.find(id => buscarJogador(id) === s.nome);
          if (!jogadorId) return;

          const noTimeA = jogo.time_a.includes(jogadorId);
          const venceu = (noTimeA && jogo.placar_a > jogo.placar_b) || (!noTimeA && jogo.placar_b > jogo.placar_a);
          const empatou = jogo.placar_a === jogo.placar_b;
          const perdeu = !venceu && !empatou;
          if (venceu) return;

          if (perdeu) {
            derrotasTotal++;
          }

          const golsNoJogo = (jogo.gols || []).filter((g: any) => buscarJogador(g.jogador_id) === s.nome).length;
          const assistsNoJogo = (jogo.assistencias || []).filter((a: any) => buscarJogador(a.jogador_id) === s.nome).length;
          const pontosNoJogo = golsNoJogo + assistsNoJogo;

          if (pontosNoJogo > 0) {
            pontos += pontosNoJogo;
            jogosComImpacto++;
            golsComImpacto += golsNoJogo;
            assistenciasComImpacto += assistsNoJogo;
            if (perdeu) {
              derrotasComImpacto++;
            }
          }
        });

        return {
          nome: s.nome,
          pontos,
          jogosComImpacto,
          golsComImpacto,
          assistenciasComImpacto,
          derrotasTotal,
          derrotasComImpacto,
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
        valor: `${s.pontos} part. em gols, mesmo na derrota`,
        pontos: s.pontos,
        jogosComImpacto: s.jogosComImpacto,
        golsComImpacto: s.golsComImpacto,
        assistenciasComImpacto: s.assistenciasComImpacto,
        derrotasTotal: s.derrotasTotal,
        derrotasComImpacto: s.derrotasComImpacto,
      }));

    // Base única da classificação para reaproveitar nos rankings de Rei/Bola Murcha
    const classificacaoBase = Object.values(stats)
      .map((s: any) => ({
        nome: s.nome,
        pontos: calcularPontosEstatisticas(s, pontuacaoEstatisticas),
        gols: s.gols,
        golsContra: s.golsContra || 0,
        assistencias: s.assistencias,
        vitorias: s.vitorias,
        derrotas: s.derrotas,
        cleanSheets: s.cleanSheets,
        empates: s.empates,
        jogos: s.jogos
      }))
      .sort((a, b) => {
        // Critério de desempate: Pontos > Gols > Gols Contra (menos) > Assistências > Vitórias > Derrotas (menos) > Clean Sheets > Empates > Jogos (menos)
        if (b.pontos !== a.pontos) return b.pontos - a.pontos;
        if (b.gols !== a.gols) return b.gols - a.gols;
        if (a.golsContra !== b.golsContra) return a.golsContra - b.golsContra;
        if (b.assistencias !== a.assistencias) return b.assistencias - a.assistencias;
        if (b.vitorias !== a.vitorias) return b.vitorias - a.vitorias;
        if (a.derrotas !== b.derrotas) return a.derrotas - b.derrotas;
        if (b.cleanSheets !== a.cleanSheets) return b.cleanSheets - a.cleanSheets;
        if (b.empates !== a.empates) return b.empates - a.empates;
        return a.jogos - b.jogos;
      });

    // 9. REI DA PELADA (com critérios de desempate da classificação)
    const reiPelada = classificacaoBase
      .map((s, idx) => ({ posicao: idx + 1, nome: s.nome, valor: `${s.pontos.toFixed(1)} pts`, nivel: jogadores[s.nome]?.nivel || 0 }));

    // 10. BOLA MURCHA (último colocado da classificação, respeitando desempates)
    const bolaMurcha = [...classificacaoBase]
      .reverse()
      .map((s, idx) => ({ 
        posicao: idx + 1, 
        nome: s.nome, 
        valor: `${s.pontos.toFixed(1)} pts`,
        pontos: s.pontos,
        vitorias: s.vitorias,
        derrotas: s.derrotas,
        gols: s.gols,
        golsContra: s.golsContra,
        assistencias: s.assistencias,
        cleanSheets: s.cleanSheets,
        empates: s.empates,
        jogos: s.jogos
      }));

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

    // FOMINHA (jogador que jogou mais partidas)
    // Opções de emoji: 🍖 🔥 💪 🎯 ⚡ 🚀 👊 💯 🎪 🎭 🎨 🎬 🎤 🎸 🎹
    const totalPartidas = jogosFiltrados.length;
    const fominha = Object.values(stats)
      .sort((a: any, b: any) => b.jogos - a.jogos)
      .map((s: any, idx) => ({ 
        posicao: idx + 1, 
        nome: s.nome, 
        valor: `Jogou ${s.jogos} dos ${totalPartidas} jogos`,
        jogos: s.jogos,
        total: totalPartidas
      }));

    // 15. DEITEI E ROLEI (vitória + gol + assistência na mesma partida)
    const deiteiRolei = Object.values(stats)
      .filter((s: any) => s.deiteiRolei > 0)
      .sort((a: any, b: any) => b.deiteiRolei - a.deiteiRolei)
      .map((s: any, idx) => ({ posicao: idx + 1, nome: s.nome, valor: `${s.deiteiRolei} vezes` }));

    // 16. DECISIVO (gols que definiram a vitória)
    const decisivo = Object.values(stats)
      .map((s: any) => {
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
        
        return {
          nome: s.nome,
          golsDecisivos,
        };
      })
      .filter((s: any) => s.golsDecisivos > 0)
      .sort((a: any, b: any) => b.golsDecisivos - a.golsDecisivos)
      .map((s: any, idx) => ({ posicao: idx + 1, nome: s.nome, valor: `${s.golsDecisivos} gols que deram a vitória ao time`, golsDecisivos: s.golsDecisivos }));

    // 17. GOLEIRO MENOS VAZADO (menos gols sofridos - placeholder)
    const goleiroMenosVazado = []
      .map((s: any, idx) => ({ posicao: idx + 1, nome: s?.nome || '-', valor: 'em desenvolvimento' }));

    // Montar array de estatísticas
    const estatisticasCalculadas: Estatistica[] = [
      { id: 'artilheiro', emoji: '⚽', nome: 'Artilheiro', descricao: 'Quem marcou mais gols', primeiroColocado: formatarPrimeiroColocado(artilheiro), ranking: artilheiro },
      { id: 'garcom', emoji: '👟', nome: 'Assistências', descricao: 'Quem mais deu assistências', primeiroColocado: formatarPrimeiroColocado(garcom), ranking: garcom },
      { id: 'participacoesGols', emoji: '🥅', nome: 'Participações em gols', descricao: 'Soma de gols + assistências', primeiroColocado: formatarPrimeiroColocado(participacoesGols), ranking: participacoesGols },
      { id: 'hatTricks', emoji: '🎩', nome: 'Hat-Trick', descricao: '3+ gols ou 3+ assistências no mesmo jogo', primeiroColocado: formatarPrimeiroColocado(hatTricksRanking), ranking: hatTricksRanking },
      { id: 'mvp', emoji: '⭐', nome: 'MVP', descricao: 'Vitória + gol/assist na mesma partida', primeiroColocado: formatarPrimeiroColocado(mvp), ranking: mvp },
      { id: 'golsContra', emoji: '🔴', icone: bolaVermelha.src, nome: 'Gol Contra', descricao: 'Quem mais marcou gol contra', primeiroColocado: formatarPrimeiroColocado(golsContraRanking), ranking: golsContraRanking },
      { id: 'decisivo', emoji: '🎯', nome: 'Decisivo', descricao: 'Gols que definiram a vitória', primeiroColocado: formatarPrimeiroColocado(decisivo), ranking: decisivo },
      { id: 'deiteiRolei', emoji: '🎯', nome: 'Deitei e Rolei', descricao: 'Vitória + gol + assist no mesmo jogo', primeiroColocado: formatarPrimeiroColocado(deiteiRolei), ranking: deiteiRolei },
      { id: 'vitorioso', emoji: '🏆', nome: 'Vitorioso', descricao: 'Quem conquistou mais vitórias', primeiroColocado: formatarPrimeiroColocado(vitorioso), ranking: vitorioso },
      { id: 'carregouTime', emoji: '🚛', nome: 'Carregou o Time', descricao: 'Impacto ofensivo em jogos sem vitória (derrota + empate)', primeiroColocado: formatarPrimeiroColocado(carregouTime), ranking: carregouTime },
      { id: 'semSofrerGols', emoji: '🛡️', nome: 'Muralha', descricao: 'Maior % de jogos sem levar gols', primeiroColocado: formatarPrimeiroColocado(semSofrerGolsRanking), ranking: semSofrerGolsRanking },
      { id: 'goleiro', emoji: '🧤', nome: 'Goleiro Destaque', descricao: 'em desenvolvimento', primeiroColocado: 'em desenvolvimento', ranking: [] },
      { id: 'goleiroMenosVazado', emoji: '🚫', nome: 'Goleiro Menos Vazado', descricao: 'em desenvolvimento', primeiroColocado: 'em desenvolvimento', ranking: [] },
      { id: 'fominha', emoji: '⚡', nome: 'Fominha', descricao: 'Quem jogou mais partidas', primeiroColocado: formatarPrimeiroColocado(fominha), ranking: fominha },
      { id: 'zeroImpacto', emoji: '🚫', nome: 'Zero Impacto', descricao: 'Mais jogos sem gol, sem assist e sem clean sheet', primeiroColocado: formatarPrimeiroColocado(zeroImpacto), ranking: zeroImpacto },
      { id: 'nota', emoji: '🏅', nome: 'Nota', descricao: 'Média de desempenho por pelada (0–10)', primeiroColocado: formatarPrimeiroColocado(notaRanking), ranking: notaRanking },
      { id: 'reiPelada', emoji: '👑', nome: 'Rei da Pelada', descricao: 'Maior pontuação geral', primeiroColocado: formatarPrimeiroColocado(reiPelada), ranking: reiPelada },
      { id: 'bolaMurcha', emoji: '⚰️', nome: 'Bola Murcha', descricao: 'Menor pontuação geral no filtro (oposto do Rei)', primeiroColocado: formatarPrimeiroColocado(bolaMurcha), ranking: bolaMurcha },
    ];

    const estatisticasEnriquecidas = estatisticasCalculadas.map((estatistica) => {
      const ranking = enriquecerRanking(estatistica.ranking, estatistica.id);
      return {
        ...estatistica,
        ranking,
        primeiroColocado: formatarPrimeiroColocado(ranking),
      };
    });

    setStatsCompletos(stats);
    setEstatisticas(estatisticasEnriquecidas);
  };

  const carregarDados = async () => {
    try {
      setLoading(true);
      const peladaId = buscar_pelada_id();
      if (!peladaId) {
        router.push('/login');
        return;
      }

      setPontuacaoEstatisticas(await carregarPontuacaoEstatisticas(peladaId));

      const clienteDb = await getClienteSupabase(peladaId);
      if (!clienteDb) {
        console.error('? Erro ao obter cliente Supabase');
        return;
      }

      // Buscar jogos para popular filtros
      // Paginação manual: evita truncamento no limite padrão de 1000 linhas do Supabase.
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

        // Associar gols e assistências aos jogos  
        const jogosCompletos = jogosData.map(jogo => {
          const golsDoJogo = (golsData || []).filter(g => g.jogo_id === jogo.id) as Gol[];
          const assistenciasDerivadas = derivarAssistenciasDeGols(golsDoJogo);

          return {
            ...jogo,
            gols: golsDoJogo,
            assistencias: assistenciasDerivadas
          };
        });

        if (DEBUG) console.log('📊 Debug MVP - Total de jogos:', jogosCompletos.length);
        if (DEBUG) console.log('📊 Debug MVP - Gols carregados:', golsData?.length || 0);
        if (DEBUG) {
          const assistTotal = jogosCompletos.reduce((acc, j) => acc + (j.assistencias?.length || 0), 0);
          console.log('📊 Debug MVP - Assistências carregadas:', assistTotal);
        }
        const jogoComGols = jogosCompletos.find(j => j.gols?.length > 0);
        if (jogoComGols) {
          if (DEBUG) console.log('📊 Debug MVP - Exemplo de jogo com gols:', jogoComGols.id, 'Gols:', jogoComGols.gols);
        }

        setJogos(jogosCompletos);
      } else {
        setJogos([]);
      }

      // Buscar regras para obter quantidade de jogadores por time
      const { data: regrasData } = await supabase
        .from('regras')
        .select('jogadores_por_time')
        .eq('pelada_id', peladaId)
        .single();
      
      if (regrasData) {
        setJogadoresPorTime(regrasData.jogadores_por_time || 5);
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
  const estatisticasVisiveis = ['artilheiro', 'garcom', 'participacoesGols', 'decisivo', 'vitorioso', 'carregouTime', 'semSofrerGols', 'fominha', 'bolaMurcha'];
  const estatisticasCompactas = ['mvp', 'golsContra', 'hatTricks']
    .map((id) => estatisticas.find((estatistica) => estatistica.id === id))
    .filter(Boolean) as Estatistica[];
  const outrasEstatisticas = estatisticas.filter(
    (estatistica) => estatistica.id !== 'reiPelada' && estatisticasVisiveis.includes(estatistica.id)
  );
  const podiumReiPelada = reiPeladaEstatistica?.ranking.slice(0, 3) || [];
  const primeiroLugar = podiumReiPelada[0];
  const segundoLugar = podiumReiPelada[1];
  const terceiroLugar = podiumReiPelada[2];

  const extrairPrimeiroNumero = (texto: string): string => {
    const match = texto.match(/\d+(?:[.,]\d+)?/);
    return match ? match[0] : '-';
  };

  const obterValorPrincipalRanking = (estatisticaId: string, item: any): string => {
    switch (estatisticaId) {
      case 'artilheiro':
        return String(item.gols ?? extrairPrimeiroNumero(String(item.valor || '')));
      case 'garcom':
        return String(item.assistencias ?? extrairPrimeiroNumero(String(item.valor || '')));
      case 'participacoesGols':
        return String(item.participacoes ?? extrairPrimeiroNumero(String(item.valor || '')));
      case 'vitorioso':
        return String(item.vitorias ?? extrairPrimeiroNumero(String(item.valor || '')));
      case 'decisivo':
        return String(item.golsDecisivos ?? extrairPrimeiroNumero(String(item.valor || '')));
      case 'carregouTime':
        return String(item.pontos ?? extrairPrimeiroNumero(String(item.valor || '')));
      case 'semSofrerGols':
        return String(item.semSofrer ?? extrairPrimeiroNumero(String(item.valor || '')));
      case 'fominha':
        return String(item.jogos ?? extrairPrimeiroNumero(String(item.valor || '')));
      case 'mvp':
      case 'golsContra':
      case 'hatTricks':
      case 'deiteiRolei':
      case 'zeroImpacto':
      case 'reiPelada':
      case 'bolaMurcha':
      case 'nota':
      default:
        return extrairPrimeiroNumero(String(item.valor || ''));
    }
  };

  const obterLegendaRanking = (estatisticaId: string, item: any): string => {
    switch (estatisticaId) {
      case 'artilheiro':
        return `${item.jogos || 0} jogos, media de ${item.media || '0.00'} por jogo`;
      case 'garcom':
        return `${item.jogos || 0} jogos, media de ${item.media || '0.00'} por jogo`;
      case 'participacoesGols':
        return `${item.jogos || 0} jogos, media de ${item.media || '0.00'} por jogo • ⚽ ${item.gols || 0} • 👟 ${item.assistencias || 0}`;
      case 'mvp':
        return `${item.jogos || 0} jogos com participacao em gol na vitoria`;
      case 'golsContra':
        return `${item.jogos || 0} jogos`;
      case 'vitorioso':
        return `${item.jogos || 0} jogos, aproveitamento de ${item.aproveitamento || '0.0'}%`;
      case 'hatTricks': {
        const texto = String(item.valor || '');
        const detalhe = texto.includes('(') ? texto.substring(texto.indexOf('(') + 1, texto.lastIndexOf(')')) : '3+ gols ou 3+ assistencias no mesmo jogo';
        return detalhe;
      }
      case 'decisivo':
        return 'gols que deram a vitoria ao time';
      case 'deiteiRolei':
        return 'vitoria com gol e assistencia no mesmo jogo';
      case 'carregouTime':
        return `⚽ ${item.golsComImpacto || 0} • 👟 ${item.assistenciasComImpacto || 0} • Fez sua parte em ${item.derrotasComImpacto || 0} das ${item.derrotasTotal || 0} derrotas (${item.derrotasTotal > 0 ? Math.round(((item.derrotasComImpacto || 0) / item.derrotasTotal) * 100) : 0}%)`;
      case 'semSofrerGols':
        return `${item.jogos || 0} jogos, ${item.percentual || '0.0'}% sem sofrer gol`;
      case 'fominha':
        return `presenca em ${item.total || 0} jogos do periodo`;
      case 'zeroImpacto': {
        const texto = String(item.valor || '');
        const match = texto.match(/\((\d+)%\)/);
        return `${match ? match[1] : '0%'} das partidas sem gol e sem assistencia`;
      }
      case 'nota':
        return 'media de desempenho por pelada';
      case 'reiPelada':
        return 'pontuacao geral no filtro selecionado';
      case 'bolaMurcha':
        return `${item.vitorias || 0}V, ${item.empates || 0}E, ${item.derrotas || 0}D em ${item.jogos || 0} jogos`;
      default:
        return String(item.valor || '');
    }
  };

  return (
    <Layout title="Estatísticas">
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

        {/* Seção: Time da Pelada */}
        {(() => {
          // Buscar as melhores estatísticas gerais (Rei da Pelada)
          const reiPeladaEstat = estatisticas.find(e => e.id === 'reiPelada');
          if (!reiPeladaEstat || reiPeladaEstat.ranking.length === 0) return null;
          
          // Usar quantidade dinâmica de jogadores por time
          const timeDaPelada = reiPeladaEstat.ranking.slice(0, jogadoresPorTime);
          const primeiroLugarJogador = timeDaPelada[0];
          const demaisJogadores = timeDaPelada.slice(1);
          
          // Função para obter rótulo do filtro
          const obterRotuloFiltro = () => {
            let label = '';
            if (filtro === 'atual') label = 'Pelada mais recente';
            else if (filtro === 'ultimas') label = `Últimas ${quantidadePeladas} peladas`;
            else if (filtro === 'historia') label = 'Histórico completo';
            else if (filtro === 'mes') label = periodoSelecionado ? periodoSelecionado : 'Todos os meses';
            else if (filtro === 'ano') label = periodoSelecionado ? periodoSelecionado : 'Todos os anos';
            if (dataSelecionada) label = `Pelada: ${dataSelecionada}`;
            return label;
          };
          
          return (
            <div className="mb-6 mt-8">
              {/* Título + Filtro */}
              <div className="mb-3">
                {/* Titulo */}
                <h2 className="text-lg font-black text-black tracking-widest text-center mb-2">🏆 TIME DA PELADA 🏆</h2>
                
                {/* Badge do filtro */}
                <div className="flex items-center justify-center mb-2">
                  <div className="w-full bg-green-500 rounded-lg px-4 py-1.5 flex items-center justify-center gap-2 shadow-sm">
                    <span className="text-white text-xs font-bold">{obterRotuloFiltro()}</span>
                  </div>
                </div>
              </div>

              {/* 1º COLOCADO - REI DA PELADA */}
              {primeiroLugarJogador && (
                <div className="mb-1.5 p-2.5 rounded-xl bg-white border-2 border-yellow-300 shadow-lg">
                  {/* Conteúdo centralizado - dividido ao meio */}
                  <div className="flex items-center justify-center gap-4">
                    {/* ESQUERDA: Coroa + Badge - alinhados à direita */}
                    <div className="flex flex-col items-end gap-1">
                      <div className="text-4xl">👑</div>
                      <div className="inline-block px-2 py-0.5 bg-yellow-300 border-2 border-yellow-500 text-black font-bold text-xs rounded-md shadow-sm">
                        Rei da Pelada
                      </div>
                    </div>
                    
                    {/* DIREITA: Nome + Estrelas + Pontos - alinhados à esquerda */}
                    <div className="flex flex-col items-start gap-0">
                      {/* Nome */}
                      <span className="font-black text-lg text-gray-900 uppercase tracking-wide">
                        {primeiroLugarJogador.nome}
                      </span>
                      
                      {/* Estrelas */}
                      <div className="flex items-center gap-0.5">
                        {(() => {
                          const nivelJogador = jogadores[primeiroLugarJogador.nome]?.nivel || 0;
                          if (nivelJogador > 0) {
                            return Array.from({ length: 5 }).map((_, i) => (
                              <span key={i} className={`text-lg ${i < nivelJogador ? 'text-yellow-400' : 'text-gray-300'}`}>★</span>
                            ));
                          }
                          return <span className="text-xs text-gray-400">Sem classificação</span>;
                        })()}
                      </div>
                      
                      {/* Pontos */}
                      <span className="text-sm font-black text-amber-600">
                        {primeiroLugarJogador.valor}
                      </span>
                    </div>
                  </div>
                  
                  {/* Stats: Tabela sutil com linhas invisíveis */}
                  {statsCompletos[primeiroLugarJogador.nome] && (
                    <div className="border-t border-gray-200 pt-0.5 mt-1">
                      {/* Linha 1: Jogos, Vitórias, Empates, Derrotas */}
                      <div className="grid grid-cols-4 gap-0 mb-0.5 pb-0.5 border-b border-gray-200 text-xs">
                        <div className="text-center border-r border-gray-200 border-opacity-30 pr-1">
                          <div className="font-black text-base text-gray-600">{statsCompletos[primeiroLugarJogador.nome].jogos}</div>
                          <div className="text-gray-600 font-semibold text-xs">Jogos</div>
                        </div>
                        <div className="text-center border-r border-gray-200 border-opacity-30 px-1">
                          <div className="font-black text-base text-green-600">{statsCompletos[primeiroLugarJogador.nome].vitorias}</div>
                          <div className="text-gray-600 font-semibold text-xs">Vitórias</div>
                        </div>
                        <div className="text-center border-r border-gray-200 border-opacity-30 px-1">
                          <div className="font-black text-base text-yellow-500">{statsCompletos[primeiroLugarJogador.nome].empates}</div>
                          <div className="text-gray-600 font-semibold text-xs">Empates</div>
                        </div>
                        <div className="text-center pl-1">
                          <div className="font-black text-base text-red-600">{statsCompletos[primeiroLugarJogador.nome].derrotas}</div>
                          <div className="text-gray-600 font-semibold text-xs">Derrotas</div>
                        </div>
                      </div>
                      
                      {/* Linha 2: Gols, Assistências, MVP, Clean Sheets */}
                      <div className="grid grid-cols-4 gap-0 text-xs">
                        <div className="text-center border-r border-gray-200 border-opacity-30 pr-1">
                          <div className="flex items-center justify-center gap-0.5">
                            <span className="text-base">⚽</span>
                            <span className="text-base font-black text-gray-600">{statsCompletos[primeiroLugarJogador.nome].gols || 0}</span>
                          </div>
                        </div>
                        <div className="text-center border-r border-gray-200 border-opacity-30 px-1">
                          <div className="flex items-center justify-center gap-0.5">
                            <span className="text-base">👟</span>
                            <span className="text-base font-black text-gray-600">{statsCompletos[primeiroLugarJogador.nome].assistencias || 0}</span>
                          </div>
                        </div>
                        <div className="text-center border-r border-gray-200 border-opacity-30 px-1">
                          <div className="flex items-center justify-center gap-0.5">
                            <span className="text-base">⭐</span>
                            <span className="text-base font-black text-gray-600">{statsCompletos[primeiroLugarJogador.nome].mvp || 0}</span>
                          </div>
                        </div>
                        <div className="text-center pl-1">
                          <div className="flex items-center justify-center gap-0.5">
                            <span className="text-base">🛡️</span>
                            <span className="text-base font-black text-gray-600">{statsCompletos[primeiroLugarJogador.nome].cleanSheets || 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* DEMAIS JOGADORES - LISTA LIMPA */}
              {demaisJogadores.length > 0 && (
                <div className="space-y-1">
                  {demaisJogadores.map((jogador, idx) => {
                    const posicao = idx + 2;
                    const statsJogador = statsCompletos[jogador.nome] || {};
                    
                    // Cores por posição: 2º prata, 3º bronze, demais verde
                    let posicaoBg = 'text-gray-400';
                    
                    if (posicao === 2) {
                      posicaoBg = 'text-gray-400'; // Prata
                    } else if (posicao === 3) {
                      posicaoBg = 'text-amber-600'; // Bronze
                    } else {
                      posicaoBg = 'text-green-500'; // Verde para demais
                    }
                    
                    return (
                      <div key={idx} className="py-2 px-2.5 rounded bg-white border border-gray-200">
                        {/* Linha 1: Número + Nome + Pontuação */}
                        <div className="flex items-center gap-1 mb-1.5">
                          <span className={`font-black text-base flex-shrink-0 ${posicaoBg}`}>
                            {posicao}º
                          </span>
                          
                          {/* Nome - mais destacado */}
                          <span className="font-black text-sm text-gray-900 uppercase flex-1 min-w-0">
                            {jogador.nome}
                          </span>
                          
                          {/* Pontuação do Jogador - DEPOIS DO NOME */}
                          <span className="text-sm font-black text-amber-600 flex-shrink-0">
                            {jogador.valor}
                          </span>
                        </div>
                        
                        {/* Linha 2: Stats - Separado em categorias com mais espaço */}
                        <div className="flex items-center gap-2.5 text-xs opacity-60">
                          {/* Jogos/Vitórias/Empates/Derrotas */}
                          <div className="flex items-center gap-0 pr-2 border-r border-gray-200 border-opacity-40">
                            <span className="font-semibold text-gray-600 px-1 border-r border-gray-200 border-opacity-30">J <span className="font-black">{statsJogador.jogos || 0}</span></span>
                            <span className="font-semibold text-green-600 px-1 border-r border-gray-200 border-opacity-30">V <span className="font-black">{statsJogador.vitorias || 0}</span></span>
                            <span className="font-semibold text-yellow-500 px-1 border-r border-gray-200 border-opacity-30">E <span className="font-black">{statsJogador.empates || 0}</span></span>
                            <span className="font-semibold text-red-600 px-1">D <span className="font-black">{statsJogador.derrotas || 0}</span></span>
                          </div>
                          
                          {/* Gols/Assistências/MVP/Clean Sheets */}
                          <div className="flex items-center gap-2.5 flex-1">
                            <span className="text-gray-600">⚽ <span className="font-semibold">{statsJogador.gols || 0}</span></span>
                            <span className="text-gray-600">👟 <span className="font-semibold">{statsJogador.assistencias || 0}</span></span>
                            <span className="text-gray-600">⭐ <span className="font-semibold">{statsJogador.mvp || 0}</span></span>
                            <span className="text-gray-600">🛡️ <span className="font-semibold">{statsJogador.cleanSheets || 0}</span></span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* MODAL GOLEIRO - ESCONDIDO */}
              <div className="hidden py-2 px-2.5 rounded bg-white border border-amber-700 border-opacity-30">
                {/* Linha 1: Luvinha + Nome Goleiro */}
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-black text-base flex-shrink-0 w-5">🧤</span>
                  
                  {/* Nome */}
                  <span className="font-semibold text-sm text-gray-900 uppercase flex-1 min-w-0 truncate">
                    Goleiro
                  </span>
                </div>
                
                {/* Linha 2: Stats vazios (aguardando integração de goleiros) */}
                <div className="flex items-center gap-2.5 text-xs opacity-60">
                  {/* Jogos/Vitórias/Empates/Derrotas */}
                  <div className="flex items-center gap-0 pr-2 border-r border-gray-200 border-opacity-40">
                    <span className="font-semibold text-gray-600 px-1 border-r border-gray-200 border-opacity-30">J <span className="font-black">0</span></span>
                    <span className="font-semibold text-green-600 px-1 border-r border-gray-200 border-opacity-30">V <span className="font-black">0</span></span>
                    <span className="font-semibold text-yellow-500 px-1 border-r border-gray-200 border-opacity-30">E <span className="font-black">0</span></span>
                    <span className="font-semibold text-red-600 px-1">D <span className="font-black">0</span></span>
                  </div>
                  
                  {/* Gols/Assistências/MVP/Clean Sheets + Pontos */}
                  <div className="flex items-center gap-2.5 flex-1">
                    <span className="text-gray-600">⚽ <span className="font-semibold">0</span></span>
                    <span className="text-gray-600">👟 <span className="font-semibold">0</span></span>
                    <span className="text-gray-600">⭐ <span className="font-semibold">0</span></span>
                    <span className="text-gray-600">🛡️ <span className="font-semibold">0</span></span>
                    <span className="text-gray-600 font-bold ml-auto">0.0 pts</span>
                  </div>
                </div>
              </div>

              {/* LEGENDAS DAS ESTATÍSTICAS */}
              <div className="mt-4 pt-3 border-t border-gray-300">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-600 justify-center place-items-center">
                  <div className="flex items-center gap-1"><span>⚽</span> <span>Gols</span></div>
                  <div className="flex items-center gap-1"><span>👟</span> <span>Assistências</span></div>
                  <div className="flex items-center gap-1"><span>⭐</span> <span>MVP</span></div>
                  <div className="flex items-center gap-1"><span>🛡️</span> <span>Sem Sofrer Gols</span></div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* TÍTULO E FILTRO DAS ESTATÍSTICAS */}
        <div className="mb-3 mt-4">
          {/* Titulo */}
          <h2 className="text-base font-black text-black tracking-widest text-center mb-2">ESTATÍSTICAS E RANKINGS</h2>

          {/* Badge do filtro */}
          <div className="flex items-center justify-center mb-2">
            <div className="w-full bg-blue-600 rounded-lg px-4 py-1.5 flex items-center justify-center gap-2 shadow-sm">
              <span className="text-white text-xs font-bold">
                {(() => {
                  let label = '';
                  if (filtro === 'atual') label = 'Pelada mais recente';
                  else if (filtro === 'ultimas') label = `Últimas ${quantidadePeladas} peladas`;
                  else if (filtro === 'historia') label = 'Histórico completo';
                  else if (filtro === 'mes') label = periodoSelecionado ? periodoSelecionado : 'Todos os meses';
                  else if (filtro === 'ano') label = periodoSelecionado ? periodoSelecionado : 'Todos os anos';
                  if (dataSelecionada) label = `Pelada: ${dataSelecionada}`;
                  return label;
                })()}
              </span>
            </div>
          </div>
        </div>

        {/* Estatísticas em Formato de Linhas Profissional */}
        {outrasEstatisticas.length > 0 ? (
          <div>
            {outrasEstatisticas.map((estatistica, idx) => {
                const cores = obterCoresEstatistica(estatistica.id);
                const primeiro = estatistica.ranking[0];
                
                // Renderizar descrição com destaque no número principal
                const renderDescricao = () => {
                  if (!primeiro) return 'N/A';
                  
                  switch (estatistica.id) {
                    case 'artilheiro':
                      return (
                        <div className="text-xs text-gray-500/80">
                          <span className="text-sm font-semibold text-gray-500/80">{primeiro.valor}</span>
                        </div>
                      );
                    case 'garcom':
                      return (
                        <div className="text-xs text-gray-500/80">
                          <span className="text-sm font-semibold text-gray-500/80">{primeiro.valor}</span>
                        </div>
                      );
                    case 'participacoesGols':
                      return (
                        <div className="text-xs text-gray-500/80">
                          <span className="text-sm font-semibold text-gray-500/80">{primeiro.valor}</span>
                        </div>
                      );
                    case 'mvp':
                      return (
                        <div className="text-xs text-gray-500/80">
                          <span className="text-sm font-semibold text-gray-500/80">{primeiro.valor}</span>
                        </div>
                      );
                    case 'vitorioso':
                      return (
                        <div className="text-xs text-gray-500/80">
                          <span className="text-sm font-semibold text-gray-500/80">{primeiro.valor}</span>
                        </div>
                      );
                    case 'carregouTime':
                      return (
                        <div className="text-xs text-gray-500/80">
                          <span className="text-sm font-semibold text-gray-500/80">{primeiro.valor}</span>
                        </div>
                      );
                    case 'semSofrerGols':
                      return (
                        <div className="text-xs text-gray-500/80">
                          <span className="text-sm font-semibold text-gray-500/80">{primeiro.valor}</span>
                        </div>
                      );
                    case 'fominha':
                      return (
                        <div className="text-xs text-gray-500/80">
                          <span className="text-sm font-semibold text-gray-500/80">{primeiro.valor}</span>
                        </div>
                      );
                    case 'naoPerdi':
                      return (
                        <div className="text-xs text-gray-500/80">
                          <span className="text-sm font-semibold text-gray-500/80">{primeiro.valor}</span>
                        </div>
                      );
                    case 'bolaMurcha':
                      return (
                        <div className="text-xs text-gray-500/80">
                          <span className="text-sm font-semibold text-gray-500/80 inline-flex items-center gap-1.5 flex-wrap">
                            <span>🎮 {(primeiro as any).jogos}</span>
                            <span>🏆 {(primeiro as any).vitorias}</span>
                            <span>🤝 {(primeiro as any).empates}</span>
                            <span>❌ {(primeiro as any).derrotas}</span>
                            <span>⚽ {(primeiro as any).gols}</span>
                            <span className="inline-flex items-center gap-1"><img src={bolaVermelha.src} alt="Gol contra" className="w-3.5 h-3.5 inline-block" /> {(primeiro as any).golsContra}</span>
                            <span>👟 {(primeiro as any).assistencias}</span>
                            <span>🛡️ {(primeiro as any).cleanSheets}</span>
                          </span>
                        </div>
                      );
                    case 'decisivo':
                      return (
                        <div className="text-xs text-gray-500/80">
                          <span className="text-sm font-semibold text-gray-500/80">{primeiro.valor}</span>
                        </div>
                      );
                    case 'goleiro':
                      return <span className="text-xs text-gray-500">Recurso em desenvolvimento</span>;
                    default:
                      return <span className="text-xs text-gray-600">{primeiro?.valor || 'N/A'}</span>;
                  }
                };
                
                return (
                  <React.Fragment key={estatistica.id}>
                    <button
                      onClick={() => abrirModal(estatistica)}
                      className={`w-full flex items-center gap-2 p-2 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left active:bg-gray-100`}
                    >
                      <div className="flex-shrink-0 text-base mt-0.5 w-5 h-5 flex items-center justify-center overflow-visible">
                        {estatistica.icone ? (
                          <img src={estatistica.icone} alt={estatistica.nome} className="object-contain w-10 h-10" />
                        ) : (
                          <span>{estatistica.emoji}</span>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-1 flex-wrap">
                          <span className={`text-xs font-extrabold uppercase tracking-wide ${cores.textoNome}`}>{estatistica.nome}:</span>
                          <span className="text-sm font-black text-gray-900 truncate">
                            {primeiro ? primeiro.nome : '-'}
                          </span>
                        </div>
                        <div className="mt-1">
                          {renderDescricao()}
                        </div>

                      </div>

                      <div className="text-right text-xs text-gray-400 flex-shrink-0">›</div>
                    </button>

                    {estatistica.id === 'bolaMurcha' && (
                      <div className="grid grid-cols-3 gap-2 p-2 border-b border-gray-100 bg-gray-50/30">
                        {estatisticasCompactas.map((compacta) => {
                          const lider = compacta.ranking[0];
                          const semDados = !lider;
                          return (
                            <button
                              key={compacta.id}
                              onClick={() => abrirModal(compacta)}
                              className="bg-white border border-gray-200 rounded-lg px-2 py-2 hover:bg-gray-50 transition-colors text-center"
                            >
                              <div className="h-6 flex items-center justify-center gap-1 mb-1">
                                {compacta.icone ? (
                                  <img src={compacta.icone} alt={compacta.nome} className="w-5 h-5 object-contain" />
                                ) : (
                                  <span className="text-base">{compacta.emoji}</span>
                                )}
                                <span className="text-[8px] font-extrabold uppercase tracking-tight text-gray-600 leading-none text-center break-words">
                                  {compacta.nome}
                                </span>
                              </div>
                              <div className={`text-[11px] leading-tight font-black ${semDados ? 'text-gray-400' : 'text-gray-800'}`}>
                                {lider ? lider.nome : '-'}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-5xl mb-3">📊</div>
            <p className="text-gray-600">Nenhuma estatística disponível</p>
          </div>
        )}

        {/* Modal de Ranking Completo */}
        {modalAberto && estatisticaSelecionada && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4"
            onClick={fecharModal}
          >
            <div 
              className="bg-white rounded-xl shadow-2xl w-[90vw] h-[90vh] max-w-6xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header do Modal */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3 sm:p-4 flex-shrink-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 sm:gap-3">
                    {estatisticaSelecionada.icone ? (
                      <img src={estatisticaSelecionada.icone} alt={estatisticaSelecionada.nome} className="w-8 h-8 sm:w-10 sm:h-10 object-contain" />
                    ) : (
                      <span className="text-2xl sm:text-3xl">{estatisticaSelecionada.emoji}</span>
                    )}
                    <h3 className="text-base sm:text-lg font-bold text-white">{estatisticaSelecionada.nome}</h3>
                  </div>
                  <button 
                    onClick={fecharModal}
                    className="text-white text-xl sm:text-2xl hover:text-gray-200 transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs sm:text-sm text-blue-100">{estatisticaSelecionada.descricao}</p>
              </div>

              {/* Ranking - Scrollable */}
              <div className="flex-1 overflow-y-auto">
                {estatisticaSelecionada.ranking.length > 0 ? (
                  <div className="p-2 sm:p-3 space-y-1.5">
                    {estatisticaSelecionada.ranking.map((item) => {
                      const isTop3 = item.posicao <= 3;
                      const medalha = item.posicao === 1 ? '🥇' : item.posicao === 2 ? '🥈' : item.posicao === 3 ? '🥉' : '';
                      const valorPrincipal = obterValorPrincipalRanking(estatisticaSelecionada.id, item);
                      const legenda = obterLegendaRanking(estatisticaSelecionada.id, item);
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
                          className={`px-2.5 py-2 rounded-lg ${bgColor} border border-gray-200`}
                        >
                          <div className="grid grid-cols-[20px_1fr_auto] grid-rows-[auto_auto] items-center gap-x-2">
                            <span className="row-span-2 text-xs font-bold text-gray-700 w-5 self-start pt-0.5">
                              {isTop3 ? medalha : `${item.posicao}º`}
                            </span>
                            <div className="min-w-0">
                              <span className="text-xs sm:text-sm font-bold text-gray-800 truncate block">
                                {item.nome}
                              </span>
                            </div>
                            <span className="row-span-2 self-center text-right text-xl sm:text-2xl leading-none font-black text-blue-700 min-w-[28px]">
                              {valorPrincipal}
                            </span>
                            {legenda && (
                              <div className="min-w-0">
                                <span className="text-[10px] sm:text-xs text-gray-600 leading-tight block truncate">
                                  {legenda}
                                </span>
                              </div>
                            )}
                          </div>
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
