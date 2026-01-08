-- ============================================
-- SETUP DE BANCO DEDICADO - CLIENTE PREMIUM
-- ============================================
-- Versão: Janeiro 2026
-- Descrição: Script para criar tabelas do banco Supabase dedicado
-- Uso: Executar APENAS em bancos dedicados de clientes Premium
-- ============================================

-- TABELA: jogadores
CREATE TABLE IF NOT EXISTS jogadores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(100) NOT NULL,
    nivel INTEGER NOT NULL,
    pelada_id TEXT NOT NULL,
    jogos INTEGER NOT NULL DEFAULT 0,
    vitorias INTEGER NOT NULL DEFAULT 0,
    derrotas INTEGER NOT NULL DEFAULT 0,
    empates INTEGER NOT NULL DEFAULT 0,
    gols INTEGER NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'ativo',
    
    CONSTRAINT jogadores_status_check CHECK (status IN ('ativo', 'inativo'))
);

-- TABELA: sessoes
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

-- TABELA: jogos
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA: gols
CREATE TABLE IF NOT EXISTS gols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jogo_id TEXT NOT NULL,
  jogador_id TEXT NOT NULL,
  time VARCHAR(1) NOT NULL CHECK (time IN ('A', 'B')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ÍNDICES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_jogadores_pelada_id ON jogadores(pelada_id);
CREATE INDEX IF NOT EXISTS idx_jogadores_status ON jogadores(status);
CREATE INDEX IF NOT EXISTS idx_sessoes_pelada ON sessoes(pelada_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_data ON sessoes(data);
CREATE INDEX IF NOT EXISTS idx_sessoes_status ON sessoes(status);
CREATE INDEX IF NOT EXISTS idx_jogos_sessao ON jogos(sessao_id);
CREATE INDEX IF NOT EXISTS idx_jogos_numero ON jogos(numero_jogo);
CREATE INDEX IF NOT EXISTS idx_jogos_status ON jogos(status);
CREATE INDEX IF NOT EXISTS idx_gols_jogo ON gols(jogo_id);
CREATE INDEX IF NOT EXISTS idx_gols_jogador ON gols(jogador_id);
CREATE INDEX IF NOT EXISTS idx_gols_time ON gols(time);

-- ============================================
-- POLÍTICAS DE SEGURANÇA (RLS)
-- ============================================

ALTER TABLE jogadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE jogos ENABLE ROW LEVEL SECURITY;
ALTER TABLE gols ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso público por pelada_id" ON jogadores
    FOR ALL
    USING (true);

CREATE POLICY "Acesso público por pelada_id" ON sessoes
    FOR ALL
    USING (true);

CREATE POLICY "Acesso público" ON jogos
    FOR ALL
    USING (true);

CREATE POLICY "Acesso público" ON gols
    FOR ALL
    USING (true);

-- ============================================
-- MENSAGEM FINAL
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '✅ Setup completo! Tabelas criadas com sucesso!';
    RAISE NOTICE '📊 Tabelas: jogadores, sessoes, jogos, gols';
    RAISE NOTICE '🔐 Políticas RLS ativadas';
    RAISE NOTICE '🎉 Banco dedicado pronto para uso!';
END $$;
