BEGIN;

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS data_remocao_programada DATE NULL;

ALTER TABLE clientes
  DROP CONSTRAINT IF EXISTS clientes_status_check;

ALTER TABLE clientes
  ADD CONSTRAINT clientes_status_check
  CHECK (status IN ('ativo', 'inativo', 'bloqueado', 'excluido'));

CREATE INDEX IF NOT EXISTS idx_clientes_data_remocao_programada
  ON clientes(data_remocao_programada)
  WHERE data_remocao_programada IS NOT NULL;

COMMIT;
