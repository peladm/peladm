-- ================================================
-- MIGRATION: Criar tabela auditoria_admin
-- Data: 08/08/2026
-- Descricao: Trilha de auditoria para a area administrativa
-- ================================================

CREATE TABLE IF NOT EXISTS auditoria_admin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_pelada_id TEXT NOT NULL,
  actor_username TEXT NOT NULL,
  acao TEXT NOT NULL,
  alvo_pelada_id TEXT,
  sucesso BOOLEAN NOT NULL DEFAULT true,
  detalhes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_admin_actor
  ON auditoria_admin (actor_pelada_id, actor_username);

CREATE INDEX IF NOT EXISTS idx_auditoria_admin_created_at
  ON auditoria_admin (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auditoria_admin_acao
  ON auditoria_admin (acao);

-- RLS habilitado para impedir leitura/escrita via clients anon/authenticated.
ALTER TABLE auditoria_admin ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'auditoria_admin'
      AND policyname = 'deny_all_auditoria_admin'
  ) THEN
    CREATE POLICY deny_all_auditoria_admin
      ON auditoria_admin
      FOR ALL
      TO anon, authenticated
      USING (false)
      WITH CHECK (false);
  END IF;
END $$;

COMMENT ON TABLE auditoria_admin IS 'Auditoria de acoes administrativas; gravacao preferencial via service_role no backend.';
