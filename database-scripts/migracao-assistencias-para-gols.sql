-- ============================================================
-- MIGRACAO: TABELA assistencias -> COLUNA gols.assistencia
-- Data: 20/06/2026
-- Objetivo: Unificar assistencias dentro da tabela gols
-- Reuso: Pode ser aplicado em outros bancos com mesmo modelo
-- ============================================================

-- PASSO 0) PRE-CHECKS (opcional, mas recomendado)
-- ------------------------------------------------------------
-- SELECT COUNT(*) AS total_gols FROM gols;
-- SELECT COUNT(*) AS total_assistencias FROM assistencias;
--
-- SELECT
--   COUNT(*) FILTER (WHERE gol_id IS NOT NULL) AS com_gol_id,
--   COUNT(*) FILTER (WHERE gol_id IS NULL) AS sem_gol_id
-- FROM assistencias;
--
-- SELECT gol_id, COUNT(*) AS qtd
-- FROM assistencias
-- WHERE gol_id IS NOT NULL
-- GROUP BY gol_id
-- HAVING COUNT(*) > 1;
--
-- SELECT a.id, a.gol_id
-- FROM assistencias a
-- LEFT JOIN gols g ON g.id::text = a.gol_id::text
-- WHERE a.gol_id IS NOT NULL
--   AND g.id IS NULL;


-- PASSO 1) BACKUP + ESTRUTURA NOVA
-- ------------------------------------------------------------
BEGIN;

-- Backup completo da tabela antiga
CREATE TABLE IF NOT EXISTS assistencias_backup_pre_migracao AS
SELECT * FROM assistencias;

-- Nova coluna unificada
ALTER TABLE gols
  ADD COLUMN IF NOT EXISTS assistencia TEXT;

-- Indice para consultas por assistente
CREATE INDEX IF NOT EXISTS idx_gols_assistencia
  ON gols(assistencia);

COMMIT;


-- PASSO 2) MIGRAR DADOS PARA gols.assistencia
-- ------------------------------------------------------------
BEGIN;

-- Em caso de mais de um registro para o mesmo gol_id, mantem o mais recente.
WITH assist_unica AS (
  SELECT DISTINCT ON (a.gol_id)
    a.gol_id,
    a.jogador_id,
    a.created_at,
    a.id
  FROM assistencias a
  WHERE a.gol_id IS NOT NULL
  ORDER BY a.gol_id, a.created_at DESC, a.id DESC
)
UPDATE gols g
SET assistencia = au.jogador_id
FROM assist_unica au
WHERE g.id::text = au.gol_id::text
  AND g.assistencia IS DISTINCT FROM au.jogador_id;

COMMIT;


-- PASSO 3) VALIDACAO POS-MIGRACAO
-- ------------------------------------------------------------
SELECT
  COUNT(*) AS gols_total,
  COUNT(*) FILTER (WHERE assistencia IS NOT NULL) AS gols_com_assistencia,
  COUNT(*) FILTER (WHERE assistencia IS NULL) AS gols_sem_assistencia
FROM gols;

-- Conferencia amostral
SELECT id, jogo_id, jogador_id, assistencia, time, created_at
FROM gols
ORDER BY created_at DESC NULLS LAST
LIMIT 50;


-- PASSO 4) LIMPEZA (EXECUTAR SOMENTE QUANDO APP JA ESTIVER AJUSTADO)
-- ------------------------------------------------------------
-- DROP TABLE IF EXISTS assistencias;


-- ROLLBACK MANUAL (SE PRECISAR)
-- ------------------------------------------------------------
-- 1) Restaurar tabela antiga a partir do backup:
--    DROP TABLE IF EXISTS assistencias;
--    CREATE TABLE assistencias AS
--    SELECT * FROM assistencias_backup_pre_migracao;
--
-- 2) Remover coluna nova:
--    ALTER TABLE gols DROP COLUMN IF EXISTS assistencia;
