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
  tabela: string;
  dados: any;
  timestamp: number;
  tentativas: number;
}

const SYNC_QUEUE_KEY = 'fila_sincronizacao';
const MAX_TENTATIVAS = 3;

/**
 * Adiciona item à fila de sincronização
 */
export function addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'tentativas' | 'timestamp'>): void {
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
    syncQueue();
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
async function syncCriarJogador(dados: any): Promise<void> {
  const { _tempId, _pendente_sync, ...jogadorData } = dados;
  
  const { error } = await supabase
    .from('jogadores')
    .insert([jogadorData]);
  
  if (error) throw error;
}

async function syncAtualizarJogador(dados: any): Promise<void> {
  const { id, ...updates } = dados;
  
  const { error } = await supabase
    .from('jogadores')
    .update(updates)
    .eq('id', id);
  
  if (error) throw error;
}

async function syncExcluirJogador(dados: any): Promise<void> {
  const { error } = await supabase
    .from('jogadores')
    .delete()
    .eq('id', dados.id);
  
  if (error) throw error;
}

async function syncInserirJogo(dados: any): Promise<void> {
  const { error } = await supabase
    .from('jogos')
    .insert([dados]);
  
  if (error) throw error;
}

async function syncInserirGols(dados: any): Promise<void> {
  const { error } = await supabase
    .from('gols')
    .insert(dados.gols);
  
  if (error) throw error;
}

async function syncAtualizarFila(dados: any): Promise<void> {
  // Sync em batch de múltiplos jogadores da fila
  for (const item of dados.itens) {
    const { error } = await supabase
      .from('fila')
      .upsert(item);
    
    if (error) throw error;
  }
}

async function syncFinalizarSessao(dados: any): Promise<void> {
  const { error } = await supabase
    .from('sessoes')
    .update({ status: 'encerrada', data_fim: dados.data_fim })
    .eq('id', dados.sessao_id);
  
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
