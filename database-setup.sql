-- ================================================
-- PELADM - Tabela de Clientes
-- ================================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Criar tabela clientes
CREATE TABLE clientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    supabase_url VARCHAR(500) NOT NULL,
    supabase_anon_key TEXT NOT NULL,
    responsible_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    pelada_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_clientes_email ON clientes(email);
CREATE INDEX idx_clientes_is_active ON clientes(is_active);
CREATE INDEX idx_clientes_responsible_name ON clientes(responsible_name);
CREATE INDEX idx_clientes_pelada_name ON clientes(pelada_name);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para atualizar updated_at
CREATE TRIGGER update_clientes_updated_at 
BEFORE UPDATE ON clientes 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comentário da tabela
COMMENT ON TABLE clientes IS 'Clientes multi-tenant com configurações Supabase e dados da pelada';