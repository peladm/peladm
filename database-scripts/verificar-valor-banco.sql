-- Verificar o valor REAL no banco (TODAS as regras)
SELECT 
  pelada_id,
  vitorias_consecutivas,
  prioridade_retorno,
  regra_empate,
  empate_conta_vitoria,
  tipo_fila
FROM regras;

-- Se estiver errado, corrigir manualmente (use o pelada_id retornado acima):
-- UPDATE regras 
-- SET prioridade_retorno = 'perdedor_continua'
-- WHERE pelada_id = 'COLE_O_ID_AQUI';
