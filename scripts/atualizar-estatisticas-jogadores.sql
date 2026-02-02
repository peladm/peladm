-- =========================================
-- ATUALIZAR ESTATÍSTICAS DOS JOGADORES
-- =========================================
-- Atualiza a tabela jogadores com as estatísticas calculadas
-- a partir das tabelas jogos e gols (soma de todas as sessões)
-- =========================================

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
  GROUP BY jnj.jogador_nome
),
gols_por_jogador AS (
  -- Conta os gols por jogador em todas as sessões
  SELECT 
    jog.nome as jogador_nome,
    COUNT(*) as total_gols
  FROM gols g
  JOIN jogos jo ON jo.id::text = g.jogo_id
  JOIN jogadores jog ON jog.id::text = g.jogador_id
  WHERE jo.status = 'finalizado'
  GROUP BY jog.nome
),
estatisticas_completas AS (
  -- Junta estatísticas de jogos e gols
  SELECT 
    eb.jogador_nome,
    eb.total_jogos,
    eb.total_vitorias,
    eb.total_derrotas,
    eb.total_empates,
    COALESCE(gpj.total_gols, 0) as total_gols
  FROM estatisticas_base eb
  LEFT JOIN gols_por_jogador gpj ON gpj.jogador_nome = eb.jogador_nome
)

-- UPDATE na tabela jogadores
UPDATE jogadores
SET 
  jogos = ec.total_jogos,
  vitorias = ec.total_vitorias,
  derrotas = ec.total_derrotas,
  empates = ec.total_empates,
  gols = ec.total_gols
FROM estatisticas_completas ec
WHERE jogadores.nome = ec.jogador_nome;


-- =========================================
-- VERIFICAR ATUALIZAÇÕES
-- =========================================
-- Execute esta query após o UPDATE para verificar os dados:

/*
SELECT 
  nome,
  jogos,
  vitorias,
  derrotas,
  empates,
  gols
FROM jogadores
WHERE jogos > 0
ORDER BY nome;
*/
