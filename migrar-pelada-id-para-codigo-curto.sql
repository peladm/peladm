-- ============================================
-- MIGRAÇÃO DE PELADA_ID PARA CÓDIGO CURTO
-- ============================================
-- Este script migra o pelada_id antigo (UUID) para novo formato (6 caracteres: AB1234)
-- IMPORTANTE: Execute este script com MUITO CUIDADO!
-- ============================================

-- PASSO 1: Definir os IDs
-- Substitua 'SEU_UUID_ATUAL' pelo seu pelada_id atual (UUID longo)
-- Substitua 'AB1234' pelo novo código de 6 caracteres que você quer usar

DO $$
DECLARE
    pelada_id_antigo TEXT := 'd2c29bdc-7d34-4a95-a2f3-07444ceb480b';  -- UUID atual do Matheus
    pelada_id_novo TEXT := 'MT2307';            -- Código escolhido: MT2307
BEGIN
    -- Verificar se o novo código já existe
    IF EXISTS (SELECT 1 FROM clientes WHERE id::TEXT = pelada_id_novo) THEN
        RAISE EXCEPTION 'Código % já existe! Escolha outro código.', pelada_id_novo;
    END IF;

    -- Verificar se o UUID antigo existe
    IF NOT EXISTS (SELECT 1 FROM clientes WHERE id::TEXT = pelada_id_antigo) THEN
        RAISE EXCEPTION 'UUID antigo % não encontrado!', pelada_id_antigo;
    END IF;

    RAISE NOTICE '🔄 Iniciando migração de % para %', pelada_id_antigo, pelada_id_novo;

    -- PASSO 2: Alterar tipo da coluna id de UUID para TEXT
    -- Primeiro remover a constraint de chave primária
    ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_pkey CASCADE;
    
    -- Alterar tipo da coluna
    ALTER TABLE clientes ALTER COLUMN id TYPE TEXT USING id::TEXT;
    
    -- Recriar chave primária
    ALTER TABLE clientes ADD PRIMARY KEY (id);
    
    RAISE NOTICE '✅ Coluna id convertida de UUID para TEXT';

    -- PASSO 3: Atualizar tabelas relacionadas (FK primeiro, PK depois)
    
    -- Tabela: usuarios
    BEGIN
        ALTER TABLE usuarios ALTER COLUMN pelada_id TYPE TEXT USING pelada_id::TEXT;
        UPDATE usuarios 
        SET pelada_id = pelada_id_novo 
        WHERE pelada_id = pelada_id_antigo;
        RAISE NOTICE '✅ Atualizado tabela usuarios';
    EXCEPTION
        WHEN undefined_column THEN
            RAISE NOTICE '⚠️ Coluna pelada_id não existe em usuarios, pulando...';
        WHEN undefined_table THEN
            RAISE NOTICE '⚠️ Tabela usuarios não existe, pulando...';
    END;

    -- Tabela: jogadores
    BEGIN
        ALTER TABLE jogadores ALTER COLUMN pelada_id TYPE TEXT USING pelada_id::TEXT;
        UPDATE jogadores 
        SET pelada_id = pelada_id_novo 
        WHERE pelada_id = pelada_id_antigo;
        RAISE NOTICE '✅ Atualizado tabela jogadores';
    EXCEPTION
        WHEN undefined_column THEN
            RAISE NOTICE '⚠️ Coluna pelada_id não existe em jogadores, pulando...';
        WHEN undefined_table THEN
            RAISE NOTICE '⚠️ Tabela jogadores não existe, pulando...';
    END;

    -- Tabela: sessoes
    BEGIN
        ALTER TABLE sessoes ALTER COLUMN pelada_id TYPE TEXT USING pelada_id::TEXT;
        UPDATE sessoes 
        SET pelada_id = pelada_id_novo 
        WHERE pelada_id = pelada_id_antigo;
        RAISE NOTICE '✅ Atualizado tabela sessoes';
    EXCEPTION
        WHEN undefined_column THEN
            RAISE NOTICE '⚠️ Coluna pelada_id não existe em sessoes, pulando...';
        WHEN undefined_table THEN
            RAISE NOTICE '⚠️ Tabela sessoes não existe, pulando...';
    END;

    -- Tabela: jogos
    BEGIN
        ALTER TABLE jogos ALTER COLUMN pelada_id TYPE TEXT USING pelada_id::TEXT;
        UPDATE jogos 
        SET pelada_id = pelada_id_novo 
        WHERE pelada_id = pelada_id_antigo;
        RAISE NOTICE '✅ Atualizado tabela jogos';
    EXCEPTION
        WHEN undefined_column THEN
            RAISE NOTICE '⚠️ Coluna pelada_id não existe em jogos, pulando...';
        WHEN undefined_table THEN
            RAISE NOTICE '⚠️ Tabela jogos não existe, pulando...';
    END;

    -- Tabela: gols
    BEGIN
        ALTER TABLE gols ALTER COLUMN pelada_id TYPE TEXT USING pelada_id::TEXT;
        UPDATE gols 
        SET pelada_id = pelada_id_novo 
        WHERE pelada_id = pelada_id_antigo;
        RAISE NOTICE '✅ Atualizado tabela gols';
    EXCEPTION
        WHEN undefined_column THEN
            RAISE NOTICE '⚠️ Coluna pelada_id não existe em gols, pulando...';
        WHEN undefined_table THEN
            RAISE NOTICE '⚠️ Tabela gols não existe, pulando...';
    END;

    -- Tabela: fila
    BEGIN
        ALTER TABLE fila ALTER COLUMN pelada_id TYPE TEXT USING pelada_id::TEXT;
        UPDATE fila 
        SET pelada_id = pelada_id_novo 
        WHERE pelada_id = pelada_id_antigo;
        RAISE NOTICE '✅ Atualizado tabela fila';
    EXCEPTION
        WHEN undefined_column THEN
            RAISE NOTICE '⚠️ Coluna pelada_id não existe em fila, pulando...';
        WHEN undefined_table THEN
            RAISE NOTICE '⚠️ Tabela fila não existe, pulando...';
    END;

    -- Tabela: fila_snapshot (se existir)
    BEGIN
        ALTER TABLE fila_snapshot ALTER COLUMN pelada_id TYPE TEXT USING pelada_id::TEXT;
        UPDATE fila_snapshot 
        SET pelada_id = pelada_id_novo 
        WHERE pelada_id = pelada_id_antigo;
        RAISE NOTICE '✅ Atualizado tabela fila_snapshot';
    EXCEPTION
        WHEN undefined_column THEN
            RAISE NOTICE '⚠️ Coluna pelada_id não existe em fila_snapshot, pulando...';
        WHEN undefined_table THEN
            RAISE NOTICE '⚠️ Tabela fila_snapshot não existe, pulando...';
    END;

    -- Tabela: regras
    BEGIN
        ALTER TABLE regras ALTER COLUMN pelada_id TYPE TEXT USING pelada_id::TEXT;
        UPDATE regras 
        SET pelada_id = pelada_id_novo 
        WHERE pelada_id = pelada_id_antigo;
        RAISE NOTICE '✅ Atualizado tabela regras';
    EXCEPTION
        WHEN undefined_column THEN
            RAISE NOTICE '⚠️ Coluna pelada_id não existe em regras, pulando...';
        WHEN undefined_table THEN
            RAISE NOTICE '⚠️ Tabela regras não existe, pulando...';
    END;

    -- PASSO 4: Atualizar a chave primária em clientes
    UPDATE clientes 
    SET id = pelada_id_novo 
    WHERE id = pelada_id_antigo;
    RAISE NOTICE '✅ Atualizado tabela clientes (chave primária)';

    RAISE NOTICE '🎉 Migração concluída com sucesso!';
    RAISE NOTICE '📋 Novo pelada_id: %', pelada_id_novo;

END $$;

-- ============================================
-- VERIFICAÇÃO PÓS-MIGRAÇÃO
-- ============================================
-- Execute estas queries para verificar se tudo foi migrado corretamente

-- Ver o novo cliente
SELECT id, nome, email, plano, status 
FROM clientes 
WHERE id = 'MT2307';

-- Contar registros com novo pelada_id (apenas tabelas que têm essa coluna)
DO $$
BEGIN
    -- Verificar cada tabela individualmente
    BEGIN
        RAISE NOTICE 'usuarios: %', (SELECT COUNT(*) FROM usuarios WHERE pelada_id = 'MT2307');
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'usuarios: tabela ou coluna não existe';
    END;
    
    BEGIN
        RAISE NOTICE 'jogadores: %', (SELECT COUNT(*) FROM jogadores WHERE pelada_id = 'MT2307');
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'jogadores: tabela ou coluna não existe';
    END;
    
    BEGIN
        RAISE NOTICE 'sessoes: %', (SELECT COUNT(*) FROM sessoes WHERE pelada_id = 'MT2307');
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'sessoes: tabela ou coluna não existe';
    END;
    
    BEGIN
        RAISE NOTICE 'jogos: %', (SELECT COUNT(*) FROM jogos WHERE pelada_id = 'MT2307');
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'jogos: tabela ou coluna não existe';
    END;
    
    BEGIN
        RAISE NOTICE 'gols: %', (SELECT COUNT(*) FROM gols WHERE pelada_id = 'MT2307');
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'gols: tabela ou coluna não existe';
    END;
    
    BEGIN
        RAISE NOTICE 'fila: %', (SELECT COUNT(*) FROM fila WHERE pelada_id = 'MT2307');
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'fila: tabela ou coluna não existe';
    END;
    
    BEGIN
        RAISE NOTICE 'regras: %', (SELECT COUNT(*) FROM regras WHERE pelada_id = 'MT2307');
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'regras: tabela ou coluna não existe';
    END;
END $$;

-- Verificar se UUID antigo ainda existe (deve retornar 0)
SELECT COUNT(*) as "UUID antigo ainda existe?" 
FROM clientes 
WHERE id = 'd2c29bdc-7d34-4a95-a2f3-07444ceb480b';

-- ============================================
-- ROLLBACK (CASO ALGO DÊ ERRADO)
-- ============================================
-- Se precisar reverter, execute o script inverso:
/*
DO $$
DECLARE
    pelada_id_antigo TEXT := 'd2c29bdc-7d34-4a95-a2f3-07444ceb480b';
    pelada_id_novo TEXT := 'MT2307';
BEGIN
    UPDATE usuarios SET pelada_id = pelada_id_antigo WHERE pelada_id = pelada_id_novo;
    UPDATE jogadores SET pelada_id = pelada_id_antigo WHERE pelada_id = pelada_id_novo;
    UPDATE sessoes SET pelada_id = pelada_id_antigo WHERE pelada_id = pelada_id_novo;
    UPDATE jogos SET pelada_id = pelada_id_antigo WHERE pelada_id = pelada_id_novo;
    UPDATE gols SET pelada_id = pelada_id_antigo WHERE pelada_id = pelada_id_novo;
    UPDATE fila SET pelada_id = pelada_id_antigo WHERE pelada_id = pelada_id_novo;
    UPDATE fila_snapshot SET pelada_id = pelada_id_antigo WHERE pelada_id = pelada_id_novo;
    UPDATE regras SET pelada_id = pelada_id_antigo WHERE pelada_id = pelada_id_novo;
    UPDATE clientes SET id = pelada_id_antigo WHERE id = pelada_id_novo;
    RAISE NOTICE '↩️ Rollback concluído!';
END $$;
*/
