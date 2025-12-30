// Sistema de permissões por plano
export type Plano = 'Free' | 'Gold' | 'Premium';

export interface Permissoes {
  // Recursos gerais
  usarSupabase: boolean;
  bancoExclusivo: boolean; // Premium tem banco dedicado
  multiUsuario: boolean;
  
  // Cadastro
  cadastrarNivel: boolean;
  limiteJogadores: number | null; // null = ilimitado
  limitePartidas: number | null; // null = ilimitado
  limiteUsuarios: number | null; // null = ilimitado (total incluindo admin)
  
  // Sorteio
  sorteioEquilibrado: boolean;
  sorteioManual: boolean;
  
  // Fila e Partida
  usarPaginaPartida: boolean;
  permitirSubstituicoes: boolean;
  usarCronometro: boolean;
  desfazerPartida: boolean;
  usarModoPartida: boolean; // Modo Partida com estatísticas (exclusivo Premium)
  
  // Estatísticas
  verEstatisticas: boolean;
  verResultados: boolean;
  exportarRelatorios: boolean;
  
  // Regras
  configurarVitoriasConsecutivas: boolean;
  configurarRotacao: boolean;
  configurarCores: boolean;
  
  // Compartilhamento
  compartilharWhatsApp: boolean;
  
  // Anúncios
  removerAnuncios: boolean;
  
  // Admin
  gerenciarUsuarios: boolean;
  multipalasPeladas: boolean;
}

export const PERMISSOES_POR_PLANO: Record<Plano, Permissoes> = {
  Free: {
    // Recursos gerais
    usarSupabase: false, // Apenas localStorage
    bancoExclusivo: false,
    multiUsuario: false,
    
    // Cadastro
    cadastrarNivel: false, // Só nome
    limiteJogadores: 25,
    limitePartidas: 10,
    limiteUsuarios: 0, // 0 usuários adicionais (apenas o admin master)
    
    // Sorteio
    sorteioEquilibrado: false, // Só aleatório
    sorteioManual: false,
    
    // Fila e Partida
    usarPaginaPartida: false, // Controle direto na fila
    permitirSubstituicoes: false,
    usarCronometro: false,
    desfazerPartida: false,
    usarModoPartida: false, // Sem modo partida
    
    // Estatísticas
    verEstatisticas: false,
    verResultados: false,
    exportarRelatorios: false,
    
    // Regras
    configurarVitoriasConsecutivas: true, // Liberado para FREE
    configurarRotacao: false,
    configurarCores: false,
    
    // Compartilhamento
    compartilharWhatsApp: false, // Exclusivo Gold/Premium
    
    // Anúncios
    removerAnuncios: false, // FREE tem anúncios
    
    // Admin
    gerenciarUsuarios: false,
    multipalasPeladas: false,
  },
  
  Gold: {
    // Recursos gerais
    usarSupabase: true, // Banco compartilhado
    bancoExclusivo: false,
    multiUsuario: true,
    
    // Cadastro
    cadastrarNivel: true,
    limiteJogadores: 40,
    limitePartidas: 15,
    limiteUsuarios: 3, // 3 usuários adicionais (além do admin master)
    
    // Sorteio
    sorteioEquilibrado: true,
    sorteioManual: true,
    
    // Fila e Partida
    usarPaginaPartida: true,
    permitirSubstituicoes: true,
    usarCronometro: true,
    desfazerPartida: true,
    usarModoPartida: false, // Modo Partida exclusivo Premium
    
    // Estatísticas
    verEstatisticas: false, // Gold não tem estatísticas (precisa do Modo Partida)
    verResultados: false, // Sem modo partida, não há dados detalhados
    exportarRelatorios: false,
    
    // Regras
    configurarVitoriasConsecutivas: true,
    configurarRotacao: true,
    configurarCores: true,
    
    // Compartilhamento
    compartilharWhatsApp: true, // Disponível no Gold
    
    // Anúncios
    removerAnuncios: false, // Gold tem anúncios limitados
    
    // Admin
    gerenciarUsuarios: true,
    multipalasPeladas: false, // Só 1 pelada
  },
  
  Premium: {
    // Recursos gerais
    usarSupabase: true, // Banco dedicado exclusivo
    bancoExclusivo: true,
    multiUsuario: true,
    
    // Cadastro
    cadastrarNivel: true,
    limiteJogadores: null, // Ilimitado
    limitePartidas: null, // Ilimitado
    limiteUsuarios: 5, // 5 usuários adicionais (além do admin master)
    
    // Sorteio
    sorteioEquilibrado: true,
    sorteioManual: true,
    
    // Fila e Partida
    usarPaginaPartida: true,
    permitirSubstituicoes: true,
    usarCronometro: true,
    desfazerPartida: true,
    usarModoPartida: true, // Modo Partida exclusivo Premium
    
    // Estatísticas
    verEstatisticas: true,
    verResultados: true,
    exportarRelatorios: true,
    
    // Regras
    configurarVitoriasConsecutivas: true,
    configurarRotacao: true,
    configurarCores: true,
    
    // Compartilhamento
    compartilharWhatsApp: true, // Disponível no Premium
    
    // Anúncios
    removerAnuncios: true, // Premium sem anúncios
    
    // Admin
    gerenciarUsuarios: true,
    multipalasPeladas: true, // Múltiplas peladas
  },
};

export const NOMES_PLANOS: Record<Plano, string> = {
  Free: 'Free',
  Gold: 'Gold',
  Premium: 'Premium',
};

export const CORES_PLANOS: Record<Plano, { bg: string; text: string; badge: string }> = {
  Free: {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    badge: 'bg-gray-500',
  },
  Gold: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    badge: 'bg-yellow-500',
  },
  Premium: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    badge: 'bg-purple-600',
  },
};
