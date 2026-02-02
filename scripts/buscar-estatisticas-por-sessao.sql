-- =========================================
-- BUSCAR ESTATÍSTICAS DOS JOGADORES POR SESSÃO
-- =========================================
-- Calcula estatísticas dos jogadores através das tabelas gols e jogos
-- Agrupa por sessão (13/01/2026 e 27/01/2026)
-- =========================================

-- Estatísticas completas por jogador e sessão
WITH jogadores_nos_jogos AS (
  -- Extrai todos os jogadores que participaram dos jogos (time A)
  SELECT 
    j.sessao_id,
    s.data as data_sessao,
    j.id as jogo_id,
    j.time_vencedor,
    jsonb_array_elements_text(j.time_a) as jogador_nome,
    'A' as time
  FROM jogos j
  JOIN sessoes s ON s.id = j.sessao_id
  WHERE j.status = 'finalizado'
  
  UNION ALL
  
  -- Extrai todos os jogadores que participaram dos jogos (time B)
  SELECT 
    j.sessao_id,
    s.data as data_sessao,
    j.id as jogo_id,
    j.time_vencedor,
    jsonb_array_elements_text(j.time_b) as jogador_nome,
    'B' as time
  FROM jogos j
  JOIN sessoes s ON s.id = j.sessao_id
  WHERE j.status = 'finalizado'
),
estatisticas_base AS (
  SELECT 
    jnj.sessao_id,
    jnj.data_sessao,
    jnj.jogador_nome,
    COUNT(DISTINCT jnj.jogo_id) as total_jogos,
    
    -- Vitórias: quando o time do jogador venceu
    SUM(CASE 
      WHEN jnj.time_vencedor = jnj.time THEN 1 
      ELSE 0 
    END) as total_vitorias,
    
    -- Derrotas: quando o time do jogador perdeu
    SUM(CASE 
      WHEN jnj.time_vencedor IS NOT NULL 
        AND jnj.time_vencedor != 'empate' 
        AND jnj.time_vencedor != jnj.time 
      THEN 1 
      ELSE 0 
    END) as total_derrotas,
    
    -- Empates: quando time_vencedor é null (empate) ou explicitamente 'empate'
    SUM(CASE 
      WHEN jnj.time_vencedor IS NULL OR jnj.time_vencedor = 'empate' THEN 1 
      ELSE 0 
    END) as total_empates
    
  FROM jogadores_nos_jogos jnj
  GROUP BY jnj.sessao_id, jnj.data_sessao, jnj.jogador_nome
),
gols_por_jogador AS (
  -- Conta os gols por jogador em cada sessão
  SELECT 
    jo.sessao_id,
    jog.nome as jogador_nome,
    COUNT(*) as total_gols
  FROM gols g
  JOIN jogos jo ON jo.id::text = g.jogo_id
  JOIN jogadores jog ON jog.id::text = g.jogador_id
  WHERE jo.status = 'finalizado'
  GROUP BY jo.sessao_id, jog.nome
)

-- Resultado final: estatísticas completas
SELECT 
  eb.data_sessao,
  eb.jogador_nome,
  eb.total_jogos as jogos,
  eb.total_vitorias as vitorias,
  eb.total_derrotas as derrotas,
  eb.total_empates as empates,
  COALESCE(gpj.total_gols, 0) as gols
FROM estatisticas_base eb
LEFT JOIN gols_por_jogador gpj 
  ON gpj.sessao_id = eb.sessao_id 
  AND gpj.jogador_nome = eb.jogador_nome
ORDER BY eb.data_sessao, eb.jogador_nome;


-- =========================================
-- QUERY DE DEBUG: VERIFICAR GOLS NA TABELA
-- =========================================
-- Execute esta query para ver os gols registrados:

/*
SELECT 
  s.data as data_sessao,
  g.jogador_id as jogador_nome,
  COUNT(*) as total_gols
FROM gols g
JOIN jogos j ON j.id::text = g.jogo_id
JOIN sessoes s ON s.id = j.sessao_id
WHERE j.status = 'finalizado'
GROUP BY s.data, g.jogador_id
ORDER BY s.data, g.jogador_id;
*/


-- =========================================
-- VERSÃO RESUMIDA (TOTAL GERAL)
-- =========================================
-- Se quiser ver o total consolidado de cada jogador (soma das duas sessões):

/*
WITH jogadores_nos_jogos AS (
  SELECT 
    j.sessao_id,
    s.data as data_sessao,
    j.id as jogo_id,
    j.time_vencedor,
    jsonb_array_elements(j.time_a) as jogador_data,
    'A' as time
  FROM jogos j
  JOIN sessoes s ON s.id = j.sessao_id
  WHERE j.status = 'finalizado'
  
  UNION ALL
  
  SELECT 
    j.sessao_id,
    s.data as data_sessao,
    j.id as jogo_id,
    j.time_vencedor,
    jsonb_array_elements(j.time_b) as jogador_data,
    'B' as time
  FROM jogos j
  JOIN sessoes s ON s.id = j.sessao_id
  WHERE j.status = 'finalizado'
),
estatisticas_base AS (
  SELECT 
    jnj.jogador_data->>'id' as jogador_id,
    jnj.jogador_data->>'nome' as jogador_nome,
    COUNT(DISTINCT jnj.jogo_id) as total_jogos,
    SUM(CASE WHEN jnj.time_vencedor = jnj.time THEN 1 ELSE 0 END) as total_vitorias,
    SUM(CASE 
      WHEN jnj.time_vencedor IS NOT NULL 
        AND jnj.time_vencedor != 'empate' 
        AND jnj.time_vencedor != jnj.time 
      THEN 1 ELSE 0 
    END) as total_derrotas,
    SUM(CASE WHEN jnj.time_vencedor = 'empate' THEN 1 ELSE 0 END) as total_empates
  FROM jogadores_nos_jogos jnj
  GROUP BY jnj.jogador_data->>'id', jnj.jogador_data->>'nome'
),
gols_por_jogador AS (
  SELECT 
    g.jogador_id,
    COUNT(*) as total_gols
  FROM gols g
  JOIN jogos j ON j.id::text = g.jogo_id
  WHERE j.status = 'finalizado'
  GROUP BY g.jogador_id
)

SELECT 
  eb.jogador_id,
  eb.jogador_nome,
  eb.total_jogos as jogos,
  eb.total_vitorias as vitorias,
  eb.total_derrotas as derrotas,
  eb.total_empates as empates,
  COALESCE(gpj.total_gols, 0) as gols
FROM estatisticas_base eb
LEFT JOIN gols_por_jogador gpj ON gpj.jogador_id = eb.jogador_id
ORDER BY eb.jogador_nome;
*/


-- =========================================
-- VERSÃO COM FILTRO POR PELADA_ID
-- =========================================
-- Se precisar filtrar por uma pelada específica:

/*
WITH jogadores_nos_jogos AS (
  SELECT 
    j.sessao_id,
    s.data as data_sessao,
    s.pelada_id,
    j.id as jogo_id,
    j.time_vencedor,
    jsonb_array_elements(j.time_a) as jogador_data,
    'A' as time
  FROM jogos j
  JOIN sessoes s ON s.id = j.sessao_id
  WHERE j.status = 'finalizado'
    AND s.pelada_id = 'SEU_PELADA_ID_AQUI' -- Substituir pelo pelada_id correto
  
  UNION ALL
  
  SELECT 
    j.sessao_id,
    s.data as data_sessao,
    s.pelada_id,
    j.id as jogo_id,
    j.time_vencedor,
    jsonb_array_elements(j.time_b) as jogador_data,
    'B' as time
  FROM jogos j
  JOIN sessoes s ON s.id = j.sessao_id
  WHERE j.status = 'finalizado'
    AND s.pelada_id = 'SEU_PELADA_ID_AQUI' -- Substituir pelo pelada_id correto
),
estatisticas_base AS (
  SELECT 
    jnj.sessao_id,
    jnj.data_sessao,
    jnj.jogador_data->>'id' as jogador_id,
    jnj.jogador_data->>'nome' as jogador_nome,
    COUNT(DISTINCT jnj.jogo_id) as total_jogos,
    SUM(CASE WHEN jnj.time_vencedor = jnj.time THEN 1 ELSE 0 END) as total_vitorias,
    SUM(CASE 
      WHEN jnj.time_vencedor IS NOT NULL 
        AND jnj.time_vencedor != 'empate' 
        AND jnj.time_vencedor != jnj.time 
      THEN 1 ELSE 0 
    END) as total_derrotas,
    SUM(CASE WHEN jnj.time_vencedor = 'empate' THEN 1 ELSE 0 END) as total_empates
  FROM jogadores_nos_jogos jnj
  GROUP BY jnj.sessao_id, jnj.data_sessao, jnj.jogador_data->>'id', jnj.jogador_data->>'nome'
),
gols_por_jogador AS (
  SELECT 
    j.sessao_id,
    g.jogador_id,
    COUNT(*) as total_gols
  FROM gols g
  JOIN jogos j ON j.id::text = g.jogo_id
  JOIN sessoes s ON s.id = j.sessao_id
  WHERE j.status = 'finalizado'
    AND s.pelada_id = 'SEU_PELADA_ID_AQUI' -- Substituir pelo pelada_id correto
  GROUP BY j.sessao_id, g.jogador_id
)

SELECT 
  eb.data_sessao,
  eb.jogador_id,
  eb.jogador_nome,
  eb.total_jogos as jogos,
  eb.total_vitorias as vitorias,
  eb.total_derrotas as derrotas,
  eb.total_empates as empates,
  COALESCE(gpj.total_gols, 0) as gols
FROM estatisticas_base eb
LEFT JOIN gols_por_jogador gpj 
  ON gpj.sessao_id = eb.sessao_id 
  AND gpj.jogador_id = eb.jogador_id
ORDER BY eb.data_sessao, eb.jogador_nome;
*/
