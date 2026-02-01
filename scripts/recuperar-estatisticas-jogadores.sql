-- =========================================
-- SCRIPT: Recuperar Estatísticas dos Jogadores
-- =========================================
-- OBJETIVO: Extrair dados das tabelas 'gols' e 'jogos' para
--           atualizar manualmente a tabela 'jogadores'
-- =========================================

-- PASSO 1: Identificar qual sessão teve o problema
-- Sessão do dia 27/01/2026
SELECT 
    s.id as sessao_id,
    s.data,
    s.pelada_id,
    COUNT(DISTINCT j.id) as total_jogos
FROM sessoes s
LEFT JOIN jogos j ON j.sessao_id = s.id
WHERE s.data >= '2026-01-27' AND s.data < '2026-01-28'
GROUP BY s.id, s.data, s.pelada_id
ORDER BY s.data DESC;

-- =========================================
-- PASSO 2: Estatísticas de GOLS por Jogador
-- =========================================
-- Extrai quantos gols cada jogador marcou nos jogos da sessão problemática

WITH sessao_alvo AS (
    SELECT s.id
    FROM sessoes s
    WHERE s.data >= '2026-01-27' AND s.data < '2026-01-28'
    LIMIT 1
)
SELECT 
    g.jogador_id,
    jo.sessao_id,
    COUNT(*) as total_gols,
    STRING_AGG(DISTINCT g.jogo_id, ', ') as jogos_marcou
FROM gols g
JOIN jogos jo ON jo.id::text = g.jogo_id
JOIN sessao_alvo sa ON jo.sessao_id = sa.id
GROUP BY g.jogador_id, jo.sessao_id
ORDER BY total_gols DESC;

-- =========================================
-- PASSO 3: Estatísticas de JOGOS, VITÓRIAS, DERROTAS e EMPATES
-- =========================================
-- Extrai participação em jogos e resultados por jogador

WITH sessao_alvo AS (
    SELECT s.id
    FROM sessoes s
    WHERE s.data >= '2026-01-27' AND s.data < '2026-01-28'
    LIMIT 1
),
jogadores_expandidos AS (
    -- Expande os jogadores do time A
    SELECT 
        j.id as jogo_id,
        j.sessao_id,
        jsonb_array_elements(j.time_a) ->> 'id' as jogador_id,
        jsonb_array_elements(j.time_a) ->> 'nome' as jogador_nome,
        'A' as time,
        j.time_vencedor,
        j.status
    FROM jogos j
    JOIN sessao_alvo sa ON j.sessao_id = sa.id
    WHERE j.status = 'finalizado'
    
    UNION ALL
    
    -- Expande os jogadores do time B
    SELECT 
        j.id as jogo_id,
        j.sessao_id,
        jsonb_array_elements(j.time_b) ->> 'id' as jogador_id,
        jsonb_array_elements(j.time_b) ->> 'nome' as jogador_nome,
        'B' as time,
        j.time_vencedor,
        j.status
    FROM jogos j
    JOIN sessao_alvo sa ON j.sessao_id = sa.id
    WHERE j.status = 'finalizado'
)
SELECT 
    jogador_id,
    jogador_nome,
    COUNT(*) as total_jogos,
    SUM(CASE 
        WHEN time_vencedor = time THEN 1 
        ELSE 0 
    END) as vitorias,
    SUM(CASE 
        WHEN time_vencedor IS NOT NULL 
             AND time_vencedor != 'empate' 
             AND time_vencedor != time 
        THEN 1 
        ELSE 0 
    END) as derrotas,
    SUM(CASE 
        WHEN time_vencedor = 'empate' THEN 1 
        ELSE 0 
    END) as empates
FROM jogadores_expandidos
GROUP BY jogador_id, jogador_nome
ORDER BY total_jogos DESC, jogador_nome;

-- =========================================
-- PASSO 4: CONSOLIDAÇÃO COMPLETA (GOLS + JOGOS)
-- =========================================
-- Junta todas as informações em uma única query

WITH sessao_alvo AS (
    SELECT s.id, s.pelada_id
    FROM sessoes s
    WHERE s.data >= '2026-01-27' AND s.data < '2026-01-28'
    LIMIT 1
),
jogadores_expandidos AS (
    -- Expande os jogadores do time A
    SELECT 
        j.id as jogo_id,
        j.sessao_id,
        jsonb_array_elements(j.time_a) ->> 'id' as jogador_id,
        jsonb_array_elements(j.time_a) ->> 'nome' as jogador_nome,
        'A' as time,
        j.time_vencedor,
        j.status
    FROM jogos j
    JOIN sessao_alvo sa ON j.sessao_id = sa.id
    WHERE j.status = 'finalizado'
    
    UNION ALL
    
    -- Expande os jogadores do time B
    SELECT 
        j.id as jogo_id,
        j.sessao_id,
        jsonb_array_elements(j.time_b) ->> 'id' as jogador_id,
        jsonb_array_elements(j.time_b) ->> 'nome' as jogador_nome,
        'B' as time,
        j.time_vencedor,
        j.status
    FROM jogos j
    JOIN sessao_alvo sa ON j.sessao_id = sa.id
    WHERE j.status = 'finalizado'
),
estatisticas_jogos AS (
    SELECT 
        jogador_id,
        jogador_nome,
        COUNT(*) as total_jogos,
        SUM(CASE WHEN time_vencedor = time THEN 1 ELSE 0 END) as vitorias,
        SUM(CASE 
            WHEN time_vencedor IS NOT NULL 
                 AND time_vencedor != 'empate' 
                 AND time_vencedor != time 
            THEN 1 ELSE 0 END) as derrotas,
        SUM(CASE WHEN time_vencedor = 'empate' THEN 1 ELSE 0 END) as empates
    FROM jogadores_expandidos
    GROUP BY jogador_id, jogador_nome
),
estatisticas_gols AS (
    SELECT 
        g.jogador_id,
        COUNT(*) as total_gols
    FROM gols g
    JOIN jogos jo ON jo.id::text = g.jogo_id
    JOIN sessao_alvo sa ON jo.sessao_id = sa.id
    GROUP BY g.jogador_id
)
SELECT 
    ej.jogador_id,
    ej.jogador_nome,
    ej.total_jogos,
    ej.vitorias,
    ej.derrotas,
    ej.empates,
    COALESCE(eg.total_gols, 0) as total_gols,
    (SELECT pelada_id FROM sessao_alvo) as pelada_id
FROM estatisticas_jogos ej
LEFT JOIN estatisticas_gols eg ON eg.jogador_id = ej.jogador_id
ORDER BY ej.total_jogos DESC, ej.jogador_nome;

-- =========================================
-- PASSO 5: GERAR COMANDOS UPDATE AUTOMATICAMENTE
-- =========================================
-- Esta query gera os comandos UPDATE prontos para executar

WITH sessao_alvo AS (
    SELECT s.id, s.pelada_id
    FROM sessoes s
    WHERE s.data >= '2026-01-27' AND s.data < '2026-01-28'
    LIMIT 1
),
jogadores_expandidos AS (
    SELECT 
        j.id as jogo_id,
        j.sessao_id,
        jsonb_array_elements(j.time_a) ->> 'id' as jogador_id,
        jsonb_array_elements(j.time_a) ->> 'nome' as jogador_nome,
        'A' as time,
        j.time_vencedor,
        j.status
    FROM jogos j
    JOIN sessao_alvo sa ON j.sessao_id = sa.id
    WHERE j.status = 'finalizado'
    
    UNION ALL
    
    SELECT 
        j.id as jogo_id,
        j.sessao_id,
        jsonb_array_elements(j.time_b) ->> 'id' as jogador_id,
        jsonb_array_elements(j.time_b) ->> 'nome' as jogador_nome,
        'B' as time,
        j.time_vencedor,
        j.status
    FROM jogos j
    JOIN sessao_alvo sa ON j.sessao_id = sa.id
    WHERE j.status = 'finalizado'
),
estatisticas_jogos AS (
    SELECT 
        jogador_id,
        jogador_nome,
        COUNT(*) as total_jogos,
        SUM(CASE WHEN time_vencedor = time THEN 1 ELSE 0 END) as vitorias,
        SUM(CASE 
            WHEN time_vencedor IS NOT NULL 
                 AND time_vencedor != 'empate' 
                 AND time_vencedor != time 
            THEN 1 ELSE 0 END) as derrotas,
        SUM(CASE WHEN time_vencedor = 'empate' THEN 1 ELSE 0 END) as empates
    FROM jogadores_expandidos
    GROUP BY jogador_id, jogador_nome
),
estatisticas_gols AS (
    SELECT 
        g.jogador_id,
        COUNT(*) as total_gols
    FROM gols g
    JOIN jogos jo ON jo.id::text = g.jogo_id
    JOIN sessao_alvo sa ON jo.sessao_id = sa.id
    GROUP BY g.jogador_id
),
dados_completos AS (
    SELECT 
        ej.jogador_id,
        ej.jogador_nome,
        ej.total_jogos,
        ej.vitorias,
        ej.derrotas,
        ej.empates,
        COALESCE(eg.total_gols, 0) as total_gols,
        (SELECT pelada_id FROM sessao_alvo) as pelada_id
    FROM estatisticas_jogos ej
    LEFT JOIN estatisticas_gols eg ON eg.jogador_id = ej.jogador_id
)
SELECT 
    FORMAT('UPDATE jogadores SET jogos = jogos + %s, vitorias = vitorias + %s, derrotas = derrotas + %s, empates = empates + %s, gols = gols + %s WHERE id = ''%s'' AND pelada_id = ''%s''; -- %s',
        total_jogos,
        vitorias,
        derrotas,
        empates,
        total_gols,
        jogador_id,
        pelada_id,
        jogador_nome
    ) as comando_update
FROM dados_completos
ORDER BY jogador_nome;

-- =========================================
-- PASSO 6 (OPCIONAL): Verificar estatísticas atuais dos jogadores
-- =========================================
SELECT 
    id,
    nome,
    jogos,
    vitorias,
    derrotas,
    empates,
    gols
FROM jogadores
WHERE pelada_id = 'COLE_O_PELADA_ID_AQUI'  -- AJUSTE COM O PELADA_ID
ORDER BY nome;
