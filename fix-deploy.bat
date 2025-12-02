@echo off
echo 🔧 Corrigindo campo plan no pelada-login...
echo.

cd /d "C:\Users\Matheus\Documents\peladm"

echo 📝 Removendo último campo plan restante...
git add .

echo 💾 Fazendo commit da correção...
git commit -m "fix: remover campo plan do pelada-login e usar pelada_name"

echo 📤 Enviando para GitHub...
git push

echo.
echo ✅ Todas as páginas corrigidas! Campo plan removido completamente
echo 🔄 Deploy deve funcionar FINALMENTE agora
echo 🎯 Ultimo campo plan removido do pelada-login
echo.
pause