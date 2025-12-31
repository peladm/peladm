'use client';

import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../lib/usePermissions';

interface Usuario {
  id: string;
  username: string;
  senha: string;
  role: 'admin' | 'organizer';
  pelada_id?: string;
  created_at?: string;
  updated_at?: string;
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [username, setUsername] = useState('');
  const [senha, setSenha] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const { plano, permissoes } = usePermissions();

  useEffect(() => {
    carregarUsuarios();
  }, []);

  const mostrarMensagem = (texto: string, tipo: 'success' | 'error' = 'success') => {
    setMessage(texto);
    setTimeout(() => setMessage(''), 3000);
  };

  const carregarUsuarios = async () => {
    try {
      console.log('🔍 Carregando usuários...');
      
      // Buscar ID do cliente logado
      const userData = localStorage.getItem('user');
      if (!userData) {
        console.log('❌ Usuário não logado');
        return;
      }
      
      const user = JSON.parse(userData);
      const peladaId = user.id;
      
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('pelada_id', peladaId)
        .order('id', { ascending: false });
      
      if (error) throw error;
      
      setUsuarios(data || []);
      console.log(`✅ ${data?.length || 0} usuários carregados`);
      
    } catch (error: any) {
      console.error('💥 Erro ao carregar usuários:', error);
      mostrarMensagem('❌ Erro ao carregar usuários', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim() || !senha.trim()) {
      mostrarMensagem('❌ Por favor, preencha todos os campos', 'error');
      return;
    }
    
    if (username.length < 3) {
      mostrarMensagem('❌ Nome de usuário deve ter pelo menos 3 caracteres', 'error');
      return;
    }
    
    if (senha.length < 4) {
      mostrarMensagem('❌ Senha deve ter pelo menos 4 caracteres', 'error');
      return;
    }
    
    // Verificar limite de usuários para plano Free (não pode criar novos)
    if (!editandoId && plano === 'Free' && permissoes.limiteUsuarios !== null) {
      if (usuarios.length >= permissoes.limiteUsuarios) {
        mostrarMensagem('❌ Plano Free não permite cadastrar usuários adicionais. Faça upgrade para Gold ou Premium!', 'error');
        return;
      }
    }
    
    setIsLoading(true);
    
    try {
      // Buscar ID do cliente logado
      const userData = localStorage.getItem('user');
      if (!userData) throw new Error('Usuário não logado');
      
      const user = JSON.parse(userData);
      const peladaId = user.id;
      
      // Se está editando, manter o role original; senão, sempre criar como organizer
      let roleUsuario: 'admin' | 'organizer' = 'organizer';
      if (editandoId) {
        const usuarioExistente = usuarios.find(u => u.id === editandoId);
        if (usuarioExistente) {
          roleUsuario = usuarioExistente.role;
        }
      }
      
      const dadosUsuario = {
        username: username.trim(),
        senha: senha.trim(),
        role: roleUsuario,
        pelada_id: peladaId
      };
      
      if (editandoId) {
        // Atualizar usuário existente
        const { error } = await supabase
          .from('usuarios')
          .update(dadosUsuario)
          .eq('id', editandoId);
        
        if (error) throw error;
        mostrarMensagem('✅ Usuário atualizado com sucesso!');
      } else {
        // Criar novo usuário
        const { error } = await supabase
          .from('usuarios')
          .insert([dadosUsuario]);
        
        if (error) throw error;
        mostrarMensagem('✅ Usuário adicionado com sucesso!');
      }
      
      // Limpar formulário
      setEditandoId(null);
      setUsername('');
      setSenha('');
      
      // Recarregar lista
      await carregarUsuarios();
      
      // Forçar limpeza dos campos
      setTimeout(() => {
        setUsername('');
        setSenha('');
      }, 100);
      
    } catch (error: any) {
      console.error('💥 Erro ao salvar usuário:', error);
      
      if (error.code === '23505') {
        mostrarMensagem('❌ Já existe um usuário com este nome', 'error');
      } else {
        mostrarMensagem('❌ Erro ao salvar usuário', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const editarUsuario = (id: string) => {
    const usuario = usuarios.find(u => u.id === id);
    if (usuario) {
      setUsername(usuario.username);
      setSenha(usuario.senha);
      setEditandoId(id);
      mostrarMensagem('✏️ Modo edição ativado');
      
      // Scroll para o formulário
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const excluirUsuario = async (id: string) => {
    const usuario = usuarios.find(u => u.id === id);
    if (!usuario) return;
    
    const confirmacao = window.confirm(`🗑️ Deseja excluir o usuário "${usuario.username}"?`);
    if (!confirmacao) return;
    
    try {
      setIsLoading(true);
      
      const { error } = await supabase
        .from('usuarios')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      mostrarMensagem('🗑️ Usuário excluído com sucesso!');
      await carregarUsuarios();
      
    } catch (error: any) {
      console.error('💥 Erro ao excluir usuário:', error);
      mostrarMensagem('❌ Erro ao excluir usuário', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setUsername('');
    setSenha('');
    // Forçar limpeza dos campos
    setTimeout(() => {
      setUsername('');
      setSenha('');
    }, 0);
  };

  const getRoleDisplayName = (role: string) => {
    const roles = {
      'admin': '🔧 Admin',
      'organizer': '📋 Organizador'
    };
    return roles[role as keyof typeof roles] || role;
  };

  return (
    <Layout title="Usuários">
      <div className="max-w-md mx-auto p-5">
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

        {/* Formulário de Adicionar Usuário */}
        <section className="bg-white border-2 border-gray-100 rounded-2xl p-6 mb-5 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2 text-center">
                Nome do Usuário
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Digite o nome de usuário"
                className="w-full py-4 px-5 border-2 border-gray-100 rounded-2xl text-lg text-center bg-gray-50 focus:border-green-600 focus:bg-white transition-all duration-200"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2 text-center">
                Senha
              </label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Digite a senha"
                className="w-full py-4 px-5 border-2 border-gray-100 rounded-2xl text-lg text-center bg-gray-50 focus:border-green-600 focus:bg-white transition-all duration-200"
                required
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 flex items-center justify-center gap-2 py-4 px-5 rounded-2xl text-base font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-all duration-200"
              >
                <span>✅</span>
                <span>{editandoId ? 'Atualizar' : 'Adicionar'} Usuário</span>
              </button>
              
              {editandoId && (
                <button
                  type="button"
                  onClick={cancelarEdicao}
                  className="px-4 py-4 rounded-2xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all duration-200"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </section>

        {/* Lista de Usuários */}
        <section className="bg-white border-2 border-gray-100 rounded-2xl p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-gray-700 mb-5 text-center">👥 Usuários Cadastrados</h2>
          
          <div>
            {usuarios.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">👤</div>
                <p className="text-gray-500">Nenhum usuário cadastrado ainda</p>
              </div>
            ) : (
              usuarios.map((usuario) => (
                <div key={usuario.id} className="p-3 mb-2 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 space-y-1">
                      <div className="text-sm">
                        <span className="text-gray-500">Usuário: </span>
                        <span className="font-medium text-gray-800">{usuario.username}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-500">Senha: </span>
                        <span className="font-medium text-gray-800">{usuario.senha}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-500">Tipo: </span>
                        <span className={`text-xs px-2 py-0.5 rounded-lg ${
                          usuario.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {getRoleDisplayName(usuario.role)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => editarUsuario(usuario.id)}
                        className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors duration-200"
                        title="Editar usuário"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => excluirUsuario(usuario.id)}
                        className="p-2 rounded-lg bg-red-50 hover:bg-red-100 transition-colors duration-200"
                        title="Excluir usuário"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </Layout>
  );
}