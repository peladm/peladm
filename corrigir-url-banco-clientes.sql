-- Corrigir URL do banco na tabela clientes
-- Substituir URL errada pela URL correta do banco compartilhado

UPDATE clientes 
SET 
  supabase_url = 'https://ewcswczqvelhlwpbraea.supabase.co',
  supabase_anon_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Y3N3Y3pxdmVsaGx3cGJyYWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2Mzc1MzksImV4cCI6MjA4MDIxMzUzOX0.DRzgAuj171lUG_7wMVCFhuDH71sGxlHHEB28qBN9wks'
WHERE id = 'MT2307';

-- Verificar se foi atualizado
SELECT id, nome, supabase_url FROM clientes WHERE id = 'MT2307';
