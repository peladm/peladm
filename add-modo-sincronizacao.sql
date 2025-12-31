-- Adicionar campo modo_sincronizacao na tabela regras
-- Permite que Gold/Premium escolham entre sync em tempo real ou local-first

-- 1. Adicionar coluna modo_sincronizacao
ALTER TABLE regras
ADD COLUMN IF NOT EXISTS modo_sincronizacao TEXT DEFAULT 'tempo_real' 
CHECK (modo_sincronizacao IN ('tempo_real', 'local_first'));

-- 2. Comentário da coluna
COMMENT ON COLUMN regras.modo_sincronizacao IS 
'Modo de sincronização: tempo_real (multi-user, sync contínuo) ou local_first (mais rápido, sync ao finalizar)';

-- 3. Verificar se foi criada
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'regras' AND column_name = 'modo_sincronizacao';

-- 4. Atualizar registros existentes para tempo_real (padrão atual)
UPDATE regras
SET modo_sincronizacao = 'tempo_real'
WHERE modo_sincronizacao IS NULL;

-- 5. Verificação final
SELECT pelada_id, modo_sincronizacao 
FROM regras 
LIMIT 5;
