-- =========================================
-- SCRIPT: Renomear "Leonardo" para "Leonardo Vieira"
-- =========================================
-- Execute estas queries uma por uma no Supabase SQL Editor
-- =========================================

-- 1️⃣ Atualizar time_a: substituir "Leonardo" por "Leonardo Vieira"
UPDATE jogos
SET time_a = (
  SELECT jsonb_agg(
    CASE 
      WHEN elem::text = '"Leonardo"' THEN '"Leonardo Vieira"'::jsonb
      ELSE elem
    END
  )
  FROM jsonb_array_elements(time_a) elem
)
WHERE time_a::text LIKE '%"Leonardo"%';

-- 2️⃣ Atualizar time_b: substituir "Leonardo" por "Leonardo Vieira"
UPDATE jogos
SET time_b = (
  SELECT jsonb_agg(
    CASE 
      WHEN elem::text = '"Leonardo"' THEN '"Leonardo Vieira"'::jsonb
      ELSE elem
    END
  )
  FROM jsonb_array_elements(time_b) elem
)
WHERE time_b::text LIKE '%"Leonardo"%';

-- 3️⃣ Verificar resultado (últimos 10 jogos com Leonardo Vieira)
SELECT 
  numero_jogo,
  time_a,
  time_b,
  placar_a || 'x' || placar_b as placar,
  TO_CHAR(created_at, 'DD/MM/YYYY HH24:MI') as data
FROM jogos
WHERE time_a::text LIKE '%"Leonardo Vieira"%'
   OR time_b::text LIKE '%"Leonardo Vieira"%'
ORDER BY created_at DESC
LIMIT 10;

-- =========================================
-- OBSERVAÇÕES:
-- =========================================
-- ✅ Apenas a tabela JOGOS precisa ser atualizada
-- ✅ GOLS e ASSISTENCIAS usam UUID, não nome
-- ✅ Execute as 3 queries acima em sequência
-- ✅ A query 3 serve apenas para conferir
-- =========================================
