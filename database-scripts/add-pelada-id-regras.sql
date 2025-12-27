-- Adicionar coluna pelada_id na tabela regras
-- Este script deve ser executado no banco de dados Supabase

-- 1. Adicionar coluna pelada_id (se não existir)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'regras' AND column_name = 'pelada_id'
    ) THEN
        ALTER TABLE regras 
        ADD COLUMN pelada_id UUID NOT NULL;
        
        RAISE NOTICE 'Coluna pelada_id adicionada à tabela regras';
    ELSE
        RAISE NOTICE 'Coluna pelada_id já existe na tabela regras';
    END IF;
END $$;

-- 2. Adicionar foreign key para a tabela clientes (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'regras_pelada_id_fkey'
    ) THEN
        ALTER TABLE regras
        ADD CONSTRAINT regras_pelada_id_fkey 
        FOREIGN KEY (pelada_id) 
        REFERENCES clientes(id) 
        ON DELETE CASCADE;
        
        RAISE NOTICE 'Foreign key regras_pelada_id_fkey criada';
    ELSE
        RAISE NOTICE 'Foreign key regras_pelada_id_fkey já existe';
    END IF;
END $$;

-- 3. Criar índice para melhorar performance das buscas (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_regras_pelada'
    ) THEN
        CREATE INDEX idx_regras_pelada ON regras(pelada_id);
        
        RAISE NOTICE 'Índice idx_regras_pelada criado';
    ELSE
        RAISE NOTICE 'Índice idx_regras_pelada já existe';
    END IF;
END $$;

-- 4. Verificar a estrutura final
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'regras'
ORDER BY ordinal_position;
