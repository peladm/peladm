@echo off
echo 🚀 Enviando PeladM para GitHub...
echo.

REM Navegar para a pasta do projeto
cd /d "C:\Users\Matheus\Documents\peladm"

REM Verificar se estamos na pasta correta
if not exist "package.json" (
    echo ❌ Pasta do projeto não encontrada
    pause
    exit /b 1
)

echo ✅ Pasta do projeto encontrada
echo.

REM Configurar Git (substitua pelos seus dados)
echo 🔧 Configurando Git...
git config --global user.name "Matheus"
git config --global user.email "seu-email@gmail.com"

REM Inicializar repositório
echo 📁 Inicializando repositório...
git init

REM Adicionar arquivos
echo 📝 Adicionando todos os arquivos...
git add .

REM Commit inicial
echo 💾 Fazendo commit inicial...
git commit -m "Initial commit - Sistema PeladM multi-tenant"

REM Configurar branch principal
echo 🌿 Configurando branch main...
git branch -M main

REM Adicionar remote do GitHub
echo 🔗 Conectando ao GitHub...
git remote add origin https://github.com/peladm/peladm.git

REM Push para GitHub
echo 📤 Enviando para GitHub...
echo ⚠️  Você precisará inserir suas credenciais do GitHub
git push -u origin main

echo.
if %ERRORLEVEL% equ 0 (
    echo ✅ Sucesso! Projeto enviado para GitHub
    echo 🌐 Acesse: https://github.com/peladm/peladm
) else (
    echo ❌ Erro no envio - verifique suas credenciais
    echo 💡 Certifique-se de usar seu token GitHub como senha
)

echo.
pause