'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { validarSenhaPelada } from '../../lib/supabase';
import { buscar_pelada_id } from '../../lib/credenciais';
import {
  FormatoCompeticao,
  ModalidadeCompeticao,
  TorneioLocal,
  limparTorneioLocal,
  limparSetupCompeticaoLocal,
  obterResumoTorneioAtivoLocal,
  obterTorneioRascunhoOuAtivoLocal,
  salvarSetupCompeticaoLocal,
  obterTorneiosEncerrados,
} from '../../lib/torneioLocalService';

interface TorneioVinculado {
  id: string;
  nome: string;
  temporada?: string;
  slug: string;
  colocacaoCol: string;
  premiacoesCol: string;
}

export default function ModoTorneioPage() {
  const router = useRouter();
  const [torneioAtivo, setTorneioAtivo] = useState(false);
  const [infoTorneio, setInfoTorneio] = useState<{
    data: string;
    equipes: number;
    partidas: number;
  } | null>(null);

  const [setupEmAndamento, setSetupEmAndamento] = useState(false);
  const [equipesJaCadastradas, setEquipesJaCadastradas] = useState(false);

  const [showModalExcluirTorneio, setShowModalExcluirTorneio] = useState(false);
  const [senhaExcluirTorneio, setSenhaExcluirTorneio] = useState('');
  const [erroExcluirTorneio, setErroExcluirTorneio] = useState('');
  const [isExcluindoTorneio, setIsExcluindoTorneio] = useState(false);
  const [peladaId, setPeladaId] = useState<string>('');
  const [torneiosEncerrados, setTorneiosEncerrados] = useState<TorneioLocal[]>([]);
  const [modalEncerradosAberto, setModalEncerradosAberto] = useState(false);
  const [showModalCarregarTorneio, setShowModalCarregarTorneio] = useState(false);
  const [showModalTipoTorneio, setShowModalTipoTorneio] = useState(false);
  const [showModalTipoLiga, setShowModalTipoLiga] = useState(false);

  const [torneiosVinculados, setTorneiosVinculados] = useState<TorneioVinculado[]>([]);
  const [showModalTorneiosVinculados, setShowModalTorneiosVinculados] = useState(false);
  const [novoVinculadoNome, setNovoVinculadoNome] = useState('');
  const [novoVinculadoTemporada, setNovoVinculadoTemporada] = useState('');
  const [erroVinculado, setErroVinculado] = useState('');
  const [isCriandoVinculado, setIsCriandoVinculado] = useState(false);
  const [vinculoParaRemover, setVinculoParaRemover] = useState<TorneioVinculado | null>(null);
  const [senhaRemocaoVinculo, setSenhaRemocaoVinculo] = useState('');
  const [erroRemoverVinculo, setErroRemoverVinculo] = useState('');
  const [isRemovendoVinculo, setIsRemovendoVinculo] = useState(false);

  useEffect(() => {
    const pelada_id = buscar_pelada_id() || 'default';
    setPeladaId(pelada_id);
    
    verificarTorneioAtivo(pelada_id);
    setTorneiosEncerrados(obterTorneiosEncerrados());
    carregarTorneiosVinculados(pelada_id);
  }, []);

  const carregarTorneiosVinculados = (pelada_id: string) => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(`torneios_vinculados_${pelada_id}`);
      if (!raw) {
        setTorneiosVinculados([]);
        return;
      }
      const parsed = JSON.parse(raw) as TorneioVinculado[];
      setTorneiosVinculados(Array.isArray(parsed) ? parsed : []);
    } catch {
      setTorneiosVinculados([]);
    }
  };

  const salvarTorneiosVinculados = (lista: TorneioVinculado[]) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`torneios_vinculados_${peladaId}`, JSON.stringify(lista));
    setTorneiosVinculados(lista);
  };

  const gerarSlugTorneioVinculado = (nome: string, temporada?: string) => {
    const base = `${nome || ''} ${temporada || ''}`
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return base || `torneio_${Date.now()}`;
  };

  const criarTorneioVinculado = async () => {
    setErroVinculado('');
    if (!novoVinculadoNome.trim()) {
      setErroVinculado('Informe o nome oficial do torneio.');
      return;
    }

    setIsCriandoVinculado(true);

    try {
      const slug = gerarSlugTorneioVinculado(novoVinculadoNome, novoVinculadoTemporada);
      if (torneiosVinculados.some((item) => item.slug === slug)) {
        setErroVinculado('Já existe um torneio vinculado com este nome ou temporada.');
        return;
      }

      const colocacaoCol = `colocacao_${slug}`;
      const premiacoesCol = `premiacoes_${slug}`;
      const novoItem: TorneioVinculado = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
        nome: novoVinculadoNome.trim(),
        temporada: novoVinculadoTemporada.trim() || undefined,
        slug,
        colocacaoCol,
        premiacoesCol,
      };

      // NOTE: A aplicação ainda não executa DDL direto no Supabase.
      // Essa lista guarda os torneios vinculados localmente.
      salvarTorneiosVinculados([...torneiosVinculados, novoItem]);
      setNovoVinculadoNome('');
      setNovoVinculadoTemporada('');
    } catch (error) {
      console.error('Erro ao criar torneio vinculado:', error);
      setErroVinculado('Não foi possível adicionar o torneio vinculado.');
    } finally {
      setIsCriandoVinculado(false);
    }
  };

  const removerTorneioVinculado = async () => {
    if (!vinculoParaRemover) return;
    setErroRemoverVinculo('');
    if (!senhaRemocaoVinculo.trim()) {
      setErroRemoverVinculo('Digite sua senha para confirmar a remoção.');
      return;
    }

    setIsRemovendoVinculo(true);
    try {
      const response = await fetch('/api/torneio-vinculado/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          peladaId,
          slug: vinculoParaRemover.slug,
          colocacaoCol: vinculoParaRemover.colocacaoCol,
          premiacoesCol: vinculoParaRemover.premiacoesCol,
          senha: senhaRemocaoVinculo,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setErroRemoverVinculo(data?.error || 'Não foi possível remover o torneio vinculado.');
        return;
      }

      const atualizados = torneiosVinculados.filter((item) => item.slug !== vinculoParaRemover.slug);
      salvarTorneiosVinculados(atualizados);
      setVinculoParaRemover(null);
      setSenhaRemocaoVinculo('');
    } catch (error) {
      console.error('Erro ao remover torneio vinculado:', error);
      setErroRemoverVinculo('Erro ao remover. Verifique a senha e tente novamente.');
    } finally {
      setIsRemovendoVinculo(false);
    }
  };

  const verificarTorneioAtivo = (pelada_id: string) => {
    try {
      const resumo = obterResumoTorneioAtivoLocal();

      if (!resumo) {
        setTorneioAtivo(false);
        setInfoTorneio(null);

        // Verificar se há torneio rascunho (setup em andamento salvo)
        const rascunho = obterTorneioRascunhoOuAtivoLocal();
        if (rascunho && rascunho.status === 'rascunho') {
          setSetupEmAndamento(true);
          // Verificar se times já foram sorteados/confirmados
          const pid = pelada_id;
          const equipesKey = `equipes_torneio_${pid}_${rascunho.id}`;
          const equipesDataRaw = localStorage.getItem(equipesKey);
          if (equipesDataRaw) {
            try {
              const equipes = JSON.parse(equipesDataRaw);
              setEquipesJaCadastradas(equipes.length > 0);
            } catch {
              setEquipesJaCadastradas(false);
            }
          }
          return;
        }

        // Compatibilidade antiga: setup salvo pelo método legado
        const setup = localStorage.getItem(`setup_competicao_${pelada_id}`);
        if (setup) {
          setSetupEmAndamento(true);
          const torneio_id = localStorage.getItem(`torneio_id_ativo_${pelada_id}`);
          if (torneio_id) {
            const equipesKey = `equipes_torneio_${pelada_id}_${torneio_id}`;
            const equipesData = localStorage.getItem(equipesKey);
            if (equipesData) {
              try {
                const equipes = JSON.parse(equipesData);
                setEquipesJaCadastradas(equipes.length > 0);
              } catch {
                setEquipesJaCadastradas(false);
              }
            }
          }
        } else {
          setSetupEmAndamento(false);
          setEquipesJaCadastradas(false);
        }
        return;
      }

      setTorneioAtivo(true);
      setSetupEmAndamento(false);
      setEquipesJaCadastradas(false);

      const dataFormatada = new Date(resumo.torneio.data_inicio).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      });

      setInfoTorneio({
        data: dataFormatada,
        equipes: resumo.equipes,
        partidas: resumo.partidas,
      });
    } catch (err) {
      console.error('Erro ao verificar torneio ativo:', err);
      setTorneioAtivo(false);
      setInfoTorneio(null);
      setSetupEmAndamento(false);
      setEquipesJaCadastradas(false);
    }
  };

  const acessarTorneioAtivo = () => {
    router.push('/modo-torneio/painel?aba=painel');
  };

  const iniciarFluxoRegras = (modalidade: ModalidadeCompeticao, formato: FormatoCompeticao) => {
    if (torneioAtivo) return;

    const nomeSugerido = modalidade === 'torneio' ? 'Torneio da Pelada' : 'Campeonato da Pelada';

    salvarSetupCompeticaoLocal({
      modalidade,
      formato,
      nome_sugerido: nomeSugerido,
      created_at: new Date().toISOString(),
    });

    router.push('/modo-torneio/regras');
  };

  const abrirModalExcluirTorneio = (e: React.MouseEvent) => {
    e.stopPropagation();
    setErroExcluirTorneio('');
    setSenhaExcluirTorneio('');
    setShowModalExcluirTorneio(true);
  };

  const excluirTorneioLocal = async () => {
    setErroExcluirTorneio('');

    if (!senhaExcluirTorneio.trim()) {
      setErroExcluirTorneio('Digite sua senha para confirmar.');
      return;
    }

    const resumo = obterResumoTorneioAtivoLocal();
    if (!resumo) {
      setShowModalExcluirTorneio(false);
      setTorneioAtivo(false);
      setInfoTorneio(null);
      return;
    }

    const senhaValida = await validarSenhaPelada(senhaExcluirTorneio);
    if (!senhaValida) {
      setErroExcluirTorneio('Senha incorreta.');
      return;
    }

    setIsExcluindoTorneio(true);

    try {
      limparTorneioLocal(resumo.torneio.id);

      setTorneioAtivo(false);
      setSetupEmAndamento(false);
      setEquipesJaCadastradas(false);
      setInfoTorneio(null);
      setShowModalExcluirTorneio(false);
      setSenhaExcluirTorneio('');
      alert('🗑️ Torneio ativo local foi apagado com sucesso.');
    } catch (error) {
      console.error('Erro ao excluir dados do torneio ativo:', error);
      setErroExcluirTorneio('Erro ao apagar dados do torneio ativo.');
    } finally {
      setIsExcluindoTorneio(false);
    }
  };

  return (
    <Layout title="Modo Torneio">
      <section className="mb-6">
        <div className="bg-gray-800 border-gray-700 rounded-2xl shadow-2xl p-5 sm:p-6 border-2">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            <span className="text-sky-400">Modo</span>{' '}
            <span className="text-white">Torneio/Liga</span>
          </h2>
          <p className="text-sm sm:text-base mt-1 text-white">Escolha um formato e siga para a tela de regras</p>
        </div>
      </section>

      <section className="mb-5">
        {setupEmAndamento ? (
          <div className="w-full bg-gradient-to-r from-amber-600 to-orange-700 rounded-xl shadow-lg border-2 border-amber-400 p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-3xl leading-none">🔧</span>
                <div className="text-left">
                  <h3 className="font-bold text-white text-sm sm:text-base mb-0.5">Setup em Andamento</h3>
                  <p className="text-xs text-amber-100">
                    {equipesJaCadastradas ? '📋 Próximo: Chaveamento' : '👥 Próximo: Cadastro de Equipes'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push(equipesJaCadastradas ? '/modo-torneio/chaveamento' : '/modo-torneio/equipes')}
                className="text-white font-bold text-sm bg-amber-800 hover:bg-amber-900 px-4 py-2 rounded-lg transition-colors"
              >
                Continuar →
              </button>
            </div>
            <div className="flex gap-4 mt-3 pt-3 border-t border-amber-500">
              <button
                onClick={() => { limparSetupCompeticaoLocal(); setSetupEmAndamento(false); }}
                className="text-amber-200 hover:text-white text-sm underline underline-offset-2 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => { limparSetupCompeticaoLocal(); setSetupEmAndamento(false); }}
                className="text-amber-200 hover:text-white text-sm underline underline-offset-2 transition-colors"
              >
                Iniciar Novo
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => torneioAtivo ? setShowModalCarregarTorneio(true) : undefined}
            className={`w-full rounded-xl shadow-md p-4 sm:p-6 border transition-all duration-300 min-h-[5rem] ${
              torneioAtivo
                ? 'bg-gradient-to-r from-blue-600 to-sky-700 border-sky-400 cursor-pointer hover:from-blue-700 hover:to-sky-800'
                : 'bg-gradient-to-r from-gray-100 to-gray-200 border-gray-300 opacity-75 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center justify-between h-full">
              <div className="flex items-center space-x-3">
                <span className="text-3xl leading-none">📂</span>
                <div className="text-left">
                  <h3 className={`font-semibold text-sm sm:text-base ${torneioAtivo ? 'text-white' : 'text-gray-600'}`}>
                    Carregar Torneio em Aberto
                  </h3>
                  {!torneioAtivo && (
                    <p className="text-xs text-gray-500 mt-0.5">Nenhum torneio em aberto</p>
                  )}
                </div>
              </div>
              {torneioAtivo && (
                <span className="text-sky-100 text-sm font-semibold">Ver →</span>
              )}
            </div>
          </button>
        )}
      </section>

      {/* ── DIVISOR ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-px bg-gray-700"></div>
        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Novo Torneio</span>
        <div className="flex-1 h-px bg-gray-700"></div>
      </div>

      <section
        onClick={() => !torneioAtivo && !setupEmAndamento && setShowModalTipoTorneio(true)}
        className={`mb-5 rounded-2xl border p-4 sm:p-5 transition-all ${
          torneioAtivo || setupEmAndamento
            ? 'bg-gray-200 border-gray-300 opacity-80 cursor-not-allowed'
            : 'bg-gradient-to-r from-red-700 to-rose-900 border-red-500 cursor-pointer hover:from-red-800 hover:to-rose-950'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl leading-none">🏆</span>
            <h3 className={`font-black text-lg ${torneioAtivo || setupEmAndamento ? 'text-gray-600' : 'text-white'}`}>Torneio / Copa</h3>
          </div>
          {!torneioAtivo && !setupEmAndamento && (
            <span className="text-red-200 text-sm font-semibold">Escolher →</span>
          )}
        </div>
      </section>

      <section
        onClick={() => !torneioAtivo && !setupEmAndamento && setShowModalTipoLiga(true)}
        className={`mb-5 rounded-2xl border p-4 sm:p-5 transition-all ${
          torneioAtivo || setupEmAndamento
            ? 'bg-gray-200 border-gray-300 opacity-80 cursor-not-allowed'
            : 'bg-gradient-to-r from-sky-600 to-cyan-700 border-sky-400 cursor-pointer hover:from-sky-700 hover:to-cyan-800'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl leading-none">🥇</span>
            <h3 className={`font-black text-lg ${torneioAtivo || setupEmAndamento ? 'text-gray-600' : 'text-white'}`}>Liga / Campeonato</h3>
          </div>
          {!torneioAtivo && !setupEmAndamento && (
            <span className="text-sky-100 text-sm font-semibold">Escolher →</span>
          )}
        </div>
      </section>

      <section className="mb-6">
        <button
          onClick={() => setShowModalTorneiosVinculados(true)}
          className="w-full rounded-2xl border border-gray-300 bg-white p-4 sm:p-5 text-left shadow-sm hover:border-sky-300 transition-colors"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl leading-none">🔗</span>
              <div>
                <h3 className="font-black text-lg text-gray-900">Torneios e Ligas vinculados à minha pelada</h3>
                <p className="text-xs text-gray-500 mt-1">
                  {torneiosVinculados.length > 0
                    ? `${torneiosVinculados.length} vinculados`
                    : 'Nenhum torneio vinculado cadastrado'}
                </p>
              </div>
            </div>
            <span className="text-sm font-semibold text-slate-500">Ver →</span>
          </div>
        </button>
      </section>

      {/* ── DIVISOR ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-5 mt-1">
        <div className="flex-1 h-px bg-gray-700"></div>
        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Histórico</span>
        <div className="flex-1 h-px bg-gray-700"></div>
      </div>

      {/* ── SEÇÃO MUSEU DOS CAMPEÕES ────────────────────────────────── */}
      <section className="mb-6">
        {/* Título da seção */}
        <div className="flex items-center gap-2 mb-3 px-1">
          <span className="text-xl">🏆</span>
          <p className="font-black text-yellow-400 text-base tracking-wide">Museu dos Campeões</p>
        </div>

        <div className="flex flex-col gap-2">
          {/* Torneios Encerrados */}
          <button
            onClick={() => setModalEncerradosAberto(true)}
            className="w-full flex items-center justify-between bg-gray-800 border border-gray-700 hover:border-yellow-600 rounded-xl px-4 py-3 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">🔒</span>
              <div className="text-left">
                <p className="font-semibold text-white text-sm">Torneios Encerrados</p>
                <p className="text-xs text-gray-400">
                  {torneiosEncerrados.length > 0
                    ? `${torneiosEncerrados.length} torneio${torneiosEncerrados.length > 1 ? 's' : ''} — somente consulta`
                    : 'Nenhum torneio encerrado'}
                </p>
              </div>
            </div>
            <span className="text-gray-400 text-sm">Ver →</span>
          </button>

          {/* Jogadores x Títulos */}
          <button
            disabled
            className="w-full flex items-center justify-between bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 opacity-50 cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">👑</span>
              <div className="text-left">
                <p className="font-semibold text-white text-sm">Jogadores x Títulos</p>
                <p className="text-xs text-gray-400">Quantos títulos cada jogador conquistou</p>
              </div>
            </div>
            <span className="text-xs text-gray-600 bg-gray-700 px-2 py-1 rounded-lg">Em breve</span>
          </button>

          {/* Premiações Individuais */}
          <button
            disabled
            className="w-full flex items-center justify-between bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 opacity-50 cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">⚽</span>
              <div className="text-left">
                <p className="font-semibold text-white text-sm">Premiações Individuais</p>
                <p className="text-xs text-gray-400">Artilheiros e líderes de assistências por torneio</p>
              </div>
            </div>
            <span className="text-xs text-gray-600 bg-gray-700 px-2 py-1 rounded-lg">Em breve</span>
          </button>
        </div>
      </section>

      {/* ── MODAL CARREGAR TORNEIO EM ABERTO ──────────────────────────── */}
      {showModalCarregarTorneio && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 flex items-end justify-center"
          onClick={() => setShowModalCarregarTorneio(false)}
        >
          <div
            className="w-full max-w-lg bg-gray-900 rounded-t-3xl p-5 pb-8"
            style={{ maxHeight: '80vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-black text-white">📂 Torneios em Aberto</h2>
                <p className="text-xs text-gray-400 mt-0.5">Selecione para carregar</p>
              </div>
              <button onClick={() => setShowModalCarregarTorneio(false)} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
            </div>
            <div className="space-y-3">
              {infoTorneio && (
                <div
                  onClick={() => { setShowModalCarregarTorneio(false); acessarTorneioAtivo(); }}
                  className="w-full bg-gray-800 border border-sky-600 rounded-2xl p-4 text-left hover:border-sky-400 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white text-sm">⚡ Torneio Ativo</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Iniciado em {infoTorneio.data} · {infoTorneio.equipes} equipes · {infoTorneio.partidas} partidas
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setShowModalCarregarTorneio(false); abrirModalExcluirTorneio(e); }}
                        className="bg-red-800/50 hover:bg-red-700 text-white rounded-lg w-8 h-8 flex items-center justify-center text-sm transition-colors"
                        title="Apagar torneio"
                      >
                        🗑️
                      </button>
                      <span className="text-sky-400 text-sm">Abrir →</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL TIPO TORNEIO / COPA ──────────────────────────────────── */}
      {showModalTipoTorneio && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 flex items-end justify-center"
          onClick={() => setShowModalTipoTorneio(false)}
        >
          <div
            className="w-full max-w-lg bg-gray-900 rounded-t-3xl p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-black text-white">🏆 Torneio / Copa</h2>
                <p className="text-xs text-gray-400 mt-0.5">Escolha o formato</p>
              </div>
              <button onClick={() => setShowModalTipoTorneio(false)} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => { setShowModalTipoTorneio(false); iniciarFluxoRegras('torneio', 'grupos_mata_mata'); }}
                className="w-full bg-gray-800 border border-red-700 hover:border-red-400 rounded-2xl p-4 text-left transition-colors"
              >
                <p className="font-bold text-white text-sm">Fase de grupos + mata-mata</p>
                <p className="text-xs text-gray-400 mt-1">Fase classificatória seguida de eliminatória</p>
              </button>
              <button
                onClick={() => { setShowModalTipoTorneio(false); iniciarFluxoRegras('torneio', 'mata_mata'); }}
                className="w-full bg-gray-800 border border-red-700 hover:border-red-400 rounded-2xl p-4 text-left transition-colors"
              >
                <p className="font-bold text-white text-sm">Só mata-mata</p>
                <p className="text-xs text-gray-400 mt-1">Eliminação direta desde a primeira rodada</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL TIPO LIGA / CAMPEONATO ──────────────────────────────── */}
      {showModalTipoLiga && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 flex items-end justify-center"
          onClick={() => setShowModalTipoLiga(false)}
        >
          <div
            className="w-full max-w-lg bg-gray-900 rounded-t-3xl p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-black text-white">🥇 Liga / Campeonato</h2>
                <p className="text-xs text-gray-400 mt-0.5">Escolha o formato</p>
              </div>
              <button onClick={() => setShowModalTipoLiga(false)} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => { setShowModalTipoLiga(false); iniciarFluxoRegras('campeonato', 'pontos_corridos'); }}
                className="w-full bg-gray-800 border border-sky-700 hover:border-sky-400 rounded-2xl p-4 text-left transition-colors"
              >
                <p className="font-bold text-white text-sm">Pontos corridos</p>
                <p className="text-xs text-gray-400 mt-1">Todos jogam contra todos, vence quem somar mais pontos</p>
              </button>
              <button
                onClick={() => { setShowModalTipoLiga(false); iniciarFluxoRegras('campeonato', 'pontos_corridos_mata_mata'); }}
                className="w-full bg-gray-800 border border-sky-700 hover:border-sky-400 rounded-2xl p-4 text-left transition-colors"
              >
                <p className="font-bold text-white text-sm">Pontos corridos + mata-mata</p>
                <p className="text-xs text-gray-400 mt-1">Fase de liga seguida de playoffs eliminatórios</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {showModalTorneiosVinculados && (
        <div className="fixed inset-0 z-[9999] bg-black/80 flex items-end justify-center" onClick={() => setShowModalTorneiosVinculados(false)}>
          <div className="w-full max-w-lg bg-white rounded-t-3xl p-5 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-black text-slate-900">🔗 Torneios vinculados</h2>
                <p className="text-xs text-slate-500 mt-0.5">Gerencie os torneios que estão associados à sua pelada</p>
              </div>
              <button onClick={() => setShowModalTorneiosVinculados(false)} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
            </div>

            <div className="space-y-4">
              {torneiosVinculados.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 p-4 text-center text-slate-600">
                  Nenhum torneio vinculado cadastrado ainda.
                </div>
              ) : (
                <div className="space-y-3">
                  {torneiosVinculados.map((item) => (
                    <div key={item.slug} className="rounded-3xl border border-slate-200 p-4 bg-slate-50">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{item.nome}</p>
                          <p className="text-xs text-slate-500">Temporada: {item.temporada || 'Não definida'}</p>
                          <p className="text-xs text-slate-500 mt-2">Coluna de colocação: <code>{item.colocacaoCol}</code></p>
                          <p className="text-xs text-slate-500">Coluna de premiações: <code>{item.premiacoesCol}</code></p>
                        </div>
                        <button
                          onClick={() => { setVinculoParaRemover(item); setSenhaRemocaoVinculo(''); setErroRemoverVinculo(''); }}
                          className="text-red-600 text-sm font-semibold hover:text-red-700"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-slate-900 mb-2">Adicionar novo torneio vinculado</p>
                <label className="text-xs text-slate-500">Nome oficial do torneio</label>
                <input
                  type="text"
                  value={novoVinculadoNome}
                  onChange={(e) => setNovoVinculadoNome(e.target.value)}
                  className="mt-1 mb-3 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-sky-500"
                  placeholder="Ex: Copa da Pelada"
                />
                <label className="text-xs text-slate-500">Temporada</label>
                <input
                  type="text"
                  value={novoVinculadoTemporada}
                  onChange={(e) => setNovoVinculadoTemporada(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-sky-500"
                  placeholder="Ex: 2026"
                />
                {erroVinculado && <p className="mt-2 text-xs text-red-600">{erroVinculado}</p>}
                <button
                  onClick={criarTorneioVinculado}
                  disabled={isCriandoVinculado}
                  className="mt-4 w-full rounded-2xl bg-sky-600 px-4 py-2 text-white font-semibold hover:bg-sky-700 transition-colors disabled:opacity-60"
                >
                  {isCriandoVinculado ? 'Criando...' : 'Adicionar torneio vinculado'}
                </button>
              </div>

              {vinculoParaRemover && (
                <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4">
                  <p className="font-semibold text-rose-800 mb-2">Confirmar remoção de:</p>
                  <p className="text-sm text-rose-700 mb-3">{vinculoParaRemover.nome} ({vinculoParaRemover.temporada || 'sem temporada'})</p>
                  <input
                    type="password"
                    value={senhaRemocaoVinculo}
                    onChange={(e) => setSenhaRemocaoVinculo(e.target.value)}
                    className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 outline-none focus:border-rose-400"
                    placeholder="Digite sua senha para confirmar"
                  />
                  {erroRemoverVinculo && <p className="mt-2 text-xs text-rose-700">{erroRemoverVinculo}</p>}
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={removerTorneioVinculado}
                      disabled={isRemovendoVinculo}
                      className="flex-1 rounded-2xl bg-rose-600 px-4 py-2 text-white font-semibold hover:bg-rose-700 transition-colors disabled:opacity-60"
                    >
                      {isRemovendoVinculo ? 'Removendo...' : 'Remover'}
                    </button>
                    <button
                      onClick={() => { setVinculoParaRemover(null); setSenhaRemocaoVinculo(''); setErroRemoverVinculo(''); }}
                      className="rounded-2xl border border-rose-200 bg-white px-4 py-2 text-rose-700 hover:bg-rose-100 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showModalExcluirTorneio && (
        <div
          className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-5"
          onClick={() => !isExcluindoTorneio && setShowModalExcluirTorneio(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-red-100 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-red-600">🗑️ Apagar Torneio Ativo Local</h2>
              <button
                onClick={() => !isExcluindoTorneio && setShowModalExcluirTorneio(false)}
                className="text-2xl text-gray-400 hover:text-gray-600"
                disabled={isExcluindoTorneio}
              >
                ×
              </button>
            </div>

            <p className="text-sm text-gray-700 mb-4">
              Essa acao apaga os dados locais do torneio em andamento que ainda nao foram sincronizados.
            </p>

            <div className="mb-4">
              <label className="block mb-2 text-sm font-semibold text-gray-900">
                Digite sua senha para confirmar
              </label>
              <input
                type="password"
                value={senhaExcluirTorneio}
                onChange={(e) => setSenhaExcluirTorneio(e.target.value)}
                placeholder="Sua senha"
                className="w-full px-3 py-3 rounded-lg border-2 border-gray-200 text-base outline-none focus:border-sky-500"
                disabled={isExcluindoTorneio}
              />
            </div>

            {erroExcluirTorneio && (
              <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {erroExcluirTorneio}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowModalExcluirTorneio(false)}
                disabled={isExcluindoTorneio}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={excluirTorneioLocal}
                disabled={isExcluindoTorneio}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                {isExcluindoTorneio ? 'Apagando...' : 'Apagar'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── MODAL CONSULTAR TORNEIOS ENCERRADOS ───────────────────────── */}
      {modalEncerradosAberto && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 flex items-end justify-center"
          onClick={() => setModalEncerradosAberto(false)}
        >
          <div
            className="w-full max-w-lg bg-gray-900 rounded-t-3xl p-5 pb-8"
            style={{ maxHeight: '80vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-black text-white">🔒 Torneios Encerrados</h2>
                <p className="text-xs text-gray-400 mt-0.5">Somente leitura — sem edição</p>
              </div>
              <button onClick={() => setModalEncerradosAberto(false)} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
            </div>
            <div className="space-y-3">
              {torneiosEncerrados.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setModalEncerradosAberto(false); router.push(`/modo-torneio/painel?torneioId=${t.id}&readonly=1&aba=painel`); }}
                  className="w-full bg-gray-800 border border-gray-700 rounded-2xl p-4 text-left hover:border-gray-500 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white text-sm truncate">🏆 {t.nome}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {t.modalidade === 'torneio' ? 'Torneio' : 'Campeonato'} · {t.formato.replace(/_/g, ' ')}
                      </p>
                      {t.data_fim && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          Encerrado em {new Date(t.data_fim).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                    <span className="text-gray-500 text-sm ml-3 shrink-0">Consultar →</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
