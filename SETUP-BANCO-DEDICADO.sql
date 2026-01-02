-- =====================================================
-- 🎯 SETUP COMPLETO PARA BANCO DEDICADO PREMIUM
-- =====================================================
-- Execute este SQL no banco dedicado do cliente Premium
-- Cria todas as tabelas necessárias + funções de tamanho
-- =====================================================

-- =====================================================
-- PARTE 1: CRIAÇÃO DAS TABELAS
-- =====================================================

-- TABELA: jogadores
CREATE TABLE IF NOT EXISTS jogadores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    nivel INTEGER DEFAULT 3 CHECK (nivel >= 1 AND nivel <= 5),
    status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
    pelada_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    jogos INTEGER DEFAULT 0,
    vitorias INTEGER DEFAULT 0,
    gols INTEGER DEFAULT 0
);

-- TABELA: sessoes
CREATE TABLE IF NOT EXISTS sessoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pelada_id UUID NOT NULL,
    status TEXT DEFAULT 'ativa' CHECK (status IN ('ativa', 'finalizada')),
    data DATE DEFAULT CURRENT_DATE,
    total_jogadores INTEGER DEFAULT 0,
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA: fila
CREATE TABLE IF NOT EXISTS fila (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pelada_id UUID NOT NULL,
    sessao_id UUID NOT NULL REFERENCES sessoes(id) ON DELETE CASCADE,
    jogador_id UUID NOT NULL REFERENCES jogadores(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('fila', 'reserva')),
    posicao_fila INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(sessao_id, jogador_id)
);

-- TABELA: jogos
CREATE TABLE IF NOT EXISTS jogos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pelada_id UUID NOT NULL,
    sessao_id UUID NOT NULL REFERENCES sessoes(id) ON DELETE CASCADE,
    time_a_jogadores UUID[] NOT NULL,
    time_b_jogadores UUID[] NOT NULL,
    time_a_gols INTEGER DEFAULT 0,
    time_b_gols INTEGER DEFAULT 0,
    vencedor TEXT,
    duracao_minutos INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA: gols
CREATE TABLE IF NOT EXISTS gols (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pelada_id UUID NOT NULL,
    jogo_id UUID NOT NULL REFERENCES jogos(id) ON DELETE CASCADE,
    jogador_id UUID NOT NULL REFERENCES jogadores(id) ON DELETE CASCADE,
    time TEXT NOT NULL CHECK (time IN ('A', 'B')),
    minuto INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA: fila_snapshot
CREATE TABLE IF NOT EXISTS fila_snapshot (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pelada_id UUID NOT NULL,
    sessao_id UUID NOT NULL REFERENCES sessoes(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('pre_partida', 'durante_partida', 'pos_partida')),
    snapshot_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PARTE 2: ÍNDICES PARA PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_jogadores_pelada ON jogadores(pelada_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_pelada_status ON sessoes(pelada_id, status);
CREATE INDEX IF NOT EXISTS idx_fila_sessao ON fila(sessao_id);
CREATE INDEX IF NOT EXISTS idx_fila_status ON fila(status);
CREATE INDEX IF NOT EXISTS idx_fila_posicao ON fila(sessao_id, posicao_fila);
CREATE INDEX IF NOT EXISTS idx_jogos_sessao ON jogos(sessao_id);
CREATE INDEX IF NOT EXISTS idx_gols_jogo ON gols(jogo_id);
CREATE INDEX IF NOT EXISTS idx_gols_jogador ON gols(jogador_id);
CREATE INDEX IF NOT EXISTS idx_fila_snapshot_sessao ON fila_snapshot(sessao_id, tipo);

-- Constraint: Apenas 1 sessão ativa por pelada
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_sessao_ativa 
ON sessoes(pelada_id) 
WHERE status = 'ativa';

-- =====================================================
-- PARTE 3: FUNÇÕES RPC PARA TAMANHO DO BANCO
-- =====================================================

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

-- =====================================================
-- PARTE 4: PERMISSÕES
-- =====================================================

GRANT EXECUTE ON FUNCTION get_database_total_size() TO authenticated;
GRANT EXECUTE ON FUNCTION get_tables_size() TO authenticated;
GRANT EXECUTE ON FUNCTION get_database_total_size() TO anon;
GRANT EXECUTE ON FUNCTION get_tables_size() TO anon;

-- =====================================================
-- MENSAGEM DE SUCESSO
-- =====================================================

SELECT '✅ Setup completo! Tabelas e funções criadas com sucesso!' as mensagem;
