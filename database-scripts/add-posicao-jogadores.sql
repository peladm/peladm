-- ============================================
-- ADICIONAR CAMPO POSIÇÃO À TABELA JOGADORES
-- Data: Maio/2026
-- ============================================

/*
Este script adiciona o campo 'posicao' à tabela jogadores para
rastrear se cada jogador é de linha ou goleiro.

ALTERAÇÕES:
1. Adiciona coluna posicao (text) com default 'linha'
2. Cria constraint CHECK para validar valores (linha ou goleiro)
3. Atualiza todos os registros existentes com 'linha' como padrão

NOTA: Se a coluna já existir, ALTER TABLE não falhará se usar IF NOT EXISTS
*/

-- 1. Adicionar coluna posicao (se não existir)
ALTER TABLE jogadores ADD COLUMN IF NOT EXISTS posicao TEXT DEFAULT 'linha';

-- 2. Adicionar constraint CHECK para posicao
ALTER TABLE jogadores
  ADD CONSTRAINT jogadores_posicao_check CHECK (posicao IN ('linha', 'goleiro'));

-- 3. Atualizar todos os registros existentes que tiverem posicao NULL
UPDATE jogadores
SET posicao = 'linha'
WHERE posicao IS NULL;

-- 4. Fazer a coluna NOT NULL (já que todos têm valor)
ALTER TABLE jogadores
  ALTER COLUMN posicao SET NOT NULL;

-- Verificar a estrutura final
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'jogadores'
-- ORDER BY ordinal_position;
