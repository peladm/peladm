import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getClientConfig } from '@/config/clients';
import { Database } from '@/types/supabase';

// Cache de instâncias Supabase para evitar recriações desnecessárias
const supabaseInstances = new Map<string, SupabaseClient<Database>>();

/**
 * Factory para criar instâncias Supabase baseadas no cliente
 */
export function createSupabaseClient(clientEmail: string): SupabaseClient<Database> {
  const normalizedEmail = clientEmail.toLowerCase();
  
  // Verificar se já existe instância em cache
  if (supabaseInstances.has(normalizedEmail)) {
    return supabaseInstances.get(normalizedEmail)!;
  }
  
  // Buscar configuração do cliente
  const clientConfig = getClientConfig(normalizedEmail);
  
  if (!clientConfig) {
    throw new Error(`Cliente não encontrado: ${clientEmail}`);
  }
  
  if (clientConfig.status !== 'active') {
    throw new Error(`Cliente inativo: ${clientEmail}`);
  }
  
  // Criar nova instância Supabase
  const supabase = createClient<Database>(
    clientConfig.supabaseUrl,
    clientConfig.supabaseKey,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    }
  );
  
  // Armazenar no cache
  supabaseInstances.set(normalizedEmail, supabase);
  
  return supabase;
}

/**
 * Limpar cache de uma instância específica
 */
export function clearSupabaseCache(clientEmail?: string): void {
  if (clientEmail) {
    supabaseInstances.delete(clientEmail.toLowerCase());
  } else {
    supabaseInstances.clear();
  }
}

/**
 * Obter instância Supabase atual do contexto
 */
export function getCurrentSupabaseClient(): SupabaseClient<Database> {
  // TODO: Implementar contexto para armazenar cliente atual
  // Por enquanto, usar cliente de desenvolvimento
  return createSupabaseClient('admin@dev.local');
}

/**
 * Validar se configuração Supabase é válida
 */
export async function validateSupabaseConfig(url: string, key: string): Promise<boolean> {
  try {
    const testClient = createClient<Database>(url, key);
    const { data, error } = await testClient.from('users').select('*').limit(1);
    
    // Se não der erro de auth ou rede, configuração é válida
    return !error || !error.message.includes('Invalid API key');
  } catch (error) {
    console.error('Erro ao validar configuração Supabase:', error);
    return false;
  }
}