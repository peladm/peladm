-- =====================================================
-- ADICIONAR CONTROLE DE SESSÃO NA TABELA USUARIOS
-- Execute este script no BANCO PRINCIPAL (não no dedicado)
-- =====================================================

-- Adicionar colunas de controle de sessão
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS session_token TEXT,
ADD COLUMN IF NOT EXISTS session_created_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_device TEXT;

-- Índice para busca rápida por token
CREATE INDEX IF NOT EXISTS idx_usuarios_session_token ON usuarios(session_token);

-- Comentários nas colunas
COMMENT ON COLUMN usuarios.session_token IS 'Token único da sessão ativa do usuário';
COMMENT ON COLUMN usuarios.session_created_at IS 'Timestamp de quando a sessão foi criada';
COMMENT ON COLUMN usuarios.last_device IS 'Informações do dispositivo (user agent)';

-- =====================================================
-- MENSAGEM FINAL
-- =====================================================
SELECT '✅ Colunas de controle de sessão adicionadas na tabela usuarios!' as mensagem;
