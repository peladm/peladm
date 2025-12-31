-- ========================================
-- CORREÇÃO FINAL: Status da Tabela Jogadores
-- ========================================
-- PROBLEMA: Tabela jogadores tinha valores 'fila', 'reserva', 'jogando'
-- SOLUÇÃO: Converter todos para 'ativo' (já que estão participando)
--
-- REGRA: 
-- - Tabela JOGADORES: apenas 'ativo' ou 'inativo'
-- - Tabela FILA: 'fila', 'reserva', 'jogando'
-- ========================================

-- 1. Verificar status incorretos ANTES da correção
SELECT 
    'ANTES DA CORREÇÃO' as momento,
    status,
    COUNT(*) as total
FROM jogadores
WHERE status NOT IN ('ativo', 'inativo')
GROUP BY status
ORDER BY total DESC;

-- 2. Corrigir todos os status incorretos para 'ativo'
-- (assumindo que jogadores com status fila/reserva/jogando estão ativos)
UPDATE jogadores
SET 
    status = 'ativo',
    updated_at = NOW()
WHERE status NOT IN ('ativo', 'inativo');

-- 3. Verificar resultado APÓS a correção
SELECT 
    'APÓS CORREÇÃO' as momento,
    status,
    COUNT(*) as total
FROM jogadores
GROUP BY status
ORDER BY total DESC;

-- 4. Garantir que a constraint está correta
ALTER TABLE jogadores
DROP CONSTRAINT IF EXISTS jogadores_status_check;

ALTER TABLE jogadores
ADD CONSTRAINT jogadores_status_check 
CHECK (status IN ('ativo', 'inativo'));

-- 5. Verificação final: buscar qualquer status inválido (não deve retornar nada)
SELECT 
    id,
    nome,
    status,
    pelada_id
FROM jogadores
WHERE status NOT IN ('ativo', 'inativo')
LIMIT 10;

-- 6. Estatísticas finais
SELECT 
    '✅ CORREÇÃO CONCLUÍDA' as mensagem,
    COUNT(*) as total_jogadores,
    SUM(CASE WHEN status = 'ativo' THEN 1 ELSE 0 END) as ativos,
    SUM(CASE WHEN status = 'inativo' THEN 1 ELSE 0 END) as inativos
FROM jogadores;
