'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { getClienteSupabase } from '../../lib/supabase';
import { usePermissions } from '../../lib/usePermissions';
import { buscar_pelada_id } from '../../lib/credenciais';

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

export default function ClassificacaoPage() {
  const STORAGE_KEY = 'peladm:classificacao:state:v1';
  const router = useRouter();
  const { possuiPermissao, nomePlano, loading: loadingPermissoes } = usePermissions();
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [jogosFiltrados, setJogosFiltrados] = useState<Jogo[]>([]);
  const [jogadores, setJogadores] = useState<{ [id: string]: Jogador }>({});
  const [loading, setLoading] = useState(true);
  const [ordenarPor, setOrdenarPor] = useState<'pontos' | 'vitorias' | 'jogos' | 'gols' | 'assistencias' | 'derrotas' | 'empates'>('pontos');

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
    if (!loadingPermissoes && !possuiPermissao('verResultados')) {
      alert(`🚫 Classificação não disponível no plano ${nomePlano}. Faça upgrade para Gold ou Premium!`);
      router.push('/');
    }
  }, [loadingPermissoes, possuiPermissao, nomePlano, router]);

  useEffect(() => {
    carregarDados();
  }, []);

  useEffect(() => {
    aplicarFiltro();
  }, [filtro, dataSelecionada, periodoSelecionado, quantidadePeladas, jogos]);

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
      // Pelada específica se selecionada, senão sessão mais recente
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
        // Filtrar por mês específico (MM/YYYY)
        filtered = jogos.filter(jogo => {
          const data = new Date(jogo.created_at);
          const mes = String(data.getMonth() + 1).padStart(2, '0');
          const ano = data.getFullYear();
          const mesAno = `${mes}/${ano}`;
          return mesAno === periodoSelecionado;
        });
      } else {
        // Último mês (30 dias)
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
        // Filtrar por ano específico
        filtered = jogos.filter(jogo => {
          const data = new Date(jogo.created_at);
          return data.getFullYear().toString() === periodoSelecionado;
        });
      } else {
        // Último ano (365 dias)
        const hoje = new Date();
        const anoAtras = new Date(hoje.getTime() - 365 * 24 * 60 * 60 * 1000);
        filtered = jogos.filter(jogo => new Date(jogo.created_at) >= anoAtras);
      }
    }

    setJogosFiltrados(filtered);
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
    return idStr.substring(0, 8);
  };

  const carregarDados = async () => {
    try {
      setLoading(true);
      const peladaId = buscar_pelada_id();
      if (!peladaId) {
        router.push('/login');
        return;
      }

      // Obter cliente Supabase dedicado
      const clienteDb = await getClienteSupabase(peladaId);
      if (!clienteDb) {
        console.error('❌ Erro ao obter cliente Supabase');
        return;
      }

      // Buscar todos os jogadores
      const { data: jogadoresData, error: erroJogadores } = await clienteDb
        .from('jogadores')
        .select('*')
        .eq('pelada_id', peladaId);
      
      if (erroJogadores) {
        console.error('❌ Erro ao buscar jogadores:', erroJogadores);
      }
      
      if (jogadoresData) {
        const jogadoresMap: { [id: string]: Jogador } = {};
        jogadoresData.forEach(j => {
          jogadoresMap[j.id] = j;
          jogadoresMap[j.nome] = j; // Indexar também pelo nome para busca
        });
        setJogadores(jogadoresMap);
      }

      // Buscar todos os jogos finalizados
      const { data: jogosData, error } = await clienteDb
        .from('jogos')
        .select('*')
        .eq('status', 'finalizado')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao carregar jogos:', error);
        return;
      }

      // Buscar gols e assistências de todos os jogos
      if (jogosData && jogosData.length > 0) {
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

        setJogos(jogosCompletos);
        
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
      } else {
        setJogos([]);
      }

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loadingPermissoes || loading) {
    return (
      <Layout title="Classificação">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-5xl mb-4">⚽</div>
            <div className="text-gray-600">Carregando classificação...</div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Classificação">
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

        {/* Tabela de Classificação Dinâmica */}
        {(() => {
          const estatisticasPorJogador: { [nome: string]: { jogos: number; gols: number; assistencias: number; vitorias: number; derrotas: number; empates: number; jogadorId: string } } = {};
          
          jogosFiltrados.forEach(jogo => {
            [...jogo.time_a, ...jogo.time_b].forEach(jogadorId => {
              const nome = buscarJogador(jogadorId);
              if (!estatisticasPorJogador[nome]) {
                estatisticasPorJogador[nome] = { jogos: 0, gols: 0, assistencias: 0, vitorias: 0, derrotas: 0, empates: 0, jogadorId: jogadorId };
              }
              estatisticasPorJogador[nome].jogos++;
              
              // Contar vitórias/derrotas/empates
              const noTimeA = jogo.time_a.includes(jogadorId);
              if (jogo.placar_a === jogo.placar_b) {
                estatisticasPorJogador[nome].empates++;
              } else if ((noTimeA && jogo.placar_a > jogo.placar_b) || (!noTimeA && jogo.placar_b > jogo.placar_a)) {
                estatisticasPorJogador[nome].vitorias++;
              } else {
                estatisticasPorJogador[nome].derrotas++;
              }
            });
          });

          // Contar gols por jogador usando o UUID correto
          jogosFiltrados.forEach(jogo => {
            (jogo.gols || []).forEach(gol => {
              const nomeJogador = buscarJogador(gol.jogador_id);
              if (estatisticasPorJogador[nomeJogador]) {
                estatisticasPorJogador[nomeJogador].gols++;
              }
            });
          });
          
          // Contar assistências por jogador
          jogosFiltrados.forEach(jogo => {
            (jogo.assistencias || []).forEach(assist => {
              const nomeJogador = buscarJogador(assist.jogador_id);
              if (estatisticasPorJogador[nomeJogador]) {
                estatisticasPorJogador[nomeJogador].assistencias++;
              }
            });
          });

          // Calcular pontos
          const jogadoresComPontos = Object.entries(estatisticasPorJogador).map(([nome, stats]) => ({
            nome,
            ...stats,
            pontos: stats.vitorias + (stats.gols * 0.5) + (stats.assistencias * 0.5) + (stats.empates * 0.5) - (stats.derrotas * 0.5)
          }));

          // Ordenar
          const jogadoresOrdenados = [...jogadoresComPontos].sort((a, b) => {
            if (ordenarPor === 'pontos') return b.pontos - a.pontos;
            if (ordenarPor === 'vitorias') return b.vitorias - a.vitorias;
            if (ordenarPor === 'jogos') return b.jogos - a.jogos;
            if (ordenarPor === 'gols') return b.gols - a.gols;
            if (ordenarPor === 'assistencias') return b.assistencias - a.assistencias;
            if (ordenarPor === 'derrotas') return b.derrotas - a.derrotas;
            if (ordenarPor === 'empates') return b.empates - a.empates;
            return 0;
          });

          return jogadoresOrdenados.length > 0 ? (
            <div className="w-full">
              <table className="w-full border-separate border-spacing-0 text-xs sm:text-sm">
                <thead>
                  <tr className="bg-gray-100 border-b-2 border-gray-300">
                    <th className="sticky top-16 z-20 bg-gray-100 px-1 py-2 sm:px-2 sm:py-3 text-left font-bold text-gray-700 text-xs shadow-sm">Pos</th>
                    <th className="sticky top-16 z-20 bg-gray-100 px-2 py-2 sm:px-3 sm:py-3 text-left font-bold text-gray-700 text-xs shadow-sm">Jogador</th>
                    <th 
                      className="sticky top-16 z-20 bg-gray-100 px-1 py-2 sm:px-2 sm:py-3 text-center font-bold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors shadow-sm"
                      onClick={() => setOrdenarPor('pontos')}
                      title="Pontos"
                    >
                      <span className={ordenarPor === 'pontos' ? 'text-base sm:text-xl' : 'text-sm'}>💎</span>
                    </th>
                    <th 
                      className="sticky top-16 z-20 bg-gray-100 px-1 py-2 sm:px-2 sm:py-3 text-center font-bold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors shadow-sm"
                      onClick={() => setOrdenarPor('gols')}
                      title="Gols"
                    >
                      <span className={ordenarPor === 'gols' ? 'text-base sm:text-xl' : 'text-sm'}>⚽</span>
                    </th>
                    <th 
                      className="sticky top-16 z-20 bg-gray-100 px-1 py-2 sm:px-2 sm:py-3 text-center font-bold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors shadow-sm"
                      onClick={() => setOrdenarPor('assistencias')}
                      title="Assistências"
                    >
                      <span className={ordenarPor === 'assistencias' ? 'text-base sm:text-xl' : 'text-sm'}>👟</span>
                    </th>
                    <th 
                      className="sticky top-16 z-20 bg-gray-100 px-1 py-2 sm:px-2 sm:py-3 text-center font-bold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors shadow-sm"
                      onClick={() => setOrdenarPor('vitorias')}
                      title="Vitórias"
                    >
                      <span className={ordenarPor === 'vitorias' ? 'text-base sm:text-xl' : 'text-sm'}>🏆</span>
                    </th>
                    <th 
                      className="sticky top-16 z-20 bg-gray-100 px-1 py-2 sm:px-2 sm:py-3 text-center font-bold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors shadow-sm"
                      onClick={() => setOrdenarPor('empates')}
                      title="Empates"
                    >
                      <span className={ordenarPor === 'empates' ? 'text-base sm:text-xl' : 'text-sm'}>🤝</span>
                    </th>
                    <th 
                      className="sticky top-16 z-20 bg-gray-100 px-1 py-2 sm:px-2 sm:py-3 text-center font-bold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors shadow-sm"
                      onClick={() => setOrdenarPor('derrotas')}
                      title="Derrotas"
                    >
                      <span className={ordenarPor === 'derrotas' ? 'text-base sm:text-xl' : 'text-sm'}>❌</span>
                    </th>
                    <th 
                      className="sticky top-16 z-20 bg-gray-100 px-1 py-2 sm:px-2 sm:py-3 text-center font-bold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors shadow-sm"
                      onClick={() => setOrdenarPor('jogos')}
                      title="Jogos"
                    >
                      <span className={ordenarPor === 'jogos' ? 'text-base sm:text-xl' : 'text-sm'}>🎮</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {jogadoresOrdenados.map((jogador, index) => {
                    const isTop3 = index < 3;
                    const medalha = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
                    const bgGradient = index === 0 
                      ? 'bg-gradient-to-r from-yellow-100 to-yellow-200' 
                      : index === 1 
                      ? 'bg-gradient-to-r from-gray-100 to-gray-200'
                      : index === 2
                      ? 'bg-gradient-to-r from-orange-100 to-orange-200'
                      : 'bg-white hover:bg-gray-50';
                    
                    return (
                      <tr key={index} className={`border-b border-gray-200 ${bgGradient} transition-colors`}>
                        <td className="px-1 py-2 sm:px-2 sm:py-3 text-center font-bold text-gray-700 text-xs sm:text-sm">
                          {isTop3 ? medalha : `${index + 1}º`}
                        </td>
                        <td className="px-2 py-2 sm:px-3 sm:py-3 font-medium text-gray-800 text-xs sm:text-sm truncate max-w-[80px] sm:max-w-none">{jogador.nome}</td>
                        <td className={`px-1 py-2 sm:px-2 sm:py-3 text-center font-bold text-xs sm:text-sm ${jogador.pontos >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                          {jogador.pontos.toFixed(1)}
                        </td>
                        <td className="px-1 py-2 sm:px-2 sm:py-3 text-center font-bold text-green-600 text-xs sm:text-sm">{jogador.gols}</td>
                        <td className="px-1 py-2 sm:px-2 sm:py-3 text-center font-bold text-green-600 text-xs sm:text-sm">{jogador.assistencias}</td>
                        <td className="px-1 py-2 sm:px-2 sm:py-3 text-center font-bold text-green-600 text-xs sm:text-sm">{jogador.vitorias}</td>
                        <td className="px-1 py-2 sm:px-2 sm:py-3 text-center font-bold text-amber-600 text-xs sm:text-sm">{jogador.empates}</td>
                        <td className="px-1 py-2 sm:px-2 sm:py-3 text-center font-bold text-red-600 text-xs sm:text-sm">{jogador.derrotas}</td>
                        <td className="px-1 py-2 sm:px-2 sm:py-3 text-center text-gray-700 text-xs sm:text-sm">{jogador.jogos}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">👥</div>
              <p>Nenhum jogador encontrado</p>
            </div>
          );
        })()}

        {/* Legenda do Sistema de Pontuação */}
        {jogosFiltrados.length > 0 && (
          <section className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-sm p-3 mt-4 border border-blue-200">
            <h3 className="text-sm font-bold text-gray-800 mb-2 text-center">
              📊 Sistema de Pontuação
            </h3>
            <div className="flex flex-wrap justify-center gap-2 text-xs">
              <div className="flex items-center gap-1 bg-white rounded px-2 py-1">
                <span>🏆</span>
                <span className="font-semibold">Vitória:</span>
                <span className="font-bold text-green-600">+1.0</span>
              </div>
              <div className="flex items-center gap-1 bg-white rounded px-2 py-1">
                <span>⚽</span>
                <span className="font-semibold">Gol:</span>
                <span className="font-bold text-green-600">+0.5</span>
              </div>
              <div className="flex items-center gap-1 bg-white rounded px-2 py-1">
                <span>👟</span>
                <span className="font-semibold">Assist.:</span>
                <span className="font-bold text-green-600">+0.5</span>
              </div>
              <div className="flex items-center gap-1 bg-white rounded px-2 py-1">
                <span>🤝</span>
                <span className="font-semibold">Empate:</span>
                <span className="font-bold text-amber-600">+0.5</span>
              </div>
              <div className="flex items-center gap-1 bg-white rounded px-2 py-1">
                <span>❌</span>
                <span className="font-semibold">Derrota:</span>
                <span className="font-bold text-red-600">-0.5</span>
              </div>
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}
