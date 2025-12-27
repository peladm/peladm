-- Criar foreign key entre tabela fila e jogadores
-- Este script adiciona a relação que está faltando

-- Primeiro, verificar se a constraint já existe
SELECT constraint_name, table_name, column_name, foreign_table_name, foreign_column_name
FROM information_schema.key_column_usage 
WHERE table_name = 'fila' AND column_name = 'jogador_id';

-- Se não existir, criar a foreign key
ALTER TABLE fila 
ADD CONSTRAINT fk_fila_jogador 
FOREIGN KEY (jogador_id) 
REFERENCES jogadores(id) 
ON DELETE CASCADE;

-- Também verificar se existe constraint para sessao_id
ALTER TABLE fila 
ADD CONSTRAINT fk_fila_sessao 
FOREIGN KEY (sessao_id) 
REFERENCES sessoes(id) 
ON DELETE CASCADE;

-- Verificar as constraints criadas
SELECT constraint_name, table_name, column_name 
FROM information_schema.key_column_usage 
WHERE table_name = 'fila';