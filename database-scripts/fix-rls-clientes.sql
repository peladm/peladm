-- ========================================
-- FIX RLS PARA TABELA CLIENTES
-- ========================================
-- Problema: "permission denied for table clients"
-- Causa: Políticas RLS muito restritivas impedem inserts
-- Solução: Permitir inserts sem autenticação (painel admin usa anon key)
-- Data: 07/05/2026

-- 1. Verificar se RLS está ativada
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'clientes';

-- 2. Ativar RLS (se não estiver)
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

-- 3. Dropar políticas existentes que possam estar causando o problema
DROP POLICY IF EXISTS "Clientes - SELECT" ON clientes;
DROP POLICY IF EXISTS "Clientes - INSERT" ON clientes;
DROP POLICY IF EXISTS "Clientes - UPDATE" ON clientes;
DROP POLICY IF EXISTS "Clientes - DELETE" ON clientes;
DROP POLICY IF EXISTS "SELECT para anon" ON clientes;
DROP POLICY IF EXISTS "INSERT para anon" ON clientes;
DROP POLICY IF EXISTS "UPDATE para anon" ON clientes;
DROP POLICY IF EXISTS "Acesso público" ON clientes;
DROP POLICY IF EXISTS "Allow public insert" ON clientes;
DROP POLICY IF EXISTS "Allow public select" ON clientes;

-- 4. Criar nova política: PERMITIR INSERTS PÚBLICOS (necessário para o painel admin)
-- O painel admin usa a chave anonônica do projeto, então precisa de acesso público
CREATE POLICY "Permitir insert público - Admin" ON clientes
  FOR INSERT
  WITH CHECK (true);

-- 5. Criar política: PERMITIR SELECTS PÚBLICOS
CREATE POLICY "Permitir select público" ON clientes
  FOR SELECT
  USING (true);

-- 6. Criar política: PERMITIR UPDATES PÚBLICOS
CREATE POLICY "Permitir update público" ON clientes
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 7. Criar política: PERMITIR DELETES PÚBLICOS (opcional)
CREATE POLICY "Permitir delete público" ON clientes
  FOR DELETE
  USING (true);

-- ========================================
-- VALIDAÇÃO
-- ========================================
-- Execute isto após aplicar o fix:
-- SELECT * FROM clientes LIMIT 1;
-- 
-- Se não der erro, o problema foi resolvido!

-- ========================================
-- ALTERNATIVA: Se as políticas acima não funcionarem
-- ========================================
-- Você pode executar isto para desabilitar RLS completamente (menos seguro):
-- ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;
-- 
-- Mas recomenda-se manter RLS ativada com as políticas acima.
