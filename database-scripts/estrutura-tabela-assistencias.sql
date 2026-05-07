-- Tabela de Assistências
-- Estrutura idêntica à tabela de gols, registrando assistências por jogo

create table assistencias (
  id uuid default gen_random_uuid() primary key,
  jogo_id text not null,
  jogador_id text not null,
  time varchar(1) check (time in ('A', 'B')) not null,
  created_at timestamptz default now(),
  gol_id text
);

-- Índices para performance
create index idx_assistencias_jogo_id on assistencias(jogo_id);
create index idx_assistencias_jogador_id on assistencias(jogador_id);
create index idx_assistencias_created_at on assistencias(created_at desc);

-- =========================================
-- OBSERVAÇÕES:
-- =========================================
-- 1. Free/Gold: NÃO EXISTE (recurso exclusivo Premium)
-- 2. Premium: localStorage → deploy ao encerrar pelada
-- 3. Usado apenas no "Modo Partida" (exclusivo Premium)
-- 4. Cada assistência é um registro individual
-- 5. Permite estatísticas detalhadas por jogador
-- 6. jogo_id: referência ao UUID do jogo (armazenado como TEXT)
-- 7. jogador_id: ID do jogador (pode ser diferente do nome)
-- 8. gol_id: referência ao gol que foi assistido (opcional)
-- 9. RLS DESABILITADO (igual tabela gols)

