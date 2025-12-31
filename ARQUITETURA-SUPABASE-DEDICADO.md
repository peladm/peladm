# 🏗️ Arquitetura de Bancos de Dados - Supabase Dedicado

## 📊 Status Atual da Implementação

### ✅ O QUE JÁ ESTÁ ADAPTADO:

O sistema **já está preparado** para usar Supabase dedicado para clientes Premium através da função `getClienteSupabase()` no arquivo [src/lib/supabase.ts](src/lib/supabase.ts).

#### Como funciona:
```typescript
// 1. Sistema busca credenciais do cliente no banco PRINCIPAL
const { data: clienteData } = await supabase
  .from('clientes')
  .select('supabase_url, supabase_anon_key, plano')
  .eq('id', peladaId)
  .single();

// 2. Se Premium COM banco dedicado → conecta no dedicado
// 3. Se Free OU sem banco dedicado → usa banco principal
```

---

## 🗄️ DIVISÃO DAS TABELAS

### 🔵 BANCO PRINCIPAL (Sistema Central)
**URL:** `https://ewcswczqvelhlwpbraea.supabase.co`

Tabelas que **SEMPRE** usam o banco principal:

1. **`clientes`** ⭐ CRÍTICA
   - Armazena dados de TODOS os clientes (Free, Gold, Premium)
   - Campos: `id`, `nome`, `email`, `plano`, `codigo_curto`, `supabase_url`, `supabase_anon_key`
   - **NUNCA** deve ser replicada no banco dedicado

2. **`usuarios`** ⭐ IMPORTANTE
   - Armazena usuários/colaboradores de cada pelada
   - Usado para autenticação e controle de acesso
   - **Status:** ❌ NÃO adaptado (usa `supabase` direto)
   - **Arquivos:** `src/lib/cacheService.ts`, `src/app/usuarios/page.tsx`, `src/app/login/page.tsx`

---

### 🟢 BANCO DEDICADO (Cliente Premium) OU PRINCIPAL (Free/Gold)
**Decisão:** Função `getClienteSupabase(peladaId)` decide automaticamente

Tabelas que **devem existir no banco dedicado** do Premium:

1. **`jogadores`** ✅ ADAPTADO
   - Cadastro de jogadores da pelada
   - Campos: `id`, `nome`, `nivel`, `status`, `pelada_id`, `jogos`, `vitorias`, `gols`
   - **Serviço:** `jogadoresService` em [src/lib/supabase.ts](src/lib/supabase.ts)

2. **`regras`** ❌ NÃO ADAPTADO
   - Configurações da pelada (sorteio, fila, duração, etc)
   - **Arquivos:** `src/app/regras/page.tsx`, `src/lib/cacheService.ts`
   - **Problema:** Usa `supabase` direto, não `getClienteSupabase()`

3. **`sessoes`** ❌ NÃO ADAPTADO
   - Sessões de peladas (ativas/finalizadas)
   - Campos: `id`, `pelada_id`, `status`, `data_inicio`, `data_fim`
   - **Arquivos:** Múltiplos (`page-fila`, `sorteio`, `syncService`)
   - **Problema:** Usa `supabase` direto em TODOS os lugares

4. **`fila`** ❌ NÃO ADAPTADO
   - Gerenciamento da fila de jogadores
   - Campos: `id`, `pelada_id`, `sessao_id`, `jogador_id`, `status`, `posicao_fila`
   - **Arquivos:** `src/app/page-fila/page.tsx`, `src/lib/syncService.ts`
   - **Problema:** Usa `supabase` direto

5. **`jogos`** ❌ NÃO ADAPTADO
   - Registro de partidas realizadas
   - Campos: `id`, `sessao_id`, `time_a_jogadores`, `time_b_jogadores`, `gols_time_a`, `gols_time_b`
   - **Arquivos:** `page-fila`, `resultados`, `estatisticas`, `syncService`
   - **Problema:** Usa `supabase` direto

6. **`gols`** ❌ NÃO ADAPTADO
   - Registro de gols marcados
   - Campos: `id`, `jogo_id`, `jogador_id`, `pelada_id`
   - **Arquivos:** `page-fila`, `resultados`, `estatisticas`, `syncService`
   - **Problema:** Usa `supabase` direto

---

## 🚨 PROBLEMAS IDENTIFICADOS

### 1. **Tabelas NÃO Adaptadas** (5/6 tabelas principais)
- `regras`, `sessoes`, `fila`, `jogos`, `gols` usam `supabase` direto
- Clientes Premium irão salvar dados no banco PRINCIPAL, não no DEDICADO
- **Impacto:** Sistema de banco dedicado NÃO funciona corretamente

### 2. **CacheService e SyncService**
- [src/lib/cacheService.ts](src/lib/cacheService.ts):
  - `getRegrasWithCache()` usa `supabase` direto (linha 80)
  - `getUsuariosWithCache()` usa `supabase` direto (linha 124)
  
- [src/lib/syncService.ts](src/lib/syncService.ts):
  - Todas as funções de sync usam `supabase` direto
  - `syncInserirJogo()`, `syncInserirGols()`, `syncAtualizarFila()`, `syncFinalizarSessao()`
  - **Impacto:** Modo offline/local_first sincroniza no banco ERRADO para Premium

### 3. **Modo Sincronização (Tempo Real vs Local First)**
- ✅ Modo tempo_real: Funcionará se corrigirmos para usar `getClienteSupabase()`
- ✅ Modo local_first: Funcionará se corrigirmos syncService
- **Status Atual:** ❌ Ambos salvam no banco principal mesmo sendo Premium

---

## ✅ O QUE PRECISA SER FEITO

### CORREÇÕES NECESSÁRIAS:

#### 1. **Adaptar CacheService** (`src/lib/cacheService.ts`)
```typescript
// ANTES:
const { data, error } = await supabase
  .from('regras')
  .select('*')
  .eq('pelada_id', peladaId)
  .single();

// DEPOIS:
import { getClienteSupabase } from './supabase';

const clienteDb = await getClienteSupabase(peladaId);
const { data, error } = await clienteDb
  .from('regras')
  .select('*')
  .eq('pelada_id', peladaId)
  .single();
```

#### 2. **Adaptar SyncService** (`src/lib/syncService.ts`)
- Adicionar `pelada_id` a TODOS os itens da fila de sync
- Usar `getClienteSupabase(pelada_id)` em vez de `supabase` direto
- Funções: `syncInserirJogo`, `syncInserirGols`, `syncAtualizarFila`, `syncFinalizarSessao`

#### 3. **Adaptar Todas as Páginas**
Arquivos que precisam trocar `supabase` por `getClienteSupabase(peladaId)`:
- ✅ `src/app/page-fila/page.tsx` - regras (linha 420)
- ❌ `src/app/page-fila/page.tsx` - sessoes, fila, jogos, gols (múltiplas linhas)
- ❌ `src/app/sorteio/page.tsx` - regras, sessoes, fila
- ❌ `src/app/regras/page.tsx` - regras, sessoes
- ❌ `src/app/resultados/page.tsx` - jogos, gols, usuarios
- ❌ `src/app/estatisticas/page.tsx` - jogos, gols
- ❌ `src/app/usuarios/page.tsx` - usuarios (se decidir adaptar)

---

## 📋 SCRIPT SQL PARA BANCO DEDICADO PREMIUM

Quando criar um novo banco Supabase para cliente Premium, execute:

```sql
-- ========================================
-- ESTRUTURA PARA BANCO DEDICADO PREMIUM
-- ========================================

-- 1. JOGADORES
CREATE TABLE IF NOT EXISTS jogadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  nivel INTEGER DEFAULT 3,
  status TEXT CHECK (status IN ('ativo', 'inativo')) DEFAULT 'ativo',
  pelada_id UUID NOT NULL,
  jogos INTEGER DEFAULT 0,
  vitorias INTEGER DEFAULT 0,
  gols INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. REGRAS
CREATE TABLE IF NOT EXISTS regras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pelada_id UUID NOT NULL UNIQUE,
  jogadores_por_time INTEGER DEFAULT 5,
  modelo_sorteio TEXT CHECK (modelo_sorteio IN ('equilibrado', 'aleatorio')) DEFAULT 'equilibrado',
  duracao INTEGER DEFAULT 10,
  vitorias_consecutivas INTEGER DEFAULT 0,
  prioridade_retorno TEXT DEFAULT 'prioridade',
  regra_empate TEXT DEFAULT 'ambos_saem',
  regra_apos_empate TEXT DEFAULT 'desempate_decide',
  empate_conta_vitoria BOOLEAN DEFAULT false,
  tipo_fila TEXT CHECK (tipo_fila IN ('modo_partida', 'modo_prancheta')) DEFAULT 'modo_prancheta',
  modo_sincronizacao TEXT CHECK (modo_sincronizacao IN ('tempo_real', 'local_first')) DEFAULT 'tempo_real',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. SESSOES
CREATE TABLE IF NOT EXISTS sessoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pelada_id UUID NOT NULL,
  status TEXT CHECK (status IN ('ativa', 'finalizada')) DEFAULT 'ativa',
  data_inicio TIMESTAMPTZ DEFAULT NOW(),
  data_fim TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. FILA
CREATE TABLE IF NOT EXISTS fila (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pelada_id UUID NOT NULL,
  sessao_id UUID REFERENCES sessoes(id) ON DELETE CASCADE,
  jogador_id UUID REFERENCES jogadores(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('fila', 'reserva', 'jogando')) DEFAULT 'fila',
  posicao_fila INTEGER DEFAULT 999,
  vitorias_consecutivas INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. JOGOS
CREATE TABLE IF NOT EXISTS jogos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id UUID REFERENCES sessoes(id) ON DELETE CASCADE,
  time_a_jogadores TEXT[] NOT NULL,
  time_b_jogadores TEXT[] NOT NULL,
  gols_time_a INTEGER DEFAULT 0,
  gols_time_b INTEGER DEFAULT 0,
  time_vencedor TEXT,
  duracao INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. GOLS
CREATE TABLE IF NOT EXISTS gols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jogo_id UUID REFERENCES jogos(id) ON DELETE CASCADE,
  jogador_id UUID REFERENCES jogadores(id) ON DELETE CASCADE,
  pelada_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_jogadores_pelada ON jogadores(pelada_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_pelada ON sessoes(pelada_id);
CREATE INDEX IF NOT EXISTS idx_fila_sessao ON fila(sessao_id);
CREATE INDEX IF NOT EXISTS idx_fila_jogador ON fila(jogador_id);
CREATE INDEX IF NOT EXISTS idx_jogos_sessao ON jogos(sessao_id);
CREATE INDEX IF NOT EXISTS idx_gols_jogo ON gols(jogo_id);
CREATE INDEX IF NOT EXISTS idx_gols_jogador ON gols(jogador_id);
```

---

## 🎯 RESUMO EXECUTIVO

### Status do Sistema:
- ✅ **Infraestrutura pronta**: `getClienteSupabase()` funciona
- ❌ **Implementação incompleta**: Apenas `jogadores` usa banco dedicado
- ❌ **Tabelas críticas não adaptadas**: 5 de 6 tabelas principais

### Para Funcionar 100%:
1. Adaptar **cacheService.ts** (2 funções)
2. Adaptar **syncService.ts** (4 funções + adicionar pelada_id)
3. Adaptar **todas as páginas** (trocar `supabase` por `getClienteSupabase(peladaId)`)
4. Criar **script SQL completo** no banco dedicado Premium
5. **Testar modo offline** (local_first) com banco dedicado

### Impacto Atual:
- Clientes Premium **estão salvando dados no banco principal** junto com Free/Gold
- Modo offline **sincroniza no banco errado** para Premium
- **Não há isolamento real** dos dados Premium no momento
