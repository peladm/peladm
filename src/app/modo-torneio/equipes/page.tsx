'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { EquipeTorneioLocal } from '@/lib/torneioLocalService';
import { buscar_pelada_id } from '@/lib/credenciais';

const CORES_DISPONIVEIS = [
  '#EF4444', // red-500
  '#F97316', // orange-500
  '#EAB308', // yellow-500
  '#22C55E', // green-500
  '#06B6D4', // cyan-500
  '#3B82F6', // blue-500
  '#8B5CF6', // purple-500
  '#EC4899', // pink-500
];

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

export default function EquipesPage() {
  const router = useRouter();
  const [equipes, setEquipes] = useState<EquipeTorneioLocal[]>([]);
  const [novoNome, setNovoNome] = useState('');
  const [novaCorIndex, setNovaCorIndex] = useState(0);
  const [torneioId, setTorneioId] = useState<string>('');
  const [peladaId, setPeladaId] = useState<string>('');
  const [carregando, setCarregando] = useState(true);
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
    if (equipesData) {
      try {
        setEquipes(JSON.parse(equipesData));
      } catch {
        console.error('Erro ao carregar equipes');
      }
    }

    setCarregando(false);
  }, [router]);

  const adicionarEquipe = () => {
    if (!novoNome.trim()) {
      setErro('Digite um nome para a equipe');
      return;
    }

    if (equipes.some((e) => e.nome.toLowerCase() === novoNome.toLowerCase())) {
      setErro('Equipe com este nome já existe');
      return;
    }

    const novaEquipe: EquipeTorneioLocal = {
      id: generateId(),
      torneio_id: torneioId,
      pelada_id: peladaId,
      nome: novoNome,
      sigla: novoNome.substring(0, 3).toUpperCase(),
      cor: CORES_DISPONIVEIS[novaCorIndex],
      pontos: 0,
      saldo_gols: 0,
      gols_pro: 0,
      gols_contra: 0,
      vitorias: 0,
      empates: 0,
      derrotas: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: 'local_only',
      version: 1,
    };

    const novasEquipes = [...equipes, novaEquipe];
    setEquipes(novasEquipes);

    // Salvar localStorage
    const equipesKey = `equipes_torneio_${peladaId}_${torneioId}`;
    localStorage.setItem(equipesKey, JSON.stringify(novasEquipes));

    setErro('');
    setNovoNome('');
    setNovaCorIndex((prev) => (prev + 1) % CORES_DISPONIVEIS.length);
  };

  const removerEquipe = (id: string) => {
    const novasEquipes = equipes.filter((e) => e.id !== id);
    setEquipes(novasEquipes);

    const equipesKey = `equipes_torneio_${peladaId}_${torneioId}`;
    localStorage.setItem(equipesKey, JSON.stringify(novasEquipes));
  };

  const irParaChaveamento = () => {
    if (equipes.length < 2) {
      setErro('É necessário no mínimo 2 equipes');
      return;
    }

    if (equipes.length % 2 !== 0) {
      setErro(`Número de equipes (${equipes.length}) deve ser par. Adicione mais uma equipe.`);
      return;
    }

    router.push('/modo-torneio/chaveamento');
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
      <div className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white p-6">
        <h1 className="text-3xl font-bold">Cadastro de Equipes</h1>
        <p className="text-teal-100 mt-1">Adicione as equipes que participarão do torneio</p>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Formulário de adição */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 space-y-4">
          <div>
            <label className="block text-white text-sm font-medium mb-2">Nome da Equipe</label>
            <input
              type="text"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && adicionarEquipe()}
              placeholder="Ex: Time A, Barcelona, etc."
              className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-white text-sm font-medium mb-3">Cor da Equipe</label>
            <div className="flex gap-2 flex-wrap">
              {CORES_DISPONIVEIS.map((cor, index) => (
                <button
                  key={cor}
                  onClick={() => setNovaCorIndex(index)}
                  className={`w-10 h-10 rounded-lg border-2 transition-all ${
                    novaCorIndex === index ? 'border-white scale-110' : 'border-slate-600'
                  }`}
                  style={{ backgroundColor: cor }}
                />
              ))}
            </div>
          </div>

          {erro && <div className="text-red-400 text-sm bg-red-900/30 p-3 rounded border border-red-900">{erro}</div>}

          <button
            onClick={adicionarEquipe}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium py-3 rounded-lg transition-colors"
          >
            ➕ Adicionar Equipe
          </button>
        </div>

        {/* Lista de Equipes */}
        <div className="space-y-3">
          <h2 className="text-white font-semibold text-lg">
            Equipes Cadastradas ({equipes.length})
          </h2>

          {equipes.length === 0 ? (
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 text-center text-slate-400">
              Nenhuma equipe cadastrada ainda
            </div>
          ) : (
            <div className="space-y-2">
              {equipes.map((equipe, index) => (
                <div
                  key={equipe.id}
                  className="bg-slate-800 rounded-lg border border-slate-700 p-4 flex items-center justify-between hover:border-slate-600 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: equipe.cor || '#64748b' }}
                    />
                    <div>
                      <p className="text-white font-medium">
                        {index + 1}. {equipe.nome}
                      </p>
                      <p className="text-slate-400 text-sm">{equipe.sigla}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => removerEquipe(equipe.id)}
                    className="text-red-400 hover:text-red-300 text-xl transition-colors"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contador de Paridade */}
        {equipes.length > 0 && (
          <div
            className={`rounded-lg p-4 text-center ${
              equipes.length % 2 === 0
                ? 'bg-green-900/30 border border-green-700 text-green-200'
                : 'bg-yellow-900/30 border border-yellow-700 text-yellow-200'
            }`}
          >
            {equipes.length % 2 === 0 ? (
              <p>✅ Total de equipes é par - pronto para chaveamento!</p>
            ) : (
              <p>⚠️ Número de equipes deve ser par (atual: {equipes.length})</p>
            )}
          </div>
        )}

        {/* Botões de Ação */}
        <div className="flex gap-3 pt-4">
          <Link
            href="/modo-torneio/regras"
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 rounded-lg transition-colors text-center"
          >
            ← Voltar
          </Link>

          <button
            onClick={irParaChaveamento}
            disabled={equipes.length < 2 || equipes.length % 2 !== 0}
            className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-700 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition-colors"
          >
            Próximo: Chaveamento →
          </button>
        </div>
      </div>
    </div>
  );
}
