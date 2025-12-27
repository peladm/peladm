-- Adicionar coluna de plano na tabela clientes
ALTER TABLE clientes 
ADD COLUMN plano TEXT DEFAULT 'terrao' CHECK (plano IN ('terrao', 'varzea', 'profissional'));

-- Criar índice para consultas rápidas
CREATE INDEX idx_clientes_plano ON clientes(plano);

-- Comentário
COMMENT ON COLUMN clientes.plano IS 'Plano do cliente: terrao (free), varzea (gold), profissional (premium)';
