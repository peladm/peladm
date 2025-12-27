-- Criação da tabela de usuários para gerenciamento de acesso
-- Baseada no modelo do Pelada 3

CREATE TABLE usuarios (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    senha VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'organizer')),
    pelada_id BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT usuarios_username_pelada_unique UNIQUE (username, pelada_id),
    CONSTRAINT usuarios_pelada_id_fkey FOREIGN KEY (pelada_id) REFERENCES clientes(id) ON DELETE CASCADE
);

-- Index para melhorar performance de consultas por pelada_id
CREATE INDEX idx_usuarios_pelada_id ON usuarios(pelada_id);

-- Index para melhorar performance de consultas por username
CREATE INDEX idx_usuarios_username ON usuarios(username);

-- Comentários para documentação
COMMENT ON TABLE usuarios IS 'Tabela para gerenciar usuários com diferentes níveis de acesso';
COMMENT ON COLUMN usuarios.username IS 'Nome de usuário único por pelada';
COMMENT ON COLUMN usuarios.senha IS 'Senha do usuário (texto plano para compatibilidade)';
COMMENT ON COLUMN usuarios.role IS 'Tipo de usuário: admin ou organizer';
COMMENT ON COLUMN usuarios.pelada_id IS 'ID da pelada a qual o usuário pertence';