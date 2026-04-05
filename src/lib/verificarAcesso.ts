// Utilitário para verificar permissões de acesso
import { obterCredenciais } from './credenciais';

export type TipoAcesso = 'completo' | 'visitante' | null;

export interface Usuario {
  id: string;
  nome: string;
  email?: string;
  usuario_pelada?: string;
  senha_pelada?: string;
  plano: string;
  is_master: boolean;
  status: boolean;
  tipo_acesso: TipoAcesso;
}

// Obter dados do usuário do localStorage (compatibilidade com ambos os formatos)
export const obterUsuario = (): Usuario | null => {
  if (typeof window === 'undefined') return null;
  
  // Tentar novo formato (credenciais)
  const credenciais = obterCredenciais();
  if (credenciais) {
    // Verificar se é visitante pelo username
    const tipoAcesso = credenciais.username === 'visitante' ? 'visitante' : 'completo';
    
    return {
      id: credenciais.pelada_id,
      nome: credenciais.username,
      plano: credenciais.plano || 'free',
      is_master: credenciais.is_master === true,
      status: true,
      tipo_acesso: tipoAcesso
    };
  }
  
  // Fallback para formato antigo (user)
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
};

// Verificar se usuário está logado
export const usuarioEstaLogado = (): boolean => {
  const usuario = obterUsuario();
  return usuario !== null && usuario.status === true;
};

// Verificar se tem acesso completo (não é visitante)
export const temAcessoCompleto = (): boolean => {
  const usuario = obterUsuario();
  return usuario?.tipo_acesso === 'completo';
};

// Verificar se é visitante
export const ehVisitante = (): boolean => {
  const usuario = obterUsuario();
  return usuario?.tipo_acesso === 'visitante';
};

// Verificar se é admin/master
export const ehAdmin = (): boolean => {
  const usuario = obterUsuario();
  return usuario?.is_master === true && temAcessoCompleto();
};

// Páginas permitidas para visitantes
const PAGINAS_VISITANTE = [
  '/resultados',
  '/estatisticas',
  '/classificacao',
  '/individual',
  '/x1'
];

// Verificar se página é acessível para o tipo de acesso
export const podeAcessarPagina = (pathname: string): boolean => {
  const usuario = obterUsuario();
  
  // Sem usuário - apenas /login
  if (!usuario) {
    return pathname === '/login' || pathname === '/';
  }
  
  // Visitante - apenas páginas específicas
  if (ehVisitante()) {
    return PAGINAS_VISITANTE.some(page => pathname.startsWith(page));
  }
  
  // Acesso completo - todas as páginas
  return true;
};

// Redirecionar para página apropriada se não tem acesso
export const redirecionarSeNaoTemAcesso = (pathname: string): string | null => {
  const usuario = obterUsuario();
  
  // Sem usuário - redirecionar para login (exceto na home pública)
  if (!usuario && pathname !== '/login' && pathname !== '/') {
    return '/login';
  }
  
  // Visitante tentando acessar home ou página não permitida
  if (ehVisitante() && (pathname === '/' || !podeAcessarPagina(pathname))) {
    return '/resultados';
  }
  
  return null; // Não precisa redirecionar
};
