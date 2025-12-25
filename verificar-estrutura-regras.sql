-- ============================================
-- VERIFICAR ESTRUTURA E CONTEÚDO DA TABELA REGRAS
-- ============================================

-- 1. Ver estrutura da tabela (colunas e tipos)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'regras'
ORDER BY ordinal_position;

-- 2. Ver TODOS os registros da tabela regras
SELECT * FROM regras;

-- 3. Ver apenas as colunas importantes
SELECT 
  pelada_id,
  jogadores_por_time,
  vitorias_consecutivas,
  prioridade_retorno,
  regra_empate,
  regra_apos_empate,
  empate_conta_vitoria,
  tipo_fila
FROM regras;

-- 4. Verificar se a coluna prioridade_retorno existe e tem constraint
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'regras'::regclass
  AND conname LIKE '%prioridade%';

-- 5. Ver valores únicos de prioridade_retorno (para verificar se há valores errados)
SELECT DISTINCT prioridade_retorno 
FROM regras;
