@echo off
echo 🔧 Adicionando tabela users aos tipos...
echo.

cd /d "C:\Users\Matheus\Documents\peladm"

echo 📝 Corrigindo tipos Supabase...
git add .

echo 💾 Fazendo commit da correção...
git commit -m "fix: adicionar tabela users aos tipos supabase para AuthContext"

echo 📤 Enviando para GitHub...
git push

echo.
echo ✅ Correção enviada! Tabela users adicionada aos tipos
echo 🔄 Deploy deve funcionar agora - aguarde o Vercel
echo 👤 AuthContext agora tem tipos corretos para users
echo.
pause