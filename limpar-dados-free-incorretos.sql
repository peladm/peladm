-- Script para limpar dados incorretos de planos Free que foram salvos no Supabase
-- Problema identificado: CR1570 e RC1954 (Free) estavam salvando no Supabase

-- 1. Identificar clientes Free que têm dados no Supabase (não deveriam ter)
SELECT 
    c.id as pelada_id,
    c.codigo_curto,
    c.plano,
    COUNT(j.id) as total_jogadores
FROM clientes c
LEFT JOIN jogadores j ON j.pelada_id = c.id
WHERE c.plano = 'Free' AND j.id IS NOT NULL
GROUP BY c.id, c.codigo_curto, c.plano;

-- 2. Ver jogadores com status incorretos (fila/reserva/jogando na tabela jogadores)
-- A tabela jogadores deve ter apenas: 'ativo' ou 'inativo'
SELECT 
    id, 
    nome, 
    status, 
    pelada_id
FROM jogadores
WHERE status NOT IN ('ativo', 'inativo');

-- 3. CORREÇÃO: Atualizar jogadores com status incorretos para 'ativo'
UPDATE jogadores
SET status = 'ativo'
WHERE status IN ('fila', 'reserva', 'jogando');

-- 4. LIMPEZA: Excluir jogadores de clientes Free do Supabase
-- (eles devem estar APENAS no localStorage)

-- 4.1 Primeiro, excluir registros relacionados na tabela fila
DELETE FROM fila
WHERE pelada_id IN (
    SELECT id FROM clientes WHERE plano = 'Free'
);

-- 4.2 Depois, excluir os jogadores
DELETE FROM jogadores
WHERE pelada_id IN (
    SELECT id FROM clientes WHERE plano = 'Free'
);

-- 5. VERIFICAÇÃO FINAL: Confirmar que não há mais jogadores Free no Supabase
SELECT 
    c.id as pelada_id,
    c.codigo_curto,
    c.plano,
    COUNT(j.id) as total_jogadores
FROM clientes c
LEFT JOIN jogadores j ON j.pelada_id = c.id
WHERE c.plano = 'Free'
GROUP BY c.id, c.codigo_curto, c.plano;

-- Resultado esperado: 0 jogadores para todos os clientes Free
