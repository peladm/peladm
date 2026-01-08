CREATE OR REPLACE FUNCTION get_database_total_size()
RETURNS TABLE (
    size_bytes BIGINT,
    size_mb NUMERIC,
    size_gb NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pg_database_size(current_database())::BIGINT as size_bytes,
        ROUND((pg_database_size(current_database()) / 1024.0 / 1024.0)::NUMERIC, 2) as size_mb,
        ROUND((pg_database_size(current_database()) / 1024.0 / 1024.0 / 1024.0)::NUMERIC, 4) as size_gb;
END;
$$;

CREATE OR REPLACE FUNCTION get_tables_size()
RETURNS TABLE (
    table_name TEXT,
    size_bytes BIGINT,
    size_kb NUMERIC,
    size_mb NUMERIC,
    row_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.tablename::TEXT as table_name,
        pg_total_relation_size(quote_ident(t.tablename)::regclass)::BIGINT as size_bytes,
        ROUND((pg_total_relation_size(quote_ident(t.tablename)::regclass) / 1024.0)::NUMERIC, 2) as size_kb,
        ROUND((pg_total_relation_size(quote_ident(t.tablename)::regclass) / 1024.0 / 1024.0)::NUMERIC, 2) as size_mb,
        (SELECT COUNT(*) FROM (SELECT 1 FROM pg_class WHERE relname = t.tablename LIMIT 1) as sub)::BIGINT as row_count
    FROM pg_tables t
    WHERE t.schemaname = 'public'
    ORDER BY pg_total_relation_size(quote_ident(t.tablename)::regclass) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_database_total_size() TO authenticated;
GRANT EXECUTE ON FUNCTION get_tables_size() TO authenticated;
GRANT EXECUTE ON FUNCTION get_database_total_size() TO anon;
GRANT EXECUTE ON FUNCTION get_tables_size() TO anon;
