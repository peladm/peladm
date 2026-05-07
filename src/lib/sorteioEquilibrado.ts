'use client';

export interface Jogador {
  id: string;
  nome: string;
  nivel: number;
  posicao: 'linha' | 'goleiro';
}

export interface Time {
  id: string;
  nome: string;
  jogadores: Jogador[];
  nivelMedio: number;
  cores: string;
}

export const embaralharArray = <T>(array: T[]): T[] => {
  const arrayCopy = [...array];
  for (let i = arrayCopy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arrayCopy[i], arrayCopy[j]] = [arrayCopy[j], arrayCopy[i]];
  }
  return arrayCopy;
};

export const separarJogadoresPorNivel = (jogadores: Jogador[]) => {
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

  Object.keys(jogadoresPorNivel).forEach(nivel => {
    jogadoresPorNivel[parseInt(nivel, 10)] = embaralharArray(jogadoresPorNivel[parseInt(nivel, 10)]);
  });

  return jogadoresPorNivel;
};

// Calcula a diversidade de um time (quantos níveis diferentes tem)
const calcularDiversidadeTime = (time: Time): Set<number> => {
  return new Set(time.jogadores.map(j => j.nivel));
};

// Encontra qual nível está mais subutilizado em um time
const encontrarNivelSubutilizado = (time: Time, nivelDisponivel: number[]): number => {
  const niveisNoTime = calcularDiversidadeTime(time);
  const contagemPorNivel: { [key: number]: number } = {};

  time.jogadores.forEach(j => {
    contagemPorNivel[j.nivel] = (contagemPorNivel[j.nivel] || 0) + 1;
  });

  // Retorna o nível disponível que tem menos no time
  return nivelDisponivel.reduce((anterior, atual) => {
    const countAnterior = contagemPorNivel[anterior] || 0;
    const countAtual = contagemPorNivel[atual] || 0;
    return countAtual < countAnterior ? atual : anterior;
  });
};

export const executarSorteioEquilibrado = (
  jogadores: Jogador[],
  times: Time[],
  jogadoresPorTime: number
) => {
  console.log('🎲 EXECUTANDO SORTEIO COM FOCO EM DIVERSIDADE E EQUILÍBRIO');

  const jogadoresPorNivel = separarJogadoresPorNivel(jogadores);
  const niveisDisponiveis = Object.keys(jogadoresPorNivel)
    .map(n => parseInt(n, 10))
    .filter(n => jogadoresPorNivel[n].length > 0)
    .sort((a, b) => b - a);

  const jogadoresNoTimeIncompleto = jogadores.length % jogadoresPorTime;
  const temTimeIncompleto = jogadoresNoTimeIncompleto > 0;

  const limitesPorTime = times.map((_, i) => {
    if (temTimeIncompleto && i === times.length - 1) {
      return jogadoresNoTimeIncompleto;
    }
    return jogadoresPorTime;
  });

  console.log(`📋 Times: ${times.length} (${Math.floor(jogadores.length / jogadoresPorTime)} completos + ${temTimeIncompleto ? '1 incompleto' : '0'})`);
  console.log(`🎯 Limites: ${limitesPorTime.join(', ')}`);
  console.log(`📊 Níveis disponíveis: ${niveisDisponiveis.join(', ')}`);

  // Rastreamento de disponibilidade
  const disponiveisPorNivel: { [key: number]: Jogador[] } = {};
  niveisDisponiveis.forEach(nivel => {
    disponiveisPorNivel[nivel] = [...jogadoresPorNivel[nivel]];
  });

  const somasTimes = times.map(() => 0);

  console.log('\n🌈 DISTRIBUINDO COM FOCO EM DIVERSIDADE:');

  // Preenche cada vaga preferencialmente com diversidade
  for (let t = 0; t < times.length; t++) {
    while (times[t].jogadores.length < limitesPorTime[t]) {
      // Encontra níveis ainda disponíveis
      const niveisComJogadores = niveisDisponiveis.filter(n => disponiveisPorNivel[n].length > 0);

      if (niveisComJogadores.length === 0) break;

      // Estratégia: prefere o nível que menos está representado NESTE time
      const nivelEscolhido = encontrarNivelSubutilizado(times[t], niveisComJogadores);

      if (disponiveisPorNivel[nivelEscolhido].length > 0) {
        // Pega aleatoriamente da lista de disponíveis daquele nível
        const indexAleatorio = Math.floor(Math.random() * disponiveisPorNivel[nivelEscolhido].length);
        const jogador = disponiveisPorNivel[nivelEscolhido][indexAleatorio];

        times[t].jogadores.push(jogador);
        somasTimes[t] += jogador.nivel;
        disponiveisPorNivel[nivelEscolhido].splice(indexAleatorio, 1);

        const diversidadeTime = Array.from(calcularDiversidadeTime(times[t])).sort((a, b) => b - a).join(', ');
        console.log(`  → ${jogador.nome} (${jogador.nivel}⭐) → Time ${t + 1} | Diversidade: [${diversidadeTime}]`);
      }
    }
  }

  console.log('\n📊 RESULTADO FINAL:');
  times.forEach((time, i) => {
    if (time.jogadores.length > 0) {
      time.nivelMedio = somasTimes[i] / time.jogadores.length;
      const status = time.jogadores.length < jogadoresPorTime ? ' (INCOMPLETO)' : '';
      const diversidade = Array.from(calcularDiversidadeTime(time))
        .sort((a, b) => b - a)
        .join(', ');
      
      console.log(`${time.nome}: ${time.jogadores.length} jogadores | Soma: ${somasTimes[i]} | Média: ${time.nivelMedio.toFixed(2)}${status}`);
      console.log(`  Diversidade de níveis: [${diversidade}]`);
      console.log(`  Jogadores: ${time.jogadores.map(j => `${j.nome}(${j.nivel}⭐)`).join(', ')}`);
    }
  });

  console.log('\n✅ Sorteio com diversidade concluído');
};
