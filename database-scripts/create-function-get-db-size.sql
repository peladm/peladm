-- =====================================================
-- FUNÇÃO PARA RETORNAR TAMANHO REAL DAS TABELAS
-- Execute este script no BANCO DEDICADO DO CLIENTE
-- =====================================================

-- Criar função que retorna tamanho de todas as tabelas
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
GRANT EXECUTE ON FUNCTION get_tables_size() TO anon;
GRANT EXECUTE ON FUNCTION get_tables_size() TO authenticated;

-- Testar a função
SELECT * FROM get_tables_size();

-- =====================================================
-- MENSAGEM FINAL
-- =====================================================
SELECT '✅ Função get_tables_size() criada com sucesso!' as mensagem;
