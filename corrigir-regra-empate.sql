-- Corrigir regra de empate
UPDATE regras
SET regra_empate = 'ambos_saem'
WHERE regra_empate = 'desempate' 
  AND regra_apos_empate = 'desempate_decide';

-- Verificar
SELECT 
  regra_empate,
  regra_apos_empate,
  empate_conta_vitoria,
  vitorias_consecutivas
FROM regras;
