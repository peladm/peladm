-- ========================================
-- RECRIAR TODAS AS TABELAS NO BANCO DEDICADO
-- ========================================
-- Execute este SQL no BANCO DEDICADO
-- ATENÇÃO: Isso vai DROPAR e RECRIAR todas as tabelas (apaga dados!)
-- Use apenas em setup inicial ou para correção

-- 1. DROPAR TODAS AS TABELAS (ordem importante por causa de foreign keys)
DROP TABLE IF EXISTS gols CASCADE;
DROP TABLE IF EXISTS jogos CASCADE;
DROP TABLE IF EXISTS fila_snapshot CASCADE;
DROP TABLE IF EXISTS fila CASCADE;
DROP TABLE IF EXISTS sessoes CASCADE;
DROP TABLE IF EXISTS jogadores CASCADE;

-- ========================================
-- CRIAR TABELAS COM ESTRUTURA EXATA DO PRINCIPAL
-- ========================================

-- TABELA: jogadores
CREATE TABLE jogadores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR NOT NULL,
  nivel INTEGER NOT NULL,
  pelada_id TEXT,
  jogos INTEGER,
  vitorias INTEGER,
  gols INTEGER,
  status TEXT DEFAULT 'ativo'::text
);

-- TABELA: sessoes
CREATE TABLE sessoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pelada_id TEXT NOT NULL,
  data DATE DEFAULT CURRENT_DATE,
  status VARCHAR(20) DEFAULT 'ativa',
  total_jogadores INTEGER DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  vitorias_consecutivas INTEGER DEFAULT 0
);

-- TABELA: fila
CREATE TABLE fila (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pelada_id TEXT NOT NULL,
  sessao_id UUID,
  jogador_id TEXT NOT NULL,
  status VARCHAR DEFAULT 'ativo'::character varying,
  posicao_fila INTEGER NOT NULL,
  vitorias_consecutivas_time INTEGER DEFAULT 0,
  jogos_jogados INTEGER DEFAULT 0,
  vitorias INTEGER DEFAULT 0,
  gols INTEGER DEFAULT 0,
  posicao INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- TABELA: jogos
CREATE TABLE jogos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id UUID,
  time_a JSONB NOT NULL,
  time_b JSONB NOT NULL,
  placar_a INTEGER DEFAULT 0,
  placar_b INTEGER DEFAULT 0,
  status VARCHAR DEFAULT 'em_andamento'::character varying,
  tempo_decorrido INTEGER DEFAULT 0,
  time_vencedor CHAR(1),
  data_inicio TIMESTAMPTZ DEFAULT now(),
  data_fim TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  numero_jogo INTEGER,
  substituicoes JSONB DEFAULT '[]'::jsonb
);

-- TABELA: gols
CREATE TABLE gols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jogo_id UUID,
  jogador_id TEXT NOT NULL,
  time CHAR(1) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- TABELA: fila_snapshot
CREATE TABLE fila_snapshot (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pelada_id TEXT NOT NULL,
  snapshot_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  tipo VARCHAR DEFAULT 'partida'::character varying NOT NULL
);

-- ========================================
-- CRIAR ÍNDICES (SESSOES)
-- ========================================
CREATE INDEX idx_sessoes_data ON sessoes(data);
CREATE UNIQUE INDEX idx_sessoes_pelada_ativa_unica ON sessoes(pelada_id, data) WHERE status::text = 'ativa'::text;
CREATE INDEX idx_sessoes_pelada_data ON sessoes(pelada_id, data);
CREATE INDEX idx_sessoes_pelada_id ON sessoes(pelada_id);
CREATE INDEX idx_sessoes_pelada_status ON sessoes(pelada_id, status);
CREATE INDEX idx_sessoes_status ON sessoes(status);

-- ========================================
-- HABILITAR RLS
-- ========================================
ALTER TABLE jogadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fila ENABLE ROW LEVEL SECURITY;
ALTER TABLE jogos ENABLE ROW LEVEL SECURITY;
ALTER TABLE gols ENABLE ROW LEVEL SECURITY;
ALTER TABLE fila_snapshot ENABLE ROW LEVEL SECURITY;

-- ========================================
-- CRIAR POLÍTICAS DE ACESSO
-- ========================================
CREATE POLICY "Acesso público jogadores" ON jogadores FOR ALL USING (true);
CREATE POLICY "Acesso público sessoes" ON sessoes FOR ALL USING (true);
CREATE POLICY "Acesso público fila" ON fila FOR ALL USING (true);
CREATE POLICY "Acesso público jogos" ON jogos FOR ALL USING (true);
CREATE POLICY "Acesso público gols" ON gols FOR ALL USING (true);
CREATE POLICY "Acesso público fila_snapshot" ON fila_snapshot FOR ALL USING (true);

-- ========================================
-- VERIFICAÇÃO FINAL
-- ========================================
SELECT 
  tablename,
  schemaname
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('jogadores', 'sessoes', 'fila', 'jogos', 'gols', 'fila_snapshot')
ORDER BY tablename;

-- ✅ Deve mostrar 6 tabelas criadas:
-- fila, fila_snapshot, gols, jogadores, jogos, sessoes
