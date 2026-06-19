-- =========================================
-- TABELA: sessoes
-- =========================================
-- DESCRIÇÃO: Sessões de pelada (uma sessão por dia/evento)
-- ARMAZENAMENTO: localStorage (todos os planos)
-- DEPLOY: Apenas Premium (ao encerrar pelada)
-- =========================================

CREATE TABLE IF NOT EXISTS sessoes (
  -- Identificação
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pelada_id TEXT NOT NULL,
  
  -- Dados da Sessão
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'finalizada')),
  
  -- Estatísticas
  total_jogadores INTEGER DEFAULT 0,
  vitorias_consecutivas INTEGER DEFAULT 0,
  
  -- Observações
  observacoes TEXT,
  
  -- Auditoria
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_sessoes_pelada ON sessoes(pelada_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_data ON sessoes(data);
CREATE INDEX IF NOT EXISTS idx_sessoes_status ON sessoes(status);

-- 🔒 Segurança: Desabilitar RLS (sem restrições)
ALTER TABLE sessoes DISABLE ROW LEVEL SECURITY;

-- =========================================
-- OBSERVAÇÕES:
-- =========================================
-- 1. Free: localStorage - deletada ao encerrar pelada
-- 2. Gold: localStorage - deletada ao encerrar pelada (sem deploy)
-- 3. Premium: localStorage → deploy ao encerrar (para estatísticas)
-- 4. Uma sessão ativa por dia por pelada
-- 5. vitorias_consecutivas: contador de vitórias seguidas do Time 1
