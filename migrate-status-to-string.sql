-- Migração para converter campo status de boolean para string
-- Passo 1: Adicionar nova coluna temporária
ALTER TABLE clientes ADD COLUMN status_temp TEXT;

-- Passo 2: Converter os dados
UPDATE clientes 
SET status_temp = CASE 
    WHEN status = true THEN 'ativo'
    WHEN status = false THEN 'inativo'
    ELSE 'inativo'
END;

-- Passo 3: Remover coluna antiga
ALTER TABLE clientes DROP COLUMN status;

-- Passo 4: Renomear nova coluna
ALTER TABLE clientes RENAME COLUMN status_temp TO status;

-- Passo 5: Adicionar constraint para garantir apenas valores válidos
ALTER TABLE clientes ADD CONSTRAINT check_status_values 
CHECK (status IN ('ativo', 'inativo', 'bloqueado'));