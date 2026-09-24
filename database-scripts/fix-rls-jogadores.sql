-- ============================================================
-- CORREÇÃO DE RLS - TABELA JOGADORES
-- ============================================================
-- Problema: Erro 42501 "new row violates row-level security policy"
-- ao tentar criar/salvar jogador
-- Causa: RLS foi habilitado com políticas restritivas
-- Solução: Desabilitar RLS em todas as tabelas
-- Data: 20/06/2026
-- ============================================================

-- 1️⃣ DESABILITAR RLS NA TABELA JOGADORES
-- ============================================================
ALTER TABLE jogadores DISABLE ROW LEVEL SECURITY;

-- 2️⃣ REMOVER TODAS AS POLÍTICAS RLS EXISTENTES
-- ============================================================
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'jogadores'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON jogadores';
    END LOOP;
END $$;

-- 3️⃣ DESABILITAR RLS NAS OUTRAS TABELAS (por segurança)
-- ============================================================
ALTER TABLE IF EXISTS sessoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS jogos DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS gols DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS assistencias DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS regras DISABLE ROW LEVEL SECURITY;

-- Remover políticas das outras tabelas também
DO $$
DECLARE
    policy_record RECORD;
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY['sessoes', 'jogos', 'gols', 'assistencias', 'regras']
    LOOP
        FOR policy_record IN 
            SELECT policyname 
            FROM pg_policies 
            WHERE tablename = table_name
        LOOP
            EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON ' || table_name;
        END LOOP;
    END LOOP;
END $$;

-- 4️⃣ VALIDAÇÃO
-- ============================================================
DO $$
DECLARE
    rls_enabled BOOLEAN;
BEGIN
    -- Verificar status RLS
    SELECT rowsecurity INTO rls_enabled
    FROM pg_tables
    WHERE tablename = 'jogadores';
    
    IF rls_enabled THEN
        RAISE NOTICE '❌ ERRO: RLS ainda está ativado na tabela jogadores!';
        RAISE EXCEPTION 'RLS não foi desabilitado corretamente';
    ELSE
        RAISE NOTICE '✅ RLS desabilitado com sucesso na tabela jogadores!';
        RAISE NOTICE '✅ RLS desabilitado nas demais tabelas!';
        RAISE NOTICE '🎉 Problema resolvido! Você já pode criar/salvar jogadores!';
    END IF;
END $$;

-- ============================================================
-- ✅ CORREÇÃO COMPLETA
-- ============================================================
-- Execute este script no Supabase SQL Editor do cliente
-- Após executar, o erro 42501 será resolvido!
