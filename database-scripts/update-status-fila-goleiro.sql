-- ============================================
-- ATUALIZAR CONSTRAINT STATUS DA TABELA FILA
-- Data: Maio/2026
-- ============================================

/*
Este script atualiza a constraint CHECK da tabela fila para
permitir o novo status 'goleiro' além de 'fila' e 'reserva'.

ALTERAÇÕES:
1. Remove a constraint antiga
2. Adiciona nova constraint com 'goleiro'
*/

-- 1. Remover constraint antiga
ALTER TABLE fila DROP CONSTRAINT IF EXISTS fila_status_check;

-- 2. Adicionar nova constraint incluindo 'goleiro'
ALTER TABLE fila
  ADD CONSTRAINT fila_status_check CHECK (status IN ('fila', 'reserva', 'goleiro'));