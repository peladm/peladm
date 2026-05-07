-- =========================================
-- TABELA: fila
-- =========================================
-- DESCRIÇÃO: Controle da fila de jogadores durante a pelada
-- ARMAZENAMENTO: localStorage (todos os planos)
-- DEPLOY: NUNCA (deletada ao encerrar pelada)
-- ⚠️ IMPORTANTE: Esta tabela é APENAS local (localStorage)
-- NÃO deve ser criada no Supabase
-- ===========================================

CREATE TABLE IF NOT EXISTS fila (
  -- Identificação
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pelada_id TEXT NOT NULL,
  sessao_id UUID NOT NULL,
  
  -- Dados do Jogador (simplificado - sem JOIN)
  nome TEXT NOT NULL,
  
  -- Status e Posição
  status VARCHAR(20) NOT NULL CHECK (status IN ('fila', 'reserva')),
  posicao_fila INTEGER NOT NULL DEFAULT 1,
  
  -- Controle de Vitórias Consecutivas
  vitorias_consecutivas_time INTEGER DEFAULT 0,
  
  -- Auditoria
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_fila_pelada_sessao ON fila(pelada_id, sessao_id);
CREATE INDEX IF NOT EXISTS idx_fila_status ON fila(status);
CREATE INDEX IF NOT EXISTS idx_fila_posicao ON fila(posicao_fila);

-- =========================================
-- OBSERVAÇÕES:
-- =========================================
-- 1. Removido jogador_id - agora usa nome direto
-- 2. Removido jogos_jogados, vitorias, gols, posicao (não usados)
-- 3. Estatísticas vão para tabela jogadores
-- 4. vitorias_consecutivas_time: apenas Time 1 (primeiras N posições) tem valor > 0
-- 5. Tabela temporária - deletada ao encerrar pelada
-- 6. Não faz deploy para Supabase (todos os planos)
