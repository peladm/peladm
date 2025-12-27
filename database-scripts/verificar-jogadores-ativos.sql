-- Verificar quantos jogadores existem e seus status
SELECT 
  status,
  COUNT(*) as quantidade
FROM jogadores
GROUP BY status
ORDER BY quantidade DESC;

-- Ver todos os jogadores e seus status
SELECT 
  nome,
  status,
  pelada_id
FROM jogadores
ORDER BY nome;

-- Verificar se há jogadores sem status definido
SELECT 
  nome,
  status,
  pelada_id
FROM jogadores
WHERE status IS NULL OR status = '';
