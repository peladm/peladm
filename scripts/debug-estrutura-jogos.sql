-- Query para verificar a estrutura dos times nos jogos do dia 27/01/2026

SELECT 
    j.id as jogo_id,
    j.numero_jogo,
    j.time_a,
    j.time_b,
    j.placar_a,
    j.placar_b,
    j.time_vencedor,
    j.status
FROM jogos j
JOIN sessoes s ON j.sessao_id = s.id
WHERE s.data >= '2026-01-27' AND s.data < '2026-01-28'
  AND j.status = 'finalizado'
ORDER BY j.numero_jogo
LIMIT 1;
