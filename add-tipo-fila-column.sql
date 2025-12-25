-- Adicionar coluna tipo_fila na tabela regras
ALTER TABLE regras ADD COLUMN IF NOT EXISTS tipo_fila TEXT DEFAULT 'fila2';

-- Comentário explicativo
COMMENT ON COLUMN regras.tipo_fila IS 'Tipo de fila: fila1 (premium) ou fila2 (free/gold/premium). Free/Gold só podem usar fila2.';

-- Atualizar registros existentes para fila2 (padrão para todos)
UPDATE regras SET tipo_fila = 'fila2' WHERE tipo_fila IS NULL;
