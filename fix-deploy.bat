@echo off
echo 🔧 Desabilitando temporariamente AuthContext...
echo.

cd /d "C:\Users\Matheus\Documents\peladm"

echo 📝 Comentando código que usa tabela users...
git add .

echo 💾 Fazendo commit da correção...
git commit -m "fix: desabilitar temporariamente AuthContext que usa tabela users inexistente"

echo 📤 Enviando para GitHub...
git push

echo.
echo ✅ AuthContext desabilitado temporariamente! 
echo 🔄 Deploy deve funcionar FINALMENTE
echo 📋 Sistema focado apenas em multi-tenant por enquanto
echo.
pause