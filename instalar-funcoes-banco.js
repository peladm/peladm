const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ewcswczqvelhlwpbraea.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Y3N3Y3pxdmVsaGx3cGJyYWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2Mzc1MzksImV4cCI6MjA4MDIxMzUzOX0.DRzgAuj171lUG_7wMVCFhuDH71sGxlHHEB28qBN9wks'
);

async function instalarFuncoes() {
  console.log('🔧 Instalando funções SQL no banco de dados...\n');

  // FUNÇÃO 1: get_database_total_size
  const sql1 = `
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
  `;

  // FUNÇÃO 2: get_tables_size
  const sql2 = `
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
        AND t.tablename IN ('jogadores', 'sessoes', 'fila', 'jogos', 'gols', 'regras', 'fila_snapshot', 'clientes', 'usuarios')
        ORDER BY total_size DESC;
    END;
    $$;
  `;

  // PERMISSÕES
  const sql3 = `
    GRANT EXECUTE ON FUNCTION get_database_total_size() TO anon;
    GRANT EXECUTE ON FUNCTION get_database_total_size() TO authenticated;
    GRANT EXECUTE ON FUNCTION get_tables_size() TO anon;
    GRANT EXECUTE ON FUNCTION get_tables_size() TO authenticated;
  `;

  try {
    // Executar via RPC direto
    console.log('⚠️  AVISO: Não é possível criar funções via API anon key.');
    console.log('📋 Copie e execute o SQL abaixo no SQL Editor do Supabase:\n');
    console.log('=' .repeat(60));
    console.log(sql1);
    console.log(sql2);
    console.log(sql3);
    console.log('=' .repeat(60));
    console.log('\n🌐 Acesse: https://supabase.com/dashboard/project/ewcswczqvelhlwpbraea/sql/new');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

instalarFuncoes();
