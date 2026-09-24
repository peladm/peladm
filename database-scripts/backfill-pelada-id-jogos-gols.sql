-- Backfill de pelada_id para jogos e gols antigos.
-- Execute no banco dedicado correspondente ao cliente.

begin;

-- 1) Preencher jogos.pelada_id usando a sessão da partida.
update jogos j
set pelada_id = s.pelada_id
from sessoes s
where j.sessao_id = s.id
  and j.pelada_id is null
  and s.pelada_id is not null;

-- 2) Preencher gols.pelada_id usando o jogo relacionado.
update gols g
set pelada_id = j.pelada_id
from jogos j
where g.jogo_id = j.id
  and g.pelada_id is null
  and j.pelada_id is not null;

commit;

-- Verificação rápida:
-- select count(*) as jogos_sem_pelada from jogos where pelada_id is null;
-- select count(*) as gols_sem_pelada from gols where pelada_id is null;
