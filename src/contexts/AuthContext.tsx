'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { User as AppUser } from '@/types';

interface AuthContextType {
  user: User | null;
  profile: AppUser | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, userData: Partial<AppUser>) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<AppUser>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar sessão inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Escutar mudanças na autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await loadUserProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (userId: string) => {
    try {
      // TODO: Implementar após criar tabela users
      // Temporariamente desabilitado para deploy funcionar
      console.log('Carregando perfil para:', userId);
      setProfile(null);
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
    } catch (error: any) {
      setLoading(false);
      throw new Error(error.message || 'Erro ao fazer login');
    }
  };

  const signUp = async (email: string, password: string, userData: Partial<AppUser>) => {
    setLoading(true);
    try {
      // Registrar usuário na auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: userData.name
          }
        }
      });

      if (error) throw error;

      // TODO: Criar perfil do usuário após migrar tabela users
      // Temporariamente desabilitado para deploy funcionar
      if (data.user) {
        console.log('Usuário criado:', data.user.email);
        // Criar perfil será implementado quando tivermos a tabela users
      }
    } catch (error: any) {
      setLoading(false);
      throw new Error(error.message || 'Erro ao criar conta');
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error: any) {
      throw new Error(error.message || 'Erro ao sair');
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (data: Partial<AppUser>) => {
    if (!user) throw new Error('Usuário não autenticado');

    try {
      // TODO: Implementar após criar tabela users
      // Temporariamente desabilitado para deploy funcionar
      console.log('Atualizando perfil:', data);
      
      // Simular sucesso
      await loadUserProfile(user.id);
    } catch (error: any) {
      throw new Error(error.message || 'Erro ao atualizar perfil');
    }
  };

  const value = {
    user,
    profile,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro do AuthProvider');
  }
  return context;
}