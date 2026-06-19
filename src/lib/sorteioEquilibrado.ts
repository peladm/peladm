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
  console.log('🎲 EXECUTANDO SORTEIO COM ESTRATÉGIA DE 2 FASES');

  const jogadoresPorNivel = separarJogadoresPorNivel(jogadores);
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

  // Rastreamento de disponibilidade
  const disponiveisPorNivel: { [key: number]: Jogador[] } = {};
  Object.keys(jogadoresPorNivel).forEach(nivel => {
    const n = parseInt(nivel, 10);
    disponiveisPorNivel[n] = [...jogadoresPorNivel[n]];
  });

  const somasTimes = times.map(() => 0);

  // ===== FASE 1: DISTRIBUIR EXTREMOS =====
  console.log('\n⭐ FASE 1: DISTRIBUINDO EXTREMOS ENTRE TODOS');
  
  // Distribuir 5⭐ entre TODOS os times (completos + incompleto)
  if (disponiveisPorNivel[5] && disponiveisPorNivel[5].length > 0) {
    console.log(`  📍 Distribuindo ${disponiveisPorNivel[5].length} jogador(es) 5⭐ entre todos os times`);
    let timerRound = 0;
    let attemptsMax = times.length * 10; // Proteção contra loop infinito
    
    while (disponiveisPorNivel[5].length > 0 && attemptsMax > 0) {
      attemptsMax--;
      const timeIdx = timerRound % times.length;
      if (times[timeIdx].jogadores.length < limitesPorTime[timeIdx]) {
        const jogador = disponiveisPorNivel[5].shift()!;
        times[timeIdx].jogadores.push(jogador);
        somasTimes[timeIdx] += jogador.nivel;
        console.log(`    → ${jogador.nome} (5⭐) → Time ${timeIdx + 1}`);
      }
      timerRound++;
    }
  }

  // Distribuir 1-2⭐ entre TODOS os times (completos + incompleto)
  const extremosBaixos = [...(disponiveisPorNivel[1] || []), ...(disponiveisPorNivel[2] || [])];
  if (extremosBaixos.length > 0) {
    console.log(`  📍 Distribuindo ${extremosBaixos.length} jogador(es) 1-2⭐ entre todos os times`);
    let timerRound = 0;
    let attemptsMax = times.length * 10; // Proteção contra loop infinito
    
    while (extremosBaixos.length > 0 && attemptsMax > 0) {
      attemptsMax--;
      const timeIdx = timerRound % times.length;
      if (times[timeIdx].jogadores.length < limitesPorTime[timeIdx]) {
        const jogador = extremosBaixos.shift()!;
        times[timeIdx].jogadores.push(jogador);
        somasTimes[timeIdx] += jogador.nivel;
        // Remove do disponível
        const nível = jogador.nivel;
        if (disponiveisPorNivel[nível]) {
          const idx = disponiveisPorNivel[nível].indexOf(jogador);
          if (idx > -1) disponiveisPorNivel[nível].splice(idx, 1);
        }
        console.log(`    → ${jogador.nome} (${nível}⭐) → Time ${timeIdx + 1}`);
      }
      timerRound++;
    }
  }

  // ===== FASE 2: PREENCHER COMPLETOS COM MEIO =====
  console.log('\n🎯 FASE 2: PREENCHENDO TIMES COMPLETOS COM MEIO (3-4⭐)');
  
  const niveisDisponiveis = Object.keys(disponiveisPorNivel)
    .map(n => parseInt(n, 10))
    .filter(n => disponiveisPorNivel[n].length > 0)
    .sort((a, b) => b - a);

  console.log(`  Níveis disponíveis: ${niveisDisponiveis.join(', ')}`);

  // Preencher apenas times COMPLETOS
  for (let t = 0; t < times.length; t++) {
    // Pula time incompleto
    if (temTimeIncompleto && t === times.length - 1) {
      console.log(`  ⏭️  Time ${t + 1} é incompleto, pulando...`);
      continue;
    }

    while (times[t].jogadores.length < limitesPorTime[t]) {
      // Encontra níveis ainda disponíveis (priorizando 3 e 4)
      const niveisComJogadores = niveisDisponiveis.filter(n => disponiveisPorNivel[n].length > 0);

      if (niveisComJogadores.length === 0) break;

      // Estratégia: prefere o nível que menos está representado NESTE time
      const nivelEscolhido = encontrarNivelSubutilizado(times[t], niveisComJogadores);

      if (disponiveisPorNivel[nivelEscolhido].length > 0) {
        const indexAleatorio = Math.floor(Math.random() * disponiveisPorNivel[nivelEscolhido].length);
        const jogador = disponiveisPorNivel[nivelEscolhido][indexAleatorio];

        times[t].jogadores.push(jogador);
        somasTimes[t] += jogador.nivel;
        disponiveisPorNivel[nivelEscolhido].splice(indexAleatorio, 1);

        console.log(`  → ${jogador.nome} (${jogador.nivel}⭐) → Time ${t + 1}`);
      }
    }
  }

  // Preencher time incompleto com jogadores restantes
  if (temTimeIncompleto) {
    const timeIncompleto = times.length - 1;
    console.log(`\n📌 Preenchendo Time ${timeIncompleto + 1} (incompleto) com restantes`);
    
    for (let nivel of niveisDisponiveis) {
      while (disponiveisPorNivel[nivel].length > 0 && times[timeIncompleto].jogadores.length < limitesPorTime[timeIncompleto]) {
        const jogador = disponiveisPorNivel[nivel].shift()!;
        times[timeIncompleto].jogadores.push(jogador);
        somasTimes[timeIncompleto] += jogador.nivel;
        console.log(`  → ${jogador.nome} (${jogador.nivel}⭐) → Time ${timeIncompleto + 1}`);
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

  console.log('\n✅ Sorteio em 2 fases concluído');
};
