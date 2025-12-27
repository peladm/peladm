-- =====================================================
-- FUNÇÃO PARA RETORNAR TAMANHO REAL DAS TABELAS
-- Execute este script no BANCO DEDICADO DO CLIENTE
-- =====================================================

-- FUNÇÃO 1: Tamanho TOTAL do banco (o que conta no limite)
CREATE OR REPLACE FUNCTION get_database_total_size()
RETURNS TABLE (
    total_size_bytes bigint,
    total_size_formatted text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pg_database_size(current_database())::bigint AS total_size_bytes,
        pg_size_pretty(pg_database_size(current_database()))::text AS total_size_formatted;
END;
$$;

-- FUNÇÃO 2: Tamanho por tabela (detalhamento)
CREATE OR REPLACE FUNCTION get_tables_size()
RETURNS TABLE (
    tablename text,
    row_count bigint,
    total_size bigint,
    table_size bigint,
    indexes_size bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.schemaname || '.' || t.tablename AS tablename,
        COALESCE((
            SELECT n_live_tup 
            FROM pg_stat_user_tables 
            WHERE schemaname = 'public' AND relname = t.tablename
        ), 0)::bigint AS row_count,
        pg_total_relation_size('public.' || t.tablename)::bigint AS total_size,
        pg_relation_size('public.' || t.tablename)::bigint AS table_size,
        pg_indexes_size('public.' || t.tablename)::bigint AS indexes_size
    FROM pg_catalog.pg_tables t
    WHERE t.schemaname = 'public'
    AND t.tablename IN ('jogadores', 'sessoes', 'fila', 'jogos', 'gols', 'regras', 'fila_snapshot')
    ORDER BY total_size DESC;
END;
$$;

-- Dar permissão de execução para usuários autenticados
GRANT EXECUTE ON FUNCTION get_database_total_size() TO anon;
GRANT EXECUTE ON FUNCTION get_database_total_size() TO authenticated;
GRANT EXECUTE ON FUNCTION get_tables_size() TO anon;
GRANT EXECUTE ON FUNCTION get_tables_size() TO authenticated;

-- Testar as funções
SELECT * FROM get_database_total_size();
SELECT * FROM get_tables_size();

-- =====================================================
-- MENSAGEM FINAL
-- =====================================================
SELECT '✅ Funções criadas com sucesso!' as mensagem;
