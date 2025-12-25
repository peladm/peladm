-- Criar tabela para snapshot da fila
CREATE TABLE fila_snapshot (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pelada_id TEXT NOT NULL,
  snapshot_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Adicionar índice para busca rápida por pelada_id
CREATE INDEX idx_fila_snapshot_pelada ON fila_snapshot(pelada_id);
