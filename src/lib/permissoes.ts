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
  multipalasPeladas: boolean;
  
  // Deploy/Sincronização
  deployAoEncerrar: boolean; // Deploy para Supabase ao encerrar pelada (Gold/Premium)
}

/**
 * FLUXO DO BOTÃO "CONFIRMAR TIMES" (sorteio):
 * 
 * 1. VALIDAÇÃO OBRIGATÓRIA (todos os planos):
 *    - Verificar se existe regras_${peladaId} no localStorage
 *    - Se NÃO existir: Alertar para configurar regras primeiro
 * 
 * 2. BUSCA DE DADOS:
 *    - pelada_id e plano: localStorage via buscar_pelada_id() e buscar_plano()
 *    - regras: Sempre do localStorage (independente do plano)
 *    - jogadores:
 *      • Free: localStorage jogadores_${peladaId}
 *      • Gold/Premium: Supabase + baixa para localStorage ao Confirmar Times
 * 
 * 3. TABELAS GERADAS (TUDO LOCAL PRIMEIRO):
 *    
 *    Todos os planos (localStorage):
 *    - sessao_ativa
 *    - fila_ativa (deletada ao encerrar - SEM DEPLOY)
 *    - jogos_${sessaoId}
 *    - jogadores_${peladaId} (veja detalhes abaixo)
 *    
 *    Gold/Premium adicional (localStorage):
 *    - fila_snapshot_${sessaoId} (deletado ao encerrar - SEM DEPLOY)
 *    
 *    Premium adicional (localStorage):
 *    - gols_${sessaoId}
 * 
 * 4. TABELA JOGADORES - COMPORTAMENTO POR PLANO:
 *    
 *    Free:
 *    - Tudo local (localStorage)
 *    - Ao encerrar pelada: EXCLUÍDA (limpa do localStorage)
 *    - Força usuário a recriar jogadores na próxima pelada
 *    - SEM DEPLOY
 *    
 *    Gold:
 *    - Baixada do Supabase ao Confirmar Times
 *    - Durante fila: modo edição permite adicionar jogador não cadastrado
 *      (único momento que Gold preenche jogadores localmente)
 *    - Ao encerrar: SEM DEPLOY (Gold não armazena estatísticas)
 *    
 *    Premium:
 *    - Baixada do Supabase ao Confirmar Times
 *    - Armazena estatísticas localmente: Vitórias, Gols, Empate, Derrota
 *    - Durante fila: modo edição permite adicionar jogador não cadastrado
 *    - Ao encerrar: DEPLOY para Supabase (com estatísticas atualizadas)
 * 
 * 5. DEPLOY AO SUPABASE (apenas Premium - Gold não tem estatísticas):
 *    - Acontece APENAS ao encerrar a pelada (não ao confirmar times)
 *    - Premium: Sincroniza sessoes, jogos, gols e jogadores para Supabase
 *    - Gold: NÃO faz deploy (não armazena estatísticas)
 *    - Free: Permanece tudo local
 *    - fila e fila_snapshot: NUNCA fazem deploy (são deletados ao encerrar)
 * 
 * IMPORTANTE: Durante a fila aberta, TUDO é alimentado localmente (todos os planos)
 */

export const PERMISSOES_POR_PLANO: Record<Plano, Permissoes> = {
  Free: {
    // Recursos gerais
    usarSupabase: false, // Apenas localStorage
    bancoExclusivo: false,
    multiUsuario: false,
    
    // Cadastro
    cadastrarNivel: false, // Só nome (sem estrelas)
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
    multipalasPeladas: false,
    
    // Deploy/Sincronização
    deployAoEncerrar: false, // Free mantém tudo local
  },
  
  Gold: {
    // Recursos gerais
    usarSupabase: true, // Banco compartilhado
    bancoExclusivo: false,
    multiUsuario: true,
    
    // Cadastro
    cadastrarNivel: true, // Níveis 1-5 (bloquear nível 1)
    limiteJogadores: 50,
    limitePartidas: 40,
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
    multipalasPeladas: false, // Só 1 pelada
    
    // Deploy/Sincronização
    deployAoEncerrar: false, // Gold não armazena estatísticas (sem deploy)
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
    multipalasPeladas: true, // Múltiplas peladas
    
    // Deploy/Sincronização
    deployAoEncerrar: true, // Premium armazena estatísticas (deploy de sessoes, jogos e gols)
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
