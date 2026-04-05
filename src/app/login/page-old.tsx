'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '../../lib/supabase';
import { CONTATO } from '../../config/contato';
import { salvarCredenciais } from '../../lib/credenciais';

export default function Login() {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!usuario || !senha) {
      setError('Preencha usuário e senha');
      setLoading(false);
      return;
    }

    try {
      // Buscar cliente na tabela clientes
      const { data, error } = await supabase
        .from('clientes')
        .select('pelada_id, username, senha, plano, supabase_url, supabase_anon_key, status, is_master')
        .eq('username', usuario)
        .eq('senha', senha)
        .single();
      
      if (error || !data) {
        setError('Usuário ou senha inválidos');
        setLoading(false);
        return;
      }

      // Salvar credenciais no localStorage
      await salvarCredenciais({
        pelada_id: data.pelada_id,
        username: data.username,
        senha: data.senha,
        plano: (data.plano || 'free').toLowerCase(),
        supabase_url: data.supabase_url,
        supabase_anon_key: data.supabase_anon_key,
        is_master: data.is_master === true
      });
      
      // Redirecionar
      router.push('/');
      
    } catch (err) {
      setError('Erro ao fazer login');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Card do Login */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Acessar Pelada</h2>
            <p className="text-gray-600">Digite suas credenciais</p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="space-y-3">
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
                  required
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
                  required
                />
              </div>

              {/* Mensagem de Erro */}
              {error && (
                <div className="text-red-600 text-sm text-center bg-red-50 py-2 px-4 rounded-lg">
                  {error}
                </div>
              )}

              {/* Botão Login */}
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