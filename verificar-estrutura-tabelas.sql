-- =====================================================
-- SCRIPT PARA VERIFICAR ESTRUTURA DAS TABELAS
-- =====================================================

-- 1. ESTRUTURA DA TABELA SESSOES
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'sessoes'
ORDER BY ordinal_position;

-- 2. VERIFICAR SESSÕES ATIVAS (PROBLEMA ATUAL)
SELECT 
    id,
    pelada_id,
    status,
    data,
    created_at
FROM sessoes
WHERE status = 'ativa'
ORDER BY created_at DESC;

-- 3. ESTRUTURA DA TABELA FILA
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'fila'
ORDER BY ordinal_position;

-- 4. ESTRUTURA DA TABELA JOGADORES
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'jogadores'
ORDER BY ordinal_position;

-- 5. ESTRUTURA DA TABELA REGRAS
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'regras'
ORDER BY ordinal_position;

-- =====================================================
-- VERIFICAR DADOS ATUAIS
-- =====================================================

-- 6. CONTAR SESSÕES POR STATUS
SELECT 
    status,
    COUNT(*) as quantidade
FROM sessoes
GROUP BY status;

-- 7. CONTAR JOGADORES NA FILA POR STATUS
SELECT 
    status,
    COUNT(*) as quantidade
FROM fila
GROUP BY status;

-- 8. VERIFICAR FOREIGN KEYS
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name IN ('sessoes', 'fila', 'jogadores', 'regras')
ORDER BY tc.table_name, tc.constraint_name;
