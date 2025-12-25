# ⚽ PelADM - Gerenciador de Peladas

Sistema completo para gerenciar peladas de futebol com gestão de jogadores, times, sorteios, rankings e muito mais!

## 🚀 Tecnologias

- **Next.js 16** - Framework React com App Router
- **TypeScript** - Tipagem estática
- **Tailwind CSS** - Estilização
- **Supabase** - Backend e banco de dados PostgreSQL
- **PWA** - Instalável em dispositivos móveis

## 📋 Funcionalidades

### 🎯 Sistema de Planos
- **FREE**: 25 jogadores, 10 partidas, com anúncios
- **GOLD**: 40 jogadores, 15 partidas, sem anúncios, Supabase compartilhado
- **PREMIUM**: Ilimitado, sem anúncios, Supabase dedicado, Modo Partida

### ⚽ Gerenciamento
- Cadastro e gestão de jogadores
- Sistema de fila com confirmação de presença
- Sorteio automático de times (7 algoritmos diferentes)
- Registro de partidas e gols
- Rankings automáticos
- Estatísticas completas
- Regras personalizadas de empate

### 👥 Multiusuário
- Sistema de usuários por pelada
- Perfis: Admin, Convidado, Visualizador
- Controle de permissões
- Acesso visitante (apenas visualização de resultados)

### 🎨 Interface
- Design moderno e responsivo
- Modo dark/light
- Animações suaves
- PWA instalável
- Funciona offline (cache)

## 📦 Instalação Local

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/peladm.git

# Entre na pasta
cd peladm

# Instale as dependências
npm install

# Configure as variáveis de ambiente
# Crie um arquivo .env.local com:
NEXT_PUBLIC_SUPABASE_URL=sua_url_aqui
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_aqui

# Execute o projeto
npm run dev
```

Acesse: http://localhost:3000

## 🌐 Deploy na Vercel

Consulte o arquivo [DEPLOY.md](DEPLOY.md) para instruções detalhadas de publicação.

## 📱 Instalação como PWA

### Android
1. Abra o site no Chrome
2. Menu (⋮) → "Adicionar à tela inicial"

### iOS
1. Abra no Safari
2. Compartilhar (⎵) → "Adicionar à Tela Inicial"

## 🗄️ Estrutura do Banco de Dados

- `clientes` - Peladas cadastradas
- `usuarios` - Usuários de cada pelada
- `jogadores` - Jogadores cadastrados
- `fila` - Fila de confirmação
- `jogos` - Partidas registradas
- `gols` - Gols marcados
- `sessoes` - Sessões de sorteio
- `regras` - Regras de desempate

## 🔐 Segurança

- Autenticação por Pelada ID + Usuário + Senha
- Proteção de rotas (AuthGuard)
- Controle de status (Ativo/Inativo/Bloqueado)
- Validações em todas as operações
- LastAccess tracking

## 📊 Status do Projeto

✅ **Versão 1.0** - Pronto para produção!

### Implementado
- Sistema completo de peladas
- Planos FREE, GOLD e PREMIUM
- PWA configurado
- Sistema de admin
- Dashboard de clientes
- Monitoramento de uso do Supabase

### Roadmap
- [ ] Sistema de notificações push
- [ ] Chat entre jogadores
- [ ] Integração com calendário
- [ ] Modo torneio
- [ ] Estatísticas avançadas com gráficos

## 👨‍💻 Desenvolvido por

**PelADM Team** - Sistema de gestão de peladas

## 📄 Licença

Todos os direitos reservados © 2025

---

**Contato:** WhatsApp (22) 98127-8226
