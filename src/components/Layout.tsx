'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { obterUsuario, temAcessoCompleto, ehVisitante, ehAdmin } from '../lib/verificarAcesso';
import AdBanner from './AdBanner';
import AdInterstitial from './AdInterstitial';
import { useAdInterstitial } from '../lib/useAdInterstitial';
import { CONTATO } from '../config/contato';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  onAdminClick?: () => void;
}

export default function Layout({ children, title = 'PeladM', onAdminClick }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  
  // Hook para gerenciar interstitials
  const { shouldShowInterstitial, resetInterstitial } = useAdInterstitial();
  
  // Estado do usuário
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [userPlan, setUserPlan] = useState('Free');
  const [clienteData, setClienteData] = useState<any>(null);
  const [tipoAcesso, setTipoAcesso] = useState<'completo' | 'visitante' | null>(null);
  const [isClient, setIsClient] = useState(false); // Evitar hydration mismatch
  const [isCheckingAuth, setIsCheckingAuth] = useState(true); // Estado de verificação de autenticação

  // Função para normalizar o plano do banco (lowercase) para o formato de exibição (capitalizado)
  const normalizarPlano = (plano: string): string => {
    const planoLower = plano?.toLowerCase();
    if (planoLower === 'premium') return 'Premium';
    if (planoLower === 'gold') return 'Gold';
    if (planoLower === 'free') return 'Free';
    return 'Free'; // fallback
  };

  // Marcar quando estiver no cliente
  useEffect(() => {
    setIsClient(true);
  }, []);

  // AuthGuard - Verificar autenticação e redirecionar se necessário
  useEffect(() => {
    if (!isClient) return; // Espera o cliente carregar
    
    const usuario = obterUsuario();
    const isPublicRoute = pathname === '/login' || pathname === '/cadastro-free';
    
    if (!usuario && !isPublicRoute) {
      // Usuário não logado tentando acessar rota protegida - redirecionar para login
      router.push('/login');
      return;
    }
    
    if (usuario && pathname === '/login') {
      // Usuário já logado acessando /login - redirecionar para home
      router.push('/');
      return;
    }
    
    setIsCheckingAuth(false);
  }, [isClient, pathname, router]);

  // Verificar se há usuário logado e buscar dados completos do Supabase
  useEffect(() => {
    const loadUserData = async () => {
      const usuario = obterUsuario();
      
      if (usuario) {
        setIsLoggedIn(true);
        setTipoAcesso(usuario.tipo_acesso);
        
        // Visitante tem dados limitados
        if (ehVisitante()) {
          setUserName('Visitante');
          setUserEmail('');
          setUserPlan(normalizarPlano(usuario.plano || 'Free'));
          setClienteData(usuario);
          return;
        }
        
        // Acesso completo - buscar dados do Supabase
        try {
          const { data: cliente, error } = await supabase
            .from('clientes')
            .select('*')
            .eq('id', usuario.id)
            .single();

          if (error) {
            console.error('Erro ao buscar dados do cliente:', error);
            setUserEmail(usuario.email || '');
            setUserName(usuario.usuario_pelada || usuario.nome);
            setUserPlan(normalizarPlano(usuario.plano || 'Free'));
            setClienteData(usuario);
          } else {
            setUserEmail(cliente.email);
            setUserName(usuario.usuario_pelada || cliente.nome);
            setUserPlan(normalizarPlano(cliente.plano || 'Free'));
            setClienteData(cliente);
          }
        } catch (err) {
          console.error('Erro na consulta:', err);
          setUserEmail(usuario.email || '');
          setUserName(usuario.usuario_pelada || usuario.nome);
          setUserPlan(normalizarPlano(usuario.plano || 'Free'));
          setClienteData(usuario);
        }
      }
    };

    loadUserData();
  }, []);

  // Função de logout
  const handleLogout = () => {
    localStorage.removeItem('user');
    setIsLoggedIn(false);
    setUserEmail('');
    setUserName('');
    setUserPlan('Free');
    setClienteData(null);
    setTipoAcesso(null);
    router.push('/login');
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const navigateTo = (page: string) => {
    router.push(`/${page}`);
    setIsSidebarOpen(false);
  };

  // Loading screen durante verificação de autenticação
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-green-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Overlay do menu lateral */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={toggleSidebar}
        />
      )}

      {/* Menu lateral */}
      <div className={`fixed top-0 left-0 h-full w-80 bg-white z-50 transform transition-transform duration-300 ease-in-out ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          {/* Header do menu */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Image src="/logo.png" alt="PeladM Logo" width={56} height={56} />
                <div>
                  <h2 className="text-2xl font-bold">
                    <span className="text-green-600">Pel</span>
                    <span className="text-gray-800">ADM</span>
                  </h2>
                </div>
              </div>
              <button
                onClick={toggleSidebar}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <span className="text-xl">✕</span>
              </button>
            </div>
          </div>

          {/* Área de Login/Logout */}
          <div className="px-6 py-4 border-b border-gray-200">
            {isLoggedIn ? (
              <>
                {/* Detalhes do usuário logado */}
                <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
                  <div className="text-sm text-gray-600 mb-2">
                    <span className="font-bold text-green-600">Versão {userPlan}</span>
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    Pelada ID: <span className="font-bold text-gray-800">{clienteData?.id || 'N/A'}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    Usuário: <span className="font-bold text-gray-800">{ehVisitante() ? 'Visitante' : userName}</span>
                  </div>
                </div>
                
                {/* Botão de Logout */}
                <button 
                  onClick={handleLogout}
                  className="w-full bg-red-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-red-700 transition-colors"
                >
                  🚪 Fazer Logoff
                </button>
              </>
            ) : (
              /* Botão de Login */
              <button 
                onClick={() => navigateTo('login')}
                className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-green-700 transition-colors"
              >
                🔑 Fazer Login
              </button>
            )}
          </div>

          {/* Espaço flexível para empurrar botões para baixo */}
          <div className="flex-1"></div>

          {/* Botão ADM Clientes - apenas para master (is_master = true) */}
          {isClient && clienteData?.is_master === true && (
            <div className="px-6 pb-4">
              <button
                onClick={() => navigateTo('admin/clientes')}
                className="w-full bg-gradient-to-r from-purple-600 to-red-600 hover:from-purple-700 hover:to-red-700 text-white py-4 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-3 shadow-lg"
              >
                <span>👥</span>
                <span>ADM Clientes</span>
              </button>
            </div>
          )}

          {/* Botão Gerenciar Usuários */}
          {isLoggedIn && (
            <div className="px-6 pb-4">
              <button
                onClick={() => {
                  navigateTo('usuarios');
                  toggleSidebar();
                }}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2 shadow-md"
              >
                <span>👥</span>
                <span>Manut. Usuários</span>
              </button>
            </div>
          )}

          {/* Botão de Suporte WhatsApp */}
          <div className="px-6 pb-4">
            <button
              onClick={() => window.open(`https://wa.me/${CONTATO.whatsapp}?text=${encodeURIComponent('Olá! Preciso de suporte no PelADM.')}`, '_blank')}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white py-3 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2 shadow-md"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              <span>Suporte</span>
            </button>
          </div>

          {/* Footer do menu - fixo embaixo */}
          <div className="p-6 border-t border-gray-200 mt-auto">
            <p className="text-xs text-gray-500 text-center">
              PeladM v1.0.0<br />
              Sistema de gestão de peladas
            </p>
          </div>
        </div>
      </div>

      {/* Conteúdo principal - SEMPRE FUNDO BRANCO */}
      <div className="min-h-screen bg-white">
        {/* Header */}
        <header className="bg-white shadow-lg border-b border-gray-200 sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-3 sm:py-4">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <button
                  onClick={toggleSidebar}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  title="Menu"
                >
                  <div className="w-5 h-5 sm:w-6 sm:h-6 flex flex-col justify-center space-y-1">
                    <div className="w-full h-0.5 bg-gray-600"></div>
                    <div className="w-full h-0.5 bg-gray-600"></div>
                    <div className="w-full h-0.5 bg-gray-600"></div>
                  </div>
                </button>
                <h1 className="text-lg sm:text-xl font-bold">
                  <span className="text-green-600">Pel</span>
                  <span className="text-gray-800">ADM</span>
                </h1>
              </div>
              
              {/* Logo no canto direito */}
              <div className="flex items-center">
                <Image src="/logo.png" alt="PeladM Logo" width={48} height={48} className="sm:w-14 sm:h-14" />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 pb-20 md:pb-8" style={{ paddingBottom: userPlan === 'Free' ? '224px' : '164px' }}>
          {children}
        </main>

        {/* Footer Mobile */}
        <footer className="fixed left-0 right-0 bg-white border-t border-gray-200 md:hidden z-30 safe-area-padding" style={{ bottom: userPlan === 'Free' ? '60px' : '0' }}>
          <nav className="flex py-2 px-4" style={{ minHeight: '84px' }}>
            {/* Rodapé varia baseado na página atual */}
            {title === 'Home' || title === 'PeladM' ? (
              // Rodapé da HOME
              <>
                <button
                  onClick={() => navigateTo('')}
                  className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-green-600 bg-green-50"
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">🏠</span>
                  <span className="text-xs font-medium mt-1">Home</span>
                </button>
                <button
                  onClick={() => navigateTo('cadastro')}
                  className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-gray-400"
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">🏃‍♂️</span>
                  <span className="text-xs font-medium mt-1">Cadastro</span>
                </button>
                <button
                  onClick={() => navigateTo('sorteio')}
                  className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-gray-400"
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">🎲</span>
                  <span className="text-xs font-medium mt-1">Sorteio</span>
                </button>
                <button
                  onClick={() => navigateTo('regras')}
                  className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-gray-400"
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">⚙️</span>
                  <span className="text-xs font-medium mt-1">Regras</span>
                </button>
              </>
            ) : title === 'Cadastro' ? (
              // Rodapé do CADASTRO
              <>
                <button
                  onClick={() => navigateTo('')}
                  className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors hover:bg-gray-100 text-gray-400"
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">🏠</span>
                  <span className="text-xs font-medium mt-1">Home</span>
                </button>
                <button
                  onClick={() => navigateTo('cadastro')}
                  className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-green-600 bg-green-50"
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">🏃‍♂️</span>
                  <span className="text-xs font-medium mt-1">Cadastro</span>
                </button>
                <button
                  onClick={() => navigateTo('sorteio')}
                  className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-gray-400"
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">🎲</span>
                  <span className="text-xs font-medium mt-1">Sorteio</span>
                </button>
                <button
                  onClick={() => navigateTo('regras')}
                  className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-gray-400"
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">⚙️</span>
                  <span className="text-xs font-medium mt-1">Regras</span>
                </button>
              </>
            ) : title === 'Sorteio' ? (
              // Rodapé do SORTEIO
              <>
                <button
                  onClick={() => navigateTo('')}
                  className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-gray-400"
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">🏠</span>
                  <span className="text-xs font-medium mt-1">Home</span>
                </button>
                <button
                  onClick={() => navigateTo('cadastro')}
                  className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-gray-400"
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">🏃‍♂️</span>
                  <span className="text-xs font-medium mt-1">Cadastro</span>
                </button>
                <button
                  onClick={() => navigateTo('sorteio')}
                  className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-green-600 bg-green-50"
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">🎲</span>
                  <span className="text-xs font-medium mt-1">Sorteio</span>
                </button>
                <button
                  onClick={() => navigateTo('regras')}
                  className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-gray-400"
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">⚙️</span>
                  <span className="text-xs font-medium mt-1">Regras</span>
                </button>
              </>
            ) : title === 'Regras' ? (
              // Rodapé do REGRAS
              <>
                <button
                  onClick={() => navigateTo('')}
                  className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-gray-400"
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">🏠</span>
                  <span className="text-xs font-medium mt-1">Home</span>
                </button>
                <button
                  onClick={() => navigateTo('cadastro')}
                  className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-gray-400"
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">🏃‍♂️</span>
                  <span className="text-xs font-medium mt-1">Cadastro</span>
                </button>
                <button
                  onClick={() => navigateTo('sorteio')}
                  className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-gray-400"
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">🎲</span>
                  <span className="text-xs font-medium mt-1">Sorteio</span>
                </button>
                <button
                  onClick={() => navigateTo('regras')}
                  className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-green-600 bg-green-50"
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">⚙️</span>
                  <span className="text-xs font-medium mt-1">Regras</span>
                </button>
              </>
            ) : title === 'Usuários' ? (
              // Rodapé do USUÁRIOS (mesmo padrão Home/Cadastro/Sorteio)
              <>
                <button
                  onClick={() => navigateTo('')}
                  className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-gray-400"
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">🏠</span>
                  <span className="text-xs font-medium mt-1">Home</span>
                </button>
                <button
                  onClick={() => navigateTo('cadastro')}
                  className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-gray-400"
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">🏃‍♂️</span>
                  <span className="text-xs font-medium mt-1">Cadastro</span>
                </button>
                <button
                  onClick={() => navigateTo('sorteio')}
                  className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-gray-400"
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">🎲</span>
                  <span className="text-xs font-medium mt-1">Sorteio</span>
                </button>
                <button
                  onClick={() => navigateTo('regras')}
                  className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-gray-400"
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">⚙️</span>
                  <span className="text-xs font-medium mt-1">Regras</span>
                </button>
              </>
            ) : (
              // Rodapé padrão (Estatísticas, Resultados, etc)
              <>
                <button
                  onClick={() => navigateTo('')}
                  className={`flex flex-col items-center justify-center py-2 rounded-lg transition-colors ${
                    title === 'Home' ? 'text-green-600 bg-green-50' : 'text-gray-400'
                  }`}
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">🏠</span>
                  <span className="text-xs font-medium mt-1">Home</span>
                </button>
                <button
                  onClick={() => navigateTo('estatisticas')}
                  className={`flex flex-col items-center justify-center py-2 rounded-lg transition-colors ${title === 'Estatísticas' ? 'text-green-600 bg-green-50' : 'text-gray-400'}`}
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">🏆</span>
                  <span className="text-xs font-medium mt-1">Estatísticas</span>
                </button>
                <button
                  onClick={() => navigateTo('resultados')}
                  className={`flex flex-col items-center justify-center py-2 rounded-lg transition-colors ${title === 'Resultados' ? 'text-green-600 bg-green-50' : 'text-gray-400'}`}
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">📊</span>
                  <span className="text-xs font-medium mt-1">Resultados</span>
                </button>
                <button
                  onClick={() => {
                    if (isClient && tipoAcesso === 'completo') {
                      if (onAdminClick) {
                        onAdminClick();
                      } else {
                        alert('🔒 Área administrativa - Em desenvolvimento');
                      }
                    } else {
                      alert('🚫 Acesso negado. Apenas usuários completos podem acessar o Admin.');
                    }
                  }}
                  className={`flex flex-col items-center justify-center py-2 rounded-lg transition-colors ${
                    isClient && tipoAcesso === 'completo' ? 'text-gray-400 hover:text-red-600 hover:bg-red-50' : 'text-gray-300 cursor-not-allowed opacity-50'
                  }`}
                  style={{ flex: 1 }}
                  title="Área administrativa"
                  disabled={!isClient || tipoAcesso !== 'completo'}
                >
                  <span className="text-2xl">{isClient && tipoAcesso === 'completo' ? '🔒' : '🚫'}</span>
                  <span className="text-xs font-medium mt-1">Admin</span>
                </button>
              </>
            )}
          </nav>
        </footer>

        {/* Banner de Anúncio Fixo (apenas FREE) */}
        <AdBanner position="bottom" />
        
        {/* Interstitial de Anúncio (tela cheia) */}
        {shouldShowInterstitial && (
          <AdInterstitial 
            onClose={resetInterstitial}
            motivo="navegacao"
          />
        )}
      </div>
    </>
  );
}