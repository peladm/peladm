// Contrato único de permissões da aplicação.
// As decisões de acesso são calculadas em tempo de execução por cliente/acessos ativos.

export interface Permissoes {
  // Recursos gerais
  usarSupabase: boolean;
  bancoExclusivo: boolean;
  multiUsuario: boolean;

  // Cadastro
  cadastrarNivel: boolean;
  limiteJogadores: number | null;
  limitePartidas: number | null;
  limiteUsuarios: number | null;

  // Sorteio
  sorteioEquilibrado: boolean;
  sorteioManual: boolean;

  // Fila e Partida
  usarPaginaPartida: boolean;
  permitirSubstituicoes: boolean;
  usarCronometro: boolean;
  desfazerPartida: boolean;
  usarModoPartida: boolean;

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
  deployAoEncerrar: boolean;
}
