-- Resetar todos os jogadores para status 'ativo'
-- Este script corrige o problema dos status incorretos na tabela jogadores

UPDATE jogadores 
SET status = 'ativo'
WHERE status IN ('jogando', 'fila', 'aguardando') OR status IS NULL;

-- Verificar o resultado
SELECT pelada_id, status, COUNT(*) as total
FROM jogadores 
GROUP BY pelada_id, status
ORDER BY pelada_id, status;