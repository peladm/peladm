-- ========================================
-- EXTRAIR ESTRUTURA COMPLETA DA TABELA SESSOES
-- ========================================
-- Execute este SQL no BANCO PRINCIPAL
-- e me envie o resultado completo

-- 1. ESTRUTURA DAS COLUNAS
SELECT 
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'sessoes'
ORDER BY ordinal_position;

-- 2. CONSTRAINTS E CHECKS
SELECT 
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.check_constraints cc
  ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'sessoes'
ORDER BY tc.constraint_type, tc.constraint_name;

-- 3. ÍNDICES
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'sessoes'
ORDER BY indexname;

-- ========================================
-- Me envie os 3 resultados acima
-- ========================================
