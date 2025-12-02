@echo off
echo 🔧 Corrigindo configuração Turbopack no arquivo correto...
echo.

cd /d "C:\Users\Matheus\Documents\peladm"

echo 📝 Adicionando correção final...
git add .

echo 💾 Fazendo commit da correção definitiva...
git commit -m "Fix: Adiciona turbo config no next.config.js correto"

echo 📤 Enviando para GitHub...
git push

echo.
echo ✅ Correção definitiva enviada!
echo 🔄 Agora o Vercel deve fazer deploy com sucesso
echo ⏱️ Aguarde 2-3 minutos
echo.
pause