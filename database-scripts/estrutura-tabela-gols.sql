-- =========================================
-- TABELA: gols
-- =========================================
-- DESCRIÇÃO: Registro de gols marcados nas partidas
-- ARMAZENAMENTO: localStorage (apenas Premium)
-- DEPLOY: Apenas Premium (ao encerrar pelada)
-- =========================================

CREATE TABLE IF NOT EXISTS gols (
  -- Identificação
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relações
  jogo_id TEXT NOT NULL, -- ID do jogo (UUID como texto)
  jogador_id TEXT NOT NULL, -- ID do jogador que marcou
  
  -- Dados do Gol
  time VARCHAR(1) NOT NULL CHECK (time IN ('A', 'B')), -- Time que marcou o gol
  
  -- Auditoria
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_gols_jogo ON gols(jogo_id);
CREATE INDEX IF NOT EXISTS idx_gols_jogador ON gols(jogador_id);
CREATE INDEX IF NOT EXISTS idx_gols_time ON gols(time);

-- =========================================
-- OBSERVAÇÕES:
-- =========================================
-- 1. Free/Gold: NÃO EXISTE (recurso exclusivo Premium)
-- 2. Premium: localStorage → deploy ao encerrar pelada
-- 3. Usado apenas no "Modo Partida" (exclusivo Premium)
-- 4. Cada gol é um registro individual
-- 5. Permite estatísticas detalhadas por jogador
-- 6. jogo_id: referência ao UUID do jogo (armazenado como TEXT)
-- 7. jogador_id: ID do jogador (pode ser diferente do nome)
