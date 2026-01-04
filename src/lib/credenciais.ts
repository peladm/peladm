// ========================================
// GERENCIAMENTO DE CREDENCIAIS
// ========================================

export interface Credenciais {
  pelada_id: string;
  username: string;
  senha: string;
  plano: string;
  supabase_url: string | null;
  supabase_anon_key: string | null;
}

const CHAVE_CREDENCIAIS = 'credenciais';

/**
 * Salvar credenciais no localStorage após login
 */
export const salvarCredenciais = (credenciais: Credenciais): void => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(CHAVE_CREDENCIAIS, JSON.stringify(credenciais));
  } catch (error) {
    console.error('Erro ao salvar credenciais:', error);
  }
};

/**
 * Obter credenciais do localStorage
 */
export const obterCredenciais = (): Credenciais | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    const credenciaisStr = localStorage.getItem(CHAVE_CREDENCIAIS);
    if (!credenciaisStr) return null;
    
    return JSON.parse(credenciaisStr) as Credenciais;
  } catch (error) {
    console.error('Erro ao obter credenciais:', error);
    return null;
  }
};

/**
 * Limpar credenciais (logout)
 */
export const limparCredenciais = (): void => {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem(CHAVE_CREDENCIAIS);
  localStorage.removeItem('user'); // Remove também o 'user' antigo (compatibilidade)
};

/**
 * Verificar se usuário está logado
 */
export const estaLogado = (): boolean => {
  const credenciais = obterCredenciais();
  return credenciais !== null;
};

/**
 * Verificar se tem acesso a banco dedicado
 */
export const temBancoDedicado = (): boolean => {
  const credenciais = obterCredenciais();
  return credenciais?.supabase_url !== null && credenciais?.supabase_anon_key !== null;
};

/**
 * Obter plano do usuário
 */
export const obterPlano = (): string | null => {
  const credenciais = obterCredenciais();
  return credenciais?.plano || null;
};

/**
 * Função mestre: Buscar plano das credenciais locais
 * Retorna o plano em lowercase: 'free', 'gold', 'premium'
 */
export const buscar_plano = (): string => {
  const credenciais = obterCredenciais();
  return credenciais?.plano?.toLowerCase() || 'free';
};

/**
 * Função mestre: Buscar pelada_id das credenciais locais
 */
export const buscar_pelada_id = (): string | null => {
  const credenciais = obterCredenciais();
  return credenciais?.pelada_id || null;
};

/**
 * Função mestre: Buscar username das credenciais locais
 */
export const buscar_username = (): string | null => {
  const credenciais = obterCredenciais();
  return credenciais?.username || null;
};

/**
 * Função mestre: Buscar senha das credenciais locais
 */
export const buscar_senha = (): string | null => {
  const credenciais = obterCredenciais();
  return credenciais?.senha || null;
};

/**
 * Função mestre: Buscar supabase_url das credenciais locais
 */
export const buscar_supabase_url = (): string | null => {
  const credenciais = obterCredenciais();
  return credenciais?.supabase_url || null;
};

/**
 * Função mestre: Buscar supabase_anon_key das credenciais locais
 */
export const buscar_supabase_anon_key = (): string | null => {
  const credenciais = obterCredenciais();
  return credenciais?.supabase_anon_key || null;
};

/**
 * Verificar se o plano é Premium
 */
export const ehPremium = (): boolean => {
  const plano = buscar_plano();
  return plano === 'premium';
};

/**
 * Verificar se o plano é Gold ou superior
 */
export const ehGoldOuSuperior = (): boolean => {
  const plano = buscar_plano();
  return plano === 'gold' || plano === 'premium';
};

/**
 * Verificar se o plano é Free
 */
export const ehFree = (): boolean => {
  const plano = buscar_plano();
  return plano === 'free';
};
