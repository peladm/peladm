'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { getClienteSupabase, validarSenhaPelada } from '../../lib/supabase';
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
  id?: string;
  jogo_id: string;
  jogador_id: string;
  time: 'A' | 'B';
}

interface Assistencia {
  id?: string;
  jogo_id: string;
  jogador_id: string;
  time: 'A' | 'B';
  gol_id?: string;
}

interface EventoEditavel {
  golId: string;
  jogadorGolId: string;
  timeGol: 'A' | 'B';
  assistId?: string;
  jogadorAssistId: string;
  timeAssist?: 'A' | 'B';
  isNew?: boolean;
}

interface GolDB {
  id?: string;
  jogo_id: string;
  jogador_id: string;
  time: 'A' | 'B';
}

interface AssistenciaDB {
  id?: string;
  jogo_id: string;
  jogador_id: string;
  time: 'A' | 'B';
}

interface Jogo {
  id: string;
  sessao_id: string;
  time_a: string[];
  time_b: string[];
  cor_time_a?: string | null;
  cor_time_b?: string | null;
  placar_a: number;
  placar_b: number;
  created_at: string;
  tempo_decorrido?: number;
  data_inicio?: string;
  data_fim?: string;
  substituicoes?: Substituicao[];
  gols?: Gol[];
  assistencias?: Assistencia[];
}

export default function ResultadosPage() {
  const DEBUG = false;
  const STORAGE_KEY = 'peladm:resultados:state:v1';
  const router = useRouter();
  const { possuiPermissao, nomePlano, loading: loadingPermissoes } = usePermissions();
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [jogosFiltrados, setJogosFiltrados] = useState<Jogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'atual' | 'mes' | 'ultimas' | 'ano' | 'historia'>('atual');
  const [dataSelecionada, setDataSelecionada] = useState('');
  const [datasDisponiveis, setDatasDisponiveis] = useState<string[]>([]);
  const [mesesDisponiveis, setMesesDisponiveis] = useState<string[]>([]);
  const [anosDisponiveis, setAnosDisponiveis] = useState<string[]>([]);
  const [periodoSelecionado, setPeriodoSelecionado] = useState('');
  const [quantidadePeladas, setQuantidadePeladas] = useState('');
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
  
  // Estados para edição de gols e assistências
  const [mostrarModalGerenciarTime, setMostrarModalGerenciarTime] = useState(false);
  const [jogoParaEditar, setJogoParaEditar] = useState<Jogo | null>(null);
  const [timeParaGerenciar, setTimeParaGerenciar] = useState<'A' | 'B'>('A');

  // Estados para eventos colapsáveis e modal de edição de eventos
  const [eventosAbertos, setEventosAbertos] = useState<Set<string>>(new Set());
  const [mostrarModalEditarEventos, setMostrarModalEditarEventos] = useState(false);
  const [jogoEditarEventos, setJogoEditarEventos] = useState<Jogo | null>(null);
  const [eventosEditaveis, setEventosEditaveis] = useState<EventoEditavel[]>([]);
  const [eventosExcluidos, setEventosExcluidos] = useState<string[]>([]);
  // Senha antes de abrir editor de eventos
  const [mostrarSenhaEventos, setMostrarSenhaEventos] = useState(false);
  const [senhaEventos, setSenhaEventos] = useState('');
  const [erroSenhaEventos, setErroSenhaEventos] = useState('');
  const [jogoSenhaEventosPendente, setJogoSenhaEventosPendente] = useState<Jogo | null>(null);
  
  // Estados para alterações pendentes (antes de salvar)
  const [alteracoesPendentes, setAlteracoesPendentes] = useState<{
    golsAdicionar: { jogadorId: string; time: 'A' | 'B' }[];
    golsRemover: { jogadorId: string; time: 'A' | 'B' }[];
    assistsAdicionar: { jogadorId: string; time: 'A' | 'B' }[];
    assistsRemover: { jogadorId: string; time: 'A' | 'B' }[];
  }>({ golsAdicionar: [], golsRemover: [], assistsAdicionar: [], assistsRemover: [] });

  const normalizarNomeCor = (cor?: string | null): string | null => {
    if (!cor) return null;
    const hexMap: Record<string, string> = {
      '#dc3545': 'Vermelho',
      '#000000': 'Preto',
      '#ffffff': 'Branco',
      '#FFFFFF': 'Branco',
      '#fbbf24': 'Amarelo',
      '#3b82f6': 'Azul',
      '#10b981': 'Verde',
      '#f97316': 'Laranja',
      '#ec4899': 'Rosa',
      '#8b5cf6': 'Roxo',
      '#6b7280': 'Cinza',
    };
    const hex = String(cor).trim();
    if (hexMap[hex]) return hexMap[hex];
    if (hexMap[hex.toLowerCase()]) return hexMap[hex.toLowerCase()];
    // fallback: se já for nome de cor, capitalizar
    const nome = hex.toLowerCase();
    if (!nome || nome.startsWith('#')) return null;
    return nome.charAt(0).toUpperCase() + nome.slice(1);
  };

  const getNomeTime = (cor?: string | null, fallback?: string): string => {
    const nomeCor = normalizarNomeCor(cor);
    return nomeCor ? `Time ${nomeCor}` : (fallback || 'Time');
  };

  const getEstiloTime = (
    cor: string | null | undefined,
    lado: 'A' | 'B'
  ): {
    container: string;
    titulo: string;
    botao: string;
    botaoHover: string;
    canvasBg: string;
    canvasText: string;
  } => {
    const corNormalizada = (cor || '').trim().toLowerCase();

    const estilosPorCor: {
      [key: string]: {
        container: string;
        titulo: string;
        botao: string;
        botaoHover: string;
        canvasBg: string;
        canvasText: string;
      };
    } = {
      preto: {
        container: 'bg-slate-100 border-slate-300',
        titulo: 'text-slate-900',
        botao: 'bg-slate-700',
        botaoHover: 'hover:bg-slate-800',
        canvasBg: '#e5e7eb',
        canvasText: '#111827',
      },
      vermelho: {
        container: 'bg-red-50 border-red-200',
        titulo: 'text-red-700',
        botao: 'bg-red-600',
        botaoHover: 'hover:bg-red-700',
        canvasBg: '#fee2e2',
        canvasText: '#b91c1c',
      },
      azul: {
        container: 'bg-blue-50 border-blue-200',
        titulo: 'text-blue-700',
        botao: 'bg-blue-600',
        botaoHover: 'hover:bg-blue-700',
        canvasBg: '#dbeafe',
        canvasText: '#1d4ed8',
      },
      amarelo: {
        container: 'bg-amber-50 border-amber-200',
        titulo: 'text-amber-700',
        botao: 'bg-amber-600',
        botaoHover: 'hover:bg-amber-700',
        canvasBg: '#fef3c7',
        canvasText: '#b45309',
      },
      branco: {
        container: 'bg-gray-50 border-gray-300',
        titulo: 'text-gray-700',
        botao: 'bg-gray-600',
        botaoHover: 'hover:bg-gray-700',
        canvasBg: '#f9fafb',
        canvasText: '#374151',
      },
      verde: {
        container: 'bg-green-50 border-green-200',
        titulo: 'text-green-700',
        botao: 'bg-green-600',
        botaoHover: 'hover:bg-green-700',
        canvasBg: '#dcfce7',
        canvasText: '#15803d',
      },
    };

    if (estilosPorCor[corNormalizada]) {
      return estilosPorCor[corNormalizada];
    }

    // Fallback: manter estilo atual para não bagunçar quando não houver cor.
    if (lado === 'A') {
      return {
        container: 'bg-green-50 border-green-200',
        titulo: 'text-green-700',
        botao: 'bg-green-600',
        botaoHover: 'hover:bg-green-700',
        canvasBg: '#dcfce7',
        canvasText: '#15803d',
      };
    }

    return {
      container: 'bg-gray-100 border-gray-300',
      titulo: 'text-gray-800',
      botao: 'bg-gray-600',
      botaoHover: 'hover:bg-gray-700',
      canvasBg: '#f3f4f6',
      canvasText: '#374151',
    };
  };

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
      alert(`🚫 Resultados não disponíveis no plano ${nomePlano}. Faça upgrade para Premium!`);
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
  }, [filtro, dataSelecionada, periodoSelecionado, quantidadePeladas, jogos]);

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

    // Gol contra
    if (idStr === 'gol_contra') return 'Gol Contra';

    const jogador = jogadores[idStr];
    
    if (jogador) {
      return jogador.apelido || jogador.nome;
    }
    
    // Fallback: retornar os primeiros 8 caracteres do ID
    if (DEBUG) console.log('⚠️ Jogador não encontrado:', jogadorId);
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
      const senhaValida = await validarSenhaPelada(senhaAdmin);

      if (senhaValida) {
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
      
      // Excluir gols e assistências da partida
      await supabase
        .from('gols')
        .delete()
        .eq('jogo_id', jogoId);
      
      await supabase
        .from('assistencias')
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

      // Excluir todos os gols e assistências das partidas filtradas
      await supabase
        .from('gols')
        .delete()
        .in('jogo_id', jogosIds);
      
      await supabase
        .from('assistencias')
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

  // Funções de edição de gols (agora apenas modificam estado local)
  const adicionarGol = (jogadorId: string, time: 'A' | 'B') => {
    setAlteracoesPendentes(prev => ({
      ...prev,
      golsAdicionar: [...prev.golsAdicionar, { jogadorId, time }]
    }));
  };

  const removerGol = (jogadorId: string, time: 'A' | 'B') => {
    setAlteracoesPendentes(prev => ({
      ...prev,
      golsRemover: [...prev.golsRemover, { jogadorId, time }]
    }));
  };

  // Funções de edição de assistências (agora apenas modificam estado local)
  const adicionarAssistencia = (jogadorId: string, time: 'A' | 'B') => {
    setAlteracoesPendentes(prev => ({
      ...prev,
      assistsAdicionar: [...prev.assistsAdicionar, { jogadorId, time }]
    }));
  };

  const removerAssistencia = (jogadorId: string, time: 'A' | 'B') => {
    setAlteracoesPendentes(prev => ({
      ...prev,
      assistsRemover: [...prev.assistsRemover, { jogadorId, time }]
    }));
  };

  // Função para salvar todas as alterações pendentes
  const salvarAlteracoes = async () => {
    if (!jogoParaEditar) return;
    
    try {
      const peladaId = buscar_pelada_id();
      if (!peladaId) return;
      
      const supabase = await getClienteSupabase(peladaId);
      let placarAtualizado = false;
      let novoPlacarA = jogoParaEditar.placar_a;
      let novoPlacarB = jogoParaEditar.placar_b;

      // Adicionar gols
      for (const { jogadorId, time } of alteracoesPendentes.golsAdicionar) {
        await supabase.from('gols').insert({
          jogo_id: jogoParaEditar.id,
          jogador_id: jogadorId,
          time: time,
        });
        
        if (time === 'A') novoPlacarA++;
        else novoPlacarB++;
        placarAtualizado = true;
      }

      // Remover gols
      for (const { jogadorId, time } of alteracoesPendentes.golsRemover) {
        const nomeJogador = buscarJogador(jogadorId);
        
        // Buscar gols pelo ID OU pelo nome
        const { data: golsExistentes } = await supabase
          .from('gols')
          .select('id, jogador_id')
          .eq('jogo_id', jogoParaEditar.id)
          .eq('time', time);

        // Filtrar gols que correspondem ao jogador (por ID ou nome)
        const golParaRemover = golsExistentes?.find(g => {
          const nomeGol = buscarJogador(g.jogador_id);
          return g.jogador_id === jogadorId || nomeGol === nomeJogador;
        });

        if (golParaRemover) {
          await supabase.from('gols').delete().eq('id', golParaRemover.id);
          
          if (time === 'A' && novoPlacarA > 0) novoPlacarA--;
          else if (time === 'B' && novoPlacarB > 0) novoPlacarB--;
          placarAtualizado = true;
        }
      }

      // Adicionar assistências
      for (const { jogadorId, time } of alteracoesPendentes.assistsAdicionar) {
        await supabase.from('assistencias').insert({
          jogo_id: jogoParaEditar.id,
          jogador_id: jogadorId,
          time: time,
        });
      }

      // Remover assistências
      for (const { jogadorId, time } of alteracoesPendentes.assistsRemover) {
        const nomeJogador = buscarJogador(jogadorId);
        
        // Buscar assists pelo ID OU pelo nome
        const { data: assistsExistentes } = await supabase
          .from('assistencias')
          .select('id, jogador_id')
          .eq('jogo_id', jogoParaEditar.id)
          .eq('time', time);

        // Filtrar assists que correspondem ao jogador (por ID ou nome)
        const assistParaRemover = assistsExistentes?.find(a => {
          const nomeAssist = buscarJogador(a.jogador_id);
          return a.jogador_id === jogadorId || nomeAssist === nomeJogador;
        });

        if (assistParaRemover) {
          await supabase.from('assistencias').delete().eq('id', assistParaRemover.id);
        }
      }

      // Atualizar placar se houver mudanças
      if (placarAtualizado) {
        await supabase
          .from('jogos')
          .update({ placar_a: novoPlacarA, placar_b: novoPlacarB })
          .eq('id', jogoParaEditar.id);
      }

      // Limpar alterações pendentes
      setAlteracoesPendentes({ golsAdicionar: [], golsRemover: [], assistsAdicionar: [], assistsRemover: [] });
      
      // Recarregar dados
      await carregarDados();
      
      // Fechar modal
      setMostrarModalGerenciarTime(false);
      setJogoParaEditar(null);
    } catch (error) {
      console.error('Erro ao salvar alterações:', error);
      alert('Erro ao salvar alterações');
    }
  };

  // Função para cancelar e fechar modal
  const cancelarEdicao = () => {
    setAlteracoesPendentes({ golsAdicionar: [], golsRemover: [], assistsAdicionar: [], assistsRemover: [] });
    setMostrarModalGerenciarTime(false);
    setJogoParaEditar(null);
  };

  // Solicita senha antes de abrir editor de eventos
  const solicitarSenhaEventos = (jogo: Jogo) => {
    setJogoSenhaEventosPendente(jogo);
    setSenhaEventos('');
    setErroSenhaEventos('');
    setMostrarSenhaEventos(true);
  };

  const confirmarSenhaEventos = async () => {
    try {
      const valida = await validarSenhaPelada(senhaEventos);
      if (!valida) { setErroSenhaEventos('Senha incorreta'); return; }
      setMostrarSenhaEventos(false);
      setSenhaEventos('');
      setErroSenhaEventos('');
      if (jogoSenhaEventosPendente) abrirEditarEventos(jogoSenhaEventosPendente);
      setJogoSenhaEventosPendente(null);
    } catch {
      setErroSenhaEventos('Erro ao validar senha');
    }
  };

  // Abre modal de edição de eventos de uma partida
  const abrirEditarEventos = (jogo: Jogo) => {
    const assistsMap = new Map(
      (jogo.assistencias || []).filter(a => a.gol_id).map(a => [a.gol_id!, a])
    );
    const eventos: EventoEditavel[] = (jogo.gols || [])
      .filter(g => g.id)
      .map(g => {
        const assist = assistsMap.get(g.id!);
        return {
          golId: g.id!,
          jogadorGolId: g.jogador_id,
          timeGol: g.time,
          assistId: assist?.id,
          jogadorAssistId: assist?.jogador_id ?? '',
          timeAssist: assist?.time,
        };
      });
    setEventosEditaveis(eventos);
    setEventosExcluidos([]);
    setJogoEditarEventos(jogo);
    setMostrarModalEditarEventos(true);
  };

  // Salva alterações do modal de edição de eventos
  const salvarEditarEventos = async () => {
    if (!jogoEditarEventos) return;
    try {
      const peladaId = buscar_pelada_id();
      if (!peladaId) return;
      const supabase = await getClienteSupabase(peladaId);
      const golsOriginais = jogoEditarEventos.gols || [];
      const assistsOriginais = jogoEditarEventos.assistencias || [];
      let placarA = jogoEditarEventos.placar_a;
      let placarB = jogoEditarEventos.placar_b;
      let placarChanged = false;

      // Excluir eventos removidos pelo usuário
      for (const golIdExcluir of eventosExcluidos) {
        const golOriginal = golsOriginais.find(g => g.id === golIdExcluir);
        if (golOriginal) {
          // Deletar assist vinculada
          const assistVinculada = assistsOriginais.find(a => a.gol_id === golIdExcluir);
          if (assistVinculada?.id) {
            await supabase.from('assistencias').delete().eq('id', assistVinculada.id);
          }
          await supabase.from('gols').delete().eq('id', golIdExcluir);
          if (golOriginal.time === 'A' && placarA > 0) placarA--;
          else if (golOriginal.time === 'B' && placarB > 0) placarB--;
          placarChanged = true;
        }
      }

      // Inserir novos eventos
      for (const evento of eventosEditaveis.filter(e => e.isNew)) {
        const { data: golInserido } = await supabase.from('gols').insert({
          jogo_id: jogoEditarEventos.id,
          jogador_id: evento.jogadorGolId,
          time: evento.timeGol,
        }).select('id').single();
        if (evento.timeGol === 'A') placarA++; else placarB++;
        placarChanged = true;
        if (evento.jogadorAssistId && golInserido?.id) {
          await supabase.from('assistencias').insert({
            jogo_id: jogoEditarEventos.id,
            jogador_id: evento.jogadorAssistId,
            time: evento.timeAssist ?? evento.timeGol,
            gol_id: golInserido.id,
          });
        }
      }

      // Atualizar eventos existentes (não novos)
      for (const evento of eventosEditaveis.filter(e => !e.isNew)) {
        const golOriginal = golsOriginais.find(g => g.id === evento.golId);
        if (!golOriginal) continue;

        if (golOriginal.jogador_id !== evento.jogadorGolId || golOriginal.time !== evento.timeGol) {
          await supabase.from('gols').update({
            jogador_id: evento.jogadorGolId,
            time: evento.timeGol,
          }).eq('id', evento.golId);
          if (golOriginal.time !== evento.timeGol) {
            if (golOriginal.time === 'A') { placarA--; placarB++; }
            else { placarB--; placarA++; }
            placarChanged = true;
          }
        }

        const assistOriginal = assistsOriginais.find(a => a.id === evento.assistId);
        if (evento.jogadorAssistId && !assistOriginal) {
          await supabase.from('assistencias').insert({
            jogo_id: jogoEditarEventos.id,
            jogador_id: evento.jogadorAssistId,
            time: evento.timeAssist ?? evento.timeGol,
            gol_id: evento.golId,
          });
        } else if (!evento.jogadorAssistId && assistOriginal?.id) {
          await supabase.from('assistencias').delete().eq('id', assistOriginal.id);
        } else if (evento.jogadorAssistId && assistOriginal?.id &&
          (assistOriginal.jogador_id !== evento.jogadorAssistId || assistOriginal.time !== evento.timeAssist)) {
          await supabase.from('assistencias').update({
            jogador_id: evento.jogadorAssistId,
            time: evento.timeAssist ?? evento.timeGol,
          }).eq('id', assistOriginal.id);
        }
      }

      if (placarChanged) {
        await supabase.from('jogos').update({ placar_a: placarA, placar_b: placarB }).eq('id', jogoEditarEventos.id);
      }

      setMostrarModalEditarEventos(false);
      setJogoEditarEventos(null);
      setEventosExcluidos([]);
      await carregarDados();
    } catch (error) {
      console.error('Erro ao salvar eventos:', error);
      alert('Erro ao salvar eventos');
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
        const numeroPartida = (jogo as any).numero_jogo || index + 1;
        const estiloTimeA = getEstiloTime(jogo.cor_time_a, 'A');
        const estiloTimeB = getEstiloTime(jogo.cor_time_b, 'B');
        const nomeTimeA = getNomeTime(jogo.cor_time_a, 'Time 1');
        const nomeTimeB = getNomeTime(jogo.cor_time_b, 'Time 2');

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

        // Time A
        ctx.fillStyle = estiloTimeA.canvasBg;
        ctx.fillRect(40, yTime, 240, 30);
        ctx.fillStyle = estiloTimeA.canvasText;
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(nomeTimeA, 160, yTime + 20);

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

        // Time B
        ctx.fillStyle = estiloTimeB.canvasBg;
        ctx.fillRect(320, yTime, 240, 30);
        ctx.fillStyle = estiloTimeB.canvasText;
        ctx.font = 'bold 14px Arial';
        ctx.fillText(nomeTimeB, 440, yTime + 20);

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
      
      if (DEBUG) console.log('👥 Jogadores carregados:', jogadoresData?.length);
      if (DEBUG) console.log('📋 Amostra de jogadores:', jogadoresData?.slice(0, 3));
      
      if (jogadoresData) {
        const jogadoresMap: { [id: string]: Jogador } = {};
        jogadoresData.forEach(j => {
          jogadoresMap[j.id] = j;
          jogadoresMap[j.nome] = j; // Indexar também pelo nome para busca
        });
        setJogadores(jogadoresMap);
        if (DEBUG) console.log('📋 Map de jogadores:', Object.keys(jogadoresMap).length);
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

        // Associar gols, assistências e substituições aos jogos
        const jogosCompletos = jogosData.map(jogo => {
          // Parse de substituições - pode vir como string JSON, objeto ou array
          let subs: Substituicao[] = [];
          
          if (jogo.substituicoes) {
            if (typeof jogo.substituicoes === 'string') {
              try {
                subs = JSON.parse(jogo.substituicoes);
              } catch (e) {
                console.error('❌ Erro ao parsear substituições:', e);
              }
            } else if (Array.isArray(jogo.substituicoes)) {
              subs = jogo.substituicoes;
            }
          }
          
          if (DEBUG) console.log('🔍 DEBUG Jogo:', jogo.id.substring(0, 8), {
            substituicoesRaw: jogo.substituicoes,
            tipo: typeof jogo.substituicoes,
            substituicoesParsed: subs,
            quantidade: subs.length
          });
          
          return {
            ...jogo,
            gols: (golsData || []).filter(g => g.jogo_id === jogo.id),
            assistencias: (assistenciasData || []).filter(a => a.jogo_id === jogo.id),
            substituicoes: subs
          };
        });

        setJogos(jogosCompletos);
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
      
      // Extrair anos únicos
      const anos = [...new Set((jogosData || []).map(jogo => {
        const data = new Date(jogo.created_at);
        return data.getFullYear().toString();
      }))].sort().reverse();
      
      if (DEBUG) console.log('📅 Datas disponíveis:', datas);
      if (DEBUG) console.log('📅 Meses disponíveis:', meses);
      if (DEBUG) console.log('📅 Anos disponíveis:', anos);
      if (DEBUG) console.log('📊 Total de jogos:', jogosData?.length);
      setDatasDisponiveis(datas);
      setMesesDisponiveis(meses);
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

    // Ordenar por número de partida (crescente: Partida #1 primeiro)
    filtered.sort((a: any, b: any) => {
      const numA = a.numero_jogo ?? 0;
      const numB = b.numero_jogo ?? 0;
      if (numA !== numB) return numA - numB;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    setJogosFiltrados(filtered);

    // Calcular estatísticas
    const partidas = filtered.length;
    const gols = filtered.reduce((sum, jogo) => sum + jogo.placar_a + jogo.placar_b, 0);
    const assistencias = filtered.reduce((sum, jogo) => sum + (jogo.assistencias?.length || 0), 0);
    
    // Contar jogadores únicos
    const jogadoresUnicos = new Set<string>();
    filtered.forEach(jogo => {
      jogo.time_a.forEach(j => jogadoresUnicos.add(j));
      jogo.time_b.forEach(j => jogadoresUnicos.add(j));
    });

    setTotalPartidas(partidas);
    setTotalGols(gols);
    setTotalAssistencias(assistencias);
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
      <div className="max-w-2xl mx-auto px-2 py-3">
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
          <section className="space-y-6">
            {jogosFiltrados.map((jogo, index) => (
              <div key={jogo.id} className="pb-6 border-b-2 border-gray-300">
                {(() => {
                  const estiloTimeA = getEstiloTime(jogo.cor_time_a, 'A');
                  const estiloTimeB = getEstiloTime(jogo.cor_time_b, 'B');
                  const nomeTimeA = getNomeTime(jogo.cor_time_a, 'Time 1');
                  const nomeTimeB = getNomeTime(jogo.cor_time_b, 'Time 2');

                  return (
                    <>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-gray-500">
                    Partida #{(jogo as any).numero_jogo || index + 1}
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
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className={`${estiloTimeA.container} rounded-lg p-2 border`}>
                    <div className={`font-semibold ${estiloTimeA.titulo} mb-2 text-center flex items-center justify-center gap-2`}>
                      <span>{nomeTimeA}</span>
                      {modoAdmin && (
                        <button
                          onClick={() => {
                            setJogoParaEditar(jogo);
                            setTimeParaGerenciar('A');
                            setAlteracoesPendentes({ golsAdicionar: [], golsRemover: [], assistsAdicionar: [], assistsRemover: [] });
                            setMostrarModalGerenciarTime(true);
                          }}
                          className={`${estiloTimeA.botao} text-white px-2 py-0.5 rounded text-xs ${estiloTimeA.botaoHover}`}
                          title={`Gerenciar ${nomeTimeA}`}
                        >
                          ✏️
                        </button>
                      )}
                    </div>
                    {jogo.time_a.map((jogadorId, i) => {
                      // Obter nome do jogador para comparação
                      const nomeJogador = buscarJogador(jogadorId);
                      const golsJogador = (jogo.gols || []).filter(g => {
                        const nomeGol = buscarJogador(g.jogador_id);
                        return (g.jogador_id === jogadorId || nomeGol === nomeJogador) && g.time === 'A';
                      }).length;
                      const assistenciasJogador = (jogo.assistencias || []).filter(a => {
                        const nomeAssist = buscarJogador(a.jogador_id);
                        return (a.jogador_id === jogadorId || nomeAssist === nomeJogador) && a.time === 'A';
                      }).length;
                      // Buscar substituição por ID ou por nome
                      const substituicaoEntrada = (jogo.substituicoes || []).find(s => {
                        if (s.time !== 'A') return false;
                        // Comparar por ID direto
                        if (s.jogador_entrou_id === jogadorId) return true;
                        // Comparar por nome (caso time_a tenha nomes ao invés de IDs)
                        const nomeEntrou = buscarJogador(s.jogador_entrou_id);
                        return nomeEntrou === jogadorId || nomeEntrou === nomeJogador;
                      });
                      
                      if (substituicaoEntrada) {
                        // Calcular estatísticas do jogador que saiu
                        const nomeSaiu = buscarJogador(substituicaoEntrada.jogador_saiu_id);
                        const golsSaiu = (jogo.gols || []).filter(g => {
                          const nomeGol = buscarJogador(g.jogador_id);
                          return (g.jogador_id === substituicaoEntrada.jogador_saiu_id || nomeGol === nomeSaiu) && g.time === 'A';
                        }).length;
                        const assistsSaiu = (jogo.assistencias || []).filter(a => {
                          const nomeAssist = buscarJogador(a.jogador_id);
                          return (a.jogador_id === substituicaoEntrada.jogador_saiu_id || nomeAssist === nomeSaiu) && a.time === 'A';
                        }).length;
                        
                        return (
                          <div key={i} className="text-gray-700 text-sm">
                            {/* Jogador que saiu */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: '1px', alignItems: 'center', padding: '1px 0' }}>
                              <div className="text-red-600">↓</div>
                              <div className="text-left">{nomeSaiu}</div>
                              <div className="text-right">{assistsSaiu > 0 && golsSaiu > 0 ? `${assistsSaiu}👟` : ''}</div>
                              <div className="text-right" style={{ minWidth: '30px' }}>
                                {golsSaiu > 0 ? `${golsSaiu}⚽` : (assistsSaiu > 0 ? `${assistsSaiu}👟` : '')}
                              </div>
                            </div>
                            {/* Jogador que entrou */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: '1px', alignItems: 'center', padding: '1px 0' }}>
                              <div className="text-green-600">↑</div>
                              <div className="text-left">{nomeJogador}</div>
                              <div className="text-right">{assistenciasJogador > 0 && golsJogador > 0 ? `${assistenciasJogador}👟` : ''}</div>
                              <div className="text-right" style={{ minWidth: '30px' }}>
                                {golsJogador > 0 ? `${golsJogador}⚽` : (assistenciasJogador > 0 ? `${assistenciasJogador}👟` : '')}
                              </div>
                            </div>
                          </div>
                        );
                      }
                      
                      // Jogador normal (sem substituição)
                      return (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: '1px', alignItems: 'center', padding: '1px 0' }} className="text-gray-700 text-sm">
                          <div></div>
                          <div className="text-left">{nomeJogador}</div>
                          <div className="text-right">{assistenciasJogador > 0 && golsJogador > 0 ? `${assistenciasJogador}👟` : ''}</div>
                          <div className="text-right" style={{ minWidth: '30px' }}>
                            {golsJogador > 0 ? `${golsJogador}⚽` : (assistenciasJogador > 0 ? `${assistenciasJogador}👟` : '')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className={`${estiloTimeB.container} rounded-lg p-2 border`}>
                    <div className={`font-semibold ${estiloTimeB.titulo} mb-2 text-center flex items-center justify-center gap-2`}>
                      <span>{nomeTimeB}</span>
                      {modoAdmin && (
                        <button
                          onClick={() => {
                            setJogoParaEditar(jogo);
                            setTimeParaGerenciar('B');
                            setAlteracoesPendentes({ golsAdicionar: [], golsRemover: [], assistsAdicionar: [], assistsRemover: [] });
                            setMostrarModalGerenciarTime(true);
                          }}
                          className={`${estiloTimeB.botao} text-white px-2 py-0.5 rounded text-xs ${estiloTimeB.botaoHover}`}
                          title={`Gerenciar ${nomeTimeB}`}
                        >
                          ✏️
                        </button>
                      )}
                    </div>
                    {jogo.time_b.map((jogadorId, i) => {
                      // Obter nome do jogador para comparação
                      const nomeJogador = buscarJogador(jogadorId);
                      const golsJogador = (jogo.gols || []).filter(g => {
                        const nomeGol = buscarJogador(g.jogador_id);
                        return (g.jogador_id === jogadorId || nomeGol === nomeJogador) && g.time === 'B';
                      }).length;
                      const assistenciasJogador = (jogo.assistencias || []).filter(a => {
                        const nomeAssist = buscarJogador(a.jogador_id);
                        return (a.jogador_id === jogadorId || nomeAssist === nomeJogador) && a.time === 'B';
                      }).length;
                      // Buscar substituição por ID ou por nome
                      const substituicaoEntrada = (jogo.substituicoes || []).find(s => {
                        if (s.time !== 'B') return false;
                        // Comparar por ID direto
                        if (s.jogador_entrou_id === jogadorId) return true;
                        // Comparar por nome (caso time_b tenha nomes ao invés de IDs)
                        const nomeEntrou = buscarJogador(s.jogador_entrou_id);
                        return nomeEntrou === jogadorId || nomeEntrou === nomeJogador;
                      });
                      
                      if (substituicaoEntrada) {
                        // Calcular estatísticas do jogador que saiu
                        const nomeSaiu = buscarJogador(substituicaoEntrada.jogador_saiu_id);
                        const golsSaiu = (jogo.gols || []).filter(g => {
                          const nomeGol = buscarJogador(g.jogador_id);
                          return (g.jogador_id === substituicaoEntrada.jogador_saiu_id || nomeGol === nomeSaiu) && g.time === 'B';
                        }).length;
                        const assistsSaiu = (jogo.assistencias || []).filter(a => {
                          const nomeAssist = buscarJogador(a.jogador_id);
                          return (a.jogador_id === substituicaoEntrada.jogador_saiu_id || nomeAssist === nomeSaiu) && a.time === 'B';
                        }).length;
                        
                        return (
                          <div key={i} className="text-gray-700 text-sm">
                            {/* Jogador que saiu */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: '1px', alignItems: 'center', padding: '1px 0' }}>
                              <div className="text-red-600">↓</div>
                              <div className="text-left">{nomeSaiu}</div>
                              <div className="text-right">{assistsSaiu > 0 && golsSaiu > 0 ? `${assistsSaiu}👟` : ''}</div>
                              <div className="text-right" style={{ minWidth: '30px' }}>
                                {golsSaiu > 0 ? `${golsSaiu}⚽` : (assistsSaiu > 0 ? `${assistsSaiu}👟` : '')}
                              </div>
                            </div>
                            {/* Jogador que entrou */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: '1px', alignItems: 'center', padding: '1px 0' }}>
                              <div className="text-green-600">↑</div>
                              <div className="text-left">{nomeJogador}</div>
                              <div className="text-right">{assistenciasJogador > 0 && golsJogador > 0 ? `${assistenciasJogador}👟` : ''}</div>
                              <div className="text-right" style={{ minWidth: '30px' }}>
                                {golsJogador > 0 ? `${golsJogador}⚽` : (assistenciasJogador > 0 ? `${assistenciasJogador}👟` : '')}
                              </div>
                            </div>
                          </div>
                        );
                      }
                      
                      // Jogador normal (sem substituição)
                      return (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: '1px', alignItems: 'center', padding: '1px 0' }} className="text-gray-700 text-sm">
                          <div></div>
                          <div className="text-left">{nomeJogador}</div>
                          <div className="text-right">{assistenciasJogador > 0 && golsJogador > 0 ? `${assistenciasJogador}👟` : ''}</div>
                          <div className="text-right" style={{ minWidth: '30px' }}>
                            {golsJogador > 0 ? `${golsJogador}⚽` : (assistenciasJogador > 0 ? `${assistenciasJogador}👟` : '')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Eventos da partida */}
                {(jogo.gols || []).length > 0 && (() => {
                  const assistsMap = new Map(
                    (jogo.assistencias || []).filter(a => a.gol_id).map(a => [a.gol_id!, a])
                  );
                  const aberto = eventosAbertos.has(jogo.id);
                  const numeroPartida = (jogo as any).numero_jogo || index + 1;
                  return (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <button
                        onClick={() => setEventosAbertos(prev => {
                          const next = new Set(prev);
                          aberto ? next.delete(jogo.id) : next.add(jogo.id);
                          return next;
                        })}
                        className="flex items-center justify-between w-full"
                      >
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>
                          Eventos da Partida #{numeroPartida}
                        </span>
                        <span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 700 }}>{aberto ? '−' : '+'}</span>
                      </button>
                      {aberto && (
                        <>
                          <div className="mt-2">
                            {(jogo.gols || []).map((gol, i) => {
                              const assist = assistsMap.get(gol.id ?? '');
                              const estiloGol = gol.time === 'A' ? estiloTimeA : estiloTimeB;
                              const nomeTime = gol.time === 'A' ? nomeTimeA : nomeTimeB;
                              return (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: 13 }}>
                                  <span>⚽</span>
                                  <span style={{ fontWeight: 600, color: gol.jogador_id === 'gol_contra' ? '#ef4444' : '#1f2937' }}>{buscarJogador(gol.jogador_id)}</span>
                                  {assist && <span style={{ color: '#9ca3af' }}>👟 {buscarJogador(assist.jogador_id)}</span>}
                                  <span className={`ml-auto text-xs font-semibold px-1.5 py-0.5 rounded border ${estiloGol.container} ${estiloGol.titulo}`}>{nomeTime}</span>
                                </div>
                              );
                            })}
                          </div>
                          <button
                            onClick={() => solicitarSenhaEventos(jogo)}
                            className="mt-2 w-full text-center text-xs font-semibold text-indigo-600 hover:text-indigo-800 py-1.5 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                          >
                            ✏️ Editar Eventos
                          </button>
                        </>
                      )}
                    </div>
                  );
                })()}

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
                    </>
                  );
                })()}
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
                          <span className="text-xs font-bold text-gray-500">Partida #{(jogo as any).numero_jogo || index + 1}</span>
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
              <div className="bg-gradient-to-r from-green-500 to-green-600 p-4 flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">👟 Assistências do Dia</h3>
                <button onClick={() => setMostrarModalAssistencias(false)} className="text-white text-2xl hover:text-gray-200">✕</button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[60vh]">
                {(() => {
                  const assistenciasPorJogador: { [nome: string]: number } = {};
                  const todosJogadoresSet = new Set<string>();
                  
                  // Coletar todos os jogadores que participaram
                  jogosFiltrados.forEach(jogo => {
                    [...jogo.time_a, ...jogo.time_b].forEach(jogadorId => {
                      const nome = buscarJogador(jogadorId);
                      todosJogadoresSet.add(nome);
                      if (!assistenciasPorJogador[nome]) {
                        assistenciasPorJogador[nome] = 0;
                      }
                    });
                    
                    // Contar assistências
                    (jogo.assistencias || []).forEach(assist => {
                      const nome = buscarJogador(assist.jogador_id);
                      assistenciasPorJogador[nome] = (assistenciasPorJogador[nome] || 0) + 1;
                    });
                  });

                  // Separar quem deu assistência de quem não deu
                  const comAssistencias = Object.entries(assistenciasPorJogador).filter(([_, assists]) => assists > 0).sort((a, b) => b[1] - a[1]);
                  const semAssistencias = Object.entries(assistenciasPorJogador).filter(([_, assists]) => assists === 0).map(([nome]) => nome);

                  return (
                    <>
                      {comAssistencias.length > 0 ? (
                        <div className="space-y-2 mb-4">
                          {comAssistencias.map(([nome, assists], index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <span className="font-medium text-gray-800">{nome}</span>
                              <span className="text-green-600 font-bold text-lg">{assists} 👟</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500 mb-4">
                          <div className="text-4xl mb-2">👟</div>
                          <p>Nenhuma assistência no período</p>
                        </div>
                      )}
                      
                      {semAssistencias.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <p className="text-sm text-gray-600 text-center">
                            {semAssistencias.join(', ')} não {semAssistencias.length === 1 ? 'deu' : 'deram'} assistências
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

        {/* Modal Gerenciar Time */}
        {/* Modal Senha Editar Eventos */}
        {mostrarSenhaEventos && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
              <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 p-4">
                <h3 className="text-lg font-bold text-white">🔒 Confirmar identidade</h3>
                <p className="text-indigo-100 text-xs mt-0.5">Para editar eventos, confirme sua senha.</p>
              </div>
              <div className="p-5">
                <input
                  type="password"
                  value={senhaEventos}
                  onChange={(e) => { setSenhaEventos(e.target.value); setErroSenhaEventos(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && confirmarSenhaEventos()}
                  placeholder="Senha"
                  className="w-full p-3 border border-gray-300 rounded-lg mb-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  autoFocus
                />
                {erroSenhaEventos && <p className="text-red-600 text-xs mb-3">❌ {erroSenhaEventos}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setMostrarSenhaEventos(false); setJogoSenhaEventosPendente(null); setSenhaEventos(''); setErroSenhaEventos(''); }}
                    className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg text-sm font-semibold hover:bg-gray-600 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmarSenhaEventos}
                    className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Editar Eventos */}
        {mostrarModalEditarEventos && jogoEditarEventos && (() => {
          const nomeTimeAModal = getNomeTime(jogoEditarEventos.cor_time_a, 'Time 1');
          const nomeTimeBModal = getNomeTime(jogoEditarEventos.cor_time_b, 'Time 2');
          const numeroPartidaModal = jogosFiltrados.findIndex(j => j.id === jogoEditarEventos.id);
          const numPartidaLabel = numeroPartidaModal !== -1 ? jogosFiltrados.length - numeroPartidaModal : '';
          // Normaliza time_a/time_b: podem ser objetos {id,nome}, UUIDs ou nomes puros
          // Resolve para [{id, nome, timeLabel}] para uso nos selects
          const resolverJogadores = (arr: any[], timeLabel: string) =>
            (arr || []).map((j: any) => {
              if (typeof j === 'object' && j?.id) {
                return { id: String(j.id), nome: j.nome || buscarJogador(String(j.id)) };
              }
              const idStr = String(j);
              // Se parecer UUID, usa direto; senão busca por nome no mapa de jogadores
              const isUUID = /^[0-9a-f-]{36}$/i.test(idStr);
              if (isUUID) return { id: idStr, nome: buscarJogador(idStr) };
              // É um nome: procura o ID no mapa de jogadores
              const entry = Object.values(jogadores).find((jog: any) => jog.nome === idStr || jog.apelido === idStr);
              return { id: entry ? String((entry as any).id) : idStr, nome: idStr };
            });
          const jogadoresTimeA = resolverJogadores(jogoEditarEventos.time_a, nomeTimeAModal);
          const jogadoresTimeB = resolverJogadores(jogoEditarEventos.time_b, nomeTimeBModal);
          const timeAIds = jogadoresTimeA.map(j => j.id);
          const todosJogadoresModal = [...jogadoresTimeA, ...jogadoresTimeB];
          const primeiroDaTimeA = timeAIds[0] ?? '';
          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 p-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">✏️ Editar Eventos</h3>
                    <p className="text-white text-xs mt-0.5">Partida #{numPartidaLabel}</p>
                  </div>
                  <button onClick={() => { setMostrarModalEditarEventos(false); setJogoEditarEventos(null); setEventosExcluidos([]); }} className="text-white text-xl font-bold leading-none">✕</button>
                </div>
                <div className="p-3 overflow-y-auto max-h-[calc(90vh-140px)]">
                  {eventosEditaveis.length === 0 && eventosExcluidos.length === (jogoEditarEventos.gols || []).length ? (
                    <p className="text-gray-400 text-sm text-center py-4">Nenhum evento. Use o botão abaixo para adicionar.</p>
                  ) : (
                    <div className="space-y-3">
                      {eventosEditaveis.map((evento, i) => (
                        <div key={evento.golId} className={`border rounded-lg p-3 ${evento.isNew ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-gray-400 uppercase">{evento.isNew ? '+ Novo Gol' : `Gol ${i + 1}`}</span>
                            <button
                              onClick={() => {
                                if (!evento.isNew) setEventosExcluidos(prev => [...prev, evento.golId]);
                                setEventosEditaveis(prev => prev.filter((_, idx) => idx !== i));
                              }}
                              className="text-red-500 hover:text-red-700 text-xs font-semibold px-2 py-0.5 rounded border border-red-200 hover:bg-red-50 transition-colors"
                              title="Excluir este evento"
                            >
                              🗑️ Excluir
                            </button>
                          </div>
                          <div className="mb-2">
                            <label className="block text-xs font-semibold text-gray-600 mb-1">⚽ Artilheiro</label>
                            <select
                              value={evento.jogadorGolId}
                              onChange={(e) => {
                                const newId = e.target.value;
                                const newTime: 'A' | 'B' = timeAIds.includes(newId) ? 'A' : 'B';
                                setEventosEditaveis(prev => prev.map((ev, idx) =>
                                  idx === i ? { ...ev, jogadorGolId: newId, timeGol: newTime } : ev
                                ));
                              }}
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                            >
                              <option value="gol_contra" style={{ color: '#ef4444', fontWeight: 700 }}>⚠️ Gol Contra</option>
                              {todosJogadoresModal.map(j => (
                                <option key={j.id} value={j.id}>
                                  {j.nome} ({timeAIds.includes(j.id) ? nomeTimeAModal : nomeTimeBModal})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">👟 Assistência</label>
                            <select
                              value={evento.jogadorAssistId}
                              onChange={(e) => {
                                const newId = e.target.value;
                                const newTime: 'A' | 'B' | undefined = newId ? (timeAIds.includes(newId) ? 'A' : 'B') : undefined;
                                setEventosEditaveis(prev => prev.map((ev, idx) =>
                                  idx === i ? { ...ev, jogadorAssistId: newId, timeAssist: newTime } : ev
                                ));
                              }}
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                            >
                              <option value="">— Nenhum —</option>
                              {todosJogadoresModal.map(j => (
                                <option key={j.id} value={j.id}>
                                  {j.nome} ({timeAIds.includes(j.id) ? nomeTimeAModal : nomeTimeBModal})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Adicionar novo evento */}
                  <button
                    onClick={() => {
                      const novoId = `new_${Date.now()}`;
                      setEventosEditaveis(prev => [...prev, {
                        golId: novoId,
                        jogadorGolId: primeiroDaTimeA,
                        timeGol: 'A',
                        jogadorAssistId: '',
                        isNew: true,
                      }]);
                    }}
                    className="mt-4 w-full py-2 border-2 border-dashed border-indigo-300 rounded-lg text-indigo-600 text-sm font-semibold hover:bg-indigo-50 hover:border-indigo-400 transition-colors"
                  >
                    + Adicionar Gol/Evento
                  </button>
                </div>
                <div className="p-3 border-t border-gray-200 flex gap-2">
                  <button
                    onClick={salvarEditarEventos}
                    className="flex-1 bg-indigo-600 text-white py-2.5 px-4 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-md"
                  >
                    ✓ Salvar
                  </button>
                  <button
                    onClick={() => { setMostrarModalEditarEventos(false); setJogoEditarEventos(null); setEventosExcluidos([]); }}
                    className="flex-1 bg-gray-500 text-white py-2.5 px-4 rounded-lg text-sm font-semibold hover:bg-gray-600 transition-colors"
                  >
                    ✕ Cancelar
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {mostrarModalGerenciarTime && jogoParaEditar && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className={`bg-gradient-to-r p-3 ${timeParaGerenciar === 'A' ? 'from-green-500 to-green-600' : 'from-gray-500 to-gray-600'}`}>
                <h3 className="text-lg font-bold text-white">
                  ✏️ Gerenciar Time {timeParaGerenciar === 'A' ? '1' : '2'}
                </h3>
                <p className="text-white text-xs mt-0.5">
                  Placar: {timeParaGerenciar === 'A' ? jogoParaEditar.placar_a : jogoParaEditar.placar_b} gols
                </p>
              </div>
              <div className="p-3 overflow-y-auto max-h-[calc(90vh-120px)]">
                {/* Lista de jogadores */}
                <div className="space-y-2">
                  {(timeParaGerenciar === 'A' ? jogoParaEditar.time_a : jogoParaEditar.time_b).map((jogadorId) => {
                    const nomeJogador = buscarJogador(jogadorId);
                    
                    // Contar gols considerando ID OU nome (mesma lógica da exibição) + alterações pendentes
                    const golsDoJogadorBanco = (jogoParaEditar.gols || []).filter(g => {
                      const nomeGol = buscarJogador(g.jogador_id);
                      return (g.jogador_id === jogadorId || nomeGol === nomeJogador) && g.time === timeParaGerenciar;
                    }).length;
                    
                    const golsAdicionadosPendentes = alteracoesPendentes.golsAdicionar.filter(
                      g => g.jogadorId === jogadorId && g.time === timeParaGerenciar
                    ).length;
                    
                    const golsRemovidosPendentes = alteracoesPendentes.golsRemover.filter(
                      g => g.jogadorId === jogadorId && g.time === timeParaGerenciar
                    ).length;
                    
                    const golsDoJogador = golsDoJogadorBanco + golsAdicionadosPendentes - golsRemovidosPendentes;
                    
                    // Contar assistências considerando ID OU nome (mesma lógica da exibição) + alterações pendentes
                    const assistsDoJogadorBanco = (jogoParaEditar.assistencias || []).filter(a => {
                      const nomeAssist = buscarJogador(a.jogador_id);
                      return (a.jogador_id === jogadorId || nomeAssist === nomeJogador) && a.time === timeParaGerenciar;
                    }).length;
                    
                    const assistsAdicionadosPendentes = alteracoesPendentes.assistsAdicionar.filter(
                      a => a.jogadorId === jogadorId && a.time === timeParaGerenciar
                    ).length;
                    
                    const assistsRemovidosPendentes = alteracoesPendentes.assistsRemover.filter(
                      a => a.jogadorId === jogadorId && a.time === timeParaGerenciar
                    ).length;
                    
                    const assistsDoJogador = assistsDoJogadorBanco + assistsAdicionadosPendentes - assistsRemovidosPendentes;
                    
                    return (
                      <div key={jogadorId} className={`rounded-lg p-2.5 border ${timeParaGerenciar === 'A' ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-300'}`}>
                        {/* Nome do jogador */}
                        <div className="font-bold text-base text-gray-800 mb-2">{nomeJogador}</div>
                        
                        {/* Seção Gols */}
                        <div className="mb-2 pb-2 border-b border-gray-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600 text-sm">⚽ Gols:</span>
                              <span className="text-green-600 font-bold text-base">
                                {golsDoJogador}
                              </span>
                            </div>
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => adicionarGol(jogadorId, timeParaGerenciar)}
                                className="bg-green-600 text-white px-3 py-1 rounded text-xs font-semibold hover:bg-green-700 transition-colors"
                              >
                                + Gol
                              </button>
                              {golsDoJogador > 0 && (
                                <button
                                  onClick={() => removerGol(jogadorId, timeParaGerenciar)}
                                  className="bg-red-600 text-white px-3 py-1 rounded text-xs font-semibold hover:bg-red-700 transition-colors"
                                >
                                  - Gol
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Seção Assistências */}
                        <div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600 text-sm">👟 Assist:</span>
                              <span className="text-blue-600 font-bold text-base">
                                {assistsDoJogador}
                              </span>
                            </div>
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => adicionarAssistencia(jogadorId, timeParaGerenciar)}
                                className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-semibold hover:bg-blue-700 transition-colors"
                              >
                                + Assist
                              </button>
                              {assistsDoJogador > 0 && (
                                <button
                                  onClick={() => removerAssistencia(jogadorId, timeParaGerenciar)}
                                  className="bg-red-600 text-white px-3 py-1 rounded text-xs font-semibold hover:bg-red-700 transition-colors"
                                >
                                  - Assist
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="p-3 border-t border-gray-200">
                <div className="flex gap-2">
                  <button
                    onClick={salvarAlteracoes}
                    className="flex-1 bg-green-600 text-white py-2.5 px-4 rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors shadow-md"
                  >
                    ✓ Salvar Alterações
                  </button>
                  <button
                    onClick={cancelarEdicao}
                    className="flex-1 bg-gray-500 text-white py-2.5 px-4 rounded-lg text-sm font-semibold hover:bg-gray-600 transition-colors"
                  >
                    ✕ Cancelar
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
