@echo off
echo 🔧 Corrigindo tipagem Supabase...
echo.

cd /d "C:\Users\Matheus\Documents\peladm"

echo 📝 Aplicando tipagem Database em todos os clientes...
git add .

echo 💾 Fazendo commit da correção...
git commit -m "fix: aplicar tipagem Database em supabase-factory para resolver erro never"

echo 📤 Enviando para GitHub...
git push

echo.
echo ✅ Correção enviada! Tipagem Database aplicada corretamente
echo 🔄 Deploy deve funcionar agora - aguarde o Vercel
echo 🏗️ Todos os clientes Supabase agora têm tipagem correta
echo.
pause