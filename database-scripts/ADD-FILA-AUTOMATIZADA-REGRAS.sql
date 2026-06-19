-- ================================================
-- MIGRATION: Adicionar coluna fila_automatizada
-- Data: 15/06/2026
-- Descrição: Adiciona suporte para automação da fila nas regras
-- ================================================

-- 1️⃣ ADICIONAR COLUNA NO BANCO PRINCIPAL (Master)
-- ================================================
ALTER TABLE regras ADD COLUMN IF NOT EXISTS fila_automatizada BOOLEAN DEFAULT true;

-- Comentário explicativo
COMMENT ON COLUMN regras.fila_automatizada IS 'Se true: fila automatizada; Se false: fila manual (exige confirmação)';

-- 2️⃣ ATUALIZAR VALORES EXISTENTES (padrão: true)
-- ================================================
UPDATE regras 
SET fila_automatizada = true 
WHERE fila_automatizada IS NULL;

-- 3️⃣ ADICIONAR CONSTRAINT (opcional - garante que não seja NULL)
-- ================================================
ALTER TABLE regras 
ALTER COLUMN fila_automatizada SET NOT NULL;

-- ================================================
-- APÓS EXECUTAR AQUI, EXECUTAR NO BANCO DO CLIENTE
-- (Substituir o banco_cliente_url pelo da sua pelada)
-- ================================================

-- 1️⃣ ADICIONAR COLUNA NO BANCO DO CLIENTE (Dedicado)
-- ================================================
-- ALTER TABLE regras ADD COLUMN IF NOT EXISTS fila_automatizada BOOLEAN DEFAULT true;
-- 
-- COMMENT ON COLUMN regras.fila_automatizada IS 'Se true: fila automatizada; Se false: fila manual (exige confirmação)';
-- 
-- UPDATE regras 
-- SET fila_automatizada = true 
-- WHERE fila_automatizada IS NULL;
-- 
-- ALTER TABLE regras 
-- ALTER COLUMN fila_automatizada SET NOT NULL;

-- ================================================
-- VALIDAÇÃO
-- ================================================
-- Execute para verificar:
-- SELECT * FROM regras LIMIT 1;
-- Deve aparecer a coluna fila_automatizada com valor true

