-- ========================================
-- CRIAR FUNÇÕES RPC PARA MONITORAMENTO DE BANCO
-- ========================================
-- Execute este SQL no Supabase SQL Editor de cada cliente

-- Função para obter tamanho total do banco
CREATE OR REPLACE FUNCTION get_database_total_size()
RETURNS TABLE(total_size_bytes bigint, total_size_formatted text) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pg_database_size(current_database())::bigint,
    pg_size_pretty(pg_database_size(current_database()))::text;
END;
$$ LANGUAGE plpgsql;

-- Função para obter tamanho de cada tabela com contagem de linhas
CREATE OR REPLACE FUNCTION get_tables_size()
RETURNS TABLE(tablename text, total_size bigint, row_count bigint) AS $$
DECLARE
  v_table record;
BEGIN
  FOR v_table IN
    SELECT schemaname, tablename 
    FROM pg_tables 
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY tablename
  LOOP
    RETURN QUERY
    SELECT 
      v_table.schemaname || '.' || v_table.tablename,
      pg_total_relation_size(v_table.schemaname || '.' || v_table.tablename),
      (SELECT COUNT(*) FROM (SELECT 1 FROM (v_table.schemaname || '.' || v_table.tablename)::regclass) AS t)
    ;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Versão simplificada e mais confiável da função get_tables_size
CREATE OR REPLACE FUNCTION get_tables_size()
RETURNS TABLE(tablename text, total_size bigint, row_count bigint) AS $$
SELECT 
  schemaname || '.' || tablename AS tablename,
  pg_total_relation_size(schemaname || '.' || tablename) AS total_size,
  n_live_tup AS row_count
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;
$$ LANGUAGE sql;

-- Conceder permissão de execução para o role anon (cliente anônimo)
GRANT EXECUTE ON FUNCTION get_database_total_size() TO anon;
GRANT EXECUTE ON FUNCTION get_tables_size() TO anon;
