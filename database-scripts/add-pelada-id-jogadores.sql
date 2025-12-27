-- =====================================================
-- ADICIONAR COLUNA pelada_id NA TABELA jogadores
-- =====================================================

-- Verificar se a coluna já existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'jogadores' 
        AND column_name = 'pelada_id'
    ) THEN
        -- Adicionar coluna pelada_id
        ALTER TABLE jogadores 
        ADD COLUMN pelada_id UUID;
        
        RAISE NOTICE 'Coluna pelada_id adicionada com sucesso!';
    ELSE
        RAISE NOTICE 'Coluna pelada_id já existe!';
    END IF;
END $$;

-- Preencher pelada_id com base nos usuários existentes
-- Caso você tenha um único cliente/admin, pegue o ID dele:
UPDATE jogadores 
SET pelada_id = (SELECT id FROM clientes LIMIT 1)
WHERE pelada_id IS NULL;

-- Tornar a coluna NOT NULL após preencher
ALTER TABLE jogadores 
ALTER COLUMN pelada_id SET NOT NULL;

-- Criar foreign key se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'jogadores_pelada_id_fkey'
    ) THEN
        ALTER TABLE jogadores 
        ADD CONSTRAINT jogadores_pelada_id_fkey 
        FOREIGN KEY (pelada_id) 
        REFERENCES clientes(id) 
        ON DELETE CASCADE;
        
        RAISE NOTICE 'Foreign key adicionada com sucesso!';
    ELSE
        RAISE NOTICE 'Foreign key já existe!';
    END IF;
END $$;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_jogadores_pelada ON jogadores(pelada_id);

-- Verificação final
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'jogadores' 
AND column_name = 'pelada_id';

SELECT 'Migração concluída com sucesso!' as mensagem;
