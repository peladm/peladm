-- =========================================
-- TABELA: jogos
-- =========================================
-- DESCRIÇÃO: Registro de todas as partidas da sessão
-- ARMAZENAMENTO: localStorage (todos os planos)
-- DEPLOY: Apenas Premium (ao encerrar pelada)
-- =========================================

CREATE TABLE IF NOT EXISTS jogos (
  -- Identificação
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id UUID NOT NULL,
  numero_jogo INTEGER NOT NULL,
  
  -- Times (armazenado como JSONB)
  time_a JSONB NOT NULL, -- Array de jogadores: [{id, nome, nivel}, ...]
  time_b JSONB NOT NULL, -- Array de jogadores: [{id, nome, nivel}, ...]
  
  -- Placar
  placar_a INTEGER DEFAULT 0,
  placar_b INTEGER DEFAULT 0,
  
  -- Status e Resultado
  status VARCHAR(20) NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando', 'em_andamento', 'finalizado')),
  time_vencedor VARCHAR(10) CHECK (time_vencedor IN ('A', 'B', 'empate', NULL)),
  
  -- Controle de Tempo
  tempo_decorrido INTEGER DEFAULT 0, -- em segundos
  data_inicio TIMESTAMPTZ,
  data_fim TIMESTAMPTZ,
  
  -- Substituições (armazenado como JSONB)
  substituicoes JSONB, -- Array de substituições: [{jogador_saiu, jogador_entrou, time, momento}, ...]
  
  -- Cores dos Times
  cor_time_a TEXT,
  cor_time_b TEXT,
  
  -- Auditoria
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_jogos_sessao ON jogos(sessao_id);
CREATE INDEX IF NOT EXISTS idx_jogos_numero ON jogos(numero_jogo);
CREATE INDEX IF NOT EXISTS idx_jogos_status ON jogos(status);

-- 🔒 Segurança: Desabilitar RLS (sem restrições)
ALTER TABLE jogos DISABLE ROW LEVEL SECURITY;

-- =========================================
-- OBSERVAÇÕES:
-- =========================================
-- 1. Free/Gold: localStorage - NÃO faz deploy (sem estatísticas)
-- 2. Premium: localStorage → deploy ao encerrar (para estatísticas)
-- 3. time_a e time_b: JSONB com array completo dos jogadores
-- 4. substituicoes: JSONB com histórico de trocas (se houver)
-- 5. tempo_decorrido: cronômetro em segundos (se habilitado)
-- 6. cor_time_a / cor_time_b: Cores dos coletes para visualização (hex color ou nome)
