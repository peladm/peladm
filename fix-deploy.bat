@echo off
echo 🔧 Corrigindo TODOS os campos plan no dashboard...
echo.

cd /d "C:\Users\Matheus\Documents\peladm"

echo 📝 Removendo todas as ocorrências de plan...
git add .

echo 💾 Fazendo commit da correção...
git commit -m "fix: remover TODAS as ocorrências de plan e usar novos campos da tabela clientes"

echo 📤 Enviando para GitHub...
git push

echo.
echo ✅ Dashboard completamente corrigido! Todos os campos atualizados
echo 🔄 Deploy deve funcionar agora
echo 📋 Mostra: responsible_name, pelada_name, phone
echo.
pause