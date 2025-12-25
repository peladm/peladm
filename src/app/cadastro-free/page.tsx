'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

// Função para gerar pelada_id de 6 caracteres (2 letras do nome + 4 números)
const gerarPeladaId = (nomeCompleto: string): string => {
  const numeros = '0123456789';
  
  // Remover espaços extras e dividir o nome
  const nomes = nomeCompleto.trim().toUpperCase().split(/\s+/);
  
  let prefixo = '';
  if (nomes.length >= 2) {
    // Se tem 2 ou mais nomes: primeira letra de cada
    prefixo = nomes[0][0] + nomes[1][0];
  } else {
    // Se tem apenas 1 nome: duas primeiras letras
    const primeiroNome = nomes[0];
    if (primeiroNome.length >= 2) {
      prefixo = primeiroNome.substring(0, 2);
    } else {
      // Se o nome tem apenas 1 letra, duplica
      prefixo = primeiroNome[0] + primeiroNome[0];
    }
  }
  
  // 4 números aleatórios
  let codigo = prefixo;
  for (let i = 0; i < 4; i++) {
    codigo += numeros[Math.floor(Math.random() * numeros.length)];
  }
  
  return codigo;
};

// Função para gerar senha de 4 números
const gerarSenha = (): string => {
  const numeros = '0123456789';
  let senha = '';
  for (let i = 0; i < 4; i++) {
    senha += numeros[Math.floor(Math.random() * numeros.length)];
  }
  return senha;
};

// Função para verificar se pelada_id já existe
const verificarPeladaIdExiste = async (peladaId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('clientes')
    .select('id')
    .eq('id', peladaId)
    .single();
  
  return !!data && !error;
};

// Função para gerar pelada_id único
const gerarPeladaIdUnico = async (nomeCompleto: string): Promise<string> => {
  let tentativas = 0;
  let peladaId = gerarPeladaId(nomeCompleto);
  
  while (await verificarPeladaIdExiste(peladaId)) {
    tentativas++;
    if (tentativas > 10) {
      throw new Error('Erro ao gerar código único. Tente novamente.');
    }
    peladaId = gerarPeladaId(nomeCompleto);
  }
  
  return peladaId;
};

export default function CadastroFree() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [mostrarModalSucesso, setMostrarModalSucesso] = useState(false);
  const [credenciais, setCredenciais] = useState({
    peladaId: '',
    senha: ''
  });
  const [formData, setFormData] = useState({
    nome: '',
    telefone: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Se for o campo nome, permitir apenas letras e espaços
    if (name === 'nome') {
      const apenasLetras = value.replace(/[^a-zA-ZÀ-ÿ\s]/g, '');
      setFormData({
        ...formData,
        [name]: apenasLetras
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.telefone) {
      alert('❌ Preencha todos os campos obrigatórios!');
      return;
    }

    setLoading(true);

    try {
      // Gerar credenciais baseadas no nome
      const peladaId = await gerarPeladaIdUnico(formData.nome);
      const senhaAdmin = gerarSenha();

      console.log('🆔 Gerando pelada_id:', peladaId);
      console.log('🔑 Gerando senha admin:', senhaAdmin);

      // 1. Inserir cliente no banco
      const result = await supabase
        .from('clientes')
        .insert([{
          id: peladaId,
          telefone: formData.telefone,
          nome: formData.nome,
          plano: 'Free',
          is_master: false,
          status: 'ativo',
          supabase_url: null,
          supabase_anon_key: null,
          email_supabase: null,
          senha_supabase: null,
          created_at: new Date().toISOString(),
          last_access: new Date().toISOString()
        }])
        .select();

      if (result.error) {
        console.error('❌ Erro ao cadastrar cliente:', result.error);
        alert(`❌ Erro ao cadastrar: ${result.error.message}`);
        setLoading(false);
        return;
      }

      // 2. Se cliente criado com sucesso, criar usuário admin
      if (result.data && result.data.length > 0) {
        console.log('✅ Cliente criado, criando usuário admin...');
        
        const resultUsuario = await supabase
          .from('usuarios')
          .insert([{
            pelada_id: peladaId,
            username: 'admin',
            senha: senhaAdmin,
            role: 'admin'
          }]);

        if (resultUsuario.error) {
          console.error('❌ Erro ao criar usuário admin:', resultUsuario.error);
          alert('❌ Cliente criado, mas erro ao criar usuário! Entre em contato com o suporte.');
          setLoading(false);
          return;
        }

        console.log('✅ Usuário admin criado com sucesso!');

        // 3. Salvar credenciais e mostrar modal
        setCredenciais({ 
          peladaId: peladaId, 
          senha: senhaAdmin 
        });
        setMostrarModalSucesso(true);
      }

    } catch (error: any) {
      console.error('❌ Erro:', error);
      alert(`❌ Erro: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fazerLogin = () => {
    // Salvar user no localStorage
    localStorage.setItem('user', JSON.stringify({
      id: credenciais.peladaId,
      nome: formData.nome,
      email: null,
      plano: 'Free',
      usuario_pelada: 'admin',
      senha_pelada: credenciais.senha,
      tipo_acesso: 'completo'
    }));
    
    // Redirecionar para home
    router.push('/');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '24px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        maxWidth: '480px',
        width: '100%',
        padding: '40px'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>
            <span style={{ color: '#10b981' }}>Pel</span>
            <span style={{ color: '#1f2937' }}>ADM</span>
          </h1>
          <p style={{ color: '#6b7280', fontSize: '1rem' }}>
            Criar Conta <span style={{ color: '#10b981', fontWeight: '600' }}>GRÁTIS</span>
          </p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
              Nome Completo *
            </label>
            <input
              type="text"
              name="nome"
              value={formData.nome}
              onChange={handleChange}
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                fontSize: '1rem',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#10b981'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              placeholder="Digite seu nome"
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
              Telefone *
            </label>
            <input
              type="tel"
              name="telefone"
              value={formData.telefone}
              onChange={handleChange}
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                fontSize: '1rem',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#10b981'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              placeholder="(00) 00000-0000"
            />
          </div>

          {/* Botões */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: loading ? '#9ca3af' : '#10b981',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '1.1rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              marginBottom: '12px'
            }}
            onMouseOver={(e) => !loading && (e.currentTarget.style.backgroundColor = '#059669')}
            onMouseOut={(e) => !loading && (e.currentTarget.style.backgroundColor = '#10b981')}
          >
            {loading ? '⏳ Criando conta...' : '🚀 Criar Conta GRÁTIS'}
          </button>

          <button
            type="button"
            onClick={() => router.push('/login')}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: 'transparent',
              color: '#6b7280',
              border: '2px solid #e5e7eb',
              borderRadius: '12px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
              e.currentTarget.style.borderColor = '#10b981';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = '#e5e7eb';
            }}
          >
            ← Já tenho conta
          </button>
        </form>

        {/* Info plano FREE */}
        <div style={{
          marginTop: '24px',
          padding: '16px',
          backgroundColor: '#f0fdf4',
          border: '2px solid #86efac',
          borderRadius: '12px'
        }}>
          <p style={{ fontSize: '0.875rem', color: '#15803d', fontWeight: '600', marginBottom: '8px' }}>
            ⚡ Plano FREE inclui:
          </p>
          <ul style={{ fontSize: '0.8rem', color: '#166534', paddingLeft: '20px', margin: 0 }}>
            <li>Até 25 jogadores</li>
            <li>Até 10 partidas por sessão</li>
            <li>Gestão completa de fila</li>
            <li>Sorteio de times</li>
          </ul>
        </div>
      </div>

      {/* Modal de Sucesso */}
      {mostrarModalSucesso && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '24px',
            maxWidth: '440px',
            width: '100%',
            padding: '40px',
            textAlign: 'center',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.5)',
            animation: 'slideUp 0.4s ease-out'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🎉</div>
            
            <h2 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#10b981', marginBottom: '16px' }}>
              Conta Criada!
            </h2>

            <p style={{ fontSize: '1rem', color: '#6b7280', marginBottom: '24px' }}>
              Guarde suas credenciais de acesso:
            </p>

            <div style={{
              backgroundColor: '#f9fafb',
              border: '2px solid #e5e7eb',
              borderRadius: '16px',
              padding: '20px',
              marginBottom: '24px'
            }}>
              <div style={{ marginBottom: '12px' }}>
                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '4px' }}>Pelada ID</p>
                <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937', letterSpacing: '2px' }}>
                  {credenciais.peladaId}
                </p>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '4px' }}>Usuário</p>
                <p style={{ fontSize: '1.2rem', fontWeight: '600', color: '#1f2937' }}>admin</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '4px' }}>Senha</p>
                <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937', letterSpacing: '4px' }}>
                  {credenciais.senha}
                </p>
              </div>
            </div>

            <div style={{
              backgroundColor: '#fef3c7',
              border: '2px solid #fbbf24',
              borderRadius: '12px',
              padding: '12px',
              marginBottom: '24px'
            }}>
              <p style={{ fontSize: '0.85rem', color: '#92400e', fontWeight: '600' }}>
                ⚠️ Anote estas credenciais! Você precisará delas para fazer login.
              </p>
            </div>

            <button
              onClick={fazerLogin}
              style={{
                width: '100%',
                padding: '16px',
                backgroundColor: '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '1.1rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#059669'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
            >
              ✅ Entrar no Sistema
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
