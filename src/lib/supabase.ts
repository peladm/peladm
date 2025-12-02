import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { createSupabaseClient } from './supabase-factory';

// Supabase master (para autenticação do sistema e gerenciamento de clientes)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

// Cliente Supabase master (seu banco central)
export const masterSupabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Cliente Supabase padrão (compatibilidade)
export const supabase = masterSupabase;

// Função para obter cliente Supabase baseado no cliente logado
export function getClientSupabase(clientEmail: string) {
  return createSupabaseClient(clientEmail);
}

// Função helper para autenticação
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
};

// Função helper para logout
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};