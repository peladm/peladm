import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logger';
import { buscar_pelada_id, buscar_senha, buscar_username, hashSenha } from './credenciais';

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

/**
 * Obtém o cliente Supabase apropriado para operações de dados
 * Em arquitetura de banco único, sempre retorna o banco principal (master).
 * O isolamento de dados acontece via filtro por pelada_id nas queries.
 */
export const getClienteSupabase = async (peladaId?: string): Promise<SupabaseClient> => {
  logger.log('ℹ️ Banco unico ativo. Usando banco principal para:', peladaId || 'sem pelada_id');
  return supabase;
};

/**
 * Busca TODAS as linhas de uma query, paginando com .range() para não cair
 * no limite padrão de 1000 linhas por resposta do PostgREST/Supabase.
 * `buildQuery` deve retornar uma nova query (sem .range aplicado) a cada chamada.
 */
export async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000
): Promise<T[]> {
  const resultado: T[] = [];
  let pagina = 0;

  while (true) {
    const from = pagina * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await buildQuery(from, to);

    if (error) throw error;
    if (!data || data.length === 0) break;

    resultado.push(...data);

    if (data.length < pageSize) break;
    pagina++;
  }

  return resultado;
}

// Tipos para as tabelas
export interface Jogador {
  id: string;
  nome: string;
  nivel: number;
  status: 'ativo' | 'inativo';
  posicao?: 'linha' | 'goleiro';
  pelada_id?: string; // Campo opcional pois é definido automaticamente
  created_at: string;
  updated_at?: string;
  jogos?: number;
  vitorias?: number;
  gols?: number;
  foto_url?: string;
}

// Função para obter pelada_id do usuário logado (código do cliente)
const getPeladaId = (): string | null => {
  if (typeof window !== 'undefined') {
    return buscar_pelada_id();
  }
  return null;
};

// Função centralizada para validar senha da pelada
export const validarSenhaPelada = async (senhaDigitada: string): Promise<boolean> => {
  if (typeof window === 'undefined') return false;

  // Tentativa 1: comparar hash local (caminho rápido)
  const senhaHashArmazenada = buscar_senha();
  if (senhaHashArmazenada) {
    const hashDigitada = await hashSenha(senhaDigitada);
    if (hashDigitada === senhaHashArmazenada) return true;
    // Fallback legado: credenciais salvas como texto puro em versões antigas
    if (senhaDigitada === senhaHashArmazenada) return true;
  }

  // Tentativa 2: validar diretamente na API (garante sempre funcionar)
  try {
    const pelada_id = buscar_pelada_id();
    const username = buscar_username();
    if (!pelada_id || !username) return false;
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pelada_id, username, senha: senhaDigitada }),
    });
    if (response.ok) {
      // Atualiza as credenciais locais com o hash correto para futuras validações
      const data = await response.json();
      const { salvarCredenciais } = await import('./credenciais');
      await salvarCredenciais({
        pelada_id: data.pelada_id,
        username: data.username,
        senha: data.senha,
        is_master: data.is_master,
      });
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

// Funções de interação com a tabela jogadores
export const jogadoresService = {
  // Buscar todos os jogadores
  async buscarTodos() {
    const peladaId = getPeladaId();
    if (!peladaId) {
      throw new Error('Usuário não está logado ou pelada_id não encontrado');
    }
    
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
  async criar(nome: string, nivel: number, fotoUrl?: string | null, posicao?: 'linha' | 'goleiro') {
    const peladaId = getPeladaId();
    if (!peladaId) {
      throw new Error('Usuário não está logado ou pelada_id não encontrado');
    }
    
    const clienteDb = await getClienteSupabase(peladaId);
    
    const { data, error } = await clienteDb
      .from('jogadores')
      .insert([
        {
          nome: nome.trim(),
          nivel,
          status: 'ativo',
          posicao: posicao ?? 'linha',
          pelada_id: peladaId,
          ...(fotoUrl ? { foto_url: fotoUrl } : {})
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
  async atualizar(id: string, nome: string, nivel: number, fotoUrl?: string | null, posicao?: 'linha' | 'goleiro') {
    const peladaId = getPeladaId();
    if (!peladaId) {
      throw new Error('Usuário não está logado ou pelada_id não encontrado');
    }
    
    const clienteDb = await getClienteSupabase(peladaId);
    
    // Primeiro, buscar o nome antigo para comparação
    const { data: jogadorAnterior } = await clienteDb
      .from('jogadores')
      .select('nome')
      .eq('id', id)
      .eq('pelada_id', peladaId)
      .single();
    
    const nomeAntigo = jogadorAnterior?.nome;
    
    // Atualizar jogador
    const { data, error } = await clienteDb
      .from('jogadores')
      .update({
        nome: nome.trim(),
        nivel,
        posicao: posicao ?? 'linha',
        ...(fotoUrl !== undefined ? { foto_url: fotoUrl } : {})
      })
      .eq('id', id)
      .eq('pelada_id', peladaId)
      .select()
      .single();
    
    if (error) {
      console.error('Erro ao atualizar jogador:', error);
      throw error;
    }
    
    // Se o nome mudou, atualizar referências em cascata
    if (nomeAntigo && nomeAntigo !== nome.trim()) {
      await this.atualizarReferencesNomeJogadorGoldPremium(peladaId, nomeAntigo, nome.trim());
    }
    
    return data;
  },

  // Atualizar referências de nome em jogos persistidos
  async atualizarReferencesNomeJogadorGoldPremium(peladaId: string, nomeAntigo: string, nomeNovo: string) {
    try {
      const clienteDb = await getClienteSupabase(peladaId);
      
      logger.log('🔄 Buscando jogos para atualizar nome em cascata...');
      
      // Buscar todas as sessões da pelada
      const { data: sessoes } = await clienteDb
        .from('sessoes')
        .select('id')
        .eq('pelada_id', peladaId);
      
      if (!sessoes || sessoes.length === 0) {
        logger.log('ℹ️ Nenhuma sessão encontrada para atualizar');
        return;
      }
      
      const sessaoIds = sessoes.map(s => s.id);
      
      // Buscar todos os jogos dessas sessões
      const { data: jogos } = await clienteDb
        .from('jogos')
        .select('id, time_a, time_b, substituicoes')
        .in('sessao_id', sessaoIds);
      
      if (!jogos || jogos.length === 0) {
        logger.log('ℹ️ Nenhum jogo encontrado para atualizar');
        return;
      }
      
      let contadorAtualizacoes = 0;
      const updatesPromises: Promise<any>[] = [];
      
      // Atualizar cada jogo que contém o nome antigo
      jogos.forEach((jogo: any) => {
        let modificado = false;
        const updateData: any = {};
        
        // Atualizar time_a
        if (Array.isArray(jogo.time_a)) {
          const novoTimeA = jogo.time_a.map((nome: string) => 
            nome === nomeAntigo ? nomeNovo : nome
          );
          if (JSON.stringify(novoTimeA) !== JSON.stringify(jogo.time_a)) {
            updateData.time_a = novoTimeA;
            modificado = true;
            contadorAtualizacoes++;
          }
        }
        
        // Atualizar time_b
        if (Array.isArray(jogo.time_b)) {
          const novoTimeB = jogo.time_b.map((nome: string) => 
            nome === nomeAntigo ? nomeNovo : nome
          );
          if (JSON.stringify(novoTimeB) !== JSON.stringify(jogo.time_b)) {
            updateData.time_b = novoTimeB;
            modificado = true;
            contadorAtualizacoes++;
          }
        }
        
        // Atualizar substituições
        if (Array.isArray(jogo.substituicoes)) {
          const novasSubstituicoes = jogo.substituicoes.map((sub: any) => ({
            ...sub,
            jogador_saiu: sub.jogador_saiu === nomeAntigo ? nomeNovo : sub.jogador_saiu,
            jogador_entrou: sub.jogador_entrou === nomeAntigo ? nomeNovo : sub.jogador_entrou
          }));
          if (JSON.stringify(novasSubstituicoes) !== JSON.stringify(jogo.substituicoes)) {
            updateData.substituicoes = novasSubstituicoes;
            modificado = true;
          }
        }
        
        // Se modificou, fazer update
        if (modificado) {
          updatesPromises.push(
            Promise.resolve(
              clienteDb
                .from('jogos')
                .update(updateData)
                .eq('id', jogo.id)
            )
          );
        }
      });
      
      // Executar todos os updates em paralelo
      if (updatesPromises.length > 0) {
        const results = await Promise.all(updatesPromises);
        logger.log(`✅ Nome atualizado em ${updatesPromises.length} jogos`, {
          nome_antigo: nomeAntigo,
          nome_novo: nomeNovo
        });
      }
    } catch (error) {
      logger.warn('⚠️ Erro ao atualizar referências em jogos:', error);
    }
  },

  // Alterar status do jogador
  async alterarStatus(id: string, status: 'ativo' | 'inativo') {
    const peladaId = getPeladaId();
    if (!peladaId) {
      throw new Error('Usuário não está logado ou pelada_id não encontrado');
    }
    
    const clienteDb = await getClienteSupabase(peladaId);
    
    const { data, error } = await clienteDb
      .from('jogadores')
      .update({ status })
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

