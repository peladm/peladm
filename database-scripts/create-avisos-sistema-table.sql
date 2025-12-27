-- Criar tabela de avisos do sistema
CREATE TABLE IF NOT EXISTS avisos_sistema (
  id SERIAL PRIMARY KEY,
  mensagem TEXT NOT NULL,
  plano_alvo TEXT NOT NULL DEFAULT 'todos' CHECK (plano_alvo IN ('todos', 'Free', 'Gold', 'Premium')),
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_avisos_ativo ON avisos_sistema(ativo);
CREATE INDEX IF NOT EXISTS idx_avisos_datas ON avisos_sistema(data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_avisos_plano ON avisos_sistema(plano_alvo);

-- Comentários
COMMENT ON TABLE avisos_sistema IS 'Avisos gerais do sistema para exibir na home dos usuários';
COMMENT ON COLUMN avisos_sistema.mensagem IS 'Texto do aviso a ser exibido';
COMMENT ON COLUMN avisos_sistema.plano_alvo IS 'Plano(s) que verá o aviso: todos, Free, Gold ou Premium';
COMMENT ON COLUMN avisos_sistema.data_inicio IS 'Data de início da exibição do aviso';
COMMENT ON COLUMN avisos_sistema.data_fim IS 'Data de fim da exibição do aviso';
COMMENT ON COLUMN avisos_sistema.ativo IS 'Se o aviso está ativo ou foi desativado manualmente';
