'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
// import { supabase } from '@/lib/supabase'; // REMOVER QUANDO USAR

interface Jogador {
  id: string;
  nome: string;
  nivel: number;
  status?: string;
  created_at: string;
  updated_at: string;
}

export default function CadastroPage() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [nivel, setNivel] = useState(3);
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

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
      // SUBSTITUIR PELA SUA LÓGICA DE CARREGAMENTO
      // Dados de teste por enquanto:
      setJogadores([
        { id: '1', nome: 'Adriano', nivel: 4, status: 'ativo', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: '2', nome: 'Castor', nivel: 3, status: 'ativo', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: '3', nome: 'Douglas Castro', nivel: 5, status: 'inativo', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      ]);
    } catch (error: any) {
      console.error('Erro ao carregar jogadores:', error);
      mostrarMensagem('❌ Erro ao carregar jogadores', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      if (!nome.trim()) {
        throw new Error('Nome é obrigatório');
      }

      if (nome.trim().length < 2) {
        throw new Error('Nome deve ter pelo menos 2 caracteres');
      }

      if (editandoId) {
        // SUBSTITUIR PELA SUA LÓGICA DE ATUALIZAÇÃO
        mostrarMensagem('✅ Jogador atualizado com sucesso!', 'success');
        cancelarEdicao();
        await carregarJogadores();
      } else {
        // SUBSTITUIR PELA SUA LÓGICA DE INSERÇÃO
        setNome('');
        setNivel(3);
        mostrarMensagem('✅ Jogador cadastrado com sucesso!', 'success');
        await carregarJogadores();
      }
      
    } catch (error: any) {
      mostrarMensagem(`❌ ${error.message}`, 'error');
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
      // SUBSTITUIR PELA SUA LÓGICA DE ATUALIZAÇÃO DE STATUS
      mostrarMensagem(`${emoji} Jogador ${acao}do com sucesso!`, 'success');
      await carregarJogadores();
    } catch (error: any) {
      mostrarMensagem(`❌ Erro ao ${acao} jogador`, 'error');
    }
  };

  const excluirJogador = async (id: string, nome: string) => {
    if (!isAdmin) {
      const senhaCorreta = await solicitarSenhaAdmin();
      if (!senhaCorreta) return;
    }
    
    const confirmacao = window.confirm(`🗑️ Tem certeza que deseja EXCLUIR PERMANENTEMENTE "${nome}"?\n\n⚠️ Esta ação não pode ser desfeita!`);
    if (!confirmacao) return;
    
    try {
      // SUBSTITUIR PELA SUA LÓGICA DE EXCLUSÃO
      mostrarMensagem('✅ Jogador excluído permanentemente!', 'success');
      await carregarJogadores();
    } catch (error: any) {
      mostrarMensagem('❌ Erro ao excluir jogador', 'error');
    }
  };

  const solicitarSenhaAdmin = async (): Promise<boolean> => {
    const senha = window.prompt('🔐 Digite a senha do administrador:');
    if (!senha) return false;
    
    // SUBSTITUIR PELA SUA LÓGICA DE VALIDAÇÃO DE SENHA
    if (senha === 'admin123') {
      setIsAdmin(true);
      const expiry = new Date().getTime() + (60 * 60 * 1000); // 1 hora
      localStorage.setItem('adminAuth', 'true');
      localStorage.setItem('adminExpiry', expiry.toString());
      mostrarMensagem('✅ Modo administrador ativado!', 'success');
      return true;
    } else {
      mostrarMensagem('❌ Senha incorreta!', 'error');
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
    <div className="min-h-screen bg-white overflow-x-hidden pb-20" style={{ 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      paddingBottom: '80px'
    }}>
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

      {/* Main Content */}
      <main className="pt-5">
        <div className="max-w-sm mx-auto px-5">
          
          {/* Formulário de Cadastro */}
          <section className="bg-white rounded-2xl p-6 mb-5 border border-gray-100 shadow-sm">
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

              {/* Selector de Estrelas */}
              <div className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-2xl">
                <div className="flex gap-3 justify-center">
                  {renderStars(nivel)}
                </div>
              </div>

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
                            <span className="text-base">🗑️</span>
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
      </main>

      {/* Footer Mobile Navigation */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40">
        <nav className="flex justify-around items-center py-3 px-4">
          <button
            onClick={() => router.push('/')}
            className="flex flex-col items-center justify-center p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-all duration-200"
          >
            <span className="text-3xl mb-1">🏠</span>
          </button>
          
          <button
            onClick={() => router.push('/cadastro')}
            className="flex flex-col items-center justify-center p-3 text-blue-600 bg-blue-50 rounded-xl shadow-sm border border-blue-100"
          >
            <span className="text-3xl mb-1">👤</span>
          </button>
          
          <button
            onClick={() => router.push('/sorteio')}
            className="flex flex-col items-center justify-center p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-all duration-200"
          >
            <span className="text-3xl mb-1">🎲</span>
          </button>
        </nav>
      </footer>
    </div>
  );
}