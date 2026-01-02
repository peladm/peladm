-- ========================================
-- FUNÇÕES RPC PARA BANCO DEDICADO
-- Execute este SQL no banco dedicado do cliente
-- ========================================

-- Função 1: Obter tamanho total do banco
CREATE OR REPLACE FUNCTION get_database_total_size()
RETURNS TABLE (
  total_size_bytes BIGINT,
  total_size_formatted TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pg_database_size(current_database()) AS total_size_bytes,
    pg_size_pretty(pg_database_size(current_database())) AS total_size_formatted;
END;
$$;

-- Função 2: Obter tamanho de cada tabela
CREATE OR REPLACE FUNCTION get_tables_size()
RETURNS TABLE (
  tablename TEXT,
  row_count BIGINT,
  total_size BIGINT,
  table_size TEXT,
  indexes_size TEXT,
  total_size_formatted TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ('public.' || t.tablename)::TEXT AS tablename,
    (SELECT COUNT(*) FROM public.jogadores WHERE t.tablename = 'jogadores')::BIGINT +
    (SELECT COUNT(*) FROM public.sessoes WHERE t.tablename = 'sessoes')::BIGINT +
    (SELECT COUNT(*) FROM public.fila WHERE t.tablename = 'fila')::BIGINT +
    (SELECT COUNT(*) FROM public.jogos WHERE t.tablename = 'jogos')::BIGINT +
    (SELECT COUNT(*) FROM public.gols WHERE t.tablename = 'gols')::BIGINT +
    (SELECT COUNT(*) FROM public.fila_snapshot WHERE t.tablename = 'fila_snapshot')::BIGINT AS row_count,
    pg_total_relation_size('public.' || t.tablename) AS total_size,
    pg_size_pretty(pg_table_size('public.' || t.tablename)) AS table_size,
    pg_size_pretty(pg_indexes_size('public.' || t.tablename)) AS indexes_size,
    pg_size_pretty(pg_total_relation_size('public.' || t.tablename)) AS total_size_formatted
  FROM pg_tables t
  WHERE t.schemaname = 'public'
  AND t.tablename IN ('jogadores', 'sessoes', 'fila', 'jogos', 'gols', 'fila_snapshot')
  ORDER BY pg_total_relation_size('public.' || t.tablename) DESC;
END;
$$;

-- Conceder permissões de execução para usuários autenticados
GRANT EXECUTE ON FUNCTION get_database_total_size() TO authenticated;
GRANT EXECUTE ON FUNCTION get_tables_size() TO authenticated;
GRANT EXECUTE ON FUNCTION get_database_total_size() TO anon;
GRANT EXECUTE ON FUNCTION get_tables_size() TO anon;

-- ========================================
-- INSTRUÇÕES:
-- 1. Abra o SQL Editor do banco dedicado do cliente
-- 2. Cole e execute este SQL completo
-- 3. Verifique se as funções foram criadas com sucesso
-- 4. Teste no dashboard clicando em 🔄 Atualizar
-- ========================================
