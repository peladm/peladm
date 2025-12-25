'use client';

import React, { useState, useEffect } from 'react';
import { supabase, validarSenhaPelada } from '../../lib/supabase';

interface Jogador {
  id: string;
  nome: string;
  posicao?: string;
  status: string;
  pelada_id: string;
}

interface JogadorFila {
  id: string;
  nome: string;
  posicao_fila: number;
  status: 'fila' | 'reserva';
}

interface Regras {
  jogadores_por_time: number;
  vitorias_consecutivas?: number | null;
  prioridade_retorno?: string | null;
  regra_empate?: string | null;
  regra_apos_empate?: string | null;
  empate_conta_vitoria?: boolean;
}

export default function FilaPage() {
  const [filaCompleta, setFilaCompleta] = useState<JogadorFila[]>([]);
  const [jogadoresJogando, setJogadoresJogando] = useState<JogadorFila[]>([]);
  const [jogadoresFila, setJogadoresFila] = useState<JogadorFila[]>([]);
  const [jogadoresReserva, setJogadoresReserva] = useState<JogadorFila[]>([]);
  const [regras, setRegras] = useState<Regras>({ jogadores_por_time: 5 });
  const [totalPartidas, setTotalPartidas] = useState(0);
  const [totalGols, setTotalGols] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showManagementModal, setShowManagementModal] = useState(false);
  const [localJogadoresJogando, setLocalJogadoresJogando] = useState<JogadorFila[]>([]);
  const [localJogadoresFila, setLocalJogadoresFila] = useState<JogadorFila[]>([]);
  const [localJogadoresReserva, setLocalJogadoresReserva] = useState<JogadorFila[]>([]);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  
  // States para modal de cadastro de novo jogador
  const [showCadastroModal, setShowCadastroModal] = useState(false);
  const [novoJogadorNome, setNovoJogadorNome] = useState('');
  const [novoJogadorEstrelas, setNovoJogadorEstrelas] = useState(3);

  // States para controle de long press no drag and drop
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [isDraggingEnabled, setIsDraggingEnabled] = useState(false);
  const [touchStartPos, setTouchStartPos] = useState({ x: 0, y: 0 });
  const [currentDragElement, setCurrentDragElement] = useState<HTMLElement | null>(null);
  
  // State para modal de confirmação de início de partida
  const [showConfirmarInicioModal, setShowConfirmarInicioModal] = useState(false);
  
  // States para modal de encerrar pelada
  const [showEncerrarModal, setShowEncerrarModal] = useState(false);
  const [showConfirmarSenhaModal, setShowConfirmarSenhaModal] = useState(false);
  const [senhaEncerramento, setSenhaEncerramento] = useState('');
  const [semSessaoAtiva, setSemSessaoAtiva] = useState(false);
  
  // States para desfazer última ação
  const [showDesfazerModal, setShowDesfazerModal] = useState(false);
  const [showDesfazerSenhaModal, setShowDesfazerSenhaModal] = useState(false);
  const [senhaDesfazer, setSenhaDesfazer] = useState('');

  // ===== STATES PARA FILA2 - CRONÔMETRO E RESULTADO =====
  const [tempo, setTempo] = useState(600); // 10 minutos padrão
  const [isRunning, setIsRunning] = useState(false);
  const [timestampInicio, setTimestampInicio] = useState<number | null>(null);
  const [duracaoPartida, setDuracaoPartida] = useState(10); // minutos
  
  // Modal de confirmação de resultado
  const [showModalResultado, setShowModalResultado] = useState(false);
  const [resultadoSelecionado, setResultadoSelecionado] = useState<'A' | 'B' | null>(null);
  
  // Estado para desempate (quando empate tem desempate no final)
  const [vencedorDesempate, setVencedorDesempate] = useState<'A' | 'B' | null>(null);
  
  // ID da sessão ativa
  const [sessaoId, setSessaoId] = useState<string>('');
  
  // Vitórias consecutivas atuais
  const [vitoriasConsecutivasAtual, setVitoriasConsecutivasAtual] = useState<number>(0);
  
  // Plano do usuário
  const [planoUsuario, setPlanoUsuario] = useState<string>('free');

  useEffect(() => {
    carregarDados();
    carregarCronometro();
    
    // Verificar se deve abrir o modal automaticamente
    const params = new URLSearchParams(window.location.search);
    if (params.get('abrir') === 'modal') {
      setShowManagementModal(true);
      // Limpar o parâmetro da URL
      window.history.replaceState({}, '', '/fila2');
    }
  }, []);

  // ===== CRONÔMETRO - CARREGAR DO LOCALSTORAGE =====
  const carregarCronometro = () => {
    const cronometroSalvo = localStorage.getItem('cronometro_fila2');
    if (cronometroSalvo) {
      const dados = JSON.parse(cronometroSalvo);
      setIsRunning(dados.isRunning);
      setTimestampInicio(dados.timestampInicio);
      setDuracaoPartida(dados.duracaoPartida);
      
      // Calcular tempo atual baseado no timestamp
      if (dados.isRunning && dados.timestampInicio) {
        const agora = Date.now();
        const tempoDecorrido = Math.floor((agora - dados.timestampInicio) / 1000);
        const tempoRestante = Math.max(0, (dados.duracaoPartida * 60) - tempoDecorrido);
        setTempo(tempoRestante);
      } else {
        setTempo(dados.tempo || dados.duracaoPartida * 60);
      }
    }
  };

  // ===== CRONÔMETRO - SALVAR NO LOCALSTORAGE =====
  useEffect(() => {
    const estadoCronometro = {
      tempo,
      isRunning,
      timestampInicio,
      duracaoPartida
    };
    localStorage.setItem('cronometro_fila2', JSON.stringify(estadoCronometro));
  }, [tempo, isRunning, timestampInicio, duracaoPartida]);

  // ===== CRONÔMETRO - CONTAGEM REGRESSIVA =====
  useEffect(() => {
    let intervalo: NodeJS.Timeout;
    
    if (isRunning && tempo > 0) {
      intervalo = setInterval(() => {
        setTempo(prev => {
          if (prev <= 1) {
            setIsRunning(false);
            // Tempo acabou - pode abrir modal automaticamente se quiser
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (intervalo) clearInterval(intervalo);
    };
  }, [isRunning, tempo]);

  // Bloquear/desbloquear scroll do body quando modal abre/fecha
  useEffect(() => {
    if (showManagementModal) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = 'auto';
      document.body.style.touchAction = 'auto';
    }
    
    return () => {
      // Cleanup: sempre restaurar scroll ao desmontar
      document.body.style.overflow = 'auto';
      document.body.style.touchAction = 'auto';
    };
  }, [showManagementModal]);

  const carregarDados = async () => {
    console.log('🔄 [FILA2] Carregando dados do Supabase...');
    try {
      setIsLoading(true);
      const userData = localStorage.getItem('user');
      if (!userData) {
        window.location.href = '/login';
        return;
      }
      
      const user = JSON.parse(userData);
      const peladaId = user.id;
      const planoUsuario = user.plano || 'free';
      
      // Carregar plano do usuário
      setPlanoUsuario(planoUsuario);
      console.log('💎 Plano do usuário:', planoUsuario);
      
      console.log('📋 Carregando fila do Supabase...');
      
      // 1. CARREGAR REGRAS
      const { data: regrasData } = await supabase
        .from('regras')
        .select('*')
        .eq('pelada_id', peladaId)
        .single();
      
      if (regrasData) {
        // VERIFICAR TIPO DE FILA E REDIRECIONAR SE NECESSÁRIO
        const tipoFila = regrasData.tipo_fila || 'fila2';
        
        // Regra 1: Se configurado para fila1 E usuário é Premium, redirecionar
        if (tipoFila === 'fila1' && planoUsuario === 'premium') {
          console.log('↪️ Configuração aponta para Fila1 (Premium). Redirecionando...');
          window.location.href = '/fila';
          return;
        }
        
        // Regra 2: Free/Gold sempre ficam no fila2 (já estão aqui, sem redirecionamento)
        console.log('✅ Permanecendo no Fila2');
      }
      
      if (regrasData) {
        setRegras({
          jogadores_por_time: regrasData.jogadores_por_time || 5,
          vitorias_consecutivas: regrasData.vitorias_consecutivas,
          prioridade_retorno: regrasData.prioridade_retorno,
          regra_empate: regrasData.regra_empate,
          regra_apos_empate: regrasData.regra_apos_empate,
          empate_conta_vitoria: regrasData.empate_conta_vitoria
        });
        console.log('🏆 Regras carregadas:', regrasData);
      }
      
      // 2. BUSCAR SESSÃO ATIVA
      console.log('🔍 Buscando sessão ativa...');
      const { data: sessoes, error: sessaoError } = await supabase
        .from('sessoes')
        .select('*')
        .eq('pelada_id', peladaId)
        .eq('status', 'ativa')
        .order('created_at', { ascending: false });
      
      if (sessaoError) {
        console.error('❌ Erro ao buscar sessão:', sessaoError);
        await carregarPorStatus(peladaId);
        return;
      }
      
      if (!sessoes || sessoes.length === 0) {
        console.log('❌ Nenhuma sessão ativa encontrada');
        setSemSessaoAtiva(true);
        setIsLoading(false);
        return;
      }
      
      const sessao = sessoes[0];
      console.log('✅ Sessão ativa encontrada:', sessao.id);
      setSessaoId(sessao.id);
      
      // 🔧 MIGRAÇÃO: Converter status 'jogando' antigo para 'fila'
      console.log('🔧 Migrando dados antigos...');
      await supabase
        .from('fila')
        .update({ status: 'fila' })
        .eq('pelada_id', peladaId)
        .eq('status', 'jogando');
      console.log('✅ Migração concluída: jogando → fila');
      
      // 3. CARREGAR DA TABELA FILA (sem JOIN - igual Pelada 3)
      const { data: filaData, error: filaError } = await supabase
        .from('fila')
        .select('*')
        .eq('pelada_id', peladaId)
        .eq('sessao_id', sessao.id)
        .order('posicao_fila');
      
      if (filaError) {
        console.error('💥 Erro ao carregar fila:', filaError);
        await carregarPorStatus(peladaId);
        return;
      }
      
      console.log('📊 Dados da fila carregados:', filaData);
      
      // 3. CARREGAR DADOS DOS JOGADORES SEPARADAMENTE
      const { data: todosJogadores, error: jogadoresError } = await supabase
        .from('jogadores')
        .select('*')
        .eq('pelada_id', peladaId);
      
      if (jogadoresError) {
        console.error('💥 Erro ao carregar jogadores:', jogadoresError);
        await carregarPorStatus(peladaId);
        return;
      }
      
      // 5. JOGADORES NA FILA (todos com status 'fila')
      const filaItems = (filaData || []).filter(item => item.status === 'fila');
      const todosJogadoresFila = filaItems.map(item => {
        const jogador = todosJogadores.find(j => j.id === item.jogador_id);
        return {
          id: item.jogador_id,
          nome: jogador?.nome || 'Desconhecido',
          posicao_fila: item.posicao_fila || 0,
          status: 'fila' as const
        };
      });
      
      // Separar jogadores que estão jogando (primeiras posições) dos que estão na fila
      const jogadoresJogando = todosJogadoresFila.filter((_, index) => index < regras.jogadores_por_time * 2);
      const jogadoresFila = todosJogadoresFila.filter((_, index) => index >= regras.jogadores_por_time * 2);
      
      setJogadoresJogando(jogadoresJogando);
      setJogadoresFila(jogadoresFila);
      
      // 5.5. SALVAR VITÓRIAS CONSECUTIVAS DO TIME 1
      if (filaData && filaData.length > 0) {
        const vitoriasTime1 = filaData[0]?.vitorias_consecutivas_time || 0;
        setVitoriasConsecutivasAtual(vitoriasTime1);
        console.log('🏆 Vitórias consecutivas do Time 1:', vitoriasTime1);
      }
      
      // 6. JOGADORES RESERVA (da tabela fila)
      const reservaItems = (filaData || []).filter(item => item.status === 'reserva');
      const jogadoresReserva = reservaItems.map(item => {
        const jogador = todosJogadores.find(j => j.id === item.jogador_id);
        return {
          id: item.jogador_id,
          nome: jogador?.nome || 'Desconhecido',
          posicao_fila: item.posicao_fila || 0,
          status: 'reserva' as const
        };
      });
      setJogadoresReserva(jogadoresReserva);
      
      // 7. CARREGAR ESTATÍSTICAS DO LOCALSTORAGE
      const stats = localStorage.getItem('peladaStats');
      if (stats) {
        const parsedStats = JSON.parse(stats);
        setTotalPartidas(parsedStats.partidas || 0);
        setTotalGols(parsedStats.gols || 0);
      }
      
      console.log(`✅ Fila carregada: ${jogadoresJogando.length} jogando, ${jogadoresFila.length} na fila, ${jogadoresReserva.length} reservas`);
      
    } catch (error) {
      console.error('💥 Erro geral ao carregar dados:', error);
      // Fallback final
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        await carregarPorStatus(user.id);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Função de fallback para carregar por status (método antigo)
  const carregarPorStatus = async (peladaId: string) => {
    console.log('🔄 Carregando por status (fallback)...');
    
    const { data: jogadoresData, error: jogadoresError } = await supabase
      .from('jogadores')
      .select('*')
      .eq('pelada_id', peladaId);
    
    if (jogadoresError) {
      console.error('💥 Erro no fallback:', jogadoresError);
      return;
    }
    
    const jogadores = jogadoresData || [];
    const jogando = jogadores.filter(j => j.status === 'jogando');
    const fila = jogadores.filter(j => j.status === 'fila');
    
    setJogadoresJogando(jogando);
    setJogadoresFila(fila);
    
    console.log(`📊 Fallback: ${jogando.length} jogando, ${fila.length} na fila`);
  };

  // ===== FUNÇÕES DO CRONÔMETRO =====
  const toggleCronometro = () => {
    if (!isRunning) {
      setIsRunning(true);
      setTimestampInicio(Date.now());
    } else {
      setIsRunning(false);
    }
  };

  const resetarCronometro = () => {
    setIsRunning(false);
    setTempo(duracaoPartida * 60);
    setTimestampInicio(null);
  };

  const formatarTempo = (segundos: number) => {
    const mins = Math.floor(segundos / 60);
    const secs = segundos % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ===== FUNÇÕES AUXILIARES DE ROTAÇÃO =====
  
  // Função para embaralhar array
  const embaralharArray = (array: any[]) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // Buscar fila atual do Supabase
  const buscarFilaAtual = async () => {
    const { data, error } = await supabase
      .from('fila')
      .select('*')
      .eq('sessao_id', sessaoId)
      .eq('status', 'fila')
      .order('posicao_fila', { ascending: true });

    if (error) throw error;
    return data || [];
  };

  // Atualizar posições na fila
  const atualizarPosicoesFila = async (novaFila: any[], vitoriasNovoTime1: number = 0) => {
    const jogadoresPorTime = regras.jogadores_por_time;
    for (let i = 0; i < novaFila.length; i++) {
      await supabase
        .from('fila')
        .update({ 
          posicao_fila: i + 1,
          vitorias_consecutivas_time: (i < jogadoresPorTime) ? vitoriasNovoTime1 : 0
        })
        .eq('jogador_id', novaFila[i].jogador_id)
        .eq('sessao_id', sessaoId);
    }
  };

  // Obter vitórias consecutivas atuais do Time 1
  const getVitoriasConsecutivas = async () => {
    const fila = await buscarFilaAtual();
    if (fila.length === 0) return 0;
    return fila[0]?.vitorias_consecutivas_time || 0;
  };

  // Resetar todas vitórias da fila
  const resetarTodasVitorias = async () => {
    await supabase
      .from('fila')
      .update({ vitorias_consecutivas_time: 0 })
      .eq('sessao_id', sessaoId);
  };

  // ROTAÇÃO: Time 1 vence (continua)
  const rotacionarTime1Vence = async (novasVitorias: number) => {
    const fila = await buscarFilaAtual();
    const jogadoresPorTime = regras.jogadores_por_time;

    const time1 = fila.slice(0, jogadoresPorTime);
    const time2 = fila.slice(jogadoresPorTime, jogadoresPorTime * 2);
    const espera = fila.slice(jogadoresPorTime * 2);

    const proximoTime = espera.slice(0, jogadoresPorTime);
    const restoEspera = espera.slice(jogadoresPorTime);

    const novaFila = [...time1, ...proximoTime, ...restoEspera, ...time2];
    await atualizarPosicoesFila(novaFila, novasVitorias);
  };

  // ROTAÇÃO: Time 2 vence (vira novo Time 1)
  const rotacionarTime2Vence = async () => {
    const fila = await buscarFilaAtual();
    const jogadoresPorTime = regras.jogadores_por_time;

    const time1 = fila.slice(0, jogadoresPorTime);
    const time2 = fila.slice(jogadoresPorTime, jogadoresPorTime * 2);
    const espera = fila.slice(jogadoresPorTime * 2);

    const proximoTime = espera.slice(0, jogadoresPorTime);
    const restoEspera = espera.slice(jogadoresPorTime);

    const novaFila = [...time2, ...proximoTime, ...restoEspera, ...time1];
    await atualizarPosicoesFila(novaFila, 1); // Novo Time 1 começa com 1 vitória
  };

  // ROTAÇÃO: Ambos saem - Vencedor retorna antes
  const rotacionarVencedorAntes = async (timeVencedor: 'A' | 'B') => {
    const fila = await buscarFilaAtual();
    const jogadoresPorTime = regras.jogadores_por_time;

    const time1 = fila.slice(0, jogadoresPorTime);
    const time2 = fila.slice(jogadoresPorTime, jogadoresPorTime * 2);
    const espera = fila.slice(jogadoresPorTime * 2);

    const proximoTime1 = espera.slice(0, jogadoresPorTime);
    const proximoTime2 = espera.slice(jogadoresPorTime, jogadoresPorTime * 2);
    const restoEspera = espera.slice(jogadoresPorTime * 2);

    let novaFila;
    if (timeVencedor === 'A') {
      novaFila = [...proximoTime1, ...proximoTime2, ...restoEspera, ...time1, ...time2];
    } else {
      novaFila = [...proximoTime1, ...proximoTime2, ...restoEspera, ...time2, ...time1];
    }

    await atualizarPosicoesFila(novaFila, 0);
  };

  // ROTAÇÃO: Ambos saem - Perdedor retorna antes
  const rotacionarPerdedorAntes = async (timePerdedor: 'A' | 'B') => {
    const fila = await buscarFilaAtual();
    const jogadoresPorTime = regras.jogadores_por_time;

    const time1 = fila.slice(0, jogadoresPorTime);
    const time2 = fila.slice(jogadoresPorTime, jogadoresPorTime * 2);
    const espera = fila.slice(jogadoresPorTime * 2);

    const proximoTime1 = espera.slice(0, jogadoresPorTime);
    const proximoTime2 = espera.slice(jogadoresPorTime, jogadoresPorTime * 2);
    const restoEspera = espera.slice(jogadoresPorTime * 2);

    let novaFila;
    if (timePerdedor === 'A') {
      novaFila = [...proximoTime1, ...proximoTime2, ...restoEspera, ...time1, ...time2];
    } else {
      novaFila = [...proximoTime1, ...proximoTime2, ...restoEspera, ...time2, ...time1];
    }

    await atualizarPosicoesFila(novaFila, 0);
  };

  // ROTAÇÃO: Ambos saem - Mesclar times (embaralhar)
  const rotacionarMesclarTimes = async () => {
    const fila = await buscarFilaAtual();
    const jogadoresPorTime = regras.jogadores_por_time;

    const time1 = fila.slice(0, jogadoresPorTime);
    const time2 = fila.slice(jogadoresPorTime, jogadoresPorTime * 2);
    const espera = fila.slice(jogadoresPorTime * 2);

    const proximoTime1 = espera.slice(0, jogadoresPorTime);
    const proximoTime2 = espera.slice(jogadoresPorTime, jogadoresPorTime * 2);
    const restoEspera = espera.slice(jogadoresPorTime * 2);

    // Embaralhar os dois times juntos
    const timesEmbaralhados = embaralharArray([...time1, ...time2]);

    const novaFila = [...proximoTime1, ...proximoTime2, ...restoEspera, ...timesEmbaralhados];
    await atualizarPosicoesFila(novaFila, 0);
  };

  // ROTAÇÃO: Vencedor sai - Perdedor continua jogando (NOVA REGRA)
  const rotacionarPerdedorContinua = async (timePerdedor: 'A' | 'B') => {
    const fila = await buscarFilaAtual();
    const jogadoresPorTime = regras.jogadores_por_time;

    const time1 = fila.slice(0, jogadoresPorTime);
    const time2 = fila.slice(jogadoresPorTime, jogadoresPorTime * 2);
    const espera = fila.slice(jogadoresPorTime * 2);

    const proximoTime = espera.slice(0, jogadoresPorTime);
    const restoEspera = espera.slice(jogadoresPorTime);

    let novaFila;
    if (timePerdedor === 'A') {
      // Time A (perdedor) continua na posição 0
      // Time B (vencedor) vai para o final
      // Próximo time da espera entra na posição do Time 2
      novaFila = [...time1, ...proximoTime, ...restoEspera, ...time2];
    } else {
      // Time B (perdedor) continua na posição 1
      // Time A (vencedor) vai para o final
      // Próximo time da espera entra na posição do Time 1
      novaFila = [...proximoTime, ...time2, ...restoEspera, ...time1];
    }

    await atualizarPosicoesFila(novaFila, 0);
  };

  // ROTAÇÃO PRINCIPAL
  const rotacionarFila = async (timeVencedor: 'A' | 'B' | null, foiDesempate: boolean = false) => {
    try {
      const vitoriasAtuais = await getVitoriasConsecutivas();
      
      // Buscar pelada_id pela sessão ativa
      const { data: sessao } = await supabase
        .from('sessoes')
        .select('pelada_id')
        .eq('id', sessaoId)
        .single();
      
      const peladaId = sessao?.pelada_id;
      console.log('👤 Pelada ID da sessão:', peladaId);
      
      // Buscar regras
      const { data: regras } = await supabase
        .from('regras')
        .select('*')
        .eq('pelada_id', peladaId)
        .single();

      console.log('📋 Regras carregadas:', regras);
      console.log('🎯 vitorias_consecutivas da tabela:', regras?.vitorias_consecutivas);

      const limiteVitorias = (regras?.vitorias_consecutivas && regras.vitorias_consecutivas > 0) ? regras.vitorias_consecutivas : null;
      const regraAposLimite = regras?.prioridade_retorno || 'prioridade';
      const empateContaVitoria = regras?.empate_conta_vitoria || false;
      
      console.log('� DEBUG - regras completas:', regras);
      console.log('🔍 DEBUG - prioridade_retorno:', regras?.prioridade_retorno);
      console.log('�🔄 Regra após limite:', regraAposLimite);

      // === CENÁRIO: EMPATE ===
      if (timeVencedor === null && !foiDesempate) {
        // Verifica se empate conta como vitória (só se tiver desempate e vitórias consecutivas ativas)
        if (limiteVitorias && empateContaVitoria && regras?.regra_empate === 'desempate') {
          console.log('⚖️ Empate conta como vitória - incrementando contador para Time 1');
          // Incrementa vitórias do Time 1 (que está em quadra) porque empate conta como vitória
          const novasVitoriasEmpate = vitoriasAtuais + 1;
          await rotacionarTime1Vence(novasVitoriasEmpate);
          console.log(`✅ Contador atualizado: ${vitoriasAtuais} → ${novasVitoriasEmpate}. Aguardando resolução do desempate...`);
          // NÃO retorna aqui! Continua para mostrar modal de desempate
        } else {
          console.log('⚖️ Empate reseta vitórias consecutivas');
          await resetarTodasVitorias();
          // Rotaciona conforme regra de empate
          await rotacionarMesclarTimes();
          return;
        }
      }

      // === CENÁRIO: TIME 2 VENCE ===
      if (timeVencedor === 'B') {
        await resetarTodasVitorias();
        await rotacionarTime2Vence();
        return;
      }

      // === CENÁRIO: TIME 1 VENCE ===
      // Se foi desempate com empate_conta_vitoria, Time 1 já deve ter 1 vitória do empate
      // Não incrementa de novo nesse caso, apenas mantém o contador
      let novasVitorias: number;
      
      if (foiDesempate && empateContaVitoria && limiteVitorias) {
        // Desempate com empate contando como vitória: Time 1 mantém vitórias atuais
        novasVitorias = vitoriasAtuais;
        console.log(`⚖️ Time 1 venceu DESEMPATE com empate contando como vitória! Mantendo vitórias: ${novasVitorias}`);
      } else {
        // Vitória normal: incrementa contador
        novasVitorias = vitoriasAtuais + 1;
        console.log(`⚽ Time 1 venceu! Vitórias: ${vitoriasAtuais} → ${novasVitorias}`);
      }
      
      console.log(`📊 Limite configurado: ${limiteVitorias}`);

      // Verifica se atingiu limite
      if (limiteVitorias && novasVitorias >= limiteVitorias) {
        console.log(`🚨 LIMITE ATINGIDO! Aplicando regra: ${regraAposLimite}`);
        await resetarTodasVitorias();
        
        if (regraAposLimite === 'prioridade') {
          console.log('🔄 Chamando rotacionarVencedorAntes(A)');
          await rotacionarVencedorAntes('A');
        } else if (regraAposLimite === 'sem_prioridade') {
          console.log('🔄 Chamando rotacionarPerdedorAntes(B)');
          await rotacionarPerdedorAntes('B');
        } else if (regraAposLimite === 'mesclar') {
          console.log('🔄 Chamando rotacionarMesclarTimes()');
          await rotacionarMesclarTimes();
        } else if (regraAposLimite === 'perdedor_continua') {
          console.log('🔄 Aplicando regra: PERDEDOR continua jogando');
          await rotacionarPerdedorContinua('B');
        }
      } else {
        console.log('✅ Limite não atingido - Time 1 continua');
        await rotacionarTime1Vence(novasVitorias);
      }

    } catch (error) {
      console.error('Erro ao rotacionar fila:', error);
      throw error;
    }
  };

  // ===== FUNÇÕES DE RESULTADO =====
  const abrirModalResultado = async (resultado: 'A' | 'B' | null) => {
    // Buscar vitórias consecutivas mais recentes
    const vitoriasAtuais = await getVitoriasConsecutivas();
    setVitoriasConsecutivasAtual(vitoriasAtuais);
    
    setResultadoSelecionado(resultado);
    setShowModalResultado(true);
    setIsRunning(false); // Pausa cronômetro
  };

  const confirmarResultado = async () => {
    try {
      console.log('🎯 Resultado confirmado:', resultadoSelecionado);
      
      // === 1. CRIAR SNAPSHOT ANTES DE QUALQUER ALTERAÇÃO ===
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        const peladaId = user.id;
        
        // Buscar sessão ativa
        const { data: sessao } = await supabase
          .from('sessoes')
          .select('id')
          .eq('pelada_id', peladaId)
          .eq('status', 'ativa')
          .single();
        
        if (sessao) {
          // Buscar estado ATUAL da fila
          const { data: filaAtual } = await supabase
            .from('fila')
            .select('*')
            .eq('pelada_id', peladaId)
            .eq('sessao_id', sessao.id)
            .order('posicao_fila', { ascending: true });
          
          if (filaAtual && filaAtual.length > 0) {
            console.log('📸 Salvando snapshot da fila antes de rotacionar...');
            
            // Deletar snapshot antigo
            await supabase
              .from('fila_snapshot')
              .delete()
              .eq('pelada_id', peladaId);
            
            // Criar novo snapshot
            await supabase
              .from('fila_snapshot')
              .insert({
                pelada_id: peladaId,
                snapshot_data: filaAtual
              });
            
            console.log('✅ Snapshot criado com sucesso!');
          }
        }
      }
      
      // Se for empate com desempate, usar o vencedor do desempate
      let resultadoFinal = resultadoSelecionado;
      let foiDesempate = false;
      
      if (resultadoSelecionado === null && regras.regra_empate === 'desempate' && vencedorDesempate) {
        resultadoFinal = vencedorDesempate;
        foiDesempate = true;
        console.log('⚽ Desempate: Time', vencedorDesempate, 'venceu');
      }
      
      // === 2. CHAMA A ROTAÇÃO DA FILA ===
      await rotacionarFila(resultadoFinal, foiDesempate);
      
      // Atualiza a interface
      await carregarDados();
      
      // Fecha modal e reseta cronômetro
      setShowModalResultado(false);
      setVencedorDesempate(null);
      resetarCronometro();
      
      console.log('✅ Fila rotacionada com sucesso!');
      
    } catch (error) {
      console.error('❌ Erro ao registrar resultado:', error);
      alert('Erro ao registrar resultado. Tente novamente.');
    }
  };

  const cancelarResultado = () => {
    setShowModalResultado(false);
    setResultadoSelecionado(null);
    setVencedorDesempate(null);
  };

  const iniciarPartida = () => {
    const minimosJogadores = regras.jogadores_por_time * 2;
    const totalAtivos = jogadoresJogando.length + jogadoresFila.length;
    if (totalAtivos < minimosJogadores) {
      alert(`❌ É necessário pelo menos ${minimosJogadores} jogadores para iniciar uma partida!`);
      return;
    }
    // Mostra modal de confirmação em vez de redirecionar diretamente
    setShowConfirmarInicioModal(true);
  };

  const abrirModalEncerrar = async () => {
    try {
      const userData = localStorage.getItem('user');
      if (!userData) {
        console.error('❌ Usuário não encontrado');
        return;
      }

      const user = JSON.parse(userData);
      const peladaId = user.id;

      // Buscar sessão ativa
      const { data: sessao, error: sessaoError } = await supabase
        .from('sessoes')
        .select('id')
        .eq('pelada_id', peladaId)
        .eq('status', 'ativa')
        .single();

      if (sessaoError || !sessao) {
        console.error('❌ Sessão ativa não encontrada');
        setShowEncerrarModal(true);
        return;
      }

      // Apenas abrir modal de confirmação
      setShowEncerrarModal(true);
    } catch (error) {
      console.error('❌ Erro ao carregar estatísticas:', error);
      setShowEncerrarModal(true);
    }
  };

  const confirmarEncerramento = async () => {
    setShowEncerrarModal(false);
    setShowConfirmarSenhaModal(true);
  };

  const abrirModalDesfazer = async () => {
    try {
      const userData = localStorage.getItem('user');
      if (!userData) {
        alert('❌ Usuário não encontrado!');
        return;
      }

      const user = JSON.parse(userData);
      const peladaId = user.id;

      // Verificar se a tabela fila_snapshot existe antes de prosseguir
      try {
        const testQuery = await supabase
          .from('fila_snapshot')
          .select('id')
          .limit(0);
        
        if (testQuery.error) {
          throw testQuery.error;
        }
      } catch (testError: any) {
        if (testError.code === '42P01' || testError.message?.includes('does not exist')) {
          alert('❌ A funcionalidade de desfazer ainda não está configurada.\n\nExecute este SQL no Supabase:\n\nCREATE TABLE fila_snapshot (\n  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),\n  pelada_id TEXT NOT NULL,\n  snapshot_data JSONB NOT NULL,\n  created_at TIMESTAMP DEFAULT NOW()\n);');
          return;
        }
      }

      // Buscar sessão ativa
      const { data: sessao, error: sessaoError } = await supabase
        .from('sessoes')
        .select('id')
        .eq('pelada_id', peladaId)
        .eq('status', 'ativa')
        .single();

      if (sessaoError || !sessao) {
        alert('❌ Nenhuma sessão ativa encontrada!');
        return;
      }

      // Verificar se existe snapshot (busca mais recente por timestamp)
      const { data: snapshot, error: snapshotError } = await supabase
        .from('fila_snapshot')
        .select('*')
        .eq('pelada_id', peladaId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (snapshotError || !snapshot) {
        alert('❌ Não há snapshot salvo para desfazer.\n\nEsta funcionalidade só funciona após confirmar pelo menos um resultado.');
        return;
      }

      // Verificar se snapshot tem dados válidos
      if (!snapshot.snapshot_data || snapshot.snapshot_data.length === 0) {
        alert('❌ O snapshot está vazio! Não é possível desfazer.');
        return;
      }

      // Não precisa de ultimaPartida, apenas mostrar modal
      setShowDesfazerModal(true);

    } catch (error: any) {
      console.error('❌ Erro ao buscar última partida:', error);
      alert(`❌ Erro ao buscar última partida: ${error.message || 'Erro desconhecido'}`);
    }
  };

  const confirmarDesfazer = () => {
    setShowDesfazerModal(false);
    setShowDesfazerSenhaModal(true);
  };

  const desfazerUltimaPartida = async () => {
    try {
      const userData = localStorage.getItem('user');
      if (!userData) {
        alert('❌ Usuário não encontrado!');
        return;
      }

      const user = JSON.parse(userData);
      const peladaId = user.id;

      // Validar senha
      const senhaValida = await validarSenhaPelada(senhaDesfazer);
      if (!senhaValida) {
        alert('❌ Senha incorreta!');
        setSenhaDesfazer('');
        return;
      }

      console.log('🔄 Desfazendo última ação...');

      // 1. Buscar snapshot mais recente
      const { data: snapshot } = await supabase
        .from('fila_snapshot')
        .select('*')
        .eq('pelada_id', peladaId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!snapshot) {
        alert('❌ Snapshot não encontrado!');
        return;
      }

      // 2. Buscar sessão ativa
      const { data: sessao } = await supabase
        .from('sessoes')
        .select('id')
        .eq('pelada_id', peladaId)
        .eq('status', 'ativa')
        .single();

      if (!sessao) {
        alert('❌ Sessão ativa não encontrada!');
        return;
      }

      // 3. Validar snapshot antes de restaurar
      if (!snapshot.snapshot_data || snapshot.snapshot_data.length === 0) {
        alert('❌ O snapshot está vazio! Não é possível desfazer.');
        return;
      }

      console.log('📊 Restaurando fila com snapshot:', snapshot.snapshot_data);

      // 4. Deletar todos os registros atuais da fila
      await supabase
        .from('fila')
        .delete()
        .eq('pelada_id', peladaId)
        .eq('sessao_id', sessao.id);

      // 5. Restaurar fila do snapshot
      const filaRestaurada = snapshot.snapshot_data.map((item: any) => {
        const { id, created_at, updated_at, ...resto } = item;
        return resto;
      });

      console.log('🔄 Dados a serem restaurados:', filaRestaurada);

      const { error: insertError } = await supabase
        .from('fila')
        .insert(filaRestaurada);
      
      if (insertError) {
        console.error('❌ Erro ao restaurar fila:', insertError);
        alert('❌ Erro ao restaurar a fila. Por favor, recarregue a página e organize manualmente.');
        return;
      }

      // 6. Deletar o snapshot usado (não permite desfazer múltiplas vezes)
      await supabase
        .from('fila_snapshot')
        .delete()
        .eq('id', snapshot.id);
      
      console.log('🗑️ Snapshot deletado após restauração');

      setShowDesfazerSenhaModal(false);
      setSenhaDesfazer('');

      alert('✅ Última ação desfeita com sucesso! A fila foi restaurada.');

      // Recarregar página
      window.location.reload();

    } catch (error) {
      console.error('❌ Erro ao desfazer partida:', error);
      alert('❌ Erro ao desfazer partida. Tente novamente.');
    }
  };

  const finalizarPelada = async () => {
    try {
      const userData = localStorage.getItem('user');
      if (!userData) {
        alert('❌ Usuário não encontrado!');
        return;
      }
      
      const user = JSON.parse(userData);
      
      // Validar usando função centralizada (async)
      const senhaValida = await validarSenhaPelada(senhaEncerramento);
      if (!senhaValida) {
        alert('❌ Senha incorreta!');
        setSenhaEncerramento('');
        return;
      }
      
      const peladaId = user.id;
      
      // Buscar sessão ativa
      const { data: sessaoAtiva } = await supabase
        .from('sessoes')
        .select('*')
        .eq('pelada_id', peladaId)
        .eq('status', 'ativa')
        .single();
      
      if (!sessaoAtiva) {
        alert('❌ Nenhuma sessão ativa encontrada!');
        return;
      }
      
      // 1. Finalizar sessão
      await supabase
        .from('sessoes')
        .update({ status: 'finalizada' })
        .eq('id', sessaoAtiva.id);
      
      // 2. Limpar fila (deletar todos registros da sessão)
      await supabase
        .from('fila')
        .delete()
        .eq('sessao_id', sessaoAtiva.id);
      
      // 3. Limpar snapshot da fila (fim do dia)
      try {
        await supabase
          .from('fila_snapshot')
          .delete()
          .eq('pelada_id', peladaId);
        console.log('🗑️ Snapshot da fila limpo ao encerrar pelada');
      } catch (snapshotError) {
        console.warn('⚠️ Não foi possível limpar snapshot:', snapshotError);
      }
      
      // 4. Limpar localStorage
      localStorage.removeItem('partida_em_andamento');
      localStorage.removeItem('cronometro_partida');
      localStorage.removeItem('coresPartida');
      
      setShowConfirmarSenhaModal(false);
      setSenhaEncerramento('');
      
      alert('✅ Pelada encerrada com sucesso! Até a próxima! ⚽');
      
      // Redirecionar para home
      window.location.href = '/';
      
    } catch (error) {
      console.error('Erro ao encerrar pelada:', error);
      alert('❌ Erro ao encerrar pelada. Tente novamente.');
    }
  };

  const confirmarInicioPartida = async () => {
    setShowConfirmarInicioModal(false);
    
    try {
      console.log('🆕 Iniciando nova partida...');
      
      const userData = localStorage.getItem('user');
      if (!userData) {
        console.error('Usuário não encontrado');
        return;
      }
      
      const user = JSON.parse(userData);
      const peladaId = user.id;
      
      // 0. Salvar snapshot da fila ANTES de qualquer mudança
      const { data: sessaoAtiva, error: sessaoError } = await supabase
        .from('sessoes')
        .select('id')
        .eq('pelada_id', peladaId)
        .eq('status', 'ativa')
        .single();
      
      if (sessaoError) {
        console.error('❌ Erro ao buscar sessão ativa para snapshot:', sessaoError);
      } else if (sessaoAtiva) {
        console.log('📸 Salvando snapshot da fila...');
        try {
          // Buscar estado completo da fila
          const { data: snapshotFila, error: filaError } = await supabase
            .from('fila')
            .select('*')
            .eq('pelada_id', peladaId)
            .eq('sessao_id', sessaoAtiva.id);
          
          if (filaError) {
            console.error('❌ Erro ao buscar fila para snapshot:', filaError);
          } else {
            console.log('📊 Dados da fila para snapshot:', snapshotFila);
            
            // Limpar snapshot antigo
            const { error: deleteError } = await supabase
              .from('fila_snapshot')
              .delete()
              .eq('pelada_id', peladaId);
            
            if (deleteError) {
              console.warn('⚠️ Erro ao limpar snapshot antigo (pode não existir):', deleteError);
            }
            
            // Criar novo snapshot
            const { data: insertData, error: insertError } = await supabase
              .from('fila_snapshot')
              .insert({
                pelada_id: peladaId,
                snapshot_data: snapshotFila
              })
              .select();
            
            if (insertError) {
              console.error('❌ ERRO ao inserir snapshot:', insertError);
              console.error('Detalhes do erro:', JSON.stringify(insertError, null, 2));
            } else {
              console.log('✅ Snapshot da fila salvo com sucesso!', insertData);
            }
          }
        } catch (snapshotError: any) {
          console.error('❌ EXCEÇÃO ao salvar snapshot:', snapshotError);
          console.error('Mensagem:', snapshotError.message);
          console.error('Stack:', snapshotError.stack);
          // Continua a execução mesmo se falhar o snapshot
        }
      } else {
        console.warn('⚠️ Nenhuma sessão ativa encontrada para snapshot');
      }
      
      // 1. Carregar regras
      const { data: regrasData } = await supabase
        .from('regras')
        .select('*')
        .eq('pelada_id', peladaId)
        .single();
      
      console.log('📋 Regras completas do Supabase:', regrasData);
      
      const jogadoresPorTime = regrasData?.jogadores_por_time || 5;
      const duracaoMinutos = regrasData?.duracao || 10;
      
      // 2. Buscar sessão ativa
      const { data: sessoes } = await supabase
        .from('sessoes')
        .select('*')
        .eq('pelada_id', peladaId)
        .eq('status', 'ativa')
        .order('created_at', { ascending: false });
      
      if (!sessoes || sessoes.length === 0) {
        console.error('Nenhuma sessão ativa encontrada');
        alert('Nenhuma sessão ativa encontrada. Inicie uma sessão primeiro.');
        return;
      }
      
      const sessao = sessoes[0];
      
      // 3. Carregar fila
      const { data: filaData } = await supabase
        .from('fila')
        .select('*')
        .eq('pelada_id', peladaId)
        .eq('sessao_id', sessao.id)
        .eq('status', 'fila')
        .order('posicao_fila');
      
      if (!filaData || filaData.length === 0) {
        alert('Nenhum jogador na fila para iniciar partida.');
        return;
      }
      
      // 4. Carregar dados dos jogadores
      const { data: todosJogadores } = await supabase
        .from('jogadores')
        .select('*')
        .eq('pelada_id', peladaId);
      
      // 5. Montar lista de jogadores jogando (primeiros 2 * jogadoresPorTime)
      const totalJogando = jogadoresPorTime * 2;
      const jogadoresJogando = filaData.slice(0, totalJogando).map(item => {
        const jogador = todosJogadores?.find(j => j.id === item.jogador_id);
        return {
          id: item.jogador_id,
          nome: jogador?.nome || 'Desconhecido',
          apelido: jogador?.apelido,
          posicao: jogador?.posicao,
          status: 'jogando',
          pelada_id: peladaId
        };
      });
      
      // 6. Dividir em dois times
      const time1 = jogadoresJogando.slice(0, jogadoresPorTime);
      const time2 = jogadoresJogando.slice(jogadoresPorTime, totalJogando);
      
      // 6.5. Buscar vitórias consecutivas atuais do Time 1 (posição 1 da fila)
      const vitoriasConsecutivasAtual = filaData[0]?.vitorias_consecutivas_time || 0;
      console.log('🏆 Vitórias consecutivas do Time 1:', vitoriasConsecutivasAtual);
      
      // 7. Criar estado inicial da partida
      const agora = Date.now();
      const novoJogoId = `jogo_${agora}`;
      
      const estadoPartida = {
        jogoId: novoJogoId,
        sessaoId: sessao.id,
        tempo: duracaoMinutos * 60,
        isRunning: true,
        timestampInicio: agora,
        duracaoPartida: duracaoMinutos,
        timeA: {
          jogadores: time1,
          gols: 0,
          cor: '#000000',
          nome: 'PRETO'
        },
        timeB: {
          jogadores: time2,
          gols: 0,
          cor: '#16a34a',
          nome: 'VERDE'
        },
        historico: [],
        vitoriaConsecutiva: vitoriasConsecutivasAtual,
        regrasEmpate: {
          empate_modo: regrasData?.regra_empate || null,
          empate_retorno: regrasData?.regra_apos_empate || null,
          desempate_modo: regrasData?.regra_empate || null
        },
        mostrarTutorialCores: true,  // Ativar tutorial de cores
        tempoTutorial: 10,            // 10 segundos
        limiteVitorias: regrasData?.vitorias_consecutivas || null
      };
      
      console.log('🎯 Limite de vitórias das regras:', regrasData?.vitorias_consecutivas);
      console.log('📦 Estado da partida a ser salvo:', estadoPartida);
      
      // 8. Salvar no localStorage
      localStorage.setItem('partida_em_andamento', JSON.stringify(estadoPartida));
      
      console.log('✅ Partida criada e salva no localStorage');
      
      // 9. Redirecionar para partida
      window.location.href = '/partida';
      
    } catch (error) {
      console.error('Erro ao iniciar partida:', error);
      alert('Erro ao iniciar partida. Tente novamente.');
    }
  };

  const moverJogadorParaReserva = async (jogadorId: string) => {
    try {
      console.log('🏠 Movendo jogador para reserva (IMEDIATO NO SUPABASE):', jogadorId);
      const userData = localStorage.getItem('user');
      const user = JSON.parse(userData!);
      const peladaId = user.id;
      
      // 1. PRIMEIRO: Mudar o status do jogador para reserva IMEDIATAMENTE
      const { error: updateError } = await supabase
        .from('fila')
        .update({ 
          status: 'reserva',
          posicao_fila: 9999  // Usar valor alto para reservas (constraint NOT NULL)
        })
        .eq('jogador_id', jogadorId)
        .eq('pelada_id', peladaId);

      if (updateError) {
        console.error('❌ Erro ao mover para reserva:', updateError);
        return;
      }

      // 2. SEGUNDO: Buscar todos os jogadores ativos ordenados por posição
      const { data: jogadoresAtivos } = await supabase
        .from('fila')
        .select('*')
        .eq('pelada_id', peladaId)
        .eq('status', 'fila')
        .order('posicao_fila');
      
      // 3. TERCEIRO: Reposicionar todos sequencialmente (1, 2, 3...)
      if (jogadoresAtivos && jogadoresAtivos.length > 0) {
        const updates = jogadoresAtivos.map((jogador, index) => {
          const posicaoSequencial = index + 1;
          return supabase
            .from('fila')
            .update({ posicao_fila: posicaoSequencial })
            .eq('jogador_id', jogador.jogador_id)
            .eq('pelada_id', peladaId);
        });

        await Promise.all(updates);
        console.log('✅ Fila reordenada sequencialmente');
      }

      // 4. QUARTO: Recarregar dados para atualizar a interface
      await carregarDados();
      
      console.log('✅ Jogador movido para reserva e fila reorganizada!');
      
    } catch (error) {
      console.error('❌ Erro geral ao mover jogador:', error);
    }
  };

  const cadastrarNovoJogador = async () => {
    try {
      console.log('🆕 Cadastrando novo jogador:', novoJogadorNome);
      
      if (!novoJogadorNome.trim()) {
        alert('Digite o nome do jogador!');
        return;
      }

      const userData = localStorage.getItem('user');
      const user = JSON.parse(userData!);
      const peladaId = user.id;

      // 1. PRIMEIRO: Buscar sessão ativa (SEM .single() para evitar erro)
      console.log('🔍 Buscando sessão ativa...');
      const { data: sessoes, error: sessaoError } = await supabase
        .from('sessoes')
        .select('*')
        .eq('pelada_id', peladaId)
        .eq('status', 'ativa')
        .order('created_at', { ascending: false });

      if (sessaoError) {
        console.error('❌ Erro ao buscar sessão:', sessaoError);
        alert('❌ Erro ao buscar sessão ativa!');
        return;
      }

      if (!sessoes || sessoes.length === 0) {
        console.error('❌ Nenhuma sessão ativa encontrada');
        alert('❌ Nenhuma sessão ativa! Inicie uma pelada primeiro.');
        return;
      }

      const sessao = sessoes[0]; // Pega a mais recente
      console.log('✅ Usando sessão:', sessao.id);

      // 2. SEGUNDO: Cadastrar jogador na tabela jogadores
      const { data: novoJogador, error: jogadorError } = await supabase
        .from('jogadores')
        .insert({
          nome: novoJogadorNome.trim(),
          nivel: novoJogadorEstrelas,
          status: 'ativo',
          pelada_id: peladaId
        })
        .select()
        .single();

      if (jogadorError) {
        console.error('❌ Erro ao cadastrar jogador:', jogadorError);
        alert('Erro ao cadastrar jogador!');
        return;
      }

      // 3. TERCEIRO: Adicionar na fila como reserva (COM sessao_id)
      const { error: filaError } = await supabase
        .from('fila')
        .insert({
          jogador_id: novoJogador.id,
          pelada_id: peladaId,
          sessao_id: sessao.id,
          status: 'reserva',
          posicao_fila: 9999
        });

      if (filaError) {
        console.error('❌ Erro ao adicionar na fila:', filaError);
        alert('Jogador cadastrado mas erro ao adicionar na fila!');
        return;
      }

      // 4. QUARTO: Limpar form e fechar modal
      setNovoJogadorNome('');
      setNovoJogadorEstrelas(3);
      setShowCadastroModal(false);

      // 5. QUINTO: Recarregar dados para mostrar o novo jogador
      await carregarDados();
      
      console.log('✅ Novo jogador cadastrado e adicionado às reservas!');
      
    } catch (error) {
      console.error('❌ Erro geral ao cadastrar jogador:', error);
      alert('Erro inesperado!');
    }
  };

  const moverReservaParaFila = async (jogadorId: string) => {
    try {
      console.log('➕ Movendo reserva para fila:', jogadorId);
      const userData = localStorage.getItem('user');
      const user = JSON.parse(userData!);
      const peladaId = user.id;
      
      // 1. Contar quantos jogadores já estão na fila
      const { data: jogadoresNaFila } = await supabase
        .from('fila')
        .select('*')
        .eq('pelada_id', peladaId)
        .eq('status', 'fila')
        .order('posicao_fila');
      
      const proximaPosicao = (jogadoresNaFila?.length || 0) + 1;
      
      // 2. Adicionar jogador no final da fila
      await supabase
        .from('fila')
        .update({ 
          status: 'fila',
          posicao_fila: proximaPosicao
        })
        .eq('jogador_id', jogadorId)
        .eq('pelada_id', peladaId);
      
      console.log(`✅ Jogador adicionado na posição ${proximaPosicao}`);
      
      // 3. Recarregar dados
      await carregarDados();
    } catch (error) {
      console.error('❌ Erro ao mover para fila:', error);
    }
  };

  // Função para calcular cor do time baseado na posição (adaptável às regras)
  const getCorTime = (posicao: number) => {
    const timeIndex = Math.floor((posicao - 1) / regras.jogadores_por_time);
    const cores = ['#28a745', '#dc3545', '#007bff', '#ffc107', '#6f42c1', '#fd7e14', '#20c997', '#e83e8c'];
    return cores[timeIndex % cores.length];
  };

  // Função para obter nome do time baseado na posição
  const getNomeTime = (posicao: number) => {
    const timeIndex = Math.floor((posicao - 1) / regras.jogadores_por_time);
    if (timeIndex === 0) return 'Time 1';
    if (timeIndex === 1) return 'Time 2';
    if (timeIndex === 2) return 'Próximo Time';
    if (timeIndex === 3) return 'Segundo Time';
    if (timeIndex === 4) return 'Terceiro Time';
    return `${timeIndex + 1}º Time`;
  };

  // ========== CONTROLE DE LONG PRESS PARA DRAG AND DROP ==========
  const handleLongPressStart = (e: React.TouchEvent | React.MouseEvent, element: HTMLElement) => {
    // Limpar timer anterior se existir
    if (longPressTimer) {
      clearTimeout(longPressTimer);
    }

    // Salvar posição inicial do toque
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const y = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setTouchStartPos({ x, y });
    setCurrentDragElement(element);

    // Iniciar timer de 1 segundo
    const timer = setTimeout(() => {
      console.log('🎯 Long press ativado! Drag habilitado');
      setIsDraggingEnabled(true);
      element.style.opacity = '0.7';
      element.style.transform = 'scale(1.05)';
      
      // Vibração tátil (se disponível)
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 1000); // 1 segundo

    setLongPressTimer(timer);
  };

  const handleLongPressMove = (e: React.TouchEvent | React.MouseEvent) => {
    // Se moveu muito (> 10px), cancelar long press
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const y = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const distX = Math.abs(x - touchStartPos.x);
    const distY = Math.abs(y - touchStartPos.y);

    if (distX > 10 || distY > 10) {
      handleLongPressCancel();
    }
  };

  const handleLongPressCancel = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    
    if (currentDragElement && !isDraggingEnabled) {
      currentDragElement.style.opacity = '1';
      currentDragElement.style.transform = 'scale(1)';
    }
    
    setCurrentDragElement(null);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    if (currentDragElement) {
      currentDragElement.style.opacity = '1';
      currentDragElement.style.transform = 'scale(1)';
    }

    setIsDraggingEnabled(false);
    setCurrentDragElement(null);
  };

  // Função para reordenar jogadores na fila
  const reordenarJogadoresLocal = (jogadorId: string, novaPosicao: number, tipoOrigem: string) => {
    try {
      console.log('🎨 Reordenação LOCAL:', { jogadorId, novaPosicao, tipoOrigem });
      
      // Combinar listas locais ou usar as originais se não há mudanças locais
      const jogandoAtual = hasLocalChanges ? localJogadoresJogando : jogadoresJogando;
      const filaAtual = hasLocalChanges ? localJogadoresFila : jogadoresFila;
      
      // Criar nova lista combinada
      const listaCompleta = [...jogandoAtual, ...filaAtual];
      
      // Encontrar e mover o jogador
      const jogadorIndex = listaCompleta.findIndex(j => j.id === jogadorId);
      if (jogadorIndex === -1) return;
      
      const jogadorMovido = listaCompleta.splice(jogadorIndex, 1)[0];
      const novoIndice = Math.max(0, Math.min(novaPosicao - 1, listaCompleta.length));
      listaCompleta.splice(novoIndice, 0, jogadorMovido);
      
      // Atualizar posições (todos com status 'fila')
      const listaAtualizada = listaCompleta.map((jogador, index) => ({
        ...jogador,
        posicao_fila: index + 1,
        status: 'fila' as const
      }));
      
      // Separar as listas atualizadas baseado na posição
      const novosJogando = listaAtualizada.filter((_, index) => index < regras.jogadores_por_time * 2);
      const novaFila = listaAtualizada.filter((_, index) => index >= regras.jogadores_por_time * 2);
      
      // Atualizar estados locais
      setLocalJogadoresJogando(novosJogando);
      setLocalJogadoresFila(novaFila);
      setHasLocalChanges(true);
      
      console.log('✅ Reordenação local concluída');
    } catch (error) {
      console.error('❌ Erro na reordenação local:', error);
    }
  };

  const salvarMudancasEFecharModal = async () => {
    if (hasLocalChanges) {
      console.log('💾 Salvando mudanças no banco...');
      try {
        const userData = localStorage.getItem('user');
        const user = JSON.parse(userData!);
        const peladaId = user.id;
        
        // 1. Salvar jogadores ativos (jogando + fila) - todos com status 'fila'
        const listaCompleta = [...localJogadoresJogando, ...localJogadoresFila];
        const updatesAtivos = listaCompleta.map((jogador, index) => {
          const posicaoSequencial = index + 1;
          
          return supabase
            .from('fila')
            .update({ 
              posicao_fila: posicaoSequencial,
              status: 'fila'
            })
            .eq('jogador_id', jogador.id)
            .eq('pelada_id', peladaId);
        });
        
        // 2. Identificar e salvar jogadores removidos como reserva
        const idsAtivosAtuais = listaCompleta.map(j => j.id);
        const idsOriginais = [...jogadoresJogando, ...jogadoresFila].map(j => j.id);
        const idsRemovidos = idsOriginais.filter(id => !idsAtivosAtuais.includes(id));
        
        const updatesReserva = idsRemovidos.map(jogadorId => 
          supabase
            .from('fila')
            .update({ 
              status: 'reserva',
              posicao_fila: null
            })
            .eq('jogador_id', jogadorId)
            .eq('pelada_id', peladaId)
        );
        
        console.log('📝 Salvando:', {
          ativos: listaCompleta.length,
          removidos: idsRemovidos.length
        });
        
        // 3. Executar todas as atualizações
        await Promise.all([...updatesAtivos, ...updatesReserva]);
        
        // 4. Recarregar dados
        await carregarDados();
        
        console.log('✅ Mudanças salvas com sucesso');
      } catch (error) {
        console.error('❌ Erro ao salvar mudanças:', error);
      }
    }
    
    // Resetar estado local e restaurar scroll
    setHasLocalChanges(false);
    setLocalJogadoresJogando([]);
    setLocalJogadoresFila([]);
    setLocalJogadoresReserva([]);
    setShowManagementModal(false);
    document.body.style.overflow = 'auto'; // Restaurar scroll
  };

  const fecharModalSemSalvar = () => {
    setHasLocalChanges(false);
    setLocalJogadoresJogando([]);
    setLocalJogadoresFila([]);
    setLocalJogadoresReserva([]);
    setShowManagementModal(false);
  };

  const formatarData = () => {
    return new Date().toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // Organizar times com base apenas nos jogadores que estão jogando (primeiras posições)
  const jogadoresPorTime = regras.jogadores_por_time;
  
  // Usar APENAS todosJogadoresFila já ordenado (evita duplicação)
  const todosJogadoresNaFila = (filaCompleta.length > 0 ? filaCompleta : [...jogadoresJogando, ...jogadoresFila]).sort((a, b) => a.posicao_fila - b.posicao_fila);
  
  // Times: primeiros 2 times completos (adapta automaticamente ao jogadores_por_time)
  const time1 = todosJogadoresNaFila.slice(0, regras.jogadores_por_time);
  const time2 = todosJogadoresNaFila.slice(regras.jogadores_por_time, regras.jogadores_por_time * 2);
  
  // Fila de espera: do terceiro time em diante
  const filaDeEspera = todosJogadoresNaFila.slice(regras.jogadores_por_time * 2);

  // 📊 LOG: Distribuição da fila
  console.log('📊 DISTRIBUIÇÃO DA FILA:');
  console.log(`  ⚙️ Regra: ${regras.jogadores_por_time} jogadores por time`);
  console.log(`  🟢 Time 1: ${time1.length} jogadores`, time1.map(j => j.nome));
  console.log(`  🔴 Time 2: ${time2.length} jogadores`, time2.map(j => j.nome));
  console.log(`  📋 Fila de Espera: ${filaDeEspera.length} jogadores`, filaDeEspera.map(j => j.nome));
  console.log(`  📊 TOTAL VISUAL: ${time1.length + time2.length + filaDeEspera.length} jogadores`);

  if (isLoading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#fff' 
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '24px',
            height: '24px',
            border: '2px solid #e0e0e0',
            borderTop: '2px solid #2d8f2d',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p>⚽ Carregando fila...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {console.log('🎬 COMPONENTE RENDERIZANDO! Modal state:', showManagementModal)}
      
      {/* Tela quando não há sessão ativa */}
      {semSessaoAtiva && (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          textAlign: 'center',
          background: '#fff',
          gap: '30px'
        }}>
          {/* Ícone animado */}
          <div style={{ 
            fontSize: '80px',
            animation: 'bounce 2s ease-in-out infinite'
          }}>
            🎲
          </div>
          
          <style>
            {`
              @keyframes bounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-20px); }
              }
              @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
              }
            `}
          </style>
          
          <div style={{ animation: 'fadeIn 0.5s ease-out', maxWidth: '400px' }}>
            <h2 style={{ 
              fontSize: '28px', 
              fontWeight: '700', 
              color: '#1a1a1a',
              marginBottom: '12px'
            }}>
              Nenhuma Fila Ativa
            </h2>
            <p style={{ 
              fontSize: '16px', 
              color: '#6b7280', 
              lineHeight: '1.6',
              marginBottom: '0'
            }}>
              Você precisa fazer o <strong>Sorteio</strong> dos times antes de acessar a fila de espera
            </p>
          </div>
          
          <button
            onClick={() => window.location.href = '/sorteio'}
            style={{
              padding: '16px 40px',
              fontSize: '18px',
              fontWeight: '700',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: '#fff',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
              transition: 'all 0.2s',
              animation: 'fadeIn 0.6s ease-out 0.3s both'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
            }}
          >
            🎲 Ir para Sorteio
          </button>
        </div>
      )}
      
      {!semSessaoAtiva && (
      <>
      
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          -webkit-tap-highlight-color: rgba(0, 0, 0, 0.1);
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          user-select: none;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background-color: #fff;
          color: #333;
          line-height: 1.6;
          padding-bottom: 120px;
          -webkit-text-size-adjust: 100%;
          touch-action: pan-y; /* Permite scroll vertical, mas não horizontal */
          overflow-x: hidden;
          width: 100%;
        }

        .main {
          min-height: 100vh;
          padding: 16px 0;
          width: 100%;
          overflow-x: hidden;
        }

        .container {
          max-width: 400px;
          margin: 0 auto;
          padding: 0 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          width: 100%;
          box-sizing: border-box;
        }

        .header-card {
          background: #f8f9fa;
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
          border: 2px solid #f0f0f0;
          text-align: center;
          touch-action: manipulation;
        }

        .header-card h2 {
          font-size: 1.3rem;
          font-weight: 600;
          color: #333;
          margin: 0 0 8px 0;
        }

        .status-info {
          font-size: 0.9rem;
          color: #666;
          font-weight: 500;
        }

        .teams-cards {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          align-items: start;
        }

        .team-card {
          background: #fff;
          border-radius: 8px;
          padding: 16px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          border: 1px solid #e0e0e0;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          min-height: 200px;
        }

        .team-card:hover {
          border-color: #d0d0d0;
        }

        .team-header {
          padding: 8px 12px;
          border-radius: 8px;
          text-align: center;
          margin-bottom: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          background: #f8f9fa;
          border: 1px solid #e9ecef;
        }

        .team-header h3 {
          margin: 0;
          font-size: 1rem;
          color: #28a745;
          font-weight: 600;
        }

        .team-table-container {
          flex-grow: 1;
          display: flex;
          flex-direction: column;
        }

        .team-table {
          width: 100%;
          border-collapse: collapse;
          flex-grow: 1;
        }

        .team-table td {
          padding: 4px 8px;
          border-bottom: 1px solid #f1f3f4;
          font-size: 0.75rem;
          line-height: 1.2;
          min-height: 24px;
          vertical-align: middle;
          text-align: center;
          color: #333;
        }

        .team-table tr.empty-row td {
          color: #ccc;
          font-style: italic;
          text-align: center;
          font-size: 0.625rem;
        }

        .team-table tr:last-child td {
          border-bottom: none;
        }

        .start-match-container {
          text-align: center;
          margin: 6px 0;
          padding: 0;
          display: block;
        }

        .start-match-btn {
          background: linear-gradient(135deg, #2d8f2d, #4CAF50);
          color: white;
          border: none;
          border-radius: 15px;
          padding: 16px 32px;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 12px rgba(45, 143, 45, 0.3);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          width: 100%;
          position: relative;
          overflow: hidden;
        }

        .start-match-btn:disabled {
          background: #ccc;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .start-match-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #245d24, #45a049, #2d8f2d);
          transform: translateY(-3px) scale(1.02);
          box-shadow: 0 8px 20px rgba(45, 143, 45, 0.5);
        }

        .queue-card {
          background: #fff;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          border: 1px solid #e0e0e0;
        }

        .queue-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid #e0e0e0;
        }

        .queue-header h3 {
          font-size: 1.2rem;
          font-weight: normal;
          color: #333;
          margin: 0;
        }

        .queue-blocks-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .queue-block {
          background: #ffffff;
          border-radius: 8px;
          padding: 12px;
          border: 2px solid #28a745;
          margin-bottom: 12px;
        }

        .queue-block-header h4 {
          font-size: 0.875rem;
          color: #28a745;
          margin: 0 0 8px 0;
          text-align: center;
          font-weight: 700;
        }

        .queue-block-table {
          width: 100%;
          border-collapse: collapse;
        }

        .queue-block-table td {
          padding: 4px 8px;
          border-bottom: 1px solid #f1f3f4;
          font-size: 0.75rem;
          line-height: 1.2;
          min-height: 24px;
          vertical-align: middle;
          text-align: center;
          color: #333;
        }

        .queue-block-table tr.empty-row td {
          color: #ccc;
          font-style: italic;
          font-size: 0.625rem;
        }

        .stats-day-card {
          background: #fff;
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
          border: 1px solid #f0f0f0;
        }

        .stats-day-container {
          display: flex;
          gap: 15px;
          width: 100%;
        }

        .stat-box {
          padding: 12px;
          flex: 1;
          text-align: center;
          background: #f8f9fa;
          border-radius: 12px;
          border: 1px solid #e8e8e8;
        }

        .stat-icon {
          font-size: 1.8rem;
          margin-bottom: 8px;
          display: block;
        }

        .stat-value {
          font-size: 1.4rem;
          font-weight: 600;
          color: #2d8f2d;
          display: block;
          margin-bottom: 4px;
        }

        .stat-label {
          font-size: 0.8rem;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        @media (max-width: 768px) {
          .container {
            max-width: 100%;
            padding: 0 15px;
          }
          
          .header-card {
            padding: 16px;
          }
          
          .team-card {
            padding: 8px;
            min-height: 160px;
          }
          
          .start-match-btn {
            padding: 15px 28px;
            font-size: 1rem;
            max-width: 280px;
            min-width: 220px;
          }
        }

        @media (max-width: 480px) {
          .container {
            padding: 0 12px;
          }
          
          .header-card {
            padding: 14px;
          }
          
          .header-card h2 {
            font-size: 1.1rem;
          }
          
          .teams-cards {
            grid-template-columns: 1fr 1fr !important;
          }
          
          .start-match-btn {
            padding: 14px 24px;
            font-size: 0.95rem;
            max-width: 260px;
            min-width: 200px;
          }
        }
      `}</style>

      <div className="main">
        <div className="container">
          {/* Header */}
          <section className="header-card">
            <h2>📋 Organização da Fila 📋</h2>
            <div className="status-info">
              {formatarData()} • <span style={{color: '#dc3545'}}>{jogadoresJogando.length + jogadoresFila.length} jogadores</span>
            </div>
          </section>

          {/* Times */}
          <section className="teams-cards">
            <div className="team-card">
              <div className="team-header">
                <h3>TIME 1</h3>
              </div>
              <div className="team-table-container">
                <table className="team-table">
                  <tbody>
                    {time1.map((jogador, index) => (
                      <tr key={jogador.id}>
                        <td>{jogador.nome}</td>
                      </tr>
                    ))}
                    {Array.from({ length: regras.jogadores_por_time - time1.length }).map((_, index) => (
                      <tr key={`empty1-${index}`} className="empty-row">
                        <td>Aguardando jogador...</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="team-card">
              <div className="team-header">
                <h3>TIME 2</h3>
              </div>
              <div className="team-table-container">
                <table className="team-table">
                  <tbody>
                    {time2.map((jogador, index) => (
                      <tr key={jogador.id}>
                        <td>{jogador.nome}</td>
                      </tr>
                    ))}
                    {Array.from({ length: regras.jogadores_por_time - time2.length }).map((_, index) => (
                      <tr key={`empty2-${index}`} className="empty-row">
                        <td>Aguardando jogador...</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Cronômetro e Controles de Resultado */}
          <section className="match-control-container" style={{
            backgroundColor: '#f8f9fa',
            borderRadius: '12px',
            padding: '12px',
            marginBottom: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            {/* Cronômetro */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              marginBottom: '12px',
              padding: '10px',
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.1)'
            }}>
              {/* Botão Play/Pause */}
              <button 
                onClick={toggleCronometro}
                style={{
                  padding: '8px 12px',
                  fontSize: '1rem',
                  backgroundColor: isRunning ? '#dc3545' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
              }}>
                {isRunning ? '⏸' : '▶'}
              </button>
              
              {/* Contador */}
              <div style={{
                fontSize: '2.5rem',
                fontWeight: 'bold',
                color: '#333',
                fontFamily: 'monospace',
                minWidth: '120px',
                textAlign: 'center',
                lineHeight: '1'
              }}>
                {formatarTempo(tempo)}
              </div>
              
              {/* Botão Reset */}
              <button 
                onClick={resetarCronometro}
                style={{
                  padding: '8px 12px',
                  fontSize: '1rem',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
              }}>
                ↻
              </button>
            </div>

            {/* Botões de Resultado */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              gap: '8px',
              alignItems: 'center'
            }}>
              {/* Botão Time 1 Venceu */}
              <button 
                onClick={() => abrirModalResultado('A')}
                style={{
                  padding: '10px',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  transition: 'all 0.2s'
              }}>
                VENCEU
              </button>

              {/* Botão Empate */}
              <button 
                onClick={() => abrirModalResultado(null)}
                style={{
                  padding: '10px 20px',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  backgroundColor: '#ffc107',
                  color: '#333',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
              }}>
                EMPATE
              </button>

              {/* Botão Time 2 Venceu */}
              <button 
                onClick={() => abrirModalResultado('B')}
                style={{
                  padding: '10px',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  transition: 'all 0.2s'
              }}>
                VENCEU
              </button>
            </div>
          </section>

          {/* Fila */}
          {filaDeEspera.length > 0 && (
            <section className="queue-card">
              <div className="queue-header">
                <h3>📋 Fila de Espera</h3>
                <span style={{fontSize: '0.75rem', color: '#666'}}>{filaDeEspera.length} aguardando</span>
              </div>
              <div className="queue-blocks-container" style={{ 
                display: 'grid', 
                gridTemplateColumns: filaDeEspera.length > jogadoresPorTime ? '1fr 1fr' : '1fr',
                gap: '12px'
              }}>
                {/* RV: Dividir fila em quadros baseado na regra */}
                {Array.from({ length: Math.ceil(filaDeEspera.length / jogadoresPorTime) }, (_, blockIndex) => {
                  const startIndex = blockIndex * jogadoresPorTime;
                  const endIndex = Math.min(startIndex + jogadoresPorTime, filaDeEspera.length);
                  const jogadoresDoBloco = filaDeEspera.slice(startIndex, endIndex);
                  
                  return (
                    <div key={`bloco-${blockIndex}`} className="queue-block">
                      <div className="queue-block-header">
                        <h4>{blockIndex === 0 ? 'Próximo Time' : `${blockIndex === 1 ? 'Segundo' : blockIndex === 2 ? 'Terceiro' : blockIndex === 3 ? 'Quarto' : `${blockIndex + 1}º`} Time`}</h4>
                      </div>
                      <table className="queue-block-table">
                        <tbody>
                          {jogadoresDoBloco.map((jogador, index) => (
                            <tr key={jogador.id}>
                              <td>{jogador.nome}</td>
                            </tr>
                          ))}
                          {/* Preencher linhas vazias até completar o bloco */}
                          {Array.from({ length: jogadoresPorTime - jogadoresDoBloco.length }).map((_, emptyIndex) => (
                            <tr key={`empty-bloco${blockIndex}-${emptyIndex}`} className="empty-row">
                              <td>Aguardando jogador...</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Footer Mobile */}
        <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden z-30 safe-area-padding">
          <nav className="flex py-2 px-4" style={{ minHeight: '84px' }}>
            <button
              onClick={() => {
                console.log('🎯 Botão Gerenciar clicado!');
                
                // Inicializar estados locais com dados atuais
                setLocalJogadoresJogando([...jogadoresJogando]);
                setLocalJogadoresFila([...jogadoresFila]);
                setLocalJogadoresReserva([...jogadoresReserva]);
                setHasLocalChanges(false);
                
                setShowManagementModal(true);
                console.log('🎯 Estado alterado para true');
              }}
              className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-gray-400 hover:text-green-600 hover:bg-green-50"
              style={{ flex: 1 }}
            >
              <span className="text-2xl">👥</span>
              <span className="text-xs font-medium mt-1">Peladeiros</span>
            </button>
            <button
              onClick={() => window.location.href = '/fila'}
              className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-green-600 bg-green-50"
              style={{ flex: 1 }}
            >
              <span className="text-2xl">📋</span>
              <span className="text-xs font-medium mt-1">Fila</span>
            </button>
            <button
              onClick={() => {
                alert('🔒 Recurso não disponível!\n\nO Fila 2 já possui gerenciamento de partidas integrado.\n\nUse os botões VENCEU/EMPATE acima para registrar os resultados.');
              }}
              className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-gray-400"
              style={{ flex: 1, opacity: 0.5, position: 'relative', cursor: 'not-allowed' }}
            >
              <span style={{ position: 'absolute', top: '5px', right: '5px', fontSize: '12px' }}>🔒</span>
              <span className="text-2xl">⚽</span>
              <span className="text-xs font-medium mt-1">Partida</span>
            </button>
            <button
              onClick={() => {
                if (planoUsuario === 'free') {
                  alert('🔒 Recurso bloqueado!\n\nA função desfazer está disponível apenas no Plano Gold.\n\nAtualize seu plano para acessar este recurso.');
                } else {
                  abrirModalDesfazer();
                }
              }}
              className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-gray-400 hover:text-orange-600 hover:bg-orange-50"
              style={{ flex: 1, opacity: planoUsuario === 'free' ? 0.5 : 1, position: 'relative' }}
            >
              {planoUsuario === 'free' && (
                <span style={{ position: 'absolute', top: '5px', right: '5px', fontSize: '12px' }}>🔒</span>
              )}
              <span className="text-2xl">↩️</span>
              <span className="text-xs font-medium mt-1">Desfazer</span>
            </button>
            <button
              onClick={abrirModalEncerrar}
              className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-gray-400 hover:text-red-600 hover:bg-red-50"
              style={{ flex: 1 }}
            >
              <span className="text-2xl">🏁</span>
              <span className="text-xs font-medium mt-1">Encerrar</span>
            </button>
          </nav>
        </footer>

        {/* Modal de Gerenciamento */}
        {showManagementModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            touchAction: 'none', 
            overflow: 'hidden'   
          }}
          onClick={() => console.log('🔍 Fundo do modal clicado')}
          >
            {console.log('🚀 MODAL ESTÁ SENDO RENDERIZADO! Estado showManagementModal:', showManagementModal)}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '0px',
              width: '100%',
              height: '100vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
              overflow: 'hidden'
            }}>
              
              {/* Header do Modal */}
              <div style={{
                padding: '20px 24px 16px',
                background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                borderBottom: '2px solid #dee2e6',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: '600',
                  color: '#28a745',
                  margin: 0
                }}>📋 Gerenciar Jogadores {hasLocalChanges && <span style={{color: '#ffc107', fontSize: '14px'}}>● (não salvo)</span>}</h3>
                <button
                  onClick={salvarMudancasEFecharModal}
                  style={{
                    background: '#dc3545',
                    color: 'white',
                    border: 'none',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    fontSize: '18px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  ×
                </button>
              </div>

              {/* Layout de 2 colunas */}
              <div style={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                minHeight: 0
              }}>
                
                {/* Coluna Fila Completa */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  borderRight: '2px solid #dee2e6'
                }}>
                  <div style={{
                    padding: '12px',
                    background: '#f8f9fa',
                    borderBottom: '1px solid #dee2e6',
                    textAlign: 'center'
                  }}>
                    <h4 style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#495057',
                      margin: '0 0 4px 0'
                    }}>📋 Fila Completa ({(hasLocalChanges ? localJogadoresJogando : jogadoresJogando).length + (hasLocalChanges ? localJogadoresFila : jogadoresFila).length})</h4>
                    <small style={{ fontSize: '12px', color: '#6c757d' }}>Posições ativas na ordem</small>
                  </div>
                  
                  <div style={{
                    flex: 1,
                    padding: '8px',
                    overflowY: 'auto',
                    maxHeight: 'calc(100vh - 200px)'
                  }}>
                    {/* Jogadores Jogando */}
                    {(hasLocalChanges ? localJogadoresJogando : jogadoresJogando).map((jogador, index) => {
                      const corTime = getCorTime(index + 1);
                      return (
                        <div
                          key={jogador.id}
                          draggable={isDraggingEnabled}
                          onMouseDown={(e) => handleLongPressStart(e, e.currentTarget)}
                          onMouseMove={handleLongPressMove}
                          onMouseUp={handleLongPressEnd}
                          onMouseLeave={handleLongPressCancel}
                          onTouchStart={(e) => {
                            handleLongPressStart(e, e.currentTarget);
                          }}
                          onTouchMove={(e) => {
                            handleLongPressMove(e);
                            
                            // Se drag está habilitado, permitir drop
                            if (isDraggingEnabled) {
                              const touch = e.touches[0];
                              const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
                              
                              if (elementBelow) {
                                const targetCard = elementBelow.closest('[data-drag-target]');
                                if (targetCard) {
                                  const dragId = e.currentTarget.getAttribute('data-drag-id');
                                  const dragTipo = e.currentTarget.getAttribute('data-drag-tipo');
                                  const targetPosicao = parseInt(targetCard.getAttribute('data-target-posicao') || '0');
                                  
                                  if (dragId && dragTipo && targetPosicao && dragId !== targetCard.getAttribute('data-target-id')) {
                                    reordenarJogadoresLocal(dragId, targetPosicao, dragTipo);
                                  }
                                }
                              }
                            }
                          }}
                          onTouchEnd={handleLongPressEnd}
                          onDragStart={(e) => {
                            if (!isDraggingEnabled) {
                              e.preventDefault();
                              return;
                            }
                            console.log('🎯 DRAG START:', jogador.nome, 'posição:', index + 1);
                            e.dataTransfer.setData('text/plain', JSON.stringify({
                              id: jogador.id,
                              tipo: 'jogando',
                              posicao: index + 1
                            }));
                            e.currentTarget.style.opacity = '0.5';
                          }}
                          onDragEnd={(e) => {
                            e.currentTarget.style.opacity = '1';
                            handleLongPressEnd();
                          }}
                          onDragOver={(e) => {
                            if (isDraggingEnabled) {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                            }
                          }}
                          onDrop={(e) => {
                            console.log('💥 DROP EVENT TRIGGERED!', jogador.nome);
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('📍 Drop detectado sobre:', jogador.nome, 'posição:', index + 1);
                            try {
                              const rawData = e.dataTransfer.getData('text/plain');
                              console.log('📦 Raw data:', rawData);
                              if (!rawData) {
                                console.log('❌ Nenhum dado encontrado no dataTransfer');
                                return;
                              }
                              const dados = JSON.parse(rawData);
                              console.log('📦 Dados parsed:', dados);
                              if (dados.id !== jogador.id && (dados.tipo === 'jogando' || dados.tipo === 'fila')) {
                                console.log('🔄 Iniciando reordenação...');
                                reordenarJogadoresLocal(dados.id, index + 1, dados.tipo);
                              } else {
                                console.log('❌ Drop ignorado - mesmo jogador ou tipo inválido');
                              }
                            } catch (error) {
                              console.error('❌ Erro no drop:', error);
                            }
                          }}
                          style={{
                            background: `${corTime}15`,
                            border: `1px solid ${corTime}`,
                            borderRadius: '8px',
                            padding: '8px',
                            marginBottom: '6px',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: isDraggingEnabled ? 'grabbing' : 'grab',
                            transition: 'all 0.2s ease'
                          }}
                          data-drag-target="true"
                          data-drag-id={jogador.id}
                          data-drag-tipo="jogando"
                          data-drag-posicao={index + 1}
                          data-target-id={jogador.id}
                          data-target-posicao={index + 1}
                          data-player-name={jogador.nome}
                        >
                          <div style={{
                            background: corTime,
                            color: 'white',
                            fontWeight: '600',
                            fontSize: '12px',
                            padding: '4px 6px',
                            borderRadius: '6px',
                            minWidth: '24px',
                            textAlign: 'center',
                            flexShrink: 0,
                            pointerEvents: 'none'
                          }}>
                            {index + 1}
                          </div>
                          <div style={{ fontWeight: '500', color: '#333', flex: 1, pointerEvents: 'none' }}>
                            {jogador.nome}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              moverJogadorParaReserva(jogador.id);
                            }}
                            onTouchStart={(e) => e.stopPropagation()}
                            onTouchEnd={(e) => e.stopPropagation()}
                            onTouchMove={(e) => e.stopPropagation()}
                            style={{
                              background: '#dc3545',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px 6px',
                              fontSize: '14px',
                              cursor: 'pointer',
                              flexShrink: 0,
                              minWidth: '28px',
                              height: '28px',
                              position: 'relative',
                              zIndex: 10
                            }}
                          >
                            ➖
                          </button>
                        </div>
                      );
                    })}
                    
                    {/* Jogadores na Fila */}
                    {(hasLocalChanges ? localJogadoresFila : jogadoresFila).map((jogador, index) => {
                      const jogandoAtual = hasLocalChanges ? localJogadoresJogando : jogadoresJogando;
                      const posicaoTotal = jogandoAtual.length + index + 1;
                      const corTime = getCorTime(posicaoTotal);
                      return (
                        <div
                          key={jogador.id}
                          draggable={isDraggingEnabled}
                          onMouseDown={(e) => handleLongPressStart(e, e.currentTarget)}
                          onMouseMove={handleLongPressMove}
                          onMouseUp={handleLongPressEnd}
                          onMouseLeave={handleLongPressCancel}
                          onTouchStart={(e) => {
                            handleLongPressStart(e, e.currentTarget);
                          }}
                          onTouchMove={(e) => {
                            handleLongPressMove(e);
                            
                            if (isDraggingEnabled) {
                              const touch = e.touches[0];
                              const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
                              
                              if (elementBelow) {
                                const targetCard = elementBelow.closest('[data-drag-target]');
                                if (targetCard) {
                                  const dragId = e.currentTarget.getAttribute('data-drag-id');
                                  const dragTipo = e.currentTarget.getAttribute('data-drag-tipo');
                                  const targetPosicao = parseInt(targetCard.getAttribute('data-target-posicao') || '0');
                                  
                                  if (dragId && dragTipo && targetPosicao && dragId !== targetCard.getAttribute('data-target-id')) {
                                    reordenarJogadoresLocal(dragId, targetPosicao, dragTipo);
                                  }
                                }
                              }
                            }
                          }}
                          onTouchEnd={handleLongPressEnd}
                          onDragStart={(e) => {
                            if (!isDraggingEnabled) {
                              e.preventDefault();
                              return;
                            }
                            e.dataTransfer.setData('text/plain', JSON.stringify({
                              id: jogador.id,
                              tipo: 'fila',
                              posicao: posicaoTotal
                            }));
                            e.currentTarget.style.opacity = '0.5';
                          }}
                          onDragEnd={(e) => {
                            e.currentTarget.style.opacity = '1';
                            handleLongPressEnd();
                          }}
                          onDragOver={(e) => {
                            if (isDraggingEnabled) {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                            }
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('📍 Drop detectado sobre (fila):', jogador.nome, 'posição:', posicaoTotal);
                            try {
                              const dados = JSON.parse(e.dataTransfer.getData('text/plain'));
                              console.log('📦 Dados recebidos (fila):', dados);
                              if (dados.id !== jogador.id && (dados.tipo === 'jogando' || dados.tipo === 'fila')) {
                                console.log('🔄 Iniciando reordenação...');
                                reordenarJogadoresLocal(dados.id, posicaoTotal, dados.tipo);
                              } else {
                                console.log('❌ Drop ignorado - mesmo jogador ou tipo inválido');
                              }
                            } catch (error) {
                              console.error('❌ Erro no drop (fila):', error);
                            }
                          }}
                          style={{
                            background: `${corTime}15`,
                            border: `1px solid ${corTime}`,
                            borderRadius: '8px',
                            padding: '8px',
                            marginBottom: '6px',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.2s ease',
                            cursor: isDraggingEnabled ? 'grabbing' : 'grab'
                          }}
                          data-drag-target="true"
                          data-drag-id={jogador.id}
                          data-drag-tipo="fila"
                          data-drag-posicao={posicaoTotal}
                          data-target-id={jogador.id}
                          data-target-posicao={posicaoTotal}
                          data-player-name={jogador.nome}
                        >
                          <div style={{
                            background: corTime,
                            color: 'white',
                            fontWeight: '600',
                            fontSize: '12px',
                            padding: '4px 6px',
                            borderRadius: '6px',
                            minWidth: '24px',
                            textAlign: 'center',
                            flexShrink: 0,
                            pointerEvents: 'none'
                          }}>
                            {posicaoTotal}
                          </div>
                          <div style={{ fontWeight: '500', color: '#333', flex: 1, pointerEvents: 'none' }}>
                            {jogador.nome}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              moverJogadorParaReserva(jogador.id);
                            }}
                            onTouchStart={(e) => e.stopPropagation()}
                            onTouchEnd={(e) => e.stopPropagation()}
                            onTouchMove={(e) => e.stopPropagation()}
                            style={{
                              background: '#dc3545',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px 6px',
                              fontSize: '14px',
                              cursor: 'pointer',
                              flexShrink: 0,
                              minWidth: '28px',
                              height: '28px',
                              position: 'relative',
                              zIndex: 10
                            }}
                          >
                            ➖
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Coluna Reservas */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <div style={{
                    padding: '12px',
                    background: '#f8f9fa',
                    borderBottom: '1px solid #dee2e6',
                    textAlign: 'center'
                  }}>
                    <h4 style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#495057',
                      margin: '0 0 4px 0'
                    }}>🪑 Reservas ({jogadoresReserva.length})</h4>
                    <small style={{ fontSize: '12px', color: '#6c757d' }}>Clique para adicionar à fila</small>
                  </div>
                  
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    {/* Lista de reservas com scroll */}
                    <div style={{
                      flex: 1,
                      padding: '8px',
                      overflowY: 'auto',
                      maxHeight: 'calc(100vh - 280px)'
                    }}>
                      {jogadoresReserva.map((jogador) => (
                        <div
                          key={jogador.id}
                          style={{
                            background: '#fff',
                            border: '1px solid #e9ecef',
                            borderRadius: '8px',
                            padding: '8px',
                            marginBottom: '6px',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <div style={{ fontWeight: '500', color: '#333', flex: 1 }}>{jogador.nome}</div>
                          <button
                            onClick={() => moverReservaParaFila(jogador.id)}
                            style={{
                              background: '#28a745',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px 6px',
                              fontSize: '14px',
                              cursor: 'pointer',
                              flexShrink: 0,
                              minWidth: '28px',
                              height: '28px'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#218838';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#28a745';
                            }}
                          >
                            ➕
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    {/* Botão Fixo no Final */}
                    <div style={{
                      padding: '8px',
                      borderTop: '1px solid #dee2e6',
                      background: '#f8f9fa'
                    }}>
                      <button
                        onClick={() => setShowCadastroModal(true)}
                        style={{
                          background: '#007bff',
                          color: 'white',
                          border: '2px dashed #0056b3',
                          borderRadius: '8px',
                          padding: '12px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#0056b3';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#007bff';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        🆕 Adicionar Novo Jogador
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Cadastro de Novo Jogador (sobreposto) */}
        {showCadastroModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 2000, // Maior que o modal de gerenciamento
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              width: '100%',
              maxWidth: '400px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
            }}>
              {/* Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                paddingBottom: '12px',
                borderBottom: '1px solid #dee2e6'
              }}>
                <h3 style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#333'
                }}>🆕 Cadastrar Novo Jogador</h3>
                <button
                  onClick={() => {
                    setShowCadastroModal(false);
                    setNovoJogadorNome('');
                    setNovoJogadorEstrelas(3);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '20px',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px'
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Formulário */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#495057',
                  marginBottom: '8px'
                }}>
                  Nome do Jogador
                </label>
                <input
                  type="text"
                  value={novoJogadorNome}
                  onChange={(e) => setNovoJogadorNome(e.target.value)}
                  placeholder="Digite o nome..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #ced4da',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      cadastrarNovoJogador();
                    }
                  }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#495057',
                  marginBottom: '8px'
                }}>
                  Nível (Estrelas)
                </label>
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  justifyContent: 'center'
                }}>
                  {[1, 2, 3, 4, 5].map(estrela => (
                    <button
                      key={estrela}
                      onClick={() => setNovoJogadorEstrelas(estrela)}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '24px',
                        cursor: 'pointer',
                        padding: '4px',
                        opacity: estrela <= novoJogadorEstrelas ? 1 : 0.3,
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      ⭐
                    </button>
                  ))}
                </div>
              </div>

              {/* Botões */}
              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => {
                    setShowCadastroModal(false);
                    setNovoJogadorNome('');
                    setNovoJogadorEstrelas(3);
                  }}
                  style={{
                    background: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={cadastrarNovoJogador}
                  disabled={!novoJogadorNome.trim()}
                  style={{
                    background: novoJogadorNome.trim() ? '#28a745' : '#ccc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontSize: '14px',
                    cursor: novoJogadorNome.trim() ? 'pointer' : 'not-allowed',
                    fontWeight: '500'
                  }}
                >
                  🆕 Cadastrar e Adicionar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Confirmação de Início de Partida */}
        {showConfirmarInicioModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}>
            <div style={{
              backgroundColor: '#fff',
              borderRadius: '16px',
              maxWidth: '500px',
              width: '100%',
              padding: '32px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏁</div>
              <h2 style={{ 
                fontSize: '24px', 
                fontWeight: '700', 
                color: '#1a1a1a',
                marginBottom: '16px'
              }}>
                Deseja Iniciar a Pelada?
              </h2>
              
              <p style={{ 
                fontSize: '16px', 
                color: '#666',
                marginBottom: '32px',
                lineHeight: '1.5'
              }}>
                O cronômetro será iniciado automaticamente.
              </p>

              {/* Botões */}
              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center'
              }}>
                <button
                  onClick={() => setShowConfirmarInicioModal(false)}
                  style={{
                    flex: 1,
                    padding: '14px 24px',
                    fontSize: '16px',
                    fontWeight: '600',
                    borderRadius: '8px',
                    border: '2px solid #ddd',
                    backgroundColor: '#fff',
                    color: '#666',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f5f5f5';
                    e.currentTarget.style.borderColor = '#999';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#fff';
                    e.currentTarget.style.borderColor = '#ddd';
                  }}
                >
                  CANCELAR
                </button>

                <button
                  onClick={confirmarInicioPartida}
                  style={{
                    flex: 1,
                    padding: '14px 24px',
                    fontSize: '16px',
                    fontWeight: '600',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#16a34a',
                    color: '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#15803d';
                    e.currentTarget.style.transform = 'scale(1.02)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#16a34a';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  INICIAR
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal 1: Confirmação de Encerramento */}
        {showEncerrarModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '20px'
          }}>
            <div style={{
              backgroundColor: '#fff',
              borderRadius: '20px',
              maxWidth: '500px',
              width: '100%',
              padding: '36px 28px'
            }}>
              <div style={{ fontSize: '4rem', textAlign: 'center', marginBottom: '20px' }}>🏁</div>
              
              <h2 style={{ 
                fontSize: '1.75rem', 
                fontWeight: 'bold', 
                textAlign: 'center',
                marginBottom: '16px',
                color: '#dc2626'
              }}>
                Encerrar Pelada?
              </h2>
              
              <p style={{ 
                fontSize: '0.95rem', 
                color: '#666',
                textAlign: 'center',
                marginBottom: '24px',
                lineHeight: '1.6'
              }}>
                Esta ação irá <strong>finalizar a pelada</strong> e encerrar a sessão ativa. 
                <br/><br/>
                <strong style={{ color: '#dc2626' }}>⚠️ Esta ação é IRREVERSÍVEL!</strong>
              </p>

              {/* Botões */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setShowEncerrarModal(false)}
                  style={{
                    flex: 1,
                    padding: '14px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    background: '#fff',
                    color: '#666',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarEncerramento}
                  style={{
                    flex: 1,
                    padding: '14px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    border: 'none',
                    borderRadius: '10px',
                    background: '#dc2626',
                    color: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  Finalizar Pelada
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal 2: Confirmar Senha */}
        {showConfirmarSenhaModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2001,
            padding: '20px'
          }}>
            <div style={{
              backgroundColor: '#fff',
              borderRadius: '20px',
              maxWidth: '450px',
              width: '100%',
              padding: '36px 28px'
            }}>
              <div style={{ fontSize: '3.5rem', textAlign: 'center', marginBottom: '20px' }}>🔐</div>
              
              <h2 style={{ 
                fontSize: '1.5rem', 
                fontWeight: 'bold', 
                textAlign: 'center',
                marginBottom: '12px',
                color: '#1a1a1a'
              }}>
                Confirme sua Senha
              </h2>
              
              <p style={{ 
                fontSize: '0.9rem', 
                color: '#666',
                textAlign: 'center',
                marginBottom: '28px'
              }}>
                Digite sua senha para confirmar o encerramento
              </p>

              <input
                type="password"
                value={senhaEncerramento}
                onChange={(e) => setSenhaEncerramento(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') finalizarPelada();
                }}
                placeholder="Digite sua senha"
                autoFocus
                style={{
                  width: '100%',
                  padding: '14px',
                  fontSize: '1rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '10px',
                  marginBottom: '20px',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#16a34a'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />

              {/* Botões */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => {
                    setShowConfirmarSenhaModal(false);
                    setSenhaEncerramento('');
                  }}
                  style={{
                    flex: 1,
                    padding: '14px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    background: '#fff',
                    color: '#666',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={finalizarPelada}
                  disabled={!senhaEncerramento}
                  style={{
                    flex: 1,
                    padding: '14px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    border: 'none',
                    borderRadius: '10px',
                    background: senhaEncerramento ? '#dc2626' : '#e5e7eb',
                    color: senhaEncerramento ? '#fff' : '#999',
                    cursor: senhaEncerramento ? 'pointer' : 'not-allowed'
                  }}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Desfazer Última Ação - Informativo */}
        {showDesfazerModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '20px'
          }}>
            <div style={{
              backgroundColor: '#fff',
              borderRadius: '20px',
              maxWidth: '500px',
              width: '100%',
              padding: '36px 28px'
            }}>
              <div style={{ fontSize: '4rem', textAlign: 'center', marginBottom: '20px' }}>↩️</div>
              
              <h2 style={{ 
                fontSize: '1.75rem', 
                fontWeight: 'bold', 
                textAlign: 'center',
                marginBottom: '16px',
                color: '#f59e0b'
              }}>
                Desfazer Última Ação?
              </h2>
              
              <p style={{ 
                fontSize: '0.95rem', 
                color: '#666',
                textAlign: 'center',
                marginBottom: '20px',
                lineHeight: '1.6'
              }}>
                Esta ação irá:
              </p>

              <div style={{
                background: '#fef3c7',
                border: '2px solid #f59e0b',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px',
                fontSize: '0.9rem',
                lineHeight: '1.8'
              }}>
                <div style={{ marginBottom: '8px' }}>🔄 Restaurar a fila para o estado <strong>anterior</strong></div>
                <div style={{ marginBottom: '8px' }}>❌ Desfazer o último resultado confirmado</div>
                <div>🔙 Retornar os times para suas posições antes da rotação</div>
              </div>

              <div style={{
                background: '#fee2e2',
                border: '2px solid #dc2626',
                borderRadius: '12px',
                padding: '14px',
                marginBottom: '24px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#dc2626', marginBottom: '4px' }}>
                  ⚠️ ATENÇÃO
                </div>
                <div style={{ fontSize: '0.85rem', color: '#991b1b', lineHeight: '1.5' }}>
                  Esta ação <strong>NÃO PODE SER DESFEITA</strong>.<br/>
                  Certifique-se de que realmente deseja desfazer esta partida.
                </div>
              </div>

              {/* Botões */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => {
                    setShowDesfazerModal(false);
                  }}
                  style={{
                    flex: 1,
                    padding: '14px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    background: '#fff',
                    color: '#666',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarDesfazer}
                  style={{
                    flex: 1,
                    padding: '14px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    border: 'none',
                    borderRadius: '10px',
                    background: '#f59e0b',
                    color: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  Continuar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Desfazer - Confirmar Senha */}
        {showDesfazerSenhaModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2001,
            padding: '20px'
          }}>
            <div style={{
              backgroundColor: '#fff',
              borderRadius: '20px',
              maxWidth: '450px',
              width: '100%',
              padding: '36px 28px'
            }}>
              <div style={{ fontSize: '3.5rem', textAlign: 'center', marginBottom: '20px' }}>🔐</div>
              
              <h2 style={{ 
                fontSize: '1.5rem', 
                fontWeight: 'bold', 
                textAlign: 'center',
                marginBottom: '12px',
                color: '#1a1a1a'
              }}>
                Confirme sua Senha
              </h2>
              
              <p style={{ 
                fontSize: '0.9rem', 
                color: '#666',
                textAlign: 'center',
                marginBottom: '28px'
              }}>
                Digite sua senha para confirmar o desfazer
              </p>

              <input
                type="password"
                value={senhaDesfazer}
                onChange={(e) => setSenhaDesfazer(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') desfazerUltimaPartida();
                }}
                placeholder="Digite sua senha"
                autoFocus
                style={{
                  width: '100%',
                  padding: '14px',
                  fontSize: '1rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '10px',
                  marginBottom: '20px',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#f59e0b'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />

              {/* Botões */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => {
                    setShowDesfazerSenhaModal(false);
                    setSenhaDesfazer('');
                  }}
                  style={{
                    flex: 1,
                    padding: '14px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    background: '#fff',
                    color: '#666',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={desfazerUltimaPartida}
                  disabled={!senhaDesfazer}
                  style={{
                    flex: 1,
                    padding: '14px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    border: 'none',
                    borderRadius: '10px',
                    background: senhaDesfazer ? '#f59e0b' : '#e5e7eb',
                    color: senhaDesfazer ? '#fff' : '#999',
                    cursor: senhaDesfazer ? 'pointer' : 'not-allowed'
                  }}
                >
                  Desfazer Partida
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Confirmação de Resultado */}
      {showModalResultado && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
          }}>
            <h2 style={{
              margin: '0 0 20px 0',
              fontSize: '1.5rem',
              color: '#333',
              textAlign: 'center'
            }}>
              Confirmar Resultado
            </h2>
            
            <p style={{
              margin: '0 0 20px 0',
              fontSize: '1.2rem',
              color: '#333',
              textAlign: 'center',
              fontWeight: '700'
            }}>
              {resultadoSelecionado === 'A' && (
                <>
                  <span style={{ color: '#007bff', fontSize: '1.4rem' }}>Time 1</span> venceu a partida?
                </>
              )}
              {resultadoSelecionado === 'B' && (
                <>
                  <span style={{ color: '#28a745', fontSize: '1.4rem' }}>Time 2</span> venceu a partida?
                </>
              )}
              {resultadoSelecionado === null && 'A partida terminou empatada?'}
            </p>

            {/* Informações sobre vitórias consecutivas e regras */}
            {regras.vitorias_consecutivas && regras.vitorias_consecutivas > 0 && (
              <div style={{
                background: '#f8f9fa',
                border: '2px solid #e9ecef',
                borderRadius: '8px',
                padding: '15px',
                marginBottom: '20px',
                fontSize: '0.9rem',
                lineHeight: '1.6',
                textAlign: 'center'
              }}>
                {resultadoSelecionado === 'A' && (
                  <>
                    <div style={{ 
                      marginBottom: '10px',
                      fontSize: '1.1rem',
                      fontWeight: 'bold',
                      color: '#333'
                    }}>
                      🏆 Vitórias Consecutivas: <span style={{ color: '#007bff' }}>{vitoriasConsecutivasAtual + 1}/{regras.vitorias_consecutivas}</span>
                    </div>
                    {vitoriasConsecutivasAtual + 1 >= regras.vitorias_consecutivas ? (
                      <div style={{ color: '#dc3545', fontWeight: '600' }}>
                        {console.log('🎯 LIMITE ATINGIDO! vitórias:', vitoriasConsecutivasAtual + 1, 'regra:', regras.prioridade_retorno)}
                        ⚠️ <strong>Limite atingido!</strong>
                        <div style={{ color: '#333', fontSize: '0.95rem', marginTop: '10px', lineHeight: '1.6' }}>
                          {regras.prioridade_retorno === 'perdedor_continua' ? (
                            <>→ <strong>Time 1 (vencedor) sai</strong></>
                          ) : (
                            <>→ <strong>Ambos os times saem</strong></>
                          )}
                        </div>
                        <div style={{ color: '#666', fontSize: '0.9rem', marginTop: '5px', fontWeight: '500' }}>
                          {regras.prioridade_retorno === 'prioridade' && '🔄 Vencedor retorna primeiro à fila'}
                          {regras.prioridade_retorno === 'sem_prioridade' && '🔄 Perdedor retorna primeiro à fila'}
                          {regras.prioridade_retorno === 'mesclar' && '🔀 Times são mesclados no retorno'}
                          {regras.prioridade_retorno === 'perdedor_continua' && '⚡ Time 2 (perdedor) continua jogando'}
                          {regras.prioridade_retorno === 'vencedor_antes' && '🔄 Vencedor retorna primeiro à fila'}
                          {!regras.prioridade_retorno && '🔄 Aplicando regra padrão'}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ color: '#28a745', fontSize: '1rem', fontWeight: '600', marginTop: '5px' }}>
                          ✓ <span style={{ color: '#007bff' }}>Time 1</span> continua jogando
                        </div>
                        <div style={{ color: '#666', fontSize: '0.85rem', marginTop: '5px' }}>
                          → Time 2 sai e volta ao final da fila
                        </div>
                      </div>
                    )}
                  </>
                )}
                {resultadoSelecionado === 'B' && (
                  <>
                    <div style={{ color: '#666', fontSize: '1rem', fontWeight: '600', marginBottom: '5px' }}>
                      🔄 Time 2 venceu!
                    </div>
                    <div style={{ color: '#333', fontSize: '0.9rem', marginTop: '8px' }}>
                      → <span style={{ color: '#007bff' }}>Time 1</span> sai e volta ao final da fila
                    </div>
                    <div style={{ color: '#333', fontSize: '0.9rem', marginTop: '3px' }}>
                      → <span style={{ color: '#28a745' }}>Time 2</span> continua jogando
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#999', marginTop: '8px' }}>
                      (Vitórias consecutivas resetadas)
                    </div>
                  </>
                )}
                {resultadoSelecionado === null && (
                  <div>
                    {console.log('🔍 DEBUG EMPATE - regra_empate:', regras.regra_empate)}
                    {console.log('🔍 DEBUG EMPATE - regra_apos_empate:', regras.regra_apos_empate)}
                    {console.log('🔍 DEBUG EMPATE - empate_conta_vitoria:', regras.empate_conta_vitoria)}
                    <div style={{ color: '#333', fontSize: '0.95rem', fontWeight: '600', marginBottom: '8px' }}>
                      🤝 Empate
                    </div>
                    
                    {/* Se for DESEMPATE no final da partida, não mostra "ambos saem" */}
                    {regras.regra_empate !== 'desempate' && (
                      <div style={{ color: '#333', fontSize: '0.95rem', fontWeight: '600', marginBottom: '5px' }}>
                        → Ambos os times saem
                      </div>
                    )}
                    
                    {/* Regra: Desempate decide retorno */}
                    {regras.regra_empate === 'desempate' ? (
                      <div style={{ marginTop: '15px' }}>
                        {console.log('✅ MOSTRANDO DESEMPATE')}
                        <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '5px', fontWeight: '600' }}>
                          ⚽ Desempate no final da partida
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#999', marginBottom: '10px' }}>
                          Selecione o time que venceu o desempate:
                        </div>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                          <button
                            onClick={() => setVencedorDesempate('A')}
                            style={{
                              padding: '10px 20px',
                              fontSize: '0.95rem',
                              fontWeight: '600',
                              border: vencedorDesempate === 'A' ? '3px solid #007bff' : '2px solid #ddd',
                              borderRadius: '8px',
                              background: vencedorDesempate === 'A' ? '#e7f3ff' : '#fff',
                              color: vencedorDesempate === 'A' ? '#007bff' : '#666',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            Time 1
                          </button>
                          <button
                            onClick={() => setVencedorDesempate('B')}
                            style={{
                              padding: '10px 20px',
                              fontSize: '0.95rem',
                              fontWeight: '600',
                              border: vencedorDesempate === 'B' ? '3px solid #28a745' : '2px solid #ddd',
                              borderRadius: '8px',
                              background: vencedorDesempate === 'B' ? '#e7f8ed' : '#fff',
                              color: vencedorDesempate === 'B' ? '#28a745' : '#666',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            Time 2
                          </button>
                        </div>
                      </div>
                    ) : regras.regra_apos_empate === 'mesclar' || regras.regra_apos_empate === 'mesclar_times' || !regras.regra_apos_empate ? (
                      <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '10px', fontWeight: '600' }}>
                        {console.log('✅ MOSTRANDO MESCLAR')}
                        🔀 Os times serão mesclados aleatoriamente
                      </div>
                    ) : regras.regra_apos_empate === 'vencedor_antes' ? (
                      <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '10px', fontWeight: '600' }}>
                        {console.log('✅ MOSTRANDO VENCEDOR ANTES')}
                        🔄 Time 1 retorna primeiro à fila
                      </div>
                    ) : regras.regra_apos_empate === 'perdedor_antes' ? (
                      <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '10px', fontWeight: '600' }}>
                        {console.log('✅ MOSTRANDO PERDEDOR ANTES')}
                        🔄 Time 2 retorna primeiro à fila
                      </div>
                    ) : (
                      <div>
                        {console.log('❌ NENHUMA CONDIÇÃO ATENDIDA')}
                      </div>
                    )}
                    
                    {/* Mensagem sobre vitórias consecutivas */}
                    {regras.regra_empate === 'desempate' && regras.empate_conta_vitoria ? (
                      <div style={{ fontSize: '0.8rem', color: '#28a745', marginTop: '10px', fontWeight: '600' }}>
                        ✓ Empate conta como vitória consecutiva
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '10px' }}>
                        (Vitórias consecutivas resetadas)
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Caso não tenha limite configurado */}
            {(!regras.vitorias_consecutivas || regras.vitorias_consecutivas === 0) && (
              <div style={{
                background: '#f8f9fa',
                border: '2px solid #e9ecef',
                borderRadius: '8px',
                padding: '15px',
                marginBottom: '20px',
                fontSize: '1rem',
                color: '#666',
                textAlign: 'center',
                fontWeight: '600'
              }}>
                {resultadoSelecionado === 'A' && (
                  <>
                    ✓ <span style={{ color: '#007bff' }}>Time 1</span> continua jogando
                  </>
                )}
                {resultadoSelecionado === 'B' && (
                  <>
                    🔄 <span style={{ color: '#28a745' }}>Time 2</span> vence: troca de posições
                  </>
                )}
                {resultadoSelecionado === null && (
                  <div style={{ fontSize: '0.95rem' }}>
                    <div>🤝 <strong>Empate: Ambos os times saem</strong></div>
                    <div style={{ fontSize: '0.85rem', marginTop: '5px' }}>
                      {regras.regra_apos_empate === 'mesclar' && '🔀 Mescla aleatória'}
                      {regras.regra_apos_empate === 'vencedor_antes' && '🔄 Time 1 retorna primeiro'}
                      {regras.regra_apos_empate === 'perdedor_antes' && '🔄 Time 2 retorna primeiro'}
                      {!regras.regra_apos_empate && '🔀 Times mesclados'}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{
              display: 'flex',
              gap: '15px',
              justifyContent: 'center'
            }}>
              <button
                onClick={cancelarResultado}
                style={{
                  padding: '12px 30px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Cancelar
              </button>
              
              <button
                onClick={confirmarResultado}
                disabled={resultadoSelecionado === null && regras.regra_apos_empate === 'desempate' && !vencedorDesempate}
                style={{
                  padding: '12px 30px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  backgroundColor: (resultadoSelecionado === null && regras.regra_apos_empate === 'desempate' && !vencedorDesempate) ? '#ccc' :
                                   resultadoSelecionado === 'A' ? '#007bff' : 
                                   resultadoSelecionado === 'B' ? '#28a745' : '#ffc107',
                  color: resultadoSelecionado === null ? '#333' : 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: (resultadoSelecionado === null && regras.regra_apos_empate === 'desempate' && !vencedorDesempate) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: (resultadoSelecionado === null && regras.regra_apos_empate === 'desempate' && !vencedorDesempate) ? 0.6 : 1
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
      
      </>
      )}
    </>
  );
}