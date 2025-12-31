-- ========================================
-- BANCO DEDICADO PREMIUM - ESTRUTURA COMPLETA
-- ========================================
-- Este script cria TODAS as tabelas necessárias
-- para um banco Supabase dedicado de cliente Premium
-- 
-- IMPORTANTE: Executar no NOVO banco dedicado do cliente
-- NÃO executar no banco principal do sistema
-- ========================================

-- 1. TABELA: jogadores
-- Armazena os jogadores cadastrados na pelada
CREATE TABLE IF NOT EXISTS jogadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  nivel INTEGER DEFAULT 3 CHECK (nivel >= 1 AND nivel <= 5),
  status TEXT CHECK (status IN ('ativo', 'inativo')) DEFAULT 'ativo',
  pelada_id UUID NOT NULL,
  jogos INTEGER DEFAULT 0,
  vitorias INTEGER DEFAULT 0,
  gols INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE jogadores IS 'Cadastro de jogadores da pelada';
COMMENT ON COLUMN jogadores.nivel IS 'Nível do jogador (1=iniciante, 5=craque)';
COMMENT ON COLUMN jogadores.status IS 'Status do jogador: ativo ou inativo';
COMMENT ON COLUMN jogadores.pelada_id IS 'ID do cliente/pelada (referência ao banco principal)';

-- Índices para jogadores
CREATE INDEX IF NOT EXISTS idx_jogadores_pelada ON jogadores(pelada_id);
CREATE INDEX IF NOT EXISTS idx_jogadores_status ON jogadores(pelada_id, status);
CREATE INDEX IF NOT EXISTS idx_jogadores_nome ON jogadores(pelada_id, nome);

-- ========================================

-- 2. TABELA: sessoes
-- Gerencia as sessões de peladas (ativas e finalizadas)
CREATE TABLE IF NOT EXISTS sessoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pelada_id UUID NOT NULL,
  status TEXT CHECK (status IN ('ativa', 'finalizada')) DEFAULT 'ativa',
  data_inicio TIMESTAMPTZ DEFAULT NOW(),
  data_fim TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE sessoes IS 'Sessões de peladas (ativa ou finalizada)';
COMMENT ON COLUMN sessoes.status IS 'Status da sessão: ativa (em andamento) ou finalizada';
COMMENT ON COLUMN sessoes.data_inicio IS 'Data e hora de início da sessão';
COMMENT ON COLUMN sessoes.data_fim IS 'Data e hora de finalização da sessão';

-- Índices para sessoes
CREATE INDEX IF NOT EXISTS idx_sessoes_pelada ON sessoes(pelada_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_status ON sessoes(pelada_id, status);
CREATE INDEX IF NOT EXISTS idx_sessoes_ativa ON sessoes(pelada_id) WHERE status = 'ativa';

-- Constraint: Apenas 1 sessão ativa por vez
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessoes_unica_ativa 
ON sessoes(pelada_id) 
WHERE status = 'ativa';

-- ========================================

-- 3. TABELA: fila
-- Gerencia a fila de jogadores em cada sessão
CREATE TABLE IF NOT EXISTS fila (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pelada_id UUID NOT NULL,
  sessao_id UUID NOT NULL REFERENCES sessoes(id) ON DELETE CASCADE,
  jogador_id UUID NOT NULL REFERENCES jogadores(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('fila', 'reserva')) DEFAULT 'fila',
  posicao_fila INTEGER DEFAULT 999,
  vitorias_consecutivas INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE fila IS 'Fila de jogadores em cada sessão';
COMMENT ON COLUMN fila.status IS 'Status na fila: fila (jogando ou aguardando) ou reserva (fora da rotação)';
COMMENT ON COLUMN fila.posicao_fila IS 'Posição do jogador na fila (1=primeiro a jogar, 999=reserva)';
COMMENT ON COLUMN fila.vitorias_consecutivas IS 'Contador de vitórias consecutivas do time';

-- Índices para fila
CREATE INDEX IF NOT EXISTS idx_fila_sessao ON fila(sessao_id);
CREATE INDEX IF NOT EXISTS idx_fila_jogador ON fila(jogador_id);
CREATE INDEX IF NOT EXISTS idx_fila_pelada ON fila(pelada_id);
CREATE INDEX IF NOT EXISTS idx_fila_posicao ON fila(sessao_id, posicao_fila);
CREATE INDEX IF NOT EXISTS idx_fila_status ON fila(sessao_id, status);

-- Constraint: Jogador único por sessão
CREATE UNIQUE INDEX IF NOT EXISTS idx_fila_jogador_sessao 
ON fila(sessao_id, jogador_id);

-- ========================================

-- 4. TABELA: jogos
-- Registra as partidas realizadas
CREATE TABLE IF NOT EXISTS jogos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id UUID NOT NULL REFERENCES sessoes(id) ON DELETE CASCADE,
  time_a_jogadores TEXT[] NOT NULL,
  time_b_jogadores TEXT[] NOT NULL,
  gols_time_a INTEGER DEFAULT 0,
  gols_time_b INTEGER DEFAULT 0,
  time_vencedor TEXT CHECK (time_vencedor IN ('A', 'B', 'empate')),
  duracao INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE jogos IS 'Registro de partidas realizadas';
COMMENT ON COLUMN jogos.time_a_jogadores IS 'Array com IDs dos jogadores do Time A';
COMMENT ON COLUMN jogos.time_b_jogadores IS 'Array com IDs dos jogadores do Time B';
COMMENT ON COLUMN jogos.time_vencedor IS 'Time vencedor: A, B ou empate';
COMMENT ON COLUMN jogos.duracao IS 'Duração da partida em minutos';

-- Índices para jogos
CREATE INDEX IF NOT EXISTS idx_jogos_sessao ON jogos(sessao_id);
CREATE INDEX IF NOT EXISTS idx_jogos_data ON jogos(created_at DESC);

-- ========================================

-- 5. TABELA: gols
-- Registra os gols marcados por cada jogador
CREATE TABLE IF NOT EXISTS gols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jogo_id UUID NOT NULL REFERENCES jogos(id) ON DELETE CASCADE,
  jogador_id UUID NOT NULL REFERENCES jogadores(id) ON DELETE CASCADE,
  pelada_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE gols IS 'Registro de gols marcados por jogador';
COMMENT ON COLUMN gols.jogo_id IS 'ID do jogo onde o gol foi marcado';
COMMENT ON COLUMN gols.jogador_id IS 'ID do jogador que marcou o gol';

-- Índices para gols
CREATE INDEX IF NOT EXISTS idx_gols_jogo ON gols(jogo_id);
CREATE INDEX IF NOT EXISTS idx_gols_jogador ON gols(jogador_id);
CREATE INDEX IF NOT EXISTS idx_gols_pelada ON gols(pelada_id);

-- ========================================

-- 6. TABELA: fila_snapshot
-- Armazena snapshots da fila para funcionalidade de desfazer
CREATE TABLE IF NOT EXISTS fila_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pelada_id TEXT NOT NULL,
  sessao_id UUID NOT NULL REFERENCES sessoes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('pre_jogo', 'pos_jogo')),
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE fila_snapshot IS 'Snapshots da fila para funcionalidade de desfazer';
COMMENT ON COLUMN fila_snapshot.tipo IS 'Tipo do snapshot: pre_jogo (antes de iniciar) ou pos_jogo (depois de finalizar)';
COMMENT ON COLUMN fila_snapshot.snapshot IS 'JSON com o estado completo da fila naquele momento';

-- Índices para fila_snapshot
CREATE INDEX IF NOT EXISTS idx_fila_snapshot_sessao ON fila_snapshot(sessao_id);
CREATE INDEX IF NOT EXISTS idx_fila_snapshot_pelada ON fila_snapshot(pelada_id);
CREATE INDEX IF NOT EXISTS idx_fila_snapshot_tipo ON fila_snapshot(sessao_id, tipo);
CREATE INDEX IF NOT EXISTS idx_fila_snapshot_data ON fila_snapshot(created_at DESC);

-- ========================================
-- POLÍTICAS RLS (Row Level Security)
-- ========================================
-- IMPORTANTE: Ajustar conforme sua estratégia de autenticação
-- Por padrão, permite acesso total via anon key

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
-- FUNÇÕES E TRIGGERS
-- ========================================

-- Atualizar updated_at automaticamente em jogadores
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_jogadores_updated_at 
BEFORE UPDATE ON jogadores
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- DADOS INICIAIS (Opcional)
-- ========================================

-- Exemplo: Inserir jogadores de teste (remover em produção)
/*
INSERT INTO jogadores (nome, nivel, pelada_id) VALUES
  ('Jogador 1', 3, 'SEU_PELADA_ID_AQUI'),
  ('Jogador 2', 4, 'SEU_PELADA_ID_AQUI'),
  ('Jogador 3', 3, 'SEU_PELADA_ID_AQUI');
*/

-- ========================================
-- VERIFICAÇÕES FINAIS
-- ========================================

-- Listar todas as tabelas criadas
SELECT tablename, schemaname 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('jogadores', 'sessoes', 'fila', 'jogos', 'gols')
ORDER BY tablename;

-- Verificar constraints
SELECT 
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('jogadores', 'sessoes', 'fila', 'jogos', 'gols')
ORDER BY tc.table_name, tc.constraint_type;

-- Verificar índices
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('jogadores', 'sessoes', 'fila', 'jogos', 'gols')
ORDER BY tablename, indexname;

-- ========================================
-- ✅ ESTRUTURA CRIADA COM SUCESSO!
-- ========================================
-- Próximos passos:
-- 1. Copiar supabase_url e supabase_anon_key deste banco, 'fila_snapshot')
ORDER BY tablename;

-- Verificar constraints
SELECT 
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('jogadores', 'sessoes', 'fila', 'jogos', 'gols', 'fila_snapshot')
ORDER BY tc.table_name, tc.constraint_type;

-- Verificar índices
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('jogadores', 'sessoes', 'fila', 'jogos', 'gols', 'fila_snapshot