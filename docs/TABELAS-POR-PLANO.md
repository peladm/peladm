# 📊 TABELAS DO SUPABASE POR PLANO

## 🔵 SUPABASE PRINCIPAL
**URL:** `https://ewcswczqvelhlwpbraea.supabase.co`

**Anon Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Y3N3Y3pxdmVsaGx3cGJyYWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2Mzc1MzksImV4cCI6MjA4MDIxMzUzOX0.DRzgAuj171lUG_7wMVCFhuDH71sGxlHHEB28qBN9wks`

---

## 📋 TABELAS ADMINISTRATIVAS (Banco Principal)

### `avisos_sistema`
- **Banco:** Principal
- **Acesso:** Apenas usuário com `is_master = true`
- **Propósito:** Avisos globais do sistema

### `clientes`
- **Banco:** Principal  
- **Acesso:** Administração (`is_master = true`) + busca de credenciais
- **Propósito:** Cadastro de clientes, credenciais de acesso, configuração de banco dedicado

---

## 🆓 PLANO FREE

### Tabelas utilizadas:
1. **`clientes`** (banco principal)
   - Apenas busca credenciais
   - Não grava dados adicionais

2. **`regras`** (banco principal)
   - Salva no banco principal
   - Baixa para localStorage
   - Toda alteração repete o processo (salva + baixa)

### Armazenamento:
- **Jogadores:** Apenas localStorage (`jogadores_${peladaId}`)
- **Sessões:** Apenas localStorage (`sessao_ativa`)
- **Fila:** Apenas localStorage (`fila_ativa`)
- ❌ **NÃO possui:** jogos, gols, estatísticas no banco

---

## 🥇 PLANO GOLD

### Tabelas utilizadas:
1. **`clientes`** (banco principal)
   - Apenas busca credenciais
   - Não grava dados adicionais

2. **`regras`** (banco principal)
   - Salva no banco principal
   - Baixa para localStorage
   - Toda alteração repete o processo (salva + baixa)

3. **`jogadores`** (banco indicado nas credenciais)
   - Leitura: busca do Supabase das credenciais
   - Escrita: salva no Supabase das credenciais
   - Sincronização bidirecional com localStorage

### Armazenamento:
- **Jogadores:** Supabase (credenciais) + localStorage
- **Sessões:** Apenas localStorage (`sessao_ativa`)
- **Fila:** Apenas localStorage (`fila_ativa`)
- ❌ **NÃO possui:** jogos, gols no banco (só modo prancheta disponível)

### Modo disponível:
- ✅ **Modo Prancheta** (único modo)
- ❌ Modo Partida (não disponível)

---

## 💎 PLANO PREMIUM

### Tabelas utilizadas:
1. **`clientes`** (banco principal)
   - Busca credenciais
   - Consulta informações do cliente

2. **`regras`** (banco principal)
   - Salva no banco principal
   - Baixa para localStorage
   - Toda alteração repete o processo (salva + baixa)

3. **`jogadores`** (banco indicado nas credenciais)
   - Leitura: busca do Supabase das credenciais
   - Escrita: salva no Supabase das credenciais
   - Sincronização bidirecional com localStorage

4. **`jogos`** (banco indicado nas credenciais)
   - Criada apenas se `tipo_fila === 'modo_partida'`
   - Salva partidas completas com times e placar
   - Sincronização ao finalizar pelada

5. **`sessoes`** (banco indicado nas credenciais)
   - Criada apenas se `tipo_fila === 'modo_partida'`
   - Registra sessões de pelada finalizadas
   - Sincronização ao finalizar pelada

6. **`gols`** (banco indicado nas credenciais)
   - Criada apenas se `tipo_fila === 'modo_partida'`
   - Registra gols individuais por jogador
   - Sincronização ao finalizar pelada

### Armazenamento:
- **Jogadores:** Supabase (credenciais) + localStorage
- **Sessões:** localStorage + Supabase (se modo partida)
- **Fila:** Apenas localStorage (`fila_ativa`)
- **Jogos:** localStorage + Supabase (se modo partida)
- **Gols:** localStorage + Supabase (se modo partida)

### Modos disponíveis:
- ✅ **Modo Prancheta** (contador simples, sem estatísticas)
- ✅ **Modo Partida** (registro completo de jogos, gols e estatísticas)

---

## 🔄 LÓGICA DE SINCRONIZAÇÃO

### **Encerrar Pelada:**

#### FREE:
- ❌ Não sincroniza nada
- 🗑️ Limpa tudo do localStorage (incluindo jogadores)

#### GOLD:
- **Modo Prancheta (único):**
  - ✅ Sincroniza apenas jogadores NOVOS (cadastrados no modo edição)
  - ❌ NÃO sincroniza sessão
  - ❌ NÃO sincroniza jogos/gols (não existem)

#### PREMIUM:
- **Modo Prancheta:**
  - ✅ Sincroniza apenas jogadores NOVOS (cadastrados no modo edição)
  - ❌ NÃO sincroniza sessão
  - ❌ NÃO sincroniza jogos/gols (não existem)

- **Modo Partida:**
  - ✅ Sincroniza SESSÃO completa
  - ✅ Sincroniza todos JOGOS
  - ✅ Sincroniza todos GOLS
  - ✅ Sincroniza TODOS jogadores com estatísticas ACUMULADAS (soma)

---

## 📍 BANCO DAS CREDENCIAIS

O "banco indicado nas credenciais" refere-se a:
- `supabase_url` armazenado em `credenciais` (localStorage) ou tabela `clientes`
- `supabase_anon_key` armazenado em `credenciais` (localStorage) ou tabela `clientes`

**Fallback:** Se não encontrar credenciais específicas, usa banco principal.

---

## 🔍 FUNÇÃO `getClienteSupabase()`

Localização: `src/lib/supabase.ts`

**Comportamento:**
1. Verifica cache de conexões
2. Busca `supabase_url` e `anon_key` do localStorage (credenciais)
3. Se não encontrar, busca da tabela `clientes` no banco principal
4. Se encontrar → cria conexão com banco dedicado
5. Se não encontrar → usa banco principal (fallback)

**Usado por:**
- Gold: jogadores
- Premium: jogadores, jogos, sessoes, gols

---

## 📝 OBSERVAÇÕES IMPORTANTES

1. **Regras sempre no banco principal** - independente do plano
2. **localStorage é cache temporário** - sincroniza com Supabase conforme o plano
3. **Modo Partida só existe no Premium** - Gold só tem modo prancheta
4. **Sincronização é assíncrona** - usa estratégia "cut" (remove do local após sync)
5. **Free força recadastro** - deleta jogadores ao encerrar pelada
