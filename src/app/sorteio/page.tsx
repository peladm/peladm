'use client';

import React, { useState, useEffect, useRef } from 'react';
import Layout from '../../components/Layout';
import { jogadoresService, supabase, getClienteSupabase, getSupabaseParaUsuarioLogado } from '../../lib/supabase';
import { usePermissions } from '../../lib/usePermissions';
import { useAdInterstitial } from '../../lib/useAdInterstitial';
import AdInterstitial from '../../components/AdInterstitial';
import { addToSyncQueue } from '../../lib/syncService';
import { buscar_pelada_id, buscar_plano } from '../../lib/credenciais';

interface Jogador {
  id: string; // UUID
  nome: string;
  nivel: number;
}

interface Time {
  id: string; // UUID
  nome: string;
  jogadores: Jogador[];
  nivelMedio: number;
  cores: string;
}

interface Regras {
  jogadores_por_time: number;
  modelo_sorteio: 'equilibrado' | 'aleatorio';
}

export default function SorteioPage() {
  const { possuiPermissao } = usePermissions();
  const { shouldShowInterstitial, resetInterstitial } = useAdInterstitial();
  const [jogadoresDisponiveis, setJogadoresDisponiveis] = useState<Jogador[]>([]);
  const [jogadoresSelecionados, setJogadoresSelecionados] = useState<string[]>([]);
  const [timesFormados, setTimesFormados] = useState<Time[]>([]);
  const [regras, setRegras] = useState<Regras>({
    jogadores_por_time: 5,
    modelo_sorteio: 'equilibrado'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [mostrarResultado, setMostrarResultado] = useState(false);
  const [todosSelecionados, setTodosSelecionados] = useState(false);
  
  // Estados para controle do sticky behavior
  const [botaoSortearSticky, setBotaoSortearSticky] = useState(false);
  const [botaoConfirmarSticky, setBotaoConfirmarSticky] = useState(false);
  
  // Refs para os elementos que queremos observar
  const botaoSortearRef = useRef<HTMLElement>(null);
  const botaoConfirmarRef = useRef<HTMLElement>(null);

  // Derivar jogadoresPorTime das regras
  const jogadoresPorTime = regras.jogadores_por_time;

  useEffect(() => {
    carregarDados();
  }, []);

  // Hook para controlar o comportamento sticky dos botões
  useEffect(() => {
    const handleScroll = () => {
      // Controle do botão sortear (antes do resultado)
      if (botaoSortearRef.current && !mostrarResultado) {
        const rect = botaoSortearRef.current.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const footerHeight = 80; // Altura aproximada do footer mobile
        
        // Se o botão original está abaixo da área visível (considerando o footer)
        const isBelow = rect.top > (windowHeight - footerHeight);
        setBotaoSortearSticky(isBelow);
      }
      
      // Controle do botão confirmar (após o resultado) - apenas este tem sticky behavior
      if (botaoConfirmarRef.current && mostrarResultado) {
        const rect = botaoConfirmarRef.current.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const footerHeight = 80;
        
        const isBelow = rect.top > (windowHeight - footerHeight);
        setBotaoConfirmarSticky(isBelow);
      }
    };

    // Adicionar listener de scroll
    window.addEventListener('scroll', handleScroll);
    // Verificar posição inicial
    handleScroll();

    // Cleanup
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [mostrarResultado]); // Dependência importante para recriar o listener

  const carregarDados = async () => {
    await Promise.all([
      carregarJogadores(),
      carregarRegras()
    ]);
  };

  const carregarRegras = async () => {
    try {
      console.log('🔍 Carregando regras do cache local...');
      
      const peladaId = buscar_pelada_id();
      if (!peladaId) {
        console.log('⚠️ Usuário não logado, usando configurações padrão');
        return;
      }
      
      // SEMPRE buscar do localStorage (cache local)
      const regrasLocal = localStorage.getItem(`regras_${peladaId}`);
      
      if (regrasLocal) {
        const regrasData = JSON.parse(regrasLocal);
        const jogadoresPorTime = regrasData.jogadores_por_time || 5;
        console.log('🎯 Jogadores por time do cache:', jogadoresPorTime, '(tipo:', typeof jogadoresPorTime, ')');
        
        setRegras({
          jogadores_por_time: jogadoresPorTime,
          modelo_sorteio: regrasData.modelo_sorteio || 'equilibrado'
        });
        console.log('✅ Regras carregadas do cache local para sorteio');
      } else {
        console.log('⚠️ Nenhuma regra encontrada, usando padrões');
      }
      
    } catch (error) {
      console.warn('💥 Erro ao carregar regras:', error);
      // Manter configurações padrão em caso de erro
    }
  };

  const mostrarMensagem = (texto: string, duracao: number = 3000) => {
    setMessage(texto);
    
    // Limpar mensagem automaticamente após a duração especificada
    if (duracao > 0) {
      setTimeout(() => {
        setMessage('');
      }, duracao);
    }
  };

  const carregarJogadores = async () => {
    try {
      setIsLoading(true);
      
      // Verificar se usuário está logado
      const peladaId = buscar_pelada_id();
      const plano = buscar_plano();
      console.log('👤 Usuário logado:', peladaId ? 'SIM' : 'NÃO');
      console.log('💎 Plano:', plano);
      
      if (!peladaId) {
        console.log('❌ Usuário não está logado, redirecionando para login...');
        mostrarMensagem('❌ Você precisa fazer login primeiro', 2000);
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        return;
      }
      
      console.log('🔍 Carregando jogadores...');
      console.log('🆔 Pelada ID:', peladaId);
      
      let jogadoresFormatados = [];
      
      if (plano === 'free') {
        // PLANO FREE: Carregar do localStorage
        console.log('📦 FREE: Buscando jogadores do localStorage');
        const jogadoresLocal = localStorage.getItem(`jogadores_${peladaId}`);
        
        if (jogadoresLocal) {
          const jogadoresData = JSON.parse(jogadoresLocal);
          jogadoresFormatados = jogadoresData
            .filter((j: any) => j.status === 'ativo')
            .map((jogador: any) => ({
              id: jogador.id,
              nome: jogador.nome,
              nivel: jogador.nivel
            }));
          console.log(`✅ FREE: ${jogadoresFormatados.length} jogadores ativos carregados do localStorage`);
        } else {
          console.log('⚠️ FREE: Nenhum jogador encontrado no localStorage');
        }
      } else {
        // PLANO GOLD/PREMIUM: Carregar do Supabase
        console.log('☁️ GOLD/PREMIUM: Buscando jogadores do Supabase');
        const jogadoresData = await jogadoresService.buscarAtivos();
        
        jogadoresFormatados = jogadoresData.map((jogador: any) => ({
          id: jogador.id,
          nome: jogador.nome,
          nivel: jogador.nivel
        }));
        console.log(`✅ GOLD/PREMIUM: ${jogadoresFormatados.length} jogadores ativos carregados do Supabase`);
      }

      setJogadoresDisponiveis(jogadoresFormatados);
      console.log('🔍 Primeiros jogadores:', jogadoresFormatados.slice(0, 3).map((j: any) => `${j.nome} (${j.id})`));

      if (jogadoresFormatados.length === 0) {
        mostrarMensagem('⚠️ Nenhum jogador ativo cadastrado ainda para sorteio', 5000);
      } else {
        mostrarMensagem(`🎯 ${jogadoresFormatados.length} jogadores disponíveis para sorteio`, 2000);
      }

    } catch (error: any) {
      console.error('💥 Erro ao carregar jogadores:', error);
      if (error.message?.includes('não está logado')) {
        mostrarMensagem('❌ Sessão expirou. Faça login novamente.', 2000);
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        mostrarMensagem('❌ Erro ao carregar jogadores do banco de dados', 4000);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const toggleJogador = (jogadorId: string) => {
    if (jogadoresSelecionados.includes(jogadorId)) {
      setJogadoresSelecionados(jogadoresSelecionados.filter(id => id !== jogadorId));
    } else {
      setJogadoresSelecionados([...jogadoresSelecionados, jogadorId]);
    }
  };

  const toggleSelectAll = () => {
    if (todosSelecionados) {
      setJogadoresSelecionados([]);
      setTodosSelecionados(false);
    } else {
      setJogadoresSelecionados(jogadoresDisponiveis.map(j => j.id));
      setTodosSelecionados(true);
    }
  };

  useEffect(() => {
    setTodosSelecionados(jogadoresSelecionados.length === jogadoresDisponiveis.length && jogadoresDisponiveis.length > 0);
  }, [jogadoresSelecionados, jogadoresDisponiveis]);

  const embaralharArray = (array: any[]) => {
    const arrayCopy = [...array];
    for (let i = arrayCopy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arrayCopy[i], arrayCopy[j]] = [arrayCopy[j], arrayCopy[i]];
    }
    return arrayCopy;
  };

  const separarJogadoresPorNivel = (jogadores: Jogador[]) => {
    const jogadoresPorNivel: { [key: number]: Jogador[] } = {
      5: [],
      4: [],
      3: [],
      2: [],
      1: []
    };

    jogadores.forEach(jogador => {
      const nivel = jogador.nivel || 3;
      jogadoresPorNivel[nivel].push(jogador);
    });

    // Embaralhar cada nível
    Object.keys(jogadoresPorNivel).forEach(nivel => {
      jogadoresPorNivel[parseInt(nivel)] = embaralharArray(jogadoresPorNivel[parseInt(nivel)]);
    });

    return jogadoresPorNivel;
  };

  const sortearTimes = async () => {
    if (!jogadoresSelecionados.length) {
      mostrarMensagem('❌ Nenhum jogador selecionado!', 3000);
      return;
    }

    try {
      setIsLoading(true);
      mostrarMensagem('🎲 Sorteando times...', 1000);

      // Usar regras já carregadas do cache local
      const minJogadores = regras.jogadores_por_time * 2;
      if (jogadoresSelecionados.length < minJogadores) {
        mostrarMensagem(`❌ Selecione pelo menos ${minJogadores} jogadores para ${regras.jogadores_por_time}x${regras.jogadores_por_time}`, 4000);
        setIsLoading(false);
        return;
      }

      // Buscar dados completos dos jogadores selecionados
      const jogadoresSorteio = jogadoresDisponiveis.filter(j => 
        jogadoresSelecionados.includes(j.id)
      );

      // Calcular número de times
      const totalJogadores = jogadoresSorteio.length;
      let numeroTimes = Math.floor(totalJogadores / regras.jogadores_por_time);
      const jogadoresRestantes = totalJogadores % regras.jogadores_por_time;

      // Sempre criar time para jogadores restantes (se houver)
      if (jogadoresRestantes > 0) {
        numeroTimes += 1;
      }

      // Mínimo de 2 times para sorteio
      if (numeroTimes < 2) {
        numeroTimes = Math.min(2, Math.floor(totalJogadores / Math.ceil(regras.jogadores_por_time / 2)));
      }

      // Separar jogadores por nível
      const jogadoresPorNivel = separarJogadoresPorNivel(jogadoresSorteio);

      // Inicializar times vazios
      const times: Time[] = Array.from({ length: numeroTimes }, (_, i) => ({
        id: String(i + 1),
        nome: `Time ${i + 1}`,
        jogadores: [],
        nivelMedio: 0,
        cores: ['🔴', '🔵', '🟢', '🟡', '🟠', '🟣', '⚫', '⚪'][i] || '⭐'
      }));

      // Escolher algoritmo baseado nas regras
      if (regras.modelo_sorteio === 'aleatorio') {
        executarSorteioAleatorio(jogadoresSorteio, times, regras.jogadores_por_time);
      } else {
        executarSorteioEquilibrado(jogadoresSorteio, times, regras.jogadores_por_time);
      }

      // Embaralhar jogadores dentro de cada time
      times.forEach(time => {
        if (time.jogadores.length > 0) {
          time.jogadores = embaralharArray(time.jogadores);
        }
      });

      // A média já foi atribuída pelo padrão em aplicarPadroesEquilibrados
      // Não precisa recalcular, pois queremos mostrar a média teórica do padrão

      setTimesFormados(times);
      setMostrarResultado(true);
      
      mostrarMensagem('✅ Times sorteados com sucesso!', 2000);

      // Auto-scroll para o resultado após um pequeno delay
      setTimeout(() => {
        const resultadoElement = document.getElementById('resultado-sorteio');
        if (resultadoElement) {
          resultadoElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start'
          });
        }
      }, 300);

    } catch (error) {
      console.error('Erro no sorteio:', error);
      mostrarMensagem('❌ Erro ao sortear times', 4000);
    } finally {
      setIsLoading(false);
    }
  };

  // NOVO: Sorteio Aleatório (ignora níveis)
  const executarSorteioAleatorio = (jogadores: Jogador[], times: Time[], jogadoresPorTime: number) => {
    console.log('🎲 EXECUTANDO SORTEIO ALEATÓRIO');
    
    // Embaralhar todos os jogadores (ignora níveis completamente)
    const jogadoresEmbaralhados = embaralharArray([...jogadores]);
    
    // Distribuir sequencialmente nos times
    let jogadorIndex = 0;
    const timesCompletos = Math.min(times.length, Math.floor(jogadoresEmbaralhados.length / jogadoresPorTime));
    
    // Preencher times completos primeiro
    for (let t = 0; t < timesCompletos; t++) {
      const time = times[t];
      for (let j = 0; j < jogadoresPorTime && jogadorIndex < jogadoresEmbaralhados.length; j++) {
        time.jogadores.push(jogadoresEmbaralhados[jogadorIndex]);
        jogadorIndex++;
      }
      console.log(`${time.nome}: ${time.jogadores.map(j => j.nome).join(', ')}`);
    }
    
    // Preencher time incompleto (se houver)
    if (timesCompletos < times.length && jogadorIndex < jogadoresEmbaralhados.length) {
      const timeIncompleto = times[timesCompletos];
      while (jogadorIndex < jogadoresEmbaralhados.length) {
        timeIncompleto.jogadores.push(jogadoresEmbaralhados[jogadorIndex]);
        jogadorIndex++;
      }
      console.log(`${timeIncompleto.nome} (incompleto): ${timeIncompleto.jogadores.map(j => j.nome).join(', ')}`);
    }
  };

  // Sorteio Equilibrado - Greedy com Limite de Extremos
  const executarSorteioEquilibrado = (jogadores: Jogador[], times: Time[], jogadoresPorTime: number) => {
    console.log('⚖️ EXECUTANDO SORTEIO EQUILIBRADO - GREEDY COM LIMITE DE EXTREMOS');
    
    // 1. Separar jogadores por nível (já embaralha cada grupo)
    const jogadoresPorNivel = separarJogadoresPorNivel(jogadores);
    
    // 2. Calcular limites de cada time
    const timesCompletos = Math.floor(jogadores.length / jogadoresPorTime);
    const jogadoresNoTimeIncompleto = jogadores.length % jogadoresPorTime;
    const temTimeIncompleto = jogadoresNoTimeIncompleto > 0;
    
    const limitesPorTime = times.map((_, i) => {
      if (temTimeIncompleto && i === times.length - 1) {
        return jogadoresNoTimeIncompleto;
      }
      return jogadoresPorTime;
    });
    
    console.log(`📋 Times: ${times.length} (${timesCompletos} completos + ${temTimeIncompleto ? '1 incompleto' : '0'})`);
    console.log(`🎯 Limites: ${limitesPorTime.join(', ')}`);
    
    // 3. Inicializar contadores
    const somasTimes = times.map(() => 0);
    const jogadores5PorTime = times.map(() => 0);
    const jogadores2PorTime = times.map(() => 0);
    
    // === FASE 1: DISTRIBUIR EXTREMOS (limite 1 por time) ===
    console.log('\n🔴 FASE 1: Distribuindo extremos (5⭐ e 2⭐)');
    
    // Distribuir 5⭐ (máximo 1 por time)
    const jogadores5 = jogadoresPorNivel[5] || [];
    const jogadores5Reserva = [];
    for (const jogador of jogadores5) {
      let timeEscolhido = -1;
      let menorSoma = Infinity;
      
      for (let t = 0; t < times.length; t++) {
        const temEspaco = times[t].jogadores.length < limitesPorTime[t];
        const naoTemJogador5 = jogadores5PorTime[t] === 0;
        
        if (temEspaco && naoTemJogador5 && somasTimes[t] < menorSoma) {
          menorSoma = somasTimes[t];
          timeEscolhido = t;
        }
      }
      
      if (timeEscolhido >= 0) {
        times[timeEscolhido].jogadores.push(jogador);
        somasTimes[timeEscolhido] += jogador.nivel;
        jogadores5PorTime[timeEscolhido]++;
        console.log(`  → ${jogador.nome} (5⭐) → Time ${timeEscolhido + 1}`);
      } else {
        jogadores5Reserva.push(jogador);
        console.log(`  → ${jogador.nome} (5⭐) → RESERVA (todos os times já têm 1)`);
      }
    }
    
    // Distribuir 2⭐ (máximo 1 por time)
    const jogadores2 = jogadoresPorNivel[2] || [];
    const jogadores2Reserva = [];
    for (const jogador of jogadores2) {
      let timeEscolhido = -1;
      let menorSoma = Infinity;
      
      for (let t = 0; t < times.length; t++) {
        const temEspaco = times[t].jogadores.length < limitesPorTime[t];
        const naoTemJogador2 = jogadores2PorTime[t] === 0;
        
        if (temEspaco && naoTemJogador2 && somasTimes[t] < menorSoma) {
          menorSoma = somasTimes[t];
          timeEscolhido = t;
        }
      }
      
      if (timeEscolhido >= 0) {
        times[timeEscolhido].jogadores.push(jogador);
        somasTimes[timeEscolhido] += jogador.nivel;
        jogadores2PorTime[timeEscolhido]++;
        console.log(`  → ${jogador.nome} (2⭐) → Time ${timeEscolhido + 1}`);
      } else {
        jogadores2Reserva.push(jogador);
        console.log(`  → ${jogador.nome} (2⭐) → RESERVA (todos os times já têm 1)`);
      }
    }
    
    // === FASE 2: DISTRIBUIR INTERMEDIÁRIOS (4⭐, 3⭐, 1⭐) ===
    console.log('\n🟡 FASE 2: Distribuindo intermediários (4⭐, 3⭐, 1⭐)');
    
    [4, 3, 1].forEach(nivel => {
      const jogadoresNivel = jogadoresPorNivel[nivel] || [];
      for (const jogador of jogadoresNivel) {
        let timeEscolhido = -1;
        let menorSoma = Infinity;
        
        for (let t = 0; t < times.length; t++) {
          const temEspaco = times[t].jogadores.length < limitesPorTime[t];
          
          if (temEspaco && somasTimes[t] < menorSoma) {
            menorSoma = somasTimes[t];
            timeEscolhido = t;
          }
        }
        
        if (timeEscolhido >= 0) {
          times[timeEscolhido].jogadores.push(jogador);
          somasTimes[timeEscolhido] += jogador.nivel;
          console.log(`  → ${jogador.nome} (${nivel}⭐) → Time ${timeEscolhido + 1} (soma: ${somasTimes[timeEscolhido]})`);
        }
      }
    });
    
    // === FASE 3: DISTRIBUIR EXTREMOS RESERVA (se houver espaço) ===
    if (jogadores5Reserva.length > 0 || jogadores2Reserva.length > 0) {
      console.log('\n🔵 FASE 3: Distribuindo extremos da reserva');
      
      const todosReserva = [...jogadores5Reserva, ...jogadores2Reserva];
      for (const jogador of todosReserva) {
        let timeEscolhido = -1;
        let menorSoma = Infinity;
        
        for (let t = 0; t < times.length; t++) {
          const temEspaco = times[t].jogadores.length < limitesPorTime[t];
          
          if (temEspaco && somasTimes[t] < menorSoma) {
            menorSoma = somasTimes[t];
            timeEscolhido = t;
          }
        }
        
        if (timeEscolhido >= 0) {
          times[timeEscolhido].jogadores.push(jogador);
          somasTimes[timeEscolhido] += jogador.nivel;
          console.log(`  → ${jogador.nome} (${jogador.nivel}⭐) → Time ${timeEscolhido + 1} (RESERVA)`);
        }
      }
    }
    
    // 4. Calcular médias finais
    console.log('\n📊 RESULTADO FINAL:');
    times.forEach((time, i) => {
      if (time.jogadores.length > 0) {
        time.nivelMedio = somasTimes[i] / time.jogadores.length;
        const status = time.jogadores.length < jogadoresPorTime ? ' (INCOMPLETO)' : '';
        console.log(`${time.nome}: ${time.jogadores.length} jogadores | Soma: ${somasTimes[i]} | Média: ${time.nivelMedio.toFixed(2)}${status}`);
        console.log(`  5⭐: ${jogadores5PorTime[i]} | 2⭐: ${jogadores2PorTime[i]}`);
        console.log(`  Jogadores: ${time.jogadores.map(j => `${j.nome}(${j.nivel}⭐)`).join(', ')}`);
      }
    });
    
    console.log('\n✅ Distribuição com limite de extremos concluída');
  };


  const confirmarTimes = async () => {
    // VALIDAÇÃO OBRIGATÓRIA: Verificar se as regras foram configuradas
    const peladaId = buscar_pelada_id();
    if (!peladaId) {
      mostrarMensagem('❌ Você precisa fazer login primeiro', 3000);
      return;
    }

    const regrasLocal = localStorage.getItem(`regras_${peladaId}`);
    if (!regrasLocal) {
      mostrarMensagem('⚠️ Configure suas regras primeiro antes de confirmar os times!', 5000);
      setTimeout(() => {
        window.location.href = '/regras';
      }, 2000);
      return;
    }

    await iniciarPelada();
  };

  // Função para compartilhar times no WhatsApp
  const compartilharTimesWhatsApp = () => {
    // Gerar texto formatado dos times
    let texto = '*TIMES SORTEADOS*\n\n';
    
    timesFormados.forEach((time, index) => {
      texto += `*Time ${index + 1}*\n`;
      
      time.jogadores.forEach((jogador) => {
        texto += `- ${jogador.nome}\n`;
      });
      
      texto += '\n';
    });
    
    texto += 'Bora jogar!';
    
    // Codificar para URL
    const textoEncoded = encodeURIComponent(texto);
    
    // Abrir WhatsApp com o texto
    const urlWhatsApp = `https://wa.me/?text=${textoEncoded}`;
    window.open(urlWhatsApp, '_blank');
  };

  const iniciarPelada = async () => {
    try {
      setMessage('🚀 Times confirmados! Iniciando pelada...');
      
      const peladaId = buscar_pelada_id();
      const plano = buscar_plano();
      
      if (!peladaId) throw new Error('Usuário não logado');
      
      // Verificar modo de sincronização
      const regrasStr = localStorage.getItem(`regras_${peladaId}`);
      const modoOffline = regrasStr ? JSON.parse(regrasStr).modo_sincronizacao === 'local_first' : false;
      
      console.log('🔄 Iniciando pelada para:', peladaId, '| Plano:', plano, '| Modo offline:', modoOffline);
      
      // PLANO FREE OU MODO OFFLINE: Salvar tudo no localStorage
      if (plano === 'Free' || modoOffline) {
        console.log('📦 Salvando no localStorage (FREE ou modo offline)');
        
        // Buscar regras do localStorage
        const regrasLocal = localStorage.getItem(`regras_${peladaId}`);
        const jogadoresPorTime = regrasLocal ? JSON.parse(regrasLocal).jogadores_por_time : 5;
        
        // Função para gerar UUID válido
        const gerarUUID = () => {
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        };
        
        // Criar sessão no localStorage (MESMA ESTRUTURA do modo online)
        const sessaoId = gerarUUID();
        const sessao = {
          id: sessaoId,
          pelada_id: peladaId,
          status: 'ativa',
          data: new Date().toISOString().split('T')[0],
          total_jogadores: jogadoresSelecionados.length,
          observacoes: `Sorteio realizado com ${timesFormados.length} times`,
          vitorias_consecutivas: 0
        };
        
        console.log('💾 Salvando sessão no localStorage:', sessao);
        localStorage.setItem('sessao_ativa', JSON.stringify(sessao));
        console.log('✅ Sessão salva com sucesso');
        
        // Verificar se foi salvo
        const verificar = localStorage.getItem('sessao_ativa');
        console.log('🔍 Verificação imediata:', verificar);
        
        // ============================================
        // PLANO FREE: NÃO CRIA TABELAS DE ESTATÍSTICAS
        // ============================================
        console.log('🆓 Plano FREE: Modo prancheta único (sem estatísticas)');
        console.log('⚠️ Tabelas jogos/gols NÃO serão criadas');
        
        // Buscar TODOS os jogadores cadastrados do localStorage (já existentes)
        const jogadoresLocalStorage = localStorage.getItem(`jogadores_${peladaId}`);
        const todosJogadores = jogadoresLocalStorage ? JSON.parse(jogadoresLocalStorage) : [];
        console.log(`📊 FREE: Usando ${todosJogadores.length} jogadores já cadastrados localmente`);
        console.log(`📊 Total de jogadores cadastrados: ${todosJogadores.length}`);
        console.log('🔍 Primeiro jogador:', todosJogadores[0]);
        
        // MONTAR FILA (CÓDIGO IDÊNTICO AO GOLD/PREMIUM)
        const filaLocal: any[] = [];
        let posicaoAtual = 1;
        const timestamp = Date.now();
        
        console.log('🔍 Times formados:', timesFormados.length);
        timesFormados.forEach((time, idx) => {
          console.log(`Time ${idx + 1}:`, time.jogadores.map((j: any) => `${j.nome} (${j.id})`));
        });
        
        // 1. JOGADORES DOS TIMES SORTEADOS - status 'fila'
        const idsJogadoresNaFila = new Set();
        
        timesFormados.forEach((time, timeIndex) => {
          time.jogadores.forEach((jogadorTime) => {
            const jogadorDB = todosJogadores.find((j: any) => j.nome === jogadorTime.nome);
            if (jogadorDB && !idsJogadoresNaFila.has(jogadorDB.nome)) {
              idsJogadoresNaFila.add(jogadorDB.nome);
              filaLocal.push({
                id: `fila_${Date.now()}_${posicaoAtual}`,
                pelada_id: peladaId,
                sessao_id: sessao.id,
                nome: jogadorDB.nome,
                status: 'fila',
                posicao_fila: posicaoAtual++,
                vitorias_consecutivas_time: 0
              });
              console.log(`✅ Adicionado à fila: ${jogadorDB.nome}`);
            } else if (!jogadorDB) {
              console.error(`❌ ERRO: Jogador "${jogadorTime.nome}" não encontrado no localStorage!`);
              console.log('📋 Jogadores disponíveis:', todosJogadores.map((j: any) => j.nome));
            }
          });
        });
        
        // 2. JOGADORES NÃO SELECIONADOS - status 'reserva'
        const jogadoresReserva = todosJogadores.filter((j: any) => !idsJogadoresNaFila.has(j.nome));
        
        jogadoresReserva.forEach((jogadorDB: any) => {
          filaLocal.push({
            id: `fila_reserva_${Date.now()}_${jogadorDB.nome}`,
            pelada_id: peladaId,
            sessao_id: sessao.id,
            nome: jogadorDB.nome,
            status: 'reserva',
            posicao_fila: 9999,
            vitorias_consecutivas_time: 0
          });
        });
        
        localStorage.setItem('fila_ativa', JSON.stringify(filaLocal));
        
        const jogadoresJogando = jogadoresPorTime * 2;
        console.log(`✅ ${filaLocal.length} jogadores salvos no localStorage`);
        console.log(`📝 Inserindo ${filaLocal.length} jogadores na fila:`);
        console.log(`  - ${Math.min(jogadoresJogando, filaLocal.filter(f => f.status === 'fila').length)} jogando (primeiras posições)`);
        console.log(`  - ${Math.max(0, filaLocal.filter(f => f.status === 'fila').length - jogadoresJogando)} na fila de espera`);
        console.log(`  - ${filaLocal.filter(f => f.status === 'reserva').length} reservas`);
        
        // Modo offline: sessão e fila são criadas localmente e sincronizadas ao encerrar a pelada
        if (modoOffline) {
          console.log('⚡ Modo offline: sessão e fila serão sincronizadas ao encerrar a pelada');
        }
        
        setMessage('✅ Pelada iniciada com sucesso!');
        setTimeout(() => {
          window.location.href = '/page-fila';
        }, 1500);
        return;
      }
      
      // PLANO GOLD/PREMIUM: Salvar no localStorage (tempo real)
      console.log('☁️ PLANO GOLD/PREMIUM: Salvando no localStorage');
      
      // Buscar regras do localStorage
      const regrasLocal = localStorage.getItem(`regras_${peladaId}`);
      const regrasConfig = regrasLocal ? JSON.parse(regrasLocal) : {};
      const jogadoresPorTime = regrasConfig.jogadores_por_time || 5;
      const tipoFila = regrasConfig.tipo_fila || 'modo_prancheta';
      
      console.log('⚽ Jogadores por time:', jogadoresPorTime);
      console.log('🎮 Modo:', tipoFila);
      
      // 1. VERIFICAR SE JÁ EXISTE SESSÃO LOCAL ATIVA HOJE
      let sessao;
      const sessaoAtualStr = localStorage.getItem('sessao_ativa');
      
      if (sessaoAtualStr) {
        const sessaoAtual = JSON.parse(sessaoAtualStr);
        const hoje = new Date().toISOString().split('T')[0];
        
        // Verificar se é do mesmo dia e mesma pelada
        if (sessaoAtual.data === hoje && sessaoAtual.pelada_id === peladaId) {
          console.log('✅ Usando sessão local existente:', sessaoAtual.id);
          sessao = sessaoAtual;
        }
      }
      
      // Se não encontrou sessão válida, criar nova
      if (!sessao) {
        // Função para gerar UUID válido
        const gerarUUID = () => {
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        };
        
        const sessaoId = gerarUUID();
        sessao = {
          id: sessaoId,
          pelada_id: peladaId,
          status: 'ativa',
          data: new Date().toISOString().split('T')[0],
          total_jogadores: jogadoresSelecionados.length,
          observacoes: `Sorteio realizado com ${timesFormados.length} times`,
          vitorias_consecutivas: 0
        };
        
        console.log('💾 Criando nova sessão no localStorage:', sessao);
        localStorage.setItem('sessao_ativa', JSON.stringify(sessao));
        
        // ============================================
        // CRIAR TABELAS DE ESTATÍSTICAS (baseado no MODO, não no plano)
        // ============================================
        const isModoPartida = tipoFila === 'modo_partida';
        
        if (isModoPartida) {
          // MODO PARTIDA: Cria tabelas de estatísticas (independente do plano)
          localStorage.setItem(`jogos_${sessaoId}`, JSON.stringify([]));
          localStorage.setItem(`gols_${sessaoId}`, JSON.stringify([]));
          console.log('✅ MODO PARTIDA: Tabelas jogos e gols criadas');
        } else {
          // MODO PRANCHETA: NÃO cria tabelas de estatísticas
          console.log('📋 MODO PRANCHETA: Tabelas jogos/gols NÃO criadas');
        }
        
        // Baixar jogadores do Supabase (Gold/Premium)
        // Motivo: Permitir adicionar novos jogadores no modo edição da fila
        console.log('☁️ Baixando jogadores do Supabase (para modo edição)...');
        const clienteDb = await getClienteSupabase(peladaId);
        const { data: jogadoresSupabase, error: jogadoresError } = await clienteDb
          .from('jogadores')
          .select('*')
          .eq('pelada_id', peladaId)
          .eq('status', 'ativo');
        
        if (jogadoresError || !jogadoresSupabase || jogadoresSupabase.length === 0) {
          console.error('❌ Erro ao baixar jogadores:', jogadoresError);
          throw new Error('Falha ao carregar jogadores do Supabase');
        }
        
        // Salvar jogadores do Supabase no localStorage
        localStorage.setItem(`jogadores_${peladaId}`, JSON.stringify(jogadoresSupabase || []));
        console.log(`✅ ${jogadoresSupabase?.length || 0} jogadores baixados do Supabase`);
      }
      
      // 2. BUSCAR TODOS OS JOGADORES CADASTRADOS DO LOCALSTORAGE
      const jogadoresLocalStorage = localStorage.getItem(`jogadores_${peladaId}`);
      const todosJogadores = jogadoresLocalStorage ? JSON.parse(jogadoresLocalStorage) : [];
      console.log(`📊 Total de jogadores cadastrados: ${todosJogadores.length}`);
      console.log('🔍 Primeiro jogador:', todosJogadores[0]);
      
      // 3. ORGANIZAR JOGADORES POR TIMES FORMADOS
      const jogadoresTime1 = timesFormados[0]?.jogadores || [];
      const jogadoresTime2 = timesFormados[1]?.jogadores || [];
      const jogadoresTime3 = timesFormados[2]?.jogadores || [];
      const todosTimesFormados = [...jogadoresTime1, ...jogadoresTime2, ...jogadoresTime3];
      
      console.log(`⚽ Times formados: ${timesFormados.length} times`);
      console.log(`👥 Total nos times: ${todosTimesFormados.length} jogadores`);
      
      // 4. CRIAR FILA LOCAL (Gold/Premium também cria local - igual ao Free)
      console.log('📦 Criando fila no localStorage...');
      
      interface FilaInsert {
        id?: string;
        pelada_id: string;
        sessao_id: string;
        nome: string;
        status: string;
        posicao_fila: number;
        vitorias_consecutivas_time: number;
      }
      
      const filaLocal: FilaInsert[] = [];
      let posicaoAtual = 1;
      
      // 4.1. JOGADORES DOS TIMES SORTEADOS - todos com status 'fila' em ordem sequencial
      const nomesJogadoresNaFila = new Set(); // Evitar duplicatas
      
      timesFormados.forEach((time, timeIndex) => {
        time.jogadores.forEach((jogadorTime) => {
          const jogadorDB = todosJogadores.find((j: any) => j.nome === jogadorTime.nome);
          if (jogadorDB && !nomesJogadoresNaFila.has(jogadorDB.nome)) {
            nomesJogadoresNaFila.add(jogadorDB.nome);
            filaLocal.push({
              id: `fila_${Date.now()}_${posicaoAtual}`,
              pelada_id: peladaId,
              sessao_id: sessao.id,
              nome: jogadorDB.nome,
              status: 'fila',
              posicao_fila: posicaoAtual++,
              vitorias_consecutivas_time: 0
            });
          }
        });
      });
      
      // 4.2. JOGADORES NÃO SELECIONADOS PARA O SORTEIO - status "reserva"
      const jogadoresReserva = todosJogadores.filter((j: any) => !nomesJogadoresNaFila.has(j.nome));
      
      jogadoresReserva.forEach((jogadorDB: any) => {
        filaLocal.push({
          id: `fila_reserva_${Date.now()}_${jogadorDB.nome}`,
          pelada_id: peladaId,
          sessao_id: sessao.id,
          nome: jogadorDB.nome,
          status: 'reserva',
          posicao_fila: 9999,
          vitorias_consecutivas_time: 0
        });
      });
      
      const jogadoresJogando = jogadoresPorTime * 2;
      console.log(`📝 Criando ${filaLocal.length} jogadores na fila local:`);
      console.log(`  - ${Math.min(jogadoresJogando, filaLocal.filter(f => f.status === 'fila').length)} jogando (primeiras posições)`);
      console.log(`  - ${Math.max(0, filaLocal.filter(f => f.status === 'fila').length - jogadoresJogando)} na fila de espera`);
      console.log(`  - ${filaLocal.filter(f => f.status === 'reserva').length} reservas`);
      
      // Salvar fila no localStorage (TODOS OS PLANOS)
      localStorage.setItem('fila_ativa', JSON.stringify(filaLocal));
      console.log(`✅ Fila salva no localStorage com ${filaLocal.length} jogadores`);
      
      // 5. ESTATÍSTICAS NO LOCALSTORAGE (só para stats)
      const statsExistentes = localStorage.getItem('peladaStats');
      const stats = statsExistentes ? JSON.parse(statsExistentes) : {};
      
      localStorage.setItem('peladaStats', JSON.stringify({
        ...stats,
        ultimaSessao: sessao.id,
        ultimaData: new Date().toISOString()
      }));
      
      setMessage('✅ Pelada iniciada com sucesso!');
      
      // Redirecionar para a fila (única página de fila)
      console.log('🎯 Redirecionando para: /page-fila');
      
      setTimeout(() => {
        window.location.href = '/page-fila';
      }, 1500);
      
    } catch (error) {
      console.error('💥 Erro ao iniciar pelada:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setMessage('❌ Erro ao iniciar pelada: ' + errorMessage);
    }
  };

  const resortear = () => {
    setMostrarResultado(false);
    setTimesFormados([]);
    
    // Dar um pequeno delay antes de sortear novamente
    setTimeout(() => {
      sortearTimes();
    }, 100);
  };

  if (isLoading) {
    return (
      <Layout title="Sorteio">
        <div className="text-center py-20">
          <span className="text-6xl mb-4 block">⏳</span>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Sorteio">
      {/* Toast Message */}
      {message && (
        <div
          className={`fixed top-5 left-1/2 transform -translate-x-1/2 px-5 py-3 rounded-lg text-white text-sm z-50 max-w-sm text-center shadow-lg ${
            message.includes('✅') ? 'bg-green-600' : 
            message.includes('❌') ? 'bg-red-600' : 
            'bg-blue-600'
          }`}
        >
          {message}
        </div>
      )}

      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <section className="bg-gray-50 border-2 border-gray-100 rounded-3xl p-3 text-center">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">🎲 Sorteio Inicial 🎲</h2>
          <div className="flex justify-center">
            <button
              onClick={toggleSelectAll}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                todosSelecionados
                  ? 'bg-green-600 text-white border-2 border-green-600'
                  : 'bg-gray-50 text-gray-600 border-2 border-gray-200 hover:border-green-600 hover:bg-green-50 hover:text-green-600'
              }`}
            >
              <span className="text-base">{todosSelecionados ? '❌' : '✅'}</span>
              <span>{todosSelecionados ? 'Desselecionar Todos' : 'Selecionar Todos'}</span>
            </button>
          </div>
        </section>

        {/* Lista de Jogadores */}
        <section className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">

          {jogadoresDisponiveis.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <span className="text-4xl mb-3 block">😴</span>
              <p>Nenhum jogador cadastrado ainda</p>
              <p className="text-sm mt-2">
                <span className="text-green-600">
                  Cadastre jogadores primeiro
                </span>
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {jogadoresDisponiveis.map(jogador => (
                <button
                  key={jogador.id}
                  onClick={() => toggleJogador(jogador.id)}
                  className={`p-3 rounded-xl text-sm font-medium transition-all duration-200 min-h-[40px] flex items-center justify-center ${
                    jogadoresSelecionados.includes(jogador.id)
                      ? 'bg-green-600 text-white border-2 border-green-600'
                      : 'bg-gray-50 text-gray-800 border-2 border-gray-200 hover:border-green-600 hover:bg-green-50 hover:text-green-600 hover:-translate-y-0.5'
                  }`}
                >
                  <span className="text-center leading-tight break-words">
                    {jogador.nome}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Botão Re-sortear estático após lista de jogadores (só quando há resultado) */}
        {mostrarResultado && (
          <section>
            <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
              <button
                id="botao-resortear-estatico"
                onClick={resortear}
                className="w-full flex items-center justify-center gap-3 py-4 px-5 rounded-xl text-base font-semibold bg-gray-50 text-gray-600 border-2 border-gray-200 hover:border-blue-600 hover:bg-blue-50 hover:text-blue-600 transition-all duration-200"
              >
                <span className="text-xl">🔄</span>
                <span>Re-sortear</span>
              </button>
            </div>
          </section>
        )}

        {/* Botão Sortear estático após lista de jogadores (só antes do sorteio) */}
        {!mostrarResultado && (
          <section ref={botaoSortearRef}>
            <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
              <button
                id="botao-sortear-estatico"
                onClick={sortearTimes}
                disabled={jogadoresSelecionados.length < jogadoresPorTime * 2 || isLoading}
                className={`w-full flex items-center justify-center gap-3 py-4 px-5 rounded-xl text-base font-semibold transition-all duration-200 ${
                  jogadoresSelecionados.length >= jogadoresPorTime * 2 && !isLoading
                    ? 'bg-blue-600 text-white hover:bg-blue-700 hover:-translate-y-0.5 hover:shadow-lg'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <span className="text-xl">🎲</span>
                <span>Sortear Times: {jogadoresSelecionados.length}</span>
              </button>
            </div>
          </section>
        )}

        {/* Resultado do Sorteio */}
        {mostrarResultado && (
          <>
            <section id="resultado-sorteio" className="bg-white rounded-3xl p-5 mb-6 shadow-sm border-2 border-green-600">
              <h2 className="text-lg font-semibold text-green-600 mb-5 text-center">⚽ Times Formados</h2>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                {timesFormados.filter(time => time.jogadores.length > 0).map(time => (
                  <div key={time.id} className="bg-white border-2 border-gray-200 rounded-2xl p-4 hover:-translate-y-1 hover:shadow-lg hover:border-green-600 transition-all duration-200">
                    <div className="text-center mb-3 pb-2 border-b-2 border-gray-100">
                      <div className="text-base font-bold text-green-600 mb-1">
                        {time.cores} {time.nome}
                      </div>
                      <div className="text-xs text-gray-600 font-medium">
                        {possuiPermissao('cadastrarNivel') && (
                          <>
                            ⭐ {time.nivelMedio.toFixed(1).replace('.', ',')}
                            <small className="ml-1">•</small>
                          </>
                        )}
                        <small className="ml-1">({time.jogadores.length} jogadores)</small>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      {time.jogadores.map((jogador, index) => (
                        <div
                          key={index}
                          className="p-2 bg-gray-50 rounded-lg border border-gray-200 text-center hover:bg-green-50 hover:border-green-600 transition-all duration-150"
                        >
                          <span className="text-sm font-medium text-gray-800 block truncate">
                            {jogador.nome}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
            
            {/* Botão Confirmar Times estático após os times */}
            <section ref={botaoConfirmarRef} className="mb-6">
              <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
                <div style={{ display: 'flex', gap: '8px' }}>
                  {/* Botão Confirmar Times - 75% */}
                  <button
                    id="botao-confirmar-estatico"
                    onClick={confirmarTimes}
                    style={{ flex: '0 0 75%' }}
                    className="flex items-center justify-center gap-3 py-4 px-5 rounded-xl text-base font-semibold bg-green-600 text-white hover:bg-green-700 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200"
                  >
                    <span className="text-xl">✅</span>
                    <span>Confirmar Times</span>
                  </button>
                  
                  {/* Botão WhatsApp - 25% */}
                  <div style={{ flex: '0 0 calc(25% - 8px)' }} className="relative">
                    {!possuiPermissao('compartilharWhatsApp') && (
                      <div className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1 z-10">
                        <span>⭐</span>
                        <span>Gold</span>
                      </div>
                    )}
                    <button
                      onClick={() => {
                        if (possuiPermissao('compartilharWhatsApp')) {
                          compartilharTimesWhatsApp();
                        } else {
                          alert('🔒 Recurso exclusivo do plano Gold e Premium!\n\nFaça upgrade para compartilhar times no WhatsApp.');
                        }
                      }}
                      disabled={!possuiPermissao('compartilharWhatsApp')}
                      className={`w-full flex items-center justify-center py-4 px-3 rounded-xl text-base font-semibold transition-all duration-200 ${
                        possuiPermissao('compartilharWhatsApp')
                          ? 'bg-green-500 text-white hover:bg-green-600 hover:-translate-y-0.5 hover:shadow-lg'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'
                      }`}
                      title={possuiPermissao('compartilharWhatsApp') ? 'Compartilhar no WhatsApp' : 'Recurso Gold'}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
        
      {/* Botões Sticky - Aparecem quando os originais saem da tela */}
      
      {/* Botão Sortear Sticky (antes do resultado) */}
      {!mostrarResultado && botaoSortearSticky && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-sm px-4">
          <div className="bg-white rounded-2xl p-4 shadow-xl border border-gray-200">
            <button
              onClick={sortearTimes}
              disabled={jogadoresSelecionados.length < jogadoresPorTime * 2 || isLoading}
              className={`w-full flex items-center justify-center gap-3 py-4 px-5 rounded-xl text-base font-semibold transition-all duration-200 ${
                jogadoresSelecionados.length >= jogadoresPorTime * 2 && !isLoading
                  ? 'bg-blue-600 text-white hover:bg-blue-700 hover:-translate-y-0.5 hover:shadow-lg'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <span className="text-xl">🎲</span>
              <span>Sortear Times: {jogadoresSelecionados.length}</span>
            </button>
          </div>
        </div>
      )}

      {/* Botão Re-sortear Sticky (após o resultado) - REMOVIDO */}

      {/* Botão Confirmar Sticky (após o resultado) - ÚNICO que acompanha após sorteio */}
      {mostrarResultado && botaoConfirmarSticky && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-sm px-4">
          <div className="bg-white rounded-2xl p-4 shadow-xl border border-gray-200">
            <div style={{ display: 'flex', gap: '8px' }}>
              {/* Botão Confirmar Times - 75% */}
              <button
                onClick={confirmarTimes}
                style={{ flex: '0 0 75%' }}
                className="flex items-center justify-center gap-3 py-4 px-5 rounded-xl text-base font-semibold bg-green-600 text-white hover:bg-green-700 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200"
              >
                <span className="text-xl">✅</span>
                <span>Confirmar Times</span>
              </button>
              
              {/* Botão WhatsApp - 25% */}
              <div style={{ flex: '0 0 calc(25% - 8px)' }} className="relative">
                {!possuiPermissao('compartilharWhatsApp') && (
                  <div className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1 z-10">
                    <span>⭐</span>
                    <span>Gold</span>
                  </div>
                )}
                <button
                  onClick={() => {
                    if (possuiPermissao('compartilharWhatsApp')) {
                      compartilharTimesWhatsApp();
                    } else {
                      alert('🔒 Recurso exclusivo do plano Gold e Premium!\n\nFaça upgrade para compartilhar times no WhatsApp.');
                    }
                  }}
                  disabled={!possuiPermissao('compartilharWhatsApp')}
                  className={`w-full flex items-center justify-center py-4 px-3 rounded-xl text-base font-semibold transition-all duration-200 ${
                    possuiPermissao('compartilharWhatsApp')
                      ? 'bg-green-500 text-white hover:bg-green-600 hover:-translate-y-0.5 hover:shadow-lg'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'
                  }`}
                  title={possuiPermissao('compartilharWhatsApp') ? 'Compartilhar no WhatsApp' : 'Recurso Gold'}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Anúncio Intersticial (só aparece para plano FREE) */}
      {shouldShowInterstitial && <AdInterstitial onClose={resetInterstitial} />}

      </div>
    </Layout>
  );
}