import { EquipeTorneioLocal, PartidaTorneioLocal, SyncStatus } from './torneioLocalService';

/**
 * Gera um UUID v4 simples
 */
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export type MetodoChaveamento = 'aleatorio' | 'cruzamento_grupos' | 'melhor_vs_pior' | 'classificacao_geral';

/**
 * Gera partidas para fase inicial (mata-mata) usando diferentes métodos de chaveamento
 */
export function gerarChaveamento(
  equipes: EquipeTorneioLocal[],
  torneioId: string,
  peladaId: string,
  metodo: MetodoChaveamento
): PartidaTorneioLocal[] {
  if (equipes.length < 2) {
    throw new Error('É necessário no mínimo 2 equipes para gerar chaveamento');
  }

  let pareamento: [EquipeTorneioLocal, EquipeTorneioLocal][] = [];

  switch (metodo) {
    case 'aleatorio':
      pareamento = gerarAleatorioPuro(equipes);
      break;
    case 'cruzamento_grupos':
      pareamento = gerarCruzamentoGrupos(equipes);
      break;
    case 'melhor_vs_pior':
      pareamento = gerarMelhorVsPior(equipes);
      break;
    case 'classificacao_geral':
      pareamento = gerarClassificacaoGeral(equipes);
      break;
  }

  // Converter pareamentos em partidas
  return pareamento.map((par) => ({
    id: generateId(),
    torneio_id: torneioId,
    pelada_id: peladaId,
    fase: 'mata_mata_inicial',
    rodada: 1,
    equipe_a_id: par[0].id,
    equipe_b_id: par[1].id,
    gols_a: 0,
    gols_b: 0,
    status: 'agendada',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    sync_status: 'local_only' as SyncStatus,
    version: 1,
  }));
}

/**
 * 1. SORTEIO - Embaralha as equipes completamente (aleatório puro)
 */
function gerarAleatorioPuro(equipes: EquipeTorneioLocal[]): [EquipeTorneioLocal, EquipeTorneioLocal][] {
  const embaralhadas = [...equipes].sort(() => Math.random() - 0.5);
  return agruparEmPares(embaralhadas);
}

/**
 * 2. CRUZAMENTO DE GRUPOS - 1º A vs 2º B, 1º B vs 2º A
 * As equipes são divididas em dois grupos pela ordem de cadastro.
 * Primeira metade = Grupo A, segunda metade = Grupo B.
 */
function gerarCruzamentoGrupos(equipes: EquipeTorneioLocal[]): [EquipeTorneioLocal, EquipeTorneioLocal][] {
  const metade = Math.floor(equipes.length / 2);
  const grupoA = equipes.slice(0, metade);
  const grupoB = equipes.slice(metade);

  const pareamento: [EquipeTorneioLocal, EquipeTorneioLocal][] = [];

  for (let i = 0; i < Math.min(grupoA.length, grupoB.length); i++) {
    // 1º A vs 2º B (posição i do A vs posição i+1 do B)
    // 1º B vs 2º A (posição i do B vs posição i+1 do A)
    const proxA = grupoA[i + 1] || grupoA[i];
    const proxB = grupoB[i + 1] || grupoB[i];

    pareamento.push([grupoA[i], proxB]);
    if (grupoB[i] && proxA !== grupoA[i]) {
      pareamento.push([grupoB[i], proxA]);
    }
  }

  // Fallback: se não formou pares suficientes, completa em sequência cruzada
  if (pareamento.length < equipes.length / 2) {
    return gerarCruzadoPadrao(grupoA, grupoB);
  }

  return pareamento;
}

/**
 * Cruzamento padrão: 1º A vs 2º B, 2º A vs 1º B, 3º A vs 4º B, etc.
 */
function gerarCruzadoPadrao(
  grupoA: EquipeTorneioLocal[],
  grupoB: EquipeTorneioLocal[]
): [EquipeTorneioLocal, EquipeTorneioLocal][] {
  const pareamento: [EquipeTorneioLocal, EquipeTorneioLocal][] = [];
  const n = Math.min(grupoA.length, grupoB.length);

  for (let i = 0; i < n; i++) {
    // posição i do A cruza com posição espelhada do B
    const jB = n - 1 - i;
    pareamento.push([grupoA[i], grupoB[jB]]);
  }

  return pareamento;
}

/**
 * 3. MELHOR VS PIOR - 1º vs último, 2º vs penúltimo, etc.
 * Classificação geral ordenada, extremos se enfrentam.
 */
function gerarMelhorVsPior(equipes: EquipeTorneioLocal[]): [EquipeTorneioLocal, EquipeTorneioLocal][] {
  const ordenadas = ordenarEquipes(equipes);
  const pareamento: [EquipeTorneioLocal, EquipeTorneioLocal][] = [];

  for (let i = 0; i < Math.floor(ordenadas.length / 2); i++) {
    pareamento.push([ordenadas[i], ordenadas[ordenadas.length - 1 - i]]);
  }

  return pareamento;
}

/**
 * 4. CLASSIFICAÇÃO GERAL - 1º vs 2º, 3º vs 4º, etc.
 * Sequencial na classificação geral: os melhores se enfrentam entre si.
 */
function gerarClassificacaoGeral(equipes: EquipeTorneioLocal[]): [EquipeTorneioLocal, EquipeTorneioLocal][] {
  const ordenadas = ordenarEquipes(equipes);
  return agruparEmPares(ordenadas);
}

/**
 * Ordena equipes por critérios de desempate (pontos > saldo > gols_pro)
 */
function ordenarEquipes(equipes: EquipeTorneioLocal[]): EquipeTorneioLocal[] {
  return [...equipes].sort((a, b) => {
    // Pontos
    if (a.pontos !== b.pontos) return b.pontos - a.pontos;
    // Saldo de gols
    if (a.saldo_gols !== b.saldo_gols) return b.saldo_gols - a.saldo_gols;
    // Gols pró
    if (a.gols_pro !== b.gols_pro) return b.gols_pro - a.gols_pro;
    // Ordem de criação (id)
    return a.id.localeCompare(b.id);
  });
}

/**
 * Agrupa equipes em pares sequenciais: (1,2), (3,4), (5,6)...
 */
function agruparEmPares(equipes: EquipeTorneioLocal[]): [EquipeTorneioLocal, EquipeTorneioLocal][] {
  const pares: [EquipeTorneioLocal, EquipeTorneioLocal][] = [];
  for (let i = 0; i < equipes.length; i += 2) {
    if (equipes[i + 1]) {
      pares.push([equipes[i], equipes[i + 1]]);
    }
  }
  return pares;
}

/**
 * Retorna label amigável para o método
 */
export function obterLabelMetodo(metodo: MetodoChaveamento): string {
  const labels: Record<MetodoChaveamento, string> = {
    aleatorio: 'Sorteio',
    cruzamento_grupos: 'Cruzamento de Grupos',
    melhor_vs_pior: 'Melhor vs Pior',
    classificacao_geral: 'Classificação Geral',
  };
  return labels[metodo];
}

/**
 * Retorna descrição do método
 */
export function obterDescricaoMetodo(metodo: MetodoChaveamento): string {
  const descricoes: Record<MetodoChaveamento, string> = {
    aleatorio: 'Totalmente aleatório — sorteio puro',
    cruzamento_grupos: '1º A vs 2º B, 1º B vs 2º A — cruzamento entre grupos',
    melhor_vs_pior: '1º vs último, 2º vs penúltimo — tradicional Copa do Mundo',
    classificacao_geral: '1º vs 2º, 3º vs 4º — sequencial na classificação geral',
  };
  return descricoes[metodo];
}
