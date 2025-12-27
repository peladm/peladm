-- Corrigir constraint tipo_fila para aceitar os novos valores
-- (modo_partida e modo_prancheta)

ALTER TABLE regras 
DROP CONSTRAINT IF EXISTS tipo_fila_check;

ALTER TABLE regras 
ADD CONSTRAINT tipo_fila_check 
CHECK (tipo_fila IN ('fila1', 'fila2', 'modo_partida', 'modo_prancheta'));

-- Verificar se funcionou
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'tipo_fila_check';
