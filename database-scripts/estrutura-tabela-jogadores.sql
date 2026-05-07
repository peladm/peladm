-- ============================================
-- ESTRUTURA DA TABELA JOGADORES
-- Documentação da estrutura atual (Fevereiro/2026)
-- ============================================

/*
TABELA: jogadores
Armazena os jogadores cadastrados

⚡ IMPORTANTE: Estatísticas (jogos, vitórias, derrotas, empates, gols, assistências) 
   foram REMOVIDAS desta tabela e são calculadas dinamicamente a partir de:
   - jogos (tabela com todas as partidas)
   - gols (tabela com todos os gols marcados)
   - assistencias (tabela com todas as assistências)

COLUNAS (9):
┌─────────────┬───────────────────┬─────────────┬────────────────────┐
│ column_name │ data_type         │ is_nullable │ column_default     │
├─────────────┼───────────────────┼─────────────┼────────────────────┤
│ id          │ uuid              │ NO          │ gen_random_uuid()  │
│ nome        │ character varying │ NO          │ null               │
│ nivel       │ integer           │ NO          │ null               │
│ pelada_id   │ text              │ NO          │ null               │
│ status      │ text              │ YES         │ 'ativo'::text      │
│ foto_url    │ text              │ YES         │ null               │
│ created_at  │ timestamptz       │ YES         │ NOW()              │
│ posicao     │ text              │ YES         │ null               │
└─────────────┴───────────────────┴─────────────┴────────────────────┘

CONSTRAINTS:
- PRIMARY KEY: id
- FOREIGN KEY: pelada_id → clientes(pelada_id)
- CHECK: status IN ('ativo', 'inativo')
- CHECK: nivel BETWEEN 1 AND 5

ÍNDICES:
- PRIMARY KEY index em id
- Index em pelada_id (para queries por pelada)

DESCRIÇÃO DOS CAMPOS:
- id: Identificador único do jogador (UUID)
- nome: Nome completo do jogador (máx 100 chars)
- nivel: Nível de habilidade (1-5)
- pelada_id: ID da pelada/cliente a que pertence
- status: Estado do jogador ('ativo' ou 'inativo')
- foto_url: URL da foto do jogador (armazenada em bucket)
- created_at: Data/hora de criação do registro
- posicao: Posição tática do jogador (ex: 'goleiro', 'zagueiro', 'meia', 'atacante')

ESTRATÉGIA DE SINCRONIZAÇÃO:
- Fonte da verdade: Supabase
- Cache local: Baixado ao confirmar times no sorteio
- Sync: Apenas jogadores novos são sincronizados ao encerrar pelada
- Estatísticas: Calculadas dinamicamente (não sincronizadas)

COMO CALCULAR ESTATÍSTICAS:
1. Jogos: COUNT(DISTINCT jogo_id) WHERE jogador está em time_a OU time_b
2. Vitórias: COUNT jogos WHERE (jogador em time_a AND placar_a > placar_b) OR (jogador em time_b AND placar_b > placar_a)
3. Derrotas: COUNT jogos WHERE (jogador em time_a AND placar_a < placar_b) OR (jogador em time_b AND placar_b < placar_a)
4. Empates: COUNT jogos WHERE placar_a = placar_b
5. Gols: COUNT(*) FROM gols WHERE jogador_id = jogador.id
6. Assistências: COUNT(*) FROM assistencias WHERE jogador_id = jogador.id
*/

-- Exemplo de criação (referência)
CREATE TABLE IF NOT EXISTS jogadores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(100) NOT NULL,
    nivel INTEGER NOT NULL DEFAULT 3 CHECK (nivel >= 1 AND nivel <= 5),
    pelada_id TEXT NOT NULL,
    status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
*/

-- Comando para recriar a tabela (se necessário)
CREATE TABLE IF NOT EXISTS jogadores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(100) NOT NULL,
    nivel INTEGER NOT NULL,
    pelada_id TEXT NOT NULL,
    status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
    foto_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    posicao TEXT
);

-- Índices recomendados
CREATE INDEX IF NOT EXISTS idx_jogadores_pelada_id ON jogadores(pelada_id);
CREATE INDEX IF NOT EXISTS idx_jogadores_status ON jogadores(status);
