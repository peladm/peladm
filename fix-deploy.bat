@echo off
echo 🔧 Corrigindo campo plan no dashboard...
echo.

cd /d "C:\Users\Matheus\Documents\peladm"

echo 📝 Removendo campo plan e adicionando novos campos...
git add .

echo 💾 Fazendo commit da correção...
git commit -m "fix: remover campo plan e mostrar responsible_name e pelada_name no dashboard"

echo 📤 Enviando para GitHub...
git push

echo.
echo ✅ Dashboard corrigido! Campos atualizados
echo 🔄 Deploy deve funcionar agora
echo 👤 Mostra: responsible_name e pelada_name
echo.
pause