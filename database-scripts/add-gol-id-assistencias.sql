-- Adiciona coluna gol_id na tabela assistencias
-- Vincula cada assistência ao gol correspondente

ALTER TABLE assistencias
  ADD COLUMN IF NOT EXISTS gol_id TEXT REFERENCES gols(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assistencias_gol_id ON assistencias(gol_id);
