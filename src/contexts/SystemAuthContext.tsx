'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { masterSupabase, getClientSupabase } from '@/lib/supabase';
import { ClientConfig, getClientConfig } from '@/config/clients';

interface SystemAuthState {
  isSystemAuthenticated: boolean;
  currentClient: ClientConfig | null;
  clientSupabase: SupabaseClient | null;
  pelladaUser: any | null;
  isPelladaAuthenticated: boolean;
  systemLogin: (email: string, password: string) => Promise<boolean>;
  pelladaLogin: (username: string, password: string) => Promise<boolean>;
  systemLogout: () => void;
  pelladaLogout: () => void;
}

const SystemAuthContext = createContext<SystemAuthState | null>(null);

export function SystemAuthProvider({ children }: { children: React.ReactNode }) {
  // Estados do sistema
  const [isSystemAuthenticated, setIsSystemAuthenticated] = useState(false);
  const [currentClient, setCurrentClient] = useState<ClientConfig | null>(null);
  const [clientSupabase, setClientSupabase] = useState<SupabaseClient | null>(null);
  
  // Estados da pelada (segundo login)
  const [pelladaUser, setPelladaUser] = useState<any | null>(null);
  const [isPelladaAuthenticated, setIsPelladaAuthenticated] = useState(false);

  // Verificar autenticação ao carregar
  useEffect(() => {
    checkSystemAuth();
  }, []);

  // Verificar se há sessão do sistema salva
  const checkSystemAuth = () => {
    const savedClient = localStorage.getItem('peladm_current_client');
    const systemAuth = localStorage.getItem('peladm_system_auth');
    
    if (savedClient && systemAuth === 'true') {
      try {
        const clientConfig = JSON.parse(savedClient) as ClientConfig;
        setCurrentClient(clientConfig);
        setClientSupabase(getClientSupabase(clientConfig.email));
        setIsSystemAuthenticated(true);
        
        // Verificar se há usuário da pelada logado
        checkPelladaAuth(clientConfig.email);
      } catch (error) {
        console.error('Erro ao restaurar sessão:', error);
        systemLogout();
      }
    }
  };

  // Verificar autenticação da pelada
  const checkPelladaAuth = (clientEmail: string) => {
    const savedPelladaUser = localStorage.getItem(`peladm_pelada_user_${clientEmail}`);
    const pelladaAuth = localStorage.getItem(`peladm_pelada_auth_${clientEmail}`);
    
    if (savedPelladaUser && pelladaAuth === 'true') {
      try {
        const user = JSON.parse(savedPelladaUser);
        setPelladaUser(user);
        setIsPelladaAuthenticated(true);
      } catch (error) {
        console.error('Erro ao restaurar usuário da pelada:', error);
        pelladaLogout();
      }
    }
  };

  // Login do sistema (primeiro login)
  const systemLogin = async (email: string, password: string): Promise<boolean> => {
    try {
      // Buscar configuração do cliente
      const clientConfig = getClientConfig(email.toLowerCase());
      
      if (!clientConfig) {
        throw new Error('Cliente não encontrado');
      }

      if (clientConfig.status !== 'active') {
        throw new Error('Cliente inativo');
      }

      // TODO: Verificar senha no banco master
      // Por enquanto, aceitar qualquer senha para desenvolvimento
      
      // Configurar cliente
      setCurrentClient(clientConfig);
      setClientSupabase(getClientSupabase(clientConfig.email));
      setIsSystemAuthenticated(true);
      
      // Salvar sessão
      localStorage.setItem('peladm_current_client', JSON.stringify(clientConfig));
      localStorage.setItem('peladm_system_auth', 'true');
      
      return true;
    } catch (error) {
      console.error('Erro no login do sistema:', error);
      return false;
    }
  };

  // Login da pelada (segundo login) 
  const pelladaLogin = async (username: string, password: string): Promise<boolean> => {
    if (!currentClient || !clientSupabase) {
      throw new Error('Sistema não autenticado');
    }

    try {
      // Buscar usuário na tabela 'usuarios' do Supabase do cliente
      const { data: user, error } = await clientSupabase
        .from('usuarios')
        .select('*')
        .eq('username', username)
        .single();

      if (error || !user) {
        throw new Error('Usuário não encontrado');
      }

      // TODO: Verificar senha hash
      // Por enquanto, comparação simples para desenvolvimento
      if (user.senha !== password) {
        throw new Error('Senha incorreta');
      }

      // Configurar usuário da pelada
      setPelladaUser(user);
      setIsPelladaAuthenticated(true);
      
      // Salvar sessão da pelada
      localStorage.setItem(`peladm_pelada_user_${currentClient.email}`, JSON.stringify(user));
      localStorage.setItem(`peladm_pelada_auth_${currentClient.email}`, 'true');
      
      return true;
    } catch (error) {
      console.error('Erro no login da pelada:', error);
      return false;
    }
  };

  // Logout do sistema
  const systemLogout = () => {
    const clientEmail = currentClient?.email;
    
    setIsSystemAuthenticated(false);
    setCurrentClient(null);
    setClientSupabase(null);
    
    // Limpar também a sessão da pelada
    pelladaLogout();
    
    // Limpar localStorage
    localStorage.removeItem('peladm_current_client');
    localStorage.removeItem('peladm_system_auth');
    
    if (clientEmail) {
      localStorage.removeItem(`peladm_pelada_user_${clientEmail}`);
      localStorage.removeItem(`peladm_pelada_auth_${clientEmail}`);
    }
  };

  // Logout da pelada
  const pelladaLogout = () => {
    const clientEmail = currentClient?.email;
    
    setPelladaUser(null);
    setIsPelladaAuthenticated(false);
    
    if (clientEmail) {
      localStorage.removeItem(`peladm_pelada_user_${clientEmail}`);
      localStorage.removeItem(`peladm_pelada_auth_${clientEmail}`);
    }
  };

  return (
    <SystemAuthContext.Provider
      value={{
        isSystemAuthenticated,
        currentClient,
        clientSupabase,
        pelladaUser,
        isPelladaAuthenticated,
        systemLogin,
        pelladaLogin,
        systemLogout,
        pelladaLogout,
      }}
    >
      {children}
    </SystemAuthContext.Provider>
  );
}

export function useSystemAuth() {
  const context = useContext(SystemAuthContext);
  if (!context) {
    throw new Error('useSystemAuth deve ser usado dentro de SystemAuthProvider');
  }
  return context;
}