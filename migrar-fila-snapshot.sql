-- ========================================
-- MIGRAÇÃO: Remover VIEW antiga e adicionar fila_snapshot
-- ========================================
-- Execute este SQL no banco de dados (principal ou dedicado)
-- para limpar estruturas antigas e adicionar a tabela correta

-- 1. REMOVER VIEW ANTIGA (se existir)
DROP VIEW IF EXISTS vw_estatisticas_jogadores CASCADE;

-- 2. CRIAR TABELA fila_snapshot (se não existir)
CREATE TABLE IF NOT EXISTS fila_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pelada_id TEXT NOT NULL,
  sessao_id UUID NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('pre_jogo', 'pos_jogo')),
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar foreign key se a tabela sessoes existir
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sessoes') THEN
    ALTER TABLE fila_snapshot 
    DROP CONSTRAINT IF EXISTS fila_snapshot_sessao_id_fkey;
    
    ALTER TABLE fila_snapshot
    ADD CONSTRAINT fila_snapshot_sessao_id_fkey
    FOREIGN KEY (sessao_id) REFERENCES sessoes(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. CRIAR ÍNDICES (se não existirem)
CREATE INDEX IF NOT EXISTS idx_fila_snapshot_sessao ON fila_snapshot(sessao_id);
CREATE INDEX IF NOT EXISTS idx_fila_snapshot_pelada ON fila_snapshot(pelada_id);
CREATE INDEX IF NOT EXISTS idx_fila_snapshot_tipo ON fila_snapshot(sessao_id, tipo);
CREATE INDEX IF NOT EXISTS idx_fila_snapshot_data ON fila_snapshot(created_at DESC);

-- 4. HABILITAR RLS
ALTER TABLE fila_snapshot ENABLE ROW LEVEL SECURITY;

-- 5. CRIAR POLÍTICA (se não existir)
DROP POLICY IF EXISTS "Acesso público fila_snapshot" ON fila_snapshot;
CREATE POLICY "Acesso público fila_snapshot" ON fila_snapshot FOR ALL USING (true);

-- ========================================
-- COMENTÁRIOS
-- ========================================
COMMENT ON TABLE fila_snapshot IS 'Snapshots da fila para funcionalidade de desfazer';
COMMENT ON COLUMN fila_snapshot.tipo IS 'Tipo do snapshot: pre_jogo (antes de iniciar) ou pos_jogo (depois de finalizar)';
COMMENT ON COLUMN fila_snapshot.snapshot IS 'JSON com o estado completo da fila naquele momento';

-- ========================================
-- VERIFICAÇÃO
-- ========================================
SELECT 
  tablename,
  schemaname
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'fila_snapshot';

-- ✅ Migração concluída!
