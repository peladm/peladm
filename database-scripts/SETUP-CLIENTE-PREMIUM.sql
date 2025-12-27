-- =====================================================
-- SETUP COMPLETO PARA CLIENTE PREMIUM
-- Execute este script no Supabase do cliente
-- =====================================================

-- 1. TABELA: jogadores
CREATE TABLE IF NOT EXISTS jogadores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    nivel INTEGER DEFAULT 3 CHECK (nivel >= 1 AND nivel <= 5),
    posicao TEXT,
    status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'jogando', 'fila', 'reserva')),
    pelada_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    jogos INTEGER DEFAULT 0,
    vitorias INTEGER DEFAULT 0,
    gols INTEGER DEFAULT 0
);

-- 2. TABELA: regras
CREATE TABLE IF NOT EXISTS regras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pelada_id TEXT NOT NULL,
    jogadores_por_time INTEGER DEFAULT 5 CHECK (jogadores_por_time >= 3 AND jogadores_por_time <= 11),
    modelo_sorteio TEXT DEFAULT 'equilibrado' CHECK (modelo_sorteio IN ('equilibrado', 'aleatorio')),
    duracao INTEGER DEFAULT 10,
    vitorias_consecutivas INTEGER DEFAULT 0,
    prioridade_retorno TEXT DEFAULT 'prioridade' CHECK (prioridade_retorno IN ('prioridade', 'sem_prioridade', 'mesclar', 'perdedor_continua')),
    regra_empate TEXT DEFAULT 'ambos_saem' CHECK (regra_empate IN ('ambos_saem', 'desempate')),
    regra_apos_empate TEXT DEFAULT 'desempate_decide' CHECK (regra_apos_empate IN ('desempate_decide', 'mesclar_times')),
    empate_conta_vitoria BOOLEAN DEFAULT false,
    tipo_fila TEXT DEFAULT 'modo_prancheta' CHECK (tipo_fila IN ('modo_partida', 'modo_prancheta')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(pelada_id)
);

-- 3. TABELA: sessoes
CREATE TABLE IF NOT EXISTS sessoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pelada_id TEXT NOT NULL,
    status TEXT DEFAULT 'ativa' CHECK (status IN ('ativa', 'finalizada')),
    data DATE DEFAULT CURRENT_DATE,
    total_jogadores INTEGER DEFAULT 0,
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABELA: fila
CREATE TABLE IF NOT EXISTS fila (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pelada_id TEXT NOT NULL,
    sessao_id UUID NOT NULL REFERENCES sessoes(id) ON DELETE CASCADE,
    jogador_id UUID NOT NULL REFERENCES jogadores(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('jogando', 'fila', 'reserva')),
    posicao_fila INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(sessao_id, jogador_id)
);

-- 5. TABELA: jogos
CREATE TABLE IF NOT EXISTS jogos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pelada_id TEXT NOT NULL,
    sessao_id UUID REFERENCES sessoes(id) ON DELETE SET NULL,
    time_a UUID[],
    time_b UUID[],
    placar_a INTEGER DEFAULT 0,
    placar_b INTEGER DEFAULT 0,
    vencedor TEXT CHECK (vencedor IN ('time_a', 'time_b', 'empate')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABELA: gols
CREATE TABLE IF NOT EXISTS gols (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jogo_id UUID NOT NULL REFERENCES jogos(id) ON DELETE CASCADE,
    jogador_id UUID NOT NULL REFERENCES jogadores(id) ON DELETE CASCADE,
    time TEXT NOT NULL CHECK (time IN ('time_a', 'time_b')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABELA: fila_snapshot (para histórico)
CREATE TABLE IF NOT EXISTS fila_snapshot (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pelada_id TEXT NOT NULL,
    sessao_id UUID NOT NULL REFERENCES sessoes(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('pre_jogo', 'pos_jogo')),
    snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_jogadores_pelada ON jogadores(pelada_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_pelada ON sessoes(pelada_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_pelada_status ON sessoes(pelada_id, status);
CREATE INDEX IF NOT EXISTS idx_fila_sessao ON fila(sessao_id);
CREATE INDEX IF NOT EXISTS idx_fila_pelada ON fila(pelada_id);
CREATE INDEX IF NOT EXISTS idx_fila_status ON fila(status);
CREATE INDEX IF NOT EXISTS idx_fila_posicao ON fila(sessao_id, posicao_fila);
CREATE INDEX IF NOT EXISTS idx_jogos_pelada ON jogos(pelada_id);
CREATE INDEX IF NOT EXISTS idx_jogos_sessao ON jogos(sessao_id);
CREATE INDEX IF NOT EXISTS idx_gols_jogo ON gols(jogo_id);
CREATE INDEX IF NOT EXISTS idx_gols_jogador ON gols(jogador_id);

-- =====================================================
-- CONSTRAINT: APENAS 1 SESSÃO ATIVA POR PELADA
-- =====================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_sessao_ativa 
ON sessoes(pelada_id) 
WHERE status = 'ativa';

-- =====================================================
-- HABILITAR RLS (Row Level Security)
-- =====================================================
ALTER TABLE jogadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE regras ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fila ENABLE ROW LEVEL SECURITY;
ALTER TABLE jogos ENABLE ROW LEVEL SECURITY;
ALTER TABLE gols ENABLE ROW LEVEL SECURITY;
ALTER TABLE fila_snapshot ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICAS RLS: Permitir tudo para usuários autenticados
-- (ajuste conforme sua necessidade de segurança)
-- =====================================================
CREATE POLICY "Permitir tudo para autenticados" ON jogadores FOR ALL USING (true);
CREATE POLICY "Permitir tudo para autenticados" ON regras FOR ALL USING (true);
CREATE POLICY "Permitir tudo para autenticados" ON sessoes FOR ALL USING (true);
CREATE POLICY "Permitir tudo para autenticados" ON fila FOR ALL USING (true);
CREATE POLICY "Permitir tudo para autenticados" ON jogos FOR ALL USING (true);
CREATE POLICY "Permitir tudo para autenticados" ON gols FOR ALL USING (true);
CREATE POLICY "Permitir tudo para autenticados" ON fila_snapshot FOR ALL USING (true);

-- =====================================================
-- FUNÇÕES: Monitoramento de uso do banco
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
        'public.' || t.tablename AS tablename,
        COALESCE((
            SELECT n_live_tup 
            FROM pg_stat_user_tables 
            WHERE schemaname = 'public' AND relname = t.tablename
        ), 0)::bigint AS row_count,
        pg_total_relation_size('public.' || t.tablename)::bigint AS total_size,
        pg_relation_size('public.' || t.tablename)::bigint AS table_size,
        pg_indexes_size('public.' || t.tablename)::bigint AS indexes_size
    FROM pg_catalog.pg_tables t
    WHERE schemaname = 'public'
    AND tablename IN ('jogadores', 'sessoes', 'fila', 'jogos', 'gols', 'regras', 'fila_snapshot')
    ORDER BY total_size DESC;
END;
$$;

-- Dar permissões de execução
GRANT EXECUTE ON FUNCTION get_database_total_size() TO anon;
GRANT EXECUTE ON FUNCTION get_database_total_size() TO authenticated;
GRANT EXECUTE ON FUNCTION get_tables_size() TO anon;
GRANT EXECUTE ON FUNCTION get_tables_size() TO authenticated;

-- =====================================================
-- MENSAGEM FINAL
-- =====================================================
SELECT '✅ Setup completo! Todas as tabelas foram criadas.' as mensagem;
