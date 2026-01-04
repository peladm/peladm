-- ============================================
-- ESTRUTURA DA TABELA JOGADORES
-- Documentação da estrutura atual (Janeiro/2026)
-- ============================================

/*
TABELA: jogadores
Armazena os jogadores cadastrados e suas estatísticas

COLUNAS (10):
┌─────────────┬───────────────────┬─────────────┬────────────────────┐
│ column_name │ data_type         │ is_nullable │ column_default     │
├─────────────┼───────────────────┼─────────────┼────────────────────┤
│ id          │ uuid              │ NO          │ uuid_generate_v4() │
│ nome        │ character varying │ NO          │ null               │
│ nivel       │ integer           │ NO          │ null               │
│ pelada_id   │ text              │ NO          │ null               │
│ jogos       │ integer           │ NO          │ 0                  │
│ vitorias    │ integer           │ NO          │ 0                  │
│ derrotas    │ integer           │ NO          │ 0                  │
│ empates     │ integer           │ NO          │ 0                  │
│ gols        │ integer           │ NO          │ 0                  │
│ status      │ text              │ YES         │ 'ativo'::text      │
└─────────────┴───────────────────┴─────────────┴────────────────────┘

CONSTRAINTS:
- PRIMARY KEY: id
- FOREIGN KEY: pelada_id → clientes(pelada_id)
- CHECK: status IN ('ativo', 'inativo')

ÍNDICES:
- PRIMARY KEY index em id
- Index em pelada_id (para queries por pelada)

DESCRIÇÃO DOS CAMPOS:
- id: Identificador único do jogador (UUID)
- nome: Nome completo do jogador (máx 100 chars)
- nivel: Nível de habilidade (1-10)
- pelada_id: ID da pelada/cliente a que pertence
- jogos: Total de partidas jogadas
- vitorias: Total de vitórias
- derrotas: Total de derrotas
- empates: Total de empates
- gols: Total de gols marcados
- status: Estado do jogador ('ativo' ou 'inativo')

ESTRATÉGIA DE SINCRONIZAÇÃO:
- Fonte da verdade: Supabase
- Cache local: Baixado ao confirmar times no sorteio
- Sync: Atualiza estatísticas ao encerrar pelada
*/

-- Comando para recriar a tabela (se necessário)
CREATE TABLE IF NOT EXISTS jogadores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(100) NOT NULL,
    nivel INTEGER NOT NULL,
    pelada_id TEXT NOT NULL,
    jogos INTEGER NOT NULL DEFAULT 0,
    vitorias INTEGER NOT NULL DEFAULT 0,
    derrotas INTEGER NOT NULL DEFAULT 0,
    empates INTEGER NOT NULL DEFAULT 0,
    gols INTEGER NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'ativo',
    
    CONSTRAINT jogadores_status_check CHECK (status IN ('ativo', 'inativo')),
    CONSTRAINT fk_jogadores_pelada FOREIGN KEY (pelada_id) 
        REFERENCES clientes(pelada_id) ON DELETE CASCADE
);

-- Índices recomendados
CREATE INDEX IF NOT EXISTS idx_jogadores_pelada_id ON jogadores(pelada_id);
CREATE INDEX IF NOT EXISTS idx_jogadores_status ON jogadores(status);
