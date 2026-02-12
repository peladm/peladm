-- Fix RLS e Foreign Keys da tabela assistencias
-- Problema: Tabela criada com foreign keys UUID, precisa ser TEXT (igual gols)
-- Solução: Dropar constraints, alterar tipos, desabilitar RLS

-- 1. Dropar foreign key constraints (se existirem)
ALTER TABLE assistencias DROP CONSTRAINT IF EXISTS assistencias_jogo_id_fkey;
ALTER TABLE assistencias DROP CONSTRAINT IF EXISTS assistencias_jogador_id_fkey;

-- 2. Alterar tipos de colunas para TEXT
ALTER TABLE assistencias 
  ALTER COLUMN jogo_id TYPE text,
  ALTER COLUMN jogador_id TYPE text;

-- 3. Dropar políticas RLS existentes
DROP POLICY IF EXISTS "Usuários podem visualizar assistências" ON assistencias;
DROP POLICY IF EXISTS "Usuários podem inserir assistências" ON assistencias;
DROP POLICY IF EXISTS "Usuários podem atualizar assistências" ON assistencias;
DROP POLICY IF EXISTS "Usuários podem deletar assistências" ON assistencias;

-- 4. Desabilitar RLS
ALTER TABLE assistencias DISABLE ROW LEVEL SECURITY;

-- Pronto! Agora a tabela assistencias funciona igual à tabela gols
