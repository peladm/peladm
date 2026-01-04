-- ============================================
-- ADICIONAR COLUNA EMPATES NA TABELA JOGADORES
-- ============================================
-- Execute no SQL Editor do Supabase
-- Data: 2026-01-04

-- Adicionar coluna empates (padrão 0)
ALTER TABLE jogadores 
ADD COLUMN IF NOT EXISTS empates INTEGER DEFAULT 0;

-- Comentário da coluna
COMMENT ON COLUMN jogadores.empates IS 'Total de empates do jogador';

-- Atualizar jogadores existentes com empates = 0 (caso já existam dados)
UPDATE jogadores SET empates = 0 WHERE empates IS NULL;

-- Verificar estrutura
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'jogadores'
ORDER BY ordinal_position;
