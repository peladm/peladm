-- ============================================================
-- SCRIPT COMPLETO: CRIAR TODAS AS TABELAS DO BANCO DEDICADO
-- Data: 10/05/2026
-- Versão: 2.3 - Regras centralizadas no banco master
-- ============================================================
-- TABELAS: jogadores, sessoes, jogos, gols
-- STATUS: Pronto para usar em novo banco dedicado Premium
-- ============================================================

-- 1️⃣ TABELA: JOGADORES
-- ============================================================
CREATE TABLE IF NOT EXISTS jogadores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(100) NOT NULL,
    nivel INTEGER NOT NULL,
    pelada_id TEXT NOT NULL,
    status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
    foto_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    posicao TEXT
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_jogadores_pelada_id ON jogadores(pelada_id);
CREATE INDEX IF NOT EXISTS idx_jogadores_status ON jogadores(status);

-- 🔓 Desabilitar RLS
ALTER TABLE jogadores DISABLE ROW LEVEL SECURITY;

-- 2️⃣ TABELA: SESSÕES
-- ============================================================
CREATE TABLE IF NOT EXISTS sessoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pelada_id TEXT NOT NULL,
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'finalizada')),
    total_jogadores INTEGER DEFAULT 0,
    vitorias_consecutivas INTEGER DEFAULT 0,
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_sessoes_pelada ON sessoes(pelada_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_data ON sessoes(data);
CREATE INDEX IF NOT EXISTS idx_sessoes_status ON sessoes(status);

-- 🔓 Desabilitar RLS
ALTER TABLE sessoes DISABLE ROW LEVEL SECURITY;

-- 3️⃣ TABELA: JOGOS
-- ============================================================
CREATE TABLE IF NOT EXISTS jogos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sessao_id UUID NOT NULL,
    numero_jogo INTEGER NOT NULL,
    time_a JSONB NOT NULL,
    time_b JSONB NOT NULL,
    placar_a INTEGER DEFAULT 0,
    placar_b INTEGER DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando', 'em_andamento', 'finalizado')),
    time_vencedor VARCHAR(10) CHECK (time_vencedor IN ('A', 'B', 'empate', NULL)),
    tempo_decorrido INTEGER DEFAULT 0,
    data_inicio TIMESTAMPTZ,
    data_fim TIMESTAMPTZ,
    substituicoes JSONB,
    cor_time_a TEXT,
    cor_time_b TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_jogos_sessao ON jogos(sessao_id);
CREATE INDEX IF NOT EXISTS idx_jogos_numero ON jogos(numero_jogo);
CREATE INDEX IF NOT EXISTS idx_jogos_status ON jogos(status);

-- 🔓 Desabilitar RLS
ALTER TABLE jogos DISABLE ROW LEVEL SECURITY;

-- 4️⃣ TABELA: GOLS
-- ============================================================
CREATE TABLE IF NOT EXISTS gols (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jogo_id TEXT NOT NULL,
    jogador_id TEXT NOT NULL,
    gol_contra_jogador_id UUID,
    assistencia TEXT,
    time VARCHAR(1) NOT NULL CHECK (time IN ('A', 'B')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_gols_jogo ON gols(jogo_id);
CREATE INDEX IF NOT EXISTS idx_gols_jogador ON gols(jogador_id);
CREATE INDEX IF NOT EXISTS idx_gols_gol_contra_jogador_id ON gols(gol_contra_jogador_id);
CREATE INDEX IF NOT EXISTS idx_gols_assistencia ON gols(assistencia);
CREATE INDEX IF NOT EXISTS idx_gols_time ON gols(time);

-- 🔓 Desabilitar RLS
ALTER TABLE gols DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- ✅ PRONTO! Todas as 4 tabelas criadas e configuradas
-- ============================================================
-- Tabelas criadas:
--   ✓ jogadores
--   ✓ sessoes
--   ✓ jogos
--   ✓ gols
--
-- Recursos:
--   ✓ RLS desabilitado em todas as tabelas
--   ✓ Índices otimizados
--   ✓ Constraints validados
--
-- Próximos passos:
--   1. Sincronizar código com getClienteSupabase()
--   2. Testar inserção de dados
--   3. Configurar backup automático
-- ============================================================

-- 6️⃣ FUNÇÃO RPC: GET DATABASE TOTAL SIZE
-- ============================================================
CREATE OR REPLACE FUNCTION get_database_total_size()
RETURNS TABLE(total_size_bytes bigint, total_size_formatted text) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pg_database_size(current_database())::bigint,
    pg_size_pretty(pg_database_size(current_database()))::text;
END;
$$ LANGUAGE plpgsql;

-- 7️⃣ FUNÇÃO RPC: GET TABLES SIZE
-- ============================================================
CREATE OR REPLACE FUNCTION get_tables_size()
RETURNS TABLE(tablename text, total_size bigint, row_count bigint) AS $$
SELECT 
  t.tablename,
  pg_total_relation_size(('public.' || t.tablename)::regclass),
  0 as row_count
FROM pg_tables t
WHERE t.schemaname = 'public'
ORDER BY pg_total_relation_size(('public.' || t.tablename)::regclass) DESC;
$$ LANGUAGE sql;

-- Conceder permissão de execução para ambas as funções
GRANT EXECUTE ON FUNCTION get_database_total_size() TO anon;
GRANT EXECUTE ON FUNCTION get_database_total_size() TO authenticated;
GRANT EXECUTE ON FUNCTION get_tables_size() TO anon;
GRANT EXECUTE ON FUNCTION get_tables_size() TO authenticated;
