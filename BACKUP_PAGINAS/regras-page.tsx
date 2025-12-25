'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
// TODO: Configurar sistema de banco de dados para carregar/salvar regras
// import { supabase } from '@/lib/supabase';

interface Regras {
  jogadores_por_time: number;
  modelo_sorteio: 'equilibrado' | 'aleatorio';
  duracao: number;
  vitorias_consecutivas: number;
  prioridade_retorno: 'prioridade' | 'sem_prioridade' | 'mesclar';
  regra_empate: 'ambos_saem' | 'desempate';
  regra_apos_empate: 'desempate_decide' | 'mesclar_times';
}

export default function RegrasPage() {
  const router = useRouter();
  
  const [regras, setRegras] = useState<Regras>({
    jogadores_por_time: 5,
    modelo_sorteio: 'equilibrado',
    duracao: 10,
    vitorias_consecutivas: 0,
    prioridade_retorno: 'prioridade',
    regra_empate: 'ambos_saem',
    regra_apos_empate: 'desempate_decide'
  });
  const [activeTab, setActiveTab] = useState<'4x4' | '5x5' | '6x6' | '7x7'>('5x5');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    carregarRegras();
  }, []);

  const carregarRegras = async () => {
    try {
      console.log('🔍 Carregando regras do banco...');
      
      // TODO: Implementar carregamento de regras do banco de dados
      // const { data, error } = await supabase
      //   .from('regras')
      //   .select('*')
      //   .order('updated_at', { ascending: false })
      //   .limit(1);

      // Temporário: usar valores padrão até implementar banco
      console.log('⚠️ Sistema de banco não configurado, usando valores padrão');
      
      // if (!error && data && data.length > 0) {
      //   const regrasCarregadas = {
      //     jogadores_por_time: data[0].jogadores_por_time || 5,
      //     modelo_sorteio: data[0].modelo_sorteio || 'equilibrado',
      //     duracao: data[0].duracao || 10,
      //     vitorias_consecutivas: data[0].vitorias_consecutivas || 0,
      //     prioridade_retorno: data[0].prioridade_retorno || 'prioridade',
      //     regra_empate: data[0].regra_empate || 'ambos_saem',
      //     regra_apos_empate: data[0].regra_apos_empate || 'desempate_decide'
      //   };
      //   setRegras(regrasCarregadas);
      //   console.log('✅ Regras definidas no estado:', regrasCarregadas);
      // } else {
      //   console.log('⚠️ Nenhuma configuração encontrada, usando padrões');
      // }
    } catch (error) {
      console.warn('💥 Erro ao carregar regras:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    console.log('🚀 Salvando regras...');
    console.log('📋 Dados a serem salvos:', regras);

    try {
      // TODO: Implementar salvamento no banco de dados
      // const { data: existingData, error: selectError } = await supabase
      //   .from('regras')
      //   .select('id')
      //   .order('updated_at', { ascending: false })
      //   .limit(1);

      // let result;
      // if (!selectError && existingData && existingData.length > 0) {
      //   result = await supabase
      //     .from('regras')
      //     .update({
      //       ...regras,
      //       updated_at: new Date().toISOString()
      //     })
      //     .eq('id', existingData[0].id)
      //     .select();
      // } else {
      //   result = await supabase
      //     .from('regras')
      //     .insert([regras])
      //     .select();
      // }

      // Temporário: simular salvamento até implementar banco
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('✅ Regras salvas (simulado)');
      setMessage('💾 Regras salvas com sucesso!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('💥 Erro ao salvar regras:', error);
      setMessage(`❌ Erro ao salvar regras: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const resetarPadrao = () => {
    setRegras({
      jogadores_por_time: 5,
      modelo_sorteio: 'equilibrado',
      duracao: 10,
      vitorias_consecutivas: 0,
      prioridade_retorno: 'prioridade',
      regra_empate: 'ambos_saem',
      regra_apos_empate: 'desempate_decide'
    });
    setMessage('🔄 Configurações restauradas para o padrão');
    setTimeout(() => setMessage(''), 3000);
  };

  const selecionarJogadores = (valor: number) => {
    setRegras({ ...regras, jogadores_por_time: valor });
  };

  const scrollToPadroes = () => {
    const element = document.getElementById('padroes-sorteio');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const renderPatternTable = () => {
    const patterns = {
      '4x4': [
        { pos: '1º', star2: 1, star3: 0, star4: 3, star5: 1, avg: 4.0 },
        { pos: '2º', star2: 0, star3: 2, star4: 2, star5: 1, avg: 3.8 },
        { pos: '3º', star2: 0, star3: 3, star4: 1, star5: 1, avg: 3.6 },
        { pos: '4º', star2: 1, star3: 1, star4: 2, star5: 1, avg: 3.6 },
        { pos: '5º', star2: 0, star3: 3, star4: 2, star5: 0, avg: 3.4 },
        { pos: '6º', star2: 0, star3: 4, star4: 0, star5: 1, avg: 3.4 },
        { pos: '7º', star2: 1, star3: 1, star4: 3, star5: 0, avg: 3.2 },
        { pos: '8º', star2: 1, star3: 2, star4: 1, star5: 1, avg: 3.4 }
      ],
      '5x5': [
        { pos: '1º', star2: 1, star3: 0, star4: 3, star5: 1, avg: 3.8 },
        { pos: '2º', star2: 0, star3: 2, star4: 2, star5: 1, avg: 3.6 },
        { pos: '3º', star2: 0, star3: 3, star4: 1, star5: 1, avg: 3.6 },
        { pos: '4º', star2: 1, star3: 1, star4: 2, star5: 1, avg: 3.6 },
        { pos: '5º', star2: 0, star3: 3, star4: 2, star5: 0, avg: 3.4 },
        { pos: '6º', star2: 0, star3: 4, star4: 0, star5: 1, avg: 3.4 },
        { pos: '7º', star2: 1, star3: 1, star4: 3, star5: 0, avg: 3.2 },
        { pos: '8º', star2: 1, star3: 2, star4: 1, star5: 1, avg: 3.4 }
      ],
      '6x6': [
        { pos: '1º', star2: 1, star3: 2, star4: 2, star5: 1, avg: 3.5 },
        { pos: '2º', star2: 1, star3: 3, star4: 1, star5: 1, avg: 3.5 },
        { pos: '3º', star2: 1, star3: 4, star4: 0, star5: 1, avg: 3.5 },
        { pos: '4º', star2: 0, star3: 2, star4: 2, star5: 1, avg: 3.5 },
        { pos: '5º', star2: 0, star3: 4, star4: 1, star5: 1, avg: 3.5 },
        { pos: '6º', star2: 1, star3: 3, star4: 1, star5: 1, avg: 3.4 },
        { pos: '7º', star2: 0, star3: 5, star4: 0, star5: 1, avg: 3.4 },
        { pos: '8º', star2: 1, star3: 2, star4: 2, star5: 1, avg: 3.3 },
        { pos: '9º', star2: 1, star3: 4, star4: 0, star5: 1, avg: 3.3 },
        { pos: '10º', star2: 0, star3: 2, star4: 3, star5: 1, avg: 3.3 },
        { pos: '11º', star2: 1, star3: 3, star4: 1, star5: 1, avg: 3.2 },
        { pos: '12º', star2: 1, star3: 4, star4: 0, star5: 1, avg: 3.2 },
        { pos: '13º', star2: 0, star3: 4, star4: 1, star5: 1, avg: 3.2 }
      ],
      '7x7': [
        { pos: '1º', star2: 1, star3: 0, star4: 5, star5: 1, avg: 4.1 },
        { pos: '2º', star2: 0, star3: 2, star4: 4, star5: 1, avg: 3.9 },
        { pos: '3º', star2: 0, star3: 3, star4: 3, star5: 1, avg: 3.7 },
        { pos: '4º', star2: 1, star3: 1, star4: 4, star5: 1, avg: 3.7 },
        { pos: '5º', star2: 0, star3: 3, star4: 4, star5: 0, avg: 3.6 },
        { pos: '6º', star2: 0, star3: 4, star4: 2, star5: 1, avg: 3.6 },
        { pos: '7º', star2: 1, star3: 1, star4: 5, star5: 0, avg: 3.4 },
        { pos: '8º', star2: 1, star3: 2, star4: 3, star5: 1, avg: 3.6 }
      ]
    };

    const currentPatterns = patterns[activeTab];
    
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-1 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                
              </th>
              <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                ⭐2
              </th>
              <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                ⭐3
              </th>
              <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                ⭐4
              </th>
              <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                ⭐5
              </th>
              <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Média
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {currentPatterns.map((pattern, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-1 py-2 whitespace-nowrap text-sm font-medium text-gray-900 w-16">
                  {pattern.pos}
                </td>
                <td className="px-2 py-2 whitespace-nowrap text-sm text-center text-gray-500">
                  {pattern.star2}
                </td>
                <td className="px-2 py-2 whitespace-nowrap text-sm text-center text-gray-500">
                  {pattern.star3}
                </td>
                <td className="px-2 py-2 whitespace-nowrap text-sm text-center text-gray-500">
                  {pattern.star4}
                </td>
                <td className="px-2 py-2 whitespace-nowrap text-sm text-center text-gray-500">
                  {pattern.star5}
                </td>
                <td className="px-2 py-2 whitespace-nowrap text-sm text-center font-medium">
                  <span className={`${
                    pattern.avg >= 3.8 ? 'text-green-600' : 
                    pattern.avg >= 3.5 ? 'text-yellow-600' : 'text-orange-600'
                  }`}>
                    {pattern.avg.toFixed(1)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-white to-gray-50 p-4 border-b-2 border-gray-200 shadow-lg">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
          >
            <span>←</span>
            <span>Voltar</span>
          </button>

          {/* TODO: Adicionar logo da aplicação */}
          <div className="w-16 h-16 bg-gray-200 rounded-xl flex items-center justify-center text-gray-500">
            Logo
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-5 pb-24 space-y-6">
        {/* Formulário de Configurações */}
        <section className="max-w-md mx-auto">
          <div className="bg-gradient-to-b from-white to-gray-50 rounded-2xl p-6 border-2 border-gray-200 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-8">
              
              {/* Jogadores por Time */}
              <div className="bg-gray-50 p-4 rounded-lg border">
                <label className="block text-sm font-bold text-gray-800 mb-4">
                  ⚽ Jogadores por Time (sem o goleiro)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[4, 5, 6, 7].map((valor) => (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => selecionarJogadores(valor)}
                      className={`py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                        regras.jogadores_por_time === valor
                          ? 'bg-blue-500 text-white shadow-lg'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {valor}
                    </button>
                  ))}
                </div>
              </div>

              {/* Modelo de Sorteio */}
              <div className="bg-gray-50 p-4 rounded-lg border">
                <label className="block text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span>🎲 Modelo de Sorteio</span>
                  <button
                    type="button"
                    onClick={scrollToPadroes}
                    className="text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-full w-6 h-6 flex items-center justify-center transition-colors"
                    title="Ver padrões de sorteio"
                  >
                    ❓
                  </button>
                </label>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setRegras({ ...regras, modelo_sorteio: 'equilibrado' })}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                      regras.modelo_sorteio === 'equilibrado'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Padrões Equilibrados
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegras({ ...regras, modelo_sorteio: 'aleatorio' })}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                      regras.modelo_sorteio === 'aleatorio'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Aleatório, não considera nível
                  </button>
                </div>
              </div>

              {/* Duração da Partida */}
              <div className="bg-gray-50 p-4 rounded-lg border">
                <label className="block text-sm font-bold text-gray-800 mb-4">
                  ⏱️ Duração da Partida
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="5"
                    max="90"
                    value={regras.duracao}
                    onChange={(e) => setRegras({ ...regras, duracao: parseInt(e.target.value) })}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                  <span className="text-gray-600 text-sm font-medium">minutos</span>
                </div>
              </div>

              {/* Após X vitórias consecutivas */}
              <div className="bg-gray-50 p-4 rounded-lg border">
                <label className="block text-sm font-bold text-gray-800 mb-4">
                  🏆 Após X vitórias consecutivas, o time sai?
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {['Não', 2, 3, 4].map((valor) => (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => setRegras({ ...regras, vitorias_consecutivas: valor === 'Não' ? 0 : valor as number })}
                      className={`py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                        (valor === 'Não' && regras.vitorias_consecutivas === 0) || regras.vitorias_consecutivas === valor
                          ? 'bg-blue-500 text-white shadow-lg'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {valor}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prioridade de Retorno */}
              <div className="bg-gray-50 p-4 rounded-lg border">
                <label className="block text-sm font-bold text-gray-800 mb-4">
                  🔄 Regra após Vitórias Consecutivas
                </label>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setRegras({ ...regras, prioridade_retorno: 'prioridade' })}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all text-left ${
                      regras.prioridade_retorno === 'prioridade'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    VENCEDOR retorna antes na fila
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegras({ ...regras, prioridade_retorno: 'sem_prioridade' })}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all text-left ${
                      regras.prioridade_retorno === 'sem_prioridade'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    PERDEDOR retorna antes na fila
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegras({ ...regras, prioridade_retorno: 'mesclar' })}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all text-left ${
                      regras.prioridade_retorno === 'mesclar'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    MESCLAR times no retorno
                  </button>
                </div>
              </div>

              {/* Regra de Empate */}
              <div className="bg-gray-50 p-4 rounded-lg border">
                <label className="block text-sm font-bold text-gray-800 mb-4">
                  ⚖️ Como funciona o empate?
                </label>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setRegras({ ...regras, regra_empate: 'ambos_saem' })}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all text-left ${
                      regras.regra_empate === 'ambos_saem'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    AMBOS times saem
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegras({ ...regras, regra_empate: 'desempate' })}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all text-left ${
                      regras.regra_empate === 'desempate'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Desempate no final da partida
                  </button>
                </div>
              </div>

              {/* Regra Após Empate */}
              <div className={`p-4 rounded-lg border transition-all ${
                regras.regra_empate === 'ambos_saem' 
                  ? 'bg-yellow-50 border-yellow-200' 
                  : 'bg-gray-50 border-gray-200 opacity-50'
              }`}>
                <label className={`block text-sm font-bold mb-4 ${
                  regras.regra_empate === 'ambos_saem' 
                    ? 'text-gray-800' 
                    : 'text-gray-500'
                }`}>
                  🔄 Regra após empate onde ambos saem
                </label>
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={regras.regra_empate !== 'ambos_saem'}
                    onClick={() => regras.regra_empate === 'ambos_saem' && setRegras({ ...regras, regra_apos_empate: 'desempate_decide' })}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all text-left ${
                      regras.regra_empate !== 'ambos_saem'
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : regras.regra_apos_empate === 'desempate_decide'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Desempate decide retorno a fila
                  </button>
                  <button
                    type="button"
                    disabled={regras.regra_empate !== 'ambos_saem'}
                    onClick={() => regras.regra_empate === 'ambos_saem' && setRegras({ ...regras, regra_apos_empate: 'mesclar_times' })}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all text-left ${
                      regras.regra_empate !== 'ambos_saem'
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : regras.regra_apos_empate === 'mesclar_times'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Mesclar times no retorno
                  </button>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetarPadrao}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <span>🔄</span>
                  <span>Padrão</span>
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white text-sm font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <span>💾</span>
                  <span>{isLoading ? 'Salvando...' : 'Salvar Regras'}</span>
                </button>
              </div>
            </form>

            {message && (
              <div className={`mt-4 p-3 rounded-lg ${message.includes('💾') || message.includes('🔄') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {message}
              </div>
            )}
          </div>
        </section>

        {/* Sistema de Sorteio Info */}
        <section id="padroes-sorteio">
          <div className="bg-gradient-to-b from-white to-gray-50 rounded-2xl p-6 border-2 border-gray-200 shadow-sm">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>🎲</span>
              <span>Sistema de Sorteio Profissional</span>
            </h3>
            
            <div className="space-y-4 text-gray-700">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">⚖️ Como Funciona</h4>
                <p className="text-sm mb-2">O sistema usa <strong>algoritmos inteligentes</strong> para formar times equilibrados:</p>
                <ul className="text-sm space-y-1 list-disc list-inside ml-4">
                  <li><strong>Padrões por formação:</strong> 4x4 (8 padrões), 5x5 (8 padrões), 6x6 (13 padrões), 7x7 (8 padrões)</li>
                  <li><strong>Ordem de prioridade:</strong> Testa padrões da maior para menor média de habilidade</li>
                  <li><strong>Distribuição inteligente:</strong> Equilibra jogadores ⭐2, ⭐3, ⭐4 e ⭐5 automaticamente</li>
                  <li><strong>Times incompletos:</strong> Mantém proporções quando sobram poucos jogadores</li>
                  <li><strong>Aleatoriedade garantida:</strong> Embaralha jogadores antes de aplicar padrões</li>
                  <li><strong>Fallback automático:</strong> Se não conseguir formar padrões, equilibra de forma aleatória</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-4">🥇 Ordem de Prioridade dos Padrões</h4>
                
                {/* Tabs para alternar entre formações */}
                <div className="mb-4">
                  <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8">
                      <button 
                        onClick={() => setActiveTab('4x4')}
                        className={`${
                          activeTab === '4x4' 
                            ? 'border-blue-500 text-blue-600' 
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
                      >
                        4x4
                      </button>
                      <button 
                        onClick={() => setActiveTab('5x5')}
                        className={`${
                          activeTab === '5x5' 
                            ? 'border-blue-500 text-blue-600' 
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
                      >
                        5x5
                      </button>
                      <button 
                        onClick={() => setActiveTab('6x6')}
                        className={`${
                          activeTab === '6x6' 
                            ? 'border-blue-500 text-blue-600' 
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
                      >
                        6x6
                      </button>
                      <button 
                        onClick={() => setActiveTab('7x7')}
                        className={`${
                          activeTab === '7x7' 
                            ? 'border-blue-500 text-blue-600' 
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
                      >
                        7x7
                      </button>
                    </nav>
                  </div>
                </div>

                {/* Tabela de padrões */}
                {renderPatternTable()}

                <div className="mt-3 text-xs text-gray-600 bg-gray-50 p-3 rounded-lg">
                  <p><strong>Como ler:</strong> Os números indicam quantos jogadores de cada nível de habilidade (2⭐, 3⭐, 4⭐, 5⭐) compõem cada time.</p>
                  <p><strong>Exemplo:</strong> Padrão 1º = 1 jogador 2⭐ + 0 jogadores 3⭐ + 3 jogadores 4⭐ + 1 jogador 5⭐ = Média 3,8</p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-2">🎯 Resultado</h4>
                <p className="text-sm">Sistema <strong>profissional</strong> que nunca quebra, sempre funciona e garante <strong>máxima variação</strong> entre sorteios, mantendo o equilíbrio competitivo.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer Mobile Navigation */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden z-50">
        <nav className="flex justify-around">
          <button
            onClick={() => router.push('/')}
            className="flex flex-col items-center justify-center p-3 text-gray-400 hover:bg-gray-50 transition-all duration-200 rounded-xl"
          >
            <span className="text-3xl mb-1">🏠</span>
          </button>
          
          <button
            onClick={() => router.push('/cadastro')}
            className="flex flex-col items-center justify-center p-3 text-gray-400 hover:bg-gray-50 transition-all duration-200 rounded-xl"
          >
            <span className="text-3xl mb-1">👤</span>
          </button>
          
          <button
            onClick={() => router.push('/sorteio')}
            className="flex flex-col items-center justify-center p-3 text-gray-400 hover:bg-gray-50 transition-all duration-200 rounded-xl"
          >
            <span className="text-3xl mb-1">🎲</span>
          </button>
        </nav>
      </footer>
    </div>
  );
}