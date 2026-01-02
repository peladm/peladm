'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '../../lib/supabase';
import { CONTATO } from '../../config/contato';

export default function Login() {
  const [peladaId, setPeladaId] = useState('');
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  
  const router = useRouter();

  // Login completo (Pelada ID + Usuário + Senha)
  const handleLoginCompleto = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validação básica
    if (!peladaId || !usuario || !senha) {
      setError('Preencha todos os campos');
      setLoading(false);
      return;
    }

    try {
      // 1. Validar usuário na tabela usuarios
      const { data: usuarioData, error: userError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('pelada_id', peladaId.toUpperCase())
        .eq('username', usuario)
        .eq('senha', senha)
        .single();
      
      if (userError || !usuarioData) {
        setError('Pelada ID, usuário ou senha inválidos');
        setLoading(false);
        return;
      }

      // 2. Buscar dados do cliente (pelada) para informações adicionais
      const { data: clienteData, error: clienteError } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', peladaId.toUpperCase())
        .single();
      
      if (clienteError || !clienteData) {
        setError('Pelada não encontrada');
        setLoading(false);
        return;
      }

      // Verificar status do cliente
      if (clienteData.status === 'bloqueado') {
        setShowBlockedModal(true);
        setLoading(false);
        return;
      }

      if (clienteData.status === 'inativo') {
        setError('⏸️ Pelada inativa. Entre em contato com o administrador.');
        setLoading(false);
        return;
      }
      
      // Atualizar last_access no banco
      await supabase
        .from('clientes')
        .update({ last_access: new Date().toISOString() })
        .eq('id', peladaId.toUpperCase());
      
      setTimeout(() => {
        setLoading(false);
        // Salvar dados completos do usuário logado
        localStorage.setItem('user', JSON.stringify({
          id: clienteData.id, // pelada_id (ex: GD3974)
          nome: clienteData.nome,
          email: clienteData.email,
          usuario_pelada: usuarioData.username,
          senha_pelada: usuarioData.senha,
          plano: clienteData.plano || 'Básico',
          is_master: usuarioData.role === 'admin',
          status: true,
          tipo_acesso: 'completo' // Acesso completo
        }));
        router.push('/'); // Redireciona para home
      }, 1000);
      
    } catch (error) {
      console.error('Erro no login:', error);
      setError('Erro no servidor. Tente novamente.');
      setLoading(false);
    }
  };

  // Acesso visitante (apenas Pelada ID)
  const handleAcessoVisitante = async () => {
    setError('');
    setLoading(true);

    if (!peladaId) {
      setError('Digite o código da pelada');
      setLoading(false);
      return;
    }

    try {
      // Validar se pelada existe
      const { data: clienteData, error: clienteError } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', peladaId.toUpperCase())
        .single();
      
      if (clienteError || !clienteData) {
        setError('Código da pelada inválido');
        setLoading(false);
        return;
      }

      // Verificar status do cliente
      if (clienteData.status === 'bloqueado') {
        setShowBlockedModal(true);
        setLoading(false);
        return;
      }

      if (clienteData.status === 'inativo') {
        setError('⏸️ Pelada inativa. Entre em contato com o administrador.');
        setLoading(false);
        return;
      }

      setTimeout(() => {
        setLoading(false);
        // Salvar acesso visitante (limitado)
        localStorage.setItem('user', JSON.stringify({
          id: clienteData.id, // pelada_id (ex: GD3974)
          nome: clienteData.nome,
          plano: clienteData.plano || 'Básico',
          tipo_acesso: 'visitante', // Acesso limitado
          status: true,
          is_master: false
        }));
        router.push('/resultados'); // Redireciona direto para resultados
      }, 1000);
      
    } catch (error) {
      console.error('Erro no acesso visitante:', error);
      setError('Erro no servidor. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      {/* Modal de Bloqueio */}
      {showBlockedModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
            <div className="text-center">
              <div className="mb-4">
                <span className="text-6xl">🚫</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-3">Acesso Bloqueado</h2>
              <p className="text-gray-600 mb-6">
                Sua conta foi bloqueada. Entre em contato com o administrador para mais informações.
              </p>
              <div className="space-y-3">
                <a
                  href={`https://wa.me/${CONTATO.whatsapp}?text=${encodeURIComponent('Olá! Minha conta foi bloqueada. Pelada ID: ' + peladaId)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-xl font-semibold transition-colors flex items-center justify-center space-x-2"
                >
                  <span>💬</span>
                  <span>Falar com Administrador</span>
                </a>
                <button
                  onClick={() => {
                    setShowBlockedModal(false);
                    setPeladaId('');
                    setUsuario('');
                    setSenha('');
                  }}
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 px-4 rounded-xl font-semibold transition-colors"
                >
                  Voltar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-md w-full">
        {/* Card do Login */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Acessar Pelada</h2>
            <p className="text-gray-600">Digite suas credenciais</p>
          </div>

          <form onSubmit={handleLoginCompleto}>
            <div className="space-y-3">
              {/* Campo Código da Pelada */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Código da Pelada
                </label>
                <input
                  type="text"
                  value={peladaId}
                  onChange={(e) => setPeladaId(e.target.value.toUpperCase())}
                  className="w-full h-12 px-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase text-center text-lg font-bold tracking-wider"
                  maxLength={6}
                  required
                />
              </div>

              {/* Campo Usuário */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Usuário
                </label>
                <input
                  type="text"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  className="w-full h-12 px-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* Campo Senha */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Senha
                </label>
                <input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="w-full h-12 px-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* Mensagem de Erro */}
              {error && (
                <div className="text-red-600 text-sm text-center bg-red-50 py-2 px-4 rounded-lg">
                  {error}
                </div>
              )}

              {/* Botão Login Completo */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    <span>Entrando...</span>
                  </>
                ) : (
                  <>
                    <span>⚽</span>
                    <span>Entrar</span>
                  </>
                )}
              </button>

              {/* Divisor */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500">ou</span>
                </div>
              </div>

              {/* Botão Acesso Visitante */}
              <button
                type="button"
                onClick={handleAcessoVisitante}
                disabled={loading}
                className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 py-3 px-4 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 border border-blue-200"
              >
                <span>📊</span>
                <span>Ver Estatísticas</span>
                <span>📊</span>
              </button>
              <p className="text-xs text-center text-gray-500">
                Apenas código da pelada • Acesso limitado
              </p>
            </div>
          </form>
          
          {/* Seção de Cadastro */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-center text-sm text-gray-600 mb-3">Ainda não tem uma conta?</p>
            
            {/* Botão Criar Conta GRÁTIS */}
            <button
              type="button"
              onClick={() => router.push('/cadastro-free')}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-3 px-4 rounded-xl font-bold transition-all transform hover:scale-[1.02] flex items-center justify-center space-x-2 shadow-md"
            >
              <span>🎉</span>
              <span>Criar Conta GRÁTIS</span>
            </button>
            <p className="text-xs text-center text-gray-500 mt-2">
              25 jogadores • 10 partidas • Com Anúncios
            </p>
            
            {/* Link Gold/Premium */}
            <div className="mt-4 text-center">
              <a
                href={`https://wa.me/${CONTATO.whatsapp}?text=${encodeURIComponent(CONTATO.mensagemGoldPremium)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
              >
                <span>💎</span>
                <span>Quer Gold ou Premium?</span>
              </a>
              <p className="text-xs text-gray-400 mt-1">Mais jogadores, sem anúncios, estatísticas completas</p>
            </div>
          </div>
        </div>

        {/* Footer com Logo e Info */}
        <div className="text-center mt-8 space-y-4">
          {/* Logo */}
          <div>
            <Image src="/logo.png" alt="PelADM Logo" width={90} height={90} className="mx-auto mb-3" />
          </div>
          
          {/* Informações */}
          <div>
            <p className="text-sm text-gray-500">Sistema de gestão de peladas</p>
            <p className="text-xs text-gray-400 mt-2">v1.0.0 • © 2025 PelADM</p>
          </div>
        </div>
      </div>
    </div>
  );
}