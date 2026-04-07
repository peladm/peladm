'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { obterCredenciais, buscar_pelada_id } from '../lib/credenciais';
import { obterUsuario, temAcessoCompleto, ehVisitante, ehAdmin, redirecionarSeNaoTemAcesso } from '../lib/verificarAcesso';
import AdBanner from './AdBanner';
import AdInterstitial from './AdInterstitial';
import { useAdInterstitial } from '../lib/useAdInterstitial';
import { CONTATO } from '../config/contato';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  onAdminClick?: () => void;
  hideFooter?: boolean;
}

export default function Layout({ children, title = 'PeladaPLAY', onAdminClick, hideFooter = false }: LayoutProps) {
  const MOBILE_FOOTER_PREF_KEY = 'peladm:mobileFooterCollapsed:stats';
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [versionInfo, setVersionInfo] = useState<any>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [mobileFooterCollapsed, setMobileFooterCollapsed] = useState(false);
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
  const [torneioSteps, setTorneioSteps] = useState({
    regras: false,
    participantes: false,
    sortearTimes: false,
    chaveamento: false,
  });
  const telasEstatisticas = ['/resultados', '/estatisticas', '/classificacao', '/individual', '/x1'];
  const menuRapidoHabilitado = telasEstatisticas.some((rota) => pathname?.startsWith(rota));

  useEffect(() => {
    if (!isClient) return;
    try {
      const saved = localStorage.getItem(MOBILE_FOOTER_PREF_KEY);
      setMobileFooterCollapsed(saved === '1');
    } catch {
      setMobileFooterCollapsed(false);
    }
  }, [isClient]);

  const toggleMobileFooter = () => {
    const next = !mobileFooterCollapsed;
    setMobileFooterCollapsed(next);
    try {
      localStorage.setItem(MOBILE_FOOTER_PREF_KEY, next ? '1' : '0');
    } catch {
      // Ignora falhas de storage sem impactar a navegação
    }
  };

  const mainPaddingBottom = (() => {
    const base = userPlan === 'Free' ? 224 : 164;
    const reduced = menuRapidoHabilitado && mobileFooterCollapsed ? 88 : 0;
    return `calc(${Math.max(base - reduced, 80)}px + var(--safe-area-bottom))`;
  })();

  const toggleButtonBottom = menuRapidoHabilitado
    ? (mobileFooterCollapsed
      ? (userPlan === 'Free' ? 'calc(68px + var(--safe-area-bottom))' : 'calc(10px + var(--safe-area-bottom))')
      : (userPlan === 'Free' ? 'calc(128px + var(--safe-area-bottom))' : 'calc(78px + var(--safe-area-bottom))'))
    : 'calc(10px + var(--safe-area-bottom))';

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
    const isPublicRoute = pathname === '/login' || pathname === '/cadastro-free' || pathname === '/resgate';
    
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

    const redirecionamento = redirecionarSeNaoTemAcesso(pathname);
    if (redirecionamento && redirecionamento !== pathname) {
      router.push(redirecionamento);
      return;
    }
    
    setIsCheckingAuth(false);
  }, [isClient, pathname, router]);

  // Verificar progresso do torneio para rodapé do modo torneio
  useEffect(() => {
    if (!isClient || !pathname?.startsWith('/modo-torneio')) return;

    const verificarSteps = () => {
      try {
        const pid = buscar_pelada_id() || 'default';
        const setupRaw = localStorage.getItem(`setup_competicao_${pid}`);
        const torneioRaw = localStorage.getItem(`torneio_ativo_${pid}`);
        const regrasEnabled = !!(setupRaw || torneioRaw);

        if (!torneioRaw) {
          setTorneioSteps({ regras: regrasEnabled, participantes: false, sortearTimes: false, chaveamento: false });
          return;
        }

        const torneio = JSON.parse(torneioRaw);
        if (torneio.status !== 'ativo' && torneio.status !== 'rascunho') {
          setTorneioSteps({ regras: regrasEnabled, participantes: false, sortearTimes: false, chaveamento: false });
          return;
        }

        const torneioId = torneio.id;

        const regrasRaw = localStorage.getItem(`regras_competicao_${pid}_${torneioId}`);
        const participantesEnabled = !!regrasRaw;

        const participantesRaw = localStorage.getItem(`participantes_torneio_${pid}_${torneioId}`);
        let sortearEnabled = false;
        if (participantesRaw) {
          const parts = JSON.parse(participantesRaw);
          sortearEnabled = parts.some((p: { status: string }) => p.status === 'confirmado');
        }

        const equipesRaw = localStorage.getItem(`equipes_torneio_${pid}_${torneioId}`);
        let chaveamentoEnabled = false;
        if (equipesRaw) {
          const equipes = JSON.parse(equipesRaw);
          chaveamentoEnabled = equipes.length > 0;
        }

        setTorneioSteps({ regras: regrasEnabled, participantes: participantesEnabled, sortearTimes: sortearEnabled, chaveamento: chaveamentoEnabled });
      } catch {
        // mantém estado atual
      }
    };

    verificarSteps();
    window.addEventListener('torneio-steps-changed', verificarSteps);
    return () => window.removeEventListener('torneio-steps-changed', verificarSteps);
  }, [isClient, pathname]);

  // Verificar se há usuário logado e buscar dados completos do Supabase
  useEffect(() => {
    const loadUserData = async () => {
      const usuario = obterUsuario();
      const credenciais = obterCredenciais();
      
      if (usuario || credenciais) {
        setIsLoggedIn(true);
        
        // Se tem credenciais, usar elas (novo sistema)
        if (credenciais) {
          const tipoAcessoCredenciais = credenciais.username === 'visitante' ? 'visitante' : 'completo';
          setTipoAcesso(tipoAcessoCredenciais);
          setUserName(credenciais.username);
          setUserPlan(normalizarPlano(credenciais.plano || 'free'));
          setClienteData({
            pelada_id: credenciais.pelada_id,
            username: credenciais.username,
            plano: credenciais.plano,
            supabase_url: credenciais.supabase_url,
            supabase_anon_key: credenciais.supabase_anon_key,
            is_master: credenciais.is_master === true
          });
          return;
        }
        
        // Fallback para sistema antigo (visitante)
        if (usuario) {
          setTipoAcesso(usuario.tipo_acesso);
          
          // Visitante tem dados limitados
          if (ehVisitante()) {
            setUserName('Visitante');
            setUserEmail('');
            setUserPlan(normalizarPlano(usuario.plano || 'Free'));
            setClienteData(usuario);
            return;
          }
          
          // Acesso completo - usar dados locais para evitar leitura sensível no cliente
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
    console.log('🚪 Realizando logout e limpando cache...');
    
    // Limpar dados do usuário (sistema novo e antigo)
    localStorage.removeItem('user');
    localStorage.removeItem('credenciais');
    
    // Limpar estados de partida/prancheta
    localStorage.removeItem('partida_em_andamento');
    localStorage.removeItem('modo_partida_estado');
    localStorage.removeItem('modo_prancheta_ativo');
    localStorage.removeItem('cronometro_partida');
    localStorage.removeItem('coresPartida');
    
    // Limpar cache de regras
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('regras_') || 
          key.startsWith('jogadores_') || 
          key.startsWith('fila_')) {
        localStorage.removeItem(key);
        console.log('🧹 Cache removido:', key);
      }
    });
    
    // Limpar outros dados temporários
    localStorage.removeItem('peladaStats');
    localStorage.removeItem('syncQueue');
    
    console.log('✅ Cache limpo completamente');
    
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

  // Solicita atendimento manual para troca de senha via suporte no WhatsApp
  const handleEsqueciSenha = () => {
    const peladaId = clienteData?.pelada_id || 'não informado';
    const username = userName || clienteData?.username || 'não informado';
    const plano = userPlan || 'não informado';

    const mensagem =
      `Olá! Esqueci minha senha no PeladaPLAY e preciso de ajuda.\n\n` +
      `Dados para validação:\n` +
      `Pelada ID: ${peladaId}\n` +
      `Usuário: ${username}\n` +
      `Plano: ${plano}\n\n` +
      `Por favor, validar meu cadastro e enviar uma nova senha.`;

    const urlWhatsApp = `https://wa.me/${CONTATO.whatsapp}?text=${encodeURIComponent(mensagem)}`;
    window.open(urlWhatsApp, '_blank');
    setIsSidebarOpen(false);
  };

  // Função para verificar atualizações manualmente
  const checkForUpdates = async () => {
    setCheckingUpdate(true);
    try {
      const response = await fetch('/version.json');
      const data = await response.json();
      setVersionInfo(data);
      
      const storedVersion = localStorage.getItem('app_version');
      
      if (storedVersion && storedVersion !== data.version) {
        // Nova versão disponível
        setShowUpdateModal(true);
        setIsSidebarOpen(false);
      } else if (!storedVersion) {
        // Primeira instalação
        localStorage.setItem('app_version', data.version);
        alert(`✅ Você está usando a versão ${data.version} (mais recente)`);
      } else {
        // Já está na última versão
        alert(`✅ Você já está usando a versão ${data.version} (mais recente)`);
      }
    } catch (error) {
      console.error('Erro ao verificar atualizações:', error);
      alert('❌ Erro ao verificar atualizações. Tente novamente.');
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleUpdateNow = () => {
    if (versionInfo) {
      localStorage.setItem('app_version', versionInfo.version);
    }
    
    // Limpa cache do Service Worker
    if ('serviceWorker' in navigator) {
      caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
          caches.delete(cacheName);
        });
      });
    }
    
    // Recarrega a página
    window.location.reload();
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
                <img src="/logo.png?v=2" alt="PeladaPLAY Logo" width={56} height={56} style={{width:56,height:56,objectFit:'contain'}} />
                <div>
                  <h2 className="text-2xl font-bold">
                    <span className="text-green-600">Pelada</span>
                    <span className="text-gray-800">PLAY</span>
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
                    Pelada ID: <span className="font-bold text-gray-800">{clienteData?.pelada_id || 'N/A'}</span>
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    Usuário: <span className="font-bold text-gray-800">{clienteData?.username || 'N/A'}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    Plano: <span className="font-bold text-green-600">{userPlan}</span>
                  </div>
                </div>
                
                {/* Botão de Logout */}
                <div className="w-full h-1"></div>
              </>
            ) : (
              <div>
                <button 
                  onClick={() => navigateTo('login')}
                  className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-green-700 transition-colors"
                >
                  🔑 Fazer Login
                </button>
              </div>
            )}
          </div>

          {/* Navegação rápida */}
          {isLoggedIn && (
            <div className="px-6 py-3 border-b border-gray-200 flex gap-2">
              <button
                onClick={() => { navigateTo(''); toggleSidebar(); }}
                className="flex-1 flex flex-col items-center justify-center py-3 rounded-lg transition-colors text-gray-600 hover:bg-green-50 hover:text-green-700"
              >
                <span className="text-2xl">🏠</span>
                <span className="text-xs font-medium mt-1">Home</span>
              </button>
              <button
                onClick={() => {
                  if (!menuRapidoHabilitado) return;
                  toggleSidebar();
                  if (onAdminClick) {
                    onAdminClick();
                  } else {
                    alert('🔒 Área administrativa - Em desenvolvimento');
                  }
                }}
                disabled={!menuRapidoHabilitado}
                className={`flex-1 flex flex-col items-center justify-center py-3 rounded-lg transition-colors ${
                  !menuRapidoHabilitado ? 'text-gray-300 opacity-30 cursor-not-allowed' : 'text-gray-600 hover:bg-red-50 hover:text-red-700'
                }`}
              >
                <span className="text-2xl">🔒</span>
                <span className="text-xs font-medium mt-1">Admin</span>
              </button>
            </div>
          )}

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

          {/* Botão Esqueci a Senha */}
          {isLoggedIn && (
            <div className="px-6 pb-4">
              <button
                onClick={handleEsqueciSenha}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white py-3 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2 shadow-md"
              >
                <span>🔑</span>
                <span>Esqueci a Senha</span>
              </button>
            </div>
          )}

          {/* Botão de Verificar Atualizações */}
          <div className="px-6 pb-3">
            <button
              onClick={checkForUpdates}
              disabled={checkingUpdate}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 text-white py-3 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2 shadow-md"
            >
              <svg 
                viewBox="0 0 24 24" 
                className={`w-5 h-5 fill-current ${checkingUpdate ? 'animate-spin' : ''}`}
              >
                <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
              </svg>
              <span>{checkingUpdate ? 'Verificando...' : 'Verificar Atualizações'}</span>
            </button>
          </div>

          {/* Botão de Suporte WhatsApp */}
          <div className="px-6 pb-4">
            <button
              onClick={() => window.open(`https://wa.me/${CONTATO.whatsapp}?text=${encodeURIComponent('Olá! Preciso de suporte no PeladaPLAY.')}`, '_blank')}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white py-3 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2 shadow-md"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              <span>Suporte</span>
            </button>
          </div>

          {/* Botão de Logout no final do menu */}
          {isLoggedIn && (
            <div className="px-6 pb-4">
              <button
                onClick={handleLogout}
                className="w-full bg-red-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-red-700 transition-colors"
              >
                🚪 Fazer Logoff
              </button>
            </div>
          )}

          {/* Footer do menu - fixo embaixo */}
          <div className="p-6 border-t border-gray-200 mt-auto">
            <p className="text-xs text-gray-500 text-center">
              PeladaPLAY v1.0.0<br />
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
                  onClick={() => !ehVisitante() && toggleSidebar()}
                  className={`p-2 rounded-lg transition-colors ${
                    ehVisitante() ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-100'
                  }`}
                  title={ehVisitante() ? 'Menu indisponível para visitantes' : 'Menu'}
                  disabled={ehVisitante()}
                  style={{ pointerEvents: ehVisitante() ? 'none' : 'auto' }}
                >
                  <div className="w-5 h-5 sm:w-6 sm:h-6 flex flex-col justify-center space-y-1">
                    <div className="w-full h-0.5 bg-gray-600"></div>
                    <div className="w-full h-0.5 bg-gray-600"></div>
                    <div className="w-full h-0.5 bg-gray-600"></div>
                  </div>
                </button>
                <h1 className="text-lg sm:text-xl font-bold">
                  <span className="text-green-600">Pelada</span>
                  <span className="text-gray-800">PLAY</span>
                </h1>
              </div>
              
              {/* Logo no canto direito */}
              <div className="flex items-center">
                <img src="/logo.png?v=2" alt="PeladaPLAY Logo" width={48} height={48} style={{width:48,height:48,objectFit:'contain'}} className="sm:w-14 sm:h-14" />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 pb-20 md:pb-8" style={{ paddingBottom: mainPaddingBottom }}>
          {children}
        </main>

        {/* Botão para recolher/exibir rodapé mobile nas telas de estatísticas */}
        {menuRapidoHabilitado && (
          <button
            onClick={toggleMobileFooter}
            className="md:hidden fixed right-1 z-40 bg-white border border-gray-300 rounded-full w-8 h-8 p-0 text-sm font-semibold text-gray-700 shadow-sm flex items-center justify-center"
            style={{ bottom: toggleButtonBottom }}
            aria-label={mobileFooterCollapsed ? 'Mostrar rodapé' : 'Recolher rodapé'}
          >
            {mobileFooterCollapsed ? '⬆' : '⬇'}
          </button>
        )}

        {/* Footer Mobile */}
        {!hideFooter && <footer
          className={`fixed left-0 right-0 bg-white border-t border-gray-200 md:hidden z-30 mobile-footer-shell transition-transform duration-300 ${menuRapidoHabilitado && mobileFooterCollapsed ? 'translate-y-full pointer-events-none' : 'translate-y-0'}`}
          style={{ bottom: userPlan === 'Free' ? 'calc(60px + var(--safe-area-bottom))' : '0' }}
        >
          <nav className="flex py-2 px-4 mobile-footer-nav">
            {/* Rodapé varia baseado na página atual */}
            {pathname === '/modo-torneio/painel' ? (
              // Rodapé do PAINEL DO TORNEIO — 5 abas com ⚽ central
              <>
                {(() => {
                  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
                  const abaAtual = params?.get('aba') || 'times';
                  const partidaAtiva = (() => {
                    try {
                      if (typeof window === 'undefined') return null;
                      const pid = buscar_pelada_id() || 'default';
                      const raw = localStorage.getItem(`partida_ativa_torneio_${pid}`);
                      return raw ? JSON.parse(raw) : null;
                    } catch { return null; }
                  })();
                  const abas = [
                    { id: 'painel', emoji: '⚙️', label: 'Painel' },
                    { id: 'jogos', emoji: '📅', label: 'Jogos' },
                    { id: '_partida', emoji: '⚽', label: 'Jogar', partida: true },
                    { id: 'classificacao', emoji: '📊', label: 'Tabela' },
                    { id: 'estatisticas', emoji: '🌟', label: 'Stats' },
                  ];
                  return abas.map((aba) => {
                    const ativo = !aba.partida && abaAtual === aba.id;
                    const isPartida = !!aba.partida;
                    const habilitado = !isPartida || !!partidaAtiva;
                    return (
                      <button
                        key={aba.id}
                        disabled={isPartida && !habilitado}
                        onClick={() => {
                          if (isPartida && partidaAtiva) {
                            router.push(`/modo-torneio/partida?id=${partidaAtiva.partidaId}`);
                          } else if (!isPartida) {
                            const p = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
                            const ro = p?.get('readonly');
                            const tid = p?.get('torneioId');
                            const extra = ro && tid ? `&readonly=${ro}&torneioId=${tid}` : '';
                            router.push(`/modo-torneio/painel?aba=${aba.id}${extra}`);
                          }
                        }}
                        className={`flex flex-col items-center justify-center py-2 rounded-lg transition-all ${
                          isPartida
                            ? habilitado
                              ? 'text-white bg-emerald-500 shadow-md shadow-emerald-200 scale-110'
                              : 'text-gray-300 opacity-40 cursor-not-allowed'
                            : ativo
                            ? 'text-sky-600 bg-sky-50'
                            : 'text-gray-500 hover:bg-gray-50'
                        }`}
                        style={{ flex: 1 }}
                      >
                        <span className={`${isPartida ? 'text-2xl' : 'text-2xl'}`}>{aba.emoji}</span>
                        <span className={`text-xs font-${isPartida ? 'bold' : 'medium'} mt-1`}>{aba.label}</span>
                      </button>
                    );
                  });
                })()}
              </>
            ) : pathname?.startsWith('/modo-torneio/partida') || pathname?.startsWith('/modo-torneio/penaltis') ? (
              // Na tela de partida do torneio — mesmos 5 tabs do painel, ⚽ destacado
              <>
                {(() => {
                  const partidaAtiva = (() => {
                    try {
                      if (typeof window === 'undefined') return null;
                      const pid = buscar_pelada_id() || 'default';
                      const raw = localStorage.getItem(`partida_ativa_torneio_${pid}`);
                      return raw ? JSON.parse(raw) : null;
                    } catch { return null; }
                  })();
                  const abas = [
                    { id: 'painel', emoji: '⚙️', label: 'Painel' },
                    { id: 'jogos', emoji: '📅', label: 'Jogos' },
                    { id: '_partida', emoji: '⚽', label: 'Jogar', partida: true },
                    { id: 'classificacao', emoji: '📊', label: 'Tabela' },
                    { id: 'estatisticas', emoji: '🌟', label: 'Stats' },
                  ];
                  return abas.map((aba) => {
                    const isPartida = !!aba.partida;
                    return (
                      <button
                        key={aba.id}
                        onClick={() => {
                          if (isPartida) return; // já está na partida
                          router.push(`/modo-torneio/painel?aba=${aba.id}`);
                        }}
                        className={`flex flex-col items-center justify-center py-2 rounded-lg transition-all ${
                          isPartida
                            ? 'text-white bg-emerald-500 shadow-md shadow-emerald-200 scale-110'
                            : 'text-gray-500 hover:bg-gray-50'
                        }`}
                        style={{ flex: 1 }}
                      >
                        <span className="text-2xl">{aba.emoji}</span>
                        <span className={`text-xs font-${isPartida ? 'bold' : 'medium'} mt-1`}>{aba.label}</span>
                      </button>
                    );
                  });
                })()}
              </>
            ) : pathname === '/modo-torneio/partida' ? (
              // fallback (nunca chega aqui em prática)
              <button
                onClick={() => router.push('/modo-torneio/painel?aba=jogos')}
                className="flex flex-col items-center justify-center py-2 rounded-lg text-gray-500 hover:bg-gray-50"
                style={{ flex: 1 }}
              >
                <span className="text-2xl">←</span>
                <span className="text-xs font-medium mt-1">Voltar</span>
              </button>
            ) : pathname === '/modo-torneio' ? (
              // Rodapé da HOME do Modo Torneio
              <>
                {/* Home geral */}
                <button
                  onClick={() => router.push('/')}
                  className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-gray-500 hover:bg-gray-50"
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">🏠</span>
                  <span className="text-xs font-medium mt-1">Home</span>
                </button>
                {/* Home do torneio */}
                <button
                  onClick={() => router.push('/modo-torneio')}
                  className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-sky-600 bg-sky-50"
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">🏆</span>
                  <span className="text-xs font-medium mt-1">Torneios</span>
                </button>
                {/* Museu do Futebol */}
                <button
                  disabled
                  className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-gray-300 opacity-50 cursor-not-allowed"
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">👑</span>
                  <span className="text-xs font-medium mt-1">Museu</span>
                </button>
              </>
            ) : pathname?.startsWith('/modo-torneio') ? (
              // Rodapé do MODO TORNEIO — passos sequenciais (a partir de /regras)
              <>
                {/* Passo 1: Início */}
                <button
                  onClick={() => router.push('/modo-torneio')}
                  className={`flex flex-col items-center justify-center py-2 rounded-lg transition-colors ${
                    pathname === '/modo-torneio' ? 'text-sky-600 bg-sky-50' : 'text-gray-500 hover:bg-gray-50'
                  }`}
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">🏠</span>
                  <span className="text-xs font-medium mt-1">Início</span>
                </button>
                {/* Passo 2: Regras */}
                <button
                  onClick={() => (torneioSteps.regras || pathname === '/modo-torneio/regras') && router.push('/modo-torneio/regras')}
                  disabled={!torneioSteps.regras && pathname !== '/modo-torneio/regras'}
                  className={`flex flex-col items-center justify-center py-2 rounded-lg transition-colors ${
                    pathname === '/modo-torneio/regras'
                      ? 'text-sky-600 bg-sky-50'
                      : torneioSteps.regras
                      ? 'text-gray-500 hover:bg-gray-50'
                      : 'text-gray-300 opacity-40 cursor-not-allowed'
                  }`}
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">📋</span>
                  <span className="text-xs font-medium mt-1">Regras</span>
                </button>
                {/* Passo 3: Participantes */}
                <button
                  onClick={() => (torneioSteps.participantes || pathname === '/modo-torneio/participantes') && router.push('/modo-torneio/participantes')}
                  disabled={!torneioSteps.participantes && pathname !== '/modo-torneio/participantes'}
                  className={`flex flex-col items-center justify-center py-2 rounded-lg transition-colors ${
                    pathname === '/modo-torneio/participantes'
                      ? 'text-sky-600 bg-sky-50'
                      : torneioSteps.participantes
                      ? 'text-gray-500 hover:bg-gray-50'
                      : 'text-gray-300 opacity-40 cursor-not-allowed'
                  }`}
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">👥</span>
                  <span className="text-xs font-medium mt-1">Participantes</span>
                </button>
                {/* Passo 4: Sortear */}
                <button
                  onClick={() => (torneioSteps.sortearTimes || pathname === '/modo-torneio/sortear-times') && router.push('/modo-torneio/sortear-times')}
                  disabled={!torneioSteps.sortearTimes && pathname !== '/modo-torneio/sortear-times'}
                  className={`flex flex-col items-center justify-center py-2 rounded-lg transition-colors ${
                    pathname === '/modo-torneio/sortear-times'
                      ? 'text-sky-600 bg-sky-50'
                      : torneioSteps.sortearTimes
                      ? 'text-gray-500 hover:bg-gray-50'
                      : 'text-gray-300 opacity-40 cursor-not-allowed'
                  }`}
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">🎲</span>
                  <span className="text-xs font-medium mt-1">Sortear</span>
                </button>
                {/* Passo 5: Painel / Iniciar Torneio */}
                {(() => {
                  const isPainelCtaAtivo = torneioSteps.chaveamento && pathname === '/modo-torneio/sortear-times';
                  return (
                    <button
                      onClick={() => (torneioSteps.chaveamento || pathname === '/modo-torneio/painel') && router.push('/modo-torneio/painel')}
                      disabled={!torneioSteps.chaveamento && pathname !== '/modo-torneio/painel'}
                      className={`flex flex-col items-center justify-center py-2 rounded-lg transition-all duration-300 ${
                        isPainelCtaAtivo
                          ? 'text-white bg-gradient-to-r from-yellow-500 to-amber-500 shadow-lg shadow-amber-300/50 animate-bounce'
                          : pathname === '/modo-torneio/painel' || pathname === '/modo-torneio/chaveamento'
                          ? 'text-sky-600 bg-sky-50'
                          : torneioSteps.chaveamento
                          ? 'text-gray-500 hover:bg-gray-50'
                          : 'text-gray-300 opacity-40 cursor-not-allowed'
                      }`}
                      style={{ flex: 1 }}
                    >
                      <span className="text-2xl">🏆</span>
                      <span className={`text-xs font-bold mt-1 ${isPainelCtaAtivo ? 'text-white' : ''}`}>
                        {isPainelCtaAtivo ? 'Iniciar!' : 'Painel'}
                      </span>
                    </button>
                  );
                })()}
              </>
            ) : title === 'Home' || title === 'PeladaPLAY' || pathname === '/atividade' || pathname === '/pelada-tradicional' ? (
              // Rodapé da HOME
              <>
                <button
                  onClick={() => !ehVisitante() && navigateTo('')}
                  className={`flex flex-col items-center justify-center py-2 rounded-lg transition-colors ${
                    ehVisitante() ? 'text-gray-300 opacity-50 cursor-not-allowed' : 'text-green-600 bg-green-50'
                  }`}
                  style={{ flex: 1 }}
                  disabled={ehVisitante()}
                >
                  <span className="text-2xl">🏠</span>
                  <span className="text-xs font-medium mt-1">Home</span>
                </button>
                <button
                  onClick={() => navigateTo('pelada-tradicional')}
                  className={`flex flex-col items-center justify-center py-2 rounded-lg transition-colors ${pathname === '/pelada-tradicional' ? 'text-green-600 bg-green-50' : 'text-gray-400'}`}
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">⚽</span>
                  <span className="text-xs font-medium mt-1">Tradicional</span>
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
                  onClick={() => navigateTo('regras')}
                  className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-gray-400"
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">⚙️</span>
                  <span className="text-xs font-medium mt-1">Regras</span>
                </button>
                <button
                  onClick={() => navigateTo('sorteio')}
                  className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-gray-400"
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">🎲</span>
                  <span className="text-xs font-medium mt-1">Sorteio</span>
                </button>
              </>
            ) : title === 'Cadastro' ? (
              // Rodapé do CADASTRO
              <>
                <button
                  onClick={() => !ehVisitante() && navigateTo('')}
                  className={`flex flex-col items-center justify-center py-2 rounded-lg transition-colors ${
                    ehVisitante() ? 'text-gray-300 opacity-50 cursor-not-allowed' : 'text-gray-400 hover:bg-gray-100'
                  }`}
                  style={{ flex: 1 }}
                  disabled={ehVisitante()}
                >
                  <span className="text-2xl">🏠</span>
                  <span className="text-xs font-medium mt-1">Home</span>
                </button>
                <button
                  onClick={() => navigateTo('pelada-tradicional')}
                  className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-gray-400"
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">⚽</span>
                  <span className="text-xs font-medium mt-1">Tradicional</span>
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
                  onClick={() => navigateTo('regras')}
                  className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-gray-400"
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">⚙️</span>
                  <span className="text-xs font-medium mt-1">Regras</span>
                </button>
                <button
                  onClick={() => navigateTo('sorteio')}
                  className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-gray-400"
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">🎲</span>
                  <span className="text-xs font-medium mt-1">Sorteio</span>
                </button>
              </>
            ) : title === 'Sorteio' ? (
              // Rodapé do SORTEIO
              <>
                <button
                  onClick={() => !ehVisitante() && navigateTo('')}
                  className={`flex flex-col items-center justify-center py-2 rounded-lg transition-colors ${
                    ehVisitante() ? 'text-gray-300 opacity-50 cursor-not-allowed' : 'text-gray-400 hover:bg-gray-100'
                  }`}
                  style={{ flex: 1 }}
                  disabled={ehVisitante()}
                >
                  <span className="text-2xl">🏠</span>
                  <span className="text-xs font-medium mt-1">Home</span>
                </button>
                <button
                  onClick={() => navigateTo('pelada-tradicional')}
                  className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-gray-400"
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">⚽</span>
                  <span className="text-xs font-medium mt-1">Tradicional</span>
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
                  onClick={() => navigateTo('regras')}
                  className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-gray-400"
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">⚙️</span>
                  <span className="text-xs font-medium mt-1">Regras</span>
                </button>
                <button
                  onClick={() => navigateTo('sorteio')}
                  className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-green-600 bg-green-50"
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">🎲</span>
                  <span className="text-xs font-medium mt-1">Sorteio</span>
                </button>
              </>
            ) : title === 'Regras' ? (
              // Rodapé do REGRAS
              <>
                <button
                  onClick={() => !ehVisitante() && navigateTo('')}
                  className={`flex flex-col items-center justify-center py-2 rounded-lg transition-colors ${
                    ehVisitante() ? 'text-gray-300 opacity-50 cursor-not-allowed' : 'text-gray-400 hover:bg-gray-100'
                  }`}
                  style={{ flex: 1 }}
                  disabled={ehVisitante()}
                >
                  <span className="text-2xl">🏠</span>
                  <span className="text-xs font-medium mt-1">Home</span>
                </button>
                <button
                  onClick={() => navigateTo('pelada-tradicional')}
                  className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-gray-400"
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">⚽</span>
                  <span className="text-xs font-medium mt-1">Tradicional</span>
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
                  onClick={() => navigateTo('regras')}
                  className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-green-600 bg-green-50"
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">⚙️</span>
                  <span className="text-xs font-medium mt-1">Regras</span>
                </button>
                <button
                  onClick={() => navigateTo('sorteio')}
                  className="flex flex-col items-center justify-center py-2 rounded-lg transition-colors text-gray-400"
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">🎲</span>
                  <span className="text-xs font-medium mt-1">Sorteio</span>
                </button>
              </>
            ) : false ? (
              // Removido: rodapé de usuários
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
                  onClick={() => navigateTo('estatisticas')}
                  className={`flex flex-col items-center justify-center py-2 rounded-lg transition-colors ${title === 'Estatísticas' ? 'text-green-600 bg-green-50' : 'text-gray-400'}`}
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">🏆</span>
                  <span className="text-xs font-medium mt-1">Estatísticas</span>
                </button>
                <button
                  onClick={() => navigateTo('individual')}
                  className={`flex flex-col items-center justify-center py-2 rounded-lg transition-colors ${title === 'Individual' ? 'text-green-600 bg-green-50' : 'text-gray-400'}`}
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">👤</span>
                  <span className="text-xs font-medium mt-1">Individual</span>
                </button>
                <button
                  onClick={() => navigateTo('x1')}
                  className={`flex flex-col items-center justify-center py-2 rounded-lg transition-colors ${title === 'X1' ? 'text-green-600 bg-green-50' : 'text-gray-400'}`}
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">⚔️</span>
                  <span className="text-xs font-medium mt-1">X1</span>
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
                  onClick={() => navigateTo('classificacao')}
                  className={`flex flex-col items-center justify-center py-2 rounded-lg transition-colors ${title === 'Classificação' ? 'text-green-600 bg-green-50' : 'text-gray-400'}`}
                  style={{ flex: 1 }}
                >
                  <span className="text-2xl">🥇</span>
                  <span className="text-xs font-medium mt-1">Classificação</span>
                </button>
              </>
            )}
          </nav>
        </footer>}

        {/* Banner de Anúncio Fixo (apenas FREE) */}
        <AdBanner position="bottom" />
        
        {/* Interstitial de Anúncio (tela cheia) */}
        {shouldShowInterstitial && (
          <AdInterstitial 
            onClose={resetInterstitial}
            motivo="navegacao"
          />
        )}

        {/* Modal de Atualização Manual */}
        {showUpdateModal && versionInfo && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}>
            <div style={{
              backgroundColor: '#fff',
              borderRadius: '20px',
              maxWidth: '450px',
              width: '100%',
              padding: '32px 24px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🎉</div>
              
              <h2 style={{ 
                fontSize: '1.5rem', 
                fontWeight: 'bold',
                marginBottom: '8px',
                color: '#1a1a1a'
              }}>
                Nova Atualização Disponível!
              </h2>
              
              <p style={{
                fontSize: '1.1rem',
                fontWeight: '600',
                color: '#16a34a',
                marginBottom: '16px'
              }}>
                Versão {versionInfo.version}
              </p>

              {versionInfo.changelog && versionInfo.changelog[versionInfo.version] && (
                <div style={{
                  background: '#f8f9fa',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '24px',
                  textAlign: 'left'
                }}>
                  <h3 style={{
                    fontSize: '0.95rem',
                    fontWeight: '700',
                    color: '#1a1a1a',
                    marginBottom: '12px'
                  }}>
                    {versionInfo.changelog[versionInfo.version].title}
                  </h3>
                  
                  {versionInfo.changelog[versionInfo.version].features && (
                    <div>
                      {versionInfo.changelog[versionInfo.version].features.slice(0, 3).map((feature: string, idx: number) => (
                        <div key={idx} style={{
                          fontSize: '0.85rem',
                          color: '#4b5563',
                          marginBottom: '4px',
                          lineHeight: '1.4'
                        }}>
                          {feature}
                        </div>
                      ))}
                      {versionInfo.changelog[versionInfo.version].features.length > 3 && (
                        <div style={{
                          fontSize: '0.8rem',
                          color: '#16a34a',
                          marginTop: '8px',
                          fontWeight: '600'
                        }}>
                          + {versionInfo.changelog[versionInfo.version].features.length - 3} novidades...
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button
                  onClick={handleUpdateNow}
                  style={{
                    width: '100%',
                    padding: '14px',
                    fontSize: '1rem',
                    fontWeight: '700',
                    border: 'none',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                    color: '#fff',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)'
                  }}
                >
                  Atualizar Agora
                </button>
                
                <button
                  onClick={() => setShowUpdateModal(false)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    background: '#fff',
                    color: '#6b7280',
                    cursor: 'pointer'
                  }}
                >
                  Agora Não
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}