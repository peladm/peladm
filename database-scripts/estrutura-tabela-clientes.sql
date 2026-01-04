-- ========================================
-- ESTRUTURA ATUAL DA TABELA CLIENTES
-- Data: 03/01/2026
-- ========================================

-- Estrutura completa da tabela clientes
-- Esta é a tabela principal que gerencia as peladas no sistema

/*
COLUNAS:
---------
pelada_id              TEXT (PK)                 NOT NULL   DEFAULT gen_random_uuid()
telefone               VARCHAR(255)              NOT NULL
nome                   VARCHAR(255)              NOT NULL
is_master              BOOLEAN                   NULL       DEFAULT false
plano                  TEXT                      NULL
supabase_url           TEXT                      NULL
supabase_anon_key      TEXT                      NULL
status                 TEXT                      NULL
email_supabase         TEXT                      NULL
senha_supabase         TEXT                      NULL
created_at             TIMESTAMP WITH TIME ZONE  NULL       DEFAULT now()
valor_plano            NUMERIC                   NULL       DEFAULT 0
data_vencimento        DATE                      NULL
username               VARCHAR(50)               NULL
senha                  VARCHAR(255)              NULL
last_access            TIMESTAMP WITH TIME ZONE  NULL
*/

-- Query para visualizar a estrutura:
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'clientes'
ORDER BY ordinal_position;

-- ========================================
-- OBSERVAÇÕES
-- ========================================
-- 1. A coluna 'id' foi renomeada para 'pelada_id'
-- 2. Colunas 'username' e 'senha' foram adicionadas para unificação com tabela usuarios
-- 3. A coluna 'last_access' rastreia o último acesso do cliente
-- 4. O plano pode ter diferentes valores (free, premium, etc)
