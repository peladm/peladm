-- ========================================
-- CRIAR FUNÇÕES RPC PARA MONITORAMENTO DE BANCO
-- ========================================
-- Execute este SQL no Supabase SQL Editor

-- Limpeza de funções antigas (evita erro 42P13 ao mudar tipo de retorno)
DROP FUNCTION IF EXISTS public.get_tables_size();
DROP FUNCTION IF EXISTS public.get_database_total_size();

-- 1) Tamanho total do banco atual
CREATE OR REPLACE FUNCTION get_database_total_size()
RETURNS TABLE(total_size_bytes bigint, total_size_formatted text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pg_database_size(current_database())::bigint AS total_size_bytes,
    pg_size_pretty(pg_database_size(current_database()))::text AS total_size_formatted;
$$;

-- 2) Tamanho por tabela (considera tabelas de usuário do schema public)
CREATE OR REPLACE FUNCTION get_tables_size()
RETURNS TABLE(tablename text, total_size bigint, row_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    n.nspname || '.' || c.relname AS tablename,
    pg_total_relation_size(c.oid)::bigint AS total_size,
    COALESCE(s.n_live_tup, 0)::bigint AS row_count
  FROM pg_class c
  INNER JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_stat_all_tables s ON s.relid = c.oid
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
  ORDER BY pg_total_relation_size(c.oid) DESC;
$$;

-- 3) Permissões
GRANT EXECUTE ON FUNCTION get_database_total_size() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_tables_size() TO anon, authenticated;
