-- Tabela unificada para catalogo de torneios por cliente (pelada)
-- Objetivo: concentrar metadados de torneios/liga e vincular com o contexto da pelada.

CREATE TABLE IF NOT EXISTS public.torneios (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pelada_id TEXT NOT NULL,
  nome TEXT NOT NULL,
  nivel_importancia TEXT NOT NULL DEFAULT 'intermediario' CHECK (
    nivel_importancia IN (
      'baixa_relevancia',
      'intermediario',
      'alta_relevancia',
      'o_torneio',
      'intertemporada_sem_classificacao'
    )
  ),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT torneios_pelada_fk
    FOREIGN KEY (pelada_id)
    REFERENCES public.clientes (pelada_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT torneios_nome_unico_por_pelada UNIQUE (pelada_id, nome)
);

CREATE INDEX IF NOT EXISTS idx_torneios_pelada_id ON public.torneios (pelada_id);
CREATE INDEX IF NOT EXISTS idx_torneios_importancia ON public.torneios (nivel_importancia);

CREATE OR REPLACE FUNCTION public.set_updated_at_torneios()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_updated_at_torneios ON public.torneios;

CREATE TRIGGER trg_set_updated_at_torneios
BEFORE UPDATE ON public.torneios
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_torneios();
