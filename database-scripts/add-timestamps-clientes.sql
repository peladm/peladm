-- Adicionar colunas de timestamp na tabela clientes

-- 1. Adicionar coluna de data de criação (se não existir)
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Adicionar coluna de último acesso
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS last_access TIMESTAMPTZ DEFAULT NOW();

-- 3. Atualizar created_at para registros antigos (usar data atual como fallback)
UPDATE clientes 
SET created_at = NOW() 
WHERE created_at IS NULL;

-- 4. Verificar estrutura
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'clientes' 
AND column_name IN ('created_at', 'last_access')
ORDER BY ordinal_position;
