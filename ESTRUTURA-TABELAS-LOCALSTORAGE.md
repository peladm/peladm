# 📊 ESTRUTURA DE TABELAS LOCALSTORAGE

## ⚡ Momento da Criação

**TODAS as tabelas são criadas ao CONFIRMAR TIMES no sorteio** (`sorteio/page.tsx` → função `iniciarPelada()`)

---

## 📋 TABELAS CRIADAS

### 1️⃣ **`sessao_ativa`** (todos os planos)

**Quando:** Ao confirmar times  
**Sync:** Premium → Supabase tabela `sessoes` ao encerrar pelada  
**Estrutura:**
```javascript
{
  id: "sessao_1736026845123",           // sessao_${timestamp}
  pelada_id: "abc123",                   // ID da pelada
  data: "2026-01-04",                    // Data ISO (YYYY-MM-DD)
  status: "ativa",                       // 'ativa' | 'finalizada'
  total_jogadores: 10,                   // Total de jogadores sorteados
  observacoes: "Sorteio realizado...",   // Descrição
  vitorias_consecutivas: 0               // Contador de vitórias seguidas
}
```

**Onde é usado:**
- Referência principal da sessão em toda a aplicação
- Controle de partidas finalizadas
- Identificação da sessão ativa

---

### 2️⃣ **`fila_ativa`** (todos os planos)

**Quando:** Ao confirmar times  
**Sync:** NUNCA (deletada ao encerrar pelada)  
**Estrutura:**
```javascript
[
  {
    id: "fila_1736026845_1",
    pelada_id: "abc123",
    sessao_id: "sessao_1736026845123",
    nome: "João",
    status: "fila",                      // 'fila' | 'reserva'
    posicao_fila: 1,                     // 1, 2, 3... ou 9999 (reserva)
    vitorias_consecutivas_time: 0
  },
  // ... outros jogadores
]
```

**Onde é usado:**
- Controle da fila durante a pelada
- Rotação após partidas
- Exibição dos times jogando/fila/reserva

---

### 3️⃣ **`jogadores_${peladaId}`** (todos os planos)

**Quando:** Download do Supabase ao confirmar times (já existente antes)  
**Sync:** Gold/Premium → Supabase tabela `jogadores` ao encerrar pelada (atualiza estatísticas)  
**Estrutura:**
```javascript
[
  {
    id: "uuid-jogador-1",
    nome: "João",
    nivel: 3,                            // 1-5
    pelada_id: "abc123",
    jogos: 0,
    vitorias: 0,
    derrotas: 0,
    empates: 0,
    gols: 0,
    status: "ativo",                     // 'ativo' | 'inativo'
    created_at: "2026-01-04T10:00:00Z",
    updated_at: "2026-01-04T10:00:00Z"
  },
  // ... outros jogadores
]
```

**Onde é usado:**
- Buscar informações dos jogadores
- Estatísticas individuais
- Validação de cadastro

---

### 4️⃣ **`fila_snapshot_${peladaId}`** (Gold/Premium apenas)

**Quando:** Ao confirmar times (snapshot inicial)  
**Sync:** NUNCA (deletada ao encerrar pelada)  
**Estrutura:**
```javascript
[
  {
    id: "snapshot_1736026845123",
    pelada_id: "abc123",
    snapshot_data: [...],                // Array completo da fila_ativa
    tipo: "inicial",                     // 'inicial' | 'manual'
    created_at: "2026-01-04T10:00:00Z"
  }
]
```

**Onde é usado:**
- Sistema de "Desfazer" (restaurar fila)
- Modo edição

---

### 5️⃣ **`jogos_${sessaoId}`** (todos os planos) ⭐ NOVO

**Quando:** Ao confirmar times (vazia)  
**Sync:** Premium → Supabase tabela `jogos` ao encerrar pelada  
**Estrutura:**
```javascript
[
  {
    id: "jogo_1736026900000",
    sessao_id: "sessao_1736026845123",
    numero_jogo: 1,
    time_a: [
      { id: "uuid-1", nome: "João", nivel: 3 },
      { id: "uuid-2", nome: "Maria", nivel: 4 },
      // ... resto do time A
    ],
    time_b: [
      { id: "uuid-3", nome: "Pedro", nivel: 3 },
      { id: "uuid-4", nome: "Ana", nivel: 5 },
      // ... resto do time B
    ],
    placar_a: 3,
    placar_b: 2,
    status: "finalizado",                // 'aguardando' | 'em_andamento' | 'finalizado'
    time_vencedor: "A",                  // 'A' | 'B' | 'empate' | null
    tempo_decorrido: 1200,               // segundos (cronômetro)
    data_inicio: "2026-01-04T10:05:00Z",
    data_fim: "2026-01-04T10:25:00Z",
    created_at: "2026-01-04T10:25:00Z"
  },
  // ... próximos jogos
]
```

**Onde é usado:**
- **Modal Partidas** → exibe resultados das partidas
- Histórico de jogos da sessão
- Estatísticas de vitórias/derrotas

**Alimentado por:**
- `finalizarPartidaComRotacao()` em `page-fila/page.tsx` (linha ~2900)

---

### 6️⃣ **`gols_${sessaoId}`** (Premium apenas) ⭐ NOVO

**Quando:** Ao confirmar times (vazia, Premium apenas)  
**Sync:** Premium → Supabase tabela `gols` ao encerrar pelada  
**Estrutura:**
```javascript
[
  {
    id: "gol_1736026920000_0.123",
    jogo_id: "jogo_1736026900000",
    jogador_id: "uuid-1",
    time: "A",                           // 'A' | 'B'
    created_at: "2026-01-04T10:22:00Z"
  },
  {
    id: "gol_1736026925000_0.456",
    jogo_id: "jogo_1736026900000",
    jogador_id: "uuid-2",
    time: "A",
    created_at: "2026-01-04T10:23:00Z"
  },
  // ... outros gols
]
```

**Onde é usado:**
- **Modal Gols** → exibe artilheiros e quem não marcou
- Ranking de goleadores
- Estatísticas detalhadas (Premium)

**Alimentado por:**
- `finalizarPartidaComRotacao()` em `page-fila/page.tsx` (linha ~2950)
- Itera sobre `golsJogadores` (objeto com nome do jogador → quantidade de gols)

---

## 🔄 FLUXO COMPLETO

### 1. **Ao Confirmar Times (Sorteio)**
```
sorteio/page.tsx → iniciarPelada()
  ├─ Cria sessao_ativa
  ├─ Cria fila_ativa
  ├─ Cria fila_snapshot_${peladaId} (Gold/Premium)
  ├─ Cria jogos_${sessaoId} = [] ⭐
  └─ Cria gols_${sessaoId} = [] (Premium) ⭐
```

### 2. **Durante a Pelada (Finalizar Partida)**
```
page-fila/page.tsx → finalizarPartidaComRotacao()
  ├─ Monta objeto jogo completo (times, placar, vencedor)
  ├─ Adiciona em jogos_${sessaoId} ⭐
  ├─ Se Premium: adiciona gols em gols_${sessaoId} ⭐
  └─ Rotaciona fila
```

### 3. **Ao Encerrar Pelada**
```
page-fila/page.tsx → confirmarEncerramentoPelada()
  ├─ Se Premium: Sync (sessoes, jogos, gols) → Supabase
  ├─ Se Gold: Sync jogadores → Supabase
  ├─ Deleta todas as tabelas localStorage
  └─ Redireciona para home
```

---

## 📊 MODAL PARTIDAS (Estatísticas)

**Arquivo:** `page-fila/page.tsx` → função `carregarInfoPartidas()`

**Busca de:** `jogos_${sessaoId}`

**Exibe:**
- Número do jogo
- Times A e B (nomes dos jogadores)
- Placar (A x B)
- Vencedor

---

## ⚽ MODAL GOLS (Estatísticas Premium)

**Arquivo:** `page-fila/page.tsx` → função `carregarInfoGols()`

**Busca de:**
- `jogos_${sessaoId}` → para saber quem jogou
- `gols_${sessaoId}` → para contar gols por jogador

**Exibe:**
- **Artilheiros:** Lista ordenada por gols (maior → menor)
- **Sem gols:** Jogadores que participaram mas não marcaram

**Lógica:**
1. Busca todos os jogos
2. Cria mapa de jogadores (id → nome)
3. Rastreia quem jogou (times A e B de todos os jogos)
4. Conta gols por jogador da tabela gols
5. Separa em "artilheiros" e "sem gols"

---

## 🔑 DIFERENÇA ENTRE PLANOS

| Tabela | Free | Gold | Premium |
|--------|------|------|---------|
| `sessao_ativa` | ✅ Local | ✅ Local | ✅ Local → Sync |
| `fila_ativa` | ✅ Local | ✅ Local | ✅ Local |
| `jogadores_${peladaId}` | ✅ Local | ✅ Local → Sync | ✅ Local → Sync |
| `fila_snapshot_${peladaId}` | ❌ | ✅ Local | ✅ Local |
| `jogos_${sessaoId}` | ✅ Local | ✅ Local | ✅ Local → Sync |
| `gols_${sessaoId}` | ❌ | ❌ | ✅ Local → Sync |

**Legenda:**
- **Local:** Salvo apenas no localStorage
- **Local → Sync:** Salvo no localStorage + sincronizado com Supabase ao encerrar
- **❌:** Não existe nesse plano

---

## 🎯 RESUMO PRÁTICO

**Para TESTAR as tabelas de estatísticas:**

1. **Novo sorteio** → Confirmar times (cria as tabelas)
2. **Finalizar 1+ partidas** → Alimenta `jogos` e `gols`
3. **Abrir modal Partidas** → Verifica se exibe os jogos
4. **Abrir modal Gols** (Premium) → Verifica artilheiros

**No console do navegador (F12):**
```javascript
// Ver sessão ativa
JSON.parse(localStorage.getItem('sessao_ativa'))

// Ver jogos finalizados
JSON.parse(localStorage.getItem('jogos_sessao_1736026845123'))

// Ver gols (Premium)
JSON.parse(localStorage.getItem('gols_sessao_1736026845123'))
```
