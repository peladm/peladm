-- Adiciona data de criação na tabela jogadores (apenas criação)
-- Observação: NÃO cria updated_at

ALTER TABLE jogadores
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Ajusta jogadores já cadastrados para uma data base fixa
-- (evita tratar todos como "recém-cadastrados")
UPDATE jogadores
SET created_at = TIMESTAMPTZ '2026-01-01 00:00:00+00'
WHERE created_at IS NULL
	OR created_at::date = CURRENT_DATE;
