-- ========================================
-- EXTRAIR ESTRUTURA DE TODAS AS TABELAS
-- ========================================
-- Execute este SQL no BANCO PRINCIPAL
-- e me envie os resultados

-- 1. TABELA JOGADORES
SELECT 'JOGADORES' as tabela, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'jogadores'
ORDER BY ordinal_position;

-- 2. TABELA FILA
SELECT 'FILA' as tabela, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'fila'
ORDER BY ordinal_position;

-- 3. TABELA JOGOS
SELECT 'JOGOS' as tabela, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'jogos'
ORDER BY ordinal_position;

-- 4. TABELA GOLS
SELECT 'GOLS' as tabela, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'gols'
ORDER BY ordinal_position;

-- 5. TABELA FILA_SNAPSHOT
SELECT 'FILA_SNAPSHOT' as tabela, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'fila_snapshot'
ORDER BY ordinal_position;

-- ========================================
-- Me envie os 5 resultados
-- ========================================
