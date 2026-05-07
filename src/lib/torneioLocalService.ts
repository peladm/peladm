import { buscar_pelada_id } from './credenciais';

export type SyncStatus = 'local_only' | 'pending_sync' | 'synced' | 'error';
export type ModalidadeCompeticao = 'torneio' | 'campeonato';
export type FormatoCompeticao =
  | 'grupos_mata_mata'
  | 'mata_mata'
  | 'pontos_corridos'
  | 'pontos_corridos_mata_mata';

export interface TorneioLocal {
  id: string;
  pelada_id: string;
  nome: string;
  modalidade: ModalidadeCompeticao;
  formato: FormatoCompeticao;
  status: 'rascunho' | 'ativo' | 'finalizado' | 'cancelado' | 'encerrado';
  data_inicio: string;
  data_fim?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  sync_status: SyncStatus;
  version: number;
}

export interface EquipeTorneioLocal {
  id: string;
  torneio_id: string;
  pelada_id: string;
  nome: string;
  sigla?: string | null;
  cor?: string | null;
  jogadores?: ParticipanteTorneioLocal[];
  pontos: number;
  saldo_gols: number;
  gols_pro: number;
  gols_contra: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  sync_status: SyncStatus;
  version: number;
}

export interface CobrancaPenaltiLocal {
  equipe: 'A' | 'B';
  jogadorId: string;
  jogadorNome: string;
  resultado: 'gol' | 'erro';
}

export interface PartidaTorneioLocal {
  id: string;
  torneio_id: string;
  pelada_id: string;
  fase: string;
  rodada: number;
  equipe_a_id: string;
  equipe_b_id: string;
  gols_a: number;
  gols_b: number;
  status: 'agendada' | 'em_andamento' | 'finalizada' | 'cancelada' | 'aguardando_desempate';
  proximo_desempate?: 'prorrogacao' | 'penaltis';
  data_partida?: string | null;
  vencedor_id?: string | null;
  penaltis_kicks?: CobrancaPenaltiLocal[];
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  sync_status: SyncStatus;
  version: number;
}

export interface ResumoTorneioAtivoLocal {
  torneio: TorneioLocal;
  equipes: number;
  partidas: number;
}

export interface SetupCompeticaoLocal {
  modalidade: ModalidadeCompeticao;
  formato: FormatoCompeticao;
  nome_sugerido: string;
  created_at: string;
}

export interface RegrasCompeticaoLocal {
  torneio_id: string;
  pelada_id: string;
  modalidade: ModalidadeCompeticao;
  formato: FormatoCompeticao;
  jogadores_por_time: number;
  quantidade_times: number;
  temporada_competicao?: string;
  vinculado_torneio_nome?: string;
  vinculado_torneio_slug?: string;
  incluir_goleiro: boolean;
  tempo_partida: number;
  tempos_partida?: 1 | 2;
  tempo_prorrogacao?: number;
  tempos_prorrogacao?: 1 | 2;
  pontos_vitoria: number;
  pontos_empate: number;
  pontos_derrota: number;
  criterio_desempate: string;
  criterios_desempate: string[];
  ida_e_volta: boolean;
  classificam_por_grupo: number;
  classificam_liga?: number;
  jogos_mata_mata_unicos: boolean;
  final_jogo_unico?: boolean;
  disputa_terceiro_lugar?: 'nao' | 'jogo_unico' | 'ida_e_volta';
  mata_mata_formato?: 'jogo_unico' | 'ida_e_volta';
  final_formato?: 'jogo_unico' | 'ida_e_volta';
  empate_decisao?: 'prorrogacao' | 'penaltis';
  metodo_chaveamento?: string;
  quantidade_grupos?: number;
  repescagem?: boolean;
  registrar_cartoes?: boolean;
  cartoes_amarelos?: boolean;
  cartoes_vermelhos?: boolean;
  cartoes_azuis?: boolean;
  acumulacao_cartoes_amarelos?: 0 | 2 | 3;
  acumulacao_cartoes_azuis?: 0 | 2 | 3;
  reset_cartoes_para_eliminatorias?: boolean;
  efeito_cartao_vermelho?: 'expulsao' | 'suspensao' | 'substituicao';
  tempo_cartao_azul?: number;
  expulsao_dois_cartoes_azuis?: boolean;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
  version: number;
}

export interface ParticipanteTorneioLocal {
  id: string;
  torneio_id: string;
  pelada_id: string;
  jogador_id: string;
  nome: string;
  nivel: number;
  status: 'confirmado' | 'reserva';
  origem: 'cadastro' | 'avulso';
  posicao?: 'goleiro' | 'linha'; // Identifica posição do jogador
  goleiroSlot?: boolean; // Identifica se é goleiro (compatibilidade)
  created_at: string;
}

export interface RegistroCartaoJogador {
  torneio_id: string;
  jogador_id: string;
  cartoesAmarelos: number;
  cartoesVermelhos: number;
  cartoesAzuis: number;
  ultimoCartaoVermelho?: string; // ISO timestamp da partida do último cartão vermelho
  suspensao_automatica: number; // Contador de suspensões automáticas baseado em acumulação
}

interface TorneioKeys {
  torneioAtivo: string;
  setup: string;
  regras: (torneioId: string) => string;
  equipes: (torneioId: string) => string;
  partidas: (torneioId: string) => string;
  classificacao: (torneioId: string) => string;
  participantes: (torneioId: string) => string;
  registrosCartoes: (torneioId: string) => string;
}

const LEGACY_TORNEIO_ATIVO_KEY = 'torneio_ativo';
const STORAGE_VERSION = 1;

const nowIso = () => new Date().toISOString();

const safeJsonParse = <T>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const gerarIdLocal = (prefix: string) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const getPeladaScope = () => buscar_pelada_id() || 'default';

const getKeys = (): TorneioKeys => {
  const peladaId = getPeladaScope();

  return {
    torneioAtivo: `torneio_ativo_${peladaId}`,
    setup: `setup_competicao_${peladaId}`,
    regras: (torneioId: string) => `regras_competicao_${peladaId}_${torneioId}`,
    equipes: (torneioId: string) => `equipes_torneio_${peladaId}_${torneioId}`,
    partidas: (torneioId: string) => `partidas_torneio_${peladaId}_${torneioId}`,
    classificacao: (torneioId: string) => `classificacao_torneio_${peladaId}_${torneioId}`,
    participantes: (torneioId: string) => `participantes_torneio_${peladaId}_${torneioId}`,
    registrosCartoes: (torneioId: string) => `registros_cartoes_${peladaId}_${torneioId}`,
  };
};

const marcarPendenciaSync = <T extends { sync_status: SyncStatus; updated_at: string }>(item: T): T => {
  return {
    ...item,
    sync_status: 'pending_sync',
    updated_at: nowIso(),
  };
};

function migrarLegacySeNecessario(): void {
  const keys = getKeys();
  const scoped = localStorage.getItem(keys.torneioAtivo);

  if (scoped) return;

  const legacy = localStorage.getItem(LEGACY_TORNEIO_ATIVO_KEY);
  if (!legacy) return;

  const torneio = safeJsonParse<TorneioLocal | null>(legacy, null);
  if (!torneio) return;

  localStorage.setItem(keys.torneioAtivo, legacy);
}

export function obterTorneioAtivoLocal(): TorneioLocal | null {
  migrarLegacySeNecessario();

  const keys = getKeys();
  const torneio = safeJsonParse<TorneioLocal | null>(localStorage.getItem(keys.torneioAtivo), null);

  if (!torneio) return null;
  if (torneio.status !== 'ativo') return null;

  return torneio;
}

/** Retorna o torneio independentemente de ser rascunho ou ativo (para uso no fluxo de setup). */
export function obterTorneioRascunhoOuAtivoLocal(): TorneioLocal | null {
  migrarLegacySeNecessario();

  const keys = getKeys();
  const torneio = safeJsonParse<TorneioLocal | null>(localStorage.getItem(keys.torneioAtivo), null);

  if (!torneio) return null;
  if (torneio.status !== 'rascunho' && torneio.status !== 'ativo') return null;

  return torneio;
}

/** Muda o status do torneio de 'rascunho' para 'ativo'. */
export function ativarTorneioLocal(torneioId: string): void {
  const keys = getKeys();
  const torneio = safeJsonParse<TorneioLocal | null>(localStorage.getItem(keys.torneioAtivo), null);
  if (!torneio || torneio.id !== torneioId) return;
  const atualizado: TorneioLocal = { ...torneio, status: 'ativo', updated_at: nowIso() };
  localStorage.setItem(keys.torneioAtivo, JSON.stringify(atualizado));
}

export function obterEquipesTorneioLocal(torneioId: string): EquipeTorneioLocal[] {
  const keys = getKeys();

  const scoped = safeJsonParse<EquipeTorneioLocal[]>(localStorage.getItem(keys.equipes(torneioId)), []);
  if (scoped.length > 0) return scoped;

  return safeJsonParse<EquipeTorneioLocal[]>(localStorage.getItem(`equipes_torneio_${torneioId}`), []);
}

export function obterPartidasTorneioLocal(torneioId: string): PartidaTorneioLocal[] {
  const keys = getKeys();

  const scoped = safeJsonParse<PartidaTorneioLocal[]>(localStorage.getItem(keys.partidas(torneioId)), []);
  if (scoped.length > 0) return scoped;

  return safeJsonParse<PartidaTorneioLocal[]>(localStorage.getItem(`partidas_torneio_${torneioId}`), []);
}

export function obterResumoTorneioAtivoLocal(): ResumoTorneioAtivoLocal | null {
  const torneio = obterTorneioAtivoLocal();
  if (!torneio) return null;

  const equipes = obterEquipesTorneioLocal(torneio.id);
  const partidas = obterPartidasTorneioLocal(torneio.id);

  return {
    torneio,
    equipes: equipes.filter((e) => !e.deleted_at).length,
    partidas: partidas.filter((p) => !p.deleted_at).length,
  };
}

export function salvarSetupCompeticaoLocal(setup: SetupCompeticaoLocal): void {
  const keys = getKeys();
  localStorage.setItem(keys.setup, JSON.stringify(setup));
}

export function obterSetupCompeticaoLocal(): SetupCompeticaoLocal | null {
  const keys = getKeys();
  return safeJsonParse<SetupCompeticaoLocal | null>(localStorage.getItem(keys.setup), null);
}

export function limparSetupCompeticaoLocal(): void {
  const keys = getKeys();
  localStorage.removeItem(keys.setup);
}

export function criarTorneioAtivoLocal(
  nome = 'Torneio Local',
  formato: FormatoCompeticao = 'grupos_mata_mata',
  modalidade: ModalidadeCompeticao = 'torneio'
): TorneioLocal {
  const peladaId = getPeladaScope();
  const keys = getKeys();
  const timestamp = nowIso();

  const torneio: TorneioLocal = {
    id: gerarIdLocal('torneio'),
    pelada_id: peladaId,
    nome,
    modalidade,
    formato,
    status: 'rascunho',
    data_inicio: timestamp,
    data_fim: null,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
    sync_status: 'local_only',
    version: STORAGE_VERSION,
  };

  localStorage.setItem(keys.torneioAtivo, JSON.stringify(torneio));
  return torneio;
}

export function iniciarCompeticaoLocalAPartirSetup(
  setup: SetupCompeticaoLocal,
  nomeFinal?: string
): TorneioLocal {
  const nome = (nomeFinal || setup.nome_sugerido || '').trim() || 'Competicao Local';
  const torneio = criarTorneioAtivoLocal(nome, setup.formato, setup.modalidade);
  limparSetupCompeticaoLocal();
  return torneio;
}

export function salvarEquipesTorneioLocal(torneioId: string, equipes: EquipeTorneioLocal[]): void {
  const keys = getKeys();
  const payload = equipes.map((equipe) => marcarPendenciaSync(equipe));
  localStorage.setItem(keys.equipes(torneioId), JSON.stringify(payload));
}

export function salvarPartidasTorneioLocal(torneioId: string, partidas: PartidaTorneioLocal[]): void {
  const keys = getKeys();
  const payload = partidas.map((partida) => marcarPendenciaSync(partida));
  localStorage.setItem(keys.partidas(torneioId), JSON.stringify(payload));
}

export function salvarRegrasCompeticaoLocal(regras: RegrasCompeticaoLocal): void {
  const keys = getKeys();
  const payload = marcarPendenciaSync(regras);
  localStorage.setItem(keys.regras(regras.torneio_id), JSON.stringify(payload));
}

export function obterRegrasCompeticaoLocal(torneioId: string): RegrasCompeticaoLocal | null {
  const keys = getKeys();
  return safeJsonParse<RegrasCompeticaoLocal | null>(localStorage.getItem(keys.regras(torneioId)), null);
}

export function limparTorneioLocal(torneioId: string): void {
  const keys = getKeys();

  localStorage.removeItem(keys.torneioAtivo);
  localStorage.removeItem(keys.setup);
  localStorage.removeItem(keys.regras(torneioId));
  localStorage.removeItem(keys.equipes(torneioId));
  localStorage.removeItem(keys.partidas(torneioId));
  localStorage.removeItem(keys.classificacao(torneioId));
  localStorage.removeItem(keys.participantes(torneioId));

  // Compatibilidade com chaves antigas usadas na fase de prototipo.
  localStorage.removeItem(LEGACY_TORNEIO_ATIVO_KEY);
  localStorage.removeItem(`equipes_torneio_${torneioId}`);
  localStorage.removeItem(`partidas_torneio_${torneioId}`);
  localStorage.removeItem(`classificacao_torneio_${torneioId}`);
}

export function salvarParticipantesTorneioLocal(torneioId: string, participantes: ParticipanteTorneioLocal[]): void {
  const keys = getKeys();
  localStorage.setItem(keys.participantes(torneioId), JSON.stringify(participantes));
}

export function obterParticipantesTorneioLocal(torneioId: string): ParticipanteTorneioLocal[] {
  const keys = getKeys();
  return safeJsonParse<ParticipanteTorneioLocal[]>(localStorage.getItem(keys.participantes(torneioId)), []);
}

// ─── Jogadores por equipe (assignments do sorteio) ────────────────────────────

/** Map de equipeId → lista de jogadores no time */
export type JogadoresEquipeMap = Record<string, ParticipanteTorneioLocal[]>;

export function salvarJogadoresEquipesLocal(torneioId: string, mapa: JogadoresEquipeMap): void {
  const pid = getPeladaScope();
  localStorage.setItem(`jogadores_equipes_${pid}_${torneioId}`, JSON.stringify(mapa));
}

export function obterJogadoresEquipesLocal(torneioId: string): JogadoresEquipeMap {
  const pid = getPeladaScope();
  return safeJsonParse<JogadoresEquipeMap>(
    localStorage.getItem(`jogadores_equipes_${pid}_${torneioId}`),
    {},
  );
}

// ─── Registros de cartões e suspensões ───────────────────────────────────────

export function salvarRegistrosCartoesLocal(torneioId: string, registros: RegistroCartaoJogador[]): void {
  const keys = getKeys();
  localStorage.setItem(keys.registrosCartoes(torneioId), JSON.stringify(registros));
}

export function obterRegistrosCartoesLocal(torneioId: string): RegistroCartaoJogador[] {
  const keys = getKeys();
  return safeJsonParse<RegistroCartaoJogador[]>(localStorage.getItem(keys.registrosCartoes(torneioId)), []);
}

export function obterRegistroCartaoJogador(torneioId: string, jogadorId: string): RegistroCartaoJogador | null {
  const registros = obterRegistrosCartoesLocal(torneioId);
  return registros.find(r => r.jogador_id === jogadorId) || null;
}

/**
 * Obtém dados completos de cartões e suspensões para um jogador específico
 */
export function obterStatusCartaoJogador(torneioId: string, jogadorId: string): {
  cartoesAmarelos: number;
  cartoesVermelhos: number;
  cartoesAzuis: number;
  ultimoCartaoVermelho?: string;
  suspensaoPendente: boolean;
  suspensoProximaPartida: boolean;
  motivoSuspensao?: 'acumulacao_amarelos' | 'acumulacao_azuis' | 'cartao_vermelho';
} {
  const registro = obterRegistroCartaoJogador(torneioId, jogadorId);
  const regras = obterRegrasCompeticaoLocal(torneioId);
  const registros = obterRegistrosCartoesLocal(torneioId);
  const suspensos = obterJogadoresSuspensosNaPartida(registros, regras);

  return {
    cartoesAmarelos: registro?.cartoesAmarelos || 0,
    cartoesVermelhos: registro?.cartoesVermelhos || 0,
    cartoesAzuis: registro?.cartoesAzuis || 0,
    ultimoCartaoVermelho: registro?.ultimoCartaoVermelho,
    suspensaoPendente: false, // Simplificado - não usado atualmente
    suspensoProximaPartida: suspensos.has(jogadorId),
    motivoSuspensao: registro?.ultimoCartaoVermelho ? 'cartao_vermelho' : undefined,
  };
}


// ─── Lógica de processamento de cartões ──────────────────────────────────────

export function procesarCartoesPartidaEncerrada(
  torneioId: string,
  partidaId: string,
  eventos: EventoPartidaTorneio[],
  regras: RegrasCompeticaoLocal | null,
): void {
  // Verificar se registro de cartões está ativo no torneio
  if (!regras?.registrar_cartoes) return;

  const registros = obterRegistrosCartoesLocal(torneioId);
  const cartoesPartida = eventos.filter(e => e.tipo === 'cartao');

  // Primeiro processamento: contar cartões por jogador nesta partida
  const cartoesPorJogador: Record<string, { amarelos: number; vermelhos: number }> = {};
  cartoesPartida.forEach(cartao => {
    if (!cartoesPorJogador[cartao.jogadorId]) {
      cartoesPorJogador[cartao.jogadorId] = { amarelos: 0, vermelhos: 0 };
    }
    if (cartao.cartaoTipo === 'amarelo') {
      cartoesPorJogador[cartao.jogadorId].amarelos++;
    } else if (cartao.cartaoTipo === 'vermelho') {
      cartoesPorJogador[cartao.jogadorId].vermelhos++;
    }
  });

  cartoesPartida.forEach(cartao => {
    let registro = registros.find(r => r.jogador_id === cartao.jogadorId);
    if (!registro) {
      registro = {
        torneio_id: torneioId,
        jogador_id: cartao.jogadorId,
        cartoesAmarelos: 0,
        cartoesVermelhos: 0,
        cartoesAzuis: 0,
        suspensao_automatica: 0,
      };
      registros.push(registro);
    }

    // Verificar se o tipo de cartão está habilitado nas regras
    if (cartao.cartaoTipo === 'amarelo' && regras.cartoes_amarelos) {
      registro.cartoesAmarelos++;
      
      // Se acumulação de amarelos está habilitada, incrementa suspensao_automatica
      if (regras.acumulacao_cartoes_amarelos && regras.acumulacao_cartoes_amarelos > 0) {
        registro.suspensao_automatica++;
      }
      
      // Verificar se levou 2 amarelos nesta partida = vermelho automático
      const amarelosNestaPartida = cartoesPorJogador[cartao.jogadorId]?.amarelos || 0;
      if (amarelosNestaPartida >= 2) {
        // Conta como +1 vermelho na estatística, marca último vermelho para suspensão, zera suspensao_automatica
        registro.cartoesVermelhos++;
        registro.suspensao_automatica = 0;
        registro.ultimoCartaoVermelho = new Date().toISOString();
      }
    } else if (cartao.cartaoTipo === 'vermelho' && regras.cartoes_vermelhos) {
      // Cartão vermelho direto: +1 vermelho na estatística, zera suspensao_automatica, marca último vermelho
      registro.cartoesVermelhos++;
      registro.suspensao_automatica = 0;
      registro.ultimoCartaoVermelho = new Date().toISOString();
    } else if (cartao.cartaoTipo === 'azul' && regras.cartoes_azuis) {
      registro.cartoesAzuis++;
      
      // Se acumulação de azuis está habilitada, incrementa suspensao_automatica
      if (regras.acumulacao_cartoes_azuis && regras.acumulacao_cartoes_azuis > 0) {
        registro.suspensao_automatica++;
      }
    }
  });

  salvarRegistrosCartoesLocal(torneioId, registros);
}


/**
 * Verifica se um jogador está suspenso ao iniciar uma partida
 * baseado no contador de suspensao_automatica vs limite definido nas regras
 */
export function obterJogadoresSuspensosNaPartida(
  registros: RegistroCartaoJogador[],
  regras: RegrasCompeticaoLocal | null,
): Set<string> {
  const suspensos = new Set<string>();
  
  if (!regras?.registrar_cartoes) return suspensos;
  
  registros.forEach(registro => {
    // Se teve um vermelho (direto ou dois amarelos na mesma partida), é suspensão automática
    if (registro.ultimoCartaoVermelho) {
      suspensos.add(registro.jogador_id);
      return;
    }

    // Verifica se atingiu limite de amarelos
    if (regras.acumulacao_cartoes_amarelos && regras.acumulacao_cartoes_amarelos > 0) {
      if (registro.suspensao_automatica >= regras.acumulacao_cartoes_amarelos) {
        suspensos.add(registro.jogador_id);
        return;
      }
    }
    
    // Verifica se atingiu limite de azuis
    if (regras.acumulacao_cartoes_azuis && regras.acumulacao_cartoes_azuis > 0) {
      if (registro.suspensao_automatica >= regras.acumulacao_cartoes_azuis) {
        suspensos.add(registro.jogador_id);
      }
    }
  });
  
  return suspensos;
}

/**
 * Reseta suspensao_automatica ao finalizar uma partida
 * (jogador cumpriu sua suspensão)
 */
export function resetarSuspensaoAposFimPartida(
  torneioId: string,
): void {
  const registros = obterRegistrosCartoesLocal(torneioId);
  const regras = obterRegrasCompeticaoLocal(torneioId);

  // Zera apenas o contador de suspensão automática de quem atingiu o limite configurado
  registros.forEach(r => {
    let atingiuLimite = false;
    let teveVermelho = false;

    if (regras?.acumulacao_cartoes_amarelos && regras.acumulacao_cartoes_amarelos > 0) {
      if (r.suspensao_automatica >= regras.acumulacao_cartoes_amarelos) {
        atingiuLimite = true;
      }
    }

    if (regras?.acumulacao_cartoes_azuis && regras.acumulacao_cartoes_azuis > 0) {
      if (r.suspensao_automatica >= regras.acumulacao_cartoes_azuis) {
        atingiuLimite = true;
      }
    }

    // Verifica se teve vermelho (direto ou por 2 amarelos)
    if (r.ultimoCartaoVermelho) {
      teveVermelho = true;
    }

    if (atingiuLimite || teveVermelho) {
      r.suspensao_automatica = 0;
      r.ultimoCartaoVermelho = undefined;
    }
  });
  
  salvarRegistrosCartoesLocal(torneioId, registros);
}

/**
 * Reseta cartões ao mudar de fase (de LIGA para MATA-MATA, por exemplo)
 * Apenas jogadores que NÃO atingiram o limite de suspensão terão os cartões zerados
 */
export function resetarCartoesAoMudarDeFase(
  torneioId: string,
  regras: RegrasCompeticaoLocal | null,
): void {
  if (!regras?.registrar_cartoes || !regras?.reset_cartoes_para_eliminatorias) return;
  
  const registros = obterRegistrosCartoesLocal(torneioId);
  
  registros.forEach(r => {
    // Só zera se NÃO atingiu o limite
    let atingiuLimite = false;
    
    if (regras.acumulacao_cartoes_amarelos && regras.acumulacao_cartoes_amarelos > 0) {
      if (r.suspensao_automatica >= regras.acumulacao_cartoes_amarelos) {
        atingiuLimite = true;
      }
    }
    
    if (regras.acumulacao_cartoes_azuis && regras.acumulacao_cartoes_azuis > 0) {
      if (r.suspensao_automatica >= regras.acumulacao_cartoes_azuis) {
        atingiuLimite = true;
      }
    }
    
    // Se não atingiu limite, zera tudo
    if (!atingiuLimite) {
      r.cartoesAmarelos = 0;
      r.cartoesVermelhos = 0;
      r.cartoesAzuis = 0;
      r.suspensao_automatica = 0;
      r.ultimoCartaoVermelho = undefined;
    }
  });
  
  salvarRegistrosCartoesLocal(torneioId, registros);
}

/**
 * @deprecated Use obterJogadoresSuspensosNaPartida em vez disso
 */
export function marcarSuspensaoPorPartida(
  torneioId: string,
  partidaId: string,
  regras: RegrasCompeticaoLocal | null,
  participantes: ParticipanteTorneioLocal[],
): void {
  // Função mantida para compatibilidade, mas não faz nada
  // A suspensão agora é verificada em tempo real via obterJogadoresSuspensosNaPartida
}

/**
 * @deprecated Use resetarSuspensaoAposFimPartida em vez disso
 */
export function removerSuspensaoAposFimPartida(
  torneioId: string,
  partidaId: string,
): void {
  // Função mantida para compatibilidade, mas não faz nada
  // O reset agora é feito ao finalizar a partida
  resetarSuspensaoAposFimPartida(torneioId);
}

/**
 * @deprecated Use resetarCartoesAoMudarDeFase em vez disso
 */


// ─── Partida ativa do torneio ────────────────────────────────────────────────

export interface EventoPartidaTorneio {
  id: string;
  tipo: 'gol' | 'assistencia' | 'cartao';
  jogadorId: string;
  jogadorNome: string;
  equipeId: string;
  timestamp: string;
  golId?: string; // ID do gol ao qual esta assistência pertence
  cartaoTipo?: 'amarelo' | 'vermelho' | 'azul';
}

export interface CartaoAzulAtivo {
  jogadorId: string;
  jogadorNome: string;
  equipeId: string;
  tempoTotalSegundos: number;
  segundosRestantes: number;
  timerRodando: boolean;
  rodandoDesde: number; // Date.now() quando foi iniciado/retomado
}

export interface PartidaAtivaTorneio {
  partidaId: string;
  torneioId: string;
  peladaId: string;
  equipeAId: string;
  equipeBId: string;
  golsA: number;
  golsB: number;
  eventos: EventoPartidaTorneio[];
  iniciadaEm: string;
  segundos?: number;
  timerRodando?: boolean;
  rodandoDesde?: number; // Date.now() quando o timer foi ligado
  isProrrogacao?: boolean;
  cartoesAzuisAtivos?: CartaoAzulAtivo[]; // timers de cartões azuis ativos
}

export function salvarPartidaAtivaTorneio(partida: PartidaAtivaTorneio): void {
  const pid = getPeladaScope();
  localStorage.setItem(`partida_ativa_torneio_${pid}`, JSON.stringify(partida));
}

export function obterPartidaAtivaTorneio(): PartidaAtivaTorneio | null {
  const pid = getPeladaScope();
  return safeJsonParse<PartidaAtivaTorneio | null>(
    localStorage.getItem(`partida_ativa_torneio_${pid}`),
    null,
  );
}

export function limparPartidaAtivaTorneio(): void {
  const pid = getPeladaScope();
  localStorage.removeItem(`partida_ativa_torneio_${pid}`);
}

// ─── Estatísticas de jogadores do torneio ─────────────────────────────────────

export interface EstatisticaJogadorTorneio {
  jogadorId: string;
  nome: string;
  equipeId: string;
  equipeNome: string;
  gols: number;
  assistencias: number;
  golsSofridos?: number; // Para goleiros
  jogos?: number; // Número de partidas participadas
}

export function salvarEstatisticasTorneio(
  torneioId: string,
  stats: EstatisticaJogadorTorneio[],
): void {
  const pid = getPeladaScope();
  localStorage.setItem(`stats_torneio_${pid}_${torneioId}`, JSON.stringify(stats));
}

export function obterEstatisticasTorneio(torneioId: string): EstatisticaJogadorTorneio[] {
  const pid = getPeladaScope();
  return safeJsonParse<EstatisticaJogadorTorneio[]>(
    localStorage.getItem(`stats_torneio_${pid}_${torneioId}`),
    [],
  );
}

// ─── Histórico de eventos por partida ─────────────────────────────────────────

export interface HistoricoEventosPartidaTorneio {
  partidaId: string;
  eventos: EventoPartidaTorneio[];
  finalizadaEm: string;
}

export function salvarHistoricoEventosPartida(
  torneioId: string,
  historico: HistoricoEventosPartidaTorneio,
): void {
  const pid = getPeladaScope();
  const key = `historico_partidas_${pid}_${torneioId}`;
  const todos = safeJsonParse<HistoricoEventosPartidaTorneio[]>(localStorage.getItem(key), []);
  const idx = todos.findIndex((h) => h.partidaId === historico.partidaId);
  if (idx >= 0) todos[idx] = historico;
  else todos.push(historico);
  localStorage.setItem(key, JSON.stringify(todos));
}

export function obterTodosHistoricosPartidas(
  torneioId: string,
): HistoricoEventosPartidaTorneio[] {
  const pid = getPeladaScope();
  return safeJsonParse<HistoricoEventosPartidaTorneio[]>(
    localStorage.getItem(`historico_partidas_${pid}_${torneioId}`),
    [],
  );
}

// ── Snapshot (Salvar / Sync local) ──────────────────────────────────────────

export interface SnapshotTorneio {
  versao: number;
  savedAt: string;
  torneio: TorneioLocal;
  regras: RegrasCompeticaoLocal | null;
  equipes: EquipeTorneioLocal[];
  partidas: PartidaTorneioLocal[];
  historicos: HistoricoEventosPartidaTorneio[];
  estatisticas: EstatisticaJogadorTorneio[];
}

export function salvarSnapshotTorneio(torneioId: string): SnapshotTorneio {
  const pid = getPeladaScope();
  const torneio = obterTorneioAtivoLocal()!;
  const snapshot: SnapshotTorneio = {
    versao: STORAGE_VERSION,
    savedAt: nowIso(),
    torneio,
    regras: obterRegrasCompeticaoLocal(torneioId),
    equipes: obterEquipesTorneioLocal(torneioId),
    partidas: obterPartidasTorneioLocal(torneioId),
    historicos: obterTodosHistoricosPartidas(torneioId),
    estatisticas: obterEstatisticasTorneio(torneioId),
  };
  localStorage.setItem(`snapshot_torneio_${pid}_${torneioId}`, JSON.stringify(snapshot));
  return snapshot;
}

export function obterSnapshotTorneio(torneioId: string): SnapshotTorneio | null {
  const pid = getPeladaScope();
  return safeJsonParse<SnapshotTorneio | null>(
    localStorage.getItem(`snapshot_torneio_${pid}_${torneioId}`),
    null,
  );
}

export function encerrarTorneioLocal(torneioId: string): void {
  const keys = getKeys();
  const torneio = safeJsonParse<TorneioLocal | null>(localStorage.getItem(keys.torneioAtivo), null);
  if (!torneio || torneio.id !== torneioId) return;
  const encerrado: TorneioLocal = {
    ...torneio,
    status: 'encerrado' as const,
    data_fim: nowIso(),
    updated_at: nowIso(),
  };
  // Salva snapshot final antes de encerrar
  salvarSnapshotTorneio(torneioId);
  // Marca como encerrado e remove o torneio ativo
  localStorage.setItem(`torneio_encerrado_${getPeladaScope()}_${torneioId}`, JSON.stringify(encerrado));
  localStorage.removeItem(keys.torneioAtivo);
}

export function obterTorneiosEncerrados(): TorneioLocal[] {
  if (typeof localStorage === 'undefined') return [];
  const pid = getPeladaScope();
  const prefix = `torneio_encerrado_${pid}_`;
  const result: TorneioLocal[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      const t = safeJsonParse<TorneioLocal | null>(localStorage.getItem(key), null);
      if (t) result.push(t);
    }
  }
  return result.sort(
    (a, b) => new Date(b.data_fim ?? b.updated_at).getTime() - new Date(a.data_fim ?? a.updated_at).getTime(),
  );
}

