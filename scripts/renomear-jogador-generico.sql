-- =========================================
-- SCRIPT GENÉRICO: Renomear Jogador
-- =========================================
-- Use este template para renomear qualquer jogador
-- Basta substituir NOME_ANTIGO e NOME_NOVO nas linhas 14 e 15
-- =========================================

DO $$
DECLARE
  -- CONFIGURAÇÃO: ALTERE ESTAS DUAS LINHAS
  nome_antigo TEXT := 'Leonardo';
  nome_novo TEXT := 'Leonardo Vieira';
  -- Fim da configuração
  
  registros_atualizados INTEGER := 0;
BEGIN
  -- Atualizar time_a
  UPDATE jogos
  SET time_a = (
    SELECT jsonb_agg(
      CASE 
        WHEN elem::text = to_jsonb(nome_antigo)::text 
        THEN to_jsonb(nome_novo)
        ELSE elem
      END
    )
    FROM jsonb_array_elements(time_a) elem
  )
  WHERE time_a @> to_jsonb(nome_antigo);
  
  GET DIAGNOSTICS registros_atualizados = ROW_COUNT;
  RAISE NOTICE '✅ Time A: % jogos atualizados', registros_atualizados;

  -- Atualizar time_b
  UPDATE jogos
  SET time_b = (
    SELECT jsonb_agg(
      CASE 
        WHEN elem::text = to_jsonb(nome_antigo)::text 
        THEN to_jsonb(nome_novo)
        ELSE elem
      END
    )
    FROM jsonb_array_elements(time_b) elem
  )
  WHERE time_b @> to_jsonb(nome_antigo);
  
  GET DIAGNOSTICS registros_atualizados = ROW_COUNT;
  RAISE NOTICE '✅ Time B: % jogos atualizados', registros_atualizados;
  
  -- Contar total de jogos com o novo nome
  SELECT COUNT(*) INTO registros_atualizados
  FROM jogos
  WHERE time_a @> to_jsonb(nome_novo) 
     OR time_b @> to_jsonb(nome_novo);
  
  RAISE NOTICE '📊 Total de jogos com "%" agora: %', nome_novo, registros_atualizados;
END $$;

-- Verificar resultado (últimos 10 jogos com o novo nome)
-- IMPORTANTE: Troque "Leonardo Vieira" pelo nome_novo que você configurou
SELECT 
  numero_jogo,
  time_a,
  time_b,
  placar_a || 'x' || placar_b as placar,
  TO_CHAR(created_at, 'DD/MM/YYYY HH24:MI') as data
FROM jogos
WHERE time_a @> to_jsonb('Leonardo Vieira')
   OR time_b @> to_jsonb('Leonardo Vieira')
ORDER BY created_at DESC
LIMIT 10;
