-- =========================================
-- CONSOLIDAÇÃO DE ESTATÍSTICAS - PELADA 27/01/2026
-- =========================================

WITH sessao_alvo AS (
    SELECT s.id, s.pelada_id
    FROM sessoes s
    WHERE s.data >= '2026-01-27' AND s.data < '2026-01-28'
    LIMIT 1
),
jogadores_nos_jogos AS (
    -- Expande os jogadores do time A
    SELECT 
        j.id as jogo_id,
        j.numero_jogo,
        jsonb_array_elements_text(j.time_a) as jogador_nome,
        'A' as time,
        j.time_vencedor,
        j.placar_a,
        j.placar_b
    FROM jogos j
    JOIN sessao_alvo sa ON j.sessao_id = sa.id
    WHERE j.status = 'finalizado'
    
    UNION ALL
    
    -- Expande os jogadores do time B
    SELECT 
        j.id as jogo_id,
        j.numero_jogo,
        jsonb_array_elements_text(j.time_b) as jogador_nome,
        'B' as time,
        j.time_vencedor,
        j.placar_a,
        j.placar_b
    FROM jogos j
    JOIN sessao_alvo sa ON j.sessao_id = sa.id
    WHERE j.status = 'finalizado'
),
estatisticas_por_nome AS (
    SELECT 
        jogador_nome,
        COUNT(*) as total_jogos,
        SUM(CASE WHEN time_vencedor = time THEN 1 ELSE 0 END) as vitorias,
        SUM(CASE 
            WHEN time_vencedor IS NOT NULL 
                 AND time_vencedor != 'empate' 
                 AND time_vencedor != time 
            THEN 1 ELSE 0 END) as derrotas,
        SUM(CASE WHEN time_vencedor = 'empate' THEN 1 ELSE 0 END) as empates
    FROM jogadores_nos_jogos
    GROUP BY jogador_nome
),
gols_por_jogador AS (
    -- Buscar gols relacionando com a tabela jogadores
    SELECT 
        jog.nome as jogador_nome,
        COUNT(g.id) as total_gols
    FROM gols g
    JOIN jogos jo ON jo.id::text = g.jogo_id
    JOIN sessao_alvo sa ON jo.sessao_id = sa.id
    JOIN jogadores jog ON jog.id::text = g.jogador_id
    GROUP BY jog.nome
)
SELECT 
    e.jogador_nome,
    e.total_jogos,
    e.vitorias,
    e.derrotas,
    e.empates,
    COALESCE(g.total_gols, 0) as total_gols,
    (SELECT pelada_id FROM sessao_alvo) as pelada_id
FROM estatisticas_por_nome e
LEFT JOIN gols_por_jogador g ON g.jogador_nome = e.jogador_nome
ORDER BY e.total_jogos DESC, e.jogador_nome;
