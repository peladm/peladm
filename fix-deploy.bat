@echo off
echo 🔧 Corrigindo erro Next.js 16 Turbopack...
echo.

cd /d "C:\Users\Matheus\Documents\peladm"

echo 📝 Removendo PWA temporariamente...
git add .

echo 💾 Fazendo commit da correção...
git commit -m "fix: remover PWA temporariamente para compatibilidade Turbopack"

echo 📤 Enviando para GitHub...
git push

echo.
echo ✅ Correção enviada! PWA removido temporariamente
echo 🔄 Deploy deve funcionar agora - aguarde o Vercel
echo 📱 PWA será reconfigurado após deploy funcionar
echo.
pause