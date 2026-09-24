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

interface Jogador {
  id: string;
  nome: string;
  apelido?: string;
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

export default function ClassificacaoPage() {
  const STORAGE_KEY = 'peladm:classificacao:state:v1';
  const router = useRouter();
  const { possuiPermissao, loading: loadingPermissoes } = usePermissions();
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [jogosFiltrados, setJogosFiltrados] = useState<Jogo[]>([]);
  const [jogadores, setJogadores] = useState<{ [id: string]: Jogador }>({});
  const [loading, setLoading] = useState(true);
  const [pontuacaoEstatisticas, setPontuacaoEstatisticas] = useState<PontuacaoEstatisticas>(PONTUACAO_PADRAO);
  const [ordenarPor, setOrdenarPor] = useState<'pontos' | 'vitorias' | 'jogos' | 'gols' | 'golsContra' | 'assistencias' | 'cleanSheets' | 'derrotas' | 'empates'>('pontos');
  const [jogadoresPorTime, setJogadoresPorTime] = useState(5);
  const [modoCompactoMobile, setModoCompactoMobile] = useState(true);

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
    if (!loadingPermissoes && !possuiPermissao('verResultados')) {
      alert('🚫 Classificação indisponível para este cliente no momento.');
      router.push('/');
    }
  }, [loadingPermissoes, possuiPermissao, router]);

  useEffect(() => {
    carregarDados();
  }, []);

  useEffect(() => {
    aplicarFiltro();
  }, [filtro, dataSelecionada, periodoSelecionado, quantidadePeladas, jogos]);

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

  const formatarPontuacaoLegenda = (valor: number): string => {
    const sinal = valor > 0 ? '+' : '';
    return `${sinal}${valor.toFixed(1).replace('.', ',')}`;
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
        filtered = jogos.filter(jogo => {
          const [ano, parte] = periodoSelecionado.split('-');
          const data = new Date(jogo.created_at);
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

  const carregarDados = async () => {
    try {
      setLoading(true);
      const peladaId = buscar_pelada_id();
      if (!peladaId) {
        router.push('/login');
        return;
      }

      setPontuacaoEstatisticas(await carregarPontuacaoEstatisticas(peladaId));

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

      // Buscar regras para quantidade de jogadores por time
      const { data: regrasData, error: erroRegras } = await clienteDb
        .from('regras')
        .select('jogadores_por_time')
        .eq('pelada_id', peladaId)
        .single();

      if (!erroRegras && regrasData?.jogadores_por_time) {
        setJogadoresPorTime(regrasData.jogadores_por_time);
      }

      // Buscar todos os jogos finalizados
      // Paginação manual: evita truncamento no limite padrão de 1000 linhas do Supabase.
      let jogosData: any[] = [];
      try {
        jogosData = await fetchAllRows((from, to) =>
          clienteDb
            .from('jogos')
            .select('*')
            .eq('pelada_id', peladaId)
            .eq('status', 'finalizado')
            .order('created_at', { ascending: false })
            .range(from, to)
        );
      } catch (error) {
        console.error('Erro ao carregar jogos:', error);
        return;
      }

      // Buscar gols e assistências de todos os jogos
      if (jogosData && jogosData.length > 0) {
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

        {/* Conteúdo da página */}

        <div className="sm:hidden flex justify-end mb-2">
          <button
            onClick={() => setModoCompactoMobile((prev) => !prev)}
            className="text-[11px] font-semibold px-2.5 py-1 rounded border border-gray-300 bg-white text-gray-700"
          >
            {modoCompactoMobile ? 'Modo compacto: ON' : 'Modo compacto: OFF'}
          </button>
        </div>

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
              <div className="w-full bg-green-500 rounded-lg px-4 py-1.5 flex items-center justify-center shadow-sm">
                <span className="text-white text-xs font-bold">{label}</span>
              </div>
            </div>
          );
        })()}

        {/* Tabela de Classificação Dinâmica */}
        {(() => {
          const estatisticasPorJogador: { [nome: string]: { jogos: number; gols: number; golsContra: number; assistencias: number; vitorias: number; derrotas: number; empates: number; cleanSheets: number; jogadorId: string } } = {};
          
          jogosFiltrados.forEach(jogo => {
            [...jogo.time_a, ...jogo.time_b].forEach(jogadorId => {
              if (!ehJogadorAtivo(jogadorId)) return;
              const nome = buscarJogador(jogadorId);
              if (!estatisticasPorJogador[nome]) {
                estatisticasPorJogador[nome] = { jogos: 0, gols: 0, golsContra: 0, assistencias: 0, vitorias: 0, derrotas: 0, empates: 0, cleanSheets: 0, jogadorId: jogadorId };
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
              
              // Contar clean sheets (time não levou gols em vitória ou empate)
              const golsSofridos = noTimeA ? jogo.placar_b : jogo.placar_a;
              const venceu = (noTimeA && jogo.placar_a > jogo.placar_b) || (!noTimeA && jogo.placar_b > jogo.placar_a);
              const empatou = jogo.placar_a === jogo.placar_b;
              if (golsSofridos === 0 && (venceu || empatou)) {
                estatisticasPorJogador[nome].cleanSheets++;
              }
            });
          });

          // Contar gols por jogador usando o UUID correto
          jogosFiltrados.forEach(jogo => {
            (jogo.gols || []).forEach(gol => {
              if (gol.jogador_id === 'gol_contra') {
                const autorId = gol.gol_contra_jogador_id;
                if (!autorId || !ehJogadorAtivo(autorId)) return;
                const nomeAutor = buscarJogador(autorId);
                if (estatisticasPorJogador[nomeAutor]) {
                  estatisticasPorJogador[nomeAutor].golsContra++;
                }
                return;
              }

              if (!ehJogadorAtivo(gol.jogador_id)) return;
              const nomeJogador = buscarJogador(gol.jogador_id);
              if (estatisticasPorJogador[nomeJogador]) {
                estatisticasPorJogador[nomeJogador].gols++;
              }
            });
          });
          
          // Contar assistências por jogador
          jogosFiltrados.forEach(jogo => {
            (jogo.assistencias || []).forEach(assist => {
              if (!ehJogadorAtivo(assist.jogador_id)) return;
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
            pontos: calcularPontosEstatisticas(stats, pontuacaoEstatisticas)
          }));

          // Ordenar com critério de desempate
          const jogadoresOrdenados = [...jogadoresComPontos].sort((a, b) => {
            if (ordenarPor === 'pontos') {
              // Critério de desempate: Gols > Gols Contra (menos) > Assistências > Vitórias > Derrotas (menos) > Clean Sheets > Empates > Jogos (menos)
              if (b.pontos !== a.pontos) return b.pontos - a.pontos;
              if (b.gols !== a.gols) return b.gols - a.gols;
              if (a.golsContra !== b.golsContra) return a.golsContra - b.golsContra;
              if (b.assistencias !== a.assistencias) return b.assistencias - a.assistencias;
              if (b.vitorias !== a.vitorias) return b.vitorias - a.vitorias;
              if (a.derrotas !== b.derrotas) return a.derrotas - b.derrotas; // Menos derrotas é melhor
              if (b.cleanSheets !== a.cleanSheets) return b.cleanSheets - a.cleanSheets;
              if (b.empates !== a.empates) return b.empates - a.empates;
              return a.jogos - b.jogos; // Menos jogos é melhor
            }
            if (ordenarPor === 'gols') return b.gols - a.gols;
            if (ordenarPor === 'golsContra') return a.golsContra - b.golsContra;
            if (ordenarPor === 'assistencias') return b.assistencias - a.assistencias;
            if (ordenarPor === 'vitorias') return b.vitorias - a.vitorias;
            if (ordenarPor === 'derrotas') return a.derrotas - b.derrotas;
            if (ordenarPor === 'cleanSheets') return b.cleanSheets - a.cleanSheets;
            if (ordenarPor === 'empates') return b.empates - a.empates;
            if (ordenarPor === 'jogos') return a.jogos - b.jogos;
            return 0;
          });

          const zonaTimeLimit = Math.max(0, jogadoresPorTime);
          const zonaBolaMurchaStart = Math.max(0, jogadoresOrdenados.length - 4);
          const colCompacta = modoCompactoMobile ? 'hidden sm:table-cell' : 'table-cell';

          return jogadoresOrdenados.length > 0 ? (
            <div className="w-full">
              <table className="w-full border-separate border-spacing-0 text-xs sm:text-sm">
                <thead>
                  <tr className="bg-gray-100 border-b-2 border-gray-300">
                    <th className="sticky top-16 z-20 bg-gray-100 px-0.5 py-2 sm:px-1 sm:py-3 text-left font-bold text-gray-700 text-xs shadow-sm">Pos</th>
                    <th className="sticky top-16 z-20 bg-gray-100 px-1 py-2 sm:px-2 sm:py-3 text-left font-bold text-gray-700 text-xs shadow-sm">Jogador</th>
                    <th 
                      className="sticky top-16 z-20 bg-gray-100 px-0.5 py-2 sm:px-1 sm:py-3 text-center font-bold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors shadow-sm"
                      onClick={() => setOrdenarPor('pontos')}
                      title="Desempate: Gols > Assistências > Vitórias > Gols contra (menos) > Derrotas (menos) > Clean Sheets > Empates > Jogos (menos)"
                    >
                      <span className={ordenarPor === 'pontos' ? 'text-base sm:text-xl' : 'text-sm'}>💎</span>
                    </th>
                    <th 
                      className="sticky top-16 z-20 bg-gray-100 px-0.5 py-2 sm:px-1 sm:py-3 text-center font-bold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors shadow-sm"
                      onClick={() => setOrdenarPor('gols')}
                      title="Gols"
                    >
                      <span className={ordenarPor === 'gols' ? 'text-base sm:text-xl' : 'text-sm'}>⚽</span>
                    </th>
                    <th 
                      className={`sticky top-16 z-20 bg-gray-100 px-0.5 py-2 sm:px-1 sm:py-3 text-center font-bold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors shadow-sm ${colCompacta}`}
                      onClick={() => setOrdenarPor('golsContra')}
                      title="Gol Contra"
                    >
                      <img
                        src={bolaVermelha.src}
                        alt="Gol contra"
                        className={`${ordenarPor === 'golsContra' ? 'w-4 h-4 sm:w-5 sm:h-5' : 'w-3.5 h-3.5 sm:w-4 sm:h-4'} inline-block`}
                      />
                    </th>
                    <th 
                      className="sticky top-16 z-20 bg-gray-100 px-0.5 py-2 sm:px-1 sm:py-3 text-center font-bold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors shadow-sm"
                      onClick={() => setOrdenarPor('assistencias')}
                      title="Assistências"
                    >
                      <span className={ordenarPor === 'assistencias' ? 'text-base sm:text-xl' : 'text-sm'}>👟</span>
                    </th>
                    <th 
                      className="sticky top-16 z-20 bg-gray-100 px-0.5 py-2 sm:px-1 sm:py-3 text-center font-bold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors shadow-sm"
                      onClick={() => setOrdenarPor('vitorias')}
                      title="Vitórias"
                    >
                      <span className={ordenarPor === 'vitorias' ? 'text-base sm:text-xl' : 'text-sm'}>🏆</span>
                    </th>
                    <th 
                      className={`sticky top-16 z-20 bg-gray-100 px-0.5 py-2 sm:px-1 sm:py-3 text-center font-bold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors shadow-sm ${colCompacta}`}
                      onClick={() => setOrdenarPor('derrotas')}
                      title="Derrotas"
                    >
                      <span className={ordenarPor === 'derrotas' ? 'text-base sm:text-xl' : 'text-sm'}>❌</span>
                    </th>
                    <th 
                      className={`sticky top-16 z-20 bg-gray-100 px-0.5 py-2 sm:px-1 sm:py-3 text-center font-bold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors shadow-sm ${colCompacta}`}
                      onClick={() => setOrdenarPor('cleanSheets')}
                      title="Muralha - Clean Sheets"
                    >
                      <span className={ordenarPor === 'cleanSheets' ? 'text-base sm:text-xl' : 'text-sm'}>🛡️</span>
                    </th>
                    <th 
                      className={`sticky top-16 z-20 bg-gray-100 px-0.5 py-2 sm:px-1 sm:py-3 text-center font-bold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors shadow-sm ${colCompacta}`}
                      onClick={() => setOrdenarPor('empates')}
                      title="Empates"
                    >
                      <span className={ordenarPor === 'empates' ? 'text-base sm:text-xl' : 'text-sm'}>🤝</span>
                    </th>
                    <th 
                      className={`sticky top-16 z-20 bg-gray-100 px-0.5 py-2 sm:px-1 sm:py-3 text-center font-bold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors shadow-sm ${colCompacta}`}
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
                    
                    const isZonaTime = index < zonaTimeLimit;
                    const isZonaBolaMurcha = index >= zonaBolaMurchaStart;
                    const zonaClass = isZonaTime
                      ? 'bg-emerald-50 border-emerald-200'
                      : isZonaBolaMurcha
                      ? 'bg-red-50 border-red-200'
                      : bgGradient;

                    return (
                      <tr key={index} className={`border-b ${zonaClass} transition-colors`}>
                        <td className="px-0.5 py-2 sm:px-1 sm:py-3 text-center font-bold text-gray-700 text-xs sm:text-sm">
                          {isTop3 ? medalha : `${index + 1}º`}
                        </td>
                        <td className="px-1 py-2 sm:px-2 sm:py-3 font-medium text-gray-800 text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">{jogador.nome}</td>
                        <td className={`px-0.5 py-2 sm:px-1 sm:py-3 text-center font-bold text-xs sm:text-sm ${jogador.pontos >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                          {jogador.pontos.toFixed(1)}
                        </td>
                        <td className="px-0.5 py-2 sm:px-1 sm:py-3 text-center font-bold text-green-600 text-xs sm:text-sm">{jogador.gols}</td>
                        <td className={`px-0.5 py-2 sm:px-1 sm:py-3 text-center font-bold text-red-600 text-xs sm:text-sm ${colCompacta}`}>{jogador.golsContra}</td>
                        <td className="px-0.5 py-2 sm:px-1 sm:py-3 text-center font-bold text-green-600 text-xs sm:text-sm">{jogador.assistencias}</td>
                        <td className="px-0.5 py-2 sm:px-1 sm:py-3 text-center font-bold text-green-600 text-xs sm:text-sm">{jogador.vitorias}</td>
                        <td className={`px-0.5 py-2 sm:px-1 sm:py-3 text-center font-bold text-red-600 text-xs sm:text-sm ${colCompacta}`}>{jogador.derrotas}</td>
                        <td className={`px-0.5 py-2 sm:px-1 sm:py-3 text-center font-bold text-green-600 text-xs sm:text-sm ${colCompacta}`}>{jogador.cleanSheets}</td>
                        <td className={`px-0.5 py-2 sm:px-1 sm:py-3 text-center font-bold text-amber-600 text-xs sm:text-sm ${colCompacta}`}>{jogador.empates}</td>
                        <td className={`px-0.5 py-2 sm:px-1 sm:py-3 text-center text-gray-700 text-xs sm:text-sm ${colCompacta}`}>{jogador.jogos}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-gray-600">
                <span className="px-2 py-1 rounded border border-emerald-200 bg-emerald-50 font-semibold">Zona Time da Pelada</span>
                <span className="px-2 py-1 rounded border border-red-200 bg-red-50 font-semibold">Zona Bola Murcha</span>
              </div>
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
            <h3 className="text-[11px] font-semibold text-gray-700 mb-2 text-center uppercase tracking-wide">
              📊 Sistema de Pontuação
            </h3>
            <div className="flex flex-wrap justify-center items-center gap-2 text-[10px]">
              <div className="flex items-center gap-1.5 bg-white rounded px-2.5 py-1 whitespace-nowrap">
                <span>🏆</span>
                <span className="font-medium">Vitória:</span>
                <span className="font-bold text-green-600">{formatarPontuacaoLegenda(pontuacaoEstatisticas.vitoria)}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white rounded px-2.5 py-1 whitespace-nowrap">
                <span>⚽</span>
                <span className="font-medium">Gol:</span>
                <span className="font-bold text-green-600">{formatarPontuacaoLegenda(pontuacaoEstatisticas.gol)}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white rounded px-2.5 py-1 whitespace-nowrap">
                <img src={bolaVermelha.src} alt="Gol contra" className="w-3.5 h-3.5" />
                <span className="font-medium">Gol Contra:</span>
                <span className="font-bold text-red-600">{formatarPontuacaoLegenda(pontuacaoEstatisticas.golContra)}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white rounded px-2.5 py-1 whitespace-nowrap">
                <span>👟</span>
                <span className="font-medium">Assistência:</span>
                <span className="font-bold text-green-600">{formatarPontuacaoLegenda(pontuacaoEstatisticas.assistencia)}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white rounded px-2.5 py-1 whitespace-nowrap">
                <span>🤝</span>
                <span className="font-medium">Empate:</span>
                <span className="font-bold text-amber-600">{formatarPontuacaoLegenda(pontuacaoEstatisticas.empate)}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white rounded px-2.5 py-1 whitespace-nowrap">
                <span>🛡️</span>
                <span className="font-medium">Sem Sofrer Gols:</span>
                <span className="font-bold text-purple-600">{formatarPontuacaoLegenda(pontuacaoEstatisticas.cleanSheet)}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white rounded px-2.5 py-1 whitespace-nowrap">
                <span>❌</span>
                <span className="font-medium">Derrota:</span>
                <span className="font-bold text-red-600">{formatarPontuacaoLegenda(pontuacaoEstatisticas.derrota)}</span>
              </div>
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}
