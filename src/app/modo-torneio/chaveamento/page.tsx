'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MetodoChaveamento,
  gerarChaveamento,
  obterLabelMetodo,
  obterDescricaoMetodo,
} from '@/lib/bracketService';
import { EquipeTorneioLocal, PartidaTorneioLocal } from '@/lib/torneioLocalService';
import { buscar_pelada_id } from '@/lib/credenciais';

interface PartidaVisual extends PartidaTorneioLocal {
  equipe_a?: EquipeTorneioLocal;
  equipe_b?: EquipeTorneioLocal;
}

const METODOS_DISPONIVEIS: MetodoChaveamento[] = [
  'aleatorio',
  'cruzamento_grupos',
  'melhor_vs_pior',
  'classificacao_geral',
];

export default function ChaveamentoPage() {
  const router = useRouter();
  const [metodoSelecionado, setMetodoSelecionado] = useState<MetodoChaveamento>('melhor_vs_pior');
  const [equipes, setEquipes] = useState<EquipeTorneioLocal[]>([]);
  const [partidas, setPartidas] = useState<PartidaVisual[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [torneioId, setTorneioId] = useState<string>('');
  const [peladaId, setPeladaId] = useState<string>('');
  const [erro, setErro] = useState<string>('');

  useEffect(() => {
    const pelada_id = buscar_pelada_id();
    if (!pelada_id) {
      router.replace('/login');
      return;
    }

    setPeladaId(pelada_id);

    // Obter torneio ativo e equipes
    const torneio_id = localStorage.getItem(`torneio_id_ativo_${pelada_id}`);
    if (!torneio_id) {
      router.replace('/modo-torneio');
      return;
    }

    setTorneioId(torneio_id);

    // Carregar equipes
    const equipesKey = `equipes_torneio_${pelada_id}_${torneio_id}`;
    const equipesData = localStorage.getItem(equipesKey);
    if (!equipesData) {
      router.replace('/modo-torneio/equipes');
      return;
    }

    try {
      const equipesCarregadas = JSON.parse(equipesData);
      setEquipes(equipesCarregadas);

      // Gerar preview com método padrão
      const partidasGeradas = gerarChaveamento(
        equipesCarregadas,
        torneio_id,
        pelada_id,
        'melhor_vs_pior'
      );
      const partidasComEquipes = adicionarEquipesPartidas(
        partidasGeradas,
        equipesCarregadas
      );
      setPartidas(partidasComEquipes);
    } catch (e) {
      console.error('Erro ao carregar equipes:', e);
      setErro('Erro ao carregar dados');
    }

    setCarregando(false);
  }, [router]);

  const adicionarEquipesPartidas = (
    partidasInput: PartidaTorneioLocal[],
    equipesInput: EquipeTorneioLocal[]
  ): PartidaVisual[] => {
    return partidasInput.map((partida) => ({
      ...partida,
      equipe_a: equipesInput.find((e) => e.id === partida.equipe_a_id),
      equipe_b: equipesInput.find((e) => e.id === partida.equipe_b_id),
    }));
  };

  const atualizarPreview = (metodo: MetodoChaveamento) => {
    try {
      const partidasGeradas = gerarChaveamento(equipes, torneioId, peladaId, metodo);
      const partidasComEquipes = adicionarEquipesPartidas(
        partidasGeradas,
        equipes
      );
      setPartidas(partidasComEquipes);
      setMetodoSelecionado(metodo);
    } catch (e) {
      setErro('Erro ao gerar chaveamento');
    }
  };

  const confirmarChaveamento = async () => {
    setProcessando(true);
    try {
      // Salvar as partidas
      const partidasKey = `partidas_torneio_${peladaId}_${torneioId}`;
      localStorage.setItem(partidasKey, JSON.stringify(partidas));

      // Salvar método escolhido
      const metodoKey = `metodo_chaveamento_${peladaId}_${torneioId}`;
      localStorage.setItem(metodoKey, metodoSelecionado);

      // Redirecionar para próxima tela (partidas ou resumo)
      router.push('/modo-torneio');
    } catch (e) {
      setErro('Erro ao salvar chaveamento');
      setProcessando(false);
    }
  };

  if (carregando) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-white">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-700 to-rose-900 text-white p-6 border-b border-red-500">
        <h1 className="text-3xl font-bold">⚽ Chaveamento do Torneio</h1>
        <p className="text-red-100 mt-1">
          Escolha como as equipes serão pareadas ({equipes.length} times)
        </p>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Seleção de Métodos */}
        <div className="space-y-3">
          <h2 className="text-white font-semibold text-lg">Métodos de Chaveamento</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {METODOS_DISPONIVEIS.map((metodo) => (
              <button
                key={metodo}
                onClick={() => atualizarPreview(metodo)}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  metodoSelecionado === metodo
                    ? 'border-teal-400 bg-teal-900/30'
                    : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                }`}
              >
                <p className="text-white font-semibold text-lg">
                  {obterLabelMetodo(metodo)}
                </p>
                <p className="text-slate-300 text-sm mt-1">
                  {obterDescricaoMetodo(metodo)}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Preview do Chaveamento */}
        <div className="space-y-3">
          <h2 className="text-white font-semibold text-lg">
            📋 Preview das Partidas
          </h2>

          {erro && (
            <div className="bg-red-900/30 border border-red-700 text-red-200 p-3 rounded">
              {erro}
            </div>
          )}

          <div className="bg-slate-800 rounded-lg border border-slate-700 divide-y divide-slate-700">
            {partidas.length === 0 ? (
              <div className="p-6 text-center text-slate-400">
                Nenhuma partida gerada
              </div>
            ) : (
              partidas.map((partida, index) => (
                <div key={partida.id} className="p-4 flex items-center justify-between md:flex-row flex-col gap-4">
                  {/* Equipe A */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: partida.equipe_a?.cor || '#64748b',
                      }}
                    />
                    <p className="text-white font-medium truncate">
                      {partida.equipe_a?.nome || 'Equipe A'}
                    </p>
                  </div>

                  {/* Versus */}
                  <div className="text-slate-400 font-semibold flex-shrink-0">
                    vs
                  </div>

                  {/* Equipe B */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <p className="text-white font-medium truncate">
                      {partida.equipe_b?.nome || 'Equipe B'}
                    </p>
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: partida.equipe_b?.cor || '#64748b',
                      }}
                    />
                  </div>

                  {/* Número */}
                  <div className="text-slate-500 text-sm flex-shrink-0">
                    Partida {index + 1}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="bg-green-900/30 border border-green-700 text-green-200 p-4 rounded-lg">
            <p className="font-semibold">✅ Total de partidas: {partidas.length}</p>
            <p className="text-sm mt-1">
              Todas as partidas foram geradas com sucesso usando o método{' '}
              <strong>{obterLabelMetodo(metodoSelecionado)}</strong>
            </p>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex gap-3 pt-4">
          <Link
            href="/modo-torneio/equipes"
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 rounded-lg transition-colors text-center"
          >
            ← Voltar
          </Link>

          <button
            onClick={confirmarChaveamento}
            disabled={processando || partidas.length === 0}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition-colors"
          >
            {processando ? '⏳ Salvando...' : '✅ Confirmar e Iniciar'}
          </button>
        </div>
      </div>
    </div>
  );
}
