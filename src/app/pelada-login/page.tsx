'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSystemAuth } from '@/contexts/SystemAuthContext';

export default function PelladaLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { 
    isSystemAuthenticated, 
    currentClient, 
    pelladaLogin, 
    systemLogout 
  } = useSystemAuth();
  
  const router = useRouter();

  // Verificar se sistema está autenticado
  useEffect(() => {
    if (!isSystemAuthenticated || !currentClient) {
      router.push('/system-login');
    }
  }, [isSystemAuthenticated, currentClient, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const success = await pelladaLogin(username, password);
      
      if (success) {
        router.push('/dashboard'); // Redirecionar para dashboard principal
      } else {
        setError('Usuário ou senha incorretos');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login. Tente novamente.');
      console.error('Erro no login da pelada:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToSystem = () => {
    systemLogout();
    router.push('/system-login');
  };

  if (!isSystemAuthenticated || !currentClient) {
    return <div>Redirecionando...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">👥</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{currentClient.name}</h1>
          <p className="text-gray-600 mt-2">Acesso à Pelada</p>
          
          {/* Indicador de conexão */}
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700">
              ✅ Conectado ao sistema • <span className="font-medium">{currentClient.pelada_name}</span>
            </p>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
              Usuário da Pelada
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="admin"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Senha da Pelada
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            {isLoading ? 'Entrando...' : 'Entrar na Pelada'}
          </button>
        </form>

        {/* Development Info */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-medium text-blue-800 mb-2">📝 Configuração Inicial:</h3>
          <p className="text-xs text-blue-700 mb-2">
            <strong>Admin padrão:</strong> admin / senha123
          </p>
          <p className="text-xs text-blue-600">
            Você pode criar até 3 organizadores adicionais depois do primeiro login.
          </p>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={handleBackToSystem}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg text-sm transition-colors"
          >
            ← Voltar ao Sistema
          </button>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            Sistema: {currentClient.email} • Status: {currentClient.status}
          </p>
        </div>
      </div>
    </div>
  );
}