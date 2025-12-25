-- Verificar se existe coluna antiga regra_apos_vitorias
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'regras' 
  AND column_name LIKE '%vitorias%';

-- Se existir a coluna antiga, ela pode estar com valor vencedor_antes
-- Vamos ver o valor das duas colunas:
SELECT 
  pelada_id,
  prioridade_retorno,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'regras' AND column_name = 'regra_apos_vitorias'
    ) THEN (SELECT regra_apos_vitorias FROM regras WHERE pelada_id = r.pelada_id)
    ELSE NULL 
  END as regra_apos_vitorias_antiga
FROM regras r;

-- Para corrigir definitivamente, delete a coluna antiga se existir:
-- ALTER TABLE regras DROP COLUMN IF EXISTS regra_apos_vitorias;
