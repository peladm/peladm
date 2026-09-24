'use client';

import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { jogadoresService, Jogador, supabase, validarSenhaPelada } from '../../lib/supabase';
import { usePermissions } from '../../lib/usePermissions';
import { addToSyncQueue } from '../../lib/syncService';
import { logger } from '../../lib/logger';
import { buscar_pelada_id } from '../../lib/credenciais';

export default function CadastroPage() {
  const { possuiPermissao, verificarLimite } = usePermissions();
  const [nome, setNome] = useState('');
  const [nivel, setNivel] = useState(3);
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mostrarNiveisLista, setMostrarNiveisLista] = useState(true);
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
      logger.log('🔍 Carregando jogadores do Supabase...');
      
      const peladaId = buscar_pelada_id();
      logger.log('👤 Pelada ID:', peladaId ? 'SIM' : 'NÃO');
      
      if (!peladaId) {
        logger.log('❌ Usuário não está logado, redirecionando para login...');
        mostrarMensagem('❌ Você precisa fazer login primeiro', 'error');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        return;
      }
      
      logger.log('🆔 Pelada ID:', peladaId);
      
      // Verificar modo offline
      const regrasStr = localStorage.getItem(`regras_${peladaId}`);
      let modoOffline = false;
      
      if (regrasStr) {
        const regras = JSON.parse(regrasStr);
        modoOffline = regras.modo_sincronizacao === 'local_first';
      }
      
      let jogadoresData: Jogador[];
      
      if (modoOffline) {
        // MODO OFFLINE: Carregar do localStorage
        logger.log('⚡ Modo offline: carregando do cache local');
        const jogadoresLocal = localStorage.getItem(`jogadores_${peladaId}`);
        jogadoresData = jogadoresLocal ? JSON.parse(jogadoresLocal) : [];
      } else {
        // MODO TEMPO REAL: Carregar do Supabase
        jogadoresData = await jogadoresService.buscarTodos();
      }
      
      setJogadores(jogadoresData);
      logger.log(`✅ ${jogadoresData.length} jogadores carregados`);
      
      if (jogadoresData.length === 0) {
        mostrarMensagem('😴 Nenhum jogador cadastrado ainda', 'info');
      }
      
    } catch (error: any) {
      logger.error('💥 Erro ao carregar jogadores:', error);
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

    // Verificar limite de jogadores quando houver limite configurado
    if (!editandoId) { // Só verifica ao cadastrar novo
      const resultadoLimite = verificarLimite(jogadores.length + 1, 'limiteJogadores');
      if (!resultadoLimite.permitido) {
        mostrarMensagem(`❌ Limite de ${resultadoLimite.limite} jogadores atingido para este acesso.`, 'error');
        return;
      }
    }
    
    setIsLoading(true);
    
    try {
      const peladaId = buscar_pelada_id();
      if (!peladaId) {
        throw new Error('Usuário não encontrado');
      }
      const regrasStr = localStorage.getItem(`regras_${peladaId}`);
      let modoOffline = false;
      
      logger.log('🔍 DEBUG - Verificando modo:', {
        peladaId,
        chaveRegras: `regras_${peladaId}`,
        temRegrasNoStorage: !!regrasStr,
        regrasStr: regrasStr ? 'EXISTE' : 'NÃO EXISTE'
      });
      
      if (regrasStr) {
        const regras = JSON.parse(regrasStr);
        modoOffline = regras.modo_sincronizacao === 'local_first';
        
        // DEBUG: Mostrar modo ativo
        logger.log('🔍 DEBUG Modo:', {
          modo_sincronizacao: regras.modo_sincronizacao,
          modoOffline,
          comparacao: `'${regras.modo_sincronizacao}' === 'local_first' = ${modoOffline}`
        });
      } else {
        logger.log('⚠️ ATENÇÃO: Nenhuma regra encontrada no localStorage!');
        logger.log('⚠️ Chave procurada:', `regras_${peladaId}`);
        logger.log('⚠️ Todas as chaves no localStorage:', Object.keys(localStorage));
      }

      const posicaoPadrao: 'linha' = 'linha';

      if (editandoId) {
        // Atualizar jogador existente
        logger.log('🔄 Atualizando jogador:', { id: editandoId, nome, nivel });
        
        if (modoOffline) {
          // MODO OFFLINE: Atualizar localStorage + syncQueue
          logger.log('⚡ Modo offline: atualizando local');
          
          const jogadoresLocal = localStorage.getItem(`jogadores_${peladaId}`);
          if (jogadoresLocal) {
            const jogadoresArray = JSON.parse(jogadoresLocal);
            const index = jogadoresArray.findIndex((j: any) => j.id === editandoId);
            if (index !== -1) {
              jogadoresArray[index] = {
                ...jogadoresArray[index],
                nome: nome.trim(),
                nivel,
                posicao: posicaoPadrao
              };
              localStorage.setItem(`jogadores_${peladaId}`, JSON.stringify(jogadoresArray));
            }
          }
          
          // Adicionar à fila de sync
          await addToSyncQueue({
            tipo: 'atualizar_jogador',
            jogador_id: editandoId,
            pelada_id: peladaId,
            dados: { nome: nome.trim(), nivel, posicao: posicaoPadrao }
          });
          
          mostrarMensagem('✅ Jogador atualizado (sync pendente)', 'success');
        } else {
          // MODO TEMPO REAL: Salvar direto
          await jogadoresService.atualizar(editandoId, nome, nivel, undefined, posicaoPadrao);
          mostrarMensagem('✅ Jogador atualizado com sucesso!', 'success');
        }
      } else {
        // Criar novo jogador
        logger.log('➕ Criando novo jogador:', { nome, nivel });
        
        if (modoOffline) {
          // MODO OFFLINE: Salvar no localStorage + syncQueue
          logger.log('⚡ Modo offline: salvando local');
          
          const novoJogador = {
            id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            nome: nome.trim(),
            nivel,
            posicao: posicaoPadrao,
            status: 'ativo',
            pelada_id: peladaId,
            created_at: new Date().toISOString(),
            jogos: 0,
            vitorias: 0,
            derrotas: 0,
            gols: 0
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
          await jogadoresService.criar(nome, nivel, undefined, posicaoPadrao);
          mostrarMensagem('✅ Jogador cadastrado com sucesso!', 'success');
        }
      }
      
      // Limpar formulário e recarregar lista
      setNome('');
      setNivel(3);
      setEditandoId(null);
      await carregarJogadores();
      
    } catch (error: any) {
      logger.error('💥 Erro ao salvar jogador:', error);
      
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
    // Sugerir nível mínimo 2 para Gold e Premium
    if (possuiPermissao('cadastrarNivel') && value === 1) {
      mostrarMensagem('💡 Sugerimos no mínimo 2 estrelas para melhor classificação', 'info');
      return;
    }
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
      logger.log(`🔄 ${acao} jogador:`, { id, novoStatus });
      
      await jogadoresService.alterarStatus(id, novoStatus as 'ativo' | 'inativo');
      mostrarMensagem(`${emoji} Jogador ${acao}do com sucesso!`, 'success');
      await carregarJogadores();
      
    } catch (error: any) {
      logger.error(`💥 Erro ao ${acao} jogador:`, error);
      mostrarMensagem(`❌ Erro ao ${acao} jogador`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const excluirJogador = async (id: string, nome: string) => {
    // Verificar se está em modo offline
    const peladaId = buscar_pelada_id();
    if (peladaId) {
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
      logger.log('🗑️ Excluindo jogador:', jogadorParaExcluir);
      
      await jogadoresService.excluir(jogadorParaExcluir.id);
      mostrarMensagem('🗑️ Jogador excluído com sucesso!', 'success');
      await carregarJogadores();
      
    } catch (error: any) {
      logger.error('💥 Erro ao excluir jogador:', error);
      
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
    const peladaId = buscar_pelada_id();
    if (!peladaId) {
      mostrarMensagem('❌ Usuário não está logado!', 'error');
      return false;
    }
    
    const senha = window.prompt(`🔐 Digite a senha da pelada:`);
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
    return Array.from({ length: 5 }, (_, i) => {
      const nivelEstrela = i + 1;
      
      return (
        <span
          key={i}
          onClick={() => handleStarClick(nivelEstrela)}
          className={`inline-block text-lg transition-all duration-200 cursor-pointer hover:scale-125 ${
            i < nivel ? 'opacity-100 scale-110' : 'opacity-30'
          }`}
          style={{ 
            transform: i < nivel ? 'scale(1.1)' : 'scale(1)',
            marginRight: '3px'
          }}
        >
          ⭐
        </span>
      );
    });
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

      <div className="max-w-sm mx-auto space-y-3">
        {/* Formulário de Cadastro */}
        <section className="bg-white rounded-xl p-2 border border-gray-100 shadow-sm">
          <form onSubmit={handleSubmit} className="flex flex-col gap-1">
            
            <div className="flex flex-col gap-0.5">
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome do jogador"
                className="p-1.5 border-2 border-gray-100 rounded-lg text-sm text-center bg-gray-50 focus:outline-none focus:border-green-600 focus:bg-white transition-colors"
                required
              />
              {possuiPermissao('cadastrarNivel') && (
                <div className="flex items-center justify-center gap-1.5 p-1 bg-gray-50 rounded-lg">
                  <div className="flex gap-0.5">
                    {renderStars(nivel)}
                  </div>
                </div>
              )}
            </div>

            {/* Botão Submit */}
            <div className="mt-0">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 p-2 bg-green-600 text-white rounded-lg font-medium text-sm hover:bg-green-700 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 transition-all duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
              >
                <span className="text-base">
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
                  className="w-full mt-1 flex items-center justify-center gap-1.5 p-1.5 bg-gray-500 text-white rounded-lg font-medium text-xs hover:bg-gray-600 transition-colors"
                >
                  <span>❌</span>
                  <span>Cancelar</span>
                </button>
              )}
            </div>
          </form>
        </section>

        {/* Lista de Jogadores */}
        <section className="bg-white rounded-xl p-2 border border-gray-100 shadow-sm">
          <div className="flex justify-between items-center mb-1.5">
            <h2 className="text-sm font-medium text-gray-800 m-0 flex items-center gap-1">
              <span className="text-xs">📋</span>
              <span>Jogadores <span className="text-gray-500 font-normal">({jogadoresOrdenados.length})</span></span>
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setMostrarNiveisLista((prev) => !prev)}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-50 hover:bg-gray-100 text-gray-500 transition-colors"
                title={mostrarNiveisLista ? 'Ocultar níveis' : 'Mostrar níveis'}
                aria-pressed={mostrarNiveisLista}
              >
                <span className="text-[10px] leading-none">⭐</span>
                <span
                  className={`relative inline-flex h-3.5 w-6 items-center rounded-full transition-colors ${
                    mostrarNiveisLista ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${
                      mostrarNiveisLista ? 'translate-x-3' : 'translate-x-0.5'
                    }`}
                  />
                </span>
              </button>

              <button
                onClick={toggleAdminMode}
                className="w-5 h-5 bg-gray-50 hover:bg-gray-100 rounded flex items-center justify-center transition-all duration-200 opacity-60 hover:opacity-100 hover:scale-110"
                title={isAdmin ? "Desativar modo admin" : "Ativar modo admin"}
              >
                <span className="text-xs">{isAdmin ? '🔓' : '🔒'}</span>
              </button>
            </div>
          </div>
          
          {jogadoresOrdenados.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <span className="text-3xl block mb-2 opacity-60">😴</span>
              <p className="text-sm">Nenhum jogador cadastrado ainda</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {jogadoresOrdenados.map((jogador) => {
                const nivelJogador = jogador.nivel || 3;
                const estrelas = '⭐'.repeat(nivelJogador) + '☆'.repeat(5 - nivelJogador);
                
                const isInativo = jogador.status === 'inativo';
                const statusEmoji = isInativo ? '🔴' : '🟢';
                
                return (
                  <div
                    key={jogador.id}
                    className={`flex justify-between items-center p-1.5 rounded-lg border-l-4 ${
                      isInativo 
                        ? 'bg-gray-100 border-l-gray-400 opacity-50' 
                        : 'bg-gray-50 border-l-green-600'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className={`text-xs font-semibold truncate ${
                        isInativo ? 'text-gray-500 line-through' : 'text-gray-800'
                      }`}>
                        {jogador.nome}
                      </div>
                      {mostrarNiveisLista && (
                        <div className="text-xs text-gray-600 opacity-70 leading-none whitespace-nowrap">
                          {estrelas}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-1">
                      <button
                        onClick={() => editarJogador(jogador.id)}
                        className="w-6 h-6 bg-yellow-500 hover:bg-yellow-600 rounded flex items-center justify-center transition-all duration-200 hover:scale-110"
                        title="Editar jogador"
                      >
                        <span className="text-xs">✏️</span>
                      </button>
                      <button
                        onClick={() => alternarStatus(jogador.id)}
                        className="w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded flex items-center justify-center transition-all duration-200 hover:scale-110 border border-gray-300"
                        title={isInativo ? 'Ativar jogador' : 'Desativar jogador'}
                      >
                        <span className="text-xs">{statusEmoji}</span>
                      </button>
                      
                      {isAdmin && (
                        <button
                          onClick={() => excluirJogador(jogador.id, jogador.nome)}
                          className="w-6 h-6 bg-red-500 hover:bg-red-600 rounded flex items-center justify-center transition-all duration-200 hover:scale-110"
                          title="Excluir jogador (apenas ADM)"
                        >
                          <span className="text-xs">❌</span>
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