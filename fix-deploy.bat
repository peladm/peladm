@echo off
echo 🔧 Corrigindo tipos TypeScript...
echo.

cd /d "C:\Users\Matheus\Documents\peladm"

echo 📝 Adicionando tipos Supabase...
git add .

echo 💾 Fazendo commit da correção...
git commit -m "fix: adicionar tipos supabase.ts para resolver erro TypeScript"

echo 📤 Enviando para GitHub...
git push

echo.
echo ✅ Correção enviada! Tipos Supabase adicionados
echo 🔄 Deploy deve funcionar agora - aguarde o Vercel
echo 📋 Arquivo src/types/supabase.ts criado
echo.
pause