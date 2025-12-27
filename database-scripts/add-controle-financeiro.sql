-- Adicionar colunas de controle financeiro na tabela clientes
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS valor_plano DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS data_vencimento DATE;

-- Definir valores padrão baseado no plano
UPDATE clientes SET valor_plano = 0 WHERE plano = 'Free' AND valor_plano IS NULL;
UPDATE clientes SET valor_plano = 50 WHERE plano = 'Gold' AND valor_plano IS NULL;
UPDATE clientes SET valor_plano = 100 WHERE plano = 'Premium' AND valor_plano IS NULL;

SELECT '✅ Colunas de controle financeiro adicionadas com sucesso!' as mensagem;
