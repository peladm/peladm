'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../../components/Layout';
import { buscar_pelada_id } from '../../../lib/credenciais';
import { validarSenhaPelada } from '../../../lib/supabase';
import {
  NivelImportanciaTorneio,
  TorneioCatalogo,
  adicionarTorneioCatalogo,
  atualizarTorneioCatalogo,
  listarTorneiosCatalogo,
  migrarTorneiosVinculadosLegado,
  removerTorneioCatalogo,
} from '../../../lib/torneioVinculadoService';

const labelImportancia: Record<NivelImportanciaTorneio, string> = {
  baixa_relevancia: '⭐',
  intermediario: '⭐⭐',
  alta_relevancia: '⭐⭐⭐',
  o_torneio: '⭐⭐⭐⭐',
  intertemporada_sem_classificacao: '⏸️',
};

const corImportancia: Record<NivelImportanciaTorneio, string> = {
  o_torneio: 'bg-purple-100 text-purple-800 border-purple-300',
  alta_relevancia: 'bg-red-100 text-red-800 border-red-300',
  intermediario: 'bg-amber-100 text-amber-800 border-amber-300',
  baixa_relevancia: 'bg-slate-100 text-slate-700 border-slate-300',
  intertemporada_sem_classificacao: 'bg-blue-100 text-blue-800 border-blue-300',
};

export default function MeusTorneiosPage() {
  type AcaoConfirmacao = 'alterar' | 'remover';

  const router = useRouter();
  const [peladaId, setPeladaId] = useState('default');
  const [torneios, setTorneios] = useState<TorneioCatalogo[]>([]);
  const [nome, setNome] = useState('');
  const [nivelImportancia, setNivelImportancia] = useState<NivelImportanciaTorneio>('intermediario');
  const [erro, setErro] = useState('');
  const [torneioEmEdicaoId, setTorneioEmEdicaoId] = useState<string | null>(null);
  const [showModalConfirmacao, setShowModalConfirmacao] = useState(false);
  const [acaoConfirmacao, setAcaoConfirmacao] = useState<AcaoConfirmacao>('alterar');
  const [senhaConfirmacao, setSenhaConfirmacao] = useState('');
  const [erroConfirmacao, setErroConfirmacao] = useState('');
  const [isConfirmando, setIsConfirmando] = useState(false);

  const quantidade = useMemo(() => torneios.length, [torneios]);
  const emModoEdicao = !!torneioEmEdicaoId;

  const recarregarLista = (pid: string) => {
    setTorneios(listarTorneiosCatalogo(pid));
  };

  useEffect(() => {
    const pid = buscar_pelada_id() || 'default';
    setPeladaId(pid);
    migrarTorneiosVinculadosLegado(pid);
    recarregarLista(pid);
  }, []);

  const iniciarEdicao = (torneio: TorneioCatalogo) => {
    setErro('');
    setTorneioEmEdicaoId(torneio.id);
    setNome(torneio.nome);
    setNivelImportancia(torneio.nivel_importancia);
  };

  const cancelarEdicao = () => {
    setErro('');
    setTorneioEmEdicaoId(null);
    setNome('');
    setNivelImportancia('intermediario');
  };

  const handleCriar = () => {
    setErro('');

    const resultado = adicionarTorneioCatalogo(peladaId, {
      nome,
      nivel_importancia: nivelImportancia,
    });

    if (!resultado.ok) {
      setErro(resultado.error);
      return;
    }

    setNome('');
    setNivelImportancia('intermediario');
    recarregarLista(peladaId);
  };

  const abrirConfirmacao = (acao: AcaoConfirmacao) => {
    if (!torneioEmEdicaoId) return;
    setAcaoConfirmacao(acao);
    setSenhaConfirmacao('');
    setErroConfirmacao('');
    setShowModalConfirmacao(true);
  };

  const confirmarAcaoComSenha = async () => {
    setErroConfirmacao('');

    if (!torneioEmEdicaoId) {
      setErroConfirmacao('Selecione um torneio para continuar.');
      return;
    }

    if (!senhaConfirmacao.trim()) {
      setErroConfirmacao('Digite sua senha para confirmar.');
      return;
    }

    setIsConfirmando(true);
    try {
      const senhaValida = await validarSenhaPelada(senhaConfirmacao);
      if (!senhaValida) {
        setErroConfirmacao('Senha incorreta.');
        return;
      }

      if (acaoConfirmacao === 'alterar') {
        const resultado = atualizarTorneioCatalogo(peladaId, torneioEmEdicaoId, {
          nome,
          nivel_importancia: nivelImportancia,
        });

        if (!resultado.ok) {
          setErroConfirmacao(resultado.error);
          return;
        }

        recarregarLista(peladaId);
        cancelarEdicao();
        setShowModalConfirmacao(false);
        return;
      }

      removerTorneioCatalogo(peladaId, torneioEmEdicaoId);
      recarregarLista(peladaId);
      cancelarEdicao();
      setShowModalConfirmacao(false);
    } finally {
      setIsConfirmando(false);
    }
  };

  return (
    <Layout title="Meus Torneios">
      <section className="mb-6">
        <div className="bg-gray-800 border-gray-700 rounded-2xl shadow-2xl p-5 sm:p-6 border-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                <span className="text-sky-400">Meus</span>{' '}
                <span className="text-white">Torneios</span>
              </h2>
              <p className="text-sm sm:text-base mt-1 text-white">
                Cadastre tipos de torneio com nome e nivel de importancia antes de iniciar competicoes
              </p>
            </div>
            <button
              onClick={() => router.push('/modo-torneio')}
              className="rounded-xl bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 text-sm font-semibold"
            >
              Voltar
            </button>
          </div>
        </div>
      </section>

      <section className="mb-6">
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none">💡</span>
            <div>
              <h3 className="text-sm sm:text-base font-black text-sky-900">Para que serve esta tela?</h3>
              <p className="text-xs sm:text-sm text-sky-800 mt-1 leading-relaxed">
                Aqui voce pode padronizar os torneios que se repetem ao longo da temporada.
                Ao cadastrar o nome e o nivel de relevancia uma vez, fica mais facil reutilizar esse torneio em novas edicoes,
                manter o historico organizado e, no futuro, contabilizar titulos por jogador e outras estatisticas com mais consistencia.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
          <h3 className="text-lg font-black text-gray-900 mb-4">
            {emModoEdicao ? 'Editar torneio' : 'Novo tipo de torneio'}
          </h3>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-600">Nome do torneio</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Copa dos Amigos"
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600">Nivel de importancia</label>
              <select
                value={nivelImportancia}
                onChange={(e) => setNivelImportancia(e.target.value as NivelImportanciaTorneio)}
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:border-sky-500"
              >
                <option value="baixa_relevancia">⭐</option>
                <option value="intermediario">⭐⭐</option>
                <option value="alta_relevancia">⭐⭐⭐</option>
                <option value="o_torneio">⭐⭐⭐⭐</option>
                <option value="intertemporada_sem_classificacao">⏸️ Intertemporada</option>
              </select>
            </div>

            {erro && <p className="text-xs text-red-600">{erro}</p>}

            {emModoEdicao ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  onClick={() => abrirConfirmacao('alterar')}
                  className="sm:col-span-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white py-2.5 font-semibold transition-colors"
                >
                  Salvar alteracoes
                </button>
                <button
                  onClick={() => abrirConfirmacao('remover')}
                  className="rounded-xl bg-red-600 hover:bg-red-700 text-white py-2.5 font-semibold transition-colors"
                >
                  Remover
                </button>
                <button
                  onClick={cancelarEdicao}
                  className="sm:col-span-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 font-semibold transition-colors"
                >
                  Cancelar edicao
                </button>
              </div>
            ) : (
              <button
                onClick={handleCriar}
                className="w-full rounded-xl bg-sky-600 hover:bg-sky-700 text-white py-2.5 font-semibold transition-colors"
              >
                Criar torneio
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="mb-8">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-black text-gray-900">Torneios cadastrados</h3>
            <span className="text-xs font-semibold text-gray-500">Total: {quantidade}</span>
          </div>

          {torneios.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-5 text-sm text-gray-500 text-center">
              Nenhum torneio cadastrado ainda.
            </div>
          ) : (
            <div className="space-y-3">
              {torneios.map((torneio) => (
                <div key={torneio.id} className="rounded-xl border border-gray-200 p-4 bg-gray-50">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-gray-900">{torneio.nome}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Criado em {new Date(torneio.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-full border ${corImportancia[torneio.nivel_importancia]}`}>
                        {labelImportancia[torneio.nivel_importancia]}
                      </span>
                      <button
                        onClick={() => iniciarEdicao(torneio)}
                        className="text-xs text-sky-700 hover:text-sky-800 font-semibold"
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {showModalConfirmacao && (
        <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4" onClick={() => !isConfirmando && setShowModalConfirmacao(false)}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-200 p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black text-gray-900 mb-1">
              {acaoConfirmacao === 'alterar' ? 'Confirmar alteracao' : 'Confirmar remocao'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Digite a senha do cliente para {acaoConfirmacao === 'alterar' ? 'salvar as alteracoes' : 'remover o torneio selecionado'}.
            </p>

            <label className="text-xs font-semibold text-gray-600">Senha do cliente</label>
            <input
              type="password"
              value={senhaConfirmacao}
              onChange={(e) => setSenhaConfirmacao(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:border-sky-500"
              placeholder="Digite sua senha"
              disabled={isConfirmando}
            />

            {erroConfirmacao && <p className="text-xs text-red-600 mt-2">{erroConfirmacao}</p>}

            <div className="grid grid-cols-2 gap-2 mt-4">
              <button
                onClick={() => setShowModalConfirmacao(false)}
                className="rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 font-semibold transition-colors"
                disabled={isConfirmando}
              >
                Cancelar
              </button>
              <button
                onClick={confirmarAcaoComSenha}
                className={`rounded-xl text-white py-2.5 font-semibold transition-colors ${acaoConfirmacao === 'alterar' ? 'bg-sky-600 hover:bg-sky-700' : 'bg-red-600 hover:bg-red-700'}`}
                disabled={isConfirmando}
              >
                {isConfirmando ? 'Validando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
