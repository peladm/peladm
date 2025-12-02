import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { createSupabaseClient } from './supabase-factory';

// Supabase master (para autenticação do sistema e gerenciamento de clientes)
// Credenciais reais do projeto criado
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ewcswczqvelhlwpbraea.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Y3N3Y3pxdmVsaGx3cGJyYWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzMwODI5NDMsImV4cCI6MjA0ODY1ODk0M30.ehQzuCQaRgPG3poKGqmV_5gYLgoQ3k4ajRCnaHDX5-Q';

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