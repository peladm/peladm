-- ============================================
-- ANÁLISE COMPLETA - ESTRUTURA E DADOS
-- ============================================

-- QUERY 1: Estrutura da tabela CLIENTES
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'clientes'
ORDER BY ordinal_position;

-- QUERY 2: Dados dos clientes (verificar se tem supabase_anon_key e plano)
SELECT * FROM clientes;

-- QUERY 3: Estrutura da tabela JOGADORES
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'jogadores'
ORDER BY ordinal_position;

-- QUERY 4: Estrutura da tabela SESSOES
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'sessoes'
ORDER BY ordinal_position;

-- QUERY 5: Estrutura da tabela FILA
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'fila'
ORDER BY ordinal_position;

-- QUERY 6: Estrutura da tabela JOGOS
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'jogos'
ORDER BY ordinal_position;

-- QUERY 7: Foreign Keys (relacionamentos)
SELECT
    tc.table_name as tabela,
    kcu.column_name as coluna,
    ccu.table_name AS referencia_tabela,
    ccu.column_name AS referencia_coluna
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;
