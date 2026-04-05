/**
 * ========================================
 * FUNÇÕES DE ROTAÇÃO DA FILA
 * ========================================
 * 
 * Este arquivo contém TODAS as funções de rotação, edição e snapshots da fila de jogadores.
 * 
 * IMPORTANTE: Use APENAS estas funções para rotação/edição/snapshots da fila.
 * Não crie funções duplicadas em outros arquivos.
 * 
 * ========================================
 * FUNÇÕES DE ROTAÇÃO (8):
 * ========================================
 * 
 * 1. rotacao_vitoriaconsec_vencedor
 *    → Quando atinge limite 3/3: Vencedor retorna 1º à fila
 * 
 * 2. rotacao_vitoriaconsec_perdedor
 *    → Quando atinge limite 3/3: Perdedor retorna 1º à fila
 * 
 * 3. rotacao_vitoriaconsec_mesclar
 *    → Quando atinge limite 3/3: Times mesclados ao retornar
 * 
 * 4. rotacao_vitoriaconsec_perdedorfica
 *    → Quando atinge limite 3/3: Perdedor continua jogando
 * 
 * 5. rotacaoempate_ambos_desempate
 *    → Empate: Ambos saem, time escolhido retorna 1º
 * 
 * 6. rotacaoempate_ambos_mesclar
 *    → Empate: Ambos saem, times mesclados
 * 
 * 7. rotacaoempate_desempate
 *    → Empate: Time escolhido vira vencedor (continua jogando)
 * 
 * 8. rotacao_fila (PRINCIPAL)
 *    → Gerencia TODAS as rotações, decide qual função usar
 * 
 * ========================================
 * FUNÇÕES DO MODO EDIÇÃO (4):
 * ========================================
 * 
 * 9. fila_remover
 *    → Remove jogador da fila (botão X)
 * 
 * 10. fila_adicionar
 *     → Adiciona jogador de volta à fila (botão +)
 * 
 * 11. fila_mover
 *     → Move jogador para posição específica (click-click)
 * 
 * 12. fila_cadastrarnovo_adicionar
 *     → Cadastra novo jogador e adiciona às reservas
 * 
 * ========================================
 * FUNÇÕES DE SNAPSHOT/DESFAZER (5):
 * ========================================
 * 
 * 13. fila_snapshot_salvar_edicao_temp
 *     → Salva snapshot TEMPORÁRIO ao abrir modo edição
 * 
 * 14. fila_snapshot_confirmar_edicao
 *     → Ao fechar modo edição: compara e decide manter/atualizar snapshot
 * 
 * 15. fila_snapshot_salvar_partida
 *     → Salva snapshot antes de finalizar partida (no modal)
 * 
 * 16. fila_snapshot_restaurar
 *     → Restaura snapshot (edição ou partida) com validação de senha
 * 
 * 17. fila_snapshot_limpar
 *     → Limpa todos os snapshots ao encerrar pelada
 * 
 * ========================================
 */

// === ROTAÇÃO: Vencedor tem prioridade ao retornar ===
export const rotacao_vitoriaconsec_vencedor = (
  time1: any[], 
  time2: any[], 
  espera: any[], 
  timeVencedor: 'A' | 'B' | null, 
  limiteAtingido: boolean
) => {
  if (limiteAtingido) {
    console.log('✅ LIMITE ATINGIDO: Vencedor retorna 1º à fila');
    return [...espera, ...time1, ...time2]; // Espera joga, vencedor volta primeiro
  }
  // Rotação normal
  if (timeVencedor === null) return [...espera, ...time1, ...time2];
  if (timeVencedor === 'B') return [...time2, ...espera, ...time1];
  return [...time1, ...espera, ...time2];
};

// === ROTAÇÃO: Perdedor tem prioridade ao retornar ===
export const rotacao_vitoriaconsec_perdedor = (
  time1: any[], 
  time2: any[], 
  espera: any[], 
  timeVencedor: 'A' | 'B' | null, 
  limiteAtingido: boolean
) => {
  if (limiteAtingido) {
    console.log('✅ LIMITE ATINGIDO: Perdedor retorna 1º à fila');
    return [...espera, ...time2, ...time1]; // Espera joga, perdedor volta primeiro
  }
  // Rotação normal
  if (timeVencedor === null) return [...espera, ...time1, ...time2];
  if (timeVencedor === 'B') return [...time2, ...espera, ...time1];
  return [...time1, ...espera, ...time2];
};

// === ROTAÇÃO: Times são mesclados ao retornar ===
export const rotacao_vitoriaconsec_mesclar = (
  time1: any[], 
  time2: any[], 
  espera: any[], 
  timeVencedor: 'A' | 'B' | null, 
  limiteAtingido: boolean
) => {
  if (limiteAtingido) {
    console.log('✅ LIMITE ATINGIDO: Times mesclados ao retornar (intercalado)');
    // Embaralha cada time entre si
    const t1 = [...time1];
    const t2 = [...time2];
    for (let i = t1.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [t1[i], t1[j]] = [t1[j], t1[i]];
    }
    for (let i = t2.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [t2[i], t2[j]] = [t2[j], t2[i]];
    }
    // Intercala um de cada time
    const intercalados: any[] = [];
    const maior = Math.max(t1.length, t2.length);
    for (let i = 0; i < maior; i++) {
      if (i < t1.length) intercalados.push(t1[i]);
      if (i < t2.length) intercalados.push(t2[i]);
    }
    return [...espera, ...intercalados];
  }
  // Rotação normal
  if (timeVencedor === null) return [...espera, ...time1, ...time2];
  if (timeVencedor === 'B') return [...time2, ...espera, ...time1];
  return [...time1, ...espera, ...time2];
};

// === ROTAÇÃO: Perdedor continua jogando ===
export const rotacao_vitoriaconsec_perdedorfica = (
  time1: any[], 
  time2: any[], 
  espera: any[], 
  timeVencedor: 'A' | 'B' | null, 
  limiteAtingido: boolean
) => {
  if (limiteAtingido) {
    console.log('✅ LIMITE ATINGIDO: Perdedor continua jogando');
    return [...time2, ...espera, ...time1]; // Perdedor fica, vencedor sai
  }
  // Rotação normal
  if (timeVencedor === null) return [...espera, ...time1, ...time2];
  if (timeVencedor === 'B') return [...time2, ...espera, ...time1];
  return [...time1, ...espera, ...time2];
};

// === ROTAÇÃO EMPATE: Ambos saem + Time escolhido retorna primeiro ===
export const rotacaoempate_ambos_desempate = (
  time1: any[], 
  time2: any[], 
  espera: any[], 
  timeEscolhido: 'A' | 'B'
) => {
  console.log('✅ EMPATE - Ambos saem, time escolhido retorna primeiro');
  if (timeEscolhido === 'A') {
    // Time 1 (PRETO) retorna primeiro
    return [...espera, ...time1, ...time2];
  } else {
    // Time 2 (VERMELHO) retorna primeiro
    return [...espera, ...time2, ...time1];
  }
};

// === ROTAÇÃO EMPATE: Ambos saem + Times mesclados ===
export const rotacaoempate_ambos_mesclar = (
  time1: any[], 
  time2: any[], 
  espera: any[]
) => {
  console.log('✅ EMPATE - Ambos saem, times mesclados (intercalado)');
  // Embaralha cada time entre si
  const t1 = [...time1];
  const t2 = [...time2];
  for (let i = t1.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [t1[i], t1[j]] = [t1[j], t1[i]];
  }
  for (let i = t2.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [t2[i], t2[j]] = [t2[j], t2[i]];
  }
  // Intercala um de cada time
  const intercalados: any[] = [];
  const maior = Math.max(t1.length, t2.length);
  for (let i = 0; i < maior; i++) {
    if (i < t1.length) intercalados.push(t1[i]);
    if (i < t2.length) intercalados.push(t2[i]);
  }
  return [...espera, ...intercalados];
};

// === ROTAÇÃO EMPATE: Desempate no final (time escolhido vira vencedor) ===
export const rotacaoempate_desempate = (
  time1: any[], 
  time2: any[], 
  espera: any[], 
  timeEscolhido: 'A' | 'B'
) => {
  console.log('✅ EMPATE - Time escolhido vira vencedor');
  if (timeEscolhido === 'A') {
    // Time 1 vence (continua jogando)
    return [...time1, ...espera, ...time2];
  } else {
    // Time 2 vence (continua jogando)
    return [...time2, ...espera, ...time1];
  }
};

// ========================================
// FUNÇÕES DO MODO EDIÇÃO (TEMPO REAL - LOCALSTORAGE)
// ========================================

/**
 * Remove jogador da fila → status='reserva', posição=999
 * Reorganiza: todos após a posição removida recuam -1
 */
export const fila_remover = (
  jogador: any,
  regras: any,
  setJogadoresJogando: any,
  setJogadoresFila: any,
  setJogadoresReserva: any
) => {
  console.log('🗑️ [REMOVER] Removendo jogador da fila:', jogador.nome);
  
  // Buscar dados do localStorage
  const filaLocal = localStorage.getItem('fila_ativa');
  const fila = filaLocal ? JSON.parse(filaLocal) : [];
  
  // No plano FREE, os dados estão direto na fila com { id, nome, posicao_fila, status }
  const jogadorItem = fila.find((item: any) => item.id === jogador.id || item.nome === jogador.nome);
  const posicaoRemovida = jogadorItem?.posicao_fila;
  
  console.log('📍 Jogador encontrado na posição:', posicaoRemovida);
  
  // 1. Atualizar status do jogador para reserva e posicao_fila para 999
  let filaAtualizada = fila.map((item: any) => 
    (item.id === jogador.id || item.nome === jogador.nome)
      ? { ...item, status: 'reserva', posicao_fila: 999 }
      : item
  );
  
  // 2. Reorganizar posições: todos após a posição removida recuam -1
  if (posicaoRemovida !== undefined) {
    console.log('🔄 Reorganizando posições após', posicaoRemovida);
    filaAtualizada = filaAtualizada.map((item: any) => 
      item.status === 'fila' && item.posicao_fila > posicaoRemovida
        ? { ...item, posicao_fila: item.posicao_fila - 1 }
        : item
    );
  }
  
  // 3. Salvar no localStorage
  localStorage.setItem('fila_ativa', JSON.stringify(filaAtualizada));
  console.log(`✅ ${jogador.nome} movido para reserva (posição 999)`);
  
  // 4. Atualizar UI em tempo real
  const filaItems = filaAtualizada
    .filter((item: any) => item.status === 'fila')
    .sort((a: any, b: any) => a.posicao_fila - b.posicao_fila);
  
  const jogadoresPorTime = regras.jogadores_por_time || 5;
  
  const jogandoTemp = filaItems
    .slice(0, jogadoresPorTime * 2)
    .map((item: any) => ({
      id: item.id || item.nome,
      nome: item.nome,
      nivel: item.nivel || 3,
      posicao_fila: item.posicao_fila,
      status: 'fila' as const
    }));
    
  const emFilaTemp = filaItems
    .slice(jogadoresPorTime * 2)
    .map((item: any) => ({
      id: item.id || item.nome,
      nome: item.nome,
      nivel: item.nivel || 3,
      posicao_fila: item.posicao_fila,
      status: 'fila' as const
    }));
    
  const reservaItems = filaAtualizada
    .filter((item: any) => item.status === 'reserva')
    .map((item: any) => ({
      id: item.id || item.nome,
      nome: item.nome,
      nivel: item.nivel || 3,
      posicao_fila: item.posicao_fila,
      status: 'reserva' as const
    }));
  
  setJogadoresJogando(jogandoTemp);
  setJogadoresFila(emFilaTemp);
  setJogadoresReserva(reservaItems);
  
  console.log('✅ UI atualizada em tempo real -', 
    'jogando:', jogandoTemp.length, 
    'fila:', emFilaTemp.length, 
    'reserva:', reservaItems.length);
};

/**
 * Adiciona jogador de volta à fila
 * Coloca no final: posição = (maior posição atual + 1)
 */
export const fila_adicionar = (
  jogador: any,
  regras: any,
  setJogadoresJogando: any,
  setJogadoresFila: any,
  setJogadoresReserva: any
) => {
  console.log('⬅️ [ADICIONAR] Adicionando jogador na fila:', jogador.nome);
  
  // Buscar dados do localStorage
  const filaLocal = localStorage.getItem('fila_ativa');
  const fila = filaLocal ? JSON.parse(filaLocal) : [];
  
  // 1. Encontrar a maior posicao_fila atual
  const filaStatus = fila.filter((item: any) => item.status === 'fila');
  const maiorPosicao = filaStatus.length > 0 
    ? Math.max(...filaStatus.map((item: any) => item.posicao_fila))
    : 0;
  const proximaPosicao = maiorPosicao + 1;
  
  console.log(`📍 Maior posição: ${maiorPosicao}, adicionando na: ${proximaPosicao}`);
  
  // 2. Atualizar status do jogador para fila e posicao_fila = max + 1
  const filaAtualizada = fila.map((item: any) => 
    (item.id === jogador.id || item.nome === jogador.nome)
      ? { ...item, status: 'fila', posicao_fila: proximaPosicao }
      : item
  );
  
  // 3. Salvar no localStorage
  localStorage.setItem('fila_ativa', JSON.stringify(filaAtualizada));
  console.log(`✅ ${jogador.nome} voltou para a fila na posição ${proximaPosicao}`);
  
  // 4. Atualizar UI em tempo real
  const filaItems = filaAtualizada
    .filter((item: any) => item.status === 'fila')
    .sort((a: any, b: any) => a.posicao_fila - b.posicao_fila);
  
  const jogadoresPorTime = regras.jogadores_por_time || 5;
  
  const jogandoTemp = filaItems
    .slice(0, jogadoresPorTime * 2)
    .map((item: any) => ({
      id: item.id || item.nome,
      nome: item.nome,
      nivel: item.nivel || 3,
      posicao_fila: item.posicao_fila,
      status: 'fila' as const
    }));
    
  const emFilaTemp = filaItems
    .slice(jogadoresPorTime * 2)
    .map((item: any) => ({
      id: item.id || item.nome,
      nome: item.nome,
      nivel: item.nivel || 3,
      posicao_fila: item.posicao_fila,
      status: 'fila' as const
    }));
    
  const reservaItems = filaAtualizada
    .filter((item: any) => item.status === 'reserva')
    .map((item: any) => ({
      id: item.id || item.nome,
      nome: item.nome,
      nivel: item.nivel || 3,
      posicao_fila: item.posicao_fila,
      status: 'reserva' as const
    }));
  
  setJogadoresJogando(jogandoTemp);
  setJogadoresFila(emFilaTemp);
  setJogadoresReserva(reservaItems);
  
  console.log('✅ UI atualizada em tempo real -', 
    'jogando:', jogandoTemp.length, 
    'fila:', emFilaTemp.length, 
    'reserva:', reservaItems.length);
};

/**
 * Move jogador para posição específica
 * Todos após essa posição avançam +1
 */
export const fila_mover = (
  jogador: any,
  novaPosicao: number,
  regras: any,
  setJogadoresJogando: any,
  setJogadoresFila: any
) => {
  try {
    console.log('🔄 [MOVER] Movendo jogador para nova posição:', {
      jogador: jogador.nome,
      posicaoAtual: jogador.posicao_fila,
      novaPosicao
    });

    // Buscar dados do localStorage
    const filaLocal = localStorage.getItem('fila_ativa');
    const fila = filaLocal ? JSON.parse(filaLocal) : [];
    
    // 1. Separar jogadores em fila e ordenar
    const todosJogadores = fila
      .filter((item: any) => item.status === 'fila')
      .sort((a: any, b: any) => a.posicao_fila - b.posicao_fila);
    
    // 2. Remover o jogador que está sendo movido (usar id ou nome como fallback)
    const jogadoresSemOMover = todosJogadores.filter((j: any) => 
      j.id !== jogador.id && j.nome !== jogador.nome
    );
    
    // 3. Reorganizar posições: inserir jogador na nova posição
    const novaLista: any[] = [];
    let posicaoAtual = 1;
    
    for (let i = 0; i < jogadoresSemOMover.length + 1; i++) {
      if (posicaoAtual === novaPosicao) {
        // Inserir jogador movido na posição desejada
        novaLista.push({
          id: jogador.id || jogador.nome,
          nome: jogador.nome,
          nivel: jogador.nivel || 3,
          status: 'fila',
          posicao_fila: posicaoAtual
        });
        posicaoAtual++;
      }
      
      if (i < jogadoresSemOMover.length) {
        // Os demais jogadores avançam +1
        novaLista.push({
          ...jogadoresSemOMover[i],
          posicao_fila: posicaoAtual
        });
        posicaoAtual++;
      }
    }
    
    // 4. Atualizar fila completa no localStorage
    const filaAtualizada = fila.map((item: any) => {
      if (item.status !== 'fila') return item;
      const novoItem = novaLista.find((n: any) => 
        n.id === item.id || n.nome === item.nome
      );
      return novoItem ? { ...item, posicao_fila: novoItem.posicao_fila } : item;
    });
    
    localStorage.setItem('fila_ativa', JSON.stringify(filaAtualizada));
    console.log(`✅ ${jogador.nome} movido para posição ${novaPosicao}`);
    
    // 5. Atualizar UI em tempo real
    const filaItems = filaAtualizada
      .filter((item: any) => item.status === 'fila')
      .sort((a: any, b: any) => a.posicao_fila - b.posicao_fila);
    
    const jogadoresPorTime = regras.jogadores_por_time || 5;
    
    const jogando = filaItems
      .slice(0, jogadoresPorTime * 2)
      .map((item: any) => ({
        id: item.id || item.nome,
        nome: item.nome,
        nivel: item.nivel || 3,
        posicao_fila: item.posicao_fila,
        status: 'fila' as const
      }));
      
    const emFila = filaItems
      .slice(jogadoresPorTime * 2)
      .map((item: any) => ({
        id: item.id || item.nome,
        nome: item.nome,
        nivel: item.nivel || 3,
        posicao_fila: item.posicao_fila,
        status: 'fila' as const
      }));
    
    setJogadoresJogando(jogando);
    setJogadoresFila(emFila);
    
    console.log('✅ UI atualizada - jogando:', jogando.length, 'fila:', emFila.length);
    
  } catch (error) {
    console.error('❌ Erro ao mover jogador:', error);
  }
};

/**
 * Cadastra novo jogador e adiciona às reservas
 * Valida nome duplicado e salva para sync (Gold/Premium)
 */
export interface ResultadoCadastroFila {
  sucesso: boolean;
  jogadorId?: string;
  reativado?: boolean;
  criadoNovo?: boolean;
}

export const fila_cadastrarnovo_adicionar = (
  nome: string,
  nivel: number,
  peladaId: string,
  setJogadoresReserva: any,
  onSuccess: () => void
): ResultadoCadastroFila => {
  try {
    console.log('🆕 [CADASTRAR] Cadastrando/reativando jogador:', nome);

    const normalizarNome = (valor: string) =>
      String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
    
    // 1. Validar nome não vazio
    if (!nome.trim()) {
      alert('❌ Digite o nome do jogador!');
      return { sucesso: false };
    }

    const nomeNormalizado = normalizarNome(nome);

    // 2. Buscar fila atual do localStorage
    const filaLocal = localStorage.getItem('fila_ativa');
    const fila = filaLocal ? JSON.parse(filaLocal) : [];
    const jogadoresKey = `jogadores_${peladaId}`;
    const jogadoresStr = localStorage.getItem(jogadoresKey);
    const jogadores = jogadoresStr ? JSON.parse(jogadoresStr) : [];

    const jogadorExistente = jogadores.find((j: any) =>
      normalizarNome(j.nome) === nomeNormalizado
    );

    const itemExistenteNaFila = fila.find((item: any) =>
      normalizarNome(item.nome) === nomeNormalizado ||
      (jogadorExistente && item.id === jogadorExistente.id)
    );

    // 3A. Já existe na sessão atual: não cadastrar novamente
    if (itemExistenteNaFila) {
      const statusAtual = (jogadorExistente?.status || 'ativo').toLowerCase();
      if (statusAtual === 'inativo') {
        const confirmarReativacao = window.confirm(
          `Já existe um ${jogadorExistente?.nome || nome.trim()} cadastrado INATIVO. Deseja reativá-lo?`
        );

        if (!confirmarReativacao) {
          return { sucesso: false };
        }

        const jogadoresAtualizados = jogadores.map((j: any) =>
          normalizarNome(j.nome) === nomeNormalizado
            ? { ...j, status: 'ativo' }
            : j
        );
        localStorage.setItem(jogadoresKey, JSON.stringify(jogadoresAtualizados));
        alert('✅ Jogador reativado com sucesso!');
        onSuccess();
        return {
          sucesso: true,
          jogadorId: jogadorExistente?.id,
          reativado: true,
          criadoNovo: false,
        };
      }

      alert('❌ Já existe um jogador com esse nome na sessão atual!');
      return { sucesso: false };
    }
    
    // 3B. Já existe no cadastro geral: reaproveitar cadastro (sem criar duplicado)
    if (jogadorExistente) {
      const statusAtual = (jogadorExistente.status || 'ativo').toLowerCase();
      const ehInativo = statusAtual === 'inativo';

      if (ehInativo) {
        const confirmarReativacao = window.confirm(
          `Já existe um ${jogadorExistente.nome} cadastrado INATIVO. Deseja reativá-lo e adicionar à fila?`
        );

        if (!confirmarReativacao) {
          return { sucesso: false };
        }
      } else {
        const confirmarAdicionar = window.confirm(
          `Já existe um ${jogadorExistente.nome} cadastrado. Deseja adicionar este cadastro à fila?`
        );

        if (!confirmarAdicionar) {
          return { sucesso: false };
        }
      }

      fila.push({
        id: jogadorExistente.id,
        nome: jogadorExistente.nome,
        nivel: jogadorExistente.nivel || nivel,
        status: 'reserva',
        posicao_fila: 999,
      });
      localStorage.setItem('fila_ativa', JSON.stringify(fila));

      if (ehInativo) {
        const jogadoresAtualizados = jogadores.map((j: any) =>
          normalizarNome(j.nome) === nomeNormalizado
            ? { ...j, status: 'ativo' }
            : j
        );
        localStorage.setItem(jogadoresKey, JSON.stringify(jogadoresAtualizados));
      }

      const reservaItems = fila
        .filter((item: any) => item.status === 'reserva')
        .map((item: any) => ({
          id: item.id || item.nome,
          nome: item.nome,
          nivel: item.nivel || 3,
          posicao_fila: item.posicao_fila,
          status: 'reserva' as const
        }));

      setJogadoresReserva(reservaItems);
      onSuccess();

      return {
        sucesso: true,
        jogadorId: jogadorExistente.id,
        reativado: ehInativo,
        criadoNovo: false,
      };
    }
    
    // 4. Gerar UUID válido (compatível com Supabase)
    const gerarUUID = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };
    const novoId = gerarUUID();
    
    // 5. Criar novo jogador
    const nomeFinal = nome.trim();
    const novoJogador = {
      id: novoId,
      nome: nomeFinal,
      nivel: nivel,
      status: 'reserva' as const,
      posicao_fila: 999
    };
    
    console.log('➕ Adicionando jogador:', novoJogador);
    
    // 6. Adicionar à fila
    fila.push(novoJogador);
    localStorage.setItem('fila_ativa', JSON.stringify(fila));
    
    jogadores.push({
      id: novoId,
      nome: nomeFinal,
      nivel: nivel,
      pelada_id: peladaId,
      status: 'ativo',
      created_at: new Date().toISOString()
    });
    
    localStorage.setItem(jogadoresKey, JSON.stringify(jogadores));
    console.log(`✅ Jogador adicionado à tabela jogadores_${peladaId}`);
    
    // 8. Atualizar UI em tempo real
    const reservaItems = fila
      .filter((item: any) => item.status === 'reserva')
      .map((item: any) => ({
        id: item.id || item.nome,
        nome: item.nome,
        nivel: item.nivel || 3,
        posicao_fila: item.posicao_fila,
        status: 'reserva' as const
      }));
    
    setJogadoresReserva(reservaItems);
    
    console.log('✅ Novo jogador cadastrado nas reservas!', {
      total_reserva: reservaItems.length,
      nome: nomeFinal
    });
    
    // 9. Callback de sucesso
    onSuccess();
    
    return {
      sucesso: true,
      jogadorId: novoId,
      reativado: false,
      criadoNovo: true,
    };
    
  } catch (error) {
    console.error('❌ Erro ao cadastrar jogador:', error);
    alert('❌ Erro inesperado ao cadastrar jogador!');
    return { sucesso: false };
  }
};

// ========================================
// FUNÇÕES DE SNAPSHOT/DESFAZER
// ========================================

/**
 * 13. Salvar snapshot TEMPORÁRIO ao abrir modo edição
 * 
 * Salva o estado atual da fila em um snapshot temporário.
 * Este snapshot NÃO sobrescreve o oficial até ser confirmado.
 * 
 * @param peladaId - ID da pelada
 * @returns boolean - Sucesso ou falha
 */
export const fila_snapshot_salvar_edicao_temp = (peladaId: string): boolean => {
  try {
    console.log('📸 [SNAPSHOT TEMP] Salvando snapshot TEMPORÁRIO de edição...');
    
    // Buscar fila atual do localStorage
    const filaAtivaStr = localStorage.getItem('fila_ativa');
    if (!filaAtivaStr) {
      console.warn('⚠️ [SNAPSHOT TEMP] Fila ativa não encontrada no localStorage');
      return false;
    }
    
    const filaAtiva = JSON.parse(filaAtivaStr);
    console.log('📸 [SNAPSHOT TEMP] Fila a ser salva:', filaAtiva.filter((j: any) => j.status === 'fila').map((j: any) => `${j.nome}(${j.posicao_fila})`));
    
    // Criar snapshot temporário
    const snapshot = {
      tipo: 'edicao',
      timestamp: new Date().toISOString(),
      fila: filaAtiva
    };
    
    // Salvar como temporário
    const keyTemp = `fila_snapshot_edicao_temp_${peladaId}`;
    localStorage.setItem(keyTemp, JSON.stringify(snapshot));
    
    console.log('✅ [SNAPSHOT TEMP] Snapshot temporário salvo:', snapshot.timestamp);
    console.log('📸 [SNAPSHOT TEMP] Key usada:', keyTemp);
    return true;
    
  } catch (error) {
    console.error('❌ [SNAPSHOT TEMP] Erro ao salvar snapshot temporário:', error);
    return false;
  }
};

/**
 * 14. Confirmar ou descartar snapshot de edição ao fechar modo edição
 * 
 * Compara fila atual com snapshot temporário.
 * - Se houver alterações: Confirma temp como oficial (SOBRESCREVE snapshot anterior)
 * - Se NÃO houver alterações: Descarta temp (mantém oficial intacto)
 * 
 * IMPORTANTE: Apenas 1 snapshot de edição é mantido por vez (o mais recente)
 * 
 * @param peladaId - ID da pelada
 * @returns string - 'confirmado' | 'descartado' | 'erro'
 */
export const fila_snapshot_confirmar_edicao = (peladaId: string): string => {
  try {
    console.log('🔍 [CONFIRMAR SNAPSHOT] Verificando alterações no modo edição...');
    console.log('🔍 [CONFIRMAR SNAPSHOT] peladaId:', peladaId);
    
    const keyTemp = `fila_snapshot_edicao_temp_${peladaId}`;
    const keyOficial = `fila_snapshot_edicao_${peladaId}`;
    
    console.log('🔍 [CONFIRMAR SNAPSHOT] Buscando key temp:', keyTemp);
    const snapshotTempStr = localStorage.getItem(keyTemp);
    
    if (!snapshotTempStr) {
      console.warn('⚠️ [CONFIRMAR SNAPSHOT] Snapshot temporário não encontrado');
      return 'erro';
    }
    
    const snapshotTemp = JSON.parse(snapshotTempStr);
    console.log('📸 [CONFIRMAR SNAPSHOT] Snapshot temp timestamp:', snapshotTemp.timestamp);
    console.log('📸 [CONFIRMAR SNAPSHOT] Fila no temp:', snapshotTemp.fila.filter((j: any) => j.status === 'fila').map((j: any) => `${j.nome}(${j.posicao_fila})`));
    
    // Buscar fila atual
    const filaAtivaStr = localStorage.getItem('fila_ativa');
    if (!filaAtivaStr) {
      console.warn('⚠️ [CONFIRMAR SNAPSHOT] Fila ativa não encontrada');
      return 'erro';
    }
    
    const filaAtual = JSON.parse(filaAtivaStr);
    console.log('📋 [CONFIRMAR SNAPSHOT] Fila atual:', filaAtual.filter((j: any) => j.status === 'fila').map((j: any) => `${j.nome}(${j.posicao_fila})`));
    
    // Comparar fila atual com snapshot temp
    const tempString = JSON.stringify(snapshotTemp.fila);
    const atualString = JSON.stringify(filaAtual);
    const houveAlteracoes = tempString !== atualString;
    
    console.log('🔍 [CONFIRMAR SNAPSHOT] Houve alterações?', houveAlteracoes);
    
    if (houveAlteracoes) {
      // CONFIRMAR: Temp vira oficial (sobrescreve anterior)
      console.log('✅ [CONFIRMAR SNAPSHOT] Alterações detectadas - Confirmando snapshot');
      console.log('✅ [CONFIRMAR SNAPSHOT] Salvando em key oficial:', keyOficial);
      localStorage.setItem(keyOficial, snapshotTempStr);
      
      // Deletar temp
      localStorage.removeItem(keyTemp);
      console.log('🗑️ [CONFIRMAR SNAPSHOT] Temp removido');
      
      return 'confirmado';
      
    } else {
      // DESCARTAR: Remove temp, mantém oficial intacto
      console.log('🔄 [CONFIRMAR SNAPSHOT] Nenhuma alteração - Descartando snapshot temp (oficial preservado)');
      localStorage.removeItem(keyTemp);
      
      return 'descartado';
    }
    
  } catch (error) {
    console.error('❌ [CONFIRMAR SNAPSHOT] Erro ao confirmar/descartar snapshot:', error);
    return 'erro';
  }
};

/**
 * 15. Salvar snapshot ANTES de finalizar partida
 * 
 * Salva o estado atual da fila no momento do MODAL de confirmação.
 * Este é o último momento para capturar a fila ANTES do resultado.
 * 
 * IMPORTANTE: Apenas 1 snapshot de partida é mantido por vez (SOBRESCREVE anterior)
 * 
 * @param peladaId - ID da pelada
 * @returns boolean - Sucesso ou falha
 */
export const fila_snapshot_salvar_partida = (peladaId: string): boolean => {
  try {
    console.log('📸 Salvando snapshot de partida...');
    
    // Buscar fila atual do localStorage
    const filaAtivaStr = localStorage.getItem('fila_ativa');
    if (!filaAtivaStr) {
      console.warn('⚠️ Fila ativa não encontrada no localStorage');
      return false;
    }
    
    const filaAtiva = JSON.parse(filaAtivaStr);
    
    // Criar snapshot
    const snapshot = {
      tipo: 'partida',
      timestamp: new Date().toISOString(),
      fila: filaAtiva
    };
    
    // Salvar (sobrescreve snapshot anterior de partida)
    const key = `fila_snapshot_partida_${peladaId}`;
    localStorage.setItem(key, JSON.stringify(snapshot));
    
    console.log('✅ Snapshot de partida salvo:', snapshot.timestamp);
    return true;
    
  } catch (error) {
    console.error('❌ Erro ao salvar snapshot de partida:', error);
    return false;
  }
};

/**
 * 16. Restaurar snapshot (edição ou partida)
 * 
 * Restaura a fila para o estado do snapshot escolhido.
 * IMPORTANTE: 
 * - Validação de senha deve ser feita ANTES de chamar esta função
 * - O snapshot é APAGADO após restaurar (comportamento "consumir e liberar")
 * - Isso permite um sistema em cascata: desfaz edição → sobra partida → desfaz partida → fim
 * 
 * @param peladaId - ID da pelada
 * @param tipo - 'edicao' ou 'partida'
 * @returns boolean - Sucesso ou falha
 */
export const fila_snapshot_restaurar = (peladaId: string, tipo: 'edicao' | 'partida'): boolean => {
  try {
    console.log(`🔄 [RESTAURAR] Restaurando snapshot de ${tipo}...`);
    console.log(`🔄 [RESTAURAR] peladaId:`, peladaId);
    
    // Buscar snapshot
    const key = `fila_snapshot_${tipo}_${peladaId}`;
    console.log(`🔄 [RESTAURAR] Buscando key:`, key);
    const snapshotStr = localStorage.getItem(key);
    
    if (!snapshotStr) {
      console.error(`❌ [RESTAURAR] Snapshot de ${tipo} não encontrado na key: ${key}`);
      alert(`❌ Snapshot de ${tipo} não encontrado!`);
      return false;
    }
    
    const snapshot = JSON.parse(snapshotStr);
    console.log('📸 [RESTAURAR] Snapshot encontrado, timestamp:', snapshot.timestamp);
    console.log('📸 [RESTAURAR] Fila no snapshot:', snapshot.fila.filter((j: any) => j.status === 'fila').map((j: any) => `${j.nome}(${j.posicao_fila})`));
    
    // Validar snapshot
    if (!snapshot.fila || snapshot.fila.length === 0) {
      console.error('❌ [RESTAURAR] Snapshot está vazio!');
      alert('❌ Snapshot está vazio! Não é possível restaurar.');
      return false;
    }
    
    console.log('📊 [RESTAURAR] Restaurando fila do snapshot...');
    
    // Restaurar fila
    localStorage.setItem('fila_ativa', JSON.stringify(snapshot.fila));
    console.log('✅ [RESTAURAR] fila_ativa atualizada');
    
    // SEMPRE apagar snapshot após restaurar (tanto edição quanto partida)
    // Isso libera o próximo snapshot na fila de desfazer
    console.log(`🗑️ [RESTAURAR] Limpando snapshot de ${tipo} após restauração`);
    localStorage.removeItem(key);
    
    console.log('✅ [RESTAURAR] Fila restaurada com sucesso!');
    return true;
    
  } catch (error) {
    console.error('❌ [RESTAURAR] Erro ao restaurar snapshot:', error);
    alert('❌ Erro ao restaurar fila!');
    return false;
  }
};

/**
 * 17. Limpar todos os snapshots ao encerrar pelada
 * 
 * Remove todos os snapshots (temp, oficial e partida) do localStorage.
 * 
 * @param peladaId - ID da pelada
 */
export const fila_snapshot_limpar = (peladaId: string): void => {
  try {
    console.log('🗑️ Limpando todos os snapshots...');
    
    const keys = [
      `fila_snapshot_edicao_temp_${peladaId}`,
      `fila_snapshot_edicao_${peladaId}`,
      `fila_snapshot_partida_${peladaId}`
    ];
    
    keys.forEach(key => {
      localStorage.removeItem(key);
    });
    
    console.log('✅ Snapshots limpos!');
    
  } catch (error) {
    console.error('❌ Erro ao limpar snapshots:', error);
  }
};
