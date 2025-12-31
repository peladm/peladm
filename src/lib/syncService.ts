/**
 * Sync Service - Gerencia sincronização de dados entre localStorage e Supabase
 * Permite funcionamento offline com sync automático quando volta online
 */

import { supabase } from './supabase';
import { isOnline } from './cacheService';

export interface SyncQueueItem {
  id: string;
  tipo: 'criar_jogador' | 'atualizar_jogador' | 'excluir_jogador' | 
        'atualizar_fila' | 'inserir_jogo' | 'inserir_gols' | 
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
  
  console.log('📝 Adicionado à fila de sync:', newItem.tipo);
  
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
 * Sincroniza fila de itens pendentes
 */
export async function syncQueue(): Promise<boolean> {
  if (!isOnline()) {
    console.log('⚠️ Offline - aguardando conexão para sincronizar');
    return false;
  }
  
  const queue = getSyncQueue();
  
  if (queue.length === 0) {
    console.log('✅ Fila de sincronização vazia');
    return true;
  }
  
  console.log(`🔄 Sincronizando ${queue.length} itens...`);
  
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
      console.log(`✅ Sincronizado: ${item.tipo}`);
      
    } catch (error) {
      console.error(`❌ Erro ao sincronizar ${item.tipo}:`, error);
      
      // Incrementa tentativas
      item.tentativas++;
      
      // Se excedeu max tentativas, remove
      if (item.tentativas >= MAX_TENTATIVAS) {
        console.error(`🚫 Item removido após ${MAX_TENTATIVAS} tentativas:`, item.tipo);
        queue.splice(i, 1);
        i--;
      }
      
      falhas++;
    }
  }
  
  // Atualiza fila
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  
  console.log(`📊 Sincronização: ${sucessos} sucessos, ${falhas} falhas, ${queue.length} pendentes`);
  
  return queue.length === 0;
}

/**
 * Sincroniza um item específico
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
 * Funções de sincronização específicas
 */
async function syncCriarJogador(item: SyncQueueItem): Promise<void> {
  const { pelada_id, dados } = item;
  const { id, _tempId, _pendente_sync, ...jogadorData } = dados;
  
  // Remover id se for local (começa com 'local_')
  const insertData = id && id.startsWith('local_') 
    ? { ...jogadorData, pelada_id }
    : { ...jogadorData, id, pelada_id };
  
  const { error } = await supabase
    .from('jogadores')
    .insert([insertData]);
  
  if (error) throw error;
}

async function syncAtualizarJogador(item: SyncQueueItem): Promise<void> {
  const { jogador_id, dados } = item;
  
  // Se são incrementos, buscar valores atuais primeiro
  if (dados.jogos_increment || dados.vitorias_increment || dados.gols_increment) {
    const { data: jogadorAtual } = await supabase
      .from('jogadores')
      .select('jogos, vitorias, gols')
      .eq('id', jogador_id)
      .single();
    
    const updates = {
      jogos: (jogadorAtual?.jogos || 0) + (dados.jogos_increment || 0),
      vitorias: (jogadorAtual?.vitorias || 0) + (dados.vitorias_increment || 0),
      gols: (jogadorAtual?.gols || 0) + (dados.gols_increment || 0)
    };
    
    const { error } = await supabase
      .from('jogadores')
      .update(updates)
      .eq('id', jogador_id);
    
    if (error) throw error;
  } else {
    // Atualização normal
    const { error } = await supabase
      .from('jogadores')
      .update(dados)
      .eq('id', jogador_id);
    
    if (error) throw error;
  }
}

async function syncExcluirJogador(item: SyncQueueItem): Promise<void> {
  const { jogador_id } = item;
  
  const { error } = await supabase
    .from('jogadores')
    .delete()
    .eq('id', jogador_id);
  
  if (error) throw error;
}

async function syncInserirJogo(item: SyncQueueItem): Promise<void> {
  const { sessao_id, dados } = item;
  const { id, ...jogoData } = dados;
  
  // Remover id se for local
  const insertData = id && id.startsWith('local_')
    ? { ...jogoData, sessao_id }
    : { ...jogoData, id, sessao_id };
  
  const { error } = await supabase
    .from('jogos')
    .insert([insertData]);
  
  if (error) throw error;
}

async function syncInserirGols(item: SyncQueueItem): Promise<void> {
  const { jogo_id, dados } = item;
  
  // O jogo_id pode ser local, então precisamos buscar o jogo real
  // Por enquanto, vamos inserir direto
  const { error } = await supabase
    .from('gols')
    .insert([{ ...dados, jogo_id }]);
  
  if (error) throw error;
}

async function syncAtualizarFila(item: SyncQueueItem): Promise<void> {
  const { jogador_id, pelada_id, sessao_id, dados } = item;
  
  const { error } = await supabase
    .from('fila')
    .update(dados)
    .eq('jogador_id', jogador_id)
    .eq('pelada_id', pelada_id)
    .eq('sessao_id', sessao_id);
  
  if (error) throw error;
}

async function syncFinalizarSessao(item: SyncQueueItem): Promise<void> {
  const { sessao_id, dados } = item;
  
  const { error } = await supabase
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
  console.log('🗑️ Fila de sincronização limpa');
}

/**
 * Retorna quantidade de itens pendentes
 */
export function getSyncQueueCount(): number {
  return getSyncQueue().length;
}

/**
 * Auto-sync quando detectar que voltou online
 */
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('🌐 Conexão restaurada - sincronizando...');
    syncQueue();
  });
}
