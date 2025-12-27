-- ============================================
-- VERIFICAR E CORRIGIR REGRAS
-- ============================================

-- 1. VERIFICAR VALORES ATUAIS
SELECT 
  pelada_id,
  vitorias_consecutivas,
  prioridade_retorno,
  regra_empate,
  empate_conta_vitoria
FROM regras
ORDER BY created_at DESC;

-- 2. SE prioridade_retorno estiver como 'vencedor_antes', corrigir para 'perdedor_continua'
-- (Execute apenas se necessário)
UPDATE regras 
SET prioridade_retorno = 'perdedor_continua'
WHERE prioridade_retorno = 'vencedor_antes';

-- 3. VERIFICAR APÓS CORREÇÃO
SELECT 
  pelada_id,
  vitorias_consecutivas,
  prioridade_retorno,
  regra_empate,
  empate_conta_vitoria
FROM regras
ORDER BY created_at DESC;
