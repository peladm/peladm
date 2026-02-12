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

interface Substituicao {
  jogador_saiu_id: string;
  jogador_entrou_id: string;
  time: 'A' | 'B';
  minuto?: number;
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
  tempo_decorrido?: number;
  data_inicio?: string;
  data_fim?: string;
  substituicoes?: Substituicao[];
  gols?: Gol[];
}

export default function ResultadosPage() {
  const router = useRouter();
  const { possuiPermissao, nomePlano, loading: loadingPermissoes } = usePermissions();
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [jogosFiltrados, setJogosFiltrados] = useState<Jogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'atual' | 'mes' | 'trimestre' | 'semestre' | 'ano' | 'sessao'>('atual');
  const [dataSelecionada, setDataSelecionada] = useState('');
  const [datasDisponiveis, setDatasDisponiveis] = useState<string[]>([]);
  const [mesesDisponiveis, setMesesDisponiveis] = useState<string[]>([]);
  const [trimestresDisponiveis, setTrimestresDisponiveis] = useState<string[]>([]);
  const [semestresDisponiveis, setSemestresDisponiveis] = useState<string[]>([]);
  const [anosDisponiveis, setAnosDisponiveis] = useState<string[]>([]);
  const [periodoSelecionado, setPeriodoSelecionado] = useState('');
  const [totalPartidas, setTotalPartidas] = useState(0);
  const [totalGols, setTotalGols] = useState(0);
  const [totalJogadores, setTotalJogadores] = useState(0);
  const [totalAssistencias, setTotalAssistencias] = useState(0);
  const [jogadores, setJogadores] = useState<{ [id: string]: Jogador }>({});
  const [mostrarModalPartidas, setMostrarModalPartidas] = useState(false);
  const [mostrarModalGols, setMostrarModalGols] = useState(false);
  const [mostrarModalJogadores, setMostrarModalJogadores] = useState(false);
  const [mostrarModalAssistencias, setMostrarModalAssistencias] = useState(false);
  const [ordenarPor, setOrdenarPor] = useState<'pontos' | 'vitorias' | 'jogos' | 'gols' | 'derrotas' | 'empates'>('pontos');
  const [modoAdmin, setModoAdmin] = useState(false);
  const [mostrarModalSenha, setMostrarModalSenha] = useState(false);
  const [senhaAdmin, setSenhaAdmin] = useState('');
  const [erroSenha, setErroSenha] = useState('');
  const [jogoParaExcluir, setJogoParaExcluir] = useState<string | null>(null);
  const [mostrarConfirmacaoExcluir, setMostrarConfirmacaoExcluir] = useState(false);
  const [mostrarConfirmacaoExcluirTodos, setMostrarConfirmacaoExcluirTodos] = useState(false);
  const [mostrarBotaoFlutuante, setMostrarBotaoFlutuante] = useState(false);

  // Bloquear acesso para plano FREE
  useEffect(() => {
    if (!loadingPermissoes && !possuiPermissao('verResultados')) {
      alert(`🚫 Resultados não disponíveis no plano ${nomePlano}. Faça upgrade para Gold ou Premium!`);
      router.push('/');
    }
  }, [loadingPermissoes, possuiPermissao, nomePlano, router]);

  useEffect(() => {
    carregarDados();
    
    // Verificar se deve abrir modal admin (vindo de outra página)
    const deveAbrirAdmin = sessionStorage.getItem('abrirAdminResultados');
    if (deveAbrirAdmin === 'true') {
      sessionStorage.removeItem('abrirAdminResultados');
      setTimeout(() => abrirModalSenha(), 300);
    }
  }, []);

  // Desativar modo admin ao sair da página
  useEffect(() => {
    return () => {
      if (modoAdmin) {
        setModoAdmin(false);
      }
    };
  }, [modoAdmin]);

  useEffect(() => {
    aplicarFiltro();
  }, [filtro, dataSelecionada, periodoSelecionado, jogos]);

  useEffect(() => {
    const handleScroll = () => {
      const botaoOriginal = document.getElementById('botao-compartilhar-original');
      if (botaoOriginal) {
        const rect = botaoOriginal.getBoundingClientRect();
        // Mostrar flutuante quando o botão original está abaixo da viewport (não visível)
        setMostrarBotaoFlutuante(rect.top > window.innerHeight);
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Executar na montagem
    return () => window.removeEventListener('scroll', handleScroll);
  }, [jogosFiltrados]);

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
    console.log('⚠️ Jogador não encontrado:', jogadorId);
    return idStr.substring(0, 8);
  };

  const compartilharResultado = async (jogo: Jogo, numeroPartida: number) => {
    try {
      // Salvar dados no sessionStorage
      sessionStorage.setItem('shareJogo', JSON.stringify(jogo));
      sessionStorage.setItem('shareNumeroPartida', numeroPartida.toString());
      sessionStorage.setItem('shareJogadores', JSON.stringify(jogadores));

      // Abrir página de compartilhamento
      const urlBase = window.location.origin;
      const shareUrl = `${urlBase}/share`;
      
      // Abrir em nova aba
      window.open(shareUrl, '_blank');

      // Aguardar e abrir WhatsApp com o link
      setTimeout(() => {
        const textoWhatsApp = `Resultado - Partida #${numeroPartida}\nVeja o resultado completo: ${shareUrl}`;
        const textoEncoded = encodeURIComponent(textoWhatsApp);
        const urlWhatsApp = `https://wa.me/?text=${textoEncoded}`;
        window.open(urlWhatsApp, '_blank');
      }, 800);

    } catch (error) {
      console.error('Erro ao compartilhar:', error);
      alert('Erro ao gerar compartilhamento');
    }
  };

  // Funções Admin
  const abrirModalSenha = () => {
    // Se já está no modo admin, mostrar alerta e desativar
    if (modoAdmin) {
      alert('Modo Admin foi desativado');
      setModoAdmin(false);
      return;
    }
    setMostrarModalSenha(true);
    setSenhaAdmin('');
    setErroSenha('');
  };

  const validarSenhaAdmin = async () => {
    try {
      const peladaId = buscar_pelada_id();
      if (!peladaId) {
        setErroSenha('Usuário não está logado');
        return;
      }
      
      const supabase = await getClienteSupabase(peladaId);
      
      // Buscar senha do cliente no Supabase
      const { data: cliente, error } = await supabase
        .from('clientes')
        .select('senha')
        .eq('pelada_id', peladaId)
        .single();

      if (error || !cliente) {
        console.error('Erro ao buscar cliente:', error);
        setErroSenha('Erro ao validar cliente');
        return;
      }

      if (cliente.senha === senhaAdmin) {
        setModoAdmin(true);
        setMostrarModalSenha(false);
        setSenhaAdmin('');
        setErroSenha('');
      } else {
        setErroSenha('Senha incorreta');
      }
    } catch (error) {
      console.error('Erro ao validar senha:', error);
      setErroSenha('Erro ao validar senha');
    }
  };

  const excluirPartida = async (jogoId: string) => {
    try {
      const peladaId = buscar_pelada_id();
      if (!peladaId) return;
      
      const supabase = await getClienteSupabase(peladaId);
      
      // Excluir gols da partida
      await supabase
        .from('gols')
        .delete()
        .eq('jogo_id', jogoId);

      // Excluir a partida
      const { error } = await supabase
        .from('jogos')
        .delete()
        .eq('id', jogoId);

      if (error) throw error;

      // Recarregar dados
      await carregarDados();
      setMostrarConfirmacaoExcluir(false);
      setJogoParaExcluir(null);
    } catch (error) {
      console.error('Erro ao excluir partida:', error);
      alert('Erro ao excluir partida');
    }
  };

  const excluirTodasPartidas = async () => {
    try {
      const peladaId = buscar_pelada_id();
      if (!peladaId) return;
      
      const supabase = await getClienteSupabase(peladaId);
      const jogosIds = jogosFiltrados.map(j => j.id);

      // Excluir todos os gols das partidas filtradas
      await supabase
        .from('gols')
        .delete()
        .in('jogo_id', jogosIds);

      // Excluir todas as partidas filtradas
      const { error } = await supabase
        .from('jogos')
        .delete()
        .in('id', jogosIds);

      if (error) throw error;

      // Recarregar dados
      await carregarDados();
      setMostrarConfirmacaoExcluirTodos(false);
    } catch (error) {
      console.error('Erro ao excluir partidas:', error);
      alert('Erro ao excluir partidas');
    }
  };

  const compartilharTodosResultados = async () => {
    try {
      if (jogosFiltrados.length === 0) return;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const largura = 600;
      const alturaHeader = 100;
      const alturaPorJogo = 280;
      const espacamento = 20;
      const altura = alturaHeader + (jogosFiltrados.length * (alturaPorJogo + espacamento));

      canvas.width = largura;
      canvas.height = altura;

      // Fundo branco
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Título principal
      ctx.fillStyle = '#374151';
      ctx.font = 'bold 32px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Resultados das Partidas', largura / 2, 50);

      let yOffset = alturaHeader;

      jogosFiltrados.forEach((jogo, index) => {
        const numeroPartida = jogosFiltrados.length - index;

        // Fundo do card
        ctx.fillStyle = '#f9fafb';
        ctx.fillRect(20, yOffset, largura - 40, alturaPorJogo - 20);

        // Número da partida
        ctx.fillStyle = '#6b7280';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`Partida #${numeroPartida}`, 40, yOffset + 25);

        // Duração e horário
        if (jogo.data_inicio && jogo.data_fim) {
          const inicio = new Date(jogo.data_inicio);
          const fim = new Date(jogo.data_fim);
          const duracaoMs = fim.getTime() - inicio.getTime();
          const duracaoSeg = Math.floor(duracaoMs / 1000);
          const minutos = Math.floor(duracaoSeg / 60);
          const segundos = duracaoSeg % 60;
          const duracao = `${minutos}:${String(segundos).padStart(2, '0')}`;
          const horario = inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

          ctx.fillStyle = '#9ca3af';
          ctx.font = '14px Arial';
          ctx.textAlign = 'right';
          ctx.fillText(`⏱️ ${duracao} • ${horario}`, largura - 40, yOffset + 25);
        }

        // Placar
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#22c55e';
        ctx.fillText(jogo.placar_a.toString(), 180, yOffset + 80);

        ctx.fillStyle = '#9ca3af';
        ctx.font = 'bold 24px Arial';
        ctx.fillText('VS', largura / 2, yOffset + 75);

        ctx.fillStyle = '#374151';
        ctx.font = 'bold 48px Arial';
        ctx.fillText(jogo.placar_b.toString(), 420, yOffset + 80);

        // Times
        const yTime = yOffset + 110;

        // Time 1
        ctx.fillStyle = '#dcfce7';
        ctx.fillRect(40, yTime, 240, 30);
        ctx.fillStyle = '#15803d';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Time 1', 160, yTime + 20);

        ctx.fillStyle = '#374151';
        ctx.font = '12px Arial';
        let yPosTime1 = yTime + 45;
        jogo.time_a.slice(0, 6).forEach((jogadorId) => {
          const nome = buscarJogador(jogadorId);
          const gols = (jogo.gols || []).filter(g => g.jogador_id === jogadorId && g.time === 'A').length;
          const texto = nome + (gols > 0 ? ' ' + '⚽'.repeat(gols) : '');
          ctx.fillText(texto, 160, yPosTime1);
          yPosTime1 += 18;
        });

        // Time 2
        ctx.fillStyle = '#f3f4f6';
        ctx.fillRect(320, yTime, 240, 30);
        ctx.fillStyle = '#374151';
        ctx.font = 'bold 14px Arial';
        ctx.fillText('Time 2', 440, yTime + 20);

        ctx.fillStyle = '#374151';
        ctx.font = '12px Arial';
        let yPosTime2 = yTime + 45;
        jogo.time_b.slice(0, 6).forEach((jogadorId) => {
          const nome = buscarJogador(jogadorId);
          const gols = (jogo.gols || []).filter(g => g.jogador_id === jogadorId && g.time === 'B').length;
          const texto = nome + (gols > 0 ? ' ' + '⚽'.repeat(gols) : '');
          ctx.fillText(texto, 440, yPosTime2);
          yPosTime2 += 18;
        });

        yOffset += alturaPorJogo + espacamento;
      });

      // Compartilhar ou baixar
      // Baixar PNG em alta qualidade
      const link = document.createElement('a');
      link.download = 'resultados.png';
      link.href = canvas.toDataURL('image/png');
      link.click();

      // Abrir WhatsApp
      setTimeout(() => {
        const textoWhatsApp = `Resultados das Partidas - ${jogosFiltrados.length} partida(s)`;
        const textoEncoded = encodeURIComponent(textoWhatsApp);
        const urlWhatsApp = `https://wa.me/?text=${textoEncoded}`;
        window.open(urlWhatsApp, '_blank');
      }, 500);

    } catch (error) {
      console.error('Erro ao compartilhar:', error);
      alert('Erro ao gerar imagem');
    }
  };

  const baixarImagemGeral = (canvas: HTMLCanvasElement) => {
    const link = document.createElement('a');
    link.download = 'resultados.jpg';
    link.href = canvas.toDataURL('image/jpeg', 0.95);
    link.click();
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

      // Buscar todos os jogadores DO SUPABASE DEDICADO (filtrado por pelada_id)
      const { data: jogadoresData, error: erroJogadores } = await clienteDb
        .from('jogadores')
        .select('*')
        .eq('pelada_id', peladaId);
      
      if (erroJogadores) {
        console.error('❌ Erro ao buscar jogadores:', erroJogadores);
      }
      
      console.log('👥 Jogadores carregados:', jogadoresData?.length);
      console.log('📋 Amostra de jogadores:', jogadoresData?.slice(0, 3));
      
      if (jogadoresData) {
        const jogadoresMap: { [id: string]: Jogador } = {};
        jogadoresData.forEach(j => {
          jogadoresMap[j.id] = j;
          jogadoresMap[j.nome] = j; // Indexar também pelo nome para busca
        });
        setJogadores(jogadoresMap);
        console.log('📋 Map de jogadores:', Object.keys(jogadoresMap).length);
      }

      // Buscar todos os jogos finalizados (banco dedicado premium)
      const { data: jogosData, error } = await clienteDb
        .from('jogos')
        .select('*')
        .eq('status', 'finalizado')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao carregar jogos:', error);
        return;
      }

      // Buscar gols de todos os jogos
      if (jogosData && jogosData.length > 0) {
        const jogosIds = jogosData.map(j => j.id);
        const { data: golsData } = await clienteDb
          .from('gols')
          .select('*')
          .in('jogo_id', jogosIds);

        // Associar gols e substituições aos jogos
        const jogosComGols = jogosData.map(jogo => {
          const subs = Array.isArray(jogo.substituicoes) ? jogo.substituicoes : [];
          console.log('🔍 Jogo:', jogo.id, 'Substituições:', subs, 'Tipo:', typeof jogo.substituicoes);
          return {
            ...jogo,
            gols: (golsData || []).filter(g => g.jogo_id === jogo.id),
            substituicoes: subs
          };
        });

        setJogos(jogosComGols);
      } else {
        setJogos([]);
      }

      // Extrair datas únicas
      const datas = [...new Set((jogosData || []).map(jogo => {
        const data = new Date(jogo.created_at);
        return data.toLocaleDateString('pt-BR', { 
          day: '2-digit', 
          month: '2-digit',
          year: 'numeric'
        });
      }))];
      
      // Extrair meses únicos (MM/YYYY)
      const meses = [...new Set((jogosData || []).map(jogo => {
        const data = new Date(jogo.created_at);
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const ano = data.getFullYear();
        return `${mes}/${ano}`;
      }))].sort().reverse();
      
      // Extrair trimestres únicos (QX/YYYY)
      const trimestres = [...new Set((jogosData || []).map(jogo => {
        const data = new Date(jogo.created_at);
        const mes = data.getMonth();
        const trimestre = Math.floor(mes / 3) + 1;
        return `Q${trimestre}/${data.getFullYear()}`;
      }))].sort().reverse();
      
      // Extrair semestres únicos (SX/YYYY)
      const semestres = [...new Set((jogosData || []).map(jogo => {
        const data = new Date(jogo.created_at);
        const semestre = data.getMonth() < 6 ? 1 : 2;
        return `S${semestre}/${data.getFullYear()}`;
      }))].sort().reverse();
      
      // Extrair anos únicos
      const anos = [...new Set((jogosData || []).map(jogo => {
        const data = new Date(jogo.created_at);
        return data.getFullYear().toString();
      }))].sort().reverse();
      
      console.log('📅 Datas disponíveis:', datas);
      console.log('📅 Meses disponíveis:', meses);
      console.log('📅 Trimestres disponíveis:', trimestres);
      console.log('📅 Semestres disponíveis:', semestres);
      console.log('📅 Anos disponíveis:', anos);
      console.log('📊 Total de jogos:', jogosData?.length);
      setDatasDisponiveis(datas);
      setMesesDisponiveis(meses);
      setTrimestresDisponiveis(trimestres);
      setSemestresDisponiveis(semestres);
      setAnosDisponiveis(anos);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
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
    } else if (filtro === 'trimestre') {
      if (periodoSelecionado) {
        // Filtrar por trimestre específico (QX/YYYY)
        filtered = jogos.filter(jogo => {
          const data = new Date(jogo.created_at);
          const mes = data.getMonth();
          const trimestre = Math.floor(mes / 3) + 1;
          const trimestreStr = `Q${trimestre}/${data.getFullYear()}`;
          return trimestreStr === periodoSelecionado;
        });
      } else {
        // Último trimestre (90 dias)
        const hoje = new Date();
        const trimAtras = new Date(hoje.getTime() - 90 * 24 * 60 * 60 * 1000);
        filtered = jogos.filter(jogo => new Date(jogo.created_at) >= trimAtras);
      }
    } else if (filtro === 'semestre') {
      if (periodoSelecionado) {
        // Filtrar por semestre específico (SX/YYYY)
        filtered = jogos.filter(jogo => {
          const data = new Date(jogo.created_at);
          const semestre = data.getMonth() < 6 ? 1 : 2;
          const semestreStr = `S${semestre}/${data.getFullYear()}`;
          return semestreStr === periodoSelecionado;
        });
      } else {
        // Último semestre (180 dias)
        const hoje = new Date();
        const semAtras = new Date(hoje.getTime() - 180 * 24 * 60 * 60 * 1000);
        filtered = jogos.filter(jogo => new Date(jogo.created_at) >= semAtras);
      }
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

    // Calcular estatísticas
    const partidas = filtered.length;
    const gols = filtered.reduce((sum, jogo) => sum + jogo.placar_a + jogo.placar_b, 0);
    
    // Contar jogadores únicos
    const jogadoresUnicos = new Set<string>();
    filtered.forEach(jogo => {
      jogo.time_a.forEach(j => jogadoresUnicos.add(j));
      jogo.time_b.forEach(j => jogadoresUnicos.add(j));
    });

    setTotalPartidas(partidas);
    setTotalGols(gols);
    setTotalJogadores(jogadoresUnicos.size);
  };

  const formatarDuracao = (segundos?: number) => {
    if (!segundos) return 'N/A';
    const minutos = Math.floor(segundos / 60);
    const segs = segundos % 60;
    return `${minutos}:${segs.toString().padStart(2, '0')}`;
  };

  return (
    <Layout title="Resultados" onAdminClick={abrirModalSenha}>
      <div className="max-w-2xl mx-auto px-4 py-3">
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

        {/* Cards de resumo */}
        <section className="grid grid-cols-2 gap-2 mb-4">
          {/* Partidas - Clicável */}
          <button
            onClick={() => setMostrarModalPartidas(true)}
            className="bg-white rounded-lg shadow-sm border border-gray-200 flex hover:shadow-md hover:scale-105 transition-all active:scale-95"
          >
            <div className="w-1/2 flex items-center justify-center border-r border-gray-200">
              <div className="text-4xl">🥅</div>
            </div>
            <div className="w-1/2 flex flex-col items-center justify-center p-3">
              <div className="text-xl font-bold text-gray-800">{totalPartidas}</div>
              <div className="text-xs text-gray-600 text-center">PARTIDAS</div>
            </div>
          </button>

          {/* Gols - Clicável */}
          <button
            onClick={() => setMostrarModalGols(true)}
            className="bg-white rounded-lg shadow-sm border border-gray-200 flex hover:shadow-md hover:scale-105 transition-all active:scale-95"
          >
            <div className="w-1/2 flex items-center justify-center border-r border-gray-200">
              <div className="text-4xl">⚽</div>
            </div>
            <div className="w-1/2 flex flex-col items-center justify-center p-3">
              <div className="text-xl font-bold text-gray-800">{totalGols}</div>
              <div className="text-xs text-gray-600 text-center">GOLS</div>
            </div>
          </button>

          {/* Jogadores - Clicável */}
          <button
            onClick={() => setMostrarModalJogadores(true)}
            className="bg-white rounded-lg shadow-sm border border-gray-200 flex hover:shadow-md hover:scale-105 transition-all active:scale-95"
          >
            <div className="w-1/2 flex items-center justify-center border-r border-gray-200">
              <div className="text-4xl">👥</div>
            </div>
            <div className="w-1/2 flex flex-col items-center justify-center p-3">
              <div className="text-xl font-bold text-gray-800">{totalJogadores}</div>
              <div className="text-xs text-gray-600 text-center">JOGADORES</div>
            </div>
          </button>

          {/* Assistências - Clicável */}
          <button
            onClick={() => setMostrarModalAssistencias(true)}
            className="bg-white rounded-lg shadow-sm border border-gray-200 flex hover:shadow-md hover:scale-105 transition-all active:scale-95"
          >
            <div className="w-1/2 flex items-center justify-center border-r border-gray-200">
              <div className="text-4xl">👟</div>
            </div>
            <div className="w-1/2 flex flex-col items-center justify-center p-3">
              <div className="text-xl font-bold text-gray-800">{totalAssistencias}</div>
              <div className="text-[0.65rem] text-gray-600 text-center">ASSISTÊNCIAS</div>
            </div>
          </button>
        </section>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">⏳</div>
            <div className="text-gray-600">Carregando resultados...</div>
          </div>
        )}

        {/* Lista de partidas */}
        {!loading && jogosFiltrados.length > 0 && (
          <section className="space-y-4">
            {jogosFiltrados.map((jogo, index) => (
              <div key={jogo.id} className="bg-white rounded-xl shadow-md border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-gray-500">
                    Partida #{jogosFiltrados.length - index}
                  </div>
                  <div className="text-right">
                    {jogo.tempo_decorrido !== undefined && (
                      <div className="text-sm font-semibold text-gray-700">
                        ⏱️ {(() => {
                          // tempo_decorrido = tempo que RESTOU (cronômetro regressivo)
                          // Buscar tempo inicial da partida (geralmente 10min = 600seg)
                          const tempoInicial = 600; // 10 minutos padrão
                          const tempoRestante = jogo.tempo_decorrido;
                          const duracaoReal = tempoInicial - tempoRestante;
                          
                          // Se for negativo (cronômetro passou do tempo), usar tempo das datas
                          if (duracaoReal < 0 && jogo.data_inicio && jogo.data_fim) {
                            const inicio = new Date(jogo.data_inicio);
                            const fim = new Date(jogo.data_fim);
                            const duracaoMs = fim.getTime() - inicio.getTime();
                            if (duracaoMs > 0) {
                              const duracaoSeg = Math.floor(duracaoMs / 1000);
                              const minutos = Math.floor(duracaoSeg / 60);
                              const segundos = duracaoSeg % 60;
                              return `${minutos}:${String(segundos).padStart(2, '0')}`;
                            }
                          }
                          
                          const minutos = Math.floor(Math.abs(duracaoReal) / 60);
                          const segundos = Math.abs(duracaoReal) % 60;
                          return `${minutos}:${String(segundos).padStart(2, '0')}`;
                        })()}
                      </div>
                    )}
                    <div className="text-xs text-gray-500">
                      {jogo.data_inicio 
                        ? new Date(jogo.data_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                        : new Date(jogo.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                      }
                    </div>
                  </div>
                </div>

                {/* Placar */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex-1 text-center">
                    <div className="text-3xl font-bold text-green-600">{jogo.placar_a}</div>
                  </div>
                  <div className="px-4 text-gray-400 font-semibold">VS</div>
                  <div className="flex-1 text-center">
                    <div className="text-3xl font-bold text-gray-800">{jogo.placar_b}</div>
                  </div>
                </div>

                {/* Times */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <div className="font-semibold text-green-700 mb-2 text-center">Time 1</div>
                    {jogo.time_a.map((jogadorId, i) => {
                      // Obter nome do jogador para comparação
                      const nomeJogador = buscarJogador(jogadorId);
                      const golsJogador = (jogo.gols || []).filter(g => {
                        const nomeGol = buscarJogador(g.jogador_id);
                        return (g.jogador_id === jogadorId || nomeGol === nomeJogador) && g.time === 'A';
                      }).length;
                      const substituicaoEntrada = (jogo.substituicoes || []).find(s => s.jogador_entrou_id === jogadorId && s.time === 'A');
                      
                      return (
                        <div key={i} className="text-gray-700 py-1 text-center">
                          {substituicaoEntrada ? (
                            <div className="bg-green-100 border-l-4 border-green-500 px-2 py-1 my-1">
                              <div className="text-red-600 text-xs">↓ {buscarJogador(substituicaoEntrada.jogador_saiu_id)}
                                {(() => {
                                  const nomeSaiu = buscarJogador(substituicaoEntrada.jogador_saiu_id);
                                  const golsSaiu = (jogo.gols || []).filter(g => {
                                    const nomeGol = buscarJogador(g.jogador_id);
                                    return (g.jogador_id === substituicaoEntrada.jogador_saiu_id || nomeGol === nomeSaiu) && g.time === 'A';
                                  }).length;
                                  return golsSaiu > 0 ? ' ' + '⚽'.repeat(golsSaiu) : '';
                                })()}
                              </div>
                              <div className="text-green-600 font-bold text-xs">↑ {buscarJogador(jogadorId)}
                                {golsJogador > 0 && ' ' + '⚽'.repeat(golsJogador)}
                              </div>
                            </div>
                          ) : (
                            <div>
                              {buscarJogador(jogadorId)}
                              {golsJogador > 0 && ' ' + '⚽'.repeat(golsJogador)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="bg-gray-100 rounded-lg p-3 border border-gray-300">
                    <div className="font-semibold text-gray-800 mb-2 text-center">Time 2</div>
                    {jogo.time_b.map((jogadorId, i) => {
                      // Obter nome do jogador para comparação
                      const nomeJogador = buscarJogador(jogadorId);
                      const golsJogador = (jogo.gols || []).filter(g => {
                        const nomeGol = buscarJogador(g.jogador_id);
                        return (g.jogador_id === jogadorId || nomeGol === nomeJogador) && g.time === 'B';
                      }).length;
                      const substituicaoEntrada = (jogo.substituicoes || []).find(s => s.jogador_entrou_id === jogadorId && s.time === 'B');
                      
                      return (
                        <div key={i} className="text-gray-700 py-1 text-center">
                          {substituicaoEntrada ? (
                            <div className="bg-blue-50 border-l-4 border-blue-500 px-2 py-1 my-1">
                              <div className="text-red-600 text-xs">↓ {buscarJogador(substituicaoEntrada.jogador_saiu_id)}
                                {(() => {
                                  const nomeSaiu = buscarJogador(substituicaoEntrada.jogador_saiu_id);
                                  const golsSaiu = (jogo.gols || []).filter(g => {
                                    const nomeGol = buscarJogador(g.jogador_id);
                                    return (g.jogador_id === substituicaoEntrada.jogador_saiu_id || nomeGol === nomeSaiu) && g.time === 'B';
                                  }).length;
                                  return golsSaiu > 0 ? ' ' + '⚽'.repeat(golsSaiu) : '';
                                })()}
                              </div>
                              <div className="text-green-600 font-bold text-xs">↑ {buscarJogador(jogadorId)}
                                {golsJogador > 0 && ' ' + '⚽'.repeat(golsJogador)}
                              </div>
                            </div>
                          ) : (
                            <div>
                              {buscarJogador(jogadorId)}
                              {golsJogador > 0 && ' ' + '⚽'.repeat(golsJogador)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Botão Excluir Partida (apenas no modo admin) */}
                {modoAdmin && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => {
                        setJogoParaExcluir(jogo.id);
                        setMostrarConfirmacaoExcluir(true);
                      }}
                      className="w-full bg-red-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-red-700 transition-colors"
                    >
                      🗑️ Excluir Partida
                    </button>
                  </div>
                )}
              </div>
            ))}
            
            {/* Botões Admin */}
            {modoAdmin && jogosFiltrados.length > 0 && (
              <div className="mt-6 text-center space-y-3">
                <button
                  onClick={() => setMostrarConfirmacaoExcluirTodos(true)}
                  className="w-full bg-red-700 text-white px-6 py-3 rounded-xl text-base font-bold hover:bg-red-800 transition-all shadow-lg"
                >
                  🗑️ Excluir Todos os Jogos ({jogosFiltrados.length})
                </button>
                <button
                  onClick={() => setModoAdmin(false)}
                  className="w-full bg-gray-600 text-white px-6 py-3 rounded-xl text-base font-bold hover:bg-gray-700 transition-all"
                >
                  ❌ Sair do Modo Admin
                </button>
              </div>
            )}
          </section>
        )}

        {/* Estado vazio */}
        {!loading && jogosFiltrados.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🥅</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Nenhuma partida encontrada</h3>
            <p className="text-gray-600">Não há partidas finalizadas no período selecionado.</p>
          </div>
        )}

        {/* Modal Partidas */}
        {mostrarModalPartidas && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setMostrarModalPartidas(false)}>
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-4 flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">🥅 Resumo das Partidas</h3>
                <button onClick={() => setMostrarModalPartidas(false)} className="text-white text-2xl hover:text-gray-200">✕</button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[60vh]">
                {jogosFiltrados.length > 0 ? (
                  <div className="space-y-3">
                    {jogosFiltrados.map((jogo, index) => (
                      <div key={jogo.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-gray-500">Partida #{jogosFiltrados.length - index}</span>
                          {jogo.data_inicio && (
                            <span className="text-xs text-gray-500">
                              {new Date(jogo.data_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-center gap-4">
                          <div className={`text-2xl font-bold ${jogo.placar_a > jogo.placar_b ? 'text-green-600' : jogo.placar_a < jogo.placar_b ? 'text-gray-600' : 'text-amber-600'}`}>
                            {jogo.placar_a}
                          </div>
                          <span className="text-gray-400 text-sm font-semibold">VS</span>
                          <div className={`text-2xl font-bold ${jogo.placar_b > jogo.placar_a ? 'text-green-600' : jogo.placar_b < jogo.placar_a ? 'text-gray-600' : 'text-amber-600'}`}>
                            {jogo.placar_b}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-2">🥅</div>
                    <p>Nenhuma partida no período</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal Gols */}
        {mostrarModalGols && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setMostrarModalGols(false)}>
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="bg-gradient-to-r from-green-500 to-green-600 p-4 flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">⚽ Gols do Dia</h3>
                <button onClick={() => setMostrarModalGols(false)} className="text-white text-2xl hover:text-gray-200">✕</button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[60vh]">
                {(() => {
                  const golsPorJogador: { [nome: string]: number } = {};
                  const todosJogadoresSet = new Set<string>();
                  
                  // Coletar todos os jogadores que participaram
                  jogosFiltrados.forEach(jogo => {
                    [...jogo.time_a, ...jogo.time_b].forEach(jogadorId => {
                      const nome = buscarJogador(jogadorId);
                      todosJogadoresSet.add(nome);
                      if (!golsPorJogador[nome]) {
                        golsPorJogador[nome] = 0;
                      }
                    });
                    
                    // Contar gols
                    (jogo.gols || []).forEach(gol => {
                      const nome = buscarJogador(gol.jogador_id);
                      golsPorJogador[nome] = (golsPorJogador[nome] || 0) + 1;
                    });
                  });

                  // Separar quem fez gol de quem não fez
                  const comGols = Object.entries(golsPorJogador).filter(([_, gols]) => gols > 0).sort((a, b) => b[1] - a[1]);
                  const semGols = Object.entries(golsPorJogador).filter(([_, gols]) => gols === 0).map(([nome]) => nome);

                  return (
                    <>
                      {comGols.length > 0 ? (
                        <div className="space-y-2 mb-4">
                          {comGols.map(([nome, gols], index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <span className="font-medium text-gray-800">{nome}</span>
                              <span className="text-green-600 font-bold text-lg">{gols} ⚽</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500 mb-4">
                          <div className="text-4xl mb-2">⚽</div>
                          <p>Nenhum gol marcado no período</p>
                        </div>
                      )}
                      
                      {semGols.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <p className="text-sm text-gray-600 text-center">
                            {semGols.join(', ')} não {semGols.length === 1 ? 'fez' : 'fizeram'} gols
                          </p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Modal Jogadores */}
        {mostrarModalJogadores && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setMostrarModalJogadores(false)}>
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">👥 Jogadores</h3>
                <button onClick={() => setMostrarModalJogadores(false)} className="text-white text-2xl hover:text-gray-200">✕</button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[65vh]">
                {(() => {
                  const estatisticasPorJogador: { [nome: string]: { jogos: number; vitorias: number; derrotas: number; empates: number } } = {};
                  
                  jogosFiltrados.forEach(jogo => {
                    [...jogo.time_a, ...jogo.time_b].forEach(jogadorId => {
                      const nome = buscarJogador(jogadorId);
                      if (!estatisticasPorJogador[nome]) {
                        estatisticasPorJogador[nome] = { jogos: 0, vitorias: 0, derrotas: 0, empates: 0 };
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

                  const jogadoresList = Object.entries(estatisticasPorJogador).sort((a, b) => a[0].localeCompare(b[0]));

                  return jogadoresList.length > 0 ? (
                    <div className="space-y-2">
                      {jogadoresList.map(([nome, stats], index) => (
                        <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="font-semibold text-gray-800 mb-2">{nome}</div>
                          <div className="flex gap-4 text-sm">
                            <span className="text-gray-600">
                              <span className="font-semibold">🎮 {stats.jogos}</span> {stats.jogos === 1 ? 'partida' : 'partidas'}
                            </span>
                            <span className="text-green-600 font-semibold">🏆 {stats.vitorias}V</span>
                            <span className="text-amber-600 font-semibold">🤝 {stats.empates}E</span>
                            <span className="text-red-600 font-semibold">❌ {stats.derrotas}D</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-4xl mb-2">👥</div>
                      <p>Nenhum jogador encontrado</p>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Modal Assistências */}
        {mostrarModalAssistencias && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setMostrarModalAssistencias(false)}>
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-4 flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">👟 Assistências</h3>
                <button onClick={() => setMostrarModalAssistencias(false)} className="text-white text-2xl hover:text-gray-200">✕</button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[60vh]">
                <div className="text-center py-12 text-gray-500">
                  <div className="text-5xl mb-4">👟</div>
                  <h4 className="text-lg font-semibold text-gray-700 mb-2">Em Breve!</h4>
                  <p className="text-sm">Sistema de assistências será implementado em breve.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Senha Admin */}
        {mostrarModalSenha && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <div className="bg-gradient-to-r from-red-500 to-red-600 p-4">
                <h3 className="text-xl font-bold text-white">🔒 Acesso Administrativo</h3>
              </div>
              <div className="p-6">
                <p className="text-gray-700 mb-4">Digite sua senha para acessar o modo de exclusão:</p>
                <input
                  type="password"
                  value={senhaAdmin}
                  onChange={(e) => setSenhaAdmin(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && validarSenhaAdmin()}
                  placeholder="Senha"
                  className="w-full p-3 border border-gray-300 rounded-lg mb-2 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  autoFocus
                />
                {erroSenha && (
                  <div className="text-red-600 text-sm mb-4">❌ {erroSenha}</div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setMostrarModalSenha(false);
                      setSenhaAdmin('');
                      setErroSenha('');
                    }}
                    className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg font-semibold hover:bg-gray-600 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={validarSenhaAdmin}
                    className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-red-700 transition-colors"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Confirmação Excluir Partida */}
        {mostrarConfirmacaoExcluir && jogoParaExcluir && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <div className="bg-gradient-to-r from-red-500 to-red-600 p-4">
                <h3 className="text-xl font-bold text-white">⚠️ Confirmar Exclusão</h3>
              </div>
              <div className="p-6">
                <p className="text-gray-700 mb-6">Tem certeza que deseja excluir esta partida? Esta ação não pode ser desfeita.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setMostrarConfirmacaoExcluir(false);
                      setJogoParaExcluir(null);
                    }}
                    className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg font-semibold hover:bg-gray-600 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => excluirPartida(jogoParaExcluir)}
                    className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-red-700 transition-colors"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Confirmação Excluir Todos */}
        {mostrarConfirmacaoExcluirTodos && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <div className="bg-gradient-to-r from-red-600 to-red-700 p-4">
                <h3 className="text-xl font-bold text-white">⚠️ Confirmar Exclusão em Massa</h3>
              </div>
              <div className="p-6">
                <p className="text-gray-700 mb-2 font-semibold">Atenção! Você está prestes a excluir:</p>
                <p className="text-red-600 text-lg font-bold mb-4">{jogosFiltrados.length} partida(s)</p>
                <p className="text-gray-700 mb-6">Esta ação não pode ser desfeita. Deseja continuar?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMostrarConfirmacaoExcluirTodos(false)}
                    className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg font-semibold hover:bg-gray-600 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={excluirTodasPartidas}
                    className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-red-700 transition-colors"
                  >
                    Excluir Tudo
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
