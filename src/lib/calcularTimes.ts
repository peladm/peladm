/**
 * 📊 Utilitários para calcular quantidade de times baseado em jogadores
 * Usado em: sorteio, fila, rotações, validações
 */

export interface CalculoTimesResult {
  /** Número de times com tamanho completo (jogadores_por_time) */
  timesCompletos: number;
  
  /** Se existe um time com menos jogadores que o padrão */
  temTimeIncompleto: boolean;
  
  /** Quantidade de jogadores no time incompleto (0 se não houver) */
  jogadoresNoIncompleto: number;
  
  /** Total de times (completos + incompleto) */
  totalTimes: number;
  
  /** Distribuição visual: ex: "5+5+5+3" ou "4+4+4+4" */
  distribuicao: string;
}

/**
 * Calcula quantos times existem baseado em total de jogadores e tamanho do time
 * 
 * @param totalJogadores - Total de jogadores disponíveis
 * @param jogadores_por_time - Tamanho configurado para cada time (da regra)
 * @returns Objeto com cálculos detalhados
 * 
 * @example
 * ```typescript
 * const calc = calcularTimes(18, 5);
 * // {
 * //   timesCompletos: 3,
 * //   temTimeIncompleto: true,
 * //   jogadoresNoIncompleto: 3,
 * //   totalTimes: 4,
 * //   distribuicao: "5+5+5+3"
 * // }
 * ```
 */
export function calcularTimes(
  totalJogadores: number,
  jogadores_por_time: number
): CalculoTimesResult {
  // Proteção: evitar divisão por zero
  if (jogadores_por_time <= 0) {
    throw new Error('jogadores_por_time deve ser maior que 0');
  }

  const timesCompletos = Math.floor(totalJogadores / jogadores_por_time);
  const jogadoresNoIncompleto = totalJogadores % jogadores_por_time;
  const temTimeIncompleto = jogadoresNoIncompleto > 0;
  const totalTimes = timesCompletos + (temTimeIncompleto ? 1 : 0);

  // Gera distribuição visual (ex: "5+5+5+3")
  const partes: number[] = Array(timesCompletos).fill(jogadores_por_time);
  if (temTimeIncompleto) {
    partes.push(jogadoresNoIncompleto);
  }
  const distribuicao = partes.join('+');

  return {
    timesCompletos,
    temTimeIncompleto,
    jogadoresNoIncompleto,
    totalTimes,
    distribuicao,
  };
}

/**
 * Obtém o tamanho de um time específico
 * 
 * @param numeroDoTime - Posição do time (0-indexed)
 * @param totalJogadores - Total de jogadores
 * @param jogadores_por_time - Tamanho padrão do time
 * @returns Quantidade de jogadores neste time
 * 
 * @example
 * ```typescript
 * getTamanhoDoTime(0, 18, 5) // 5 (primeiro time completo)
 * getTamanhoDoTime(3, 18, 5) // 3 (time incompleto)
 * ```
 */
export function getTamanhoDoTime(
  numeroDoTime: number,
  totalJogadores: number,
  jogadores_por_time: number
): number {
  const calc = calcularTimes(totalJogadores, jogadores_por_time);

  if (numeroDoTime < calc.timesCompletos) {
    return jogadores_por_time; // Time completo
  }

  if (numeroDoTime === calc.timesCompletos && calc.temTimeIncompleto) {
    return calc.jogadoresNoIncompleto; // Time incompleto
  }

  throw new Error(`Time ${numeroDoTime} não existe (total: ${calc.totalTimes})`);
}

/**
 * Verifica se há times incompletos (útil para validações)
 * 
 * @param totalJogadores - Total de jogadores
 * @param jogadores_por_time - Tamanho padrão do time
 * @returns true se há pelo menos um time incompleto
 * 
 * @example
 * ```typescript
 * temTimesIncompletos(18, 5) // true (3 completos + 1 com 3 jog)
 * temTimesIncompletos(20, 5) // false (4 completos)
 * ```
 */
export function temTimesIncompletos(
  totalJogadores: number,
  jogadores_por_time: number
): boolean {
  return totalJogadores % jogadores_por_time !== 0;
}

/**
 * Verifica se pode jogar (mínimo de jogadores para 1 time completo)
 * 
 * @param totalJogadores - Total de jogadores
 * @param jogadores_por_time - Tamanho padrão do time
 * @returns true se há pelo menos 2 times (um completo ou 2 incompletos)
 * 
 * @example
 * ```typescript
 * podeJogar(10, 5)  // true (2 times completos)
 * podeJogar(7, 5)   // true (1 time completo + 1 com 2)
 * podeJogar(4, 5)   // false (não tem 1 time completo)
 * ```
 */
export function podeJogar(
  totalJogadores: number,
  jogadores_por_time: number
): boolean {
  const calc = calcularTimes(totalJogadores, jogadores_por_time);
  
  // Precisa de pelo menos 2 "unidades" (2 times, mesmo que incompletos)
  // OU 1 time completo + 1 incompleto
  return calc.totalTimes >= 2;
}

/**
 * Calcula quantos times ESTÃO JOGANDO em cada momento
 * Sempre 2: TIME 1 + TIME 2
 * 
 * @returns Sempre 2 (regra de negócio da pelada)
 * 
 * @example
 * ```typescript
 * timesJogando() // 2 (TIME 1 + TIME 2)
 * ```
 */
export function timesJogando(): number {
  return 2; // Uma pelada sempre tem 2 times jogando
}

/**
 * Calcula quantos times ESTÃO NA FILA (esperando para jogar)
 * 
 * @param totalJogadores - Total de jogadores
 * @param jogadores_por_time - Tamanho padrão do time
 * @returns Número de times na fila de espera
 * 
 * @example
 * ```typescript
 * // 20 jogadores, 5 por time
 * // TIME 1 (jogando) + TIME 2 (jogando) + 2 times na fila
 * timesNaFila(20, 5) // 2
 * 
 * // 13 jogadores, 5 por time
 * // TIME 1 (jogando) + TIME 2 (jogando) + 1 incompleto na fila
 * timesNaFila(13, 5) // 1
 * ```
 */
export function timesNaFila(
  totalJogadores: number,
  jogadores_por_time: number
): number {
  const calc = calcularTimes(totalJogadores, jogadores_por_time);
  
  // Total de times - 2 (que estão jogando)
  // Mínimo 0 se não houver fila
  return Math.max(0, calc.totalTimes - 2);
}

/**
 * Analisa COMPLETO o estado de times em um momento específico
 * 
 * @param fila - Array de jogadores
 * @param jogadores_por_time - Tamanho padrão do time
 * @returns Análise detalhada com breakdown por grupo
 * 
 * @example
 * ```typescript
 * const fila = [{...}, {...}, ...] // 18 jogadores
 * analisarEstadoTimes(fila, 5)
 * // {
 * //   total: 18,
 * //   timesCompletos: 3,
 * //   temTimeIncompleto: true,
 * //   jogadoresNoIncompleto: 3,
 * //   totalTimes: 4,
 * //   distribuicao: "5+5+5+3",
 * //   timesJogandoAgora: {
 * //     time1: {count: 5, jogadores: [...]},
 * //     time2: {count: 5, jogadores: [...]}
 * //   },
 * //   timesNaFila: {
 * //     proximo: {count: 5, jogadores: [...]},
 * //     segundo: {count: 3, jogadores: [...]}
 * //   }
 * // }
 * ```
 */
export function analisarEstadoTimes(
  fila: any[],
  jogadores_por_time: number
) {
  const calc = calcularTimes(fila.length, jogadores_por_time);

  const time1 = fila.slice(0, jogadores_por_time);
  const time2 = fila.slice(jogadores_por_time, jogadores_por_time * 2);
  const filaDeEspera = fila.slice(jogadores_por_time * 2);

  // Divide a fila de espera em blocos
  const timesEmEspera = [];
  for (let i = 0; i < filaDeEspera.length; i += jogadores_por_time) {
    const bloco = filaDeEspera.slice(
      i,
      i + jogadores_por_time
    );
    timesEmEspera.push(bloco);
  }

  return {
    total: fila.length,
    ...calc,
    timesJogandoAgora: {
      time1: {
        count: time1.length,
        jogadores: time1,
      },
      time2: {
        count: time2.length,
        jogadores: time2,
      },
    },
    timesNaFila: timesEmEspera.map((time, idx) => ({
      posicao: idx + 1,
      count: time.length,
      nome: idx === 0 ? 'PRÓXIMO TIME' : `TIME +${idx + 1}`,
      jogadores: time,
    })),
  };
}

/**
 * Valida se a fila é válida para começar uma partida
 * 
 * @param totalJogadores - Total de jogadores
 * @param jogadores_por_time - Tamanho padrão do time
 * @param minJogadores - Mínimo de jogadores para começar (padrão: 2 completos)
 * @returns Objeto com validação e mensagem
 * 
 * @example
 * ```typescript
 * validarFilaParaPartida(10, 5) 
 * // { valido: true, mensagem: "Pronto para jogar!" }
 * 
 * validarFilaParaPartida(3, 5)
 * // { valido: false, mensagem: "Precisa de pelo menos 1 time completo (5 jog)" }
 * ```
 */
export function validarFilaParaPartida(
  totalJogadores: number,
  jogadores_por_time: number,
  minJogadores: number = jogadores_por_time
): { valido: boolean; mensagem: string } {
  if (totalJogadores < minJogadores) {
    return {
      valido: false,
      mensagem: `Precisa de pelo menos ${minJogadores} jogadores. Tem ${totalJogadores}.`,
    };
  }

  const calc = calcularTimes(totalJogadores, jogadores_por_time);

  if (!podeJogar(totalJogadores, jogadores_por_time)) {
    return {
      valido: false,
      mensagem: `Precisa de pelo menos 2 times (${calc.distribuicao} é insuficiente)`,
    };
  }

  return {
    valido: true,
    mensagem: `Pronto! ${calc.distribuicao} = ${calc.totalTimes} times (${calc.timesCompletos} completos${calc.temTimeIncompleto ? ' + 1 incompleto' : ''})`,
  };
}
