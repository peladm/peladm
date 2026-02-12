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
}

interface Gol {
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
}

export default function Estatisticas() {
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
  const [filtro, setFiltro] = useState<'atual' | 'mes' | 'trimestre' | 'semestre' | 'ano' | 'sessao'>('atual');
  const [dataSelecionada, setDataSelecionada] = useState('');
  const [datasDisponiveis, setDatasDisponiveis] = useState<string[]>([]);
  const [mesesDisponiveis, setMesesDisponiveis] = useState<string[]>([]);
  const [trimestresDisponiveis, setTrimestresDisponiveis] = useState<string[]>([]);
  const [semestresDisponiveis, setSemestresDisponiveis] = useState<string[]>([]);
  const [anosDisponiveis, setAnosDisponiveis] = useState<string[]>([]);
  const [periodoSelecionado, setPeriodoSelecionado] = useState('');

  // Bloquear acesso para plano FREE
  useEffect(() => {
    if (!loadingPermissoes && !possuiPermissao('verEstatisticas')) {
      alert(`🚫 Estatísticas não disponível no plano ${nomePlano}. Faça upgrade para Gold ou Premium!`);
      router.push('/');
    }
  }, [loadingPermissoes, possuiPermissao, nomePlano, router]);

  useEffect(() => {
    carregarDados();
  }, []);

  useEffect(() => {
    aplicarFiltro();
  }, [filtro, dataSelecionada, periodoSelecionado, jogos]);

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

  const buscarJogador = (jogadorId: any): string => {
    if (typeof jogadorId === 'object' && jogadorId?.nome) {
      return jogadorId.apelido || jogadorId.nome;
    }
    const idStr = String(jogadorId);
    const jogador = jogadores[idStr];
    if (jogador) {
      return jogador.apelido || jogador.nome;
    }
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
    } else if (filtro === 'trimestre') {
      if (periodoSelecionado) {
        filtered = jogos.filter(jogo => {
          const data = new Date(jogo.created_at);
          const mes = data.getMonth();
          const trimestre = Math.floor(mes / 3) + 1;
          return `Q${trimestre}/${data.getFullYear()}` === periodoSelecionado;
        });
      } else {
        const hoje = new Date();
        const trimAtras = new Date(hoje.getTime() - 90 * 24 * 60 * 60 * 1000);
        filtered = jogos.filter(jogo => new Date(jogo.created_at) >= trimAtras);
      }
    } else if (filtro === 'semestre') {
      if (periodoSelecionado) {
        filtered = jogos.filter(jogo => {
          const data = new Date(jogo.created_at);
          const semestre = data.getMonth() < 6 ? 1 : 2;
          return `S${semestre}/${data.getFullYear()}` === periodoSelecionado;
        });
      } else {
        const hoje = new Date();
        const semAtras = new Date(hoje.getTime() - 180 * 24 * 60 * 60 * 1000);
        filtered = jogos.filter(jogo => new Date(jogo.created_at) >= semAtras);
      }
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

    jogosFiltrados.forEach(jogo => {
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
    });

    // Finalizar sequências invictas
    Object.values(stats).forEach((s: any) => {
      if (s.sequenciaAtual > s.sequenciaInvicta) {
        s.sequenciaInvicta = s.sequenciaAtual;
      }
    });

    // 1. ARTILHEIRO
    const artilheiro = Object.values(stats)
      .sort((a: any, b: any) => b.gols - a.gols)
      .map((s: any, idx) => ({ posicao: idx + 1, nome: s.nome, valor: `${s.gols} gols` }));

    // 2. GARÇOM (assistências - ainda não implementado)
    const garcom = Object.values(stats)
      .map((s: any, idx) => ({ posicao: idx + 1, nome: s.nome, valor: '0 assist.' }));

    // 3. VITORIOSO
    const vitorioso = Object.values(stats)
      .sort((a: any, b: any) => b.vitorias - a.vitorias)
      .map((s: any, idx) => ({ posicao: idx + 1, nome: s.nome, valor: `${s.vitorias} vitórias` }));

    // 4. SÓ DERROTA
    const soDerrota = Object.values(stats)
      .sort((a: any, b: any) => b.derrotas - a.derrotas)
      .map((s: any, idx) => ({ posicao: idx + 1, nome: s.nome, valor: `${s.derrotas} derrotas` }));

    // 5. MVP (vitória + gol ou assistência - incompleto)
    const mvp = Object.values(stats)
      .map((s: any) => ({
        nome: s.nome,
        mvpCount: 0 // TODO: calcular quando tiver assistências
      }))
      .sort((a, b) => b.mvpCount - a.mvpCount)
      .map((s, idx) => ({ posicao: idx + 1, nome: s.nome, valor: `${s.mvpCount} MVP` }));

    // 6. HAT-TRICKS
    const hatTricks: { [nome: string]: number } = {};
    jogosFiltrados.forEach(jogo => {
      const golsPorJogador: { [id: string]: number } = {};
      (jogo.gols || []).forEach(gol => {
        golsPorJogador[gol.jogador_id] = (golsPorJogador[gol.jogador_id] || 0) + 1;
      });
      Object.entries(golsPorJogador).forEach(([id, gols]) => {
        if (gols >= 3) {
          const nome = buscarJogador(id);
          hatTricks[nome] = (hatTricks[nome] || 0) + 1;
        }
      });
    });
    const hatTricksRanking = Object.entries(hatTricks)
      .sort(([, a], [, b]) => b - a)
      .map(([nome, count], idx) => ({ posicao: idx + 1, nome, valor: `${count} hat-tricks` }));

    // 7. NÃO PERDI PELADA
    const naoPerdi = Object.values(stats)
      .filter((s: any) => s.derrotas === 0)
      .sort((a: any, b: any) => b.jogos - a.jogos)
      .map((s: any, idx) => {
        const detalhes = s.empates > 0 ? `${s.vitorias}V e ${s.empates}E` : `${s.vitorias}V`;
        return { posicao: idx + 1, nome: s.nome, valor: `${s.jogos}J = ${detalhes}` };
      });

    // 8. NÃO GANHEI PELADA
    const naoGanhei = Object.values(stats)
      .filter((s: any) => s.vitorias === 0)
      .sort((a: any, b: any) => b.jogos - a.jogos)
      .map((s: any, idx) => {
        const detalhes = s.empates > 0 ? `${s.derrotas}D e ${s.empates}E` : `${s.derrotas}D`;
        return { posicao: idx + 1, nome: s.nome, valor: `${s.jogos}J = ${detalhes}` };
      });

    // 9. REI DA PELADA
    const reiPelada = Object.values(stats)
      .map((s: any) => ({
        nome: s.nome,
        pontos: s.vitorias + s.gols + (s.empates * 0.5) - (s.derrotas * 0.5)
      }))
      .sort((a, b) => b.pontos - a.pontos)
      .map((s, idx) => ({ posicao: idx + 1, nome: s.nome, valor: `${s.pontos.toFixed(1)} pts` }));

    // 10. BOLA MURCHA
    const bolaMurcha = Object.values(stats)
      .map((s: any) => ({
        nome: s.nome,
        pontos: s.vitorias + s.gols + (s.empates * 0.5) - (s.derrotas * 0.5)
      }))
      .sort((a, b) => a.pontos - b.pontos)
      .map((s, idx) => ({ posicao: idx + 1, nome: s.nome, valor: `${s.pontos.toFixed(1)} pts` }));

    // 11. FIQUEI NO QUASE
    const fiqueiQuase = Object.values(stats)
      .sort((a: any, b: any) => b.empates - a.empates)
      .map((s: any, idx) => ({ posicao: idx + 1, nome: s.nome, valor: `${s.empates} empates` }));

    // 12. MÉDIA DE GOLS
    const mediaGols = Object.values(stats)
      .map((s: any) => ({
        nome: s.nome,
        media: s.jogos > 0 ? (s.gols / s.jogos).toFixed(2) : '0.00'
      }))
      .sort((a, b) => parseFloat(b.media) - parseFloat(a.media))
      .map((s, idx) => ({ posicao: idx + 1, nome: s.nome, valor: s.media }));

    // 13. EU JOGUEI? ENTÃO GANHEI
    const taxaVitoria = Object.values(stats)
      .map((s: any) => ({
        nome: s.nome,
        taxa: s.jogos > 0 ? ((s.vitorias / s.jogos) * 100).toFixed(1) : '0.0'
      }))
      .sort((a, b) => parseFloat(b.taxa) - parseFloat(a.taxa))
      .map((s, idx) => ({ posicao: idx + 1, nome: s.nome, valor: `${s.taxa}%` }));

    // 14. SEQUÊNCIA INVICTA
    const sequenciaInvicta = Object.values(stats)
      .sort((a: any, b: any) => b.sequenciaInvicta - a.sequenciaInvicta)
      .map((s: any, idx) => ({ posicao: idx + 1, nome: s.nome, valor: `${s.sequenciaInvicta} jogos` }));

    // 15. DEITEI E ROLEI (vitória + gol + assistência na mesma partida - incompleto)
    const deiteiRolei = Object.values(stats)
      .map((s: any, idx) => ({ posicao: idx + 1, nome: s.nome, valor: '0 vezes' }));

    // Montar array de estatísticas
    const estatisticasCalculadas: Estatistica[] = [
      { id: 'artilheiro', emoji: '⚽', nome: 'Artilheiro', descricao: 'Quem marcou mais gols', primeiroColocado: formatarPrimeiroColocado(artilheiro), ranking: artilheiro },
      { id: 'mediaGols', emoji: '📊', nome: 'Média de Gols', descricao: 'Maior média de gols por jogo', primeiroColocado: formatarPrimeiroColocado(mediaGols), ranking: mediaGols },
      { id: 'garcom', emoji: '👟', nome: 'Garçom', descricao: 'Quem mais deu assistências', primeiroColocado: 'Em breve...', ranking: garcom },
      { id: 'hatTricks', emoji: '🎩', nome: 'Hat-Trick', descricao: 'Quem fez mais hat-tricks (3+ gols)', primeiroColocado: formatarPrimeiroColocado(hatTricksRanking), ranking: hatTricksRanking },
      { id: 'mvp', emoji: '⭐', nome: 'MVP', descricao: 'Vitória + gol/assist na mesma partida', primeiroColocado: 'Em breve...', ranking: mvp },
      { id: 'deiteiRolei', emoji: '🎯', nome: 'Deitei e Rolei', descricao: 'Vitória + gol + assist no mesmo jogo', primeiroColocado: 'Em breve...', ranking: deiteiRolei },
      { id: 'vitorioso', emoji: '🏆', nome: 'Vitorioso', descricao: 'Quem conquistou mais vitórias', primeiroColocado: formatarPrimeiroColocado(vitorioso), ranking: vitorioso },
      { id: 'taxaVitoria', emoji: '🔥', nome: 'Eu Joguei e Ganhei', descricao: 'Maior % de vitórias', primeiroColocado: formatarPrimeiroColocado(taxaVitoria), ranking: taxaVitoria },
      { id: 'naoPerdi', emoji: '🛡️', nome: 'Não Perdi Pelada', descricao: 'Jogou e nunca perdeu', primeiroColocado: formatarPrimeiroColocado(naoPerdi), ranking: naoPerdi },
      { id: 'fiqueiQuase', emoji: '🤝', nome: 'Fiquei no Empate', descricao: 'Maior quantidade de empates', primeiroColocado: formatarPrimeiroColocado(fiqueiQuase), ranking: fiqueiQuase },
      { id: 'naoGanhei', emoji: '❌', nome: 'Não Ganhei Pelada', descricao: 'Jogou e nunca ganhou', primeiroColocado: formatarPrimeiroColocado(naoGanhei), ranking: naoGanhei },
      { id: 'soDerrota', emoji: '😢', nome: 'Só Derrota', descricao: 'Maior quantidade de derrotas', primeiroColocado: formatarPrimeiroColocado(soDerrota), ranking: soDerrota },
      { id: 'reiPelada', emoji: '👑', nome: 'Rei da Pelada', descricao: 'Maior pontuação geral', primeiroColocado: formatarPrimeiroColocado(reiPelada), ranking: reiPelada },
      { id: 'bolaMurcha', emoji: '👎', nome: 'Bola Murcha', descricao: 'Menor pontuação geral', primeiroColocado: formatarPrimeiroColocado(bolaMurcha), ranking: bolaMurcha },
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
        // Extrair datas, meses, trimestres, semestres e anos
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
        
        const trimestres = [...new Set(jogosData.map(jogo => {
          const data = new Date(jogo.created_at);
          const mes = data.getMonth();
          const trimestre = Math.floor(mes / 3) + 1;
          return `Q${trimestre}/${data.getFullYear()}`;
        }))].sort().reverse();
        
        const semestres = [...new Set(jogosData.map(jogo => {
          const data = new Date(jogo.created_at);
          const semestre = data.getMonth() < 6 ? 1 : 2;
          return `S${semestre}/${data.getFullYear()}`;
        }))].sort().reverse();
        
        const anos = [...new Set(jogosData.map(jogo => {
          const data = new Date(jogo.created_at);
          return data.getFullYear().toString();
        }))].sort().reverse();
        
        setDatasDisponiveis(datas);
        setMesesDisponiveis(meses);
        setTrimestresDisponiveis(trimestres);
        setSemestresDisponiveis(semestres);
        setAnosDisponiveis(anos);

        // Buscar gols de todos os jogos
        const jogosIds = jogosData.map(j => j.id);
        const { data: golsData } = await clienteDb
          .from('gols')
          .select('*')
          .in('jogo_id', jogosIds);

        // Associar gols aos jogos  
        const jogosComGols = jogosData.map(jogo => ({
          ...jogo,
          gols: (golsData || []).filter(g => g.jogo_id === jogo.id)
        }));

        setJogos(jogosComGols);
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
                  setFiltro('trimestre');
                  setDataSelecionada('');
                  setPeriodoSelecionado('');
                }}
                className={`py-2 px-2 rounded-lg text-xs font-semibold transition-colors ${
                  filtro === 'trimestre'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                }`}
              >
                Trimestre
              </button>
              <button
                onClick={() => {
                  setFiltro('semestre');
                  setDataSelecionada('');
                  setPeriodoSelecionado('');
                }}
                className={`py-2 px-2 rounded-lg text-xs font-semibold transition-colors ${
                  filtro === 'semestre'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                }`}
              >
                Semestre
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
            
            {filtro === 'trimestre' && (
              <select
                value={periodoSelecionado}
                onChange={(e) => setPeriodoSelecionado(e.target.value)}
                className="w-full py-2 px-3 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">📅 Selecionar trimestre específico</option>
                {trimestresDisponiveis.map(trim => (
                  <option key={trim} value={trim}>{trim}</option>
                ))}
              </select>
            )}
            
            {filtro === 'semestre' && (
              <select
                value={periodoSelecionado}
                onChange={(e) => setPeriodoSelecionado(e.target.value)}
                className="w-full py-2 px-3 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">📅 Selecionar semestre específico</option>
                {semestresDisponiveis.map(sem => (
                  <option key={sem} value={sem}>{sem}</option>
                ))}
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

        {/* Grid de Estatísticas */}
        <div className="grid grid-cols-2 gap-3 mb-20">
          {estatisticas.length > 0 ? (
            estatisticas.map((estatistica) => (
              <button
                key={estatistica.id}
                onClick={() => abrirModal(estatistica)}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all active:scale-95 overflow-hidden border border-gray-200"
              >
                {/* Linha 1: Emoji (25%) + Nome (75%) */}
                <div className="flex items-center border-b border-gray-100 p-1.5">
                  <div className="w-1/4 flex items-center justify-center">
                    <span className="text-2xl">{estatistica.emoji}</span>
                  </div>
                  <div className="w-3/4 flex items-center justify-center px-1">
                    <h3 className="text-xs font-bold text-gray-800 text-center leading-tight">
                      {estatistica.nome}
                    </h3>
                  </div>
                </div>
                
                {/* Linha 2: Nome do 1º colocado (100%) */}
                <div className={`py-1.5 px-2 ${
                  estatistica.primeiroColocado === '-' 
                    ? 'bg-gray-100' 
                    : 'bg-gradient-to-br from-blue-50 to-indigo-50'
                }`}>
                  <p className={`text-xs font-semibold text-center truncate ${
                    estatistica.primeiroColocado === '-'
                      ? 'text-black'
                      : 'text-gray-700'
                  }`}>
                    {estatistica.primeiroColocado}
                  </p>
                </div>
              </button>
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
                    <span className="text-3xl">{estatisticaSelecionada.emoji}</span>
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
