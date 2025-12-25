-- 1. Identificar Gustavo Scarpa duplicado
SELECT id, nome, status 
FROM jogadores 
WHERE nome = 'Gustavo Scarpa';

-- 2. Deletar um dos Gustavo Scarpa duplicados (mantém o primeiro)
DELETE FROM jogadores
WHERE id IN (
  SELECT id
  FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY nome ORDER BY id) as rn
    FROM jogadores
    WHERE nome = 'Gustavo Scarpa'
  ) t
  WHERE rn > 1
);

-- 3. Atualizar TODOS os jogadores para status='ativo'
-- (fila/reserva deve ser controlado apenas na tabela 'fila', não em 'jogadores')
UPDATE jogadores
SET status = 'ativo'
WHERE status IN ('fila', 'reserva');

-- 4. Verificar resultado final
SELECT 
  status,
  COUNT(*) as quantidade
FROM jogadores
GROUP BY status
ORDER BY quantidade DESC;

-- 5. Confirmar que não há mais duplicatas
SELECT 
  nome,
  COUNT(*) as quantidade
FROM jogadores
GROUP BY nome
HAVING COUNT(*) > 1;
