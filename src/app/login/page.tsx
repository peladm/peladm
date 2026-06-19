'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
      
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pelada_id: peladaId, username: usuario, senha }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'bloqueado') {
          setShowBlockedModal(true);
          setPeladaId(data.pelada_id);
          setLoading(false);
          return;
        }
        if (data.error === 'inativo') {
          setError('⏸️ Pelada inativa');
          setLoading(false);
          return;
        }
        setError(data.error || 'Código, usuário ou senha inválidos');
        setLoading(false);
        return;
      }
      
      await salvarCredenciais({
        pelada_id: data.pelada_id,
        username: data.username,
        senha: data.senha,
        plano: data.plano,
        supabase_url: data.supabase_url,
        supabase_anon_key: data.supabase_anon_key,
        is_master: data.is_master === true
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
      const res = await fetch('/api/auth/visitante', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pelada_id: peladaId }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'somente_premium') {
          setError('❌ Apenas plano Premium tem acesso às estatísticas');
          setLoading(false);
          setTimeout(() => router.push('/login'), 3000);
          return;
        }
        if (data.error === 'bloqueado') {
          setShowBlockedModal(true);
          setLoading(false);
          return;
        }
        if (data.error === 'inativo') {
          setError('⏸️ Pelada inativa');
          setLoading(false);
          setTimeout(() => router.push('/login'), 2000);
          return;
        }
        setError(`❌ ${data.error || 'Código inválido'}`);
        setLoading(false);
        setTimeout(() => router.push('/login'), 2000);
        return;
      }

      localStorage.setItem('user', JSON.stringify({
        id: data.pelada_id,
        nome: data.nome,
        plano: data.plano,
        tipo_acesso: 'visitante',
        status: true,
        is_master: false
      }));
      localStorage.setItem('credenciais', JSON.stringify({
        pelada_id: data.pelada_id,
        username: 'visitante',
        senha: '',
        plano: data.plano,
        supabase_url: data.supabase_url || null,
        supabase_anon_key: data.supabase_anon_key || null,
        is_master: false
      }));
      
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
            <p className="text-lg font-bold text-gray-800">PeladaPLAY</p>
            <p className="text-xs text-gray-500">Gestão Inteligente de Peladas</p>
          </div>

          <form onSubmit={handleLoginCompleto}>
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap w-24">Código</label>
                <input
                  type="text"
                  value={peladaId}
                  onChange={(e) => setPeladaId(e.target.value.toUpperCase())}
                  placeholder="Código"
                  className="flex-1 h-10 px-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase text-sm"
                  maxLength={10}
                  required
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap w-24">Usuário</label>
                <input
                  type="text"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  className="flex-1 h-10 px-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                  required
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap w-24">Senha</label>
                <input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="flex-1 h-10 px-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
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
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-xl font-semibold transition-colors disabled:opacity-50 flex items-center justify-center space-x-2 mt-4"
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

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">ou</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                  Acesso Visitante
                </label>
                <input
                  type="text"
                  value={peladaId}
                  onChange={(e) => setPeladaId(e.target.value.toUpperCase())}
                  placeholder="Ex: GD3974"
                  className="w-full h-10 px-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase text-center text-sm font-bold tracking-wider"
                  maxLength={6}
                />
              </div>

              <button
                type="button"
                onClick={handleAcessoVisitante}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-xl font-semibold transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    <span>Acessando...</span>
                  </>
                ) : (
                  <>
                    <span>📊</span>
                    <span>Acesso Jogador</span>
                  </>
                )}
              </button>
              <p className="text-xs text-center text-gray-500">
                Apenas código da pelada • Acesso limitado
              </p>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200">
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
          </div>
        </div>
      </div>
    </div>
  );
}
