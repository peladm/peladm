-- Ver todas as colunas da tabela regras
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'regras'
ORDER BY ordinal_position;

-- Ver os valores atuais das regras
SELECT 
  jogadores_por_time,
  duracao,
  regra_empate,
  empate_conta_vitoria,
  vitorias_consecutivas,
  prioridade_retorno,
  pelada_id
FROM regras;
