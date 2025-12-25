'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
// import { supabase } from '@/lib/supabase'; // REMOVER QUANDO USAR

interface Jogador {
  id: number;
  nome: string;
  nivel: number;
}

interface Time {
  id: number;
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
  const router = useRouter();
  const [jogadoresDisponiveis, setJogadoresDisponiveis] = useState<Jogador[]>([]);
  const [jogadoresSelecionados, setJogadoresSelecionados] = useState<number[]>([]);
  const [timesFormados, setTimesFormados] = useState<Time[]>([]);
  const [regras, setRegras] = useState<Regras>({
    jogadores_por_time: 5,
    modelo_sorteio: 'equilibrado'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [mostrarResultado, setMostrarResultado] = useState(false);
  const [todosSelecionados, setTodosSelecionados] = useState(false);
  const [mostrarBotaoFixoSortear, setMostrarBotaoFixoSortear] = useState(true);
  const [mostrarBotaoFixoConfirmar, setMostrarBotaoFixoConfirmar] = useState(false);

  // Derivar jogadoresPorTime das regras
  const jogadoresPorTime = regras.jogadores_por_time;

  useEffect(() => {
    carregarDados();
  }, []);

  // Sistema de scroll para controle dos botões fixos
  useEffect(() => {
    const handleScroll = () => {
      const bottomOffset = 120; // Offset do rodapé + espaço dos botões
      
      if (mostrarResultado) {
        // Após o sorteio, SEMPRE manter o botão "Confirmar Times" fixo
        // O botão re-sortear fica apenas no meio da página (estático)
        const botaoConfirmar = document.getElementById('botao-confirmar-estatico');
        
        if (botaoConfirmar) {
          const rectConfirmar = botaoConfirmar.getBoundingClientRect();
          const windowHeight = window.innerHeight;
          
          // Só esconder o botão fixo se o botão estático estiver visível
          if (rectConfirmar.top < windowHeight - bottomOffset) {
            // Botão confirmar estático ainda visível, esconder o fixo
            setMostrarBotaoFixoConfirmar(false);
          } else {
            // Botão confirmar estático não visível, mostrar o fixo
            setMostrarBotaoFixoConfirmar(true);
          }
        }
        
        // Nunca mostrar re-sortear fixo após sorteio
        setMostrarBotaoFixoSortear(false);
        
      } else {
        // Antes do sorteio, apenas controla o botão sortear
        const botaoSortear = document.getElementById('botao-sortear-estatico');
        if (botaoSortear) {
          const rect = botaoSortear.getBoundingClientRect();
          setMostrarBotaoFixoSortear(rect.top >= window.innerHeight - bottomOffset);
        }
        // Reset do confirmar quando não há resultado
        setMostrarBotaoFixoConfirmar(false);
      }
    };

    // Adicionar listener de scroll
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Verificar estado inicial

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [mostrarResultado]);

  const carregarDados = async () => {
    await Promise.all([
      carregarJogadores(),
      carregarRegras()
    ]);
  };

  const carregarJogadores = async () => {
    try {
      setIsLoading(true);

      // SUBSTITUIR PELA SUA LÓGICA DE CARREGAMENTO
      // Dados de teste por enquanto:
      const jogadoresFormatados = [
        { id: 1, nome: 'Adriano', nivel: 4 },
        { id: 2, nome: 'Castor', nivel: 3 },
        { id: 3, nome: 'Douglas Castro', nivel: 5 },
        { id: 4, nome: 'João', nivel: 3 },
        { id: 5, nome: 'Pedro', nivel: 4 },
        { id: 6, nome: 'Carlos', nivel: 2 },
        { id: 7, nome: 'Ana', nivel: 4 },
        { id: 8, nome: 'Maria', nivel: 3 },
        { id: 9, nome: 'Lucas', nivel: 5 },
        { id: 10, nome: 'Rafael', nivel: 3 }
      ];

      setJogadoresDisponiveis(jogadoresFormatados);

      if (jogadoresFormatados.length === 0) {
        setMessage('⚠️ Nenhum jogador cadastrado ainda');
      }

    } catch (error) {
      console.error('Erro ao carregar jogadores:', error);
      setMessage('❌ Erro ao carregar jogadores');
    } finally {
      setIsLoading(false);
    }
  };

  const carregarRegras = async (): Promise<Regras> => {
    try {
      // SUBSTITUIR PELA SUA LÓGICA DE CARREGAMENTO DE REGRAS
      // Usar valores padrão por enquanto
      const regrasCarregadas = {
        jogadores_por_time: 5,
        modelo_sorteio: 'equilibrado' as const
      };

      setRegras(regrasCarregadas);
      console.log('🎯 Regras carregadas:', regrasCarregadas);
      setMessage(`📋 Regras: ${regrasCarregadas.jogadores_por_time} jogadores por time, sorteio ${regrasCarregadas.modelo_sorteio}`);
      return regrasCarregadas;
      
    } catch (error) {
      console.error('Erro ao carregar regras:', error);
      // Usar valores padrão em caso de erro
      const regrasDefault = {
        jogadores_por_time: 5,
        modelo_sorteio: 'equilibrado' as const
      };
      setRegras(regrasDefault);
      return regrasDefault;
    }
  };

  const toggleJogador = (jogadorId: number) => {
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
    if (jogadoresSelecionados.length === 0) {
      setMessage('❌ Nenhum jogador selecionado!');
      return;
    }

    const minJogadores = regras.jogadores_por_time * 2;
    if (jogadoresSelecionados.length < minJogadores) {
      setMessage(`❌ Selecione pelo menos ${minJogadores} jogadores para ${regras.jogadores_por_time}x${regras.jogadores_por_time}`);
      return;
    }

    try {
      setIsLoading(true);
      setMessage('🎲 Sorteando times...');

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
        id: i + 1,
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

      // Calcular nível médio de cada time
      times.forEach(time => {
        if (time.jogadores.length > 0) {
          const somaNeveis = time.jogadores.reduce((soma, j) => soma + (j.nivel || 3), 0);
          time.nivelMedio = somaNeveis / time.jogadores.length;
        }
      });

      setTimesFormados(times);
      setMostrarResultado(true);
      
      // Após sorteio: botão confirmar pode aparecer fixo, re-sortear nunca
      setMostrarBotaoFixoSortear(false);
      setMostrarBotaoFixoConfirmar(false); // Será controlado pelo scroll
      
      setMessage('✅ Times sorteados com sucesso!');

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
      setMessage('❌ Erro ao sortear times');
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
        { star2: 1, star3: 2, star4: 2, star5: 1, avg: 3.5 },
        { star2: 1, star3: 3, star4: 1, star5: 1, avg: 3.5 },
        { star2: 1, star3: 4, star4: 0, star5: 1, avg: 3.5 },
        { star2: 0, star3: 2, star4: 2, star5: 1, avg: 3.5 },
        { star2: 0, star3: 4, star4: 1, star5: 1, avg: 3.5 },
        { star2: 1, star3: 3, star4: 1, star5: 1, avg: 3.4 },
        { star2: 0, star3: 5, star4: 0, star5: 1, avg: 3.4 },
        { star2: 1, star3: 2, star4: 2, star5: 1, avg: 3.3 },
        { star2: 1, star3: 4, star4: 0, star5: 1, avg: 3.3 },
        { star2: 0, star3: 2, star4: 3, star5: 1, avg: 3.3 },
        { star2: 1, star3: 3, star4: 1, star5: 1, avg: 3.2 },
        { star2: 1, star3: 4, star4: 0, star5: 1, avg: 3.2 },
        { star2: 0, star3: 4, star4: 1, star5: 1, avg: 3.2 }
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
    // IMPLEMENTAR SUA LÓGICA para confirmar times e iniciar pelada
    setMessage('🚀 Times confirmados! Redirecionando para a fila...');
    
    setTimeout(() => {
      router.push('/fila');
    }, 2000);
  };

  const resortear = () => {
    setMostrarResultado(false);
    setTimesFormados([]);
    
    // Reset dos estados dos botões
    setMostrarBotaoFixoSortear(false);
    setMostrarBotaoFixoConfirmar(false);
    
    // Dar um pequeno delay antes de sortear novamente
    setTimeout(() => {
      sortearTimes();
    }, 100);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <span className="text-6xl mb-4 block">⏳</span>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-6">
      {/* Header */}
      <section className="bg-gray-50 border-2 border-gray-100 rounded-3xl mx-5 mt-5 p-3 text-center">
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
      <section data-jogadores-section className="bg-white rounded-3xl mx-5 mt-5 p-5 shadow-sm border border-gray-100">

        {jogadoresDisponiveis.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <span className="text-4xl mb-3 block">😴</span>
            <p>Nenhum jogador cadastrado ainda</p>
            <p className="text-sm mt-2">
              <button 
                onClick={() => router.push('/cadastro')}
                className="text-green-600 hover:underline"
              >
                Cadastre jogadores primeiro
              </button>
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
        <section className="mx-5 mt-4">
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
        <section className="mx-5 mt-4">
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
          <section id="resultado-sorteio" className="bg-white rounded-3xl mx-5 mt-5 p-5 mb-6 shadow-sm border-2 border-green-600">
            <h2 className="text-lg font-semibold text-green-600 mb-5 text-center">⚽ Times Formados</h2>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              {timesFormados.filter(time => time.jogadores.length > 0).map(time => (
                <div key={time.id} className="bg-white border-2 border-gray-200 rounded-2xl p-4 hover:-translate-y-1 hover:shadow-lg hover:border-green-600 transition-all duration-200">
                  <div className="text-center mb-3 pb-2 border-b-2 border-gray-100">
                    <div className="text-base font-bold text-green-600 mb-1">
                      {time.cores} {time.nome}
                    </div>
                    <div className="text-xs text-gray-600 font-medium">
                      ⭐ {time.nivelMedio.toFixed(1).replace('.', ',')}
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
          <section className="mx-5 mt-4 mb-6">
            <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
              <button
                id="botao-confirmar-estatico"
                onClick={confirmarTimes}
                className="w-full flex items-center justify-center gap-3 py-4 px-5 rounded-xl text-base font-semibold bg-green-600 text-white hover:bg-green-700 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200"
              >
                <span className="text-xl">✅</span>
                <span>Confirmar Times</span>
              </button>
            </div>
          </section>
        </>
      )}

      {/* Botão Fixo Dinâmico - Sortear/Re-sortear */}
      {!mostrarResultado && mostrarBotaoFixoSortear && (
        <section className="fixed bottom-20 left-0 right-0 px-5 z-10">
          <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
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
        </section>
      )}

      {/* Botão Fixo Dinâmico - Re-sortear (após sorteio) */}
      {mostrarResultado && mostrarBotaoFixoSortear && (
        <section className="fixed bottom-20 left-0 right-0 px-5 z-10">
          <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
            <button
              onClick={resortear}
              className="w-full flex items-center justify-center gap-3 py-4 px-5 rounded-xl text-base font-semibold bg-gray-50 text-gray-600 border-2 border-gray-200 hover:border-blue-600 hover:bg-blue-50 hover:text-blue-600 transition-all duration-200"
            >
              <span className="text-xl">🔄</span>
              <span>Re-sortear</span>
            </button>
          </div>
        </section>
      )}

      {/* Botão Fixo Dinâmico - Confirmar Times */}
      {mostrarResultado && mostrarBotaoFixoConfirmar && (
        <section className="fixed bottom-20 left-0 right-0 px-5 z-10">
          <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
            <button
              onClick={confirmarTimes}
              className="w-full flex items-center justify-center gap-3 py-4 px-5 rounded-xl text-base font-semibold bg-green-600 text-white hover:bg-green-700 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200"
            >
              <span className="text-xl">✅</span>
              <span>Confirmar Times</span>
            </button>
          </div>
        </section>
      )}

      {/* Footer Mobile Navigation */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden z-50">
        <nav className="flex justify-around">
          <button
            onClick={() => router.push('/')}
            className="flex flex-col items-center justify-center p-3 text-gray-400 hover:bg-gray-50 transition-all duration-200 rounded-xl"
          >
            <span className="text-3xl mb-1">🏠</span>
          </button>
          
          <button
            onClick={() => router.push('/cadastro')}
            className="flex flex-col items-center justify-center p-3 text-gray-400 hover:bg-gray-50 transition-all duration-200 rounded-xl"
          >
            <span className="text-3xl mb-1">👤</span>
          </button>
          
          <button
            onClick={() => router.push('/sorteio')}
            className="flex flex-col items-center justify-center p-3 text-blue-600 bg-blue-50 rounded-xl shadow-sm border hover:bg-blue-100 transition-all duration-200"
          >
            <span className="text-3xl mb-1">🎲</span>
          </button>
        </nav>
      </footer>
    </div>
  );
}