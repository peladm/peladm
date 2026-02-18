-- =====================================================
-- REMOVER COLUNAS DE ESTATÍSTICAS DA TABELA JOGADORES
-- =====================================================
-- As estatísticas agora são calculadas dinamicamente
-- a partir das tabelas: jogos, gols e assistencias
-- =====================================================

-- Execute este SQL no Supabase SQL Editor
-- para CADA banco de dados dedicado dos clientes

ALTER TABLE jogadores
  DROP COLUMN IF EXISTS jogos,
  DROP COLUMN IF EXISTS vitorias,
  DROP COLUMN IF EXISTS derrotas,
  DROP COLUMN IF EXISTS empates,
  DROP COLUMN IF EXISTS gols,
  DROP COLUMN IF EXISTS assistencias;

-- Verificar estrutura final da tabela
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'jogadores'
ORDER BY ordinal_position;

-- =====================================================
-- ESTRUTURA FINAL ESPERADA:
-- =====================================================
-- id            | uuid         | NO
-- nome          | text         | NO
-- nivel         | integer      | YES (default: 3)
-- pelada_id     | text         | NO
-- status        | text         | YES (default: 'ativo')
-- created_at    | timestamptz  | YES (default: now())
-- =====================================================
