-- ========================================
-- RECRIAR TABELA SESSOES NO BANCO DEDICADO
-- ========================================
-- Execute este SQL no BANCO DEDICADO
-- para deixar a tabela igual ao banco principal

-- 1. DROPAR TABELA EXISTENTE (cuidado: apaga dados!)
DROP TABLE IF EXISTS sessoes CASCADE;

-- 2. CRIAR TABELA COM ESTRUTURA CORRETA
CREATE TABLE sessoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pelada_id TEXT NOT NULL,
  data DATE DEFAULT CURRENT_DATE,
  status VARCHAR(20) DEFAULT 'ativa',
  total_jogadores INTEGER DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  vitorias_consecutivas INTEGER DEFAULT 0
);

-- 3. CRIAR ÍNDICES
CREATE INDEX idx_sessoes_data ON sessoes USING btree (data);
CREATE UNIQUE INDEX idx_sessoes_pelada_ativa_unica ON sessoes USING btree (pelada_id, data) WHERE status::text = 'ativa'::text;
CREATE INDEX idx_sessoes_pelada_data ON sessoes USING btree (pelada_id, data);
CREATE INDEX idx_sessoes_pelada_id ON sessoes USING btree (pelada_id);
CREATE INDEX idx_sessoes_pelada_status ON sessoes USING btree (pelada_id, status);
CREATE INDEX idx_sessoes_status ON sessoes USING btree (status);

-- 4. HABILITAR RLS
ALTER TABLE sessoes ENABLE ROW LEVEL SECURITY;

-- 5. CRIAR POLÍTICA DE ACESSO
CREATE POLICY "Acesso público sessoes" ON sessoes FOR ALL USING (true);

-- 6. VERIFICAÇÃO
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'sessoes'
ORDER BY ordinal_position;

-- ✅ Deve mostrar as 9 colunas:
-- id, pelada_id, data, status, total_jogadores, observacoes, 
-- created_at, updated_at, vitorias_consecutivas
