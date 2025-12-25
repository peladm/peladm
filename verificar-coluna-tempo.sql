-- Verificar a estrutura da tabela regras
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'regras';

-- Ver os valores atuais
SELECT 
  jogadores_por_time,
  duracao,
  pelada_id
FROM regras
LIMIT 5;
