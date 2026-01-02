# 🎯 Setup de Banco Dedicado Premium

Guia passo a passo para configurar um novo banco dedicado para cliente Premium.

---

## 📋 Pré-requisitos

- [ ] Projeto Supabase criado (novo banco dedicado)
- [ ] `supabase_url` do novo projeto
- [ ] `supabase_anon_key` do novo projeto
- [ ] Arquivo `SETUP-BANCO-DEDICADO.sql` disponível

---

## 🚀 Passo a Passo

### 1️⃣ Criar Cliente Premium no Sistema

No dashboard de admin (`/admin/clientes`):

1. Criar novo cliente ou editar existente
2. Definir **Plano: Premium**
3. Preencher `supabase_url` e `supabase_anon_key` do banco dedicado
4. Salvar

---

### 2️⃣ Executar SQL no Banco Dedicado

1. **Acessar Supabase Dashboard** do banco dedicado
2. **Ir em: SQL Editor** (ícone </> no menu lateral)
3. **Criar nova query**
4. **Copiar TODO o conteúdo** de `SETUP-BANCO-DEDICADO.sql`
5. **Colar e executar** (RUN ou F5)
6. **Verificar mensagem**: `✅ Setup completo! Tabelas e funções criadas com sucesso!`

---

### 3️⃣ Verificar Criação

Verifique se as tabelas foram criadas:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

**Resultado esperado**:
- ✅ jogadores
- ✅ sessoes
- ✅ fila
- ✅ jogos
- ✅ gols
- ✅ fila_snapshot

---

### 4️⃣ Verificar Funções RPC

Verifique se as funções foram criadas:

```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public'
AND routine_name LIKE 'get_%'
ORDER BY routine_name;
```

**Resultado esperado**:
- ✅ get_database_total_size
- ✅ get_tables_size

---

### 5️⃣ Testar no Dashboard

1. Ir para `/admin/clientes/[id]` (dashboard do cliente)
2. Clicar em **🔄 Atualizar** (seção "Banco de Dados")
3. Verificar se aparece:
   - **Banco Total**: tamanho real (ex: 11 MB)
   - **📊 Tabelas**: tamanho individual (ex: 352.00 KB)

---

## 📦 O que o SQL faz?

### Parte 1: Tabelas
Cria as 6 tabelas principais:
- `jogadores` - Cadastro de jogadores
- `sessoes` - Sessões de pelada
- `fila` - Fila de espera da sessão
- `jogos` - Partidas realizadas
- `gols` - Gols marcados
- `fila_snapshot` - Histórico da fila

### Parte 2: Índices
Cria índices para performance:
- Busca por pelada_id
- Busca por sessao_id
- Busca por status
- Constraint de sessão única ativa

### Parte 3: Funções RPC
Cria funções para calcular tamanho:
- `get_database_total_size()` - Tamanho total do banco
- `get_tables_size()` - Tamanho de cada tabela

### Parte 4: Permissões
Concede permissões de execução para:
- Usuários autenticados (`authenticated`)
- Usuários anônimos (`anon`)

---

## ⚠️ Importante

### ❌ Não criar no banco principal:
- Banco principal (banco-principal.supabase.co) já tem sua estrutura
- Execute apenas nos bancos dedicados de clientes Premium

### ✅ Foreign Keys omitidas:
- `pelada_id` não tem FK porque `usuarios` está no banco principal
- Isso é proposital para separação de bancos

### 🔄 Quando executar:
- **Sempre** que criar um novo banco dedicado
- **Não** executar em banco que já tem dados (pode causar conflitos)

---

## 🆘 Troubleshooting

### Erro: "table already exists"
**Causa**: Tabela já existe no banco  
**Solução**: Use `DROP TABLE IF EXISTS` antes ou use banco limpo

### Erro: "function already exists"
**Causa**: Função já existe  
**Solução**: OK! O `CREATE OR REPLACE` já atualiza automaticamente

### Dashboard não mostra tamanho
**Causa**: Funções RPC não criadas  
**Solução**: Execute apenas a Parte 3 do SQL (funções)

### Permissão negada ao chamar função
**Causa**: Permissões não concedidas  
**Solução**: Execute a Parte 4 do SQL (grants)

---

## 📚 Arquivos Relacionados

- **SETUP-BANCO-DEDICADO.sql** - Script completo de setup
- **ESTRUTURA-DATABASE.md** - Documentação completa do banco
- **src/lib/supabase.ts** - Função `getClienteSupabase()` (roteamento)

---

## ✅ Checklist Final

- [ ] Cliente criado/editado com plano Premium
- [ ] `supabase_url` e `supabase_anon_key` preenchidos
- [ ] SQL executado no banco dedicado
- [ ] 6 tabelas criadas com sucesso
- [ ] 2 funções RPC criadas
- [ ] Dashboard mostrando uso real do banco
- [ ] Teste: adicionar jogador no cadastro
- [ ] Teste: criar sessão e adicionar na fila
- [ ] Teste: sortear times

---

**Pronto! Banco dedicado configurado e pronto para uso!** 🎉
