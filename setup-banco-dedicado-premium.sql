-- ========================================
-- BANCO DEDICADO PREMIUM - ESTRUTURA COMPLETA
-- ========================================
-- Este script cria TODAS as tabelas necessárias
-- para um banco Supabase dedicado de cliente Premium
-- 
-- IMPORTANTE: Executar no NOVO banco dedicado do cliente
-- NÃO executar no banco principal do sistema
-- 
-- ESTRUTURA IDÊNTICA AO BANCO PRINCIPAL
-- ========================================

-- 1. TABELA: jogadores
CREATE TABLE IF NOT EXISTS jogadores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR NOT NULL,
  nivel INTEGER NOT NULL,
  pelada_id TEXT,
  jogos INTEGER,
  vitorias INTEGER,
  gols INTEGER,
  status TEXT DEFAULT 'ativo'::text
);

COMMENT ON TABLE jogadores IS 'Cadastro de jogadores da pelada';

-- Índices para jogadores
CREATE INDEX IF NOT EXISTS idx_jogadores_pelada ON jogadores(pelada_id);
CREATE INDEX IF NOT EXISTS idx_jogadores_status ON jogadores(status);
CREATE INDEX IF NOT EXISTS idx_jogadores_nome ON jogadores(nome);

-- ========================================

-- 2. TABELA: sessoes
CREATE TABLE IF NOT EXISTS sessoes (
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

COMMENT ON TABLE sessoes IS 'Sessões de peladas (ativa ou finalizada)';

-- Índices para sessoes
CREATE INDEX IF NOT EXISTS idx_sessoes_data ON sessoes(data);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessoes_pelada_ativa_unica ON sessoes(pelada_id, data) WHERE status::text = 'ativa'::text;
CREATE INDEX IF NOT EXISTS idx_sessoes_pelada_data ON sessoes(pelada_id, data);
CREATE INDEX IF NOT EXISTS idx_sessoes_pelada_id ON sessoes(pelada_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_pelada_status ON sessoes(pelada_id, status);
CREATE INDEX IF NOT EXISTS idx_sessoes_status ON sessoes(status);

-- ========================================

-- 3. TABELA: fila
CREATE TABLE IF NOT EXISTS fila (
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

COMMENT ON TABLE fila IS 'Fila de jogadores em cada sessão';

-- Índices para fila
CREATE INDEX IF NOT EXISTS idx_fila_sessao ON fila(sessao_id);
CREATE INDEX IF NOT EXISTS idx_fila_jogador ON fila(jogador_id);
CREATE INDEX IF NOT EXISTS idx_fila_pelada ON fila(pelada_id);
CREATE INDEX IF NOT EXISTS idx_fila_posicao ON fila(sessao_id, posicao_fila);
CREATE INDEX IF NOT EXISTS idx_fila_status ON fila(sessao_id, status);

-- ========================================

-- 4. TABELA: jogos
CREATE TABLE IF NOT EXISTS jogos (
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

COMMENT ON TABLE jogos IS 'Registro de partidas realizadas';

-- Índices para jogos
CREATE INDEX IF NOT EXISTS idx_jogos_sessao ON jogos(sessao_id);
CREATE INDEX IF NOT EXISTS idx_jogos_data ON jogos(created_at DESC);

-- ========================================

-- 5. TABELA: gols
CREATE TABLE IF NOT EXISTS gols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jogo_id UUID,
  jogador_id TEXT NOT NULL,
  time CHAR(1) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE gols IS 'Registro de gols marcados por jogador';

-- Índices para gols
CREATE INDEX IF NOT EXISTS idx_gols_jogo ON gols(jogo_id);
CREATE INDEX IF NOT EXISTS idx_gols_jogador ON gols(jogador_id);

-- ========================================

-- 6. TABELA: fila_snapshot
CREATE TABLE IF NOT EXISTS fila_snapshot (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pelada_id TEXT NOT NULL,
  snapshot_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  tipo VARCHAR DEFAULT 'partida'::character varying NOT NULL
);

COMMENT ON TABLE fila_snapshot IS 'Snapshots da fila para funcionalidade de desfazer';

-- Índices para fila_snapshot
CREATE INDEX IF NOT EXISTS idx_fila_snapshot_pelada ON fila_snapshot(pelada_id);
CREATE INDEX IF NOT EXISTS idx_fila_snapshot_tipo ON fila_snapshot(tipo);
CREATE INDEX IF NOT EXISTS idx_fila_snapshot_data ON fila_snapshot(created_at DESC);

-- ========================================
-- POLÍTICAS RLS (Row Level Security)
-- ========================================

-- Habilitar RLS
ALTER TABLE jogadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fila ENABLE ROW LEVEL SECURITY;
ALTER TABLE jogos ENABLE ROW LEVEL SECURITY;
ALTER TABLE gols ENABLE ROW LEVEL SECURITY;
ALTER TABLE fila_snapshot ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas (ajustar conforme necessidade)
CREATE POLICY "Acesso público jogadores" ON jogadores FOR ALL USING (true);
CREATE POLICY "Acesso público sessoes" ON sessoes FOR ALL USING (true);
CREATE POLICY "Acesso público fila" ON fila FOR ALL USING (true);
CREATE POLICY "Acesso público jogos" ON jogos FOR ALL USING (true);
CREATE POLICY "Acesso público gols" ON gols FOR ALL USING (true);
CREATE POLICY "Acesso público fila_snapshot" ON fila_snapshot FOR ALL USING (true);

-- ========================================
-- VERIFICAÇÕES FINAIS
-- ========================================

-- Listar todas as tabelas criadas
SELECT tablename, schemaname 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('jogadores', 'sessoes', 'fila', 'jogos', 'gols', 'fila_snapshot')
ORDER BY tablename;

-- ✅ ESTRUTURA CRIADA COM SUCESSO!
