'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSystemAuth } from '@/contexts/SystemAuthContext';

export default function DashboardPage() {
  const { 
    isSystemAuthenticated,
    isPelladaAuthenticated,
    currentClient, 
    pelladaUser,
    pelladaLogout,
    systemLogout
  } = useSystemAuth();
  
  const router = useRouter();
  const [stats, setStats] = useState({
    totalJogadores: 0,
    peladasRealizadas: 0,
    golsMarcados: 0,
  });

  // Verificar autenticação
  useEffect(() => {
    if (!isSystemAuthenticated) {
      router.push('/system-login');
    } else if (!isPelladaAuthenticated) {
      router.push('/pelada-login');
    }
  }, [isSystemAuthenticated, isPelladaAuthenticated, router]);

  // Carregar estatísticas (placeholder por enquanto)
  useEffect(() => {
    if (isPelladaAuthenticated && currentClient) {
      // TODO: Buscar dados reais do Supabase do cliente
      setStats({
        totalJogadores: 25,
        peladasRealizadas: 8,
        golsMarcados: 156,
      });
    }
  }, [isPelladaAuthenticated, currentClient]);

  if (!isSystemAuthenticated || !isPelladaAuthenticated) {
    return <div>Redirecionando...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center mr-4">
                <span className="text-xl text-white">⚽</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{currentClient?.name}</h1>
                <p className="text-sm text-gray-500">
                  Bem-vindo, <span className="font-medium">{pelladaUser?.nome || pelladaUser?.username}</span>
                  {pelladaUser?.role === 'admin' && ' (Administrador)'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                Responsável: <span className="font-medium">{currentClient?.responsible_name}</span>
              </div>
              <div className="text-sm text-gray-500">
                Pelada: <span className="font-medium">{currentClient?.pelada_name}</span>
              </div>
              <button
                onClick={pelladaLogout}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md text-sm"
              >
                Trocar Usuário
              </button>
              <button
                onClick={systemLogout}
                className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-2 rounded-md text-sm"
              >
                Sair do Sistema
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Stats Cards */}
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">👥</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Jogadores</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalJogadores}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">⚽</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Peladas</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.peladasRealizadas}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">🥅</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Gols</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.golsMarcados}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Ações Rápidas</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button
                  onClick={() => router.push('/jogadores')}
                  className="p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <div className="text-2xl mb-2">👤</div>
                  <div className="text-sm font-medium">Cadastrar Jogadores</div>
                </button>
                
                <button
                  onClick={() => router.push('/sorteio')}
                  className="p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                >
                  <div className="text-2xl mb-2">🎲</div>
                  <div className="text-sm font-medium">Fazer Sorteio</div>
                </button>
                
                <button
                  onClick={() => router.push('/fila')}
                  className="p-4 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors"
                >
                  <div className="text-2xl mb-2">📋</div>
                  <div className="text-sm font-medium">Gerenciar Fila</div>
                </button>
                
                <button
                  onClick={() => router.push('/partida')}
                  className="p-4 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <div className="text-2xl mb-2">⚽</div>
                  <div className="text-sm font-medium">Iniciar Partida</div>
                </button>
              </div>
            </div>
          </div>

          {/* System Info */}
          <div className="mt-8 bg-gray-100 rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Informações do Sistema</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium">Cliente:</span>
                <div className="text-gray-600">{currentClient?.email}</div>
              </div>
              <div>
                <span className="font-medium">Responsável:</span>
                <div className="text-gray-600">{currentClient?.responsible_name}</div>
              </div>
              <div>
                <span className="font-medium">Pelada:</span>
                <div className="text-gray-600">{currentClient?.pelada_name}</div>
              </div>
              <div>
                <span className="font-medium">Telefone:</span>
                <div className="text-gray-600">{currentClient?.phone}</div>
              </div>
              <div>
                <span className="font-medium">Status:</span>
                <div className="text-green-600 capitalize">{currentClient?.status}</div>
              </div>
              <div>
                <span className="font-medium">Usuário:</span>
                <div className="text-gray-600">{pelladaUser?.username} ({pelladaUser?.role})</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}