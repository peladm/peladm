'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../../components/Layout';
import { jogadoresService, Jogador } from '../../../lib/supabase';
import { buscar_pelada_id } from '../../../lib/credenciais';
import {
  ParticipanteTorneioLocal,
  obterParticipantesTorneioLocal,
  obterRegrasCompeticaoLocal,
  obterTorneioRascunhoOuAtivoLocal,
  salvarParticipantesTorneioLocal,
} from '../../../lib/torneioLocalService';

interface JogadorDisponivel {
  id: string;
  nome: string;
  nivel: number;
  origem: 'cadastro' | 'avulso';
}

function Estrelas({ nivel, tamanho = 'sm' }: { nivel: number; tamanho?: 'sm' | 'xs' }) {
  const size = tamanho === 'xs' ? 'text-xs' : 'text-sm';
  return (
    <span className={size}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < nivel ? 'text-yellow-400' : 'text-gray-300'}>★</span>
      ))}
    </span>
  );
}

export default function ParticipantesPage() {
  const router = useRouter();

  const [torneioId, setTorneioId] = useState<string | null>(null);
  const [totalNecessario, setTotalNecessario] = useState(30); // jogadoresPorTime × quantidadeTimes
  const [jogadores, setJogadores] = useState<JogadorDisponivel[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Modal novo jogador avulso
  const [modalAberto, setModalAberto] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoNivel, setNovoNivel] = useState(3);

  // Modo de entrada de jogadores
  const [modo, setModo] = useState<'cadastrados' | 'novos' | null>(null);
  const [temCadastrados, setTemCadastrados] = useState(false);
  const [checkingCadastrados, setCheckingCadastrados] = useState(true);

  useEffect(() => {
    const torneio = obterTorneioRascunhoOuAtivoLocal();
    if (!torneio) { router.replace('/modo-torneio'); return; }
    setTorneioId(torneio.id);

    const regras = obterRegrasCompeticaoLocal(torneio.id);
    if (regras) { setTotalNecessario(regras.jogadores_por_time * regras.quantidade_times); }

    // Se já há participantes salvos, pula o modal e carrega direto
    const jasSalvos = obterParticipantesTorneioLocal(torneio.id);
    if (jasSalvos.length > 0) {
      const idsConfirmados = new Set(jasSalvos.filter((p) => p.status === 'confirmado').map((p) => p.jogador_id));
      setSelecionados(idsConfirmados);
      setModo('cadastrados');
      carregarJogadores(torneio.id);
    } else {
      setIsLoading(false); // Mostra o modal de seleção
    }

    // Verificação assíncrona: cliente tem jogadores cadastrados?
    (async () => {
      try {
        const fromSupabase = await jogadoresService.buscarTodos();
        setTemCadastrados(fromSupabase.length > 0);
      } catch {
        const pid = buscar_pelada_id() || 'default';
        try {
          const cache = localStorage.getItem(`jogadores_${pid}`);
          setTemCadastrados(!!(cache && JSON.parse(cache).length > 0));
        } catch { /* ignora */ }
      } finally { setCheckingCadastrados(false); }
    })();
  }, [router]);

  const carregarJogadores = async (torneioIdArg: string) => {
    setIsLoading(true);
    const jasSalvos = obterParticipantesTorneioLocal(torneioIdArg);
    try {
      const peladaId = buscar_pelada_id();
      let dados: JogadorDisponivel[] = [];
      try {
        const fromSupabase = await jogadoresService.buscarTodos();
        dados = fromSupabase.map((j: Jogador) => ({ id: j.id, nome: j.nome, nivel: j.nivel ?? 3, origem: 'cadastro' as const }));
      } catch {
        const cache = localStorage.getItem(`jogadores_${peladaId}`);
        if (cache) {
          const parsed = JSON.parse(cache) as { id: string; nome: string; nivel?: number }[];
          dados = parsed.map((j) => ({ id: j.id, nome: j.nome, nivel: j.nivel ?? 3, origem: 'cadastro' as const }));
        }
      }
      const avulsos = jasSalvos.filter((p) => p.origem === 'avulso');
      const idsExistentes = new Set(dados.map((j) => j.id));
      avulsos.forEach((p) => {
        if (!idsExistentes.has(p.jogador_id)) dados.push({ id: p.jogador_id, nome: p.nome, nivel: p.nivel, origem: 'avulso' });
      });
      setJogadores(dados);
    } finally {
      setIsLoading(false);
    }
  };

  const selecionarModo = (m: 'cadastrados' | 'novos') => {
    setModo(m);
    if (m === 'cadastrados' && torneioId) {
      carregarJogadores(torneioId);
    } else {
      setJogadores([]);
      setIsLoading(false);
    }
  };

  const jogadoresOrdenados = useMemo(() => {
    return [...jogadores]
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [jogadores]);

  const toggleSelecionado = (id: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= totalNecessario) return prev; // já atingiu o limite
        next.add(id);
      }
      return next;
    });
  };

  const adicionarAvulso = () => {
    if (!novoNome.trim()) return;

    const id = `avulso_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const novo: JogadorDisponivel = {
      id,
      nome: novoNome.trim(),
      nivel: novoNivel,
      origem: 'avulso',
    };

    setJogadores((prev) => [...prev, novo]);

    // Auto-selecionar se ainda há vagas
    if (selecionados.size < totalNecessario) {
      setSelecionados((prev) => new Set([...prev, id]));
    }

    setNovoNome('');
    setNovoNivel(3);
    setModalAberto(false);
  };

  const confirmar = () => {
    if (!torneioId) return;

    const peladaId = buscar_pelada_id() || 'default';
    const now = new Date().toISOString();

    const participantes: ParticipanteTorneioLocal[] = jogadores.map((j) => ({
      id: `part_${j.id}`,
      torneio_id: torneioId,
      pelada_id: peladaId,
      jogador_id: j.id,
      nome: j.nome,
      nivel: j.nivel,
      status: selecionados.has(j.id) ? 'confirmado' : 'reserva',
      origem: j.origem,
      created_at: now,
    }));

    salvarParticipantesTorneioLocal(torneioId, participantes);
    router.push('/modo-torneio/sortear-times');
  };

  const confirmadosCount = selecionados.size;
  const faltam = totalNecessario - confirmadosCount;
  const pronto = confirmadosCount === totalNecessario;

  // Modal de seleção de modo (antes de qualquer outra coisa)
  if (modo === null) {
    return (
      <Layout title="Participantes">
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '24px 24px 0 0', padding: '24px', width: '100%', maxWidth: '600px' }}>
            <h2 className="text-xl font-black text-gray-800 mb-1">Como deseja organizar os times?</h2>
            <p className="text-sm text-gray-500 mb-5">Escolha a forma de entrada dos jogadores para este torneio.</p>
            <div className="space-y-3">
              {/* Opção 1: Jogadores Cadastrados */}
              <button
                type="button"
                onClick={() => temCadastrados && selecionarModo('cadastrados')}
                disabled={!temCadastrados}
                className={`w-full flex items-start gap-4 p-4 rounded-2xl border-2 text-left transition-all active:scale-[0.98] ${
                  temCadastrados ? 'border-sky-200 hover:border-sky-400 hover:bg-sky-50' : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                }`}
              >
                <span className="text-2xl mt-0.5">📋</span>
                <div>
                  <p className="font-bold text-gray-800 text-sm">Sorteio — Usar Jogadores Cadastrados</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {checkingCadastrados ? 'Verificando...' : temCadastrados ? 'Selecione da sua lista de jogadores para o sorteio' : 'Nenhum jogador cadastrado na sua lista'}
                  </p>
                </div>
              </button>
              {/* Opção 2: Cadastrar Novos */}
              <button
                type="button"
                onClick={() => selecionarModo('novos')}
                className="w-full flex items-start gap-4 p-4 rounded-2xl border-2 border-sky-200 hover:border-sky-400 hover:bg-sky-50 text-left transition-all active:scale-[0.98]"
              >
                <span className="text-2xl mt-0.5">✏️</span>
                <div>
                  <p className="font-bold text-gray-800 text-sm">Sorteio — Cadastrar Novos</p>
                  <p className="text-xs text-gray-500 mt-0.5">Adicione jogadores exclusivos para este torneio (não salva na sua lista)</p>
                </div>
              </button>
              {/* Opção 3: Times já Prontos */}
              <button
                type="button"
                onClick={() => router.push('/modo-torneio/sortear-times?modo=prontos')}
                className="w-full flex items-start gap-4 p-4 rounded-2xl border-2 border-sky-200 hover:border-sky-400 hover:bg-sky-50 text-left transition-all active:scale-[0.98]"
              >
                <span className="text-2xl mt-0.5">👕</span>
                <div>
                  <p className="font-bold text-gray-800 text-sm">Times já Prontos</p>
                  <p className="text-xs text-gray-500 mt-0.5">Configure cada time diretamente, inserindo os nomes dos jogadores por time</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout title="Participantes">
        <div className="flex items-center justify-center h-40">
          <p className="text-gray-400 text-sm">Carregando jogadores...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Participantes">
      {/* Header */}
      <section className="mb-4">
        <div className="bg-gray-800 border-gray-700 rounded-2xl shadow-2xl p-4 sm:p-5 border-2">
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            <span className="text-sky-400">Selecionar</span>{' '}
            <span className="text-white">Participantes</span>
          </h2>
          <p className="text-xs sm:text-sm mt-1 text-gray-300">
            Selecione exatamente{' '}
            <span className="text-sky-400 font-bold">{totalNecessario} jogadores</span>
            {' '}para a competição. Os demais ficam na lista de espera.
          </p>
        </div>
      </section>

      {/* Contador sticky */}
      <div className={`sticky top-0 z-10 mb-4 rounded-2xl border-2 px-4 py-3 flex items-center justify-between transition-colors ${
        pronto
          ? 'bg-emerald-50 border-emerald-400'
          : 'bg-white border-sky-200'
      }`}>
        <p className={`font-bold text-sm ${pronto ? 'text-emerald-700' : 'text-sky-700'}`}>
          {pronto ? '✓ Seleção completa!' : `${confirmadosCount} de ${totalNecessario} selecionados`}
          {!pronto && faltam > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-400">faltam {faltam}</span>
          )}
        </p>
        <button
          onClick={() => setModalAberto(true)}
          className="text-xs bg-sky-500 hover:bg-sky-600 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors"
        >
          Cadastrar Jogador
        </button>
      </div>

      {jogadoresOrdenados.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">👥</p>
          <p className="font-semibold">{modo === 'novos' ? 'Nenhum jogador adicionado' : 'Nenhum jogador cadastrado'}</p>
          <p className="text-sm mt-1">{modo === 'novos' ? 'Use o botão acima para adicionar os jogadores deste torneio.' : 'Adicione jogadores avulsos ou cadastre na tela de cadastro.'}</p>
        </div>
      ) : (
        <section className="mb-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 px-1">
            Todos ({jogadoresOrdenados.length})
          </p>
          <div className="grid grid-cols-2 gap-2">
            {jogadoresOrdenados.map((j) => {
              const sel = selecionados.has(j.id);
              const bloqueado = pronto && !sel;
              return (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => toggleSelecionado(j.id)}
                  disabled={bloqueado}
                  className={`rounded-xl px-3 py-2 text-left border-2 relative transition-all active:scale-95 ${
                    sel
                      ? 'bg-emerald-50 border-emerald-400'
                      : bloqueado
                      ? 'bg-white border-gray-200 opacity-40 cursor-not-allowed'
                      : 'bg-white border-gray-200 hover:border-sky-300'
                  }`}
                >
                  {sel && (
                    <span className="absolute top-1.5 right-2 text-emerald-500 text-xs font-bold">✓</span>
                  )}
                  <p className={`font-semibold text-sm leading-tight pr-4 truncate ${sel ? 'text-emerald-800' : 'text-gray-700'}`}>
                    {j.nome}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Estrelas nivel={j.nivel} tamanho="xs" />
                    {j.origem === 'avulso' && (
                      <span className="text-xs text-sky-500">· avulso</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Botão confirmar */}
      <section className="mb-6">
        <button
          onClick={confirmar}
          disabled={!pronto}
          className={`w-full rounded-xl shadow-md p-3.5 font-bold text-sm transition-all ${
            pronto
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700 active:scale-95'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {pronto ? 'Confirmar participantes e avançar →' : `Selecione mais ${faltam} jogador${faltam !== 1 ? 'es' : ''}`}
        </button>
      </section>

      {/* Modal jogador avulso */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <h3 className="font-black text-gray-800 text-base mb-4">Adicionar jogador avulso</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nome</label>
                <input
                  type="text"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && adicionarAvulso()}
                  placeholder="Nome do jogador"
                  autoFocus
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:border-sky-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nível</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setNovoNivel(n)}
                      className={`flex-1 py-2 rounded-lg text-lg transition-all ${
                        n <= novoNivel ? 'text-yellow-400' : 'text-gray-300'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setModalAberto(false); setNovoNome(''); setNovoNivel(3); }}
                className="flex-1 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={adicionarAvulso}
                disabled={!novoNome.trim()}
                className="flex-1 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-sm disabled:opacity-40 transition-colors"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
