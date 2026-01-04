/**
 * Cache Service - Gerencia cache local de dados essenciais
 * Permite funcionamento offline e melhora performance
 */

import { supabase, getClienteSupabase } from './supabase';

export interface CacheOptions {
  forceRefresh?: boolean; // Força buscar do Supabase mesmo se tem cache
  fallbackOnly?: boolean; // Só usa cache se Supabase falhar
}

/**
 * Busca jogadores com cache local
 */
export async function getJogadoresWithCache(
  peladaId: string,
  options: CacheOptions = {}
): Promise<any[]> {
  const cacheKey = `jogadores_${peladaId}`;
  
  // Se não forçar refresh, tenta cache primeiro
  if (!options.forceRefresh) {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      console.log('📦 Usando jogadores do cache');
      return JSON.parse(cached);
    }
  }
  
  try {
    // Busca do Supabase (usa banco dedicado se Premium)
    const clienteDb = await getClienteSupabase(peladaId);
    const { data, error } = await clienteDb
      .from('jogadores')
      .select('*')
      .eq('pelada_id', peladaId)
      .order('nome', { ascending: true });
    
    if (error) throw error;
    
    // Atualiza cache
    localStorage.setItem(cacheKey, JSON.stringify(data || []));
    console.log('✅ Cache de jogadores atualizado');
    
    return data || [];
    
  } catch (error) {
    console.error('❌ Erro ao buscar jogadores:', error);
    
    // Fallback para cache
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      console.log('⚠️ Usando cache de jogadores (offline)');
      return JSON.parse(cached);
    }
    
    return [];
  }
}

/**
 * Busca regras com cache local
 */
export async function getRegrasWithCache(
  peladaId: string,
  options: CacheOptions = {}
): Promise<{ success: boolean; data: any }> {
  const cacheKey = `regras_${peladaId}`;
  
  console.log('🔍 [CACHE] Buscando regras para pelada_id:', peladaId);
  
  if (!options.forceRefresh) {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const cachedData = JSON.parse(cached);
      console.log('📦 [CACHE] Usando regras do cache:', cachedData);
      return { success: true, data: cachedData };
    }
  }
  
  try {
    console.log('🌐 [CACHE] Buscando regras do Supabase...');
    const { data, error } = await supabase
      .from('regras')
      .select('*')
      .eq('pelada_id', peladaId)
      .single();
    
    if (error) throw error;
    
    console.log('✅ [CACHE] Regras encontradas no Supabase:', data);
    localStorage.setItem(cacheKey, JSON.stringify(data));
    console.log('✅ [CACHE] Cache de regras atualizado');
    
    return { success: true, data };
    
  } catch (error) {
    console.error('❌ [CACHE] Erro ao buscar regras:', error);
    
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const cachedData = JSON.parse(cached);
      console.log('⚠️ [CACHE] Usando cache de regras (offline):', cachedData);
      return { success: true, data: cachedData };
    }
    
    return { success: false, data: null };
  }
}

/**
 * Limpa cache de um cliente específico
 */
export function clearCache(peladaId: string): void {
  localStorage.removeItem(`jogadores_${peladaId}`);
  localStorage.removeItem(`regras_${peladaId}`);
  console.log('🗑️ Cache limpo');
}

/**
 * Limpa todo o cache
 */
export function clearAllCache(): void {
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.startsWith('jogadores_') || 
        key.startsWith('regras_') || 
        key.startsWith('usuarios_')) {
      localStorage.removeItem(key);
    }
  });
  console.log('🗑️ Todo cache limpo');
}

/**
 * Verifica se está online
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Detecta mudança de status online/offline
 */
export function onConnectionChange(callback: (online: boolean) => void): () => void {
  const onlineHandler = () => callback(true);
  const offlineHandler = () => callback(false);
  
  window.addEventListener('online', onlineHandler);
  window.addEventListener('offline', offlineHandler);
  
  // Retorna função de cleanup
  return () => {
    window.removeEventListener('online', onlineHandler);
    window.removeEventListener('offline', offlineHandler);
  };
}
