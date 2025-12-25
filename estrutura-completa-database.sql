-- ============================================
-- ESTRUTURA COMPLETA DO BANCO DE DADOS
-- ============================================

-- 1. LISTAR TODAS AS TABELAS
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. ESTRUTURA DETALHADA - TABELA CLIENTES
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'clientes'
ORDER BY ordinal_position;

-- 3. ESTRUTURA DETALHADA - TABELA USUARIOS
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'usuarios'
ORDER BY ordinal_position;

-- 4. ESTRUTURA DETALHADA - TABELA SESSOES
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'sessoes'
ORDER BY ordinal_position;

-- 5. ESTRUTURA DETALHADA - TABELA JOGADORES
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'jogadores'
ORDER BY ordinal_position;

-- 6. ESTRUTURA DETALHADA - TABELA FILA
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'fila'
ORDER BY ordinal_position;

-- 7. ESTRUTURA DETALHADA - TABELA JOGOS
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'jogos'
ORDER BY ordinal_position;

-- 8. ESTRUTURA DETALHADA - TABELA GOLS
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'gols'
ORDER BY ordinal_position;

-- 9. ESTRUTURA DETALHADA - TABELA REGRAS
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'regras'
ORDER BY ordinal_position;

-- 10. VER RELACIONAMENTOS (FOREIGN KEYS)
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- 11. DADOS CLIENTES
SELECT id, nome, email, plano, supabase_anon_key IS NOT NULL as tem_key
FROM clientes
LIMIT 5;

-- 12. SESSÕES ATIVAS
SELECT id, pelada_id, status
FROM sessoes
WHERE status = 'ativa'
LIMIT 5;

-- 13. RESUMO DE DADOS
SELECT 
    'clientes' as tabela, COUNT(*) as total FROM clientes
UNION ALL
SELECT 'usuarios', COUNT(*) FROM usuarios
UNION ALL
SELECT 'sessoes', COUNT(*) FROM sessoes
UNION ALL
SELECT 'jogadores', COUNT(*) FROM jogadores
UNION ALL
SELECT 'fila', COUNT(*) FROM fila
UNION ALL
SELECT 'jogos', COUNT(*) FROM jogos
UNION ALL
SELECT 'gols', COUNT(*) FROM gols
UNION ALL
SELECT 'regras', COUNT(*) FROM regras;
