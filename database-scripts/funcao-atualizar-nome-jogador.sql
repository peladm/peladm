-- =========================================
-- FUNÇÃO RPC: atualizar_nome_jogador
-- =========================================
-- Atualiza nome do jogador em cascata em:
--   1. Tabela jogadores (nome)
--   2. Tabela jogos (time_a e time_b)
-- =========================================

DROP FUNCTION IF EXISTS public.atualizar_nome_jogador(varchar, text, varchar) CASCADE;

CREATE OR REPLACE FUNCTION public.atualizar_nome_jogador(
  p_nome_antigo varchar,
  p_pelada_id text,
  p_nome_novo varchar
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count_jogadores int := 0;
  v_count_time_a int := 0;
  v_count_time_b int := 0;
BEGIN
  -- 1. Contar e atualizar jogadores
  SELECT count(*) INTO v_count_jogadores
  FROM jogadores
  WHERE nome = p_nome_antigo AND pelada_id = p_pelada_id;

  UPDATE jogadores
  SET nome = p_nome_novo
  WHERE nome = p_nome_antigo AND pelada_id = p_pelada_id;

  -- 2. Atualizar time_a (array de strings)
  UPDATE jogos
  SET time_a = (
    SELECT jsonb_agg(
      CASE 
        WHEN elem::text = '"' || p_nome_antigo || '"' THEN to_jsonb(p_nome_novo)
        ELSE elem 
      END
    )
    FROM jsonb_array_elements(time_a) elem
  )
  WHERE sessao_id IN (
    SELECT id FROM sessoes WHERE pelada_id = p_pelada_id
  )
  AND time_a IS NOT NULL
  AND time_a::text LIKE '%' || p_nome_antigo || '%';

  GET DIAGNOSTICS v_count_time_a = ROW_COUNT;

  -- 3. Atualizar time_b (array de strings)
  UPDATE jogos
  SET time_b = (
    SELECT jsonb_agg(
      CASE 
        WHEN elem::text = '"' || p_nome_antigo || '"' THEN to_jsonb(p_nome_novo)
        ELSE elem 
      END
    )
    FROM jsonb_array_elements(time_b) elem
  )
  WHERE sessao_id IN (
    SELECT id FROM sessoes WHERE pelada_id = p_pelada_id
  )
  AND time_b IS NOT NULL
  AND time_b::text LIKE '%' || p_nome_antigo || '%';

  GET DIAGNOSTICS v_count_time_b = ROW_COUNT;

  RETURN json_build_object(
    'sucesso', true,
    'mensagem', 'Nome atualizado com sucesso em cascata',
    'nome_antigo', p_nome_antigo,
    'nome_novo', p_nome_novo,
    'jogadores_atualizados', v_count_jogadores,
    'jogos_time_a_atualizados', v_count_time_a,
    'jogos_time_b_atualizados', v_count_time_b
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'sucesso', false,
    'erro', SQLERRM,
    'mensagem_tech', 'Erro na função RPC'
  );
END;
$$;

-- =========================================
-- TESTE (copie e execute no Supabase)
-- =========================================
-- SELECT atualizar_nome_jogador('Matheus', 'JG9693', 'CR7');
-- SELECT atualizar_nome_jogador('Zezin', 'JG9693', 'Pelé');
