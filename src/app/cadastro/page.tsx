'use client';

import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { jogadoresService, Jogador, supabase, validarSenhaPelada, getClienteSupabase } from '../../lib/supabase';
import { usePermissions } from '../../lib/usePermissions';
import { addToSyncQueue } from '../../lib/syncService';

export default function CadastroPage() {
  const { possuiPermissao, verificarLimite, nomePlano } = usePermissions();
  const [nome, setNome] = useState('');
  const [nivel, setNivel] = useState(3);
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [jogadorParaExcluir, setJogadorParaExcluir] = useState<{id: string, nome: string} | null>(null);

  useEffect(() => {
    testarConexaoECarregar();
    verificarPermissaoAdmin();
  }, []);

  const testarConexaoECarregar = async () => {
    try {
      // SUBSTITUIR PELA SUA LÓGICA DE BANCO DE DADOS
      await carregarJogadores();
    } catch (error: any) {
      console.error('❌ Erro na conexão:', error);
      mostrarMensagem('❌ Erro de conexão com o banco de dados', 'error');
    }
  };

  const verificarPermissaoAdmin = () => {
    const adminAuth = localStorage.getItem('adminAuth');
    const adminExpiry = localStorage.getItem('adminExpiry');
    const now = new Date().getTime();
    
    if (adminAuth === 'true' && adminExpiry && now < parseInt(adminExpiry)) {
      setIsAdmin(true);
    } else {
      localStorage.removeItem('adminAuth');
      localStorage.removeItem('adminExpiry');
      setIsAdmin(false);
    }
  };

  const carregarJogadores = async () => {
    try {
      setIsLoading(true);
      console.log('🔍 Carregando jogadores do Supabase...');
      
      // Debug: verificar se usuário está logado
      const user = localStorage.getItem('user');
      console.log('👤 Usuário logado:', user ? 'SIM' : 'NÃO');
      
      if (!user) {
        console.log('❌ Usuário não está logado, redirecionando para login...');
        mostrarMensagem('❌ Você precisa fazer login primeiro', 'error');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        return;
      }
      
      const userData = JSON.parse(user);
      console.log('🆔 ID do usuário:', userData.id);
      
      // Verificar modo offline
      const peladaId = userData.id;
      const regrasStr = localStorage.getItem(`regras_${peladaId}`);
      let modoOffline = false;
      
      if (regrasStr) {
        const regras = JSON.parse(regrasStr);
        modoOffline = regras.modo_sincronizacao === 'local_first';
      }
      
      let jogadoresData: Jogador[];
      
      if (modoOffline) {
        // MODO OFFLINE: Carregar do localStorage
        console.log('⚡ Modo offline: carregando do cache local');
        const jogadoresLocal = localStorage.getItem(`jogadores_${peladaId}`);
        jogadoresData = jogadoresLocal ? JSON.parse(jogadoresLocal) : [];
      } else {
        // MODO TEMPO REAL: Carregar do Supabase
        jogadoresData = await jogadoresService.buscarTodos();
      }
      
      setJogadores(jogadoresData);
      console.log(`✅ ${jogadoresData.length} jogadores carregados`);
      
      if (jogadoresData.length === 0) {
        mostrarMensagem('😴 Nenhum jogador cadastrado ainda', 'info');
      }
      
    } catch (error: any) {
      console.error('💥 Erro ao carregar jogadores:', error);
      if (error.message?.includes('não está logado')) {
        mostrarMensagem('❌ Sessão expirou. Faça login novamente.', 'error');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        mostrarMensagem('❌ Erro ao carregar jogadores do banco de dados', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nome.trim()) {
      mostrarMensagem('❌ Nome é obrigatório', 'error');
      return;
    }
    
    if (nome.trim().length < 2) {
      mostrarMensagem('❌ Nome deve ter pelo menos 2 caracteres', 'error');
      return;
    }

    // Verificar limite de jogadores para plano FREE
    if (!editandoId) { // Só verifica ao cadastrar novo
      const resultadoLimite = verificarLimite(jogadores.length + 1, 'limiteJogadores');
      if (!resultadoLimite.permitido) {
        mostrarMensagem(`❌ Limite de ${resultadoLimite.limite} jogadores atingido no plano ${nomePlano}. Faça upgrade!`, 'error');
        return;
      }
    }
    
    setIsLoading(true);
    
    try {
      // Verificar modo offline
      const userData = localStorage.getItem('user');
      if (!userData) {
        throw new Error('Usuário não encontrado');
      }
      
      const user = JSON.parse(userData);
      const peladaId = user.id;
      const regrasStr = localStorage.getItem(`regras_${peladaId}`);
      let modoOffline = false;
      
      if (regrasStr) {
        const regras = JSON.parse(regrasStr);
        modoOffline = regras.modo_sincronizacao === 'local_first';
      }
      
      if (editandoId) {
        // Atualizar jogador existente
        console.log('🔄 Atualizando jogador:', { id: editandoId, nome, nivel });
        
        if (modoOffline) {
          // MODO OFFLINE: Atualizar localStorage + syncQueue
          console.log('⚡ Modo offline: atualizando local');
          
          const jogadoresLocal = localStorage.getItem(`jogadores_${peladaId}`);
          if (jogadoresLocal) {
            const jogadoresArray = JSON.parse(jogadoresLocal);
            const index = jogadoresArray.findIndex((j: any) => j.id === editandoId);
            if (index !== -1) {
              jogadoresArray[index] = {
                ...jogadoresArray[index],
                nome: nome.trim(),
                nivel
              };
              localStorage.setItem(`jogadores_${peladaId}`, JSON.stringify(jogadoresArray));
            }
          }
          
          // Adicionar à fila de sync
          await addToSyncQueue({
            tipo: 'atualizar_jogador',
            jogador_id: editandoId,
            pelada_id: peladaId,
            dados: { nome: nome.trim(), nivel }
          });
          
          mostrarMensagem('✅ Jogador atualizado (sync pendente)', 'success');
        } else {
          // MODO TEMPO REAL: Salvar direto
          await jogadoresService.atualizar(editandoId, nome, nivel);
          mostrarMensagem('✅ Jogador atualizado com sucesso!', 'success');
        }
      } else {
        // Criar novo jogador
        console.log('➕ Criando novo jogador:', { nome, nivel });
        
        if (modoOffline) {
          // MODO OFFLINE: Salvar no localStorage + syncQueue
          console.log('⚡ Modo offline: salvando local');
          
          const novoJogador = {
            id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            nome: nome.trim(),
            nivel,
            status: 'ativo',
            pelada_id: peladaId,
            jogos: 0,
            vitorias: 0,
            gols: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          // Salvar no localStorage
          const jogadoresLocal = localStorage.getItem(`jogadores_${peladaId}`);
          const jogadoresArray = jogadoresLocal ? JSON.parse(jogadoresLocal) : [];
          jogadoresArray.push(novoJogador);
          localStorage.setItem(`jogadores_${peladaId}`, JSON.stringify(jogadoresArray));
          
          // Adicionar à fila de sync
          await addToSyncQueue({
            tipo: 'criar_jogador',
            pelada_id: peladaId,
            dados: novoJogador
          });
          
          mostrarMensagem('✅ Jogador cadastrado (sync pendente)', 'success');
        } else {
          // MODO TEMPO REAL: Salvar direto
          await jogadoresService.criar(nome, nivel);
          mostrarMensagem('✅ Jogador cadastrado com sucesso!', 'success');
        }
      }
      
      // Limpar formulário e recarregar lista
      setNome('');
      setNivel(3);
      setEditandoId(null);
      await carregarJogadores();
      
    } catch (error: any) {
      console.error('💥 Erro ao salvar jogador:', error);
      
      if (error.message?.includes('duplicate') || error.code === '23505') {
        mostrarMensagem('❌ Já existe um jogador com este nome', 'error');
      } else {
        mostrarMensagem('❌ Erro ao salvar jogador', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStarClick = (value: number) => {
    setNivel(value);
  };

  const editarJogador = (id: string) => {
    const jogador = jogadores.find(j => j.id === id);
    if (jogador) {
      setNome(jogador.nome);
      setNivel(jogador.nivel);
      setEditandoId(id);
      mostrarMensagem('✏️ Modo edição ativado', 'info');
      
      // Scroll para o formulário
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const cancelarEdicao = () => {
    setNome('');
    setNivel(3);
    setEditandoId(null);
  };

  const alternarStatus = async (id: string) => {
    const jogador = jogadores.find(j => j.id === id);
    if (!jogador) return;
    
    const statusAtual = jogador.status || 'ativo';
    const novoStatus = statusAtual === 'ativo' ? 'inativo' : 'ativo';
    const emoji = novoStatus === 'ativo' ? '🟢' : '🔴';
    const acao = novoStatus === 'ativo' ? 'ativar' : 'desativar';
    
    const confirmacao = window.confirm(`${emoji} Deseja ${acao} "${jogador.nome}"?`);
    if (!confirmacao) return;
    
    try {
      setIsLoading(true);
      console.log(`🔄 ${acao} jogador:`, { id, novoStatus });
      
      await jogadoresService.alterarStatus(id, novoStatus as 'ativo' | 'inativo');
      mostrarMensagem(`${emoji} Jogador ${acao}do com sucesso!`, 'success');
      await carregarJogadores();
      
    } catch (error: any) {
      console.error(`💥 Erro ao ${acao} jogador:`, error);
      mostrarMensagem(`❌ Erro ao ${acao} jogador`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const excluirJogador = async (id: string, nome: string) => {
    // Verificar se está em modo offline
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      const peladaId = user.id;
      const regrasStr = localStorage.getItem(`regras_${peladaId}`);
      
      if (regrasStr) {
        const regras = JSON.parse(regrasStr);
        if (regras.modo_sincronizacao === 'local_first') {
          mostrarMensagem('🚫 Exclusão bloqueada no modo offline! Desabilite o modo offline nas Regras para excluir jogadores.', 'error');
          return;
        }
      }
    }
    
    if (!isAdmin) {
      const senhaCorreta = await solicitarSenhaAdmin();
      if (!senhaCorreta) return;
    }
    
    // Abrir modal de confirmação em vez de window.confirm
    setJogadorParaExcluir({ id, nome });
    setShowConfirmModal(true);
  };
  
  const confirmarExclusao = async () => {
    if (!jogadorParaExcluir) return;
    
    setShowConfirmModal(false);
    
    try {
      setIsLoading(true);
      console.log('🗑️ Excluindo jogador:', jogadorParaExcluir);
      
      await jogadoresService.excluir(jogadorParaExcluir.id);
      mostrarMensagem('🗑️ Jogador excluído com sucesso!', 'success');
      await carregarJogadores();
      
    } catch (error: any) {
      console.error('💥 Erro ao excluir jogador:', error);
      
      if (error.message?.includes('violates foreign key constraint')) {
        mostrarMensagem('❌ Não é possível excluir: jogador está em uso no sistema', 'error');
      } else {
        mostrarMensagem('❌ Erro ao excluir jogador', 'error');
      }
    } finally {
      setIsLoading(false);
      setJogadorParaExcluir(null);
    }
  };
  
  const cancelarExclusao = () => {
    setShowConfirmModal(false);
    setJogadorParaExcluir(null);
  };

  const solicitarSenhaAdmin = async (): Promise<boolean> => {
    const user = localStorage.getItem('user');
    if (!user) {
      mostrarMensagem('❌ Usuário não está logado!', 'error');
      return false;
    }
    
    const userData = JSON.parse(user);
    const senha = window.prompt(`🔐 Digite a senha da pelada de ${userData.nome}:`);
    if (!senha) return false;
    
    // Validar usando função centralizada (async)
    const senhaValida = await validarSenhaPelada(senha);
    if (senhaValida) {
      setIsAdmin(true);
      const expiry = new Date().getTime() + (60 * 60 * 1000); // 1 hora
      localStorage.setItem('adminAuth', 'true');
      localStorage.setItem('adminExpiry', expiry.toString());
      mostrarMensagem('✅ Modo administrador ativado!', 'success');
      return true;
    } else {
      mostrarMensagem('❌ Senha da pelada incorreta!', 'error');
      return false;
    }
  };

  const toggleAdminMode = async () => {
    if (isAdmin) {
      setIsAdmin(false);
      localStorage.removeItem('adminAuth');
      localStorage.removeItem('adminExpiry');
      mostrarMensagem('🔐 Modo administrador desativado', 'info');
    } else {
      await solicitarSenhaAdmin();
    }
  };

  const mostrarMensagem = (texto: string, tipo: 'success' | 'error' | 'info' = 'info') => {
    setMessage(texto);
    setTimeout(() => setMessage(''), 3000);
  };

  const renderStars = (nivel: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span
        key={i}
        onClick={() => handleStarClick(i + 1)}
        className={`inline-block text-3xl cursor-pointer transition-all duration-200 hover:scale-125 ${
          i < nivel ? 'opacity-100 scale-110' : 'opacity-30'
        }`}
        style={{ 
          transform: i < nivel ? 'scale(1.1)' : 'scale(1)',
          marginRight: '10px'
        }}
      >
        ⭐
      </span>
    ));
  };

  // Ordenar jogadores: ativos primeiro, depois inativos, ambos em ordem alfabética
  const jogadoresOrdenados = jogadores.sort((a, b) => {
    const statusA = a.status || 'ativo';
    const statusB = b.status || 'ativo';
    
    if (statusA === statusB) {
      return a.nome.localeCompare(b.nome);
    }
    return statusA === 'ativo' ? -1 : 1; // ativos primeiro
  });

  return (
    <Layout title="Cadastro">
      {/* Toast Message */}
      {message && (
        <div
          className={`fixed top-5 left-1/2 transform -translate-x-1/2 px-5 py-3 rounded-lg text-white text-sm z-50 max-w-sm text-center shadow-lg ${
            message.includes('✅') ? 'bg-green-600' : 
            message.includes('❌') ? 'bg-red-600' : 
            'bg-blue-600'
          }`}
        >
          {message}
        </div>
      )}

      <div className="max-w-sm mx-auto space-y-5">
        {/* Formulário de Cadastro */}
        <section className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            
            {/* Input Nome */}
            <div className="flex flex-col gap-1">
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome do jogador"
                className="p-4 border-2 border-gray-100 rounded-2xl text-lg text-center bg-gray-50 focus:outline-none focus:border-green-600 focus:bg-white transition-colors"
                required
              />
            </div>

            {/* Selector de Estrelas - Apenas para Gold e Premium */}
            {possuiPermissao('cadastrarNivel') && (
              <div className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-2xl">
                <div className="flex gap-3 justify-center">
                  {renderStars(nivel)}
                </div>
              </div>
            )}

            {/* Botão Submit */}
            <div className="mt-1">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 p-4 bg-green-600 text-white rounded-2xl font-medium text-base hover:bg-green-700 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 transition-all duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
              >
                <span className="text-lg">
                  {isLoading ? '⏳' : (editandoId ? '💾' : '✅')}
                </span>
                <span>
                  {isLoading 
                    ? (editandoId ? 'Atualizando...' : 'Cadastrando...') 
                    : (editandoId ? 'Atualizar' : 'Cadastrar')
                  }
                </span>
              </button>
              
              {editandoId && (
                <button
                  type="button"
                  onClick={cancelarEdicao}
                  className="w-full mt-2 flex items-center justify-center gap-2 p-3 bg-gray-500 text-white rounded-2xl font-medium text-sm hover:bg-gray-600 transition-colors"
                >
                  <span>❌</span>
                  <span>Cancelar</span>
                </button>
              )}
            </div>
          </form>
        </section>

        {/* Lista de Jogadores */}
        <section className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-lg font-medium text-gray-800 m-0 flex items-center gap-2">
              <span>📋</span>
              <span>Jogadores Cadastrados</span>
            </h2>
            <button
              onClick={toggleAdminMode}
              className="w-7 h-7 bg-gray-50 hover:bg-gray-100 rounded-md flex items-center justify-center transition-all duration-200 opacity-60 hover:opacity-100 hover:scale-110"
              title={isAdmin ? "Desativar modo admin" : "Ativar modo admin"}
            >
              <span className="text-sm">{isAdmin ? '🔓' : '🔒'}</span>
            </button>
          </div>
          
          {jogadoresOrdenados.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <span className="text-4xl block mb-3 opacity-60">😴</span>
              <p>Nenhum jogador cadastrado ainda</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {jogadoresOrdenados.map((jogador) => {
                const nivelJogador = jogador.nivel || 3;
                const estrelas = '⭐'.repeat(nivelJogador) + '☆'.repeat(5 - nivelJogador);
                
                const isInativo = jogador.status === 'inativo';
                const statusEmoji = isInativo ? '🔴' : '🟢';
                
                return (
                  <div
                    key={jogador.id}
                    className={`flex justify-between items-center p-4 rounded-xl border-l-4 ${
                      isInativo 
                        ? 'bg-gray-100 border-l-gray-400 opacity-50' 
                        : 'bg-gray-50 border-l-green-600'
                    }`}
                  >
                    <div className="flex flex-col gap-1">
                      <div className={`text-base font-semibold ${
                        isInativo ? 'text-gray-500 line-through' : 'text-gray-800'
                      }`}>
                        {jogador.nome}
                      </div>
                      <div className="text-xs text-gray-600 opacity-80">
                        {estrelas}
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <button
                        onClick={() => editarJogador(jogador.id)}
                        className="w-9 h-9 bg-yellow-500 hover:bg-yellow-600 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-110"
                        title="Editar jogador"
                      >
                        <span className="text-base">✏️</span>
                      </button>
                      
                      <button
                        onClick={() => alternarStatus(jogador.id)}
                        className="w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-110 border border-gray-300"
                        title={isInativo ? 'Ativar jogador' : 'Desativar jogador'}
                      >
                        <span className="text-base">{statusEmoji}</span>
                      </button>
                      
                      {isAdmin && (
                        <button
                          onClick={() => excluirJogador(jogador.id, jogador.nome)}
                          className="w-9 h-9 bg-red-500 hover:bg-red-600 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-110"
                          title="Excluir jogador (apenas ADM)"
                        >
                          <span className="text-base">❌</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
      
      {/* Modal de Confirmação de Exclusão */}
      {showConfirmModal && jogadorParaExcluir && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="text-center">
              <div className="text-6xl mb-4">⚠️</div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                Confirmar Exclusão
              </h3>
              <p className="text-gray-600 mb-6">
                Tem certeza que deseja <span className="font-semibold text-red-600">excluir</span> o jogador:
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
                <p className="font-bold text-red-800 text-lg">
                  {jogadorParaExcluir.nome}
                </p>
              </div>
              <p className="text-sm text-red-600 mb-6 font-medium">
                ⚠️ Esta ação é IRREVERSÍVEL!
              </p>
              
              <div className="flex gap-3 justify-center">
                <button
                  onClick={cancelarExclusao}
                  className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors duration-200"
                >
                  🚫 Cancelar
                </button>
                <button
                  onClick={confirmarExclusao}
                  className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors duration-200"
                  disabled={isLoading}
                >
                  {isLoading ? '🔄 Excluindo...' : '🗑️ Excluir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}