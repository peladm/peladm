#!/bin/bash
echo "🚀 Configurando repositório Git para PeladM..."
echo

# Verificar se estamos na pasta correta
if [ ! -f "package.json" ]; then
    echo "❌ Execute este script na pasta raiz do projeto peladm"
    exit 1
fi

echo "✅ Pasta correta detectada"
echo

# Configurar nome e email se necessário
echo "🔧 Verificando configuração Git..."
git config user.name >/dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "📝 Configurando nome de usuário..."
    read -p "Digite seu nome: " username
    git config --global user.name "$username"
fi

git config user.email >/dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "📧 Configurando email..."
    read -p "Digite seu email: " email
    git config --global user.email "$email"
fi

# Inicializar Git
echo "📁 Inicializando repositório Git..."
git init
if [ $? -ne 0 ]; then
    echo "❌ Erro ao inicializar Git"
    exit 1
fi

# Adicionar arquivos
echo "📝 Adicionando arquivos..."
git add .
if [ $? -ne 0 ]; then
    echo "❌ Erro ao adicionar arquivos"
    exit 1
fi

# Fazer commit inicial
echo "💾 Fazendo commit inicial..."
git commit -m "Initial commit - Sistema PeladM multi-tenant"
if [ $? -ne 0 ]; then
    echo "❌ Erro no commit inicial"
    exit 1
fi

# Configurar branch principal
echo "🌿 Configurando branch main..."
git branch -M main 2>/dev/null || git checkout -b main
if [ $? -ne 0 ]; then
    echo "❌ Erro ao configurar branch"
    exit 1
fi

# Adicionar remote
echo "🔗 Conectando ao GitHub..."
git remote add origin https://github.com/peladm/peladm.git
if [ $? -ne 0 ]; then
    echo "⚠️  Remote já existe, removendo e adicionando novamente..."
    git remote remove origin
    git remote add origin https://github.com/peladm/peladm.git
fi

# Push para GitHub
echo "📤 Enviando para GitHub..."
echo "⚠️  Você pode precisar inserir suas credenciais GitHub..."
git push -u origin main
if [ $? -ne 0 ]; then
    echo "❌ Erro no push"
    echo "💡 Tente:"
    echo "   1. Verificar se você está logado no GitHub"
    echo "   2. Usar 'git push -u origin main --force' se necessário"
    echo "   3. Configurar token de acesso pessoal"
    exit 1
fi

echo
echo "✅ Sucesso! Repositório configurado e enviado para GitHub"
echo "🌐 Acesse: https://github.com/peladm/peladm"