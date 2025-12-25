-- ============================================
-- CORRIGIR PLANO DO CLIENTE
-- ============================================
-- Problema: O campo 'plano' está armazenando JSON ao invés de string simples
-- Exemplo: {"tipo":"Premium","preco":39.9,"bloqueado":false}
-- Precisa ser: 'premium' (lowercase)

-- 1. VERIFICAR O VALOR ATUAL
SELECT id, nome, email, plano 
FROM clientes;

-- 2. VERIFICAR SE É JSON E EXTRAIR O VALOR DO TIPO
-- Se for JSONB:
UPDATE clientes 
SET plano = LOWER(plano::jsonb->>'tipo')
WHERE plano::text LIKE '{%';

-- Se for TEXT com JSON:
UPDATE clientes 
SET plano = LOWER(
  CASE 
    WHEN plano LIKE '%Premium%' THEN 'premium'
    WHEN plano LIKE '%Gold%' THEN 'gold'
    WHEN plano LIKE '%Free%' THEN 'free'
    ELSE 'free'
  END
)
WHERE plano LIKE '{%';

-- 3. VERIFICAR NOVAMENTE APÓS A CORREÇÃO
SELECT id, nome, email, plano 
FROM clientes;
