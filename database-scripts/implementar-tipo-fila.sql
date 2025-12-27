-- ============================================
-- IMPLEMENTAÇÃO: TIPO DE FILA COM CONTROLE DE ACESSO
-- ============================================
-- Data: 13/12/2025
-- Objetivo: Adicionar coluna tipo_fila na tabela regras
--           para controlar qual interface de fila será usada
--           baseado no plano do usuário
-- ============================================

-- 1. Adicionar coluna tipo_fila
ALTER TABLE regras ADD COLUMN IF NOT EXISTS tipo_fila TEXT DEFAULT 'fila2';

-- 2. Adicionar comentário explicativo
COMMENT ON COLUMN regras.tipo_fila IS 'Tipo de fila: fila1 (premium exclusivo) ou fila2 (todos os planos). Controla qual interface será aberta.';

-- 3. Atualizar registros existentes para fila2 (padrão seguro)
UPDATE regras 
SET tipo_fila = 'fila2' 
WHERE tipo_fila IS NULL OR tipo_fila = '';

-- 4. Adicionar constraint para aceitar apenas valores válidos
ALTER TABLE regras 
ADD CONSTRAINT tipo_fila_check 
CHECK (tipo_fila IN ('fila1', 'fila2'));

-- ============================================
-- REGRAS DE NEGÓCIO:
-- ============================================
-- 1. Planos FREE e GOLD:
--    - Forçados para fila2 (sem opção de escolha)
--    - Se tentarem acessar /fila, são redirecionados para /fila2
--
-- 2. Plano PREMIUM:
--    - Podem escolher entre fila1 ou fila2
--    - Fila1 é diferencial exclusivo Premium
--    - Redirecionamento automático baseado em configuração
--
-- 3. Redirecionamento Automático:
--    - /fila: verifica tipo_fila, redireciona se necessário
--    - /fila2: verifica tipo_fila, redireciona premium se config = fila1
-- ============================================

-- Verificar resultado
SELECT pelada_id, tipo_fila, jogadores_por_time, modelo_sorteio
FROM regras
LIMIT 10;
