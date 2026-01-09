import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logger';
import { buscar_pelada_id, buscar_senha, buscar_plano, buscar_supabase_url, buscar_supabase_anon_key } from './credenciais';

// Configurações do Supabase PRINCIPAL (para autenticação e clientes)
const supabaseUrl = 'https://ewcswczqvelhlwpbraea.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Y3N3Y3pxdmVsaGx3cGJyYWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2Mzc1MzksImV4cCI6MjA4MDIxMzUzOX0.DRzgAuj171lUG_7wMVCFhuDH71sGxlHHEB28qBN9wks';

// Criar cliente Supabase PRINCIPAL (para autenticação, clientes e usuarios)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Prefer': 'return=representation'
    }
  }
});

// Cache de conexões com bancos dedicados dos clientes
const clienteSupabaseCache: Record<string, SupabaseClient> = {};

/**
 * Obtém o cliente Supabase apropriado para operações de dados
 * - Se o cliente for Premium e tiver banco dedicado, retorna conexão dedicada
 * - Caso contrário, retorna banco principal
 */
export const getClienteSupabase = async (peladaId?: string): Promise<SupabaseClient> => {
  // Se não tiver pelada_id, usa banco principal
  if (!peladaId) {
    return supabase;
  }

  // Verifica se já tem conexão em cache
  if (clienteSupabaseCache[peladaId]) {
    logger.log('🔄 Usando conexão em cache para:', peladaId);
    return clienteSupabaseCache[peladaId];
  }

  // PRIMEIRO: Tenta buscar credenciais do localStorage (mais rápido)
  logger.log('🔍 Buscando credenciais do localStorage...');
  const url = buscar_supabase_url();
  const key = buscar_supabase_anon_key();
  
  if (url && key) {
    logger.log('✅ Credenciais encontradas no localStorage!');
    logger.log('🔗 URL:', url);
    logger.log('🔑 Key:', key.substring(0, 20) + '...');
    
    const clienteSupabase = createClient(url, key, {
      auth: { persistSession: false },
      db: { schema: 'public' },
    });
    clienteSupabaseCache[peladaId] = clienteSupabase;
    return clienteSupabase;
  }
  
  // FALLBACK: Busca credenciais do banco principal
  logger.log('🔍 Buscando credenciais no banco principal para:', peladaId);
  const { data: clienteData, error } = await supabase
    .from('clientes')
    .select('supabase_url, supabase_anon_key, plano')
    .eq('pelada_id', peladaId)
    .single();

  if (error) {
    console.error('❌ Erro ao buscar cliente:', error);
  }

  // Se cliente Premium com banco dedicado, cria e cacheia conexão
  if (clienteData?.supabase_url && clienteData?.supabase_anon_key) {
    logger.log('✅ Cliente com banco dedicado encontrado no banco!');
    logger.log('🔗 URL:', clienteData.supabase_url);
    logger.log('🔑 Key:', clienteData.supabase_anon_key.substring(0, 20) + '...');
    
    const clienteSupabase = createClient(
      clienteData.supabase_url,
      clienteData.supabase_anon_key,
      {
        auth: { persistSession: false },
        db: { schema: 'public' },
      }
    );
    clienteSupabaseCache[peladaId] = clienteSupabase;
    return clienteSupabase;
  }

  // Cliente Free ou sem banco dedicado: usa banco principal
  logger.log('ℹ️ Usando banco principal para:', peladaId);
  return supabase;
};

// Tipos para as tabelas
export interface Jogador {
  id: string;
  nome: string;
  nivel: number;
  status: 'ativo' | 'inativo';
  pelada_id?: string; // Campo opcional pois é definido automaticamente
  created_at: string;
  updated_at: string;
  jogos?: number;
  vitorias?: number;
  gols?: number;
}

// Função para obter pelada_id do usuário logado (código do cliente)
const getPeladaId = (): string | null => {
  if (typeof window !== 'undefined') {
    return buscar_pelada_id();
  }
  return null;
};

// Função para verificar se o plano é Free
const isPlanoFree = (): boolean => {
  if (typeof window !== 'undefined') {
    const plano = buscar_plano();
    return plano === 'free';
  }
  return false;
};

// Função centralizada para validar senha da pelada
export const validarSenhaPelada = async (senhaDigitada: string): Promise<boolean> => {
  if (typeof window === 'undefined') return false;
  
  const senhaCorreta = buscar_senha();
  if (!senhaCorreta) return false;
  
  return senhaDigitada === senhaCorreta;
};

// Funções de interação com a tabela jogadores (usa localStorage se Free, Supabase se Gold/Premium)
export const jogadoresService = {
  // Buscar todos os jogadores
  async buscarTodos() {
    const peladaId = getPeladaId();
    if (!peladaId) {
      throw new Error('Usuário não está logado ou pelada_id não encontrado');
    }
    
    // Se for Free, buscar do localStorage
    if (isPlanoFree()) {
      const jogadoresStr = localStorage.getItem(`jogadores_${peladaId}`);
      if (!jogadoresStr) return [];
      try {
        return JSON.parse(jogadoresStr);
      } catch {
        return [];
      }
    }
    
    // Gold/Premium: buscar do Supabase
    const clienteDb = await getClienteSupabase(peladaId);
    
    const { data, error } = await clienteDb
      .from('jogadores')
      .select('*')
      .eq('pelada_id', peladaId)
      .order('nome', { ascending: true });
    
    if (error) {
      console.error('Erro ao buscar jogadores:', error);
      throw error;
    }
    
    return data || [];
  },

  // Criar novo jogador
  async criar(nome: string, nivel: number) {
    const peladaId = getPeladaId();
    if (!peladaId) {
      throw new Error('Usuário não está logado ou pelada_id não encontrado');
    }
    
    // Se for Free, salvar no localStorage
    if (isPlanoFree()) {
      // Gerar UUID válido
      const gerarUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };
      
      const jogadores = await this.buscarTodos();
      const novoJogador: Jogador = {
        id: gerarUUID(),
        nome: nome.trim(),
        nivel,
        status: 'ativo',
        pelada_id: peladaId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      jogadores.push(novoJogador);
      localStorage.setItem(`jogadores_${peladaId}`, JSON.stringify(jogadores));
      return novoJogador;
    }
    
    // Gold/Premium: salvar no Supabase
    const clienteDb = await getClienteSupabase(peladaId);
    
    const { data, error } = await clienteDb
      .from('jogadores')
      .insert([
        {
          nome: nome.trim(),
          nivel,
          status: 'ativo',
          pelada_id: peladaId
        }
      ])
      .select()
      .single();
    
    if (error) {
      console.error('Erro ao criar jogador:', error);
      throw error;
    }
    
    return data;
  },

  // Atualizar jogador
  async atualizar(id: string, nome: string, nivel: number) {
    const peladaId = getPeladaId();
    if (!peladaId) {
      throw new Error('Usuário não está logado ou pelada_id não encontrado');
    }
    
    // Se for Free, atualizar no localStorage
    if (isPlanoFree()) {
      const jogadores = await this.buscarTodos();
      const index = jogadores.findIndex((j: Jogador) => j.id === id);
      if (index === -1) throw new Error('Jogador não encontrado');
      
      jogadores[index] = {
        ...jogadores[index],
        nome: nome.trim(),
        nivel,
        updated_at: new Date().toISOString()
      };
      localStorage.setItem(`jogadores_${peladaId}`, JSON.stringify(jogadores));
      return jogadores[index];
    }
    
    // Gold/Premium: atualizar no Supabase
    const clienteDb = await getClienteSupabase(peladaId);
    
    const { data, error } = await clienteDb
      .from('jogadores')
      .update({
        nome: nome.trim(),
        nivel
      })
      .eq('id', id)
      .eq('pelada_id', peladaId)
      .select()
      .single();
    
    if (error) {
      console.error('Erro ao atualizar jogador:', error);
      throw error;
    }
    
    return data;
  },

  // Alterar status do jogador
  async alterarStatus(id: string, status: 'ativo' | 'inativo') {
    const peladaId = getPeladaId();
    if (!peladaId) {
      throw new Error('Usuário não está logado ou pelada_id não encontrado');
    }
    
    // Se for Free, atualizar no localStorage
    if (isPlanoFree()) {
      const jogadores = await this.buscarTodos();
      const index = jogadores.findIndex((j: Jogador) => j.id === id);
      if (index === -1) throw new Error('Jogador não encontrado');
      
      jogadores[index] = {
        ...jogadores[index],
        status,
        updated_at: new Date().toISOString()
      };
      localStorage.setItem(`jogadores_${peladaId}`, JSON.stringify(jogadores));
      return jogadores[index];
    }
    
    // Gold/Premium: atualizar no Supabase
    const clienteDb = await getClienteSupabase(peladaId);
    
    const { data, error } = await clienteDb
      .from('jogadores')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('pelada_id', peladaId)
      .select()
      .single();
    
    if (error) {
      console.error('Erro ao alterar status do jogador:', error);
      throw error;
    }
    
    return data;
  },

  // Excluir jogador
  async excluir(id: string) {
    const peladaId = getPeladaId();
    if (!peladaId) {
      throw new Error('Usuário não está logado ou pelada_id não encontrado');
    }
    
    // Se for Free, excluir do localStorage
    if (isPlanoFree()) {
      const jogadores = await this.buscarTodos();
      const jogadoresFiltrados = jogadores.filter((j: Jogador) => j.id !== id);
      localStorage.setItem(`jogadores_${peladaId}`, JSON.stringify(jogadoresFiltrados));
      return true;
    }
    
    // Gold/Premium: excluir do Supabase
    const clienteDb = await getClienteSupabase(peladaId);
    
    const { error } = await clienteDb
      .from('jogadores')
      .delete()
      .eq('id', id)
      .eq('pelada_id', peladaId);
    
    if (error) {
      console.error('Erro ao excluir jogador:', error);
      throw error;
    }
    
    return true;
  },

  // Buscar jogadores ativos para sorteio
  async buscarAtivos() {
    const peladaId = getPeladaId();
    if (!peladaId) {
      throw new Error('Usuário não está logado ou pelada_id não encontrado');
    }
    
    // Se for Free, filtrar do localStorage
    if (isPlanoFree()) {
      const jogadores = await this.buscarTodos();
      return jogadores.filter((j: Jogador) => j.status === 'ativo');
    }
    
    // Gold/Premium: buscar do Supabase
    const clienteDb = await getClienteSupabase(peladaId);
    
    const { data, error } = await clienteDb
      .from('jogadores')
      .select('*')
      .eq('pelada_id', peladaId)
      .eq('status', 'ativo')
      .order('nome', { ascending: true });
    
    if (error) {
      console.error('Erro ao buscar jogadores ativos:', error);
      throw error;
    }
    
    return data || [];
  }
};

// Helper: Obtém supabase apropriado para o usuário logado
export const getSupabaseParaUsuarioLogado = async () => {
  const peladaId = getPeladaId();
  return await getClienteSupabase(peladaId || undefined);
};

export default supabase;

