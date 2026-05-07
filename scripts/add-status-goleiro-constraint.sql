-- Script para adicionar o status 'goleiro' à constraint da tabela fila
-- Execute este script no painel do Supabase SQL Editor

-- Primeiro, remover a constraint existente
ALTER TABLE fila DROP CONSTRAINT IF EXISTS fila_status_check;

-- Depois, criar a nova constraint incluindo 'goleiro'
ALTER TABLE fila ADD CONSTRAINT fila_status_check
CHECK (status IN ('jogando', 'fila', 'reserva', 'goleiro'));