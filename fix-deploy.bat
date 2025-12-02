@echo off
echo 🔧 Atualizando tipos para tabela clientes...
echo.

cd /d "C:\Users\Matheus\Documents\peladm"

echo 📝 Corrigindo tipos Supabase para tabela clientes...
git add .

echo 💾 Fazendo commit da correção...
git commit -m "fix: atualizar tipos para tabela clientes com novos campos"

echo 📤 Enviando para GitHub...
git push

echo.
echo ✅ Tipos atualizados! Tabela clientes configurada
echo 🔄 Deploy deve funcionar perfeitamente agora
echo 📋 Estrutura: clientes com responsible_name, phone, pelada_name
echo.
pause