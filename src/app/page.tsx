'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSystemAuth } from '@/contexts/SystemAuthContext';

export default function Home() {
  const { isSystemAuthenticated, isPelladaAuthenticated } = useSystemAuth();
  const router = useRouter();

  useEffect(() => {
    // Redirecionar baseado no estado de autenticação
    if (!isSystemAuthenticated) {
      router.push('/system-login');
    } else if (!isPelladaAuthenticated) {
      router.push('/pelada-login');
    } else {
      router.push('/dashboard');
    }
  }, [isSystemAuthenticated, isPelladaAuthenticated, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
          <span className="text-2xl">⚽</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">PeladM</h1>
        <p className="text-gray-600">Carregando sistema...</p>
      </div>
    </div>
  );
}
