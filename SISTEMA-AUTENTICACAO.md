# Sistema de Autenticação - PelADM

## 📋 Visão Geral

Sistema completo de autenticação implementado com proteção de rotas, cadastro público para plano FREE e cadastro manual para planos Gold/Premium.

## 🔐 Funcionamento

### Rotas Públicas (Sem Autenticação)
- `/login` - Página de login
- `/cadastro-free` - Cadastro público para plano FREE

### Rotas Protegidas (Requer Login)
Todas as outras rotas do aplicativo requerem autenticação. Se um usuário não logado tentar acessar uma rota protegida, será redirecionado automaticamente para `/login`.

## 🎯 Tipos de Cadastro

### 1. Cadastro FREE (Automático - Público)
**Rota:** `/cadastro-free`

**Campos:**
- Nome da Pelada (obrigatório)
- E-mail (obrigatório, validado para unicidade)
- Telefone (opcional)

**Dados Gerados Automaticamente:**
- **Pelada ID:** Formato `MT` + 4 dígitos aleatórios (ex: MT1234)
- **Senha:** 4 dígitos aleatórios (ex: 1234)
- **Usuário:** Sempre "admin" (padrão)
- **Plano:** "Free"

**Limites FREE:**
- ✅ 25 jogadores
- ✅ 10 partidas
- ✅ 1 usuário (admin)
- ✅ Gestão de fila e sorteio
- ❌ Modo Partida (Premium exclusivo)
- ❌ Estatísticas completas
- ⚠️ Exibe anúncios (banner + interstitial)

**Fluxo:**
1. Usuário preenche o formulário
2. Sistema valida e-mail (deve ser único)
3. Sistema gera Pelada ID e senha únicos
4. Insere dados na tabela `clientes` do Supabase
5. Cria usuário admin padrão na tabela `usuarios`
6. Exibe modal com as credenciais geradas
7. Usuário faz login automaticamente após ver as credenciais

### 2. Cadastro Gold/Premium (Manual - Admin)
**Rota:** `/admin/clientes/cadastrar` (requer acesso admin)

**Campos Adicionais:**
- Configurações Supabase (URL, anon key, service key)
- Escolha do plano (Gold ou Premium)
- Limites personalizados

**Limites GOLD:**
- ✅ 40 jogadores
- ✅ 15 partidas
- ✅ 3 usuários
- ✅ Banco de dados Supabase compartilhado
- ❌ Sem anúncios
- ❌ Modo Partida
- ❌ Estatísticas completas

**Limites PREMIUM:**
- ✅ Jogadores ilimitados
- ✅ Partidas ilimitadas
- ✅ Usuários ilimitados
- ✅ Banco de dados Supabase dedicado
- ✅ Modo Partida (com estatísticas detalhadas)
- ✅ Estatísticas completas
- ❌ Sem anúncios

**Fluxo:**
1. Admin acessa área administrativa
2. Preenche formulário completo
3. Sistema valida e insere no banco
4. Admin fornece credenciais ao cliente manualmente

## 🛡️ AuthGuard (Proteção de Rotas)

**Implementado em:** `src/components/Layout.tsx`

**Funcionamento:**
```typescript
// 1. Verifica se está no cliente (evita hydration mismatch)
// 2. Obtém usuário do localStorage
// 3. Identifica se é rota pública ou protegida
// 4. Aplica lógica de redirecionamento:

// Caso 1: Usuário não logado + rota protegida → Redireciona para /login
if (!usuario && !isPublicRoute) {
  router.push('/login');
}

// Caso 2: Usuário logado + /login → Redireciona para /home
if (usuario && pathname === '/login') {
  router.push('/');
}
```

**Loading Screen:**
Durante a verificação de autenticação, exibe tela de carregamento com spinner para evitar flash de conteúdo.

## 📱 Página de Login Atualizada

**Novos Elementos:**

### 1. Botão "Criar Conta GRÁTIS"
- Cor: Gradiente verde (branding PelADM)
- Ação: Redireciona para `/cadastro-free`
- Destaque visual: Botão grande e proeminente
- Texto auxiliar: "25 jogadores • 10 partidas • Sem taxas"

### 2. Link "💎 Quer Gold ou Premium?"
- Cor: Roxo (planos premium)
- Ação: Abre WhatsApp com mensagem pré-preenchida
- Texto auxiliar: "Mais jogadores, sem anúncios, estatísticas completas"

**Configuração do WhatsApp:**
Arquivo: `src/config/contato.ts`
```typescript
export const CONTATO = {
  whatsapp: '5561999999999', // ALTERE PARA SEU NÚMERO
  mensagemGoldPremium: 'Olá! Quero contratar o plano Gold ou Premium do PelADM',
};
```

## 💾 Dados Armazenados no localStorage

```typescript
{
  id: string,              // Pelada ID (ex: MT1234)
  nome: string,            // Nome da pelada
  email: string,           // E-mail
  usuario_pelada: string,  // Nome do usuário (padrão: "admin")
  senha_pelada: string,    // Senha do usuário
  plano: string,           // "Free" | "Gold" | "Premium"
  is_master: boolean,      // true para admin
  status: boolean,         // true para ativo
  tipo_acesso: string      // "completo" | "visitante"
}
```

## 🔄 Fluxo Completo de Uso

### Novo Usuário FREE:
1. Acessa qualquer rota → Redirecionado para `/login`
2. Clica em "Criar Conta GRÁTIS"
3. Preenche formulário com nome, e-mail e telefone
4. Vê modal com Pelada ID e senha gerados
5. Clica em "Fazer Login Agora"
6. Redirecionado para home com acesso completo

### Usuário Existente:
1. Acessa `/login`
2. Digita Pelada ID, usuário e senha
3. Sistema valida credenciais no Supabase
4. Redirecionado para home

### Visitante (Acesso Limitado):
1. Acessa `/login`
2. Digita apenas Pelada ID
3. Clica em "Ver Estatísticas"
4. Redirecionado para `/resultados` com acesso limitado

### Interessado em Gold/Premium:
1. Na tela de login, clica em "💎 Quer Gold ou Premium?"
2. WhatsApp abre com mensagem pré-preenchida
3. Contato com admin para configuração manual

## 🎨 Design

### Página de Login:
- Layout clean e moderno
- Gradiente verde para botão FREE
- Roxo para link Gold/Premium
- Logo centralizado no rodapé
- Responsivo para mobile

### Página de Cadastro FREE:
- Gradiente verde de fundo (branding)
- Formulário simples e direto
- Lista de benefícios do plano FREE
- Modal de sucesso com destaque visual
- Botão de login imediato após cadastro

## 🧪 Testando o Sistema

### 1. Teste de Cadastro FREE:
```bash
# Acesse localhost:3000/cadastro-free
# Preencha os dados
# Verifique se credenciais foram geradas
# Teste o login automático
```

### 2. Teste de Proteção de Rotas:
```bash
# Abra navegador anônimo
# Acesse localhost:3000
# Deve redirecionar para /login
# Acesse localhost:3000/sorteio
# Deve redirecionar para /login
```

### 3. Teste de Login:
```bash
# Use credenciais geradas no cadastro
# Verifique redirecionamento para home
# Tente acessar /login novamente
# Deve redirecionar para home (já logado)
```

## ⚠️ Próximas Melhorias

### Segurança:
- [ ] Hash de senhas (bcrypt ou similar)
- [ ] Tokens JWT para autenticação
- [ ] Confirmação de e-mail
- [ ] Recuperação de senha

### UX:
- [ ] "Lembrar-me" (persistência de sessão)
- [ ] Logout com confirmação
- [ ] Edição de perfil
- [ ] Troca de senha

### Funcionalidades:
- [ ] Suporte a múltiplos usuários por pelada
- [ ] Convites por e-mail
- [ ] Notificações push
- [ ] Histórico de acessos

## 📊 Estrutura de Banco de Dados

### Tabela: clientes
```sql
- id (PK) - Pelada ID
- nome - Nome da pelada
- email - E-mail (unique)
- telefone - Telefone
- plano - "Free" | "Gold" | "Premium"
- status - "ativo" | "inativo"
- criado_em - timestamp
- supabase_url - URL do Supabase (Gold/Premium)
- supabase_anon_key - Anon key (Gold/Premium)
- supabase_service_key - Service key (Gold/Premium)
```

### Tabela: usuarios
```sql
- id (PK, auto)
- pelada_id (FK → clientes.id)
- username - Nome do usuário
- senha - Senha (texto plano - precisa hash)
- role - "admin" | "editor" | "visualizador"
- ativo - boolean
- criado_em - timestamp
```

## 🔗 Arquivos Modificados/Criados

### Criados:
- ✅ `src/app/cadastro-free/page.tsx` - Página de cadastro FREE
- ✅ `src/config/contato.ts` - Configuração de contato (WhatsApp)
- ✅ `SISTEMA-AUTENTICACAO.md` - Esta documentação

### Modificados:
- ✅ `src/app/login/page.tsx` - Adicionados botões de cadastro e link Gold/Premium
- ✅ `src/components/Layout.tsx` - Implementado AuthGuard e loading screen

## 🚀 Como Configurar para Produção

### 1. Alterar Número do WhatsApp:
Edite `src/config/contato.ts`:
```typescript
export const CONTATO = {
  whatsapp: 'SEU_NUMERO_AQUI', // Ex: 5561999999999
  mensagemGoldPremium: 'Mensagem personalizada',
};
```

### 2. Configurar Validação de E-mail:
Adicione serviço de envio de e-mails (SendGrid, Mailgun, etc.)

### 3. Implementar Hash de Senhas:
```bash
npm install bcrypt
```

### 4. Configurar HTTPS:
Para produção, use certificado SSL/TLS

### 5. Monitorar Cadastros:
Configure alertas para novos cadastros FREE via webhook ou e-mail

## 💡 Dicas de Uso

1. **FREE é porta de entrada**: Deixe o cadastro o mais simples possível
2. **Gold/Premium são manuais**: Você controla quem tem acesso premium
3. **WhatsApp é o canal de vendas**: Facilite o contato direto
4. **Monitore os limites FREE**: Usuários atingindo limites são leads para upgrade
5. **Dados são valiosos**: Use analytics para entender comportamento dos usuários
