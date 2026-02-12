/**
 * Sync Service - Gerencia sincronização de dados entre localStorage e Supabase
 * Permite funcionamento offline com sync automático quando volta online
 */

import { supabase, getClienteSupabase } from './supabase';
import { isOnline } from './cacheService';
import { logger } from './logger';

export interface SyncQueueItem {
  id: string;
  tipo: 'criar_jogador' | 'atualizar_jogador' | 'excluir_jogador' | 
        'atualizar_fila' | 'inserir_jogo' | 'inserir_gols' | 'inserir_assistencias' |
        'atualizar_regras' | 'finalizar_sessao';
  timestamp: number;
  tentativas: number;
  // Campos específicos por tipo
  pelada_id?: string;
  jogador_id?: string;
  sessao_id?: string;
  jogo_id?: string;
  dados: any;
}

const SYNC_QUEUE_KEY = 'fila_sincronizacao';
const MAX_TENTATIVAS = 3;

/**
 * Adiciona item à fila de sincronização
 */
export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'tentativas' | 'timestamp'>): Promise<void> {
  const queue = getSyncQueue();
  
  const newItem: SyncQueueItem = {
    ...item,
    id: `sync_${Date.now()}_${Math.random()}`,
    timestamp: Date.now(),
    tentativas: 0
  };
  
  queue.push(newItem);
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  
  logger.log('📝 Adicionado à fila de sync:', newItem.tipo);
  
  // Tenta sincronizar imediatamente se estiver online
  if (isOnline()) {
    await syncQueue();
  }
}

/**
 * Retorna fila de sincronização
 */
export function getSyncQueue(): SyncQueueItem[] {
  const queueStr = localStorage.getItem(SYNC_QUEUE_KEY);
  return queueStr ? JSON.parse(queueStr) : [];
}

/**
 * Sincroniza fila de itens pendentes (versão transacional)
 * Retorna mapeamento de IDs locais → IDs reais
 */
export async function syncQueueTransacional(peladaId: string, sessaoId: string): Promise<{
  sucesso: boolean;
  idMap: Map<string, string>;
  erro?: string;
}> {
  if (!isOnline()) {
    return { sucesso: false, idMap: new Map(), erro: 'Sem conexão com internet' };
  }
  
  const queue = getSyncQueue();
  
  if (queue.length === 0) {
    logger.log('✅ Fila de sincronização vazia');
    return { sucesso: true, idMap: new Map() };
  }
  
  logger.log(`🔄 Sincronização transacional: ${queue.length} itens...`);
  
  const idMap = new Map<string, string>();
  const queueBackup = JSON.parse(JSON.stringify(queue)); // Backup para rollback
  
  try {
    // Processar todos os itens em ORDEM
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      
      logger.log(`  [${i + 1}/${queue.length}] Processando: ${item.tipo}`);
      
      const resultado = await syncItemComRetorno(item, peladaId);
      
      // Se criar jogador, mapear ID local → ID real
      if (item.tipo === 'criar_jogador' && resultado.id) {
        const idLocal = item.dados.id || item.dados._tempId;
        if (idLocal && idLocal.startsWith('local_')) {
          idMap.set(idLocal, resultado.id);
          logger.log(`    Mapeado: ${idLocal} → ${resultado.id}`);
        }
      }
    }
    
    // Se chegou aqui, TUDO deu certo! ✅
    logger.log(`✅ Sincronização transacional completa: ${queue.length} itens, ${idMap.size} IDs mapeados`);
    
    // Limpar fila de sincronização
    localStorage.removeItem(SYNC_QUEUE_KEY);
    
    return { sucesso: true, idMap };
    
  } catch (error: any) {
    // ROLLBACK: restaurar fila original
    logger.error('❌ Erro na sincronização transacional - fazendo rollback:', error);
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queueBackup));
    
    return { 
      sucesso: false, 
      idMap: new Map(), 
      erro: error.message || 'Erro desconhecido' 
    };
  }
}

/**
 * Sincroniza fila de itens pendentes (versão antiga - mantida para compatibilidade)
 */
export async function syncQueue(): Promise<boolean> {
  if (!isOnline()) {
    logger.log('⚠️ Offline - aguardando conexão para sincronizar');
    return false;
  }
  
  const queue = getSyncQueue();
  
  if (queue.length === 0) {
    logger.log('✅ Fila de sincronização vazia');
    return true;
  }
  
  logger.log(`🔄 Sincronizando ${queue.length} itens...`);
  
  let sucessos = 0;
  let falhas = 0;
  
  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    
    try {
      await syncItem(item);
      
      // Remove da fila
      queue.splice(i, 1);
      i--; // Ajusta índice após remoção
      
      sucessos++;
      logger.log(`✅ Sincronizado: ${item.tipo}`);
      
    } catch (error) {
      logger.error(`❌ Erro ao sincronizar ${item.tipo}:`, error);
      
      // Incrementa tentativas
      item.tentativas++;
      
      // Se excedeu max tentativas, remove
      if (item.tentativas >= MAX_TENTATIVAS) {
        logger.error(`🚫 Item removido após ${MAX_TENTATIVAS} tentativas:`, item.tipo);
        queue.splice(i, 1);
        i--;
      }
      
      falhas++;
    }
  }
  
  // Atualiza fila
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  
  logger.log(`📊 Sincronização: ${sucessos} sucessos, ${falhas} falhas, ${queue.length} pendentes`);
  
  return queue.length === 0;
}

/**
 * Sincroniza um item específico (versão com retorno de dados)
 */
async function syncItemComRetorno(item: SyncQueueItem, peladaId: string): Promise<any> {
  switch (item.tipo) {
    case 'criar_jogador':
      return await syncCriarJogadorComRetorno(item, peladaId);
      
    case 'atualizar_jogador':
      await syncAtualizarJogador(item);
      return {};
      
    case 'excluir_jogador':
      await syncExcluirJogador(item);
      return {};
      
    case 'inserir_jogo':
      return await syncInserirJogoComRetorno(item, peladaId);
      
    case 'inserir_gols':
      await syncInserirGols(item);
      return {};
      
    case 'inserir_assistencias':
      await syncInserirAssistencias(item);
      return {};
      
    case 'atualizar_fila':
      await syncAtualizarFila(item);
      return {};
      
    case 'finalizar_sessao':
      await syncFinalizarSessao(item);
      return {};
      
    default:
      throw new Error(`Tipo de sync desconhecido: ${(item as any).tipo}`);
  }
}

/**
 * Sincroniza um item específico (versão antiga - sem retorno)
 */
async function syncItem(item: SyncQueueItem): Promise<void> {
  switch (item.tipo) {
    case 'criar_jogador':
      await syncCriarJogador(item.dados);
      break;
      
    case 'atualizar_jogador':
      await syncAtualizarJogador(item.dados);
      break;
      
    case 'excluir_jogador':
      await syncExcluirJogador(item.dados);
      break;
      
    case 'inserir_jogo':
      await syncInserirJogo(item.dados);
      break;
      
    case 'inserir_gols':
      await syncInserirGols(item.dados);
      break;
      
    case 'inserir_assistencias':
      await syncInserirAssistencias(item.dados);
      break;
      
    case 'atualizar_fila':
      await syncAtualizarFila(item.dados);
      break;
      
    case 'finalizar_sessao':
      await syncFinalizarSessao(item.dados);
      break;
      
    default:
      throw new Error(`Tipo de sync desconhecido: ${item.tipo}`);
  }
}

/**
 * Funções de sincronização específicas (versão com retorno)
 */
async function syncCriarJogadorComRetorno(item: SyncQueueItem, peladaId: string): Promise<{ id: string }> {
  const { dados } = item;
  const { id, _tempId, _pendente_sync, ...jogadorData } = dados;
  
  // Remover id se for local (começa com 'local_')
  const insertData = id && id.startsWith('local_') 
    ? { ...jogadorData, pelada_id: peladaId }
    : { ...jogadorData, id, pelada_id: peladaId };
  
  const clienteDb = await getClienteSupabase(peladaId);
  const { data, error } = await clienteDb
    .from('jogadores')
    .insert([insertData])
    .select()
    .single();
  
  if (error) throw error;
  return { id: data.id };
}

async function syncInserirJogoComRetorno(item: SyncQueueItem, peladaId: string): Promise<{ id: string }> {
  const { sessao_id, dados } = item;
  const { id, ...jogoData } = dados;
  
  // Remover id se for local
  const insertData = id && id.startsWith('local_')
    ? { ...jogoData, sessao_id }
    : { ...jogoData, id, sessao_id };
  
  const clienteDb = await getClienteSupabase(peladaId);
  const { data, error } = await clienteDb
    .from('jogos')
    .insert([insertData])
    .select()
    .single();
  
  if (error) throw error;
  return { id: data.id };
}

/**
 * Funções de sincronização específicas (versão antiga - sem retorno)
 */
async function syncCriarJogador(item: SyncQueueItem): Promise<void> {
  const { pelada_id, dados } = item;
  const { id, _tempId, _pendente_sync, ...jogadorData } = dados;
  
  // Remover id se for local (começa com 'local_')
  const insertData = id && id.startsWith('local_') 
    ? { ...jogadorData, pelada_id }
    : { ...jogadorData, id, pelada_id };
  
  const clienteDb = await getClienteSupabase(pelada_id);
  const { error } = await clienteDb
    .from('jogadores')
    .insert([insertData]);
  
  if (error) throw error;
}

async function syncAtualizarJogador(item: SyncQueueItem): Promise<void> {
  const { jogador_id, pelada_id, dados } = item;
  
  if (!pelada_id) throw new Error('pelada_id é obrigatório para sync de jogador');
  
  const clienteDb = await getClienteSupabase(pelada_id);
  
  // Se são incrementos, buscar valores atuais primeiro
  if (dados.jogos_increment || dados.vitorias_increment || dados.gols_increment) {
    const { data: jogadorAtual } = await clienteDb
      .from('jogadores')
      .select('jogos, vitorias, gols')
      .eq('id', jogador_id)
      .single();
    
    const updates = {
      jogos: (jogadorAtual?.jogos || 0) + (dados.jogos_increment || 0),
      vitorias: (jogadorAtual?.vitorias || 0) + (dados.vitorias_increment || 0),
      gols: (jogadorAtual?.gols || 0) + (dados.gols_increment || 0)
    };
    
    const { error } = await clienteDb
      .from('jogadores')
      .update(updates)
      .eq('id', jogador_id);
    
    if (error) throw error;
  } else {
    // Atualização normal
    const { error } = await clienteDb
      .from('jogadores')
      .update(dados)
      .eq('id', jogador_id);
    
    if (error) throw error;
  }
}

async function syncExcluirJogador(item: SyncQueueItem): Promise<void> {
  const { jogador_id, pelada_id } = item;
  
  if (!pelada_id) throw new Error('pelada_id é obrigatório para sync de jogador');
  
  const clienteDb = await getClienteSupabase(pelada_id);
  const { error } = await clienteDb
    .from('jogadores')
    .delete()
    .eq('id', jogador_id);
  
  if (error) throw error;
}

async function syncInserirJogo(item: SyncQueueItem): Promise<void> {
  const { sessao_id, pelada_id, dados } = item;
  const { id, ...jogoData } = dados;
  
  if (!pelada_id) throw new Error('pelada_id é obrigatório para sync de jogo');
  
  // Remover id se for local
  const insertData = id && id.startsWith('local_')
    ? { ...jogoData, sessao_id }
    : { ...jogoData, id, sessao_id };
  
  const clienteDb = await getClienteSupabase(pelada_id);
  const { error } = await clienteDb
    .from('jogos')
    .insert([insertData]);
  
  if (error) throw error;
}

async function syncInserirGols(item: SyncQueueItem): Promise<void> {
  const { jogo_id, pelada_id, dados } = item;
  
  if (!pelada_id) throw new Error('pelada_id é obrigatório para sync de gol');
  
  // O jogo_id pode ser local, então precisamos buscar o jogo real
  // Por enquanto, vamos inserir direto
  const clienteDb = await getClienteSupabase(pelada_id);
  const { error } = await clienteDb
    .from('gols')
    .insert([{ ...dados, jogo_id }]);
  
  if (error) throw error;
}

async function syncInserirAssistencias(item: SyncQueueItem): Promise<void> {
  const { jogo_id, pelada_id, dados } = item;
  
  if (!pelada_id) throw new Error('pelada_id é obrigatório para sync de assistência');
  
  // O jogo_id pode ser local, então precisamos buscar o jogo real
  // Por enquanto, vamos inserir direto
  const clienteDb = await getClienteSupabase(pelada_id);
  const { error } = await clienteDb
    .from('assistencias')
    .insert([{ ...dados, jogo_id }]);
  
  if (error) throw error;
}

async function syncAtualizarFila(item: SyncQueueItem): Promise<void> {
  const { jogador_id, pelada_id, sessao_id, dados } = item;
  
  if (!pelada_id) throw new Error('pelada_id é obrigatório para sync de fila');
  
  const clienteDb = await getClienteSupabase(pelada_id);
  const { error } = await clienteDb
    .from('fila')
    .update(dados)
    .eq('jogador_id', jogador_id)
    .eq('pelada_id', pelada_id)
    .eq('sessao_id', sessao_id);
  
  if (error) throw error;
}

async function syncFinalizarSessao(item: SyncQueueItem): Promise<void> {
  const { sessao_id, pelada_id, dados } = item;
  
  if (!pelada_id) throw new Error('pelada_id é obrigatório para sync de sessão');
  
  const clienteDb = await getClienteSupabase(pelada_id);
  const { error } = await clienteDb
    .from('sessoes')
    .update({ status: 'finalizada', data_fim: dados.data_fim })
    .eq('id', sessao_id);
  
  if (error) throw error;
}

/**
 * Limpa fila de sincronização
 */
export function clearSyncQueue(): void {
  localStorage.removeItem(SYNC_QUEUE_KEY);
  logger.log('🗑️ Fila de sincronização limpa');
}

/**
 * Retorna quantidade de itens pendentes
 */
export function getSyncQueueCount(): number {
  return getSyncQueue().length;
}

/**
 * Baixa TODAS as tabelas necessárias do Supabase para localStorage
 * Chamado ao HABILITAR modo offline nas regras
 */
export async function baixarTodasTabelasParaOffline(peladaId: string): Promise<{
  sucesso: boolean;
  erro?: string;
  tabelas?: {
    jogadores: number;
    sessoes: number;
    fila: number;
    jogos: number;
    gols: number;
    regras: number;
  };
}> {
  logger.log('📥 Iniciando download de TODAS as tabelas para modo offline...');
  
  try {
    if (!isOnline()) {
      throw new Error('Sem conexão com internet. Conecte-se para habilitar modo offline.');
    }
    
    const clienteDb = await getClienteSupabase(peladaId);
    const tabelas = {
      jogadores: 0,
      sessoes: 0,
      fila: 0,
      jogos: 0,
      gols: 0,
      assistencias: 0,
      regras: 0
    };
    
    // 1. Baixar TODOS os jogadores (ativos e inativos)
    logger.log('  📥 Baixando jogadores...');
    const { data: jogadores, error: jogadoresError } = await clienteDb
      .from('jogadores')
      .select('*')
      .eq('pelada_id', peladaId);
    
    if (jogadoresError) throw new Error(`Erro ao baixar jogadores: ${jogadoresError.message}`);
    localStorage.setItem(`jogadores_${peladaId}`, JSON.stringify(jogadores || []));
    tabelas.jogadores = jogadores?.length || 0;
    logger.log(`    ✅ ${tabelas.jogadores} jogadores baixados`);
    
    // 2. Baixar sessão ativa (se houver)
    logger.log('  📥 Baixando sessão ativa...');
    const { data: sessoes, error: sessoesError } = await clienteDb
      .from('sessoes')
      .select('*')
      .eq('pelada_id', peladaId)
      .eq('status', 'ativa');
    
    if (sessoesError) throw new Error(`Erro ao baixar sessões: ${sessoesError.message}`);
    
    if (sessoes && sessoes.length > 0) {
      const sessaoAtiva = sessoes[0];
      localStorage.setItem(`sessao_ativa_${peladaId}`, JSON.stringify(sessaoAtiva));
      tabelas.sessoes = 1;
      logger.log(`    ✅ Sessão ativa baixada (${sessaoAtiva.id})`);
      
      // 3. Baixar fila da sessão ativa
      logger.log('  📥 Baixando fila...');
      const { data: fila, error: filaError } = await clienteDb
        .from('fila')
        .select('*')
        .eq('sessao_id', sessaoAtiva.id);
      
      if (filaError) throw new Error(`Erro ao baixar fila: ${filaError.message}`);
      localStorage.setItem(`fila_${sessaoAtiva.id}`, JSON.stringify(fila || []));
      tabelas.fila = fila?.length || 0;
      logger.log(`    ✅ ${tabelas.fila} itens da fila baixados`);
      
      // 4. Baixar jogos da sessão
      logger.log('  📥 Baixando jogos...');
      const { data: jogos, error: jogosError } = await clienteDb
        .from('jogos')
        .select('*')
        .eq('sessao_id', sessaoAtiva.id);
      
      if (jogosError) throw new Error(`Erro ao baixar jogos: ${jogosError.message}`);
      localStorage.setItem(`jogos_${sessaoAtiva.id}`, JSON.stringify(jogos || []));
      tabelas.jogos = jogos?.length || 0;
      logger.log(`    ✅ ${tabelas.jogos} jogos baixados`);
      
      // 5. Baixar gols dos jogos
      if (jogos && jogos.length > 0) {
        logger.log('  📥 Baixando gols...');
        const jogoIds = jogos.map(j => j.id);
        const { data: gols, error: golsError } = await clienteDb
          .from('gols')
          .select('*')
          .in('jogo_id', jogoIds);
        
        if (golsError) throw new Error(`Erro ao baixar gols: ${golsError.message}`);
        localStorage.setItem(`gols_${sessaoAtiva.id}`, JSON.stringify(gols || []));
        tabelas.gols = gols?.length || 0;
        logger.log(`    ✅ ${tabelas.gols} gols baixados`);
        
        // 5.5. Baixar assistências (da sessão ativa)
        const { data: assistencias, error: assistenciasError } = await clienteDb
          .from('assistencias')
          .select('*')
          .in('jogo_id', jogoIds);
        
        if (assistenciasError) throw new Error(`Erro ao baixar assistências: ${assistenciasError.message}`);
        localStorage.setItem(`assistencias_${sessaoAtiva.id}`, JSON.stringify(assistencias || []));
        tabelas.assistencias = assistencias?.length || 0;
        logger.log(`    ✅ ${tabelas.assistencias} assistências baixadas`);
      }
    } else {
      logger.log('    ⚠️ Nenhuma sessão ativa encontrada');
    }
    
    // 6. Baixar regras (do banco principal)
    logger.log('  📥 Baixando regras...');
    const { data: regras, error: regrasError } = await supabase
      .from('regras')
      .select('*')
      .eq('pelada_id', peladaId)
      .single();
    
    if (regrasError) throw new Error(`Erro ao baixar regras: ${regrasError.message}`);
    localStorage.setItem(`regras_${peladaId}`, JSON.stringify(regras));
    tabelas.regras = 1;
    logger.log(`    ✅ Regras baixadas`);
    
    // Marcar como inicializado
    localStorage.setItem(`modo_offline_inicializado_${peladaId}`, Date.now().toString());
    
    logger.log('✅ Download completo! Modo offline pronto.');
    return { sucesso: true, tabelas };
    
  } catch (error: any) {
    logger.error('❌ Erro ao baixar tabelas:', error);
    return { sucesso: false, erro: error.message || 'Erro desconhecido' };
  }
}

/**
 * Limpa TODAS as tabelas do cache offline
 * Chamado ao DESABILITAR modo offline
 */
export function limparCacheOffline(peladaId: string, sessaoId?: string): void {
  logger.log('🧹 Limpando cache do modo offline...');
  
  localStorage.removeItem(`jogadores_${peladaId}`);
  localStorage.removeItem(`sessao_ativa_${peladaId}`);
  localStorage.removeItem(`regras_${peladaId}`);
  localStorage.removeItem(`modo_offline_inicializado_${peladaId}`);
  localStorage.removeItem(SYNC_QUEUE_KEY);
  
  if (sessaoId) {
    localStorage.removeItem(`fila_${sessaoId}`);
    localStorage.removeItem(`jogos_${sessaoId}`);
    localStorage.removeItem(`gols_${sessaoId}`);
    localStorage.removeItem(`assistencias_${sessaoId}`);
  }
  
  logger.log('✅ Cache offline limpo');
}

/**
 * Auto-sync quando detectar que voltou online
 */
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    logger.log('🌐 Conexão restaurada - sincronizando...');
    syncQueue();
  });
}



