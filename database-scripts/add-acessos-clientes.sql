-- ============================================================
-- MIGRACAO: CONTROLE DE ACESSO POR MODO + GARANTIA DE STATUS
-- Data: 2026-07-01
-- ============================================================
-- Objetivo:
-- 1) Adicionar controle de acesso por modo na tabela clientes
-- 2) Garantir coluna status com default/check para bloqueio global
--
-- Observacao:
-- - O Modo Torneio segue bloqueado em desenvolvimento no frontend,
--   mesmo quando acesso_modo_torneio = true.
-- ============================================================

BEGIN;

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS acesso_pelada_tradicional BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS acesso_modo_torneio BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ativo';

-- Garantir valores para dados legados (caso existam nulos)
UPDATE clientes
SET
  acesso_pelada_tradicional = COALESCE(acesso_pelada_tradicional, TRUE),
  acesso_modo_torneio = COALESCE(acesso_modo_torneio, FALSE),
  status = COALESCE(NULLIF(TRIM(status), ''), 'ativo');

-- Recria check constraint de status de forma idempotente
ALTER TABLE clientes
  DROP CONSTRAINT IF EXISTS clientes_status_check;

ALTER TABLE clientes
  ADD CONSTRAINT clientes_status_check
  CHECK (status IN ('ativo', 'inativo', 'bloqueado'));

-- Opcional: índice para filtros administrativos por status
CREATE INDEX IF NOT EXISTS idx_clientes_status ON clientes(status);

COMMIT;
