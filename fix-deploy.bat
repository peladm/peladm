@echo off
echo 🔧 Corrigindo erro Turbopack...
echo.

cd /d "C:\Users\Matheus\Documents\peladm"

echo 📝 Adicionando correção...
git add .

echo 💾 Fazendo commit da correção...
git commit -m "Fix: Adiciona configuração Turbopack para Next.js 16"

echo 📤 Enviando para GitHub...
git push

echo.
echo ✅ Correção enviada! O Vercel vai fazer redeploy automaticamente
echo 🔄 Aguarde 2-3 minutos e verifique se o deploy funcionou
echo.
pause