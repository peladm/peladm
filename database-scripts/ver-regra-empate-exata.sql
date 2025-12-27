-- Ver valor EXATO da regra de empate (com aspas para ver espaços)
SELECT 
  '"' || regra_empate || '"' as regra_empate_com_aspas,
  length(regra_empate) as tamanho,
  '"' || regra_apos_empate || '"' as regra_apos_empate_com_aspas,
  empate_conta_vitoria,
  vitorias_consecutivas
FROM regras
LIMIT 1;
