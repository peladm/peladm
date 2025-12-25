-- Ver regras de empate completas
SELECT 
  regra_empate,
  regra_apos_empate,
  empate_conta_vitoria,
  vitorias_consecutivas,
  prioridade_retorno,
  duracao,
  jogadores_por_time
FROM regras
LIMIT 1;
