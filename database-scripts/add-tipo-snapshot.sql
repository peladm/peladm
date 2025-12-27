-- Adicionar campo 'tipo' na tabela fila_snapshot
-- Permite diferenciar snapshots de partida e de edição

-- 1. Adicionar coluna tipo
ALTER TABLE fila_snapshot 
ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) DEFAULT 'partida';

-- 2. Atualizar registros existentes (caso haja) para tipo 'partida'
UPDATE fila_snapshot 
SET tipo = 'partida' 
WHERE tipo IS NULL;

-- 3. Tornar o campo obrigatório
ALTER TABLE fila_snapshot 
ALTER COLUMN tipo SET NOT NULL;

-- 4. Adicionar constraint para aceitar apenas valores válidos
ALTER TABLE fila_snapshot 
ADD CONSTRAINT fila_snapshot_tipo_check 
CHECK (tipo IN ('partida', 'edicao'));

-- 5. Criar índice para melhorar performance nas buscas por tipo
CREATE INDEX IF NOT EXISTS idx_fila_snapshot_tipo 
ON fila_snapshot(pelada_id, tipo);

-- Verificar estrutura atualizada
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'fila_snapshot'
ORDER BY ordinal_position;
