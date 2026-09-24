// ========================================
// GERENCIAMENTO DE CREDENCIAIS
// ========================================

export interface Credenciais {
  pelada_id: string;
  username: string;
  senha: string; // armazenado como hash SHA-256, nunca em plaintext
  is_master?: boolean;
}

const CHAVE_CREDENCIAIS = 'credenciais';

/**
 * Gera hash SHA-256 da senha usando Web Crypto API
 */
export const hashSenha = async (senha: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(senha);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Salvar credenciais no localStorage após login
 * A senha é armazenada como hash SHA-256
 */
export const salvarCredenciais = async (credenciais: Credenciais): Promise<void> => {
  if (typeof window === 'undefined') return;
  
  try {
    const senhaHash = await hashSenha(credenciais.senha);
    localStorage.setItem(CHAVE_CREDENCIAIS, JSON.stringify({ ...credenciais, senha: senhaHash }));
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
 * Função mestre: Buscar pelada_id das credenciais locais
 */
export const buscar_pelada_id = (): string | null => {
  // Tentar credenciais (admin/completo)
  const credenciais = obterCredenciais();
  if (credenciais?.pelada_id) {
    return credenciais.pelada_id;
  }
  
  // Tentar user (visitante)
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      return user?.id || null;
    }
  } catch (error) {
    console.error('Erro ao buscar pelada_id do user:', error);
  }
  
  return null;
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

// Controle funcional por acesso de cliente e modo de sincronização.
