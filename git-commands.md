# Comandos Git passo a passo - Execute um por vez

## 1. Verificar se Git está configurado
```
git config --global user.name "Seu Nome"
git config --global user.email "seu-email@exemplo.com"
```

## 2. Inicializar repositório (se não foi feito)
```
git init
```

## 3. Adicionar arquivos
```
git add .
```

## 4. Fazer primeiro commit
```
git commit -m "Initial commit - Sistema PeladM multi-tenant"
```

## 5. Configurar branch principal
```
git branch -M main
```

## 6. Adicionar remote do GitHub
```
git remote add origin https://github.com/peladm/peladm.git
```

## 7. Fazer push inicial
```
git push -u origin main
```

## Se der erro de autenticação:

### Opção 1: Configurar token
1. Vá em GitHub → Settings → Developer settings → Personal access tokens
2. Crie um novo token com permissões de repo
3. Use o token como senha ao fazer push

### Opção 2: GitHub CLI
```
gh auth login
git push -u origin main
```

### Opção 3: Forçar push (cuidado!)
```
git push -u origin main --force
```

## Problemas comuns:

- **"not a git repository"**: Execute `git init` primeiro
- **"remote already exists"**: Execute `git remote remove origin` e tente novamente  
- **"authentication failed"**: Configure token de acesso ou use GitHub Desktop