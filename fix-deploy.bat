@echo off
echo 🔧 Corrigindo conflito de configuração Next.js...
echo.

cd /d "C:\Users\Matheus\Documents\peladm"

echo 📝 Removendo arquivo conflitante...
git rm next.config.ts
git add .

echo 💾 Fazendo commit da correção...
git commit -m "fix: remover next.config.ts conflitante, manter apenas next.config.js"

echo 📤 Enviando para GitHub...
git push

echo.
echo ✅ Correção enviada! Conflito de configuração resolvido
echo 🔄 Deploy deve funcionar agora - aguarde o Vercel
echo 📋 Apenas next.config.js será usado
echo.
pause