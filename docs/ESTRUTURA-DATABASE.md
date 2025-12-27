# Estrutura do Banco de Dados - Peladm

## Tabela: `fila`
Gerencia a fila de jogadores e estatísticas por sessão.

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | uuid | NO | gen_random_uuid() | ID único |
| pelada_id | text | NO | - | ID da pelada |
| sessao_id | uuid | YES | - | ID da sessão ativa |
| jogador_id | text | NO | - | ID do jogador |
| status | varchar(50) | YES | 'ativo' | Status do jogador |
| **posicao_fila** | integer | NO | - | **Posição na fila (1 a N)** |
| **vitorias_consecutivas_time** | integer | YES | 0 | **Vitórias consecutivas do Time 1** |
| jogos_jogados | integer | YES | 0 | Total de jogos |
| vitorias | integer | YES | 0 | Total de vitórias |
| gols | integer | YES | 0 | Total de gols |
| posicao | integer | YES | - | (deprecated?) |
| created_at | timestamptz | YES | now() | Data criação |
| updated_at | timestamptz | YES | now() | Data atualização |

---

## Tabela: `gols`
Registra cada gol marcado em cada jogo.

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | uuid | NO | gen_random_uuid() | ID único |
| jogo_id | uuid | YES | - | ID do jogo |
| jogador_id | text | NO | - | ID do jogador |
| time | char(1) | NO | - | 'A' ou 'B' |
| created_at | timestamptz | YES | now() | Timestamp do gol |

---

## Tabela: `jogadores`
Cadastro de jogadores e estatísticas acumuladas.

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | uuid | NO | uuid_generate_v4() | ID único |
| nome | varchar(100) | NO | - | Nome do jogador |
| nivel | integer | NO | - | Nível/estrelas (1-5) |
| status | text | YES | - | Status |
| pelada_id | varchar | YES | - | ID da pelada |
| **jogos** | integer | YES | - | **Total de jogos disputados** |
| **vitorias** | integer | YES | - | **Total de vitórias** |
| **gols** | integer | YES | - | **Total de gols marcados** |

---

## Tabela: `jogos`
Histórico de partidas realizadas.

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | uuid | NO | gen_random_uuid() | ID único |
| sessao_id | uuid | YES | - | ID da sessão |
| time_a | jsonb | NO | - | Array de jogadores Time A |
| time_b | jsonb | NO | - | Array de jogadores Time B |
| placar_a | integer | YES | 0 | Placar Time A |
| placar_b | integer | YES | 0 | Placar Time B |
| status | varchar(20) | YES | 'em_andamento' | Status do jogo |
| tempo_decorrido | integer | YES | 0 | Tempo em segundos |
| **time_vencedor** | char(1) | YES | - | **'A', 'B' ou null (empate)** |
| data_inicio | timestamptz | YES | now() | Início do jogo |
| data_fim | timestamptz | YES | - | Fim do jogo |
| created_at | timestamptz | YES | now() | Data criação |
| numero_jogo | integer | YES | - | Número sequencial |
| substituicoes | jsonb | YES | '[]' | Array de substituições |

---

## Tabela: `regras`
Configurações da pelada.

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | uuid | NO | uuid_generate_v4() | ID único |
| **jogadores_por_time** | integer | YES | 5 | **Jogadores por time** |
| modelo_sorteio | varchar | YES | - | 'equilibrado' ou 'aleatorio' |
| **duracao** | integer | YES | 10 | **Duração em minutos** |
| **vitorias_consecutivas** | integer | YES | 0 | **Limite de vitórias (2, 3, 4 ou null=desabilitado)** |
| **prioridade_retorno** | varchar | YES | - | **'vencedor_antes', 'perdedor_antes', 'mesclar'** |
| **regra_empate** | varchar | YES | - | **'ambos_saem', 'desempate'** |
| **regra_apos_empate** | varchar | YES | - | **'desempate_decide', 'mesclar_times'** |
| pelada_id | varchar | YES | - | ID da pelada |

---

## Tabela: `sessoes`
Sessões de jogo (dia de pelada).

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | uuid | NO | gen_random_uuid() | ID único |
| pelada_id | text | NO | - | ID da pelada |
| data | date | YES | CURRENT_DATE | Data da sessão |
| status | varchar(20) | YES | 'ativa' | Status |
| total_jogadores | integer | YES | 0 | Total de jogadores |
| observacoes | text | YES | - | Observações |
| created_at | timestamptz | YES | now() | Data criação |
| updated_at | timestamptz | YES | now() | Data atualização |
| vitorias_consecutivas | integer | YES | 0 | (deprecated?) |

---

## Tabela: `usuarios`
Usuários do sistema.

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| id | uuid | NO | gen_random_uuid() | ID único |
| username | varchar(100) | NO | - | Nome de usuário |
| senha | varchar(255) | NO | - | Senha (hash) |
| pelada_id | varchar | YES | - | ID da pelada |
| role | varchar | YES | - | Papel do usuário |

---

## Observações Importantes

### Campos que causaram confusão:
- ❌ `limite_vitorias_consecutivas` - NÃO EXISTE
- ✅ `vitorias_consecutivas` - Nome correto na tabela `regras`
- ❌ `posicao` - Usar `posicao_fila` na tabela `fila`
- ❌ Campo `tipo` em `gols` - NÃO EXISTE

### Regras de Rotação:
- Vitórias consecutivas são armazenadas em `fila.vitorias_consecutivas_time` (sempre do Time 1/posições 1-N)
- Limite configurado em `regras.vitorias_consecutivas` (2, 3, 4 ou null)
- Prioridade de retorno em `regras.prioridade_retorno`

### Estatísticas:
- **Acumuladas**: `jogadores.jogos`, `jogadores.vitorias`, `jogadores.gols`
- **Por jogo**: Tabela `gols` com jogo_id, jogador_id, time, created_at
- **Por sessão**: `fila.jogos_jogados`, `fila.vitorias`, `fila.gols` (estatísticas da sessão)
