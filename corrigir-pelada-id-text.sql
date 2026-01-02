-- ========================================
-- CORREÇÃO: Alterar pelada_id de UUID para TEXT
-- ========================================
-- Execute este SQL no banco DEDICADO para corrigir
-- o tipo da coluna pelada_id que aceita códigos como "GD3974"

-- 1. JOGADORES - Alterar pelada_id para TEXT
ALTER TABLE jogadores 
ALTER COLUMN pelada_id TYPE TEXT;

-- 2. GOLS - Alterar pelada_id para TEXT
ALTER TABLE gols 
ALTER COLUMN pelada_id TYPE TEXT;

-- 3. FILA_SNAPSHOT - Alterar pelada_id para TEXT
ALTER TABLE fila_snapshot 
ALTER COLUMN pelada_id TYPE TEXT;

-- 4. FILA - Alterar pelada_id para TEXT
ALTER TABLE fila 
ALTER COLUMN pelada_id TYPE TEXT;

-- 5. SESSOES - Alterar pelada_id para TEXT
ALTER TABLE sessoes 
ALTER COLUMN pelada_id TYPE TEXT;

-- ========================================
-- VERIFICAÇÃO
-- ========================================
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE column_name = 'pelada_id'
  AND table_schema = 'public'
ORDER BY table_name;

-- ✅ Deve mostrar todas como 'text' ou 'character varying'
