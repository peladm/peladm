-- =========================================
-- SCRIPT: Listar todos os nomes de jogadores nos jogos
-- =========================================
-- Use este script para identificar nomes que precisam
-- ser renomeados (por exemplo, versões antigas de nomes)
-- =========================================

-- Extrair todos os nomes únicos de time_a e time_b
WITH nomes_time_a AS (
  SELECT DISTINCT jsonb_array_elements_text(time_a) AS nome
  FROM jogos
),
nomes_time_b AS (
  SELECT DISTINCT jsonb_array_elements_text(time_b) AS nome
  FROM jogos
),
todos_nomes AS (
  SELECT nome FROM nomes_time_a
  UNION
  SELECT nome FROM nomes_time_b
)
SELECT 
  nome,
  (SELECT COUNT(*) FROM jogos WHERE time_a @> to_jsonb(todos_nomes.nome)) AS jogos_time_a,
  (SELECT COUNT(*) FROM jogos WHERE time_b @> to_jsonb(todos_nomes.nome)) AS jogos_time_b,
  (SELECT COUNT(*) FROM jogos WHERE time_a @> to_jsonb(todos_nomes.nome) OR time_b @> to_jsonb(todos_nomes.nome)) AS total_jogos
FROM todos_nomes
ORDER BY nome;

-- =========================================
-- Este script retorna:
-- - nome: Nome do jogador nos registros
-- - jogos_time_a: Quantas vezes jogou no time A
-- - jogos_time_b: Quantas vezes jogou no time B
-- - total_jogos: Total de partidas
-- =========================================
