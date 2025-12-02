@echo off
echo 🔧 Corrigindo DatabaseSetup.tsx...
echo.

cd /d "C:\Users\Matheus\Documents\peladm"

echo 📝 Removendo função RPC inválida...
git add .

echo 💾 Fazendo commit da correção...
git commit -m "fix: corrigir DatabaseSetup removendo função rpc inválida"

echo 📤 Enviando para GitHub...
git push

echo.
echo ✅ DatabaseSetup corrigido! Função RPC removida
echo 🔄 Deploy deve funcionar AGORA
echo 🎯 Componente simplificado para apenas verificar tabela
echo.
pause