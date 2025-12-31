'use client';

import React, { useState, useEffect } from 'react';
import { supabase, validarSenhaPelada, jogadoresService } from '../../lib/supabase';
import { usePermissions } from '../../lib/usePermissions';
import { useAdInterstitial } from '../../lib/useAdInterstitial';
import AdInterstitial from '../../components/AdInterstitial';
import { getRegrasWithCache, isOnline, onConnectionChange } from '../../lib/cacheService';
import { addToSyncQueue, syncQueue, getSyncQueueCount } from '../../lib/syncService';

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
  tempo_partida?: number;
}

export default function FilaPage() {
  const { possuiPermissao, plano } = usePermissions();
  const { shouldShowInterstitial, resetInterstitial, showAdOnPeladaEnd, showAdOnPartidaEnd } = useAdInterstitial();
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
  
  // States para desfazer última partida
  const [showDesfazerModal, setShowDesfazerModal] = useState(false);
  const [showDesfazerSenhaModal, setShowDesfazerSenhaModal] = useState(false);
  const [senhaDesfazer, setSenhaDesfazer] = useState('');
  const [ultimaPartida, setUltimaPartida] = useState<any>(null);
  const [tipoAcaoDesfazer, setTipoAcaoDesfazer] = useState<'partida' | 'edicao' | null>(null);
  
  // States para desfazer edição
  const [showDesfazerSenhaModalEdicao, setShowDesfazerSenhaModalEdicao] = useState(false);
  const [senhaDesfazerEdicao, setSenhaDesfazerEdicao] = useState('');

  // State para controlar loading durante finalização
  const [finalizandoPartida, setFinalizandoPartida] = useState(false);

  // States para modo edição
  const [modoEdicao, setModoEdicao] = useState(false);
  const [jogadorSelecionadoTroca, setJogadorSelecionadoTroca] = useState<JogadorFila | null>(null);
  const [jogadorParaTroca, setJogadorParaTroca] = useState<JogadorFila | null>(null);
  const [partidaAtiva, setPartidaAtiva] = useState<any>(null);
  const [mudancasPendentes, setMudancasPendentes] = useState<any[]>([]);
  const [showConfirmarSubstituicoesModal, setShowConfirmarSubstituicoesModal] = useState(false);
  const [showConfirmarTrocaModal, setShowConfirmarTrocaModal] = useState(false);
  const [showSelecionarJogadorModal, setShowSelecionarJogadorModal] = useState(false);
  const [posicaoParaAdicionar, setPosicaoParaAdicionar] = useState<number | null>(null);
  
  // States para confirmar mudança de posição
  const [showConfirmarMudancaPosicaoModal, setShowConfirmarMudancaPosicaoModal] = useState(false);
  const [jogadorMoverPosicao, setJogadorMoverPosicao] = useState<JogadorFila | null>(null);
  const [posicaoDestino, setPosicaoDestino] = useState<number | null>(null);
  
  // State para modal de resumo de mudanças
  const [showResumoMudancasModal, setShowResumoMudancasModal] = useState(false);

  // States para modo de sincronização
  const [modoSincronizacao, setModoSincronizacao] = useState<'tempo_real' | 'local_first'>('tempo_real');
  const [statusOnline, setStatusOnline] = useState(true);
  const [itensPendentesSync, setItensPendentesSync] = useState(0);
  const [sincronizando, setSincronizando] = useState(false);

  // States para modo partida
  const [modoPartida, setModoPartida] = useState(false);
  const [cronometro, setCronometro] = useState(0);
  const [cronometroAtivo, setCronometroAtivo] = useState(false);
  const [placarTimeA, setPlacarTimeA] = useState(0);
  const [placarTimeB, setPlacarTimeB] = useState(0);
  const [corTimeA, setCorTimeA] = useState('#dc3545'); // Vermelho
  const [corTimeB, setCorTimeB] = useState('#000000'); // Preto
  const [selecionandoGolPara, setSelecionandoGolPara] = useState<'A' | 'B' | null>(null);
  const [golsJogadores, setGolsJogadores] = useState<Record<string, number>>({});
  const [historicoAcoes, setHistoricoAcoes] = useState<Array<{tipo: 'gol', time: 'A' | 'B', jogadorId: string}>>([]);
  const [showModalVAR, setShowModalVAR] = useState(false);
  const [showModalFinalizacao, setShowModalFinalizacao] = useState(false);
  const [limiteVitorias, setLimiteVitorias] = useState<number | null>(null);
  const [vitoriaConsecutiva, setVitoriaConsecutiva] = useState(0);
  const [prioridadeRetorno, setPrioridadeRetorno] = useState<string>('');

  // States para modo prancheta (versão simplificada sem estatísticas)
  const [modoPrancheta, setModoPrancheta] = useState(false);

  // States para controle de desempate
  const [showModalDesempate, setShowModalDesempate] = useState(false);
  const [vencedorDesempate, setVencedorDesempate] = useState<'A' | 'B' | null>(null);
  const [regraEmpateConfig, setRegraEmpateConfig] = useState<string>('');
  const [empateContaVitoriaConfig, setEmpateContaVitoriaConfig] = useState<boolean>(false);
  const [timeEscolhidoDesempate, setTimeEscolhidoDesempate] = useState<'A' | 'B' | null>(null);

  // States para regras de empate (compatível com modal de /partida)
  const [regrasEmpate, setRegrasEmpate] = useState<{
    empate_modo: string | null;
    empate_retorno: string | null;
    desempate_modo: string | null;
    empate_conta_vitoria: boolean;
  }>({ empate_modo: null, empate_retorno: null, desempate_modo: null, empate_conta_vitoria: false });

  // States para controle de sessão e pelada
  const [sessaoAtual, setSessaoAtual] = useState<any>(null);
  const [peladaIdAtual, setPeladaIdAtual] = useState<string>('');

  // State para modal de sucesso ao encerrar pelada
  const [showModalSucessoEncerrar, setShowModalSucessoEncerrar] = useState(false);

  // State para modal de limite FREE atingido
  const [showModalLimiteFree, setShowModalLimiteFree] = useState(false);

  // States para modais informativos de partidas e gols
  const [showModalInfoPartidas, setShowModalInfoPartidas] = useState(false);
  const [showModalInfoGols, setShowModalInfoGols] = useState(false);
  const [partidasDoDia, setPartidasDoDia] = useState<any[]>([]);
  const [artilheirosDoDia, setArtilheirosDoDia] = useState<{nome: string; gols: number}[]>([]);
  const [semGolsDoDia, setSemGolsDoDia] = useState<string[]>([]);

  // Alternar cores dos times
  const alternarCorTimeA = () => {
    const cores = ['#dc3545', '#000000', '#FFFFFF', '#fbbf24', '#3b82f6', '#10b981'];
    const indiceAtual = cores.indexOf(corTimeA);
    const proximoIndice = (indiceAtual + 1) % cores.length;
    setCorTimeA(cores[proximoIndice]);
  };

  const alternarCorTimeB = () => {
    const cores = ['#000000', '#dc3545', '#FFFFFF', '#fbbf24', '#3b82f6', '#10b981'];
    const indiceAtual = cores.indexOf(corTimeB);
    const proximoIndice = (indiceAtual + 1) % cores.length;
    setCorTimeB(cores[proximoIndice]);
  };

  // Função para obter o nome da cor baseado no código hexadecimal
  const obterNomeCor = (cor: string): string => {
    const nomesCores: Record<string, string> = {
      '#dc3545': 'Vermelho',
      '#000000': 'Preto',
      '#FFFFFF': 'Branco',
      '#fbbf24': 'Amarelo',
      '#3b82f6': 'Azul',
      '#10b981': 'Verde'
    };
    return nomesCores[cor] || 'Time';
  };

  // ========================================
  // SISTEMA DE ROTAÇÃO DA FILA
  // ========================================

  // Buscar fila atual ordenada
  const buscarFilaAtual = async (peladaId: string, sessaoId: string) => {
    const { data, error } = await supabase
      .from('fila')
      .select('*')
      .eq('pelada_id', peladaId)
      .eq('sessao_id', sessaoId)
      .eq('status', 'fila')
      .order('posicao_fila', { ascending: true });

    if (error) throw error;
    return data || [];
  };

  // Atualizar posições na fila
  const atualizarPosicoesFila = async (peladaId: string, sessaoId: string, novaFila: any[], vitoriasNovoTime1: number = 0) => {
    for (let i = 0; i < novaFila.length; i++) {
      await supabase
        .from('fila')
        .update({ 
          posicao_fila: i + 1,
          vitorias_consecutivas_time: (i < regras.jogadores_por_time) ? vitoriasNovoTime1 : 0
        })
        .eq('jogador_id', novaFila[i].jogador_id)
        .eq('pelada_id', peladaId)
        .eq('sessao_id', sessaoId);
    }
  };

  // Obter vitórias consecutivas atuais do Time 1
  const getVitoriasConsecutivas = async (peladaId: string, sessaoId: string) => {
    const fila = await buscarFilaAtual(peladaId, sessaoId);
    if (fila.length === 0) return 0;
    return fila[0]?.vitorias_consecutivas_time || 0;
  };

  // Resetar todas vitórias da fila
  const resetarTodasVitorias = async (peladaId: string, sessaoId: string) => {
    await supabase
      .from('fila')
      .update({ vitorias_consecutivas_time: 0 })
      .eq('pelada_id', peladaId)
      .eq('sessao_id', sessaoId);
  };

  // Função para embaralhar array
  const embaralharArray = (array: any[]) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // ROTAÇÃO: Time 1 vence (fica no campo)
  const rotacionarTime1Vence = async (peladaId: string, sessaoId: string, novasVitorias: number) => {
    const fila = await buscarFilaAtual(peladaId, sessaoId);
    const jogadoresPorTime = regras.jogadores_por_time;

    const time1 = fila.slice(0, jogadoresPorTime);
    const time2 = fila.slice(jogadoresPorTime, jogadoresPorTime * 2);
    const espera = fila.slice(jogadoresPorTime * 2);

    const proximoTime = espera.slice(0, jogadoresPorTime);
    const restoEspera = espera.slice(jogadoresPorTime);

    const novaFila = [...time1, ...proximoTime, ...restoEspera, ...time2];
    await atualizarPosicoesFila(peladaId, sessaoId, novaFila, novasVitorias);
  };

  // ROTAÇÃO: Time 2 vence (vira novo Time 1)
  const rotacionarTime2Vence = async (peladaId: string, sessaoId: string) => {
    const fila = await buscarFilaAtual(peladaId, sessaoId);
    const jogadoresPorTime = regras.jogadores_por_time;

    const time1 = fila.slice(0, jogadoresPorTime);
    const time2 = fila.slice(jogadoresPorTime, jogadoresPorTime * 2);
    const espera = fila.slice(jogadoresPorTime * 2);

    const proximoTime = espera.slice(0, jogadoresPorTime);
    const restoEspera = espera.slice(jogadoresPorTime);

    const novaFila = [...time2, ...proximoTime, ...restoEspera, ...time1];
    await atualizarPosicoesFila(peladaId, sessaoId, novaFila, 1); // Novo Time 1 começa com 1 vitória
  };

  // ROTAÇÃO: Ambos saem - Vencedor retorna antes
  const rotacionarVencedorAntes = async (peladaId: string, sessaoId: string, timeVencedor: 'A' | 'B') => {
    const fila = await buscarFilaAtual(peladaId, sessaoId);
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

    await atualizarPosicoesFila(peladaId, sessaoId, novaFila, 0);
  };

  // ROTAÇÃO: Ambos saem - Perdedor retorna antes
  const rotacionarPerdedorAntes = async (peladaId: string, sessaoId: string, timePerdedor: 'A' | 'B') => {
    const fila = await buscarFilaAtual(peladaId, sessaoId);
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

    await atualizarPosicoesFila(peladaId, sessaoId, novaFila, 0);
  };

  // ROTAÇÃO: Ambos saem - Mesclar times (embaralhar)
  const rotacionarMesclarTimes = async (peladaId: string, sessaoId: string) => {
    const fila = await buscarFilaAtual(peladaId, sessaoId);
    const jogadoresPorTime = regras.jogadores_por_time;

    // Time 1 e Time 2 que estavam jogando (primeiros 2 times)
    const time1 = fila.slice(0, jogadoresPorTime);
    const time2 = fila.slice(jogadoresPorTime, jogadoresPorTime * 2);
    
    // Todos os jogadores que estavam esperando
    const espera = fila.slice(jogadoresPorTime * 2);

    // Próximos 2 times que vão entrar
    const proximoTime1 = espera.slice(0, jogadoresPorTime);
    const proximoTime2 = espera.slice(jogadoresPorTime, jogadoresPorTime * 2);
    
    // Resto da fila que continua esperando
    const restoEspera = espera.slice(jogadoresPorTime * 2);

    // Embaralhar APENAS os jogadores dos 2 times que saíram
    const timesEmbaralhados = embaralharArray([...time1, ...time2]);

    // Nova ordem: próximos 2 times entram + resto da espera + times embaralhados no final
    const novaFila = [...proximoTime1, ...proximoTime2, ...restoEspera, ...timesEmbaralhados];
    
    console.log('🔀 Mesclar Times:');
    console.log('  - Times que saíram e foram embaralhados:', time1.length + time2.length, 'jogadores');
    console.log('  - Próximos times que entram:', proximoTime1.length + proximoTime2.length, 'jogadores');
    console.log('  - Resto da fila:', restoEspera.length, 'jogadores');
    
    await atualizarPosicoesFila(peladaId, sessaoId, novaFila, 0);
  };

  // ROTAÇÃO: PERDEDOR continua jogando
  const rotacionarPerdedorContinua = async (peladaId: string, sessaoId: string, timePerdedor: 'A' | 'B') => {
    const fila = await buscarFilaAtual(peladaId, sessaoId);
    const jogadoresPorTime = regras.jogadores_por_time;

    const time1 = fila.slice(0, jogadoresPorTime);
    const time2 = fila.slice(jogadoresPorTime, jogadoresPorTime * 2);
    const espera = fila.slice(jogadoresPorTime * 2);

    const proximoTime = espera.slice(0, jogadoresPorTime);
    const restoEspera = espera.slice(jogadoresPorTime);

    let novaFila;
    if (timePerdedor === 'A') {
      // Time 1 (perdedor) continua, Time 2 (vencedor) sai
      novaFila = [...time1, ...proximoTime, ...restoEspera, ...time2];
    } else {
      // Time 2 (perdedor) continua, Time 1 (vencedor) sai
      novaFila = [...proximoTime, ...time2, ...restoEspera, ...time1];
    }

    await atualizarPosicoesFila(peladaId, sessaoId, novaFila, 0);
  };

  // ROTAÇÃO: Desempate decide qual time retorna primeiro (ambos saem)
  const rotacionarDesempateDecide = async (peladaId: string, sessaoId: string, timePrioridade: 'A' | 'B') => {
    const fila = await buscarFilaAtual(peladaId, sessaoId);
    const jogadoresPorTime = regras.jogadores_por_time;

    const time1 = fila.slice(0, jogadoresPorTime);
    const time2 = fila.slice(jogadoresPorTime, jogadoresPorTime * 2);
    const espera = fila.slice(jogadoresPorTime * 2);

    const proximoTime1 = espera.slice(0, jogadoresPorTime);
    const proximoTime2 = espera.slice(jogadoresPorTime, jogadoresPorTime * 2);
    const restoEspera = espera.slice(jogadoresPorTime * 2);

    let novaFila;
    if (timePrioridade === 'A') {
      // Time A selecionado volta primeiro, Time B depois
      novaFila = [...proximoTime1, ...proximoTime2, ...restoEspera, ...time1, ...time2];
    } else {
      // Time B selecionado volta primeiro, Time A depois
      novaFila = [...proximoTime1, ...proximoTime2, ...restoEspera, ...time2, ...time1];
    }

    console.log('🔄 Desempate Decide:', {
      timePrioridade,
      time1Jogadores: time1.map(j => j.nome),
      time2Jogadores: time2.map(j => j.nome),
      novaOrdem: novaFila.map(j => j.nome)
    });

    await atualizarPosicoesFila(peladaId, sessaoId, novaFila, 0);
  };

  // ORQUESTRADOR PRINCIPAL DA ROTAÇÃO
  const rotacionarFila = async (peladaId: string, sessaoId: string, timeVencedor: 'A' | 'B' | null, timeDesempateEscolhido?: 'A' | 'B' | null) => {
    try {
      const vitoriasAtuais = await getVitoriasConsecutivas(peladaId, sessaoId);
      
      // Buscar regras
      const { data: regrasData } = await supabase
        .from('regras')
        .select('*')
        .eq('pelada_id', peladaId)
        .single();

      console.log('📋 Regras carregadas:', regrasData);

      const limiteVitoriasConfig = (regrasData?.vitorias_consecutivas && regrasData.vitorias_consecutivas > 0) ? regrasData.vitorias_consecutivas : null;
      const regraAposLimite = regrasData?.prioridade_retorno || 'prioridade';
      
      console.log('🔄 Regra após limite:', regraAposLimite);
      console.log('🎯 Limite de vitórias:', limiteVitoriasConfig);

      // === CENÁRIO: EMPATE ===
      if (timeVencedor === null) {
        console.log('🤝 EMPATE detectado!');
        
        const regraEmpate = regrasData?.regra_empate || 'ambos_saem';
        const regraAposEmpate = regrasData?.regra_apos_empate;
        
        console.log('📋 Regra de empate:', regraEmpate);
        console.log('📋 Tipo da regra_empate:', typeof regraEmpate);
        console.log('📋 Comprimento:', regraEmpate?.length);
        console.log('📋 Comparação ambos_saem:', regraEmpate === 'ambos_saem');
        console.log('📋 Regra após empate:', regraAposEmpate);
        
        await resetarTodasVitorias(peladaId, sessaoId);
        
        // Se regra é "ambos_saem", aplicar a regra de retorno
        if (regraEmpate === 'ambos_saem') {
          if (regraAposEmpate === 'mesclar') {
            console.log('🔀 Aplicando: AMBOS SAEM + MESCLAR');
            await rotacionarMesclarTimes(peladaId, sessaoId);
          } else if (regraAposEmpate === 'desempate_decide') {
            console.log('🎯 Aplicando: AMBOS SAEM + DESEMPATE DECIDE');
            if (timeDesempateEscolhido) {
              console.log('✅ Time escolhido para retornar primeiro:', timeDesempateEscolhido);
              await rotacionarDesempateDecide(peladaId, sessaoId, timeDesempateEscolhido);
            } else {
              console.log('⚠️ Nenhum time escolhido, aplicando mesclar como fallback');
              await rotacionarMesclarTimes(peladaId, sessaoId);
            }
          } else {
            console.log('⚠️ Regra após empate não definida ou inválida:', regraAposEmpate);
            console.log('⚠️ Use "mesclar" ou "desempate_decide"');
            await rotacionarMesclarTimes(peladaId, sessaoId);
          }
        } else {
          // Se não é "ambos_saem", é desempate na própria partida (1 time fica)
          if (timeDesempateEscolhido) {
            console.log('⚡ DESEMPATE: Time', timeDesempateEscolhido, 'continua jogando');
            
            // Rotacionar: time escolhido FICA, outro SAI
            const fila = await buscarFilaAtual(peladaId, sessaoId);
            const jogadoresPorTime = regras.jogadores_por_time;

            const time1 = fila.slice(0, jogadoresPorTime);
            const time2 = fila.slice(jogadoresPorTime, jogadoresPorTime * 2);
            const espera = fila.slice(jogadoresPorTime * 2);

            const proximoTime = espera.slice(0, jogadoresPorTime);
            const restoEspera = espera.slice(jogadoresPorTime);

            let novaFila;
            if (timeDesempateEscolhido === 'A') {
              // Time A (vencedor) FICA na posição 1, Time B SAI, próximo ENTRA
              novaFila = [...time1, ...proximoTime, ...restoEspera, ...time2];
              console.log('✅ Time A fica, Time B sai');
            } else {
              // Time B (vencedor) FICA, Time A SAI, próximo ENTRA
              novaFila = [...time2, ...proximoTime, ...restoEspera, ...time1];
              console.log('✅ Time B fica, Time A sai');
            }
            
            // Se empate conta como vitória, incrementar contador do time que ficou
            let novasVitorias = 0;
            if (regrasData?.empate_conta_vitoria) {
              console.log('📊 Empate conta como vitória - atualizando contador');
              const vitoriasAtuais = fila[0]?.vitorias_consecutivas_time || 0;
              novasVitorias = vitoriasAtuais + 1;
            }
            
            await atualizarPosicoesFila(peladaId, sessaoId, novaFila, novasVitorias);
          } else {
            console.log('⚠️ Desempate requer seleção de time vencedor');
          }
        }
        
        return;
      }

      // === CENÁRIO: TIME 2 VENCE ===
      if (timeVencedor === 'B') {
        await resetarTodasVitorias(peladaId, sessaoId);
        await rotacionarTime2Vence(peladaId, sessaoId);
        return;
      }

      // === CENÁRIO: TIME 1 VENCE ===
      const novasVitorias = vitoriasAtuais + 1;
      console.log(`⚽ Time 1 venceu! Vitórias: ${vitoriasAtuais} → ${novasVitorias}`);
      console.log(`📊 Limite configurado: ${limiteVitoriasConfig}`);

      // Verifica se atingiu limite
      if (limiteVitoriasConfig && novasVitorias >= limiteVitoriasConfig) {
        console.log(`🚨 LIMITE ATINGIDO! Aplicando regra: ${regraAposLimite}`);
        await resetarTodasVitorias(peladaId, sessaoId);
        
        if (regraAposLimite === 'prioridade') {
          console.log('🔄 Chamando rotacionarVencedorAntes(A)');
          await rotacionarVencedorAntes(peladaId, sessaoId, 'A');
        } else if (regraAposLimite === 'sem_prioridade') {
          console.log('🔄 Chamando rotacionarPerdedorAntes(B)');
          await rotacionarPerdedorAntes(peladaId, sessaoId, 'B');
        } else if (regraAposLimite === 'mesclar') {
          console.log('🔄 Chamando rotacionarMesclarTimes()');
          await rotacionarMesclarTimes(peladaId, sessaoId);
        } else if (regraAposLimite === 'perdedor_continua') {
          console.log('🔄 Aplicando regra: PERDEDOR continua jogando');
          await rotacionarPerdedorContinua(peladaId, sessaoId, 'B');
        }
      } else {
        console.log('✅ Limite não atingido - Time 1 continua');
        // Não atingiu limite - Time 1 fica
        await rotacionarTime1Vence(peladaId, sessaoId, novasVitorias);
      }

    } catch (error) {
      console.error('Erro ao rotacionar fila:', error);
      throw error;
    }
  };

  // Cronômetro da partida (contagem regressiva)
  useEffect(() => {
    let intervalo: NodeJS.Timeout;
    if (cronometroAtivo && cronometro > 0) {
      intervalo = setInterval(() => {
        setCronometro(prev => {
          if (prev <= 1) {
            setCronometroAtivo(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalo);
  }, [cronometroAtivo, cronometro]);

  // Formatar tempo do cronômetro
  const formatarTempo = (segundos: number) => {
    const mins = Math.floor(segundos / 60);
    const secs = segundos % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calcular prévia de vitórias consecutivas
  const calcularPreviaVitorias = () => {
    const empate = placarTimeA === placarTimeB;
    
    // Se empate com time escolhido (desempate_decide) e conta como vitória
    if (empate && timeEscolhidoDesempate && empateContaVitoriaConfig) {
      const novasVitorias = vitoriaConsecutiva + 1;
      return {
        vitorias: novasVitorias,
        time: timeEscolhidoDesempate === 'A' ? obterNomeCor(corTimeA).toUpperCase() : obterNomeCor(corTimeB).toUpperCase(),
        cor: timeEscolhidoDesempate === 'A' ? corTimeA : corTimeB
      };
    }
    
    // Se empate com vencedor do desempate (para manter compatibilidade)
    if (empate && vencedorDesempate && empateContaVitoriaConfig) {
      const novasVitorias = vitoriaConsecutiva + 1;
      return {
        vitorias: novasVitorias,
        time: vencedorDesempate === 'A' ? obterNomeCor(corTimeA).toUpperCase() : obterNomeCor(corTimeB).toUpperCase(),
        cor: vencedorDesempate === 'A' ? corTimeA : corTimeB
      };
    }
    
    // Se empate sem desempate, reseta contador
    if (empate) {
      return {
        vitorias: 0,
        time: null,
        cor: '#6b7280'
      };
    }
    
    // Se Time 1 venceu
    if (placarTimeA > placarTimeB) {
      const novasVitorias = vitoriaConsecutiva + 1;
      return {
        vitorias: novasVitorias,
        time: obterNomeCor(corTimeA).toUpperCase(),
        cor: corTimeA
      };
    }
    
    // Se Time 2 venceu (interrompe sequência)
    return {
      vitorias: 1,
      time: obterNomeCor(corTimeB).toUpperCase(),
      cor: corTimeB
    };
  };

  // Função para registrar gol
  const registrarGol = (jogadorId: string, time: 'A' | 'B') => {
    // Incrementar placar
    if (time === 'A') {
      setPlacarTimeA(prev => prev + 1);
    } else {
      setPlacarTimeB(prev => prev + 1);
    }
    
    // Registrar gol do jogador
    setGolsJogadores(prev => ({
      ...prev,
      [jogadorId]: (prev[jogadorId] || 0) + 1
    }));
    
    // Adicionar ao histórico
    setHistoricoAcoes(prev => [...prev, { tipo: 'gol', time, jogadorId }]);
    
    // Desativar modo seleção
    setSelecionandoGolPara(null);
    
    console.log(`⚽ Gol registrado: Jogador ${jogadorId} do Time ${time}`);
  };

  // Função VAR - desfazer última ação
  const desfazerUltimaAcao = () => {
    if (historicoAcoes.length === 0) return;
    
    const ultimaAcao = historicoAcoes[historicoAcoes.length - 1];
    
    if (ultimaAcao.tipo === 'gol') {
      // Decrementar placar
      if (ultimaAcao.time === 'A') {
        setPlacarTimeA(prev => Math.max(0, prev - 1));
      } else {
        setPlacarTimeB(prev => Math.max(0, prev - 1));
      }
      
      // Remover gol do jogador
      setGolsJogadores(prev => ({
        ...prev,
        [ultimaAcao.jogadorId]: Math.max(0, (prev[ultimaAcao.jogadorId] || 0) - 1)
      }));
      
      // Remover do histórico
      setHistoricoAcoes(prev => prev.slice(0, -1));
      
      console.log(`🎬 VAR: Gol anulado - Jogador ${ultimaAcao.jogadorId} do Time ${ultimaAcao.time}`);
    }
  };

  // Restaurar estado do modo partida ao carregar
  useEffect(() => {
    const estadoSalvo = localStorage.getItem('modo_partida_estado');
    if (estadoSalvo) {
      try {
        const estado = JSON.parse(estadoSalvo);
        setModoPartida(true);
        setCronometro(estado.cronometro || 0);
        setCronometroAtivo(estado.cronometroAtivo || false);
        setPlacarTimeA(estado.placarTimeA || 0);
        setPlacarTimeB(estado.placarTimeB || 0);
        setCorTimeA(estado.corTimeA || '#dc3545');
        setCorTimeB(estado.corTimeB || '#000000');
        setSelecionandoGolPara(estado.selecionandoGolPara || null);
        setGolsJogadores(estado.golsJogadores || {});
        setHistoricoAcoes(estado.historicoAcoes || []);
        console.log('✅ Estado do modo partida restaurado:', estado);
      } catch (error) {
        console.error('❌ Erro ao restaurar estado do modo partida:', error);
      }
    }
  }, []);

  // Salvar estado do modo partida sempre que algo mudar
  useEffect(() => {
    if (modoPartida) {
      const estado = {
        cronometro,
        cronometroAtivo,
        placarTimeA,
        placarTimeB,
        corTimeA,
        corTimeB,
        selecionandoGolPara,
        golsJogadores,
        historicoAcoes,
        timestamp: Date.now()
      };
      localStorage.setItem('modo_partida_estado', JSON.stringify(estado));
    }
  }, [modoPartida, cronometro, cronometroAtivo, placarTimeA, placarTimeB, corTimeA, corTimeB]);

  useEffect(() => {
    carregarDados();
    
    // Verificar se deve abrir o modal automaticamente
    const params = new URLSearchParams(window.location.search);
    if (params.get('abrir') === 'modal') {
      setShowManagementModal(true);
      // Limpar o parâmetro da URL
      window.history.replaceState({}, '', '/fila');
    }
  }, []);

  // Monitorar status online/offline e sincronizar quando volta online
  useEffect(() => {
    setStatusOnline(isOnline());
    
    const cleanup = onConnectionChange((online) => {
      setStatusOnline(online);
      
      if (online && modoSincronizacao === 'local_first') {
        console.log('🌐 Conexão restaurada - iniciando sincronização...');
        handleSyncQueue();
      }
    });
    
    return cleanup;
  }, [modoSincronizacao]);

  // Atualizar contagem de itens pendentes de sync
  useEffect(() => {
    if (modoSincronizacao === 'local_first') {
      const count = getSyncQueueCount();
      setItensPendentesSync(count);
    }
  }, [modoSincronizacao]);

  // Função para sincronizar fila
  const handleSyncQueue = async () => {
    setSincronizando(true);
    try {
      await syncQueue();
      setItensPendentesSync(getSyncQueueCount());
      console.log('✅ Sincronização concluída');
    } catch (error) {
      console.error('❌ Erro na sincronização:', error);
    } finally {
      setSincronizando(false);
    }
  };

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
    console.log('🔄 Iniciando carregamento de dados...');
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
      
      console.log('📋 Carregando fila...');
      
      // 1. CARREGAR REGRAS (com cache se aplicável)
      const regrasResult = await getRegrasWithCache(peladaId);
      const regrasData = regrasResult.success ? regrasResult.data : null;
      
      if (regrasData) {
        // Definir modo de sincronização
        const modoSync = regrasData.modo_sincronizacao || 'tempo_real';
        setModoSincronizacao(modoSync);
        console.log('🔄 Modo de sincronização:', modoSync);
        
        // Armazenar tipo de modo configurado
        let tipoModo = regrasData.tipo_fila || 'modo_prancheta';
        // Compatibilizar valores antigos
        if (tipoModo === 'fila1') tipoModo = 'modo_partida';
        if (tipoModo === 'fila2') tipoModo = 'modo_prancheta';
        
        console.log('🎮 Modo configurado:', tipoModo);
        console.log('💎 Plano do usuário:', planoUsuario);
        
        // Validar se plano pode usar modo partida
        if (tipoModo === 'modo_partida' && (planoUsuario === 'free' || planoUsuario === 'gold')) {
          console.log('⚠️ Plano', planoUsuario, 'não pode usar Modo Partida. Alternando para Modo Prancheta.');
          tipoModo = 'modo_prancheta';
        }
        
        // Armazenar modo escolhido globalmente (você pode adicionar um state se precisar usar em outro lugar)
        (window as any).modoEscolhido = tipoModo;
        
        setRegras({
          jogadores_por_time: regrasData.jogadores_por_time || 5,
          tempo_partida: regrasData.duracao || 10
        });
        
        // Buscar configurações de vitórias consecutivas
        const limiteVit = (regrasData?.vitorias_consecutivas && regrasData.vitorias_consecutivas > 0) ? regrasData.vitorias_consecutivas : null;
        setLimiteVitorias(limiteVit);
        setPrioridadeRetorno(regrasData?.prioridade_retorno || '');
        console.log('🏆 Regras carregadas: times de', regrasData.jogadores_por_time, '| Tempo partida:', regrasData.duracao, 'min | Limite vitórias:', limiteVit);
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
      
      // Armazenar sessão e pelada nos states
      setSessaoAtual(sessao);
      setPeladaIdAtual(peladaId);
      
      let filaData: any[] = [];
      let todosJogadores: any[] = [];
      
      // Verificar modo de sincronização
      const modoSync = modoSincronizacao || 'tempo_real';
      
      if (modoSync === 'local_first') {
        // MODO LOCAL FIRST: Carregar do localStorage
        console.log('⚡ Modo local_first: carregando do cache local');
        
        const filaLocal = localStorage.getItem(`fila_${sessao.id}`);
        const jogadoresLocal = localStorage.getItem(`jogadores_${peladaId}`);
        
        filaData = filaLocal ? JSON.parse(filaLocal) : [];
        todosJogadores = jogadoresLocal ? JSON.parse(jogadoresLocal) : [];
        
        console.log('📊 Dados carregados do cache local');
      } else {
        // MODO TEMPO REAL: Carregar do Supabase
        console.log('🔄 Modo tempo_real: carregando do Supabase');
        
        // 🔧 MIGRAÇÃO: Converter status 'jogando' antigo para 'fila'
        console.log('🔧 Migrando dados antigos...');
        await supabase
          .from('fila')
          .update({ status: 'fila' })
          .eq('pelada_id', peladaId)
          .eq('status', 'jogando');
        console.log('✅ Migração concluída: jogando → fila');
        
        // 3. CARREGAR DA TABELA FILA (sem JOIN - igual Pelada 3)
        const { data: filaSupabase, error: filaError } = await supabase
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
        
        filaData = filaSupabase || [];
        console.log('📊 Dados da fila carregados:', filaData);
        
        // 3. CARREGAR DADOS DOS JOGADORES SEPARADAMENTE
        const { data: jogadoresSupabase, error: jogadoresError } = await supabase
          .from('jogadores')
          .select('*')
          .eq('pelada_id', peladaId);
        
        if (jogadoresError) {
          console.error('💥 Erro ao carregar jogadores:', jogadoresError);
          await carregarPorStatus(peladaId);
          return;
        }
        
        todosJogadores = jogadoresSupabase || [];
        
        // Salvar no cache local para modo local_first
        localStorage.setItem(`fila_${sessao.id}`, JSON.stringify(filaData));
        localStorage.setItem(`jogadores_${peladaId}`, JSON.stringify(todosJogadores));
      }
      
      // 5. JOGADORES NA FILA (todos com status 'fila')
      const filaItems = (filaData || []).filter(item => item.status === 'fila');
      const todosJogadoresFilaTemp = filaItems.map(item => {
        const jogador = todosJogadores.find(j => j.id === item.jogador_id);
        return {
          id: item.jogador_id,
          nome: jogador?.nome || 'Desconhecido',
          posicao_fila: item.posicao_fila || 0,
          status: 'fila' as const
        };
      });
      
      // Remover duplicatas baseado no ID antes de separar
      const todosJogadoresFila = todosJogadoresFilaTemp.filter((jogador, index, self) => 
        index === self.findIndex(j => j.id === jogador.id)
      );
      
      // Separar jogadores que estão jogando (primeiras posições) dos que estão na fila
      const jogadoresJogando = todosJogadoresFila.filter((_, index) => index < regras.jogadores_por_time * 2);
      const jogadoresFila = todosJogadoresFila.filter((_, index) => index >= regras.jogadores_por_time * 2);
      
      setJogadoresJogando(jogadoresJogando);
      setJogadoresFila(jogadoresFila);
      
      // 6. JOGADORES RESERVA (da tabela fila)
      const reservaItems = (filaData || []).filter(item => item.status === 'reserva');
      const jogadoresReservaTemp = reservaItems.map(item => {
        const jogador = todosJogadores.find(j => j.id === item.jogador_id);
        return {
          id: item.jogador_id,
          nome: jogador?.nome || 'Desconhecido',
          posicao_fila: item.posicao_fila || 0,
          status: 'reserva' as const
        };
      });
      // Remover duplicatas baseado no ID
      const jogadoresReserva = jogadoresReservaTemp.filter((jogador, index, self) => 
        index === self.findIndex(j => j.id === jogador.id)
      );
      setJogadoresReserva(jogadoresReserva);
      
      // 7. CARREGAR ESTATÍSTICAS DO LOCALSTORAGE
      const stats = localStorage.getItem('peladaStats');
      if (stats) {
        const parsedStats = JSON.parse(stats);
        setTotalPartidas(parsedStats.partidas || 0);
        setTotalGols(parsedStats.gols || 0);
      }

      // 8. BUSCAR ESTATÍSTICAS REAIS DO BANCO (SESSÃO ATIVA)
      if (sessao) {
        const { data: jogosFinalizados } = await supabase
          .from('jogos')
          .select('id, placar_a, placar_b')
          .eq('sessao_id', sessao.id)
          .eq('status', 'finalizado');

        const partidasReais = jogosFinalizados?.length || 0;
        let golsReais = 0;

        if (jogosFinalizados && jogosFinalizados.length > 0) {
          golsReais = jogosFinalizados.reduce((total, jogo) => {
            return total + (jogo.placar_a || 0) + (jogo.placar_b || 0);
          }, 0);
        }

        setTotalPartidas(partidasReais);
        setTotalGols(golsReais);
        console.log(`📊 Estatísticas da sessão: ${partidasReais} partidas, ${golsReais} gols`);
      }
      
      console.log(`✅ Fila carregada: ${jogadoresJogando.length} jogando, ${jogadoresFila.length} na fila, ${jogadoresReserva.length} reservas`);
      
      // Verificar se há partida ativa
      const partidaSalva = localStorage.getItem('partida_em_andamento');
      if (partidaSalva) {
        const estadoPartida = JSON.parse(partidaSalva);
        setPartidaAtiva(estadoPartida);
        console.log('⚽ Partida ativa detectada:', estadoPartida.jogoId);
      } else {
        setPartidaAtiva(null);
      }
      
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

  const iniciarPartida = () => {
    const minimosJogadores = regras.jogadores_por_time * 2;
    const totalAtivos = jogadoresJogando.length + jogadoresFila.length;
    if (totalAtivos < minimosJogadores) {
      alert(`❌ É necessário pelo menos ${minimosJogadores} jogadores para iniciar uma partida!`);
      return;
    }
    
    // Buscar modo configurado nas regras
    const modoEscolhido = (window as any).modoEscolhido || 'modo_prancheta';
    console.log('🚀 Iniciando partida no modo:', modoEscolhido);
    
    if (modoEscolhido === 'modo_partida') {
      // Abrir modal de confirmação para ativar modo partida completo
      setShowConfirmarInicioModal(true);
    } else {
      // Ativar modo prancheta diretamente
      setModoPrancheta(true);
      const tempoPartida = regras.tempo_partida || 10;
      setCronometro(tempoPartida * 60);
      setCronometroAtivo(true);
      setPlacarTimeA(0);
      setPlacarTimeB(0);
    }
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

      // Buscar estatísticas da sessão
      const { data: jogos, error: jogosError } = await supabase
        .from('jogos')
        .select('id, placar_a, placar_b')
        .eq('sessao_id', sessao.id)
        .eq('status', 'finalizado');

      if (jogosError) {
        console.error('❌ Erro ao buscar jogos:', jogosError);
      }

      const partidas = jogos?.length || 0;
      let gols = 0;

      if (jogos && jogos.length > 0) {
        gols = jogos.reduce((total, jogo) => {
          return total + (jogo.placar_a || 0) + (jogo.placar_b || 0);
        }, 0);
      }

      setTotalPartidas(partidas);
      setTotalGols(gols);
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

  // Função para carregar informações das partidas do dia
  const carregarInfoPartidas = async () => {
    try {
      const userData = localStorage.getItem('user');
      if (!userData) return;

      const user = JSON.parse(userData);
      const peladaId = user.id;

      // Buscar sessão ativa
      const { data: sessao } = await supabase
        .from('sessoes')
        .select('id')
        .eq('pelada_id', peladaId)
        .eq('status', 'ativa')
        .single();

      if (!sessao) return;

      // Buscar jogos finalizados da sessão
      const { data: jogos, error: jogosError } = await supabase
        .from('jogos')
        .select('*')
        .eq('sessao_id', sessao.id)
        .eq('status', 'finalizado')
        .order('created_at', { ascending: true });

      if (jogosError) {
        console.error('Erro ao buscar partidas:', jogosError);
      }

      console.log('Partidas encontradas:', jogos);
      setPartidasDoDia(jogos || []);
      setShowModalInfoPartidas(true);
    } catch (error) {
      console.error('Erro ao carregar partidas:', error);
    }
  };

  // Função para carregar informações dos gols do dia
  const carregarInfoGols = async () => {
    try {
      const userData = localStorage.getItem('user');
      if (!userData) return;

      const user = JSON.parse(userData);
      const peladaId = user.id;

      // Buscar sessão ativa
      const { data: sessao } = await supabase
        .from('sessoes')
        .select('id')
        .eq('pelada_id', peladaId)
        .eq('status', 'ativa')
        .single();

      if (!sessao) return;

      // Buscar jogos finalizados da sessão
      const { data: jogos } = await supabase
        .from('jogos')
        .select('id, time_a, time_b')
        .eq('sessao_id', sessao.id)
        .eq('status', 'finalizado');

      if (!jogos || jogos.length === 0) {
        setArtilheirosDoDia([]);
        setSemGolsDoDia([]);
        setShowModalInfoGols(true);
        return;
      }

      const jogosIds = jogos.map(j => j.id);

      // Buscar todos os gols
      const { data: todosGols, error: golsError } = await supabase
        .from('gols')
        .select('jogador_id')
        .in('jogo_id', jogosIds);

      if (golsError) {
        console.error('Erro ao buscar gols:', golsError);
      }

      console.log('Jogos encontrados:', jogos.length);
      console.log('IDs dos jogos:', jogosIds);
      console.log('Gols encontrados:', todosGols);
      console.log('Total de gols:', todosGols?.length);

      // Buscar dados de todos os jogadores
      const { data: todosJogadores } = await supabase
        .from('jogadores')
        .select('id, nome')
        .eq('pelada_id', peladaId);

      if (!todosJogadores) return;

      // Contar gols por jogador
      const golsPorJogador: Record<string, number> = {};
      (todosGols || []).forEach(gol => {
        golsPorJogador[gol.jogador_id] = (golsPorJogador[gol.jogador_id] || 0) + 1;
      });

      // Obter IDs únicos de jogadores que participaram dos jogos
      const jogadoresQueJogaram = new Set<string>();
      jogos.forEach(jogo => {
        (jogo.time_a || []).forEach((id: string) => jogadoresQueJogaram.add(id));
        (jogo.time_b || []).forEach((id: string) => jogadoresQueJogaram.add(id));
      });

      // Criar lista de artilheiros (quem marcou)
      const artilheiros = todosJogadores
        .filter(j => golsPorJogador[j.id] > 0)
        .map(j => ({
          nome: j.nome,
          gols: golsPorJogador[j.id]
        }))
        .sort((a, b) => b.gols - a.gols);

      // Criar lista de jogadores sem gols (apenas quem jogou)
      const semGols = todosJogadores
        .filter(j => jogadoresQueJogaram.has(j.id) && !golsPorJogador[j.id])
        .map(j => j.nome)
        .sort();

      setArtilheirosDoDia(artilheiros);
      setSemGolsDoDia(semGols);
      setShowModalInfoGols(true);
    } catch (error) {
      console.error('Erro ao carregar gols:', error);
    }
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

      // Buscar o ÚLTIMO snapshot (apenas 1 registro ativo por vez)
      const { data: snapshot, error: snapshotError } = await supabase
        .from('fila_snapshot')
        .select('*')
        .eq('pelada_id', peladaId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (snapshotError || !snapshot) {
        alert('❌ Não há ações para desfazer.\n\nEsta funcionalidade só funciona após iniciar uma partida ou fazer edições na fila.');
        return;
      }

      console.log('📸 Snapshot encontrado, tipo:', snapshot.tipo);

      // Guardar o tipo da ação
      setTipoAcaoDesfazer(snapshot.tipo);

      // Se for snapshot de partida, buscar última partida
      if (snapshot.tipo === 'partida') {
        const { data: ultimoJogo } = await supabase
          .from('jogos')
          .select('*')
          .eq('sessao_id', sessao.id)
          .eq('status', 'finalizado')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (ultimoJogo) {
          setUltimaPartida(ultimoJogo);
        }
      }
      
      // Abrir modal informativo
      setShowDesfazerModal(true);

    } catch (error: any) {
      console.error('❌ Erro ao buscar opções de desfazer:', error);
      alert(`❌ Erro: ${error.message || 'Erro desconhecido'}`);
    }
  };

  const confirmarDesfazer = () => {
    setShowDesfazerModal(false);
    setShowDesfazerSenhaModal(true);
  };

  const confirmarDesfazerPartida = () => {
    setShowDesfazerModal(false);
    setShowDesfazerSenhaModal(true);
    // O desfazerUltimaPartida já está configurado
  };

  const confirmarDesfazerEdicao = () => {
    setShowDesfazerModal(false);
    setShowDesfazerSenhaModalEdicao(true);
  };

  const desfazerEdicaoFila = async () => {
    try {
      const userData = localStorage.getItem('user');
      if (!userData) {
        alert('❌ Usuário não encontrado!');
        return;
      }

      const user = JSON.parse(userData);
      const peladaId = user.id;

      // Validar senha
      const senhaValida = await validarSenhaPelada(senhaDesfazerEdicao);
      if (!senhaValida) {
        alert('❌ Senha incorreta!');
        setSenhaDesfazerEdicao('');
        return;
      }

      console.log('🔄 Desfazendo edição da fila...');

      // Buscar snapshot de edição
      const { data: snapshot } = await supabase
        .from('fila_snapshot')
        .select('*')
        .eq('pelada_id', peladaId)
        .eq('tipo', 'edicao')
        .single();

      if (!snapshot) {
        alert('❌ Snapshot de edição não encontrado!');
        return;
      }

      // Buscar sessão ativa
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

      // Validar snapshot
      if (!snapshot.snapshot_data || snapshot.snapshot_data.length === 0) {
        alert('❌ O snapshot está vazio! Não é possível desfazer esta edição.');
        return;
      }

      console.log('📊 Restaurando fila com snapshot de edição:', snapshot.snapshot_data);

      // Deletar todos os registros atuais da fila
      await supabase
        .from('fila')
        .delete()
        .eq('pelada_id', peladaId)
        .eq('sessao_id', sessao.id);

      // Restaurar fila do snapshot
      const filaRestaurada = snapshot.snapshot_data.map((item: any) => {
        const { id, created_at, updated_at, ...resto } = item;
        return resto;
      });

      const { error: insertError } = await supabase
        .from('fila')
        .insert(filaRestaurada);
      
      if (insertError) {
        console.error('❌ Erro ao restaurar fila:', insertError);
        alert('❌ Erro ao restaurar a fila. Por favor, recarregue a página.');
        return;
      }

      // Limpar snapshot de edição
      await supabase
        .from('fila_snapshot')
        .delete()
        .eq('pelada_id', peladaId)
        .eq('tipo', 'edicao');

      setShowDesfazerSenhaModalEdicao(false);
      setSenhaDesfazerEdicao('');

      alert('✅ Edição desfeita com sucesso! A fila foi restaurada.');

      // Recarregar página
      window.location.reload();

    } catch (error) {
      console.error('❌ Erro ao desfazer edição:', error);
      alert('❌ Erro ao desfazer edição. Tente novamente.');
    }
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

      console.log('🔄 Desfazendo última partida...');

      // 1. Buscar snapshot do tipo 'partida'
      const { data: snapshot } = await supabase
        .from('fila_snapshot')
        .select('*')
        .eq('pelada_id', peladaId)
        .eq('tipo', 'partida')
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
        alert('❌ O snapshot está vazio! Não é possível desfazer esta partida.\n\nIsso pode acontecer se o sistema foi atualizado durante uma partida em andamento.');
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

      // 6. Deletar gols da partida
      await supabase
        .from('gols')
        .delete()
        .eq('jogo_id', ultimaPartida.id);

      // 7. Marcar partida como desfeita (não deletar, manter histórico)
      await supabase
        .from('jogos')
        .update({ status: 'desfeito' })
        .eq('id', ultimaPartida.id);

      // 8. NÃO limpar snapshot - manter para próximas ações de desfazer
      // O snapshot só será limpo ao encerrar a pelada ou iniciar nova partida

      setShowDesfazerSenhaModal(false);
      setSenhaDesfazer('');
      setUltimaPartida(null);

      alert('✅ Última partida desfeita com sucesso! A fila foi restaurada.');

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
      
      // MODO LOCAL FIRST: Sincronizar tudo antes de finalizar
      if (modoSincronizacao === 'local_first') {
        console.log('⚡ Modo local: sincronizando todos os dados antes de finalizar...');
        setSincronizando(true);
        
        try {
          // Verificar se está online
          if (!statusOnline) {
            alert('❌ Você está offline! Conecte-se à internet para finalizar a pelada.');
            setSincronizando(false);
            setSenhaEncerramento('');
            return;
          }
          
          // Sincronizar fila de pendências
          await syncQueue();
          
          // Aguardar um momento para garantir que tudo foi sincronizado
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          console.log('✅ Sincronização completa!');
        } catch (syncError) {
          console.error('❌ Erro na sincronização:', syncError);
          alert('❌ Erro ao sincronizar dados. Tente novamente.');
          setSincronizando(false);
          setSenhaEncerramento('');
          return;
        } finally {
          setSincronizando(false);
        }
      }
      
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
      
      // Limpar cache local de sincronização (se modo local_first)
      if (modoSincronizacao === 'local_first' && sessaoAtiva) {
        console.log('🧹 Limpando cache local do modo local_first...');
        localStorage.removeItem(`fila_${sessaoAtiva.id}`);
        localStorage.removeItem(`jogadores_${peladaId}`);
        localStorage.removeItem('syncQueue');
      }
      
      // 5. PLANO FREE: Limpar jogadores do localStorage (forçar recadastro na próxima pelada)
      if (plano === 'Free') {
        console.log('🧹 FREE: Limpando jogadores do localStorage...');
        
        // Limpar localStorage de jogadores e fila
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (
            key.startsWith('jogador_') ||
            key.startsWith('jogadores_') ||
            key.startsWith('fila_') ||
            key.startsWith('sessao_') ||
            key.startsWith('partida_')
          )) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        console.log(`✅ ${keysToRemove.length} itens do localStorage limpos (FREE)`);
      }
      
      setShowConfirmarSenhaModal(false);
      setSenhaEncerramento('');
      
      // Mostrar modal de sucesso
      setShowModalSucessoEncerrar(true);
      
      // Mostrar anúncio ao encerrar pelada (Free e Gold)
      showAdOnPeladaEnd();
      
      // Após 3 segundos, redirecionar para home
      setTimeout(() => {
        window.location.href = '/';
      }, 3000);
      
    } catch (error) {
      console.error('Erro ao encerrar pelada:', error);
      alert('❌ Erro ao encerrar pelada. Tente novamente.');
    }
  };

  // ===== FUNÇÕES DO MODO EDIÇÃO =====
  
  const removerDaFila = async (jogador: JogadorFila, aplicarAgora = false) => {
    if (!aplicarAgora) {
      // Adicionar às mudanças pendentes
      setMudancasPendentes(prev => [...prev, { tipo: 'remover', jogador }]);
      
      // Aplicar mudança visual temporária
      setJogadoresJogando(prev => prev.filter(j => j.id !== jogador.id));
      setJogadoresFila(prev => prev.filter(j => j.id !== jogador.id));
      setJogadoresReserva(prev => {
        // Evitar duplicação - só adicionar se não existir
        if (prev.some(j => j.id === jogador.id)) {
          return prev;
        }
        return [...prev, { ...jogador, status: 'reserva' }];
      });
      return;
    }
    
    // Aplicar mudança agora
    const estaJogando = jogadoresJogando.some(j => j.id === jogador.id);
    
    if (partidaAtiva && estaJogando) {
      // 🚨 SUBSTITUIÇÃO OBRIGATÓRIA - jogador está em campo
      const proximoDaFila = jogadoresFila[0];
      
      if (!proximoDaFila) {
        alert('⚠️ Não há jogadores na fila para substituir!');
        return;
      }
      
      // Registrar substituição (implementar tabela depois)
      console.log('📝 Registrando substituição:', {
        saiu: jogador.nome,
        entrou: proximoDaFila.nome
      });
      
      // Atualizar localStorage da partida
      const partidaSalva = localStorage.getItem('partida_em_andamento');
      if (partidaSalva) {
        const estadoPartida = JSON.parse(partidaSalva);
        // Encontrar e substituir no time
        if (estadoPartida.timeA.jogadores.some((j: any) => j.id === jogador.id)) {
          estadoPartida.timeA.jogadores = estadoPartida.timeA.jogadores.map((j: any) =>
            j.id === jogador.id ? { id: proximoDaFila.id, nome: proximoDaFila.nome } : j
          );
        } else if (estadoPartida.timeB.jogadores.some((j: any) => j.id === jogador.id)) {
          estadoPartida.timeB.jogadores = estadoPartida.timeB.jogadores.map((j: any) =>
            j.id === jogador.id ? { id: proximoDaFila.id, nome: proximoDaFila.nome } : j
          );
        }
        localStorage.setItem('partida_em_andamento', JSON.stringify(estadoPartida));
      }
      
      alert(`✅ ${jogador.nome} substituído por ${proximoDaFila.nome}`);
    }
    
    // Remover da fila e colocar na reserva
    const userData = localStorage.getItem('user');
    if (!userData) return;
    const user = JSON.parse(userData);
    const peladaId = user.id;
    
    // Buscar sessão ativa
    const { data: sessao } = await supabase
      .from('sessoes')
      .select('id')
      .eq('pelada_id', peladaId)
      .eq('status', 'ativa')
      .single();
    
    if (!sessao) {
      alert('❌ Sessão ativa não encontrada');
      return;
    }
    
    // ❌ REMOVIDO: update na tabela jogadores (status fila/reserva não pertencem aqui!)
    // A tabela jogadores deve ter apenas: 'ativo' ou 'inativo'
    
    // Buscar a posição do jogador removido ANTES de alterar
    const { data: jogadorRemovido } = await supabase
      .from('fila')
      .select('posicao_fila')
      .eq('jogador_id', jogador.id)
      .eq('status', 'fila')
      .single();
    
    const posicaoRemovida = jogadorRemovido?.posicao_fila;
    
    if (modoSincronizacao === 'local_first') {
      // MODO LOCAL FIRST: Atualizar localStorage e adicionar à fila de sync
      console.log('⚡ Modo local: atualizando cache e agendando sync');
      
      const filaLocal = localStorage.getItem(`fila_${sessao.id}`);
      const fila = filaLocal ? JSON.parse(filaLocal) : [];
      
      // Buscar posição do jogador removido
      const jogadorItem = fila.find((item: any) => item.jogador_id === jogador.id && item.status === 'fila');
      const posicaoRemovida = jogadorItem?.posicao_fila;
      
      // Atualizar status para reserva
      let filaAtualizada = fila.map((item: any) => 
        item.jogador_id === jogador.id 
          ? { ...item, status: 'reserva', posicao_fila: 999 }
          : item
      );
      
      // Reorganizar posições (subir jogadores após posição removida)
      if (posicaoRemovida !== undefined) {
        filaAtualizada = filaAtualizada.map((item: any) => 
          item.status === 'fila' && item.posicao_fila > posicaoRemovida
            ? { ...item, posicao_fila: item.posicao_fila - 1 }
            : item
        );
      }
      
      localStorage.setItem(`fila_${sessao.id}`, JSON.stringify(filaAtualizada));
      
      // Adicionar à fila de sincronização
      await addToSyncQueue({
        tipo: 'atualizar_fila',
        jogador_id: jogador.id,
        pelada_id: peladaId,
        sessao_id: sessao.id,
        dados: { status: 'reserva', posicao_fila: 999 }
      });
      
      // Se houve reorganização, adicionar batch de atualizações
      if (posicaoRemovida !== undefined) {
        const jogadoresReorganizados = filaAtualizada.filter(
          (item: any) => item.status === 'fila' && item.posicao_fila >= posicaoRemovida
        );
        
        for (const item of jogadoresReorganizados) {
          await addToSyncQueue({
            tipo: 'atualizar_fila',
            jogador_id: item.jogador_id,
            pelada_id: peladaId,
            sessao_id: sessao.id,
            dados: { posicao_fila: item.posicao_fila }
          });
        }
      }
      
      const pendentes = await getSyncQueueCount();
      setItensPendentesSync(pendentes);
      
    } else {
      // MODO TEMPO REAL: Atualizar direto no Supabase
      console.log('🔄 Modo tempo real: atualizando Supabase');
      
      // Atualizar APENAS na tabela FILA (status e posição para reserva)
      await supabase
        .from('fila')
        .update({ 
          status: 'reserva',
          posicao_fila: 999 
        })
        .eq('jogador_id', jogador.id);
      
      // Reorganizar posições: todos após a posição removida sobem 1 posição
      if (posicaoRemovida !== undefined && posicaoRemovida !== null) {
        const { data: jogadoresParaAtualizar } = await supabase
          .from('fila')
          .select('jogador_id, posicao_fila')
          .eq('pelada_id', peladaId)
          .eq('sessao_id', sessao.id)
          .eq('status', 'fila')
          .gt('posicao_fila', posicaoRemovida)
          .order('posicao_fila', { ascending: true });
        
        // Atualizar cada jogador individualmente
        if (jogadoresParaAtualizar && jogadoresParaAtualizar.length > 0) {
          for (const jog of jogadoresParaAtualizar) {
            await supabase
              .from('fila')
              .update({ posicao_fila: jog.posicao_fila - 1 })
              .eq('jogador_id', jog.jogador_id)
              .eq('pelada_id', peladaId)
              .eq('sessao_id', sessao.id);
          }
        }
      }
    }
    
    // Recarregar dados
    await carregarDados();
  };
  
  // Nova função: inserir jogador em uma posição (empurrando os demais) - TEMPO REAL
  const moverJogadorParaPosicao = async (jogador: JogadorFila, novaPosicao: number) => {
    try {
      console.log('🔄 Movendo jogador para nova posição (TEMPO REAL):', {
        jogador: jogador.nome,
        posicaoAtual: jogador.posicao_fila,
        novaPosicao
      });

      const userData = localStorage.getItem('user');
      const user = JSON.parse(userData!);
      const peladaId = user.id;

      // Buscar sessão ativa
      const { data: sessoes } = await supabase
        .from('sessoes')
        .select('*')
        .eq('pelada_id', peladaId)
        .eq('status', 'ativa')
        .order('created_at', { ascending: false });

      if (!sessoes || sessoes.length === 0) {
        console.error('⚠️ Nenhuma sessão ativa encontrada!');
        return;
      }

      const sessao = sessoes[0];

      // Buscar todos os jogadores da fila
      const { data: todosJogadores } = await supabase
        .from('fila')
        .select('*')
        .eq('pelada_id', peladaId)
        .eq('sessao_id', sessao.id)
        .eq('status', 'fila')
        .order('posicao_fila');

      if (!todosJogadores) return;

      // Criar nova lista com o jogador na nova posição
      const jogadoresSemOMover = todosJogadores.filter(j => j.jogador_id !== jogador.id);
      
      // Inserir o jogador na nova posição
      const novaLista = [];
      let indexInserido = false;
      
      for (let i = 0; i < jogadoresSemOMover.length; i++) {
        if (i + 1 === novaPosicao && !indexInserido) {
          novaLista.push({ ...jogador, posicao_fila: novaPosicao, jogador_id: jogador.id });
          indexInserido = true;
        }
        novaLista.push({ ...jogadoresSemOMover[i], posicao_fila: novaLista.length + 1 });
      }
      
      if (!indexInserido) {
        novaLista.push({ ...jogador, posicao_fila: novaLista.length + 1, jogador_id: jogador.id });
      }

      // Atualizar todos os jogadores no banco EM TEMPO REAL
      for (const jog of novaLista) {
        await supabase
          .from('fila')
          .update({ posicao_fila: jog.posicao_fila })
          .eq('jogador_id', jog.jogador_id)
          .eq('pelada_id', peladaId)
          .eq('sessao_id', sessao.id);
      }

      console.log('✅ Mudança aplicada em tempo real!');
      await carregarDados();
      
    } catch (error) {
      console.error('❌ Erro ao mover jogador:', error);
    }
  };
  
  const trocarPosicoes = async (jogador1: JogadorFila, jogador2: JogadorFila, aplicarAgora = false) => {
    if (!aplicarAgora) {
      // Adicionar às mudanças pendentes
      setMudancasPendentes(prev => [...prev, { tipo: 'trocar', jogador1, jogador2 }]);
      setJogadorSelecionadoTroca(null);
      
      // Aplicar mudança visual temporária
      const pos1 = jogador1.posicao_fila;
      const pos2 = jogador2.posicao_fila;
      
      setJogadoresJogando(prev => prev.map(j => {
        if (j.id === jogador1.id) return { ...jogador2, posicao_fila: pos1 };
        if (j.id === jogador2.id) return { ...jogador1, posicao_fila: pos2 };
        return j;
      }));
      
      setJogadoresFila(prev => prev.map(j => {
        if (j.id === jogador1.id) return { ...jogador2, posicao_fila: pos1 };
        if (j.id === jogador2.id) return { ...jogador1, posicao_fila: pos2 };
        return j;
      }));
      
      return;
    }
    
    // Aplicar mudança agora
    const jogador1Jogando = jogadoresJogando.some(j => j.id === jogador1.id);
    const jogador2Jogando = jogadoresJogando.some(j => j.id === jogador2.id);
    
    // CASO 1: Ambos na fila (não estão jogando)
    if (!jogador1Jogando && !jogador2Jogando) {
      const pos1 = jogador1.posicao_fila;
      const pos2 = jogador2.posicao_fila;
      
      await supabase
        .from('fila')
        .update({ posicao_fila: pos2 })
        .eq('jogador_id', jogador1.id);
      
      await supabase
        .from('fila')
        .update({ posicao_fila: pos1 })
        .eq('jogador_id', jogador2.id);
      
      setJogadorSelecionadoTroca(null);
      await carregarDados();
      return;
    }
    
    // CASO 2: Um está jogando, outro na fila
    if (jogador1Jogando && !jogador2Jogando) {
      // Atualizar localStorage da partida
      const partidaSalva = localStorage.getItem('partida_em_andamento');
      if (partidaSalva) {
        const estadoPartida = JSON.parse(partidaSalva);
        if (estadoPartida.timeA.jogadores.some((j: any) => j.id === jogador1.id)) {
          estadoPartida.timeA.jogadores = estadoPartida.timeA.jogadores.map((j: any) =>
            j.id === jogador1.id ? { id: jogador2.id, nome: jogador2.nome } : j
          );
        } else if (estadoPartida.timeB.jogadores.some((j: any) => j.id === jogador1.id)) {
          estadoPartida.timeB.jogadores = estadoPartida.timeB.jogadores.map((j: any) =>
            j.id === jogador1.id ? { id: jogador2.id, nome: jogador2.nome } : j
          );
        }
        localStorage.setItem('partida_em_andamento', JSON.stringify(estadoPartida));
      }
      
      // Trocar posições na fila
      const pos1 = jogador1.posicao_fila;
      const pos2 = jogador2.posicao_fila;
      
      await supabase
        .from('fila')
        .update({ posicao_fila: pos2 })
        .eq('jogador_id', jogador1.id);
      
      await supabase
        .from('fila')
        .update({ posicao_fila: pos1 })
        .eq('jogador_id', jogador2.id);
      
      setJogadorSelecionadoTroca(null);
      await carregarDados();
      return;
    }
    
    // CASO 3: Ambos jogando
    if (jogador1Jogando && jogador2Jogando) {
      alert('⚠️ Não pode trocar jogadores que estão em campo');
      setJogadorSelecionadoTroca(null);
      return;
    }
  };
  
  const voltarParaFila = async (jogador: JogadorFila, aplicarAgora = false) => {
    if (!aplicarAgora) {
      // Adicionar às mudanças pendentes
      setMudancasPendentes(prev => [...prev, { tipo: 'voltar', jogador }]);
      
      // Aplicar mudança visual temporária
      setJogadoresReserva(prev => prev.filter(j => j.id !== jogador.id));
      setJogadoresFila(prev => [...prev, { ...jogador, status: 'fila' }]);
      return;
    }
    
    // Aplicar mudança agora - usar sessão ativa
    if (!sessaoAtual || !peladaIdAtual) {
      alert('❌ Sessão não encontrada! Por favor, recarregue a página.');
      return;
    }
    
    const peladaId = peladaIdAtual;
    const sessaoId = sessaoAtual.id;
    
    // Buscar a MAIOR posição atual na fila para adicionar no final
    const { data: filaAtual } = await supabase
      .from('fila')
      .select('posicao_fila')
      .eq('pelada_id', peladaId)
      .eq('sessao_id', sessaoId)
      .eq('status', 'fila')
      .order('posicao_fila', { ascending: false })
      .limit(1);
    
    const maiorPosicao = filaAtual?.[0]?.posicao_fila || 0;
    const proximaPosicao = maiorPosicao + 1;
    
    console.log(`📍 Maior posição: ${maiorPosicao}, adicionando na: ${proximaPosicao}`);
    
    // Atualizar status na tabela jogadores
    await supabase
      .from('jogadores')
      .update({ status: 'fila' })
      .eq('id', jogador.id);
    
    // IMPORTANTE: Fazer UPDATE em vez de INSERT para evitar duplicação
    const { error: updateError } = await supabase
      .from('fila')
      .update({
        status: 'fila',
        posicao_fila: proximaPosicao
      })
      .eq('jogador_id', jogador.id)
      .eq('pelada_id', peladaId)
      .eq('sessao_id', sessaoId)
      .eq('status', 'reserva'); // Filtrar apenas registros de reserva
    
    if (updateError) {
      console.error('❌ Erro ao voltar para fila:', updateError);
      alert('❌ Erro ao adicionar jogador à fila!');
      return;
    }
    
    console.log('✅ Jogador voltou para a fila na posição', proximaPosicao);
    
    await carregarDados();
  };

  // Função para reorganizar toda a fila, garantindo sequência sem buracos
  const reorganizarFilaCompleta = async () => {
    const userData = localStorage.getItem('user');
    if (!userData) return;
    
    const user = JSON.parse(userData);
    const peladaId = user.id;
    
    // Buscar sessão ativa
    const { data: sessao } = await supabase
      .from('sessoes')
      .select('id')
      .eq('pelada_id', peladaId)
      .eq('status', 'ativa')
      .single();
    
    if (!sessao) return;
    
    // Primeiro: colocar todos os jogadores com status 'reserva' na posição 999
    await supabase
      .from('fila')
      .update({ posicao_fila: 999 })
      .eq('pelada_id', peladaId)
      .eq('sessao_id', sessao.id)
      .eq('status', 'reserva');
    
    // Buscar todos os jogadores com status 'fila', ordenados pela posição atual
    const { data: jogadoresFila } = await supabase
      .from('fila')
      .select('jogador_id, posicao_fila')
      .eq('pelada_id', peladaId)
      .eq('sessao_id', sessao.id)
      .eq('status', 'fila')
      .order('posicao_fila', { ascending: true });
    
    if (!jogadoresFila || jogadoresFila.length === 0) return;
    
    // Reorganizar: atribuir posições sequenciais de 1 a N
    for (let i = 0; i < jogadoresFila.length; i++) {
      const jogador = jogadoresFila[i];
      const novaPosicao = i + 1; // Começa em 1
      // Só atualiza se a posição estiver diferente
      if (jogador.posicao_fila !== novaPosicao) {
        await supabase
          .from('fila')
          .update({ posicao_fila: novaPosicao })
          .eq('jogador_id', jogador.jogador_id)
          .eq('pelada_id', peladaId)
          .eq('sessao_id', sessao.id);
      }
    }
    
    console.log(`✅ Fila reorganizada: ${jogadoresFila.length} jogadores em sequência (1 a ${jogadoresFila.length})`);
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
            
            // Limpar QUALQUER snapshot anterior (partida ou edição)
            const { error: deleteError } = await supabase
              .from('fila_snapshot')
              .delete()
              .eq('pelada_id', peladaId);
            
            if (deleteError) {
              console.warn('⚠️ Erro ao limpar snapshot antigo (pode não existir):', deleteError);
            }
            
            // Criar novo snapshot do tipo 'partida'
            const { data: insertData, error: insertError } = await supabase
              .from('fila_snapshot')
              .insert({
                pelada_id: peladaId,
                snapshot_data: snapshotFila,
                tipo: 'partida'
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
      
      // 9. Ativar modo partida na mesma tela
      setModoPartida(true);
      const tempoInicial = (regrasData?.duracao || regras.tempo_partida || 10) * 60; // Converter minutos para segundos
      setCronometro(tempoInicial);
      setCronometroAtivo(true);
      setPlacarTimeA(0);
      setPlacarTimeB(0);
      setPartidaAtiva(estadoPartida);
      setVitoriaConsecutiva(vitoriasConsecutivasAtual); // Atualizar o state com as vitórias atuais
      setRegraEmpateConfig(regrasData?.regra_empate || 'ambos_saem'); // Carregar regra de empate
      setEmpateContaVitoriaConfig(regrasData?.empate_conta_vitoria || false); // Carregar se empate conta como vitória
      
      // Carregar regrasEmpate completo para o modal
      setRegrasEmpate({
        empate_modo: regrasData?.regra_empate || null,
        empate_retorno: regrasData?.regra_apos_empate || null,
        desempate_modo: regrasData?.regra_empate || null,
        empate_conta_vitoria: regrasData?.empate_conta_vitoria || false
      });
      
      console.log('✅ Modo partida ativado!');
      console.log('🏆 Vitórias consecutivas carregadas:', vitoriasConsecutivasAtual);
      console.log('📋 Regra de empate carregada:', regrasData?.regra_empate);
      console.log('📋 Empate conta vitória:', regrasData?.empate_conta_vitoria);
      
    } catch (error) {
      console.error('Erro ao iniciar partida:', error);
      alert('Erro ao iniciar partida. Tente novamente.');
    }
  };

  const moverJogadorParaReserva = async (jogadorId: string) => {
    try {
      console.log('🏠 Movendo jogador para reserva (IMEDIATO NO SUPABASE):', jogadorId);
      
      // Verificar se temos sessão ativa
      if (!sessaoAtual || !peladaIdAtual) {
        alert('❌ Sessão não encontrada! Por favor, recarregue a página.');
        return;
      }
      
      const peladaId = peladaIdAtual;
      const sessaoId = sessaoAtual.id;
      
      // 1. PRIMEIRO: Mudar o status do jogador para reserva IMEDIATAMENTE
      const { error: updateError } = await supabase
        .from('fila')
        .update({ 
          status: 'reserva',
          posicao_fila: 999  // Posição fixa para reservas
        })
        .eq('jogador_id', jogadorId)
        .eq('pelada_id', peladaId)
        .eq('sessao_id', sessaoId)
        .eq('status', 'fila'); // Filtrar apenas registros na fila

      if (updateError) {
        console.error('❌ Erro ao mover para reserva:', updateError);
        return;
      }

      // 2. SEGUNDO: Buscar todos os jogadores ativos ordenados por posição
      const { data: jogadoresAtivos } = await supabase
        .from('fila')
        .select('*')
        .eq('pelada_id', peladaId)
        .eq('sessao_id', sessaoId)
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
            .eq('pelada_id', peladaId)
            .eq('sessao_id', sessaoId)
            .eq('status', 'fila');
        });

        await Promise.all(updates);
        console.log('✅ Fila reordenada sequencialmente');
      }

      // 4. QUARTO: Recarregar dados para atualizar a interface
      await carregarDados();
      
      console.log('✅ Jogador movido para reserva (posição 999) e fila reorganizada!');
      
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
      // Usar o jogadoresService que já respeita Free/Paid
      const resultCriar = await jogadoresService.criar({
        nome: novoJogadorNome.trim(),
        nivel: novoJogadorEstrelas,
        status: 'ativo',
        pelada_id: peladaId
      });

      if (!resultCriar.success || !resultCriar.data) {
        console.error('❌ Erro ao cadastrar jogador');
        alert('Erro ao cadastrar jogador!');
        return;
      }

      const novoJogador = resultCriar.data;

      // 3. TERCEIRO: Adicionar na fila como reserva
      if (modoSincronizacao === 'local_first') {
        // MODO LOCAL FIRST: Adicionar ao cache local e à fila de sync
        console.log('⚡ Modo local: adicionando ao cache e agendando sync');
        
        const filaLocal = localStorage.getItem(`fila_${sessao.id}`);
        const fila = filaLocal ? JSON.parse(filaLocal) : [];
        
        fila.push({
          jogador_id: novoJogador.id,
          pelada_id: peladaId,
          sessao_id: sessao.id,
          status: 'reserva',
          posicao_fila: 999
        });
        
        localStorage.setItem(`fila_${sessao.id}`, JSON.stringify(fila));
        
        // Adicionar jogadores ao cache local também
        const jogadoresLocal = localStorage.getItem(`jogadores_${peladaId}`);
        const jogadores = jogadoresLocal ? JSON.parse(jogadoresLocal) : [];
        jogadores.push(novoJogador);
        localStorage.setItem(`jogadores_${peladaId}`, JSON.stringify(jogadores));
        
        // Adicionar à fila de sincronização
        await addToSyncQueue({
          tipo: 'criar_jogador',
          pelada_id: peladaId,
          dados: novoJogador
        });
        
        await addToSyncQueue({
          tipo: 'atualizar_fila',
          jogador_id: novoJogador.id,
          pelada_id: peladaId,
          sessao_id: sessao.id,
          dados: { status: 'reserva', posicao_fila: 999 }
        });
        
        const pendentes = await getSyncQueueCount();
        setItensPendentesSync(pendentes);
        
      } else {
        // MODO TEMPO REAL: Inserir direto no Supabase
        const { error: filaError } = await supabase
          .from('fila')
          .insert({
            jogador_id: novoJogador.id,
            pelada_id: peladaId,
            sessao_id: sessao.id,
            status: 'reserva',
            posicao_fila: 999
          });

        if (filaError) {
          console.error('❌ Erro ao adicionar na fila:', filaError);
          alert('Jogador cadastrado mas erro ao adicionar na fila!');
          return;
        }
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
      
      // Verificar se temos sessão ativa
      if (!sessaoAtual || !peladaIdAtual) {
        alert('❌ Sessão não encontrada! Por favor, recarregue a página.');
        return;
      }
      
      const peladaId = peladaIdAtual;
      const sessaoId = sessaoAtual.id;
      
      if (modoSincronizacao === 'local_first') {
        // MODO LOCAL FIRST: Atualizar localStorage e adicionar à fila de sync
        console.log('⚡ Modo local: atualizando cache e agendando sync');
        
        // Buscar dados locais
        const filaLocal = localStorage.getItem(`fila_${sessaoId}`);
        const fila = filaLocal ? JSON.parse(filaLocal) : [];
        
        // Buscar maior posição na fila
        const jogadoresNaFila = fila.filter((item: any) => item.status === 'fila');
        const maiorPosicao = jogadoresNaFila.reduce((max: number, item: any) => 
          Math.max(max, item.posicao_fila || 0), 0);
        const proximaPosicao = maiorPosicao + 1;
        
        // Atualizar item local
        const filaAtualizada = fila.map((item: any) => 
          item.jogador_id === jogadorId && item.status === 'reserva' 
            ? { ...item, status: 'fila', posicao_fila: proximaPosicao }
            : item
        );
        
        localStorage.setItem(`fila_${sessaoId}`, JSON.stringify(filaAtualizada));
        
        // Adicionar à fila de sincronização
        await addToSyncQueue({
          tipo: 'atualizar_fila',
          jogador_id: jogadorId,
          pelada_id: peladaId,
          sessao_id: sessaoId,
          dados: { status: 'fila', posicao_fila: proximaPosicao }
        });
        
        // Atualizar contador
        const pendentes = await getSyncQueueCount();
        setItensPendentesSync(pendentes);
        
        console.log(`✅ Jogador movido localmente para posição ${proximaPosicao}`);
      } else {
        // MODO TEMPO REAL: Atualizar direto no Supabase
        console.log('🔄 Modo tempo real: atualizando Supabase');
        
        // 1. Buscar a MAIOR posição atual na fila da sessão ativa
        const { data: jogadoresNaFila } = await supabase
          .from('fila')
          .select('posicao_fila')
          .eq('pelada_id', peladaId)
          .eq('sessao_id', sessaoId)
          .eq('status', 'fila')
          .order('posicao_fila', { ascending: false })
          .limit(1);
        
        // Próxima posição = maior posição atual + 1 (ou 1 se não houver ninguém)
        const maiorPosicao = jogadoresNaFila?.[0]?.posicao_fila || 0;
        const proximaPosicao = maiorPosicao + 1;
        
        console.log(`📍 Maior posição atual: ${maiorPosicao}, próxima: ${proximaPosicao}`);
        
        // 2. Atualizar APENAS o registro com status='reserva' para 'fila'
        const { error: updateError } = await supabase
          .from('fila')
          .update({ 
            status: 'fila',
            posicao_fila: proximaPosicao
          })
          .eq('jogador_id', jogadorId)
          .eq('pelada_id', peladaId)
          .eq('sessao_id', sessaoId)
          .eq('status', 'reserva'); // Filtrar apenas registros de reserva
        
        if (updateError) {
          console.error('❌ Erro ao mover para fila:', updateError);
          alert('❌ Erro ao adicionar jogador à fila!');
          return;
        }
        
        console.log(`✅ Jogador movido para fila na posição ${proximaPosicao}`);
      }
      
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
              posicao_fila: 999
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

  // Função para finalizar partida e rotacionar fila
  const finalizarPartidaComRotacao = async () => {
    if (finalizandoPartida) return; // Evitar duplo clique
    
    try {
      setFinalizandoPartida(true);
      console.log('💾 Finalizando partida e rotacionando fila...');
      
      // Verificar se temos sessão e pelada carregadas
      if (!sessaoAtual || !peladaIdAtual) {
        alert('❌ Sessão não encontrada! Por favor, recarregue a página.');
        return;
      }

      const peladaId = peladaIdAtual;
      const sessaoId = sessaoAtual.id;
      
      console.log('📋 Usando sessão:', sessaoId);
      console.log('📋 Usando pelada:', peladaId);
      
      // Determinar vencedor
      let timeVencedor: 'A' | 'B' | null = null;
      if (placarTimeA > placarTimeB) {
        timeVencedor = 'A';
      } else if (placarTimeB > placarTimeA) {
        timeVencedor = 'B';
      } else {
        // Empate - NÃO há vencedor real, será null para rotação especial
        timeVencedor = null;
        console.log('🤝 Empate detectado - rotação especial será aplicada');
        console.log('🎯 Time escolhido para retornar primeiro:', timeEscolhidoDesempate);
      }
      
      // === 1. SALVAR JOGO NA TABELA jogos ===
      let jogoId: string;
      
      if (modoSincronizacao === 'local_first') {
        // MODO LOCAL FIRST: Gerar ID local e adicionar à fila de sync
        jogoId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const dadosJogo = {
          id: jogoId,
          sessao_id: sessaoId,
          time_a: time1.map((j) => j.id),
          time_b: time2.map((j) => j.id),
          placar_a: placarTimeA,
          placar_b: placarTimeB,
          status: 'finalizado',
          data_inicio: new Date().toISOString(),
          data_fim: new Date().toISOString(),
          time_vencedor: timeVencedor
        };
        
        await addToSyncQueue({
          tipo: 'inserir_jogo',
          sessao_id: sessaoId,
          dados: dadosJogo
        });
        
        console.log('⚡ Jogo adicionado à fila de sync local');
      } else {
        // MODO TEMPO REAL: Inserir direto no Supabase
        const { data: novoJogo, error: erroJogo } = await supabase
          .from('jogos')
          .insert({
            sessao_id: sessaoId,
            time_a: time1.map((j) => j.id),
            time_b: time2.map((j) => j.id),
            placar_a: placarTimeA,
            placar_b: placarTimeB,
            status: 'finalizado',
            data_inicio: new Date().toISOString(),
            data_fim: new Date().toISOString(),
            time_vencedor: timeVencedor
          })
          .select()
          .single();
        
        if (erroJogo || !novoJogo) {
          console.error('Erro ao salvar jogo:', erroJogo);
          alert('❌ Erro ao finalizar partida!');
          return;
        }
        
        jogoId = novoJogo.id;
      }
      
      // === 2. SALVAR GOLS NA TABELA gols ===
      console.log('📊 Histórico de gols:', historicoAcoes);
      
      if (historicoAcoes && historicoAcoes.length > 0) {
        const golsParaSalvar = historicoAcoes.map((gol) => ({
          jogo_id: jogoId,
          jogador_id: gol.jogadorId,
          time: gol.time,
          created_at: new Date().toISOString()
        }));
        
        console.log('💾 Gols para salvar:', golsParaSalvar);
        
        if (modoSincronizacao === 'local_first') {
          // MODO LOCAL FIRST: Adicionar gols à fila de sync
          for (const gol of golsParaSalvar) {
            await addToSyncQueue({
              tipo: 'inserir_gols',
              jogo_id: jogoId,
              dados: gol
            });
          }
          console.log('⚡ Gols adicionados à fila de sync local');
        } else {
          // MODO TEMPO REAL: Inserir direto no Supabase
          const { error: erroGols } = await supabase
            .from('gols')
            .insert(golsParaSalvar);
          
          if (erroGols) {
            console.error('Erro ao salvar gols:', erroGols);
          } else {
            console.log('✅ Gols salvos com sucesso!');
          }
        }
      } else {
        console.log('⚠️ Nenhum gol para salvar');
      }
      
      // === 3. ATUALIZAR ESTATÍSTICAS DOS JOGADORES ===
      const todosJogadores = [...time1, ...time2];
      
      // Verificar se é empate com desempate (não conta vitória nas estatísticas)
      const ehEmpateComDesempate = placarTimeA === placarTimeB && vencedorDesempate !== null;
      
      console.log('📊 Tipo de resultado:', {
        empate: placarTimeA === placarTimeB,
        vencedorDesempate: vencedorDesempate,
        ehEmpateComDesempate: ehEmpateComDesempate
      });
      
      for (const jogador of todosJogadores) {
        // Contar gols do jogador
        const golsJogador = historicoAcoes.filter(
          (h) => h.jogadorId === jogador.id
        ).length;
        
        // Determinar se venceu
        const timeJogador = time1.find((j) => j.id === jogador.id) ? 'A' : 'B';
        
        // Se for empate com desempate, NÃO conta vitória nas estatísticas
        // Apenas conta vitória se for vitória real (placar diferente)
        let venceu = false;
        if (!ehEmpateComDesempate) {
          venceu = timeVencedor === timeJogador;
        }
        
        console.log(`👤 ${jogador.nome}: time=${timeJogador}, venceu estatística=${venceu}`);
        
        if (modoSincronizacao === 'local_first') {
          // MODO LOCAL FIRST: Atualizar cache local e adicionar à fila de sync
          const jogadoresLocal = localStorage.getItem(`jogadores_${peladaId}`);
          const jogadores = jogadoresLocal ? JSON.parse(jogadoresLocal) : [];
          
          const jogadorLocal = jogadores.find((j: any) => j.id === jogador.id);
          if (jogadorLocal) {
            jogadorLocal.jogos = (jogadorLocal.jogos || 0) + 1;
            jogadorLocal.vitorias = (jogadorLocal.vitorias || 0) + (venceu ? 1 : 0);
            jogadorLocal.gols = (jogadorLocal.gols || 0) + golsJogador;
            localStorage.setItem(`jogadores_${peladaId}`, JSON.stringify(jogadores));
          }
          
          // Adicionar à fila de sync
          await addToSyncQueue({
            tipo: 'atualizar_jogador',
            jogador_id: jogador.id,
            pelada_id: peladaId,
            dados: {
              jogos_increment: 1,
              vitorias_increment: venceu ? 1 : 0,
              gols_increment: golsJogador
            }
          });
        } else {
          // MODO TEMPO REAL: Atualizar direto no Supabase
          // Buscar estatísticas atuais
          const { data: jogadorAtual } = await supabase
            .from('jogadores')
            .select('jogos, vitorias, gols')
            .eq('id', jogador.id)
            .single();
          
          // Atualizar estatísticas
          await supabase
            .from('jogadores')
            .update({
              jogos: (jogadorAtual?.jogos || 0) + 1,
              vitorias: (jogadorAtual?.vitorias || 0) + (venceu ? 1 : 0),
              gols: (jogadorAtual?.gols || 0) + golsJogador
            })
            .eq('id', jogador.id);
        }
      }
      
      // === 4. ROTACIONAR FILA ===
      console.log('🔄 Rotacionando fila...');
      console.log('🏆 Time vencedor para rotação:', timeVencedor);
      console.log('🎯 Time escolhido no desempate:', timeEscolhidoDesempate);
      console.log('📋 regrasEmpate completo:', regrasEmpate);
      console.log('🔍 Verificação empate_modo:', regrasEmpate.empate_modo);
      console.log('🔍 Verificação empate_retorno:', regrasEmpate.empate_retorno);
      await rotacionarFila(peladaId, sessaoId, timeVencedor, timeEscolhidoDesempate);
      console.log('✅ Rotação concluída!');
      
      // Atualizar contador de sync se modo local_first
      if (modoSincronizacao === 'local_first') {
        const pendentes = await getSyncQueueCount();
        setItensPendentesSync(pendentes);
        console.log(`⚡ ${pendentes} itens pendentes de sincronização`);
      }
      
      // === 5. FECHAR MODAL E RESETAR MODO PARTIDA ===
      setShowModalFinalizacao(false);
      setModoPartida(false);
      setModoPrancheta(false); // Fechar modo prancheta também
      setCronometroAtivo(false);
      setCronometro(0);
      setPlacarTimeA(0);
      setPlacarTimeB(0);
      setSelecionandoGolPara(null);
      setGolsJogadores({});
      setHistoricoAcoes([]);
      setVencedorDesempate(null); // Resetar vencedor do desempate
      setTimeEscolhidoDesempate(null); // Resetar escolha do time no empate
      localStorage.removeItem('modo_partida_estado');
      
      // === 6. RECARREGAR DADOS DA FILA ===
      await carregarDados();
      
      console.log('✅ Partida finalizada com sucesso!');

      // === 7. Verificar limites de partidas por plano ===
      const { data: partidasFinalizadas } = await supabase
        .from('jogos')
        .select('id')
        .eq('sessao_id', sessaoAtual.id);
      
      const totalPartidas = partidasFinalizadas?.length || 0;
      
      // FREE: 10 partidas
      if (!possuiPermissao('usarSupabase') && totalPartidas >= 10) {
        console.log('⚠️ FREE: Limite de 10 partidas atingido!');
        setShowModalLimiteFree(true);
      }
      
      // GOLD: 15 partidas
      if (possuiPermissao('usarSupabase') && !possuiPermissao('usarModoPartida') && totalPartidas >= 15) {
        console.log('⚠️ GOLD: Limite de 15 partidas atingido!');
        setShowModalLimiteFree(true);
      }

      // Mostrar anúncio ao finalizar partida (apenas FREE)
      showAdOnPartidaEnd();

    } catch (error) {
      console.error('❌ Erro ao finalizar partida:', error);
      alert('❌ Erro ao finalizar partida!');
    } finally {
      setFinalizandoPartida(false);
    }
  };

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
        
        @keyframes slideInFromTop {
          0% {
            opacity: 0;
            transform: translateY(-20px);
            max-height: 0;
          }
          100% {
            opacity: 1;
            transform: translateY(0);
            max-height: 500px;
          }
        }
        
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          }
          50% {
            transform: scale(1.08);
            box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
          }
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
          transition: margin-top 0.4s cubic-bezier(0.4, 0, 0.2, 1);
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
          font-size: 15px;
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
          font-size: 15px;
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
            <div style={{ width: '100%' }}>
              {modoEdicao ? (
                <h2 style={{
                  color: '#10b981',
                  fontWeight: '800',
                  fontSize: '1.5rem',
                  textAlign: 'center',
                  animation: 'pulse 2s infinite'
                }}>
                  Modo de Edição
                </h2>
              ) : (
                <h2>📋 Organização da Fila 📋</h2>
              )}
              <div className="status-info">
                {formatarData()} • <span style={{color: '#dc3545'}}>{jogadoresJogando.length + jogadoresFila.length} jogadores</span>
                
                {/* Badge do Modo de Sincronização */}
                {modoSincronizacao && (
                  <span style={{
                    marginLeft: '12px',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    background: modoSincronizacao === 'local_first' 
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                      : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    color: '#fff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}>
                    {modoSincronizacao === 'local_first' ? '⚡ Modo Rápido' : '🔄 Tempo Real'}
                    {!statusOnline && modoSincronizacao === 'local_first' && (
                      <span style={{ fontSize: '0.7rem' }}>• Offline</span>
                    )}
                    {itensPendentesSync > 0 && (
                      <span style={{
                        background: '#fff',
                        color: '#000',
                        borderRadius: '10px',
                        padding: '2px 6px',
                        fontSize: '0.7rem',
                        fontWeight: '700'
                      }}>
                        {itensPendentesSync}
                      </span>
                    )}
                  </span>
                )}
              </div>
          </div>
            {jogadorSelecionadoTroca && (
              <div style={{
                background: '#3b82f6',
                color: 'white',
                borderRadius: '8px',
                padding: '12px',
                marginTop: '12px',
                textAlign: 'center',
                fontWeight: '600',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>� Mover {jogadorSelecionadoTroca.nome} para qual posição?</span>
                <button
                  onClick={() => setJogadorSelecionadoTroca(null)}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  ❌ Cancelar
                </button>
              </div>
            )}
            {modoEdicao && (
              <div style={{
                background: '#fbbf24',
                color: '#78350f',
                borderRadius: '8px',
                padding: '12px',
                marginTop: '12px',
                textAlign: 'center',
                fontWeight: '600',
                border: '2px solid #f59e0b'
              }}>
                ⚠️ Modo de Edição Ativo - Mudanças em tempo real
              </div>
            )}
          </section>

          {/* Cronômetro e Placar no modo partida */}
          {modoPartida && (
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '8px 12px',
              marginTop: '2px',
              border: '2px solid #e5e7eb',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              alignItems: 'center',
              animation: 'slideInFromTop 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards',
              overflow: 'hidden'
            }}>
              {/* Cronômetro */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: '4px'
              }}>
                <button
                  onClick={() => setCronometroAtivo(!cronometroAtivo)}
                  disabled={modoEdicao}
                  style={{
                    background: '#f3f4f6',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '20px',
                    cursor: modoEdicao ? 'not-allowed' : 'pointer',
                    padding: '6px 10px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    minWidth: '40px',
                    transition: 'all 0.2s',
                    animation: !cronometroAtivo && !modoEdicao ? 'pulse 1.5s ease-in-out infinite' : 'none',
                    opacity: modoEdicao ? 0.5 : 1
                  }}
                  onMouseOver={(e) => {
                    if (!modoEdicao) e.currentTarget.style.background = '#e5e7eb';
                  }}
                  onMouseOut={(e) => {
                    if (!modoEdicao) e.currentTarget.style.background = '#f3f4f6';
                  }}
                >
                  {cronometroAtivo ? '⏸' : '▷'}
                </button>
                
                <div style={{
                  fontSize: '36px',
                  fontWeight: '700',
                  fontFamily: 'monospace',
                  color: '#000000',
                  letterSpacing: '1px',
                  lineHeight: '1'
                }}>
                  {formatarTempo(cronometro)}
                </div>
                
                <button
                  onClick={() => setCronometro((regras.tempo_partida || 10) * 60)}
                  disabled={modoEdicao}
                  style={{
                    background: '#f3f4f6',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '20px',
                    cursor: modoEdicao ? 'not-allowed' : 'pointer',
                    padding: '6px 10px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    minWidth: '40px',
                    transition: 'all 0.2s',
                    opacity: modoEdicao ? 0.5 : 1
                  }}
                  onMouseOver={(e) => {
                    if (!modoEdicao) e.currentTarget.style.background = '#e5e7eb';
                  }}
                  onMouseOut={(e) => {
                    if (!modoEdicao) e.currentTarget.style.background = '#f3f4f6';
                  }}
                >
                  ↺
                </button>
              </div>

              {/* Placar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                paddingLeft: '8px',
                paddingRight: '8px'
              }}>
                <button
                  onClick={alternarCorTimeA}
                  disabled={modoEdicao}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: modoEdicao ? 'not-allowed' : 'pointer',
                    padding: '2px',
                    transition: 'all 0.2s',
                    opacity: modoEdicao ? 0.5 : 1
                  }}
                  onMouseOver={(e) => {
                    if (!modoEdicao) e.currentTarget.style.transform = 'scale(1.15)';
                  }}
                  onMouseOut={(e) => {
                    if (!modoEdicao) e.currentTarget.style.transform = 'scale(1)';
                  }}
                  title="Clique para trocar cor do colete"
                >
                  <svg width="36" height="36" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 8C14 8 16 6 18 6C20 6 20 8 24 8C28 8 28 6 30 6C32 6 34 8 34 8L38 14V16L36 18V38C36 40 34 42 32 42H16C14 42 12 40 12 38V18L10 16V14L14 8Z" 
                      fill={corTimeA} 
                      stroke={corTimeA === '#FFFFFF' ? '#d1d5db' : corTimeA} 
                      strokeWidth="1.5"/>
                    <circle cx="20" cy="22" r="1.5" fill={corTimeA === '#000000' ? 'white' : 'rgba(0,0,0,0.15)'}/>
                    <circle cx="28" cy="22" r="1.5" fill={corTimeA === '#000000' ? 'white' : 'rgba(0,0,0,0.15)'}/>
                  </svg>
                </button>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    fontSize: '36px',
                    fontWeight: '800',
                    color: '#1f2937',
                    minWidth: '42px',
                    textAlign: 'center',
                    lineHeight: '1'
                  }}>
                    {placarTimeA}
                  </div>
                  
                  <span style={{ 
                    fontSize: '20px', 
                    color: '#9ca3af', 
                    fontWeight: '600',
                    lineHeight: '1'
                  }}>×</span>
                  
                  <div style={{
                    fontSize: '36px',
                    fontWeight: '800',
                    color: '#1f2937',
                    minWidth: '42px',
                    textAlign: 'center',
                    lineHeight: '1'
                  }}>
                    {placarTimeB}
                  </div>
                </div>
                
                <button
                  onClick={alternarCorTimeB}
                  disabled={modoEdicao}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: modoEdicao ? 'not-allowed' : 'pointer',
                    padding: '2px',
                    transition: 'all 0.2s',
                    opacity: modoEdicao ? 0.5 : 1
                  }}
                  onMouseOver={(e) => {
                    if (!modoEdicao) e.currentTarget.style.transform = 'scale(1.15)';
                  }}
                  onMouseOut={(e) => {
                    if (!modoEdicao) e.currentTarget.style.transform = 'scale(1)';
                  }}
                  title="Clique para trocar cor do colete"
                >
                  <svg width="36" height="36" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 8C14 8 16 6 18 6C20 6 20 8 24 8C28 8 28 6 30 6C32 6 34 8 34 8L38 14V16L36 18V38C36 40 34 42 32 42H16C14 42 12 40 12 38V18L10 16V14L14 8Z" 
                      fill={corTimeB} 
                      stroke={corTimeB === '#FFFFFF' ? '#d1d5db' : corTimeB} 
                      strokeWidth="1.5"/>
                    <circle cx="20" cy="22" r="1.5" fill={corTimeB === '#000000' ? 'white' : 'rgba(0,0,0,0.15)'}/>
                    <circle cx="28" cy="22" r="1.5" fill={corTimeB === '#000000' ? 'white' : 'rgba(0,0,0,0.15)'}/>
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Cronômetro e Placar no modo prancheta */}
          {modoPrancheta && (
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '8px 12px',
              marginTop: '2px',
              border: '2px solid #e5e7eb',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              alignItems: 'center',
              animation: 'slideInFromTop 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards',
              overflow: 'hidden'
            }}>
              {/* Cronômetro */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: '4px'
              }}>
                <button
                  onClick={() => setCronometroAtivo(!cronometroAtivo)}
                  disabled={modoEdicao}
                  style={{
                    background: '#f3f4f6',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '20px',
                    cursor: modoEdicao ? 'not-allowed' : 'pointer',
                    padding: '6px 10px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    minWidth: '40px',
                    transition: 'all 0.2s',
                    animation: !cronometroAtivo && !modoEdicao ? 'pulse 1.5s ease-in-out infinite' : 'none',
                    opacity: modoEdicao ? 0.5 : 1
                  }}
                  onMouseOver={(e) => {
                    if (!modoEdicao) e.currentTarget.style.background = '#e5e7eb';
                  }}
                  onMouseOut={(e) => {
                    if (!modoEdicao) e.currentTarget.style.background = '#f3f4f6';
                  }}
                >
                  {cronometroAtivo ? '⏸' : '▷'}
                </button>
                
                <div style={{
                  fontSize: '36px',
                  fontWeight: '700',
                  fontFamily: 'monospace',
                  color: '#000000',
                  letterSpacing: '1px',
                  lineHeight: '1'
                }}>
                  {formatarTempo(cronometro)}
                </div>
                
                <button
                  onClick={() => setCronometro((regras.tempo_partida || 10) * 60)}
                  disabled={modoEdicao}
                  style={{
                    background: '#f3f4f6',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '20px',
                    cursor: modoEdicao ? 'not-allowed' : 'pointer',
                    padding: '6px 10px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    minWidth: '40px',
                    transition: 'all 0.2s',
                    opacity: modoEdicao ? 0.5 : 1
                  }}
                  onMouseOver={(e) => {
                    if (!modoEdicao) e.currentTarget.style.background = '#e5e7eb';
                  }}
                  onMouseOut={(e) => {
                    if (!modoEdicao) e.currentTarget.style.background = '#f3f4f6';
                  }}
                >
                  ↺
                </button>
              </div>

              {/* Placar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                paddingLeft: '8px',
                paddingRight: '8px'
              }}>
                <button
                  onClick={alternarCorTimeA}
                  disabled={modoEdicao}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: modoEdicao ? 'not-allowed' : 'pointer',
                    padding: '2px',
                    transition: 'all 0.2s',
                    opacity: modoEdicao ? 0.5 : 1
                  }}
                  onMouseOver={(e) => {
                    if (!modoEdicao) e.currentTarget.style.transform = 'scale(1.15)';
                  }}
                  onMouseOut={(e) => {
                    if (!modoEdicao) e.currentTarget.style.transform = 'scale(1)';
                  }}
                  title="Clique para trocar cor do colete"
                >
                  <svg width="36" height="36" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 8C14 8 16 6 18 6C20 6 20 8 24 8C28 8 28 6 30 6C32 6 34 8 34 8L38 14V16L36 18V38C36 40 34 42 32 42H16C14 42 12 40 12 38V18L10 16V14L14 8Z" 
                      fill={corTimeA} 
                      stroke={corTimeA === '#FFFFFF' ? '#d1d5db' : corTimeA} 
                      strokeWidth="1.5"/>
                    <circle cx="20" cy="22" r="1.5" fill={corTimeA === '#000000' ? 'white' : 'rgba(0,0,0,0.15)'}/>
                    <circle cx="28" cy="22" r="1.5" fill={corTimeA === '#000000' ? 'white' : 'rgba(0,0,0,0.15)'}/>
                  </svg>
                </button>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    fontSize: '36px',
                    fontWeight: '800',
                    color: '#1f2937',
                    minWidth: '42px',
                    textAlign: 'center',
                    lineHeight: '1'
                  }}>
                    {placarTimeA}
                  </div>
                  
                  <span style={{ 
                    fontSize: '20px', 
                    color: '#9ca3af', 
                    fontWeight: '600',
                    lineHeight: '1'
                  }}>×</span>
                  
                  <div style={{
                    fontSize: '36px',
                    fontWeight: '800',
                    color: '#1f2937',
                    minWidth: '42px',
                    textAlign: 'center',
                    lineHeight: '1'
                  }}>
                    {placarTimeB}
                  </div>
                </div>
                
                <button
                  onClick={alternarCorTimeB}
                  disabled={modoEdicao}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: modoEdicao ? 'not-allowed' : 'pointer',
                    padding: '2px',
                    transition: 'all 0.2s',
                    opacity: modoEdicao ? 0.5 : 1
                  }}
                  onMouseOver={(e) => {
                    if (!modoEdicao) e.currentTarget.style.transform = 'scale(1.15)';
                  }}
                  onMouseOut={(e) => {
                    if (!modoEdicao) e.currentTarget.style.transform = 'scale(1)';
                  }}
                  title="Clique para trocar cor do colete"
                >
                  <svg width="36" height="36" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 8C14 8 16 6 18 6C20 6 20 8 24 8C28 8 28 6 30 6C32 6 34 8 34 8L38 14V16L36 18V38C36 40 34 42 32 42H16C14 42 12 40 12 38V18L10 16V14L14 8Z" 
                      fill={corTimeB} 
                      stroke={corTimeB === '#FFFFFF' ? '#d1d5db' : corTimeB} 
                      strokeWidth="1.5"/>
                    <circle cx="20" cy="22" r="1.5" fill={corTimeB === '#000000' ? 'white' : 'rgba(0,0,0,0.15)'}/>
                    <circle cx="28" cy="22" r="1.5" fill={corTimeB === '#000000' ? 'white' : 'rgba(0,0,0,0.15)'}/>
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Times */}
          <section className="teams-cards" style={{ marginTop: (modoPartida || modoPrancheta) ? '2px' : '8px' }}>
            <div className="team-card">
              <div className="team-header" style={modoPartida ? {
                background: corTimeA,
                borderColor: corTimeA,
                color: corTimeA === '#FFFFFF' ? '#000' : '#fff'
              } : {}}>
                <h3 style={modoPartida ? { color: corTimeA === '#FFFFFF' ? '#000' : '#fff' } : {}}>{modoPartida ? obterNomeCor(corTimeA).toUpperCase() : 'TIME 1'}</h3>
              </div>
              <div className="team-table-container">
                <table className="team-table">
                  <tbody>
                    {time1.map((jogador, index) => {
                      const estaSelecionado = jogadorSelecionadoTroca?.id === jogador.id;
                      const estaEsperandoGol = selecionandoGolPara === 'A';
                      const golsDoJogador = golsJogadores[jogador.id] || 0;
                      return (
                        <tr 
                          key={jogador.id}
                          style={{
                            background: estaSelecionado ? '#3b82f6' : (estaEsperandoGol ? '#fef3c7' : 'transparent'),
                            color: estaSelecionado ? 'white' : 'inherit',
                            cursor: (modoEdicao || estaEsperandoGol) ? 'pointer' : 'default',
                            height: '45px',
                            border: estaEsperandoGol ? '2px solid #f59e0b' : 'none'
                          }}
                          onClick={() => {
                            if (estaEsperandoGol) {
                              registrarGol(jogador.id, 'A');
                            } else if (modoEdicao) {
                              if (!jogadorSelecionadoTroca) {
                                // Primeiro clique: selecionar jogador
                                setJogadorSelecionadoTroca(jogador);
                              } else if (jogadorSelecionadoTroca.id !== jogador.id) {
                                // Segundo clique: abrir modal de confirmação
                                setJogadorMoverPosicao(jogadorSelecionadoTroca);
                                setPosicaoDestino(jogador.posicao_fila);
                                setShowConfirmarMudancaPosicaoModal(true);
                              } else {
                                // Clicou no mesmo: desselecionar
                                setJogadorSelecionadoTroca(null);
                              }
                            }
                          }}
                        >
                          <td style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: modoEdicao ? 'flex-start' : 'center', height: '45px', padding: '8px 12px' }}>
                            <span style={{ flex: 1, textAlign: modoEdicao ? 'left' : 'center' }}>
                              {jogador.nome}
                              {golsDoJogador > 0 && <span style={{ marginLeft: '6px' }}>{' ⚽'.repeat(golsDoJogador)}</span>}
                            </span>
                            {modoEdicao && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removerDaFila(jogador);
                                }}
                                style={{
                                  background: '#ef4444',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '6px 10px',
                                  cursor: 'pointer',
                                  fontSize: '14px'
                                }}
                              >
                                ❌
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {Array.from({ length: regras.jogadores_por_time - time1.length }).map((_, index) => (
                      <tr key={`empty1-${index}`} className="empty-row" style={{ height: '45px' }}>
                        <td>Aguardando jogador...</td>
                      </tr>
                    ))}
                    {/* Botão Gol Contra */}
                    {selecionandoGolPara === 'A' && (
                      <tr 
                        style={{ 
                          background: '#ef4444',
                          cursor: 'pointer',
                          height: '45px'
                        }}
                        onClick={() => registrarGol('gol_contra', 'A')}
                      >
                        <td style={{ 
                          padding: '8px 12px',
                          color: '#fff',
                          fontWeight: '600',
                          textAlign: 'center'
                        }}>
                          GOL CONTRA
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="team-card">
              <div className="team-header" style={modoPartida ? {
                background: corTimeB,
                borderColor: corTimeB,
                color: corTimeB === '#FFFFFF' ? '#000' : '#fff'
              } : {}}>
                <h3 style={modoPartida ? { color: corTimeB === '#FFFFFF' ? '#000' : '#fff' } : {}}>{modoPartida ? obterNomeCor(corTimeB).toUpperCase() : 'TIME 2'}</h3>
              </div>
              <div className="team-table-container">
                <table className="team-table">
                  <tbody>
                    {time2.map((jogador, index) => {
                      const estaSelecionado = jogadorSelecionadoTroca?.id === jogador.id;
                      const estaEsperandoGol = selecionandoGolPara === 'B';
                      const golsDoJogador = golsJogadores[jogador.id] || 0;
                      return (
                        <tr 
                          key={jogador.id}
                          style={{
                            background: estaSelecionado ? '#3b82f6' : (estaEsperandoGol ? '#fef3c7' : 'transparent'),
                            color: estaSelecionado ? 'white' : 'inherit',
                            cursor: (modoEdicao || estaEsperandoGol) ? 'pointer' : 'default',
                            height: '45px',
                            border: estaEsperandoGol ? '2px solid #f59e0b' : 'none'
                          }}
                          onClick={() => {
                            if (estaEsperandoGol) {
                              registrarGol(jogador.id, 'B');
                            } else if (modoEdicao) {
                              if (!jogadorSelecionadoTroca) {
                                // Primeiro clique: selecionar jogador
                                setJogadorSelecionadoTroca(jogador);
                              } else if (jogadorSelecionadoTroca.id !== jogador.id) {
                                // Segundo clique: abrir modal de confirmação
                                setJogadorMoverPosicao(jogadorSelecionadoTroca);
                                setPosicaoDestino(jogador.posicao_fila);
                                setShowConfirmarMudancaPosicaoModal(true);
                              } else {
                                // Clicou no mesmo: desselecionar
                                setJogadorSelecionadoTroca(null);
                              }
                            }
                          }}
                        >
                          <td style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: modoEdicao ? 'flex-start' : 'center', height: '45px', padding: '8px 12px' }}>
                            <span style={{ flex: 1, textAlign: modoEdicao ? 'left' : 'center' }}>
                              {jogador.nome}
                              {golsDoJogador > 0 && <span style={{ marginLeft: '6px' }}>{' ⚽'.repeat(golsDoJogador)}</span>}
                            </span>
                            {modoEdicao && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removerDaFila(jogador);
                                }}
                                style={{
                                  background: '#ef4444',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '6px 10px',
                                  cursor: 'pointer',
                                  fontSize: '14px'
                                }}
                              >
                                ❌
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {Array.from({ length: regras.jogadores_por_time - time2.length }).map((_, index) => (
                      <tr key={`empty2-${index}`} className="empty-row" style={{ height: '45px' }}>
                        <td>Aguardando jogador...</td>
                      </tr>
                    ))}
                    {/* Botão Gol Contra */}
                    {selecionandoGolPara === 'B' && (
                      <tr 
                        style={{ 
                          background: '#ef4444',
                          cursor: 'pointer',
                          height: '45px'
                        }}
                        onClick={() => registrarGol('gol_contra', 'B')}
                      >
                        <td style={{ 
                          padding: '8px 12px',
                          color: '#fff',
                          fontWeight: '600',
                          textAlign: 'center'
                        }}>
                          GOL CONTRA
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Controles da Partida ou Botão Iniciar */}
          {modoPartida ? (
            <section style={{
              background: 'white',
              borderRadius: '12px',
              padding: '12px',
              marginTop: '2px',
              border: '2px solid #e5e7eb',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
            }}>
              {/* Botões de ação */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '12px',
                marginBottom: '12px'
              }}>
                <button
                  onClick={() => setSelecionandoGolPara('A')}
                  disabled={modoEdicao}
                  style={{
                    background: modoEdicao ? '#9ca3af' : corTimeA,
                    color: corTimeA === '#FFFFFF' && !modoEdicao ? '#000' : '#fff',
                    border: corTimeA === '#FFFFFF' && !modoEdicao ? '2px solid #d1d5db' : 'none',
                    borderRadius: '8px',
                    padding: '16px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: modoEdicao ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    opacity: modoEdicao ? 0.5 : 1
                  }}
                >
                  Gol ⚽
                </button>

                <button
                  onClick={() => {
                    if (historicoAcoes.length > 0) {
                      setShowModalVAR(true);
                    }
                  }}
                  disabled={historicoAcoes.length === 0 || modoEdicao}
                  style={{
                    background: (historicoAcoes.length === 0 || modoEdicao) ? '#9ca3af' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '16px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: (historicoAcoes.length === 0 || modoEdicao) ? 'not-allowed' : 'pointer',
                    opacity: (historicoAcoes.length === 0 || modoEdicao) ? 0.5 : 1
                  }}
                >
                  VAR
                </button>

                <button
                  onClick={() => setSelecionandoGolPara('B')}
                  disabled={modoEdicao}
                  style={{
                    background: modoEdicao ? '#9ca3af' : corTimeB,
                    color: corTimeB === '#FFFFFF' && !modoEdicao ? '#000' : '#fff',
                    border: corTimeB === '#FFFFFF' && !modoEdicao ? '2px solid #d1d5db' : 'none',
                    borderRadius: '8px',
                    padding: '16px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: modoEdicao ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    opacity: modoEdicao ? 0.5 : 1
                  }}
                >
                  Gol ⚽
                </button>
              </div>

              <button
                onClick={async () => {
                  // Carregar regras ao abrir modal (caso não tenha sido carregado antes)
                  if (!regraEmpateConfig) {
                    try {
                      const userData = localStorage.getItem('user');
                      if (userData) {
                        const user = JSON.parse(userData);
                        const { data: regrasData } = await supabase
                          .from('regras')
                          .select('*')
                          .eq('pelada_id', user.id)
                          .single();
                        
                        if (regrasData) {
                          setRegraEmpateConfig(regrasData.regra_empate || 'ambos_saem');
                          setRegrasEmpate({
                            empate_modo: regrasData.regra_empate || null,
                            empate_retorno: regrasData.regra_apos_empate || null,
                            desempate_modo: regrasData.regra_empate || null,
                            empate_conta_vitoria: regrasData.empate_conta_vitoria || false
                          });
                          console.log('📋 Regra de empate carregada:', regrasData.regra_empate);
                        }
                      }
                    } catch (error) {
                      console.error('Erro ao carregar regras:', error);
                    }
                  }
                  setShowModalFinalizacao(true);
                }}
                disabled={modoEdicao}
                style={{
                  background: modoEdicao ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '16px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: modoEdicao ? 'not-allowed' : 'pointer',
                  width: '100%',
                  marginBottom: '8px',
                  opacity: modoEdicao ? 0.5 : 1
                }}
              >
                🏁 Finalizar Partida
              </button>

              <div style={{ textAlign: 'center' }}>
                <button
                  onClick={() => {
                    if (confirm('❌ Cancelar partida?')) {
                      setModoPartida(false);
                      setCronometroAtivo(false);
                      setCronometro((regras.tempo_partida || 10) * 60);
                      setPlacarTimeA(0);
                      setPlacarTimeB(0);
                      setSelecionandoGolPara(null);
                      setGolsJogadores({});
                      setHistoricoAcoes([]);
                      localStorage.removeItem('modo_partida_estado');
                      console.log('✅ Partida cancelada e estado limpo');
                    }
                  }}
                  disabled={modoEdicao}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: modoEdicao ? '#d1d5db' : '#6b7280',
                    fontSize: '14px',
                    cursor: modoEdicao ? 'not-allowed' : 'pointer',
                    textDecoration: 'underline',
                    opacity: modoEdicao ? 0.5 : 1
                  }}
                >
                  Cancelar partida
                </button>
              </div>
            </section>
          ) : modoPrancheta ? (
            <section style={{
              background: 'white',
              borderRadius: '12px',
              padding: '12px',
              marginTop: '2px',
              border: '2px solid #e5e7eb',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
            }}>
              {/* Botões de ação */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '12px',
                marginBottom: '12px'
              }}>
                <button
                  onClick={() => setPlacarTimeA(placarTimeA + 1)}
                  disabled={modoEdicao}
                  style={{
                    background: modoEdicao ? '#9ca3af' : corTimeA,
                    color: corTimeA === '#FFFFFF' && !modoEdicao ? '#000' : '#fff',
                    border: corTimeA === '#FFFFFF' && !modoEdicao ? '2px solid #d1d5db' : 'none',
                    borderRadius: '8px',
                    padding: '16px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: modoEdicao ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    opacity: modoEdicao ? 0.5 : 1
                  }}
                >
                  Gol ⚽
                </button>

                <button
                  onClick={() => {
                    if (placarTimeA > 0 || placarTimeB > 0) {
                      setShowModalVAR(true);
                    }
                  }}
                  disabled={(placarTimeA === 0 && placarTimeB === 0) || modoEdicao}
                  style={{
                    background: ((placarTimeA === 0 && placarTimeB === 0) || modoEdicao) ? '#9ca3af' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '16px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: ((placarTimeA === 0 && placarTimeB === 0) || modoEdicao) ? 'not-allowed' : 'pointer',
                    opacity: ((placarTimeA === 0 && placarTimeB === 0) || modoEdicao) ? 0.5 : 1
                  }}
                >
                  VAR
                </button>

                <button
                  onClick={() => setPlacarTimeB(placarTimeB + 1)}
                  disabled={modoEdicao}
                  style={{
                    background: modoEdicao ? '#9ca3af' : corTimeB,
                    color: corTimeB === '#FFFFFF' && !modoEdicao ? '#000' : '#fff',
                    border: corTimeB === '#FFFFFF' && !modoEdicao ? '2px solid #d1d5db' : 'none',
                    borderRadius: '8px',
                    padding: '16px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: modoEdicao ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    opacity: modoEdicao ? 0.5 : 1
                  }}
                >
                  Gol ⚽
                </button>
              </div>

              <button
                onClick={async () => {
                  // Carregar regras antes de finalizar
                  const userData = localStorage.getItem('user');
                  if (userData) {
                    const user = JSON.parse(userData);
                    try {
                      const { data: regrasData } = await supabase
                        .from('regras')
                        .select('regra_empate, regra_apos_empate, empate_conta_vitoria')
                        .eq('pelada_id', user.id)
                        .single();
                      
                      if (regrasData) {
                        setRegrasEmpate({
                          empate_modo: regrasData.regra_empate || null,
                          empate_retorno: regrasData.regra_apos_empate || null,
                          desempate_modo: regrasData.regra_empate || null,
                          empate_conta_vitoria: regrasData.empate_conta_vitoria || false
                        });
                      }
                    } catch (error) {
                      console.error('Erro ao carregar regras:', error);
                    }
                  }
                  setShowModalFinalizacao(true);
                }}
                disabled={modoEdicao}
                style={{
                  background: modoEdicao ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '16px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: modoEdicao ? 'not-allowed' : 'pointer',
                  width: '100%',
                  opacity: modoEdicao ? 0.5 : 1
                }}
              >
                🏁 Finalizar Partida
              </button>

              <div style={{ textAlign: 'center' }}>
                <button
                  onClick={() => {
                    if (confirm('❌ Cancelar partida?')) {
                      setModoPrancheta(false);
                      setCronometroAtivo(false);
                      setCronometro((regras.tempo_partida || 10) * 60);
                      setPlacarTimeA(0);
                      setPlacarTimeB(0);
                      console.log('✅ Modo prancheta cancelado');
                    }
                  }}
                  disabled={modoEdicao}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: modoEdicao ? '#d1d5db' : '#6b7280',
                    fontSize: '14px',
                    cursor: modoEdicao ? 'not-allowed' : 'pointer',
                    textDecoration: 'underline',
                    opacity: modoEdicao ? 0.5 : 1
                  }}
                >
                  Cancelar partida
                </button>
              </div>
            </section>
          ) : (
            <section className="start-match-container">
              <button
                className="start-match-btn"
                onClick={iniciarPartida}
                disabled={modoEdicao || todosJogadoresNaFila.length < (regras.jogadores_por_time * 2)}
                style={{
                  opacity: modoEdicao ? 0.5 : 1,
                  cursor: modoEdicao ? 'not-allowed' : 'pointer'
                }}
              >
                ⚽ Iniciar Pelada ⚽
              </button>
            </section>
          )}

          {/* Fila */}
          {(filaDeEspera.length > 0 || modoEdicao) && (
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
                {Array.from({ 
                  length: modoEdicao 
                    ? Math.max(1, Math.ceil(filaDeEspera.length / jogadoresPorTime) + (filaDeEspera.length % jogadoresPorTime === 0 ? 1 : 0))
                    : Math.max(1, Math.ceil(filaDeEspera.length / jogadoresPorTime))
                }, (_, blockIndex) => {
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
                          {jogadoresDoBloco.map((jogador, index) => {
                            const estaJogando = jogadoresJogando.some(j => j.id === jogador.id);
                            const estaSelecionado = jogadorSelecionadoTroca?.id === jogador.id;
                            
                            return (
                              <tr 
                                key={jogador.id}
                                style={{
                                  background: estaSelecionado ? '#3b82f6' : 'transparent',
                                  color: estaSelecionado ? 'white' : 'inherit',
                                  cursor: modoEdicao ? 'pointer' : 'default',
                                  height: '45px'
                                }}
                                onClick={() => {
                                  if (modoEdicao) {
                                    if (!jogadorSelecionadoTroca) {
                                      // Primeiro clique: selecionar jogador
                                      setJogadorSelecionadoTroca(jogador);
                                    } else if (jogadorSelecionadoTroca.id !== jogador.id) {
                                      // Segundo clique: abrir modal de confirmação
                                      setJogadorMoverPosicao(jogadorSelecionadoTroca);
                                      setPosicaoDestino(jogador.posicao_fila);
                                      setShowConfirmarMudancaPosicaoModal(true);
                                    } else {
                                      // Clicou no mesmo: desselecionar
                                      setJogadorSelecionadoTroca(null);
                                    }
                                  }
                                }}
                              >
                                <td style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: modoEdicao ? 'flex-start' : 'center', height: '45px', padding: '8px 12px' }}>
                                  <span style={{ flex: 1, textAlign: modoEdicao ? 'left' : 'center' }}>{jogador.nome}</span>
                                  {modoEdicao && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removerDaFila(jogador);
                                      }}
                                      style={{
                                        background: '#ef4444',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        padding: '6px 10px',
                                        cursor: 'pointer',
                                        fontSize: '14px'
                                      }}
                                    >
                                      ❌
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          {/* Botão adicionar jogador no modo edição */}
                          {modoEdicao && jogadoresDoBloco.length < jogadoresPorTime ? (
                            <tr style={{ height: '45px' }}>
                              <td style={{ padding: '8px 12px' }}>
                                <button
                                  onClick={() => {
                                    const posicao = blockIndex * jogadoresPorTime + jogadoresDoBloco.length;
                                    setPosicaoParaAdicionar(posicao);
                                    setShowSelecionarJogadorModal(true);
                                  }}
                                  style={{
                                    background: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    width: '100%',
                                    fontWeight: '600'
                                  }}
                                >
                                  ➕ Adicionar Jogador
                                </button>
                              </td>
                            </tr>
                          ) : null}
                          {Array.from({ length: jogadoresPorTime - jogadoresDoBloco.length - (modoEdicao ? 1 : 0) }).map((_, emptyIndex) => (
                            <tr key={`empty-bloco${blockIndex}-${emptyIndex}`} className="empty-row" style={{ height: '45px' }}>
                              <td style={{ padding: '8px 12px' }}>Aguardando jogador...</td>
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

        {/* Cards Informativos - Partidas e Gols do Dia */}
        {!semSessaoAtiva && (
          <div style={{
            padding: '16px 16px 100px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '9px',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            {/* Card Partidas */}
            <button
              onClick={() => {
                if (!possuiPermissao('verEstatisticas')) {
                  alert('👑 Estatísticas detalhadas exclusivas do plano Premium!\n\nFaça upgrade para acessar histórico completo de partidas.');
                  return;
                }
                carregarInfoPartidas();
              }}
              style={{
                background: !possuiPermissao('verEstatisticas') ? 'rgba(240, 249, 255, 0.5)' : '#f0f9ff',
                border: '2px solid #3b82f6',
                borderRadius: '12px',
                padding: '15px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                position: 'relative',
                opacity: !possuiPermissao('verEstatisticas') ? 0.7 : 1
              }}
              onMouseDown={(e) => {
                const btn = e.currentTarget as HTMLElement;
                btn.style.transform = 'scale(0.95)';
              }}
              onMouseUp={(e) => {
                const btn = e.currentTarget as HTMLElement;
                btn.style.transform = 'scale(1)';
              }}
              onMouseLeave={(e) => {
                const btn = e.currentTarget as HTMLElement;
                btn.style.transform = 'scale(1)';
              }}
            >
              {!possuiPermissao('verEstatisticas') && (
                <div style={{
                  position: 'absolute',
                  top: '5px',
                  right: '5px',
                  background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
                  color: '#fff',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  boxShadow: '0 2px 8px rgba(168, 85, 247, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  zIndex: 10
                }}>
                  <span style={{ fontSize: '8px' }}>👑</span>
                  <span>Premium</span>
                </div>
              )}
              <div style={{ fontSize: '1.875rem', marginBottom: '6px' }}>🥅</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e40af', marginBottom: '3px' }}>
                {totalPartidas}
              </div>
              <div style={{ fontSize: '0.64rem', color: '#64748b', fontWeight: '500' }}>
                Partida{totalPartidas !== 1 ? 's' : ''}
              </div>
            </button>

            {/* Card Gols */}
            <button
              onClick={() => {
                if (!possuiPermissao('verEstatisticas')) {
                  alert('👑 Estatísticas detalhadas exclusivas do plano Premium!\n\nFaça upgrade para acessar ranking de artilheiros.');
                  return;
                }
                carregarInfoGols();
              }}
              style={{
                background: !possuiPermissao('verEstatisticas') ? 'rgba(254, 243, 199, 0.5)' : '#fef3c7',
                border: '2px solid #f59e0b',
                borderRadius: '12px',
                padding: '15px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                position: 'relative',
                opacity: !possuiPermissao('verEstatisticas') ? 0.7 : 1
              }}
              onMouseDown={(e) => {
                const btn = e.currentTarget as HTMLElement;
                btn.style.transform = 'scale(0.95)';
              }}
              onMouseUp={(e) => {
                const btn = e.currentTarget as HTMLElement;
                btn.style.transform = 'scale(1)';
              }}
              onMouseLeave={(e) => {
                const btn = e.currentTarget as HTMLElement;
                btn.style.transform = 'scale(1)';
              }}
            >
              {!possuiPermissao('verEstatisticas') && (
                <div style={{
                  position: 'absolute',
                  top: '5px',
                  right: '5px',
                  background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
                  color: '#fff',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  boxShadow: '0 2px 8px rgba(168, 85, 247, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  zIndex: 10
                }}>
                  <span style={{ fontSize: '8px' }}>👑</span>
                  <span>Premium</span>
                </div>
              )}
              <div style={{ fontSize: '1.875rem', marginBottom: '6px' }}>⚽</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#d97706', marginBottom: '3px' }}>
                {totalGols}
              </div>
              <div style={{ fontSize: '0.64rem', color: '#64748b', fontWeight: '500' }}>
                Gol{totalGols !== 1 ? 's' : ''}
              </div>
            </button>
          </div>
        )}

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
              style={{ flex: 1, display: 'none' }} // Escondido temporariamente
            >
              <span className="text-2xl">👤</span>
              <span className="text-xs font-medium mt-1">Gerenciar</span>
            </button>
            
            {/* Botão Peladeiros - Modo Edição */}
            <button
              onClick={async () => {
                if (modoEdicao) {
                  // Já está em modo edição - abrir modal de confirmação
                  setShowResumoMudancasModal(true);
                } else {
                  // Entrar em modo edição - salvar snapshot
                  try {
                    const userData = localStorage.getItem('user');
                    if (userData) {
                      const user = JSON.parse(userData);
                      const peladaId = user.id;
                      
                      // Buscar sessão ativa
                      const { data: sessaoAtiva } = await supabase
                        .from('sessoes')
                        .select('id')
                        .eq('pelada_id', peladaId)
                        .eq('status', 'ativa')
                        .single();
                      
                      if (sessaoAtiva) {
                        // Buscar fila atual
                        const { data: filaAtual } = await supabase
                          .from('fila')
                          .select('*')
                          .eq('pelada_id', peladaId)
                          .eq('sessao_id', sessaoAtiva.id);
                        
                        if (filaAtual) {
                          // Limpar QUALQUER snapshot anterior (partida ou edição)
                          await supabase
                            .from('fila_snapshot')
                            .delete()
                            .eq('pelada_id', peladaId);
                          
                          // Salvar novo snapshot de edição
                          await supabase
                            .from('fila_snapshot')
                            .insert({
                              pelada_id: peladaId,
                              snapshot_data: filaAtual,
                              tipo: 'edicao'
                            });
                          
                          console.log('📸 Snapshot de edição salvo!');
                        }
                      }
                    }
                  } catch (error) {
                    console.error('❌ Erro ao salvar snapshot de edição:', error);
                  }
                  
                  setModoEdicao(true);
                }
              }}
              className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors"
              style={{ 
                flex: 1,
                color: modoEdicao ? '#10b981' : '#9ca3af',
                background: modoEdicao ? '#d1fae5' : 'transparent',
                animation: modoEdicao && mudancasPendentes.length > 0 ? 'pulse 2s infinite' : 'none'
              }}
            >
              <span className="text-2xl" style={{
                animation: modoEdicao ? 'bounce 1s infinite' : 'none'
              }}>👥</span>
              <span className="text-xs font-medium mt-1">Peladeiros</span>
            </button>
            <style>
              {`
                @keyframes pulse {
                  0%, 100% { transform: scale(1); opacity: 1; }
                  50% { transform: scale(1.05); opacity: 0.8; }
                }
                @keyframes bounce {
                  0%, 100% { transform: translateY(0); }
                  50% { transform: translateY(-5px); }
                }
              `}
            </style>
            <button
              onClick={() => !modoEdicao && (window.location.href = '/fila')}
              className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors"
              style={{ 
                flex: 1,
                opacity: modoEdicao ? 0.3 : 1,
                pointerEvents: modoEdicao ? 'none' : 'auto',
                color: modoEdicao ? '#6b7280' : '#10b981',
                background: modoEdicao ? 'transparent' : '#d1fae5'
              }}
            >
              <span className="text-2xl">📋</span>
              <span className="text-xs font-medium mt-1">Fila</span>
            </button>
            <button
              onClick={() => {
                if (!possuiPermissao('desfazerPartida')) {
                  alert('🔒 Recurso exclusivo do plano Gold e Premium!\n\nFaça upgrade para desfazer partidas.');
                  return;
                }
                if (!modoEdicao) {
                  abrirModalDesfazer();
                }
              }}
              disabled={modoEdicao}
              className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors relative"
              style={{ 
                flex: 1,
                opacity: modoEdicao ? 0.3 : (!possuiPermissao('desfazerPartida') ? 0.6 : 1),
                pointerEvents: modoEdicao ? 'none' : 'auto',
                color: modoEdicao ? '#6b7280' : (!possuiPermissao('desfazerPartida') ? '#9ca3af' : '#9ca3af'),
                background: !possuiPermissao('desfazerPartida') ? 'rgba(251, 191, 36, 0.1)' : 'transparent'
              }}
            >
              {!possuiPermissao('desfazerPartida') && (
                <div style={{
                  position: 'absolute',
                  top: '2px',
                  right: '2px',
                  background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                  color: '#fff',
                  padding: '3px 6px',
                  borderRadius: '10px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  boxShadow: '0 2px 8px rgba(251, 191, 36, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                  zIndex: 10
                }}>
                  <span style={{ fontSize: '8px' }}>⭐</span>
                  <span>Gold</span>
                </div>
              )}
              <span className="text-2xl">↩️</span>
              <span className="text-xs font-medium mt-1">Desfazer</span>
            </button>
            <button
              onClick={() => !modoEdicao && abrirModalEncerrar()}
              className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors"
              style={{ 
                flex: 1,
                opacity: modoEdicao ? 0.3 : 1,
                pointerEvents: modoEdicao ? 'none' : 'auto',
                color: modoEdicao ? '#6b7280' : '#9ca3af'
              }}
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

        {/* Modal de Confirmação de Troca */}
        {showConfirmarTrocaModal && jogadorSelecionadoTroca && jogadorParaTroca && (
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
              <h2 style={{ 
                marginBottom: '24px', 
                fontSize: '24px',
                color: '#1f2937',
                fontWeight: '700'
              }}>
                🔄 Trocar Posições?
              </h2>

              <div style={{
                background: '#f8f9fa',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '24px',
                fontSize: '16px',
                lineHeight: '1.6',
                color: '#374151'
              }}>
                Trocar <strong>{jogadorSelecionadoTroca.nome}</strong> e <strong>{jogadorParaTroca.nome}</strong> de posições na fila?
              </div>

              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center'
              }}>
                <button
                  onClick={() => {
                    setShowConfirmarTrocaModal(false);
                    setJogadorParaTroca(null);
                    setJogadorSelecionadoTroca(null);
                  }}
                  style={{
                    flex: 1,
                    maxWidth: '150px',
                    background: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '14px 24px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  NÃO
                </button>
                <button
                  onClick={() => {
                    trocarPosicoes(jogadorSelecionadoTroca, jogadorParaTroca);
                    setShowConfirmarTrocaModal(false);
                    setJogadorParaTroca(null);
                    setJogadorSelecionadoTroca(null);
                  }}
                  style={{
                    flex: 1,
                    maxWidth: '150px',
                    background: '#16a34a',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '14px 24px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  SIM
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Selecionar Jogador */}
        {showSelecionarJogadorModal && (
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
              maxHeight: '80vh',
              overflow: 'auto',
              padding: '32px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
            }}>
              <h2 style={{ 
                marginBottom: '24px', 
                fontSize: '24px',
                color: '#1f2937',
                fontWeight: '700',
                textAlign: 'center'
              }}>
                👥 Selecionar Jogador
              </h2>

              {/* Lista de jogadores na reserva */}
              {jogadoresReserva.length > 0 ? (
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ 
                    fontSize: '16px', 
                    color: '#6b7280', 
                    marginBottom: '12px',
                    fontWeight: '600'
                  }}>
                    Jogadores na Reserva
                  </h3>
                  {jogadoresReserva.map((jogador) => (
                    <button
                      key={jogador.id}
                      onClick={() => {
                        voltarParaFila(jogador);
                        setShowSelecionarJogadorModal(false);
                        setPosicaoParaAdicionar(null);
                      }}
                      style={{
                        width: '100%',
                        background: '#f8f9fa',
                        border: '2px solid #e9ecef',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '10px',
                        cursor: 'pointer',
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#1f2937',
                        textAlign: 'left',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#e0f2fe';
                        e.currentTarget.style.borderColor = '#3b82f6';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#f8f9fa';
                        e.currentTarget.style.borderColor = '#e9ecef';
                      }}
                    >
                      {jogador.nome}
                    </button>
                  ))}
                </div>
              ) : (
                <p style={{ 
                  textAlign: 'center', 
                  color: '#6b7280', 
                  marginBottom: '20px',
                  fontSize: '14px'
                }}>
                  Nenhum jogador na reserva
                </p>
              )}

              <div style={{
                borderTop: '2px solid #e9ecef',
                paddingTop: '20px',
                marginTop: '20px'
              }}>
                <button
                  onClick={() => {
                    setShowSelecionarJogadorModal(false);
                    setShowCadastroModal(true);
                  }}
                  style={{
                    width: '100%',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '16px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    marginBottom: '12px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#059669';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#10b981';
                  }}
                >
                  ➕ Cadastrar Novo Jogador
                </button>

                <button
                  onClick={() => {
                    setShowSelecionarJogadorModal(false);
                    setPosicaoParaAdicionar(null);
                  }}
                  style={{
                    width: '100%',
                    background: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '16px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#4b5563';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#6b7280';
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Resumo de Mudanças */}
        {showResumoMudancasModal && (
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
              maxWidth: '550px',
              width: '100%',
              padding: '32px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              textAlign: 'center',
              maxHeight: '80vh',
              overflow: 'auto'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
              <h2 style={{ 
                fontSize: '24px', 
                fontWeight: '700', 
                color: '#1a1a1a',
                marginBottom: '8px'
              }}>
                Confirmar Mudanças?
              </h2>
              <p style={{ 
                fontSize: '14px', 
                color: '#6b7280',
                marginBottom: '24px'
              }}>
                As alterações foram aplicadas. Deseja mantê-las ou desfazer?
              </p>
              
              {/* Aviso */}
              <div style={{
                background: '#fef3c7',
                border: '2px solid #f59e0b',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '24px',
                textAlign: 'left'
              }}>
                <p style={{
                  margin: 0,
                  fontSize: '14px',
                  color: '#92400e',
                  fontWeight: '500'
                }}>
                  ℹ️ As mudanças já foram aplicadas em tempo real. Clique em:
                </p>
                <ul style={{
                  margin: '8px 0 0 20px',
                  padding: 0,
                  fontSize: '13px',
                  color: '#92400e'
                }}>
                  <li><strong>SIM</strong> para manter as alterações</li>
                  <li><strong>NÃO</strong> para desfazer tudo (restaura o estado inicial)</li>
                </ul>
              </div>

              {/* Botões */}
              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center'
              }}>
                <button
                  onClick={async () => {
                    // Cancelar - restaurar snapshot
                    setShowResumoMudancasModal(false);
                    
                    try {
                      const userData = localStorage.getItem('user');
                      if (userData) {
                        const user = JSON.parse(userData);
                        const peladaId = user.id;
                        
                        // Buscar snapshot
                        const { data: snapshots } = await supabase
                          .from('fila_snapshot')
                          .select('*')
                          .eq('pelada_id', peladaId)
                          .order('created_at', { ascending: false })
                          .limit(1);
                        
                        if (!snapshots || snapshots.length === 0) {
                          alert('❌ Não há ações para desfazer.\n\nEsta funcionalidade só funciona após iniciar o modo de edição.');
                          setModoEdicao(false);
                          return;
                        }
                        
                        const snapshot = snapshots[0];
                        const snapshotData = snapshot.snapshot_data;
                        
                        console.log('🔄 Restaurando snapshot:', snapshotData);
                        
                        // Buscar sessão ativa
                        const { data: sessoes } = await supabase
                          .from('sessoes')
                          .select('id')
                          .eq('pelada_id', peladaId)
                          .eq('status', 'ativa')
                          .order('created_at', { ascending: false })
                          .limit(1);
                        
                        if (sessoes && sessoes.length > 0) {
                          const sessaoId = sessoes[0].id;
                          
                          // Restaurar cada jogador
                          for (const jogador of snapshotData.jogadores) {
                            await supabase
                              .from('fila')
                              .update({
                                posicao_fila: jogador.posicao_fila,
                                status: jogador.status
                              })
                              .eq('jogador_id', jogador.jogador_id)
                              .eq('pelada_id', peladaId)
                              .eq('sessao_id', sessaoId);
                          }
                          
                          console.log('✅ Snapshot restaurado!');
                        }
                        
                        // Recarregar dados e sair do modo edição
                        await carregarDados();
                        setModoEdicao(false);
                        setMudancasPendentes([]);
                        setJogadorSelecionadoTroca(null);
                      }
                    } catch (error) {
                      console.error('❌ Erro ao restaurar snapshot:', error);
                      alert('Erro ao desfazer alterações. Recarregue a página.');
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '14px 24px',
                    fontSize: '16px',
                    fontWeight: '600',
                    borderRadius: '8px',
                    border: '2px solid #ef4444',
                    backgroundColor: '#fff',
                    color: '#ef4444',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  ❌ Desfazer
                </button>

                <button
                  onClick={async () => {
                    try {
                      console.log('✅ Aplicando mudanças pendentes...', mudancasPendentes);
                      
                      // Aplicar todas as mudanças pendentes no banco
                      for (const mudanca of mudancasPendentes) {
                        if (mudanca.tipo === 'remover') {
                          console.log('🗑️ Removendo:', mudanca.jogador.nome);
                          await removerDaFila(mudanca.jogador, true); // aplicarAgora = true
                        } else if (mudanca.tipo === 'voltar') {
                          console.log('⬅️ Voltando para fila:', mudanca.jogador.nome);
                          await voltarParaFila(mudanca.jogador, true); // aplicarAgora = true
                        } else if (mudanca.tipo === 'trocar') {
                          console.log('🔄 Trocando jogadores:', mudanca.jogador1.nome, '↔️', mudanca.jogador2.nome);
                          // Implementar lógica de trocar se necessário
                        }
                      }
                      
                      // Fechar modal e limpar
                      setShowResumoMudancasModal(false);
                      setModoEdicao(false);
                      setMudancasPendentes([]);
                      setJogadorSelecionadoTroca(null);
                      await carregarDados();
                      
                      console.log('✅ Mudanças aplicadas com sucesso!');
                    } catch (error) {
                      console.error('❌ Erro ao aplicar mudanças:', error);
                      alert('Erro ao salvar alterações!');
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '14px 24px',
                    fontSize: '16px',
                    fontWeight: '600',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#10b981',
                    color: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  ✅ Manter
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Confirmação de Mudança de Posição */}
        {showConfirmarMudancaPosicaoModal && jogadorMoverPosicao && posicaoDestino && (
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
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔄</div>
              <h2 style={{ 
                fontSize: '24px', 
                fontWeight: '700', 
                color: '#1a1a1a',
                marginBottom: '16px'
              }}>
                Confirmar Mudança de Posição?
              </h2>
              
              <div style={{
                background: '#f3f4f6',
                borderRadius: '8px',
                padding: '20px',
                marginBottom: '24px',
                textAlign: 'left'
              }}>
                <p style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#374151' }}>
                  <strong>{jogadorMoverPosicao.nome}</strong> (posição {jogadorMoverPosicao.posicao_fila})
                </p>
                <p style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#374151' }}>
                  ⬇️ vai para a posição <strong>{posicaoDestino}</strong>
                </p>
                <p style={{ margin: 0, fontSize: '14px', color: '#6b7280', fontStyle: 'italic' }}>
                  Os jogadores da posição {posicaoDestino} em diante serão reposicionados automaticamente.
                </p>
              </div>

              {/* Botões */}
              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center'
              }}>
                <button
                  onClick={() => {
                    setShowConfirmarMudancaPosicaoModal(false);
                    setJogadorMoverPosicao(null);
                    setPosicaoDestino(null);
                    setJogadorSelecionadoTroca(null);
                  }}
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
                >
                  Cancelar
                </button>

                <button
                  onClick={async () => {
                    await moverJogadorParaPosicao(jogadorMoverPosicao, posicaoDestino);
                    setShowConfirmarMudancaPosicaoModal(false);
                    setJogadorMoverPosicao(null);
                    setPosicaoDestino(null);
                    setJogadorSelecionadoTroca(null);
                  }}
                  style={{
                    flex: 1,
                    padding: '14px 24px',
                    fontSize: '16px',
                    fontWeight: '600',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#10b981',
                    color: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Finalização da Partida */}
        {showModalFinalizacao && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 2600
          }}>
            <div 
              key={`modal-${timeEscolhidoDesempate || 'none'}`}
              style={{
              background: '#fff',
              borderRadius: '20px',
              maxWidth: '450px',
              width: '100%',
              padding: '32px 28px',
              textAlign: 'center',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)'
            }}>
              <h2 style={{ 
                fontSize: '1.75rem', 
                fontWeight: 'bold', 
                marginBottom: '24px', 
                color: '#1a1a1a' 
              }}>
                Resultado Final
              </h2>
              
              {/* Placar Final */}
              <div style={{ marginBottom: '28px' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  gap: '24px', 
                  marginBottom: '12px',
                  alignItems: 'flex-start'
                }}>
                  {/* Time A */}
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: '600', color: corTimeA, marginBottom: '8px' }}>
                      {obterNomeCor(corTimeA).toUpperCase()}
                    </div>
                    <div style={{ fontSize: '3rem', fontWeight: 'bold', color: corTimeA, marginBottom: '12px' }}>
                      {placarTimeA}
                    </div>
                    {/* Gols Time A */}
                    {historicoAcoes.filter(h => h.time === 'A').length > 0 && (
                      <div style={{ 
                        background: '#f9fafb', 
                        borderRadius: '8px', 
                        padding: '10px 8px',
                        border: `1px solid ${corTimeA}20`
                      }}>
                        {historicoAcoes.filter(h => h.time === 'A').map((gol, idx) => {
                          const jogador = time1.find(j => j.id === gol.jogadorId);
                          return (
                            <div key={idx} style={{ fontSize: '0.75rem', color: '#333', marginBottom: '3px' }}>
                              ⚽ {jogador?.nome || 'Jogador'}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <span style={{ fontSize: '2rem', color: '#9ca3af', fontWeight: 'bold', marginTop: '40px' }}>×</span>

                  {/* Time B */}
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: '600', color: corTimeB, marginBottom: '8px' }}>
                      {obterNomeCor(corTimeB).toUpperCase()}
                    </div>
                    <div style={{ fontSize: '3rem', fontWeight: 'bold', color: corTimeB, marginBottom: '12px' }}>
                      {placarTimeB}
                    </div>
                    {/* Gols Time B */}
                    {historicoAcoes.filter(h => h.time === 'B').length > 0 && (
                      <div style={{ 
                        background: '#f9fafb', 
                        borderRadius: '8px', 
                        padding: '10px 8px',
                        border: `1px solid ${corTimeB}20`
                      }}>
                        {historicoAcoes.filter(h => h.time === 'B').map((gol, idx) => {
                          const jogador = time2.find(j => j.id === gol.jogadorId);
                          return (
                            <div key={idx} style={{ fontSize: '0.75rem', color: '#333', marginBottom: '3px' }}>
                              ⚽ {jogador?.nome || 'Jogador'}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Mensagem de resultado */}
                {placarTimeA !== placarTimeB && (
                  <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#16a34a', marginTop: '16px' }}>
                    🏆 Time {obterNomeCor(placarTimeA > placarTimeB ? corTimeA : corTimeB).toUpperCase()} Venceu!
                  </div>
                )}
                {placarTimeA === placarTimeB && (
                  <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#6b7280', marginTop: '16px', marginBottom: '12px' }}>
                    {regrasEmpate.empate_modo === 'desempate' && (
                      <>🤝 Empate!</>
                    )}
                    {regrasEmpate.empate_modo === 'ambos_saem' && (
                      <>🤝 Empate! AMBOS times saem</>
                    )}
                    {regrasEmpate.empate_modo === 'um_sai' && (
                      <>🤝 Empate! Um time sai</>
                    )}
                  </div>
                )}
              </div>

              {/* Prévia de Vitórias Consecutivas */}
              {limiteVitorias && (() => {
                // Recalcular prévia considerando o time selecionado no empate
                let previa;
                const empate = placarTimeA === placarTimeB;
                
                if (empate && timeEscolhidoDesempate && empateContaVitoriaConfig) {
                  // Empate com time escolhido e conta como vitória
                  const novasVitorias = vitoriaConsecutiva + 1;
                  previa = {
                    vitorias: novasVitorias,
                    time: timeEscolhidoDesempate === 'A' ? obterNomeCor(corTimeA).toUpperCase() : obterNomeCor(corTimeB).toUpperCase(),
                    cor: timeEscolhidoDesempate === 'A' ? corTimeA : corTimeB
                  };
                } else {
                  // Usar cálculo normal
                  previa = calcularPreviaVitorias();
                }
                
                return (
                  <div style={{
                    background: '#f0f9ff',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    marginBottom: '20px',
                    border: '2px solid #bfdbfe',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '4px' }}>
                      Se confirmar este resultado:
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#1e40af' }}>
                      Vitórias consecutivas {previa.time ? <span style={{ color: previa.cor, fontWeight: '700' }}>{previa.time}</span> : ''}: {previa.vitorias}/{limiteVitorias}
                    </div>

                    {/* Mensagens informativas quando o limite é atingido */}
                    {previa.vitorias >= limiteVitorias && (
                      <div style={{
                        marginTop: '12px',
                        padding: '12px',
                        background: '#fef3c7',
                        borderRadius: '8px',
                        border: '2px solid #fbbf24'
                      }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#78350f', marginBottom: '8px' }}>
                          ⚠️ Limite atingido!
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#78350f', lineHeight: '1.4' }}>
                          {prioridadeRetorno === 'prioridade' && (
                            <>
                              {previa.time} (vencedor) sai<br />
                              ⚡ E retorna à fila COM prioridade
                            </>
                          )}
                          {prioridadeRetorno === 'sem_prioridade' && (
                            <>
                              {previa.time} (vencedor) sai<br />
                              E retorna à fila SEM prioridade
                            </>
                          )}
                          {prioridadeRetorno === 'mesclar' && (
                            <>
                              Ambos os times saem<br />
                              🔄 Jogadores mesclados no retorno
                            </>
                          )}
                          {prioridadeRetorno === 'perdedor_continua' && (
                            <>
                              {previa.time} (vencedor) sai<br />
                              ⚡ Time perdedor continua jogando
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* CENÁRIO 2: Empate com decisão de retorno à fila */}
              {placarTimeA === placarTimeB && regrasEmpate.empate_modo === 'ambos_saem' && regrasEmpate.empate_retorno === 'desempate_decide' && (
                <div style={{
                  background: '#fef3c7',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '20px',
                  border: '2px solid #fbbf24'
                }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#78350f', marginBottom: '12px' }}>
                    ❓ Qual time retorna PRIMEIRO à fila?
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => setTimeEscolhidoDesempate('A')}
                      style={{
                        flex: 1,
                        background: timeEscolhidoDesempate === 'A' ? corTimeA : '#fff',
                        color: timeEscolhidoDesempate === 'A' ? (corTimeA === '#FFFFFF' ? '#000' : '#fff') : corTimeA,
                        border: `2px solid ${corTimeA}`,
                        borderRadius: '8px',
                        padding: '12px',
                        fontSize: '0.9rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {obterNomeCor(corTimeA).toUpperCase()}
                    </button>
                    <button
                      onClick={() => setTimeEscolhidoDesempate('B')}
                      style={{
                        flex: 1,
                        background: timeEscolhidoDesempate === 'B' ? corTimeB : '#fff',
                        color: timeEscolhidoDesempate === 'B' ? (corTimeB === '#FFFFFF' ? '#000' : '#fff') : corTimeB,
                        border: `2px solid ${corTimeB}`,
                        borderRadius: '8px',
                        padding: '12px',
                        fontSize: '0.9rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {obterNomeCor(corTimeB).toUpperCase()}
                    </button>
                  </div>
                </div>
              )}

              {/* CENÁRIO 3: Desempate na própria partida (1 time continua jogando) */}
              {placarTimeA === placarTimeB && regrasEmpate.empate_modo === 'desempate' && (
                <div style={{
                  background: '#fef3c7',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '20px',
                  border: '2px solid #fbbf24'
                }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#78350f', marginBottom: '12px' }}>
                    ⚡ Desempate: quem fica jogando?
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => setTimeEscolhidoDesempate('A')}
                      style={{
                        flex: 1,
                        background: timeEscolhidoDesempate === 'A' ? corTimeA : '#fff',
                        color: timeEscolhidoDesempate === 'A' ? (corTimeA === '#FFFFFF' ? '#000' : '#fff') : corTimeA,
                        border: `2px solid ${corTimeA}`,
                        borderRadius: '8px',
                        padding: '12px',
                        fontSize: '0.9rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {obterNomeCor(corTimeA).toUpperCase()}
                    </button>
                    <button
                      onClick={() => setTimeEscolhidoDesempate('B')}
                      style={{
                        flex: 1,
                        background: timeEscolhidoDesempate === 'B' ? corTimeB : '#fff',
                        color: timeEscolhidoDesempate === 'B' ? (corTimeB === '#FFFFFF' ? '#000' : '#fff') : corTimeB,
                        border: `2px solid ${corTimeB}`,
                        borderRadius: '8px',
                        padding: '12px',
                        fontSize: '0.9rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {obterNomeCor(corTimeB).toUpperCase()}
                    </button>
                  </div>
                </div>
              )}

              {/* Botões */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button
                  onClick={() => {
                    // Validar se precisa escolher time no desempate
                    if (placarTimeA === placarTimeB && 
                        ((regrasEmpate.empate_modo === 'ambos_saem' && regrasEmpate.empate_retorno === 'desempate_decide') || 
                         regrasEmpate.desempate_modo === 'desempate') && 
                        !timeEscolhidoDesempate) {
                      alert('⚽ Por favor, selecione qual time venceu o desempate!');
                      return;
                    }
                    // Finalizar partida
                    finalizarPartidaComRotacao();
                  }}
                  disabled={finalizandoPartida || (placarTimeA === placarTimeB && 
                    ((regrasEmpate.empate_modo === 'ambos_saem' && regrasEmpate.empate_retorno === 'desempate_decide') || 
                     regrasEmpate.desempate_modo === 'desempate') && 
                    !timeEscolhidoDesempate)}
                  style={{
                    background: (finalizandoPartida || (placarTimeA === placarTimeB && 
                      ((regrasEmpate.empate_modo === 'ambos_saem' && regrasEmpate.empate_retorno === 'desempate_decide') || 
                       regrasEmpate.desempate_modo === 'desempate') && 
                      !timeEscolhidoDesempate)) ? '#9ca3af' : '#16a34a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '14px',
                    fontSize: '1rem',
                    fontWeight: '700',
                    cursor: (finalizandoPartida || (placarTimeA === placarTimeB && 
                      ((regrasEmpate.empate_modo === 'ambos_saem' && regrasEmpate.empate_retorno === 'desempate_decide') || 
                       regrasEmpate.desempate_modo === 'desempate') && 
                      !timeEscolhidoDesempate)) ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)',
                    transition: 'all 0.2s',
                    opacity: (finalizandoPartida || (placarTimeA === placarTimeB && 
                      ((regrasEmpate.empate_modo === 'ambos_saem' && regrasEmpate.empate_retorno === 'desempate_decide') || 
                       regrasEmpate.desempate_modo === 'desempate') && 
                      !timeEscolhidoDesempate)) ? 0.5 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!(finalizandoPartida || (placarTimeA === placarTimeB && 
                      ((regrasEmpate.empate_modo === 'ambos_saem' && regrasEmpate.empate_retorno === 'desempate_decide') || 
                       regrasEmpate.desempate_modo === 'desempate') && 
                      !timeEscolhidoDesempate))) {
                      e.currentTarget.style.transform = 'scale(1.02)';
                    }
                  }}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {finalizandoPartida ? '⏳ Finalizando...' : '✅ Finalizar Partida'}
                </button>
                <button
                  onClick={() => {
                    setShowModalFinalizacao(false);
                    setTimeEscolhidoDesempate(null); // Resetar escolha ao cancelar
                  }}
                  style={{
                    background: '#f3f4f6',
                    color: '#1f2937',
                    border: '2px solid #d1d5db',
                    borderRadius: '12px',
                    padding: '14px',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#e5e7eb';
                    e.currentTarget.style.borderColor = '#9ca3af';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f3f4f6';
                    e.currentTarget.style.borderColor = '#d1d5db';
                  }}
                >
                  🔧 Fazer Ajustes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de confirmação VAR */}
        {showModalVAR && (modoPartida ? historicoAcoes.length > 0 : (placarTimeA > 0 || placarTimeB > 0)) && (
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
            zIndex: 2500,
            padding: '20px'
          }}>
            <div style={{
              backgroundColor: '#fff',
              borderRadius: '20px',
              maxWidth: '450px',
              width: '100%',
              padding: '32px 24px'
            }}>
              <div style={{ fontSize: '3.5rem', textAlign: 'center', marginBottom: '16px' }}>🎬</div>
              
              <h2 style={{ 
                fontSize: '1.5rem', 
                fontWeight: 'bold', 
                textAlign: 'center',
                marginBottom: '12px',
                color: '#3b82f6'
              }}>
                VAR - Revisão
              </h2>
              
              <p style={{ 
                fontSize: '0.95rem', 
                color: '#666',
                textAlign: 'center',
                marginBottom: '20px',
                lineHeight: '1.5'
              }}>
                {modoPrancheta ? (
                  <>
                    Escolha qual time teve o gol anulado:
                  </>
                ) : (
                  (() => {
                    const ultimaAcao = historicoAcoes[historicoAcoes.length - 1];
                    const nomeTime = ultimaAcao.time === 'A' ? obterNomeCor(corTimeA) : obterNomeCor(corTimeB);
                    
                    // Verificar se é gol contra
                    if (ultimaAcao.jogadorId === 'gol_contra') {
                      return (
                        <>
                          Desfazer o <strong>Gol Contra</strong> marcado a favor do <strong>{nomeTime}</strong>?
                        </>
                      );
                    }
                    
                    // Gol normal
                    const jogadorNome = time1.concat(time2).find(j => j.id === ultimaAcao.jogadorId)?.nome || 'Jogador';
                    return (
                      <>
                        Desfazer o gol de <strong>{jogadorNome}</strong> marcado pelo <strong>{nomeTime}</strong>?
                      </>
                    );
                  })()
                )}
              </p>

              {modoPrancheta ? (
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  marginTop: '24px'
                }}>
                  <button
                    onClick={() => {
                      if (placarTimeA > 0) {
                        setPlacarTimeA(placarTimeA - 1);
                      }
                      setShowModalVAR(false);
                    }}
                    disabled={placarTimeA === 0}
                    style={{
                      flex: 1,
                      padding: '14px 24px',
                      fontSize: '16px',
                      fontWeight: '600',
                      borderRadius: '8px',
                      border: placarTimeA === 0 ? '2px solid #e5e7eb' : 'none',
                      backgroundColor: placarTimeA === 0 ? 'white' : corTimeA,
                      color: placarTimeA === 0 ? '#9ca3af' : (corTimeA === '#FFFFFF' ? '#000' : '#fff'),
                      cursor: placarTimeA === 0 ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      opacity: placarTimeA === 0 ? 0.5 : 1
                    }}
                  >
                    ❌ {obterNomeCor(corTimeA).toUpperCase()}
                  </button>
                  <button
                    onClick={() => {
                      if (placarTimeB > 0) {
                        setPlacarTimeB(placarTimeB - 1);
                      }
                      setShowModalVAR(false);
                    }}
                    disabled={placarTimeB === 0}
                    style={{
                      flex: 1,
                      padding: '14px 24px',
                      fontSize: '16px',
                      fontWeight: '600',
                      borderRadius: '8px',
                      border: placarTimeB === 0 ? '2px solid #e5e7eb' : 'none',
                      backgroundColor: placarTimeB === 0 ? 'white' : corTimeB,
                      color: placarTimeB === 0 ? '#9ca3af' : (corTimeB === '#FFFFFF' ? '#000' : '#fff'),
                      cursor: placarTimeB === 0 ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      opacity: placarTimeB === 0 ? 0.5 : 1
                    }}
                  >
                    ❌ {obterNomeCor(corTimeB).toUpperCase()}
                  </button>
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  marginTop: '24px'
                }}>
                  <button
                    onClick={() => setShowModalVAR(false)}
                    style={{
                      flex: 1,
                      padding: '14px 24px',
                      fontSize: '16px',
                      fontWeight: '600',
                      borderRadius: '8px',
                      border: '2px solid #e5e7eb',
                      backgroundColor: 'white',
                      color: '#6b7280',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      desfazerUltimaAcao();
                      setShowModalVAR(false);
                    }}
                    style={{
                      flex: 1,
                      padding: '14px 24px',
                      fontSize: '16px',
                      fontWeight: '600',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    ✓ Confirmar
                  </button>
                </div>
              )}
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
                Esta ação irá <strong>finalizar todas as partidas do dia</strong>, calcular e fechar as estatísticas. 
                <br/><br/>
                <strong style={{ color: '#dc2626' }}>⚠️ Esta ação é IRREVERSÍVEL!</strong>
              </p>

              {/* Resumo da pelada */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                marginBottom: '24px'
              }}>
                <div style={{
                  background: '#f0f9ff',
                  border: '2px solid #3b82f6',
                  borderRadius: '12px',
                  padding: '20px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🥅</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e40af', marginBottom: '4px' }}>
                    {totalPartidas}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>
                    Partida{totalPartidas !== 1 ? 's' : ''}
                  </div>
                </div>
                
                <div style={{
                  background: '#fef3c7',
                  border: '2px solid #f59e0b',
                  borderRadius: '12px',
                  padding: '20px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>⚽</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#d97706', marginBottom: '4px' }}>
                    {totalGols}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>
                    Gol{totalGols !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>

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

        {/* Modal de Sucesso ao Encerrar Pelada */}
        {showModalSucessoEncerrar && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
            padding: '20px'
          }}>
            <style dangerouslySetInnerHTML={{__html: `
              @keyframes fadeInModal {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              @keyframes slideUpModal {
                from {
                  opacity: 0;
                  transform: translateY(30px);
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                }
              }
              @keyframes bounceModal {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.1); }
              }
              @keyframes progressBar {
                from { transform: translateX(-100%); }
                to { transform: translateX(0); }
              }
            `}} />
            <div style={{
              backgroundColor: '#fff',
              borderRadius: '24px',
              maxWidth: '420px',
              width: '100%',
              padding: '48px 32px',
              textAlign: 'center',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
              animation: 'slideUpModal 0.4s ease-out'
            }}>
              {/* Ícone animado */}
              <div style={{
                fontSize: '5rem',
                marginBottom: '24px',
                animation: 'bounceModal 0.6s ease-in-out'
              }}>
                ✅
              </div>

              <h2 style={{
                fontSize: '1.75rem',
                fontWeight: '700',
                color: '#16a34a',
                marginBottom: '16px',
                lineHeight: '1.3'
              }}>
                Pelada Encerrada<br/>com Sucesso!
              </h2>

              <p style={{
                fontSize: '1.1rem',
                color: '#6b7280',
                marginBottom: '8px'
              }}>
                Até a próxima! ⚽
              </p>

              <p style={{
                fontSize: '0.85rem',
                color: '#9ca3af',
                marginTop: '24px'
              }}>
                Redirecionando para home...
              </p>

              {/* Barra de progresso */}
              <div style={{
                width: '100%',
                height: '4px',
                backgroundColor: '#e5e7eb',
                borderRadius: '2px',
                marginTop: '20px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: '#16a34a',
                  animation: 'progressBar 3s linear'
                }}></div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Limite FREE Atingido (10 partidas) */}
        {showModalLimiteFree && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.92)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
            padding: '20px'
          }}>
            <style dangerouslySetInnerHTML={{__html: `
              @keyframes slideUpFade {
                from {
                  opacity: 0;
                  transform: translateY(40px);
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                }
              }
              @keyframes pulseWarning {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.15); }
              }
            `}} />
            <div style={{
              backgroundColor: '#fff',
              borderRadius: '28px',
              maxWidth: '440px',
              width: '100%',
              padding: '44px 32px',
              textAlign: 'center',
              boxShadow: '0 24px 80px rgba(0, 0, 0, 0.6)',
              animation: 'slideUpFade 0.4s ease-out',
              border: '3px solid #fbbf24'
            }}>
              {/* Ícone animado */}
              <div style={{
                fontSize: '5rem',
                marginBottom: '24px',
                animation: 'pulseWarning 1.2s ease-in-out infinite'
              }}>
                ⚠️
              </div>

              <h2 style={{
                fontSize: '1.85rem',
                fontWeight: '700',
                color: '#d97706',
                marginBottom: '20px',
                lineHeight: '1.2'
              }}>
                Limite Atingido!
              </h2>

              <p style={{
                fontSize: '1.1rem',
                color: '#4b5563',
                marginBottom: '12px',
                fontWeight: '600'
              }}>
                {!possuiPermissao('usarSupabase') ? (
                  <>
                    Plano FREE: máximo de<br/>
                    <span style={{ fontSize: '1.4rem', color: '#d97706' }}>10 partidas</span> por sessão
                  </>
                ) : (
                  <>
                    Plano GOLD: máximo de<br/>
                    <span style={{ fontSize: '1.4rem', color: '#d97706' }}>15 partidas</span> por sessão
                  </>
                )}
              </p>

              <p style={{
                fontSize: '1rem',
                color: '#6b7280',
                marginBottom: '32px',
                lineHeight: '1.5'
              }}>
                Para continuar jogando, você pode:
              </p>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                marginBottom: '32px'
              }}>
                <button
                  onClick={() => {
                    setShowModalLimiteFree(false);
                    // Redirecionar para sorteio (iniciar nova pelada)
                    window.location.href = '/sorteio';
                  }}
                  style={{
                    padding: '16px 24px',
                    fontSize: '1.1rem',
                    fontWeight: '600',
                    backgroundColor: '#10b981',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '16px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  🔄 Iniciar Nova Pelada
                </button>

                <button
                  onClick={() => {
                    setShowModalLimiteFree(false);
                    // Poderia redirecionar para página de upgrade (quando existir)
                  }}
                  style={{
                    padding: '16px 24px',
                    fontSize: '1.1rem',
                    fontWeight: '600',
                    background: !possuiPermissao('usarSupabase') 
                      ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)'
                      : 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '16px',
                    cursor: 'pointer',
                    boxShadow: !possuiPermissao('usarSupabase')
                      ? '0 4px 12px rgba(251, 191, 36, 0.4)'
                      : '0 4px 12px rgba(168, 85, 247, 0.4)',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {!possuiPermissao('usarSupabase') ? '💎 Fazer Upgrade Gold/Premium' : '👑 Fazer Upgrade Premium'}
                </button>
              </div>

              <p style={{
                fontSize: '0.85rem',
                color: '#9ca3af',
                lineHeight: '1.4'
              }}>
                {!possuiPermissao('usarSupabase') ? (
                  <>
                    <strong>Gold/Premium:</strong> Partidas ilimitadas,<br/>
                    sem anúncios e muito mais!
                  </>
                ) : (
                  <>
                    <strong>Premium:</strong> Partidas ilimitadas,<br/>
                    estatísticas completas e muito mais!
                  </>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Modal de Desfazer Última Partida - Informativo */}
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
              padding: '28px'
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: '#1f2937',
                marginBottom: '20px',
                textAlign: 'center'
              }}>
                🔄 Desfazer Ação
              </h2>

              {/* Mostrar apenas a ação correspondente ao snapshot encontrado */}
              {tipoAcaoDesfazer === 'partida' && ultimaPartida && (
                <button
                  onClick={() => {
                    setShowDesfazerModal(false);
                    confirmarDesfazerPartida();
                  }}
                  style={{
                    width: '100%',
                    padding: '20px',
                    border: '2px solid #f59e0b',
                    borderRadius: '12px',
                    background: '#fef3c7',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                    marginBottom: '12px'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = '#fde68a';
                    e.currentTarget.style.transform = 'scale(1.02)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = '#fef3c7';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#92400e', marginBottom: '8px' }}>
                    ⚽ Desfazer Último Resultado
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#78350f', lineHeight: '1.4' }}>
                    Restaura a fila para antes da última partida
                  </div>
                  {ultimaPartida.placar_a !== undefined && (
                    <div style={{ fontSize: '0.85rem', color: '#92400e', marginTop: '8px', fontWeight: '600' }}>
                      Placar: {ultimaPartida.placar_a} x {ultimaPartida.placar_b}
                    </div>
                  )}
                </button>
              )}

              {tipoAcaoDesfazer === 'edicao' && (
                <button
                  onClick={() => {
                    setShowDesfazerModal(false);
                    confirmarDesfazerEdicao();
                  }}
                  style={{
                    width: '100%',
                    padding: '20px',
                    border: '2px solid #3b82f6',
                    borderRadius: '12px',
                    background: '#dbeafe',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                    marginBottom: '12px'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = '#bfdbfe';
                    e.currentTarget.style.transform = 'scale(1.02)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = '#dbeafe';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#1e40af', marginBottom: '8px' }}>
                    ✏️ Desfazer Edição da Fila
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#1e3a8a', lineHeight: '1.4' }}>
                    Restaura a fila para antes da última edição manual
                  </div>
                </button>
              )}

              {/* Botão Cancelar */}
              <button
                onClick={() => {
                  setShowDesfazerModal(false);
                  setUltimaPartida(null);
                }}
                style={{
                  width: '100%',
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

        {/* Modal de Senha - Desfazer Edição */}
        {showDesfazerSenhaModalEdicao && (
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
                Digite sua senha para desfazer a edição
              </p>

              <input
                type="password"
                value={senhaDesfazerEdicao}
                onChange={(e) => setSenhaDesfazerEdicao(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') desfazerEdicaoFila();
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
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />

              {/* Botões */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => {
                    setShowDesfazerSenhaModalEdicao(false);
                    setSenhaDesfazerEdicao('');
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
                  onClick={desfazerEdicaoFila}
                  disabled={!senhaDesfazerEdicao}
                  style={{
                    flex: 1,
                    padding: '14px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    border: 'none',
                    borderRadius: '10px',
                    background: senhaDesfazerEdicao ? '#3b82f6' : '#e5e7eb',
                    color: senhaDesfazerEdicao ? '#fff' : '#999',
                    cursor: senhaDesfazerEdicao ? 'pointer' : 'not-allowed'
                  }}
                >
                  Desfazer Edição
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Desempate */}
        {showModalDesempate && (
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
            zIndex: 2002,
            padding: '20px'
          }}>
            <div style={{
              background: '#fff',
              borderRadius: '20px',
              maxWidth: '450px',
              width: '100%',
              padding: '32px 28px',
              textAlign: 'center',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)'
            }}>
              <h2 style={{ 
                fontSize: '1.75rem', 
                fontWeight: 'bold', 
                marginBottom: '16px', 
                color: '#1a1a1a' 
              }}>
                ⚽ Desempate
              </h2>
              
              <p style={{ 
                fontSize: '1rem', 
                color: '#666',
                marginBottom: '28px',
                lineHeight: '1.5'
              }}>
                O jogo empatou {placarTimeA} x {placarTimeB}.<br />
                Qual time venceu o desempate?
              </p>

              {/* Placar */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                gap: '16px', 
                marginBottom: '24px',
                alignItems: 'center'
              }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: '600', color: corTimeA, marginBottom: '8px' }}>
                    {obterNomeCor(corTimeA).toUpperCase()}
                  </div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: corTimeA }}>
                    {placarTimeA}
                  </div>
                </div>

                <span style={{ fontSize: '1.5rem', color: '#9ca3af', fontWeight: 'bold' }}>×</span>

                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: '600', color: corTimeB, marginBottom: '8px' }}>
                    {obterNomeCor(corTimeB).toUpperCase()}
                  </div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: corTimeB }}>
                    {placarTimeB}
                  </div>
                </div>
              </div>

              {/* Info sobre empate contar como vitória */}
              {empateContaVitoriaConfig && limiteVitorias && (
                <div style={{
                  background: '#fef3c7',
                  borderRadius: '10px',
                  padding: '12px',
                  marginBottom: '20px',
                  border: '2px solid #fbbf24'
                }}>
                  <div style={{ fontSize: '0.85rem', color: '#78350f', fontWeight: '600' }}>
                    ℹ️ Empate conta como vitória consecutiva para o vencedor do desempate
                  </div>
                </div>
              )}

              {/* Botões de escolha */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                <button
                  onClick={() => setVencedorDesempate('A')}
                  style={{
                    background: vencedorDesempate === 'A' ? corTimeA : '#f3f4f6',
                    color: vencedorDesempate === 'A' ? (corTimeA === '#FFFFFF' ? '#000' : '#fff') : '#1f2937',
                    border: vencedorDesempate === 'A' ? `3px solid ${corTimeA}` : '2px solid #d1d5db',
                    borderRadius: '12px',
                    padding: '16px',
                    fontSize: '1rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: vencedorDesempate === 'A' ? `0 4px 12px ${corTimeA}40` : 'none'
                  }}
                >
                  🏆 {obterNomeCor(corTimeA)} Venceu o Desempate
                </button>

                <button
                  onClick={() => setVencedorDesempate('B')}
                  style={{
                    background: vencedorDesempate === 'B' ? corTimeB : '#f3f4f6',
                    color: vencedorDesempate === 'B' ? (corTimeB === '#FFFFFF' ? '#000' : '#fff') : '#1f2937',
                    border: vencedorDesempate === 'B' ? `3px solid ${corTimeB}` : '2px solid #d1d5db',
                    borderRadius: '12px',
                    padding: '16px',
                    fontSize: '1rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: vencedorDesempate === 'B' ? `0 4px 12px ${corTimeB}40` : 'none'
                  }}
                >
                  🏆 {obterNomeCor(corTimeB)} Venceu o Desempate
                </button>
              </div>

              {/* Botões de ação */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => {
                    setShowModalDesempate(false);
                    setShowModalFinalizacao(true);
                    setVencedorDesempate(null);
                  }}
                  style={{
                    flex: 1,
                    background: '#f3f4f6',
                    color: '#1f2937',
                    border: '2px solid #d1d5db',
                    borderRadius: '12px',
                    padding: '14px',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Voltar
                </button>

                <button
                  onClick={async () => {
                    if (!vencedorDesempate) {
                      alert('Selecione qual time venceu o desempate!');
                      return;
                    }
                    
                    // Finalizar partida com o vencedor do desempate
                    setShowModalDesempate(false);
                    await finalizarPartidaComRotacao();
                    setVencedorDesempate(null);
                  }}
                  disabled={!vencedorDesempate}
                  style={{
                    flex: 1,
                    background: vencedorDesempate ? '#16a34a' : '#9ca3af',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '14px',
                    fontSize: '0.95rem',
                    fontWeight: '700',
                    cursor: vencedorDesempate ? 'pointer' : 'not-allowed',
                    boxShadow: vencedorDesempate ? '0 4px 12px rgba(22, 163, 74, 0.3)' : 'none',
                    opacity: vencedorDesempate ? 1 : 0.6
                  }}
                >
                  ✅ Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Informativo - Partidas do Dia */}
        {showModalInfoPartidas && (
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
            zIndex: 2100,
            padding: '20px'
          }}>
            <div style={{
              backgroundColor: '#fff',
              borderRadius: '20px',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative'
            }}>
              {/* Tarja Gold */}
              {!possuiPermissao('verResultados') && (
                <div style={{
                  position: 'absolute',
                  top: '20px',
                  right: '20px',
                  background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                  color: '#fff',
                  padding: '10px 16px',
                  borderRadius: '25px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 15px rgba(251, 191, 36, 0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  zIndex: 20,
                  border: '2px solid rgba(255, 255, 255, 0.5)'
                }}>
                  <span>⭐</span>
                  <span>Gold</span>
                </div>
              )}
              {/* Header */}
              <div style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                padding: '24px',
                borderTopLeftRadius: '20px',
                borderTopRightRadius: '20px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '8px' }}>🥅</div>
                <h2 style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: 'bold', 
                  color: '#fff',
                  margin: 0
                }}>
                  Partidas do Dia
                </h2>
                <p style={{ 
                  fontSize: '0.9rem', 
                  color: '#e0e7ff',
                  marginTop: '8px',
                  marginBottom: 0
                }}>
                  {partidasDoDia.length} partida{partidasDoDia.length !== 1 ? 's' : ''} realizada{partidasDoDia.length !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Conteúdo */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px'
              }}>
                {partidasDoDia.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🤷</div>
                    <p style={{ fontSize: '1rem' }}>Nenhuma partida realizada ainda</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {partidasDoDia.map((partida, idx) => {
                      return (
                        <div 
                          key={idx}
                          style={{
                            background: '#f9fafb',
                            border: '2px solid #e5e7eb',
                            borderRadius: '12px',
                            padding: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                        >
                          <div style={{ flex: 1, textAlign: 'center' }}>
                            <div style={{ 
                              fontSize: '0.75rem', 
                              fontWeight: '600', 
                              color: '#16a34a',
                              marginBottom: '4px'
                            }}>
                              TIME 1
                            </div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#16a34a' }}>
                              {partida.placar_a}
                            </div>
                          </div>

                          <span style={{ fontSize: '1.2rem', color: '#9ca3af', fontWeight: 'bold', padding: '0 12px' }}>
                            ×
                          </span>

                          <div style={{ flex: 1, textAlign: 'center' }}>
                            <div style={{ 
                              fontSize: '0.75rem', 
                              fontWeight: '600', 
                              color: '#374151',
                              marginBottom: '4px'
                            }}>
                              TIME 2
                            </div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#374151' }}>
                              {partida.placar_b}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: '20px', borderTop: '1px solid #e5e7eb' }}>
                <button
                  onClick={() => setShowModalInfoPartidas(false)}
                  style={{
                    width: '100%',
                    padding: '14px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    border: 'none',
                    borderRadius: '10px',
                    background: '#3b82f6',
                    color: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Informativo - Gols do Dia */}
        {showModalInfoGols && (
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
            zIndex: 2100,
            padding: '20px'
          }}>
            <div style={{
              backgroundColor: '#fff',
              borderRadius: '20px',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative'
            }}>
              {/* Tarja Gold */}
              {!possuiPermissao('verResultados') && (
                <div style={{
                  position: 'absolute',
                  top: '20px',
                  right: '20px',
                  background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                  color: '#fff',
                  padding: '10px 16px',
                  borderRadius: '25px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 15px rgba(251, 191, 36, 0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  zIndex: 20,
                  border: '2px solid rgba(255, 255, 255, 0.5)'
                }}>
                  <span>⭐</span>
                  <span>Gold</span>
                </div>
              )}
              {/* Header */}
              <div style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                padding: '24px',
                borderTopLeftRadius: '20px',
                borderTopRightRadius: '20px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '8px' }}>⚽</div>
                <h2 style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: 'bold', 
                  color: '#fff',
                  margin: 0
                }}>
                  Gols do Dia
                </h2>
                <p style={{ 
                  fontSize: '0.9rem', 
                  color: '#fef3c7',
                  marginTop: '8px',
                  marginBottom: 0
                }}>
                  {totalGols} gol{totalGols !== 1 ? 's' : ''} marcado{totalGols !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Conteúdo */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px'
              }}>
                {artilheirosDoDia.length === 0 && semGolsDoDia.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🤷</div>
                    <p style={{ fontSize: '1rem' }}>Nenhuma partida realizada ainda</p>
                  </div>
                ) : (
                  <>
                    {/* Artilheiros */}
                    {artilheirosDoDia.length > 0 && (
                      <div style={{ marginBottom: '24px' }}>
                        <h3 style={{ 
                          fontSize: '1.1rem', 
                          fontWeight: 'bold', 
                          color: '#1f2937',
                          marginBottom: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <span>👑</span> Artilheiros
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {artilheirosDoDia.map((jogador, idx) => (
                            <div 
                              key={idx}
                              style={{
                                background: '#fef3c7',
                                border: '2px solid #f59e0b',
                                borderRadius: '10px',
                                padding: '12px 16px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}
                            >
                              <span style={{ fontSize: '0.95rem', fontWeight: '600', color: '#78350f' }}>
                                {jogador.nome}
                              </span>
                              <span style={{ 
                                fontSize: '1.1rem', 
                                fontWeight: 'bold', 
                                color: '#d97706',
                                background: '#fff',
                                padding: '4px 12px',
                                borderRadius: '20px'
                              }}>
                                {jogador.gols} ⚽
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Jogadores sem gols */}
                    {semGolsDoDia.length > 0 && (
                      <div>
                        <h3 style={{ 
                          fontSize: '1.1rem', 
                          fontWeight: 'bold', 
                          color: '#1f2937',
                          marginBottom: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <span>❌</span> Sem Gols
                        </h3>
                        <div style={{
                          background: '#f3f4f6',
                          border: '2px solid #d1d5db',
                          borderRadius: '10px',
                          padding: '16px'
                        }}>
                          <p style={{ 
                            fontSize: '0.9rem', 
                            color: '#6b7280',
                            lineHeight: '1.6',
                            margin: 0
                          }}>
                            {semGolsDoDia.join(', ')} não marcaram gols.
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: '20px', borderTop: '1px solid #e5e7eb' }}>
                <button
                  onClick={() => setShowModalInfoGols(false)}
                  style={{
                    width: '100%',
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
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Anúncio Interstitial (apenas FREE) */}
        {shouldShowInterstitial && (
          <AdInterstitial onClose={resetInterstitial} motivo="navegacao" />
        )}
        
        {/* Botão de Sincronização Manual (Modo Local First) */}
        {modoSincronizacao === 'local_first' && itensPendentesSync > 0 && statusOnline && (
          <button
            onClick={handleSyncQueue}
            disabled={sincronizando}
            style={{
              position: 'fixed',
              bottom: '80px',
              right: '20px',
              background: sincronizando 
                ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)'
                : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '50px',
              padding: '14px 24px',
              fontSize: '0.9rem',
              fontWeight: '700',
              cursor: sincronizando ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.3s ease',
              animation: sincronizando ? 'none' : 'pulse 2s infinite'
            }}
            onMouseEnter={(e) => {
              if (!sincronizando) {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.5)';
              }
            }}
            onMouseLeave={(e) => {
              if (!sincronizando) {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
              }
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>
              {sincronizando ? '⏳' : '🔄'}
            </span>
            <span>
              {sincronizando ? 'Sincronizando...' : `Sincronizar (${itensPendentesSync})`}
            </span>
          </button>
        )}
      </div>
      
      </>
      )}
    </>
  );
}
