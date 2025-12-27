-- Função para retornar o tamanho de cada tabela no schema public
-- Execute este SQL no SQL Editor do Supabase de cada cliente

CREATE OR REPLACE FUNCTION get_table_sizes()
RETURNS TABLE (
  tablename text,
  size text,
  size_bytes bigint
) 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    t.tablename::text,
    pg_size_pretty(pg_total_relation_size(quote_ident(t.schemaname) || '.' || quote_ident(t.tablename)))::text AS size,
    pg_total_relation_size(quote_ident(t.schemaname) || '.' || quote_ident(t.tablename))::bigint AS size_bytes
  FROM pg_tables t
  WHERE t.schemaname = 'public'
  ORDER BY pg_total_relation_size(quote_ident(t.schemaname) || '.' || quote_ident(t.tablename)) DESC;
END;
$function$;

-- Comentário explicativo
COMMENT ON FUNCTION get_table_sizes() IS 'Retorna o tamanho de todas as tabelas do schema public ordenadas por tamanho';
