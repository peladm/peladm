-- =========================================
-- TABELA: fila_snapshot
-- =========================================
-- DESCRIÇÃO: Snapshot da fila inicial para restauração
-- ARMAZENAMENTO: localStorage (apenas Gold/Premium)
-- DEPLOY: NUNCA (deletado ao encerrar pelada)
-- ⚠️ IMPORTANTE: Esta tabela é APENAS local (localStorage)
-- NÃO deve ser criada no Supabase
-- ===========================================

CREATE TABLE IF NOT EXISTS fila_snapshot (
  -- Identificação
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pelada_id TEXT NOT NULL,
  
  -- Snapshot (estado completo da fila em JSON)
  snapshot_data JSONB NOT NULL, -- Toda a fila serializada
  
  -- Metadados
  tipo VARCHAR(20) DEFAULT 'inicial' CHECK (tipo IN ('inicial', 'manual')),
  
  -- Auditoria
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_fila_snapshot_pelada ON fila_snapshot(pelada_id);
CREATE INDEX IF NOT EXISTS idx_fila_snapshot_tipo ON fila_snapshot(tipo);

-- =========================================
-- OBSERVAÇÕES:
-- =========================================
-- 1. Free: NÃO EXISTE (recurso exclusivo Gold/Premium)
-- 2. Gold/Premium: localStorage - deletado ao encerrar pelada
-- 3. NUNCA faz deploy (todos os planos)
-- 4. snapshot_data: JSONB com array completo da fila_ativa
-- 5. tipo 'inicial': criado ao confirmar times
-- 6. tipo 'manual': criado quando usuário salva manualmente
-- 7. Permite restaurar fila ao estado anterior
