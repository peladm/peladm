'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { validarSenhaPelada } from '../../lib/supabase';
import { buscar_plano } from '../../lib/credenciais';

export default function PeladaTradicionalPage() {
  const plano = buscar_plano();
  const router = useRouter();
  const [sessaoAtiva, setSessaoAtiva] = useState(false);
  const [infoSessao, setInfoSessao] = useState<{
    data: string;
    jogadores: number;
    partidas: number;
    gols: number;
  } | null>(null);

  const [showModalExcluirSessao, setShowModalExcluirSessao] = useState(false);
  const [senhaExcluirSessao, setSenhaExcluirSessao] = useState('');
  const [erroExcluirSessao, setErroExcluirSessao] = useState('');
  const [isExcluindoSessao, setIsExcluindoSessao] = useState(false);

  useEffect(() => {
    verificarSessaoAtiva();
  }, []);

  const navigateTo = (page: string) => {
    router.push(`/${page}`);
  };

  const verificarSessaoAtiva = () => {
    try {
      const sessaoAtivaStr = localStorage.getItem('sessao_ativa');

      if (!sessaoAtivaStr) {
        setSessaoAtiva(false);
        setInfoSessao(null);
        return;
      }

      const sessao = JSON.parse(sessaoAtivaStr);
      if (sessao.status !== 'ativa') {
        setSessaoAtiva(false);
        setInfoSessao(null);
        return;
      }

      setSessaoAtiva(true);

      const filaAtivaStr = localStorage.getItem('fila_ativa');
      const filaAtiva = filaAtivaStr ? JSON.parse(filaAtivaStr) : [];

      const jogosKey = `jogos_${sessao.id}`;
      const jogosStr = localStorage.getItem(jogosKey);
      const jogos = jogosStr ? JSON.parse(jogosStr) : [];

      const totalJogadores = filaAtiva.filter((j: any) => {
        const status = String(j?.status || '').toLowerCase();
        const posicaoFila = Number(j?.posicao_fila ?? 999);
        return status !== 'reserva' && posicaoFila !== 999;
      }).length;

      const totalPartidas = jogos.filter((j: any) => j.status === 'finalizado').length;
      const totalGols = jogos
        .filter((j: any) => j.status === 'finalizado')
        .reduce((sum: number, jogo: any) => sum + (jogo.placar_a || 0) + (jogo.placar_b || 0), 0);

      const dataFormatada = new Date(sessao.data).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      });

      setInfoSessao({
        data: dataFormatada,
        jogadores: totalJogadores,
        partidas: totalPartidas,
        gols: totalGols,
      });
    } catch (err) {
      console.error('Erro ao verificar sessão:', err);
      setSessaoAtiva(false);
      setInfoSessao(null);
    }
  };

  const acessarSessaoAtiva = () => {
    router.push('/page-fila');
  };

  const abrirModalExcluirSessao = (e: React.MouseEvent) => {
    e.stopPropagation();
    setErroExcluirSessao('');
    setSenhaExcluirSessao('');
    setShowModalExcluirSessao(true);
  };

  const excluirSessaoLocal = async () => {
    setErroExcluirSessao('');

    if (!senhaExcluirSessao.trim()) {
      setErroExcluirSessao('Digite sua senha para confirmar.');
      return;
    }

    const sessaoAtivaStr = localStorage.getItem('sessao_ativa');
    if (!sessaoAtivaStr) {
      setShowModalExcluirSessao(false);
      setSessaoAtiva(false);
      setInfoSessao(null);
      return;
    }

    const senhaValida = await validarSenhaPelada(senhaExcluirSessao);
    if (!senhaValida) {
      setErroExcluirSessao('Senha incorreta.');
      return;
    }

    setIsExcluindoSessao(true);

    try {
      const sessao = JSON.parse(sessaoAtivaStr);
      const sessaoId = sessao?.id;

      localStorage.removeItem('sessao_ativa');
      localStorage.removeItem('fila_ativa');
      localStorage.removeItem('partida_em_andamento');
      localStorage.removeItem('modo_partida_estado');
      localStorage.removeItem('modo_prancheta_ativo');
      localStorage.removeItem('cronometro_partida');

      if (sessaoId) {
        localStorage.removeItem(`jogos_${sessaoId}`);
        localStorage.removeItem(`gols_${sessaoId}`);
        localStorage.removeItem(`assistencias_${sessaoId}`);
        localStorage.removeItem(`fila_snapshot_${sessaoId}`);
      }

      setSessaoAtiva(false);
      setInfoSessao(null);
      setShowModalExcluirSessao(false);
      setSenhaExcluirSessao('');
      alert('🗑️ Pelada ativa local foi apagada com sucesso.');
    } catch (error) {
      console.error('Erro ao excluir dados da pelada ativa:', error);
      setErroExcluirSessao('Erro ao apagar dados da pelada ativa.');
    } finally {
      setIsExcluindoSessao(false);
    }
  };

  return (
    <Layout title="Pelada Tradicional">
      <section className="mb-6">
        <div className="bg-gray-800 border-gray-700 rounded-2xl shadow-2xl p-5 sm:p-6 border-2">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            <span className="text-emerald-400">Pelada</span>{' '}
            <span className="text-white">Tradicional</span>
          </h2>
          <p className="text-sm sm:text-base mt-1 text-white">Organize tudo da pelada em um só lugar</p>
        </div>
      </section>

      <section className="mb-5 grid grid-cols-2 gap-4">
        <button
          onClick={() => navigateTo('cadastro')}
          className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl shadow-md p-4 border border-emerald-400 transition-all duration-300 min-h-[5rem]"
        >
          <div className="flex items-center space-x-3">
            <span className="text-3xl leading-none">🏃‍♂️</span>
            <div className="text-left">
              <h3 className="font-bold text-white">Cadastro</h3>
              <p className="text-xs text-emerald-100">Peladeiros</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => navigateTo('regras')}
          className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl shadow-md p-4 border border-emerald-400 transition-all duration-300 min-h-[5rem]"
        >
          <div className="flex items-center space-x-3">
            <span className="text-3xl leading-none">⚙️</span>
            <div className="text-left">
              <h3 className="font-bold text-white">Regras</h3>
              <p className="text-xs text-emerald-100">da pelada</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => navigateTo('sorteio')}
          disabled={sessaoAtiva}
          className={`w-full rounded-xl shadow-md p-4 border transition-all duration-300 min-h-[5rem] col-span-2 ${
            sessaoAtiva
              ? 'bg-gray-300 border-gray-400 text-gray-500 cursor-not-allowed opacity-80'
              : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white border-blue-400'
          }`}
        >
          <div className="flex items-center space-x-3">
            <span className="text-3xl leading-none">🎲</span>
            <div className="text-left">
              <h3 className={`font-bold ${sessaoAtiva ? 'text-gray-600' : 'text-white'}`}>Realizar Sorteio / Iniciar Pelada</h3>
              <p className={`text-xs ${sessaoAtiva ? 'text-gray-500' : 'text-blue-100'}`}>
                {sessaoAtiva ? 'Desativado: já existe pelada ativa' : 'Monte os times e inicie uma nova pelada.'}
              </p>
            </div>
          </div>
        </button>
      </section>

      <section className="mb-5">
        {!sessaoAtiva ? (
          <button className="w-full bg-gradient-to-r from-gray-100 to-gray-200 rounded-xl shadow-md p-4 sm:p-6 border border-gray-300 transition-all duration-300 min-h-[5rem] sm:h-20 cursor-not-allowed opacity-75">
            <div className="flex items-center justify-between h-full">
              <div className="flex items-center space-x-3">
                <span className="text-3xl leading-none">🔍</span>
                <div>
                  <h3 className="font-semibold text-gray-600 text-sm sm:text-base">Consultar Peladas</h3>
                </div>
              </div>

              <div className="text-xs sm:text-sm text-gray-500 bg-gray-200 px-2 sm:px-4 py-1 sm:py-2 rounded-lg border border-gray-300">
                Não existem peladas ativas
              </div>
            </div>
          </button>
        ) : (
          <div
            onClick={acessarSessaoAtiva}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-xl shadow-lg hover:shadow-xl p-4 sm:p-6 border-2 border-green-400 transition-all duration-300 min-h-[5rem] sm:h-20 group animate-pulse relative cursor-pointer"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                acessarSessaoAtiva();
              }
            }}
          >
            <div className="flex items-center justify-between h-full">
              <div className="flex items-center space-x-3">
                <span className="text-3xl leading-none group-hover:scale-110 group-hover:rotate-12 transition-transform animate-bounce">⚡</span>
                <div className="text-left">
                  <h3 className="font-bold text-white text-sm sm:text-base mb-0.5">Pelada Ativa</h3>
                  <p className="text-xs text-green-100">Clique para acessar</p>
                </div>
              </div>

              {infoSessao && (
                <div className="flex items-center gap-2 sm:gap-3 text-white ml-2">
                  <div className="text-center">
                    <div className="text-xs text-green-100">Data</div>
                    <div className="text-sm sm:text-base font-bold">{infoSessao.data}</div>
                  </div>
                  <div className="h-8 w-px bg-green-300"></div>
                  <div className="text-center">
                    <div className="text-xs text-green-100">Jogadores</div>
                    <div className="text-sm sm:text-base font-bold">{infoSessao.jogadores}</div>
                  </div>
                  <div className="h-8 w-px bg-green-300 hidden sm:block"></div>
                  <div className="text-center hidden sm:block">
                    <div className="text-xs text-green-100">Partidas</div>
                    <div className="text-sm sm:text-base font-bold">{infoSessao.partidas}</div>
                  </div>
                  <div className="h-8 w-px bg-green-300 hidden sm:block"></div>
                  <div className="text-center hidden sm:block">
                    <div className="text-xs text-green-100">Gols</div>
                    <div className="text-sm sm:text-base font-bold">{infoSessao.gols}</div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={abrirModalExcluirSessao}
                className="ml-2 sm:ml-3 bg-white/20 hover:bg-white/30 text-white rounded-full w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-base sm:text-lg transition-colors shrink-0"
                title="Apagar pelada ativa local"
              >
                🗑️
              </button>
            </div>
          </div>
        )}
      </section>

      {plano === 'premium' && (
        <section className="mb-5">
          <button
            onClick={() => navigateTo('resultados')}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-xl shadow-xl hover:shadow-2xl p-5 border-2 border-orange-300 transition-all duration-300 min-h-[6rem]"
          >
            <div className="flex items-center space-x-4">
              <span className="text-4xl leading-none">📊</span>
              <div className="text-left">
                <h3 className="font-black text-white text-lg">Estatísticas Gerais</h3>
                <p className="text-sm text-orange-100 mt-0.5">Estatísticas, resultados, tabelas e um X1 especial</p>
              </div>
            </div>
          </button>
        </section>
      )}

      {plano !== 'free' && (
        <section className="mb-5">
          <button
            onClick={() => navigateTo('atividade')}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl shadow-md p-4 border border-emerald-400 transition-all duration-300 min-h-[5rem]"
          >
            <div className="flex items-center space-x-3">
              <span className="text-3xl leading-none">📋</span>
              <div className="text-left">
                <h3 className="font-bold text-white">Controle de Presença</h3>
                <p className="text-xs text-emerald-100">Gerencie presença da rodada</p>
              </div>
            </div>
          </button>
        </section>
      )}

      {showModalExcluirSessao && (
        <div
          className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-5"
          onClick={() => !isExcluindoSessao && setShowModalExcluirSessao(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-red-100 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-red-600">🗑️ Apagar Pelada Ativa Local</h2>
              <button
                onClick={() => !isExcluindoSessao && setShowModalExcluirSessao(false)}
                className="text-2xl text-gray-400 hover:text-gray-600"
                disabled={isExcluindoSessao}
              >
                ×
              </button>
            </div>

            <p className="text-sm text-gray-700 mb-4">
              Essa ação apaga os dados locais da pelada em andamento que ainda não foram sincronizados.
            </p>

            <div className="mb-4">
              <label className="block mb-2 text-sm font-semibold text-gray-900">
                Digite sua senha para confirmar
              </label>
              <input
                type="password"
                value={senhaExcluirSessao}
                onChange={(e) => setSenhaExcluirSessao(e.target.value)}
                placeholder="Sua senha"
                className="w-full px-3 py-3 rounded-lg border-2 border-gray-200 text-base outline-none focus:border-emerald-500"
                disabled={isExcluindoSessao}
              />
            </div>

            {erroExcluirSessao && (
              <div className="mb-4 text-sm font-semibold text-red-600">{erroExcluirSessao}</div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowModalExcluirSessao(false)}
                className="flex-1 py-3 rounded-lg border-2 border-gray-200 bg-white text-gray-600 font-semibold"
                disabled={isExcluindoSessao}
              >
                Cancelar
              </button>
              <button
                onClick={excluirSessaoLocal}
                className="flex-1 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold disabled:opacity-80 disabled:cursor-not-allowed"
                disabled={isExcluindoSessao}
              >
                {isExcluindoSessao ? 'Apagando...' : 'Apagar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
