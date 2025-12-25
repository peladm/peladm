-- Verificar estrutura da tabela clientes e coluna plano
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable,
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'clientes' AND column_name = 'plano';

-- Ver valores atuais da coluna plano
SELECT id, nome, email, plano 
FROM clientes 
LIMIT 10;

-- Ver tipos de planos distintos em uso
SELECT plano, COUNT(*) as total
FROM clientes
GROUP BY plano;
