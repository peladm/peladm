-- ============================================
-- ADICIONAR NOVAS REGRAS AO SISTEMA
-- ============================================
-- Data: 13/12/2025
-- Alterações:
-- 1. Adicionar coluna tipo_fila
-- 2. Adicionar opção 'perdedor_continua' em prioridade_retorno
-- 3. Adicionar coluna empate_conta_vitoria
-- ============================================

-- 1. ADICIONAR COLUNA TIPO_FILA
ALTER TABLE regras ADD COLUMN IF NOT EXISTS tipo_fila TEXT DEFAULT 'fila2';

-- Comentário explicativo
COMMENT ON COLUMN regras.tipo_fila IS 'Tipo de fila: fila1 (premium exclusivo) ou fila2 (todos os planos)';

-- Atualizar registros existentes para fila2 (padrão)
UPDATE regras 
SET tipo_fila = 'fila2' 
WHERE tipo_fila IS NULL OR tipo_fila = '';

-- Constraint para aceitar apenas valores válidos
ALTER TABLE regras 
DROP CONSTRAINT IF EXISTS tipo_fila_check;

ALTER TABLE regras 
ADD CONSTRAINT tipo_fila_check 
CHECK (tipo_fila IN ('fila1', 'fila2'));


-- 2. ADICIONAR COLUNA EMPATE_CONTA_VITORIA
ALTER TABLE regras ADD COLUMN IF NOT EXISTS empate_conta_vitoria BOOLEAN DEFAULT false;

-- Comentário explicativo
COMMENT ON COLUMN regras.empate_conta_vitoria IS 'Se TRUE, empate (resolvido por desempate) conta como vitória consecutiva. Só se aplica quando regra_empate = desempate e vitorias_consecutivas > 0';

-- Atualizar registros existentes para false (padrão)
UPDATE regras 
SET empate_conta_vitoria = false 
WHERE empate_conta_vitoria IS NULL;


-- 3. ATUALIZAR CONSTRAINT DE PRIORIDADE_RETORNO
-- (adicionar opção 'perdedor_continua')
ALTER TABLE regras 
DROP CONSTRAINT IF EXISTS prioridade_retorno_check;

ALTER TABLE regras 
ADD CONSTRAINT prioridade_retorno_check 
CHECK (prioridade_retorno IN ('prioridade', 'sem_prioridade', 'mesclar', 'perdedor_continua'));


-- ============================================
-- REGRAS DE NEGÓCIO IMPLEMENTADAS:
-- ============================================
--
-- 1. TIPO_FILA:
--    - 'fila2' (padrão): Fila Padrão - disponível para todos os planos
--    - 'fila1': Fila Premium - exclusivo para plano premium
--    - Redirecionamento automático implementado nas páginas /fila e /fila2
--
-- 2. PRIORIDADE_RETORNO (após vitórias consecutivas):
--    - 'prioridade': VENCEDOR retorna antes na fila
--    - 'sem_prioridade': PERDEDOR retorna antes na fila
--    - 'mesclar': MESCLAR times no retorno
--    - 'perdedor_continua': PERDEDOR continua jogando (NOVO)
--
-- 3. EMPATE_CONTA_VITORIA:
--    - true: Empate conta como vitória para contador consecutivo
--    - false: Empate não conta como vitória
--    - Só relevante quando:
--      * regra_empate = 'desempate'
--      * vitorias_consecutivas > 0
-- ============================================

-- Verificar resultado
SELECT 
    pelada_id,
    tipo_fila,
    jogadores_por_time,
    modelo_sorteio,
    vitorias_consecutivas,
    prioridade_retorno,
    regra_empate,
    regra_apos_empate,
    empate_conta_vitoria
FROM regras
LIMIT 10;
