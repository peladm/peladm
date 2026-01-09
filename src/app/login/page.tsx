'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '../../lib/supabase';
import { CONTATO } from '../../config/contato';
import { salvarCredenciais } from '../../lib/credenciais';

export default function Login() {
  const [peladaId, setPeladaId] = useState('');
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  
  const router = useRouter();

  // Login completo (Username + Senha)
  const handleLoginCompleto = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!peladaId || !usuario || !senha) {
      setError('Preencha todos os campos');
      setLoading(false);
      return;
    }

    try {
      
      const { data, error: dbError } = await supabase
        .from('clientes')
        .select('*')
        .eq('pelada_id', peladaId.toUpperCase())
        .eq('username', usuario)
        .eq('senha', senha)
        .single();
      
      if (dbError || !data) {
        console.error('❌ Erro:', dbError);
        setError('Código, usuário ou senha inválidos');
        setLoading(false);
        return;
      }

      if (data.status === 'bloqueado') {
        setShowBlockedModal(true);
        setPeladaId(data.pelada_id);
        setLoading(false);
        return;
      }

      if (data.status === 'inativo') {
        setError('⏸️ Pelada inativa');
        setLoading(false);
        return;
      }
      
      salvarCredenciais({
        pelada_id: data.pelada_id,
        username: data.username,
        senha: data.senha,
        plano: (data.plano || 'free').toLowerCase(),
        supabase_url: data.supabase_url,
        supabase_anon_key: data.supabase_anon_key
      });
      
      setLoading(false);
      window.location.href = '/';
      
    } catch (err) {
      console.error('💥 Erro no catch:', err);
      setError('Erro ao fazer login');
      setLoading(false);
    }
  };

  // Acesso visitante - REESCRITO DO ZERO
  const handleAcessoVisitante = async () => {
    setError('');
    setLoading(true);

    if (!peladaId) {
      setError('Digite o código da pelada');
      setLoading(false);
      return;
    }

    try {
      // Buscar cliente no banco
      const { data, error: dbError } = await supabase
        .from('clientes')
        .select('*')
        .eq('pelada_id', peladaId.toUpperCase())
        .maybeSingle();
      
      // Se houve erro na busca
      if (dbError) {
        setError('❌ Erro ao conectar ao banco');
        setLoading(false);
        setTimeout(() => router.push('/login'), 2000);
        return;
      }

      // Se não encontrou o código
      if (!data) {
        setError('❌ Código inválido');
        setLoading(false);
        setTimeout(() => router.push('/login'), 2000);
        return;
      }

      // Validar se é plano Premium
      const planoCliente = String(data.plano || '').trim().toLowerCase();
      if (planoCliente !== 'premium') {
        setError('❌ Apenas plano Premium tem acesso às estatísticas');
        setLoading(false);
        setTimeout(() => router.push('/login'), 3000);
        return;
      }

      // Validar status
      if (data.status === 'bloqueado') {
        setShowBlockedModal(true);
        setLoading(false);
        setTimeout(() => router.push('/login'), 3000);
        return;
      }

      if (data.status === 'inativo') {
        setError('⏸️ Pelada inativa');
        setLoading(false);
        setTimeout(() => router.push('/login'), 2000);
        return;
      }

      // Criar sessão visitante COM credenciais do banco dedicado
      const userSession = {
        id: data.pelada_id,
        nome: data.nome,
        plano: planoCliente,
        tipo_acesso: 'visitante',
        status: true,
        is_master: false
      };

      // Criar credenciais com dados do banco dedicado (necessário para acessar dados)
      const credenciais = {
        pelada_id: data.pelada_id,
        username: 'visitante',
        senha: '',
        plano: planoCliente,
        supabase_url: data.supabase_url || null,
        supabase_anon_key: data.supabase_anon_key || null
      };

      localStorage.setItem('user', JSON.stringify(userSession));
      localStorage.setItem('credenciais', JSON.stringify(credenciais));
      
      // Redirecionar para estatísticas
      setLoading(false);
      router.push('/resultados');
      
    } catch (err) {
      console.error('Erro no login visitante:', err);
      setError('❌ Erro ao processar login');
      setLoading(false);
      setTimeout(() => router.push('/login'), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      {showBlockedModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="mb-4"><span className="text-6xl">🚫</span></div>
              <h2 className="text-2xl font-bold text-gray-800 mb-3">Acesso Bloqueado</h2>
              <p className="text-gray-600 mb-6">
                Sua conta foi bloqueada. Entre em contato com o administrador.
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
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Acessar Pelada</h2>
            <p className="text-gray-600">Digite suas credenciais</p>
          </div>

          <form onSubmit={handleLoginCompleto}>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Código da Pelada</label>
                <input
                  type="text"
                  value={peladaId}
                  onChange={(e) => setPeladaId(e.target.value.toUpperCase())}
                  placeholder="Digite o código"
                  className="w-full h-12 px-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase"
                  maxLength={10}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Usuário</label>
                <input
                  type="text"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  className="w-full h-12 px-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Senha</label>
                <input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="w-full h-12 px-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>

              {error && (
                <div className="text-red-600 text-sm text-center bg-red-50 py-2 px-4 rounded-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-xl font-semibold transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
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

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500">ou</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                  Código da Pelada (apenas visitante)
                </label>
                <input
                  type="text"
                  value={peladaId}
                  onChange={(e) => setPeladaId(e.target.value.toUpperCase())}
                  placeholder="Ex: GD3974"
                  className="w-full h-12 px-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase text-center text-lg font-bold tracking-wider"
                  maxLength={6}
                />
              </div>

              <button
                type="button"
                onClick={handleAcessoVisitante}
                disabled={loading}
                className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 py-3 px-4 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center space-x-2 border border-blue-200"
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
          
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-center text-sm text-gray-600 mb-3">Ainda não tem uma conta?</p>
            
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

        <div className="text-center mt-8 space-y-4">
          <div>
            <Image src="/logo.png" alt="PelADM Logo" width={90} height={90} className="mx-auto mb-3" />
          </div>
          
          <div>
            <p className="text-sm font-medium text-gray-700">PelADM - Gestão Inteligente de Peladas</p>
            <p className="text-xs text-gray-500 mt-1">Versão 2.1.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}
