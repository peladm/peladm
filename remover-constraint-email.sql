-- 1. Remover constraint de email único (se existir)
ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_email_key;

-- 2. Remover coluna email (se existir)
ALTER TABLE clientes DROP COLUMN IF EXISTS email;

-- 3. Verificar estrutura final
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'clientes' 
ORDER BY ordinal_position;
