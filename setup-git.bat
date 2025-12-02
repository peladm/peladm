@echo off
echo 🚀 Configurando repositório Git para PeladM...
echo.

REM Verificar se estamos na pasta correta
if not exist "package.json" (
    echo ❌ Execute este script na pasta raiz do projeto peladm
    pause
    exit /b 1
)

echo ✅ Pasta correta detectada
echo.

REM Inicializar Git
echo 📁 Inicializando repositório Git...
git init
if %ERRORLEVEL% neq 0 (
    echo ❌ Erro ao inicializar Git
    pause
    exit /b 1
)

REM Adicionar arquivos
echo 📝 Adicionando arquivos...
git add .
if %ERRORLEVEL% neq 0 (
    echo ❌ Erro ao adicionar arquivos
    pause
    exit /b 1
)

REM Fazer commit inicial
echo 💾 Fazendo commit inicial...
git commit -m "Initial commit - Sistema PeladM multi-tenant"
if %ERRORLEVEL% neq 0 (
    echo ❌ Erro no commit inicial
    pause
    exit /b 1
)

REM Configurar branch principal
echo 🌿 Configurando branch main...
git branch -M main
if %ERRORLEVEL% neq 0 (
    echo ❌ Erro ao configurar branch
    pause
    exit /b 1
)

REM Adicionar remote
echo 🔗 Conectando ao GitHub...
git remote add origin https://github.com/peladm/peladm.git
if %ERRORLEVEL% neq 0 (
    echo ❌ Erro ao adicionar remote
    pause
    exit /b 1
)

REM Push para GitHub
echo 📤 Enviando para GitHub...
git push -u origin main
if %ERRORLEVEL% neq 0 (
    echo ❌ Erro no push - verifique suas credenciais GitHub
    pause
    exit /b 1
)

echo.
echo ✅ Sucesso! Repositório configurado e enviado para GitHub
echo 🌐 Acesse: https://github.com/peladm/peladm
echo.
pause