-- Script para limpar registros duplicados na tabela fila
-- Mantém apenas 1 registro por jogador em cada sessão

-- PASSO 1: Ver duplicatas antes de limpar (para conferir)
SELECT 
  jogador_id,
  sessao_id, 
  pelada_id,
  COUNT(*) as quantidade,
  STRING_AGG(status::text || ' (pos: ' || posicao_fila::text || ', id: ' || id::text || ')', ', ' ORDER BY status) as registros
FROM fila
GROUP BY jogador_id, sessao_id, pelada_id
HAVING COUNT(*) > 1
ORDER BY quantidade DESC;

-- PASSO 2: Deletar duplicatas mantendo apenas 1 registro por jogador/sessão
-- Prioridade: mantém 'fila' > 'reserva', e o mais recente
DELETE FROM fila
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY jogador_id, sessao_id, pelada_id 
        ORDER BY 
          CASE 
            WHEN status = 'fila' THEN 1 
            WHEN status = 'reserva' THEN 2 
          END,
          created_at DESC
      ) as row_num
    FROM fila
  ) t
  WHERE row_num > 1
);

-- PASSO 3: Verificar se ainda há duplicatas
SELECT 
  jogador_id,
  sessao_id, 
  pelada_id,
  COUNT(*) as quantidade
FROM fila
GROUP BY jogador_id, sessao_id, pelada_id
HAVING COUNT(*) > 1;

-- Se retornar vazio = sucesso! Não há mais duplicatas
