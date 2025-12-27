'use client';

import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { supabase, validarSenhaPelada } from '../../lib/supabase';
import { usePermissions } from '../../lib/usePermissions';

interface Regras {
  jogadores_por_time: number;
  modelo_sorteio: 'equilibrado' | 'aleatorio';
  duracao: number;
  vitorias_consecutivas: number;
  prioridade_retorno: 'prioridade' | 'sem_prioridade' | 'mesclar' | 'perdedor_continua';
  regra_empate: 'ambos_saem' | 'desempate';
  regra_apos_empate: 'desempate_decide' | 'mesclar_times';
  empate_conta_vitoria: boolean;
  tipo_fila: 'modo_partida' | 'modo_prancheta';
}

export default function RegrasPage() {
  const { possuiPermissao, plano } = usePermissions();
  
  const [regras, setRegras] = useState<Regras>({
    jogadores_por_time: 5,
    modelo_sorteio: 'equilibrado',
    duracao: 10,
    vitorias_consecutivas: 0,
    prioridade_retorno: 'prioridade',
    regra_empate: 'ambos_saem',
    regra_apos_empate: 'desempate_decide',
    empate_conta_vitoria: false,
    tipo_fila: 'modo_prancheta'
  });
  const [activeTab, setActiveTab] = useState<'4x4' | '5x5' | '6x6' | '7x7'>('5x5');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSenhaModal, setShowSenhaModal] = useState(false);
  const [senhaDigitada, setSenhaDigitada] = useState('');
  const [sessaoAtiva, setSessaoAtiva] = useState(false);

  useEffect(() => {
    carregarRegras();
    verificarSessaoAtiva();
  }, []);

  const carregarRegras = async () => {
    try {
      console.log('🔍 Carregando regras do Supabase...');
      
      // Buscar ID do cliente logado
      const userData = localStorage.getItem('user');
      if (!userData) {
        console.log('⚠️ Usuário não logado, usando configurações padrão');
        return;
      }
      
      const user = JSON.parse(userData);
      const peladaId = user.id;
      
      // Buscar plano atualizado do cliente no Supabase
      console.log('🔍 Buscando plano do cliente ID:', peladaId);
      const { data: clienteData, error: clienteError } = await supabase
        .from('clientes')
        .select('plano')
        .eq('id', peladaId)
        .single();
      
      console.log('📦 Resposta do Supabase - clienteData:', clienteData);
      console.log('⚠️ Erro (se houver):', clienteError);
      
      if (clienteData) {
        const planoAtual = clienteData.plano || 'free';
        console.log('💳 Plano do usuário:', planoAtual);
      } else {
        console.log('❌ Nenhum dado de cliente retornado');
      }
      
      // Buscar regras no Supabase
      const { data: regrasSupabase, error } = await supabase
        .from('regras')
        .select('*')
        .eq('pelada_id', peladaId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          console.log('⚠️ Nenhuma configuração encontrada para este cliente, usando padrões');
        } else {
          console.error('💥 Erro ao buscar regras:', error);
        }
        return;
      }
      
      if (regrasSupabase) {
        // Compatibilizar valores antigos com novos
        let tipoFilaAtual = regrasSupabase.tipo_fila || 'modo_prancheta';
        if (tipoFilaAtual === 'fila1') tipoFilaAtual = 'modo_partida';
        if (tipoFilaAtual === 'fila2') tipoFilaAtual = 'modo_prancheta';
        
        setRegras({
          jogadores_por_time: regrasSupabase.jogadores_por_time || 5,
          modelo_sorteio: regrasSupabase.modelo_sorteio || 'equilibrado',
          duracao: regrasSupabase.duracao || 10,
          vitorias_consecutivas: regrasSupabase.vitorias_consecutivas || 0,
          prioridade_retorno: regrasSupabase.prioridade_retorno || 'prioridade',
          regra_empate: regrasSupabase.regra_empate || 'ambos_saem',
          regra_apos_empate: regrasSupabase.regra_apos_empate || 'desempate_decide',
          empate_conta_vitoria: regrasSupabase.empate_conta_vitoria || false,
          tipo_fila: tipoFilaAtual as 'modo_partida' | 'modo_prancheta'
        });
        console.log('✅ Regras carregadas do Supabase:', regrasSupabase);
      }
      
    } catch (error) {
      console.warn('💥 Erro ao carregar regras:', error);
      // Fallback para localStorage se Supabase falhar
      const regrasLocal = localStorage.getItem('regras_pelada');
      if (regrasLocal) {
        const regrasCarregadas = JSON.parse(regrasLocal);
        setRegras({
          jogadores_por_time: regrasCarregadas.jogadores_por_time || 5,
          modelo_sorteio: regrasCarregadas.modelo_sorteio || 'equilibrado',
          duracao: regrasCarregadas.duracao || 10,
          vitorias_consecutivas: regrasCarregadas.vitorias_consecutivas || 0,
          prioridade_retorno: regrasCarregadas.prioridade_retorno || 'prioridade',
          regra_empate: regrasCarregadas.regra_empate || 'ambos_saem',
          regra_apos_empate: regrasCarregadas.regra_apos_empate || 'desempate_decide',
          empate_conta_vitoria: regrasCarregadas.empate_conta_vitoria || false,
          tipo_fila: regrasCarregadas.tipo_fila || 'modo_prancheta'
        });
        console.log('✅ Regras carregadas do localStorage (fallback)');
      }
    }
  };

  const verificarSessaoAtiva = async () => {
    try {
      const userData = localStorage.getItem('user');
      if (!userData) return;

      const user = JSON.parse(userData);
      const peladaId = user.id;

      const { data: sessao } = await supabase
        .from('sessoes')
        .select('id')
        .eq('pelada_id', peladaId)
        .eq('status', 'ativa')
        .single();

      setSessaoAtiva(!!sessao);
    } catch (error) {
      console.error('Erro ao verificar sessão:', error);
      setSessaoAtiva(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Verificar se há sessão ativa
    if (sessaoAtiva) {
      setMessage('❌ Não é possível alterar regras com uma fila ativa!');
      setTimeout(() => setMessage(''), 4000);
      return;
    }
    
    // Abrir modal de confirmação
    setShowConfirmModal(true);
  };
  
  const abrirModalSenha = () => {
    setShowConfirmModal(false);
    setShowSenhaModal(true);
    setSenhaDigitada('');
  };

  const confirmarSalvamento = async () => {
    setShowSenhaModal(false);
    setIsLoading(true);
    setMessage('');

    // Validar senha usando função centralizada
    const senhaValida = await validarSenhaPelada(senhaDigitada);
    
    if (!senhaValida) {
      setMessage('❌ Senha incorreta!');
      setTimeout(() => setMessage(''), 3000);
      setIsLoading(false);
      return;
    }

    console.log('🚀 Salvando regras...');
    console.log('📋 Dados a serem salvos:', regras);

    try {
      // Plano FREE: salvar apenas no localStorage
      if (!possuiPermissao('usarSupabase')) {
        console.log('📦 Plano FREE: salvando regras no localStorage');
        localStorage.setItem('regras_pelada', JSON.stringify(regras));
        console.log('✅ Regras salvas no localStorage com sucesso');
        setMessage('💾 Regras salvas com sucesso!');
        setTimeout(() => setMessage(''), 3000);
        return;
      }

      // Plano GOLD/PREMIUM: salvar no Supabase
      console.log('☁️ Plano GOLD/PREMIUM: salvando regras no Supabase');
      
      // Buscar ID do cliente logado
      const userData = localStorage.getItem('user');
      if (!userData) {
        throw new Error('Usuário não logado');
      }
      
      const user = JSON.parse(userData);
      const peladaId = user.id;
      
      // Verificar se já existe configuração para este cliente
      const { data: regrasExistentes } = await supabase
        .from('regras')
        .select('id')
        .eq('pelada_id', peladaId)
        .single();
      
      const dadosRegras = {
        pelada_id: peladaId,
        jogadores_por_time: regras.jogadores_por_time,
        modelo_sorteio: regras.modelo_sorteio,
        tipo_fila: regras.tipo_fila,
        duracao: regras.duracao,
        vitorias_consecutivas: regras.vitorias_consecutivas,
        prioridade_retorno: regras.prioridade_retorno,
        regra_empate: regras.regra_empate,
        regra_apos_empate: regras.regra_apos_empate,
        empate_conta_vitoria: regras.empate_conta_vitoria
      };
      
      let resultado;
      
      if (regrasExistentes) {
        // Atualizar regras existentes
        resultado = await supabase
          .from('regras')
          .update(dadosRegras)
          .eq('pelada_id', peladaId);
        console.log('📝 Atualizando regras existentes...');
      } else {
        // Inserir novas regras
        resultado = await supabase
          .from('regras')
          .insert([dadosRegras]);
        console.log('➕ Inserindo novas regras...');
      }
      
      if (resultado.error) {
        throw new Error(resultado.error.message);
      }
      
      // Também salvar no localStorage como backup
      localStorage.setItem('regras_pelada', JSON.stringify(regras));
      
      console.log('✅ Regras salvas no Supabase com sucesso');
      setMessage('💾 Regras salvas com sucesso!');
      setTimeout(() => setMessage(''), 3000);
      
    } catch (error: any) {
      console.error('💥 Erro ao salvar regras:', error);
      setMessage(`❌ Erro ao salvar regras: ${error.message || 'Erro desconhecido'}`);
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const cancelarSalvamento = () => {
    setShowConfirmModal(false);
    setMessage('❌ Operação cancelada pelo usuário');
    setTimeout(() => setMessage(''), 3000);
  };

  const resetarPadrao = () => {
    setRegras({
      jogadores_por_time: 5,
      modelo_sorteio: 'equilibrado',
      duracao: 10,
      vitorias_consecutivas: 0,
      prioridade_retorno: 'prioridade',
      regra_empate: 'ambos_saem',
      regra_apos_empate: 'desempate_decide',
      empate_conta_vitoria: false,
      tipo_fila: 'modo_prancheta'
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
        { pos: '1º', star2: 1, star3: 1, star4: 3, star5: 1, avg: 3.8 },
        { pos: '2º', star2: 0, star3: 3, star4: 2, star5: 1, avg: 3.7 },
        { pos: '3º', star2: 1, star3: 2, star4: 2, star5: 1, avg: 3.7 },
        { pos: '4º', star2: 0, star3: 4, star4: 1, star5: 1, avg: 3.5 },
        { pos: '5º', star2: 1, star3: 3, star4: 1, star5: 1, avg: 3.5 },
        { pos: '6º', star2: 2, star3: 1, star4: 2, star5: 1, avg: 3.5 },
        { pos: '7º', star2: 0, star3: 5, star4: 0, star5: 1, avg: 3.3 },
        { pos: '8º', star2: 1, star3: 4, star4: 0, star5: 1, avg: 3.3 }
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
    <Layout title="Regras">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Formulário de Configurações */}
        <section>
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
              <div className="bg-gray-50 p-4 rounded-lg border relative">
                {/* Tarja Gold */}
                {!possuiPermissao('sorteioEquilibrado') && (
                  <div className="absolute top-2 right-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
                    <span>⭐</span>
                    <span>Gold</span>
                  </div>
                )}

                <label className="block text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
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
                {!possuiPermissao('sorteioEquilibrado') && (
                  <div className="mb-3 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2">
                    🔒 <strong>Sorteio equilibrado disponível no plano Gold e Premium</strong>. Faça upgrade para desbloquear.
                  </div>
                )}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (possuiPermissao('sorteioEquilibrado')) {
                        setRegras({ ...regras, modelo_sorteio: 'equilibrado' });
                      }
                    }}
                    disabled={!possuiPermissao('sorteioEquilibrado')}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all relative ${
                      regras.modelo_sorteio === 'equilibrado'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : !possuiPermissao('sorteioEquilibrado')
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {!possuiPermissao('sorteioEquilibrado') && (
                      <span className="absolute top-2 right-2">🔒</span>
                    )}
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

              {/* Vitórias Consecutivas */}
              <div className="bg-gray-50 p-4 rounded-lg border">
                <label className="block text-sm font-bold text-gray-800 mb-2">
                  🏆 Vitórias Consecutivas?
                </label>
                <p className="text-xs text-gray-600 mb-4">
                  Existe na pelada, limite para vitórias seguidas?
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {['Não', 2, 3, 4].map((valor) => (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => {
                        setRegras({ ...regras, vitorias_consecutivas: valor === 'Não' ? 0 : valor as number });
                      }}
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

              {/* Prioridade de Retorno - Desabilitado se vitórias consecutivas = Não */}
              <div className={`bg-gray-50 p-4 rounded-lg border ${regras.vitorias_consecutivas === 0 ? 'opacity-50' : ''}`}>
                <label className="block text-sm font-bold text-gray-800 mb-2">
                  🔄 Regra após Vitórias Consecutivas
                </label>
                <p className="text-xs text-gray-600 mb-4">
                  Como a fila deve agir, após atingir o limite de vitórias consecutivas
                </p>
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={regras.vitorias_consecutivas === 0}
                    onClick={() => setRegras({ ...regras, prioridade_retorno: 'prioridade' })}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all text-left ${
                      regras.prioridade_retorno === 'prioridade'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } ${regras.vitorias_consecutivas === 0 ? 'cursor-not-allowed' : ''}`}
                  >
                    Ambos saem e o VENCEDOR retorna 1º a fila
                  </button>
                  <button
                    type="button"
                    disabled={regras.vitorias_consecutivas === 0}
                    onClick={() => setRegras({ ...regras, prioridade_retorno: 'sem_prioridade' })}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all text-left ${
                      regras.prioridade_retorno === 'sem_prioridade'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } ${regras.vitorias_consecutivas === 0 ? 'cursor-not-allowed' : ''}`}
                  >
                    Ambos saem e o PERDEDOR retorna 1º a fila
                  </button>
                  <button
                    type="button"
                    disabled={regras.vitorias_consecutivas === 0}
                    onClick={() => setRegras({ ...regras, prioridade_retorno: 'mesclar' })}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all text-left ${
                      regras.prioridade_retorno === 'mesclar'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } ${regras.vitorias_consecutivas === 0 ? 'cursor-not-allowed' : ''}`}
                  >
                    Ambos saem e os times são mesclados no retorno
                  </button>
                  <button
                    type="button"
                    disabled={regras.vitorias_consecutivas === 0}
                    onClick={() => setRegras({ ...regras, prioridade_retorno: 'perdedor_continua' })}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all text-left ${
                      regras.prioridade_retorno === 'perdedor_continua'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } ${regras.vitorias_consecutivas === 0 ? 'cursor-not-allowed' : ''}`}
                  >
                    Vencedor sai e o PERDEDOR continua jogando
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
                    AMBOS os times saem
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
                    DESEMPATE no final da partida
                  </button>
                </div>
              </div>

              {/* Empate conta como vitória? - Só aparece se desempate E vitórias consecutivas ativo */}
              <div className={`p-4 rounded-lg border transition-all ${
                regras.regra_empate === 'desempate' && regras.vitorias_consecutivas > 0
                  ? 'bg-purple-50 border-purple-200' 
                  : 'bg-gray-50 border-gray-200 opacity-50'
              }`}>
                <label className={`block text-sm font-bold mb-4 ${
                  regras.regra_empate === 'desempate' && regras.vitorias_consecutivas > 0
                    ? 'text-gray-800' 
                    : 'text-gray-500'
                }`}>
                  🏆 Empate conta como vitória para as vitórias consecutivas?
                </label>
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={!(regras.regra_empate === 'desempate' && regras.vitorias_consecutivas > 0)}
                    onClick={() => (regras.regra_empate === 'desempate' && regras.vitorias_consecutivas > 0) && setRegras({ ...regras, empate_conta_vitoria: true })}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all text-left ${
                      regras.empate_conta_vitoria
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } ${!(regras.regra_empate === 'desempate' && regras.vitorias_consecutivas > 0) ? 'cursor-not-allowed' : ''}`}
                  >
                    SIM - Empate conta como vitória
                  </button>
                  <button
                    type="button"
                    disabled={!(regras.regra_empate === 'desempate' && regras.vitorias_consecutivas > 0)}
                    onClick={() => (regras.regra_empate === 'desempate' && regras.vitorias_consecutivas > 0) && setRegras({ ...regras, empate_conta_vitoria: false })}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all text-left ${
                      !regras.empate_conta_vitoria
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } ${!(regras.regra_empate === 'desempate' && regras.vitorias_consecutivas > 0) ? 'cursor-not-allowed' : ''}`}
                  >
                    NÃO - Empate não conta como vitória
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

              {/* Tipo de Fila */}
              <div className="bg-gray-50 p-4 rounded-lg border relative">
                {/* Tarja Premium */}
                {!possuiPermissao('usarPaginaPartida') && (
                  <div className="absolute top-2 right-2 bg-gradient-to-r from-amber-400 to-yellow-500 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
                    <span>👑</span>
                    <span>Premium</span>
                  </div>
                )}

                <label className="block text-sm font-bold text-gray-800 mb-2">
                  ⚽ Modo de Partida
                </label>
                {!possuiPermissao('usarModoPartida') && (
                  <div className="mb-3 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-center gap-1">
                    👑 <strong>Modo Partida exclusivo do plano Premium</strong>. Faça upgrade para desbloquear.
                  </div>
                )}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (possuiPermissao('usarModoPartida')) {
                        setRegras({ ...regras, tipo_fila: 'modo_partida' });
                      } else {
                        alert('👑 Modo Partida é exclusivo do plano Premium!\n\nFaça upgrade para ter acesso a estatísticas completas durante a partida.');
                      }
                    }}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all relative ${
                      regras.tipo_fila === 'modo_partida'
                        ? 'bg-purple-500 text-white shadow-lg'
                        : possuiPermissao('usarModoPartida')
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-60'
                    }`}
                  >
                    {!possuiPermissao('usarModoPartida') && (
                      <span className="absolute top-2 right-2 text-base">👑</span>
                    )}
                    Modo Partida (com estatísticas)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegras({ ...regras, tipo_fila: 'modo_prancheta' })}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                      regras.tipo_fila === 'modo_prancheta'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Modo Prancheta (simplificado)
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
      </div>
      
      {/* Modal de Confirmação de Salvamento */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="text-center">
              <div className="text-6xl mb-4">⚠️</div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">
                Confirmar Alterações
              </h3>
              <p className="text-gray-600 mb-4">
                Alterar as regras da pelada irá impactar todas as funcionalidades do aplicativo.
              </p>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-left">
                <h4 className="font-semibold text-yellow-800 mb-2">📋 Essas mudanças afetarão:</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Sistema de sorteio de times</li>
                  <li>• Mecânicas de fila e rotação</li>
                  <li>• Regras de empate e vitórias</li>
                  <li>• Duração das partidas</li>
                </ul>
              </div>
              
              <p className="text-sm text-red-600 mb-6 font-medium">
                ⚠️ Deseja realmente salvar essas alterações?
              </p>
              
              <div className="flex gap-3 justify-center">
                <button
                  onClick={cancelarSalvamento}
                  className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors duration-200"
                >
                  🚫 Cancelar
                </button>
                <button
                  onClick={abrirModalSenha}
                  className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors duration-200"
                >
                  ➡️ Continuar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Senha */}
      {showSenhaModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="text-center">
              <div className="text-6xl mb-4">🔐</div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">
                Autenticação Necessária
              </h3>
              <p className="text-gray-600 mb-6">
                Digite a senha da pelada para confirmar as alterações:
              </p>
              
              <input
                type="password"
                value={senhaDigitada}
                onChange={(e) => setSenhaDigitada(e.target.value)}
                placeholder="Digite a senha"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-6 text-center text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && senhaDigitada.trim()) {
                    confirmarSalvamento();
                  }
                }}
              />
              
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => {
                    setShowSenhaModal(false);
                    setSenhaDigitada('');
                  }}
                  className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors duration-200"
                >
                  🚫 Cancelar
                </button>
                <button
                  onClick={confirmarSalvamento}
                  className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors duration-200"
                  disabled={!senhaDigitada.trim() || isLoading}
                >
                  {isLoading ? '🔄 Salvando...' : '💾 Salvar Regras'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}