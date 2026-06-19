-- ================================================
-- ESTRUTURA DA TABELA REGRAS
-- Banco: Supabase Principal (ewcswczqvelhlwpbraea)
-- Data: 03/01/2026
-- ================================================

CREATE TABLE IF NOT EXISTS regras (
  pelada_id TEXT PRIMARY KEY NOT NULL,
  jogadores_por_time INTEGER,
  modelo_sorteio VARCHAR,
  duracao INTEGER,
  fila_automatizada BOOLEAN,
  vitorias_consecutivas INTEGER,
  prioridade_retorno VARCHAR,
  regra_empate VARCHAR,
  regra_apos_empate VARCHAR,
  tipo_fila TEXT,
  empate_conta_vitoria BOOLEAN,
  modo_sincronizacao VARCHAR,
  cores_coletes TEXT[]
);

-- ================================================
-- ÍNDICES
-- ================================================
-- PRIMARY KEY já cria índice automático em pelada_id

-- ================================================
-- CONSTRAINTS E VALIDAÇÕES
-- ================================================
-- pelada_id: NOT NULL (chave primária)
-- Demais campos: Podem ser NULL

-- ================================================
-- VALORES ACEITOS
-- ================================================
-- modelo_sorteio: 'equilibrado' | 'aleatorio'
-- prioridade_retorno: 'prioridade' | 'sem_prioridade' | 'mesclar' | 'perdedor_continua'
-- regra_empate: 'ambos_saem' | 'desempate'
-- regra_apos_empate: 'desempate_decide' | 'mesclar_times'
-- tipo_fila: 'modo_partida' | 'modo_prancheta'
-- empate_conta_vitoria: true | false

-- ================================================
-- DESCRIÇÃO DOS CAMPOS
-- ================================================
-- pelada_id: Identificador único da pelada (chave primária)
-- jogadores_por_time: Quantidade de jogadores por time (3 a 11)
-- modelo_sorteio: Tipo de sorteio usado
-- duracao: Duração da partida em minutos
-- fila_automatizada: Se a fila deve ser automatizada (true) ou manual (false)
-- vitorias_consecutivas: Limite de vitórias consecutivas (0 = sem limite, 1-10 = com limite)
-- prioridade_retorno: Como lidar com times perdedores na fila
-- regra_empate: O que acontece em caso de empate
-- regra_apos_empate: Como resolver após empate
-- tipo_fila: Modo de gerenciamento da fila
-- empate_conta_vitoria: Se empate conta como vitória consecutiva
-- modo_sincronizacao: Tipo de sincronização com Supabase (ex: 'auto', 'manual')
-- cores_coletes: Array com cores dos coletes disponíveis (ex: ARRAY['vermelho', 'amarelo'])

-- ================================================
-- REGRAS DE NEGÓCIO
-- ================================================
-- 1. Cada pelada_id tem apenas UMA configuração de regras
-- 2. Free: salva apenas no localStorage
-- 3. Gold/Premium: salva no Supabase Principal + cache local
-- 4. Usa UPSERT para inserir/atualizar (ON CONFLICT pelada_id)
-- 5. Não pode alterar regras com sessão ativa
