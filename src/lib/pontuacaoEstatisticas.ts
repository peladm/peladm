import { supabase } from './supabase';

export interface PontuacaoEstatisticas {
  vitoria: number;
  empate: number;
  derrota: number;
  gol: number;
  golContra: number;
  assistencia: number;
  cleanSheet: number;
}

export const PONTUACAO_PADRAO: PontuacaoEstatisticas = {
  vitoria: 1,
  empate: 0.5,
  derrota: -0.5,
  gol: 0.5,
  golContra: -2,
  assistencia: 0.5,
  cleanSheet: 0.5,
};

export const OPCOES_PONTUACAO = {
  vitoria: [0.5, 1, 1.5, 2, 2.5],
  empate: [-1, -0.5, 0, 0.5, 1],
  derrota: [-2, -1.5, -1, -0.5, 0],
  golContra: [-1, -2, -3, -4, -5],
  geral: [0.5, 1, 1.5, 2, 2.5],
};

const CAMPOS_REGRAS = {
  vitoria: 'pontuacao_vitoria',
  empate: 'pontuacao_empate',
  derrota: 'pontuacao_derrota',
  gol: 'pontuacao_gol',
  golContra: 'pontuacao_gol_contra',
  assistencia: 'pontuacao_assistencia',
  cleanSheet: 'pontuacao_sem_sofrer_gol',
} as const;

const toNumber = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const normalizarPontuacaoEstatisticas = (raw: Partial<PontuacaoEstatisticas> | null | undefined): PontuacaoEstatisticas => ({
  vitoria: toNumber(raw?.vitoria, PONTUACAO_PADRAO.vitoria),
  empate: toNumber(raw?.empate, PONTUACAO_PADRAO.empate),
  derrota: toNumber(raw?.derrota, PONTUACAO_PADRAO.derrota),
  gol: toNumber(raw?.gol, PONTUACAO_PADRAO.gol),
  golContra: toNumber(raw?.golContra, PONTUACAO_PADRAO.golContra),
  assistencia: toNumber(raw?.assistencia, PONTUACAO_PADRAO.assistencia),
  cleanSheet: toNumber(raw?.cleanSheet, PONTUACAO_PADRAO.cleanSheet),
});

export const getPontuacaoStorageKey = (peladaId: string): string => `pontuacao_estatisticas_${peladaId}`;

export const carregarPontuacaoEstatisticasLocal = (peladaId: string): PontuacaoEstatisticas => {
  const raw = localStorage.getItem(getPontuacaoStorageKey(peladaId));
  if (!raw) return PONTUACAO_PADRAO;

  try {
    return normalizarPontuacaoEstatisticas(JSON.parse(raw));
  } catch {
    return PONTUACAO_PADRAO;
  }
};

export const salvarPontuacaoEstatisticasLocal = (peladaId: string, pontuacao: PontuacaoEstatisticas): void => {
  localStorage.setItem(getPontuacaoStorageKey(peladaId), JSON.stringify(normalizarPontuacaoEstatisticas(pontuacao)));
};

export const extrairPontuacaoDeRegras = (regras: Record<string, unknown> | null | undefined): PontuacaoEstatisticas => {
  return normalizarPontuacaoEstatisticas({
    vitoria: regras?.[CAMPOS_REGRAS.vitoria] as number | undefined,
    empate: regras?.[CAMPOS_REGRAS.empate] as number | undefined,
    derrota: regras?.[CAMPOS_REGRAS.derrota] as number | undefined,
    gol: regras?.[CAMPOS_REGRAS.gol] as number | undefined,
    golContra: regras?.[CAMPOS_REGRAS.golContra] as number | undefined,
    assistencia: regras?.[CAMPOS_REGRAS.assistencia] as number | undefined,
    cleanSheet: regras?.[CAMPOS_REGRAS.cleanSheet] as number | undefined,
  });
};

export const montarCamposPontuacaoParaRegras = (pontuacao: PontuacaoEstatisticas): Record<string, number> => {
  const normalized = normalizarPontuacaoEstatisticas(pontuacao);
  return {
    [CAMPOS_REGRAS.vitoria]: normalized.vitoria,
    [CAMPOS_REGRAS.empate]: normalized.empate,
    [CAMPOS_REGRAS.derrota]: normalized.derrota,
    [CAMPOS_REGRAS.gol]: normalized.gol,
    [CAMPOS_REGRAS.golContra]: normalized.golContra,
    [CAMPOS_REGRAS.assistencia]: normalized.assistencia,
    [CAMPOS_REGRAS.cleanSheet]: normalized.cleanSheet,
  };
};

export const carregarPontuacaoEstatisticas = async (peladaId: string): Promise<PontuacaoEstatisticas> => {
  const local = carregarPontuacaoEstatisticasLocal(peladaId);

  try {
    const { data, error } = await supabase
      .from('regras')
      .select('*')
      .eq('pelada_id', peladaId)
      .maybeSingle();

    if (error || !data) return local;

    const hasAnyColumn = [
      'pontuacao_vitoria',
      'pontuacao_empate',
      'pontuacao_derrota',
      'pontuacao_gol',
      'pontuacao_gol_contra',
      'pontuacao_assistencia',
      'pontuacao_sem_sofrer_gol',
    ].some((col) => data[col] !== null && data[col] !== undefined);

    const resolved = hasAnyColumn ? extrairPontuacaoDeRegras(data) : local;
    salvarPontuacaoEstatisticasLocal(peladaId, resolved);
    return resolved;
  } catch {
    return local;
  }
};

export const calcularPontosEstatisticas = (
  stats: {
    vitorias: number;
    derrotas: number;
    empates: number;
    gols: number;
    golsContra?: number;
    assistencias: number;
    cleanSheets: number;
  },
  pontuacao: PontuacaoEstatisticas
): number => {
  const golsContra = stats.golsContra || 0;
  return (
    stats.vitorias * pontuacao.vitoria +
    stats.empates * pontuacao.empate +
    stats.derrotas * pontuacao.derrota +
    stats.gols * pontuacao.gol +
    golsContra * pontuacao.golContra +
    stats.assistencias * pontuacao.assistencia +
    stats.cleanSheets * pontuacao.cleanSheet
  );
};
