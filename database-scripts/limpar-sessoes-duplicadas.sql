-- =====================================================
-- LIMPAR SESSÕES DUPLICADAS (MANTER APENAS A MAIS RECENTE)
-- =====================================================

-- 1. VERIFICAR QUANTAS SESSÕES ATIVAS EXISTEM POR PELADA
SELECT 
    pelada_id,
    COUNT(*) as sessoes_ativas,
    STRING_AGG(id::text, ', ') as ids_sessoes
FROM sessoes
WHERE status = 'ativa'
GROUP BY pelada_id
HAVING COUNT(*) > 1;

-- 2. FINALIZAR SESSÕES ANTIGAS (mantém apenas a mais recente)
-- Execute este UPDATE para cada pelada_id que tem duplicatas:

UPDATE sessoes
SET status = 'finalizada'
WHERE id IN (
    SELECT id
    FROM (
        SELECT 
            id,
            ROW_NUMBER() OVER (PARTITION BY pelada_id ORDER BY created_at DESC) as rn
        FROM sessoes
        WHERE status = 'ativa'
    ) sub
    WHERE rn > 1  -- Mantém apenas a 1ª (mais recente)
);

-- 3. VERIFICAR RESULTADO (deve ter apenas 1 ativa por pelada)
SELECT 
    pelada_id,
    COUNT(*) as sessoes_ativas
FROM sessoes
WHERE status = 'ativa'
GROUP BY pelada_id;
