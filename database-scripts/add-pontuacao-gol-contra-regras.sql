-- Adiciona pontuacao de gol contra na tabela de regras (Supabase master)
-- Valor padrao sugerido: -2 (penalidade relevante)

ALTER TABLE regras
ADD COLUMN IF NOT EXISTS pontuacao_gol_contra NUMERIC(4,2) DEFAULT -2;

-- Garante valor para registros antigos que estejam nulos
UPDATE regras
SET pontuacao_gol_contra = -2
WHERE pontuacao_gol_contra IS NULL;

-- Opcional: valida faixa razoavel de configuracao
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'regras_pontuacao_gol_contra_check'
  ) THEN
    ALTER TABLE regras
    ADD CONSTRAINT regras_pontuacao_gol_contra_check
    CHECK (pontuacao_gol_contra >= -10 AND pontuacao_gol_contra <= 10);
  END IF;
END $$;
