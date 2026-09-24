export type NivelImportanciaTorneio =
	| 'baixa_relevancia'
	| 'intermediario'
	| 'alta_relevancia'
	| 'o_torneio'
	| 'intertemporada_sem_classificacao';

export interface TorneioCatalogo {
	id: string;
	nome: string;
	nivel_importancia: NivelImportanciaTorneio;
	created_at: string;
}

interface TorneioVinculadoLegado {
	id: string;
	nome: string;
	temporada?: string;
}

const storageKey = (peladaId: string) => `torneios_catalogo_${peladaId}`;
const legacyStorageKey = (peladaId: string) => `torneios_vinculados_${peladaId}`;

const ordemImportancia: Record<NivelImportanciaTorneio, number> = {
	o_torneio: 1,
	alta_relevancia: 2,
	intermediario: 3,
	baixa_relevancia: 4,
	intertemporada_sem_classificacao: 5,
};

const gerarId = () => {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const normalizarImportancia = (valor: string): NivelImportanciaTorneio => {
	if (
		valor === 'baixa_relevancia' ||
		valor === 'intermediario' ||
		valor === 'alta_relevancia' ||
		valor === 'o_torneio' ||
		valor === 'intertemporada_sem_classificacao'
	) {
		return valor;
	}

	// Compatibilidade com valores legados.
	if (valor === 'principal') return 'o_torneio';
	if (valor === 'alto') return 'alta_relevancia';
	if (valor === 'medio') return 'intermediario';
	if (valor === 'baixo') return 'baixa_relevancia';

	return 'intermediario';
};

export const listarTorneiosCatalogo = (peladaId: string): TorneioCatalogo[] => {
	if (typeof window === 'undefined') return [];
	try {
		const raw = localStorage.getItem(storageKey(peladaId));
		if (!raw) return [];

		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];

		const normalizados = parsed.map((item: any) => ({
			id: String(item.id || gerarId()),
			nome: String(item.nome || '').trim(),
			nivel_importancia: normalizarImportancia(String(item.nivel_importancia || 'intermediario')),
			created_at: String(item.created_at || new Date().toISOString()),
		})) as TorneioCatalogo[];

		return normalizados
			.filter((item) => item.nome.length > 0)
			.sort((a, b) => {
				const ordem = ordemImportancia[a.nivel_importancia] - ordemImportancia[b.nivel_importancia];
				if (ordem !== 0) return ordem;
				return a.nome.localeCompare(b.nome, 'pt-BR');
			});
	} catch {
		return [];
	}
};

export const salvarTorneiosCatalogo = (peladaId: string, torneios: TorneioCatalogo[]) => {
	if (typeof window === 'undefined') return;
	localStorage.setItem(storageKey(peladaId), JSON.stringify(torneios));
};

export const adicionarTorneioCatalogo = (
	peladaId: string,
	payload: Omit<TorneioCatalogo, 'id' | 'created_at'>,
): { ok: true; torneio: TorneioCatalogo } | { ok: false; error: string } => {
	const nome = payload.nome.trim();
	if (!nome) {
		return { ok: false, error: 'Informe o nome do torneio.' };
	}

	const torneios = listarTorneiosCatalogo(peladaId);
	const existe = torneios.some((item) => item.nome.toLowerCase() === nome.toLowerCase());
	if (existe) {
		return { ok: false, error: 'Ja existe um torneio com esse nome.' };
	}

	const novo: TorneioCatalogo = {
		id: gerarId(),
		nome,
		nivel_importancia: payload.nivel_importancia,
		created_at: new Date().toISOString(),
	};

	salvarTorneiosCatalogo(peladaId, [...torneios, novo]);
	return { ok: true, torneio: novo };
};

export const removerTorneioCatalogo = (peladaId: string, torneioId: string) => {
	const torneios = listarTorneiosCatalogo(peladaId);
	const atualizados = torneios.filter((item) => item.id !== torneioId);
	salvarTorneiosCatalogo(peladaId, atualizados);
	return atualizados;
};

export const atualizarTorneioCatalogo = (
	peladaId: string,
	torneioId: string,
	payload: Pick<TorneioCatalogo, 'nome' | 'nivel_importancia'>,
): { ok: true; torneio: TorneioCatalogo } | { ok: false; error: string } => {
	const nome = payload.nome.trim();
	if (!nome) {
		return { ok: false, error: 'Informe o nome do torneio.' };
	}

	const torneios = listarTorneiosCatalogo(peladaId);
	const indice = torneios.findIndex((item) => item.id === torneioId);
	if (indice === -1) {
		return { ok: false, error: 'Torneio nao encontrado.' };
	}

	const existeComMesmoNome = torneios.some(
		(item) => item.id !== torneioId && item.nome.toLowerCase() === nome.toLowerCase(),
	);
	if (existeComMesmoNome) {
		return { ok: false, error: 'Ja existe um torneio com esse nome.' };
	}

	const atualizado: TorneioCatalogo = {
		...torneios[indice],
		nome,
		nivel_importancia: payload.nivel_importancia,
	};

	const listaAtualizada = [...torneios];
	listaAtualizada[indice] = atualizado;
	salvarTorneiosCatalogo(peladaId, listaAtualizada);

	return { ok: true, torneio: atualizado };
};

export const migrarTorneiosVinculadosLegado = (peladaId: string): TorneioCatalogo[] => {
	if (typeof window === 'undefined') return [];

	const atuais = listarTorneiosCatalogo(peladaId);
	if (atuais.length > 0) return atuais;

	try {
		const rawLegado = localStorage.getItem(legacyStorageKey(peladaId));
		if (!rawLegado) return [];
		const legado = JSON.parse(rawLegado) as TorneioVinculadoLegado[];
		if (!Array.isArray(legado) || legado.length === 0) return [];

		const migrados: TorneioCatalogo[] = legado
			.map((item) => ({
				id: String(item.id || gerarId()),
				nome: String(item.nome || '').trim(),
				nivel_importancia: 'intermediario' as NivelImportanciaTorneio,
				created_at: new Date().toISOString(),
			}))
			.filter((item) => item.nome.length > 0);

		if (migrados.length > 0) {
			salvarTorneiosCatalogo(peladaId, migrados);
		}
		return migrados;
	} catch {
		return [];
	}
};
