'use client';

import React, { useState, useEffect, useRef } from 'react';
import Layout from '../../components/Layout';
import { jogadoresService, supabase } from '../../lib/supabase';
import { usePermissions } from '../../lib/usePermissions';
import { useAdInterstitial } from '../../lib/useAdInterstitial';
import AdInterstitial from '../../components/AdInterstitial';

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
  const { shouldShowInterstitial, incrementActionCounter, resetInterstitial } = useAdInterstitial();
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
      console.log('🔍 Carregando regras do Supabase...');
      
      // Buscar ID do cliente logado
      const userData = localStorage.getItem('user');
      if (!userData) {
        console.log('⚠️ Usuário não logado, usando configurações padrão');
        return;
      }
      
      const user = JSON.parse(userData);
      const peladaId = user.id;
      
      // Buscar regras no Supabase
      const { data: regrasSupabase, error } = await supabase
        .from('regras')
        .select('*')
        .eq('pelada_id', peladaId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          console.log('⚠️ Nenhuma configuração encontrada, usando padrões');
        } else {
          console.error('💥 Erro ao buscar regras:', error);
        }
        return;
      }
      
      if (regrasSupabase) {
        setRegras({
          jogadores_por_time: regrasSupabase.jogadores_por_time || 5,
          modelo_sorteio: regrasSupabase.modelo_sorteio || 'equilibrado'
        });
        console.log('✅ Regras carregadas do Supabase para sorteio');
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
      console.log('🔍 Carregando jogadores ativos do Supabase...');
      
      // Verificar se usuário está logado
      const user = localStorage.getItem('user');
      console.log('👤 Usuário logado:', user ? 'SIM' : 'NÃO');
      
      if (!user) {
        console.log('❌ Usuário não está logado, redirecionando para login...');
        mostrarMensagem('❌ Você precisa fazer login primeiro', 2000);
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        return;
      }
      
      const userData = JSON.parse(user);
      console.log('🆔 ID do usuário:', userData.id);

      const jogadoresData = await jogadoresService.buscarAtivos();
      
      // MANTER UUID ORIGINAL - não converter para numérico
      const jogadoresFormatados = jogadoresData.map((jogador) => ({
        id: jogador.id, // UUID original do Supabase
        nome: jogador.nome,
        nivel: jogador.nivel
      }));

      setJogadoresDisponiveis(jogadoresFormatados);
      console.log(`✅ ${jogadoresFormatados.length} jogadores ativos carregados para sorteio`);
      console.log('🔍 Primeiros jogadores:', jogadoresFormatados.slice(0, 3).map(j => `${j.nome} (${j.id})`));

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

    const minJogadores = regras.jogadores_por_time * 2;
    if (jogadoresSelecionados.length < minJogadores) {
      mostrarMensagem(`❌ Selecione pelo menos ${minJogadores} jogadores para ${regras.jogadores_por_time}x${regras.jogadores_por_time}`, 4000);
      return;
    }

    try {
      setIsLoading(true);
      mostrarMensagem('🎲 Sorteando times...', 1000);

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

  // Sorteio Equilibrado (usa padrões por nível)
  const executarSorteioEquilibrado = (jogadores: Jogador[], times: Time[], jogadoresPorTime: number) => {
    console.log('⚖️ EXECUTANDO SORTEIO EQUILIBRADO');
    
    // Separar jogadores por nível
    const jogadoresPorNivel = separarJogadoresPorNivel(jogadores);
    
    // Obter padrões específicos do tamanho
    const padroes = obterPadroesPorTamanho(jogadoresPorTime);
    
    // Aplicar padrões equilibrados
    aplicarPadroesEquilibrados(jogadoresPorNivel, times, padroes, jogadoresPorTime);
  };

  const obterPadroesPorTamanho = (tamanho: number) => {
    // Padrões baseados na interface de regras
    const padroesPorTamanho: { [key: number]: Array<{ star2: number, star3: number, star4: number, star5: number, avg: number }> } = {
      4: [
        { star2: 1, star3: 0, star4: 3, star5: 1, avg: 4.0 },
        { star2: 0, star3: 2, star4: 2, star5: 1, avg: 3.8 },
        { star2: 0, star3: 3, star4: 1, star5: 1, avg: 3.6 },
        { star2: 1, star3: 1, star4: 2, star5: 1, avg: 3.6 },
        { star2: 0, star3: 3, star4: 2, star5: 0, avg: 3.4 },
        { star2: 0, star3: 4, star4: 0, star5: 1, avg: 3.4 },
        { star2: 1, star3: 1, star4: 3, star5: 0, avg: 3.2 },
        { star2: 1, star3: 2, star4: 1, star5: 1, avg: 3.4 }
      ],
      5: [
        { star2: 1, star3: 0, star4: 3, star5: 1, avg: 3.8 },
        { star2: 0, star3: 2, star4: 2, star5: 1, avg: 3.6 },
        { star2: 0, star3: 3, star4: 1, star5: 1, avg: 3.6 },
        { star2: 1, star3: 1, star4: 2, star5: 1, avg: 3.6 },
        { star2: 0, star3: 3, star4: 2, star5: 0, avg: 3.4 },
        { star2: 0, star3: 4, star4: 0, star5: 1, avg: 3.4 },
        { star2: 1, star3: 1, star4: 3, star5: 0, avg: 3.2 },
        { star2: 1, star3: 2, star4: 1, star5: 1, avg: 3.4 }
      ],
      6: [
        { star2: 1, star3: 1, star4: 3, star5: 1, avg: 3.8 }, // (2+3+12+5)/6 = 3.83
        { star2: 0, star3: 3, star4: 2, star5: 1, avg: 3.7 }, // (0+9+8+5)/6 = 3.67
        { star2: 1, star3: 2, star4: 2, star5: 1, avg: 3.7 }, // (2+6+8+5)/6 = 3.67
        { star2: 0, star3: 4, star4: 1, star5: 1, avg: 3.5 }, // (0+12+4+5)/6 = 3.5
        { star2: 1, star3: 3, star4: 1, star5: 1, avg: 3.5 }, // (2+9+4+5)/6 = 3.5
        { star2: 2, star3: 1, star4: 2, star5: 1, avg: 3.5 }, // (4+3+8+5)/6 = 3.5
        { star2: 0, star3: 5, star4: 0, star5: 1, avg: 3.3 }, // (0+15+0+5)/6 = 3.33
        { star2: 1, star3: 4, star4: 0, star5: 1, avg: 3.3 }  // (2+12+0+5)/6 = 3.33
      ],
      7: [
        { star2: 1, star3: 0, star4: 5, star5: 1, avg: 4.1 },
        { star2: 0, star3: 2, star4: 4, star5: 1, avg: 3.9 },
        { star2: 0, star3: 3, star4: 3, star5: 1, avg: 3.7 },
        { star2: 1, star3: 1, star4: 4, star5: 1, avg: 3.7 },
        { star2: 0, star3: 3, star4: 4, star5: 0, avg: 3.6 },
        { star2: 0, star3: 4, star4: 2, star5: 1, avg: 3.6 },
        { star2: 1, star3: 1, star4: 5, star5: 0, avg: 3.4 },
        { star2: 1, star3: 2, star4: 3, star5: 1, avg: 3.6 }
      ]
    };

    return padroesPorTamanho[tamanho] || [];
  };

  const aplicarPadroesEquilibrados = (jogadoresPorNivel: { [key: number]: Jogador[] }, times: Time[], padroes: any[], jogadoresPorTime: number) => {
    if (padroes.length === 0) {
      console.log('⚠️ Nenhum padrão disponível para este tamanho de time');
      // Fallback para distribuição simples
      const todosJogadores = Object.values(jogadoresPorNivel).flat();
      const jogadoresEmbaralhados = embaralharArray(todosJogadores);
      
      let jogadorIndex = 0;
      for (let i = 0; i < times.length && jogadorIndex < jogadoresEmbaralhados.length; i++) {
        for (let j = 0; j < jogadoresPorTime && jogadorIndex < jogadoresEmbaralhados.length; j++) {
          times[i].jogadores.push(jogadoresEmbaralhados[jogadorIndex]);
          jogadorIndex++;
        }
      }
      return;
    }

    // Embaralhar padrões para seleção aleatória
    const padroesEmbaralhados = embaralharArray([...padroes]);
    
    // Aplicar padrão para cada time
    for (let i = 0; i < times.length; i++) {
      const time = times[i];
      const padrao = padroesEmbaralhados[i % padroesEmbaralhados.length];
      
      console.log(`📋 Time ${time.nome} - Padrão: 2⭐(${padrao.star2}) 3⭐(${padrao.star3}) 4⭐(${padrao.star4}) 5⭐(${padrao.star5})`);
      
      // Atribuir a média do padrão ao time (média teórica)
      time.nivelMedio = padrao.avg || 3.5;
      
      // Tentar preencher time com o padrão especificado
      preencherTimePorPadrao(time, jogadoresPorNivel, padrao);
      
      // Se ainda faltam jogadores, completar com disponíveis
      completarTimeComDisponiveis(time, jogadoresPorNivel, jogadoresPorTime);
    }
  };

  const preencherTimePorPadrao = (time: Time, jogadoresPorNivel: { [key: number]: Jogador[] }, padrao: any) => {
    // Adicionar jogadores de cada nível conforme o padrão
    const niveis = [2, 3, 4, 5];
    for (const nivel of niveis) {
      const quantidade = padrao[`star${nivel}`] || 0;
      const jogadoresNivel = jogadoresPorNivel[nivel] || [];
      
      for (let i = 0; i < quantidade && jogadoresNivel.length > 0; i++) {
        const jogadorIndex = Math.floor(Math.random() * jogadoresNivel.length);
        const jogador = jogadoresNivel.splice(jogadorIndex, 1)[0];
        time.jogadores.push(jogador);
      }
    }
  };

  const completarTimeComDisponiveis = (time: Time, jogadoresPorNivel: { [key: number]: Jogador[] }, jogadoresPorTime: number) => {
    // Se o time ainda não está completo, adicionar jogadores disponíveis
    while (time.jogadores.length < jogadoresPorTime) {
      const jogadoresDisponiveis = Object.values(jogadoresPorNivel).flat();
      if (jogadoresDisponiveis.length === 0) break;
      
      const jogadorAleatorio = jogadoresDisponiveis[Math.floor(Math.random() * jogadoresDisponiveis.length)];
      
      // Remover o jogador da lista do seu nível
      const nivel = jogadorAleatorio.nivel;
      const indexNoNivel = jogadoresPorNivel[nivel].findIndex(j => j.id === jogadorAleatorio.id);
      if (indexNoNivel >= 0) {
        jogadoresPorNivel[nivel].splice(indexNoNivel, 1);
      }
      
      time.jogadores.push(jogadorAleatorio);
    }
  };


  const confirmarTimes = async () => {
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
      
      const userData = localStorage.getItem('user');
      if (!userData) throw new Error('Usuário não logado');
      
      const user = JSON.parse(userData);
      const peladaId = user.id;
      
      console.log('🔄 Iniciando pelada para:', peladaId);
      
      // Buscar tipo de fila configurado nas regras
      const { data: regrasData } = await supabase
        .from('regras')
      // Não precisa mais buscar tipo_fila - agora só existe uma fila (page-fila)
      // Os modos (prancheta/partida) são escolhidos quando inicia a partida
      
      // 1. VERIFICAR SE JÁ EXISTE SESSÃO ATIVA HOJE
      let sessao;
      const hoje = new Date().toISOString().split('T')[0];
      
      const { data: sessaoExistente, error: consultaError } = await supabase
        .from('sessoes')
        .select('*')
        .eq('pelada_id', peladaId)
        .eq('data', hoje)
        .eq('status', 'ativa')
        .single();
      
      if (consultaError && consultaError.code !== 'PGRST116') {
        throw consultaError;
      }
      
      if (sessaoExistente) {
        console.log('✅ Usando sessão existente:', sessaoExistente.id);
        sessao = sessaoExistente;
      } else {
        // Criar nova sessão apenas se não existir
        const { data: novaSessao, error: sessaoError } = await supabase
          .from('sessoes')
          .insert({
            pelada_id: peladaId,
            status: 'ativa',
            total_jogadores: jogadoresSelecionados.length,
            observacoes: `Sorteio realizado com ${timesFormados.length} times`
          })
          .select()
          .single();
        
        if (sessaoError) throw sessaoError;
        console.log('✅ Nova sessão criada:', novaSessao.id);
        sessao = novaSessao;
      }
      
      // 2. BUSCAR TODOS OS JOGADORES CADASTRADOS (igual Pelada 3)
      const { data: todosJogadores, error: errorJogadores } = await supabase
        .from('jogadores')
        .select('id, nome')
        .eq('pelada_id', peladaId)
        .eq('status', 'ativo') // Apenas jogadores ativos
        .order('nome');
      
      if (errorJogadores) throw errorJogadores;
      console.log(`📊 Total de jogadores cadastrados: ${todosJogadores.length}`);
      
      // 3. ORGANIZAR JOGADORES POR TIMES FORMADOS
      const jogadoresTime1 = timesFormados[0]?.jogadores || [];
      const jogadoresTime2 = timesFormados[1]?.jogadores || [];
      const jogadoresTime3 = timesFormados[2]?.jogadores || [];
      const todosTimesFormados = [...jogadoresTime1, ...jogadoresTime2, ...jogadoresTime3];
      
      console.log(`⚽ Times formados: ${timesFormados.length} times`);
      console.log(`👥 Total nos times: ${todosTimesFormados.length} jogadores`);
      
      // 4. LIMPAR TODA A FILA EXISTENTE (apenas 1 fila ativa por vez)
      console.log('🧹 Limpando fila existente...');
      await supabase
        .from('fila')
        .delete()
        .eq('pelada_id', peladaId);
      
      console.log('✅ Fila anterior limpa');
      
      // 5. INSERIR TODOS OS JOGADORES NA FILA (algoritmo correto)
      const filaInserts = [];
      let posicaoAtual = 1;
      
      // 5.1. JOGADORES DOS TIMES SORTEADOS - todos com status 'fila' em ordem sequencial
      const idsJogadoresNaFila = new Set(); // Evitar duplicatas
      
      timesFormados.forEach((time, timeIndex) => {
        time.jogadores.forEach((jogadorTime) => {
          const jogadorDB = todosJogadores.find(j => j.nome === jogadorTime.nome);
          if (jogadorDB && !idsJogadoresNaFila.has(jogadorDB.id)) {
            idsJogadoresNaFila.add(jogadorDB.id);
            filaInserts.push({
              pelada_id: peladaId,
              sessao_id: sessao.id,
              jogador_id: jogadorDB.id,
              status: 'fila', // TODOS na fila (primeiras posições = jogando, resto = fila de espera)
              posicao_fila: posicaoAtual++
            });
          }
        });
      });
      
      // 5.2. JOGADORES NÃO SELECIONADOS PARA O SORTEIO - status "reserva"
      const nomesNosTimesFormados = Array.from(idsJogadoresNaFila);
      const jogadoresReserva = todosJogadores.filter(j => !idsJogadoresNaFila.has(j.id));
      
      jogadoresReserva.forEach((jogadorDB) => {
        filaInserts.push({
          pelada_id: peladaId,
          sessao_id: sessao.id,
          jogador_id: jogadorDB.id,
          status: 'reserva',
          posicao_fila: 9999 // Valor alto para reservas
        });
      });
      
      const jogadoresJogando = regras.jogadores_por_time * 2;
      console.log(`📝 Inserindo ${filaInserts.length} jogadores na fila:`);
      console.log(`  - ${Math.min(jogadoresJogando, filaInserts.filter(f => f.status === 'fila').length)} jogando (primeiras posições)`);
      console.log(`  - ${Math.max(0, filaInserts.filter(f => f.status === 'fila').length - jogadoresJogando)} na fila de espera`);
      console.log(`  - ${filaInserts.filter(f => f.status === 'reserva').length} reservas`);
      
      if (filaInserts.length > 0) {
        const { error: filaError } = await supabase
          .from('fila')
          .insert(filaInserts);
        
        if (filaError) throw filaError;
        console.log(`✅ Todos os ${filaInserts.length} jogadores inseridos na tabela fila`);
      }
      
      // 6. ESTATÍSTICAS NO LOCALSTORAGE (só para stats)
      const statsExistentes = localStorage.getItem('peladaStats');
      const stats = statsExistentes ? JSON.parse(statsExistentes) : {};
      
      localStorage.setItem('peladaStats', JSON.stringify({
        ...stats,
        ultimaSessao: sessao.id,
        ultimaData: new Date().toISOString()
      }));
      
      setMessage('✅ Pelada iniciada com sucesso!');
      
      // Incrementar contador de ações para anúncios (só para FREE)
      incrementActionCounter();
      
      // Redirecionar para a fila (única página de fila)
      console.log('🎯 Redirecionando para: /page-fila');
      
      setTimeout(() => {
        window.location.href = '/page-fila';
      }, 1500);
      
    } catch (error) {
      console.error('💥 Erro ao iniciar pelada:', error);
      setMessage('❌ Erro ao iniciar pelada: ' + error.message);
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