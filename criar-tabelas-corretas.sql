-- =====================================================
-- ESTRUTURA CORRETA DAS TABELAS PARA O PROJETO PELADM
-- =====================================================

-- IMPORTANTE: Execute apenas se for criar do zero
-- Se as tabelas já existem, use apenas para comparar

-- =====================================================
-- TABELA: usuarios (clientes/admins)
-- =====================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    tipo TEXT DEFAULT 'cliente' CHECK (tipo IN ('admin', 'cliente')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA: jogadores
-- =====================================================
CREATE TABLE IF NOT EXISTS jogadores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    nivel INTEGER DEFAULT 3 CHECK (nivel >= 1 AND nivel <= 5),
    status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
    pelada_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    jogos INTEGER DEFAULT 0,
    vitorias INTEGER DEFAULT 0,
    gols INTEGER DEFAULT 0
);

-- =====================================================
-- TABELA: regras
-- =====================================================
CREATE TABLE IF NOT EXISTS regras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pelada_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    jogadores_por_time INTEGER DEFAULT 5 CHECK (jogadores_por_time >= 3 AND jogadores_por_time <= 11),
    modelo_sorteio TEXT DEFAULT 'equilibrado' CHECK (modelo_sorteio IN ('equilibrado', 'aleatorio')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(pelada_id)
);

-- =====================================================
-- TABELA: sessoes
-- =====================================================
CREATE TABLE IF NOT EXISTS sessoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pelada_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'ativa' CHECK (status IN ('ativa', 'finalizada')),
    data DATE DEFAULT CURRENT_DATE,
    total_jogadores INTEGER DEFAULT 0,
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA: fila (SIMPLIFICADA - apenas campos essenciais)
-- =====================================================
CREATE TABLE IF NOT EXISTS fila (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pelada_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    sessao_id UUID NOT NULL REFERENCES sessoes(id) ON DELETE CASCADE,
    jogador_id UUID NOT NULL REFERENCES jogadores(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('fila', 'reserva')),
    posicao_fila INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(sessao_id, jogador_id)
);

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_jogadores_pelada ON jogadores(pelada_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_pelada_status ON sessoes(pelada_id, status);
CREATE INDEX IF NOT EXISTS idx_fila_sessao ON fila(sessao_id);
CREATE INDEX IF NOT EXISTS idx_fila_status ON fila(status);
CREATE INDEX IF NOT EXISTS idx_fila_posicao ON fila(sessao_id, posicao_fila);

-- =====================================================
-- CONSTRAINT PARA GARANTIR APENAS 1 SESSÃO ATIVA POR PELADA
-- =====================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_sessao_ativa 
ON sessoes(pelada_id) 
WHERE status = 'ativa';

COMMENT ON INDEX idx_unique_sessao_ativa IS 'Garante que cada pelada tenha apenas 1 sessão ativa por vez';

-- =====================================================
-- VERIFICAÇÕES FINAIS
-- =====================================================
SELECT 'Estrutura criada com sucesso!' as mensagem;
