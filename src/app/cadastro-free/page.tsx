'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { CONTATO } from '../../config/contato';

// Função para gerar pelada_id de 6 caracteres (2 letras dos primeiros nomes + 4 últimos dígitos do telefone)
const gerarPeladaId = (nomeCompleto: string, telefone: string): string => {
  // Remover espaços extras e dividir o nome
  const nomes = nomeCompleto.trim().toUpperCase().split(/\s+/);
  
  // Validar que tem ao menos 2 nomes
  if (nomes.length < 2) {
    throw new Error('Nome completo deve ter ao menos 2 nomes (Nome e Sobrenome)');
  }
  
  // Primeira letra de cada um dos 2 primeiros nomes
  const prefixo = nomes[0][0] + nomes[1][0];
  
  // 4 últimos dígitos do telefone
  const apenasNumeros = telefone.replace(/\D/g, '');
  const ultimos4 = apenasNumeros.slice(-4);
  
  const codigo = prefixo + ultimos4;
  return codigo;
};

// Função para gerar username (primeiro nome em minúsculo)
const gerarUsername = (nomeCompleto: string): string => {
  const nomes = nomeCompleto.trim().split(/\s+/);
  return nomes[0].toLowerCase();
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
    .select('pelada_id')
    .eq('pelada_id', peladaId)
    .single();
  
  return !!data && !error;
};

// Função para gerar pelada_id único
const gerarPeladaIdUnico = async (nomeCompleto: string, telefone: string): Promise<string> => {
  const peladaId = gerarPeladaId(nomeCompleto, telefone);
  
  // Verificar se já existe
  if (await verificarPeladaIdExiste(peladaId)) {
    throw new Error('Já existe um cliente com estas iniciais e telefone. Entre em contato com o suporte.');
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
      // Validar nome completo (mínimo 2 nomes)
      const nomes = formData.nome.trim().split(/\s+/);
      if (nomes.length < 2) {
        alert('❌ Por favor, informe o nome completo (Nome e Sobrenome)!');
        setLoading(false);
        return;
      }

      // Gerar credenciais
      const peladaId = await gerarPeladaIdUnico(formData.nome, formData.telefone);
      const username = gerarUsername(formData.nome);
      const senhaAdmin = gerarSenha();

      console.log('🆔 Gerando pelada_id:', peladaId);
      console.log('👤 Gerando username:', username);
      console.log('🔑 Gerando senha admin:', senhaAdmin);

      // 1. Inserir cliente no banco com username e senha
      const result = await supabase
        .from('clientes')
        .insert([{
          pelada_id: peladaId,
          telefone: formData.telefone,
          nome: formData.nome,
          username: username,
          senha: senhaAdmin,
          plano: 'free',
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

      // 2. Se cliente criado com sucesso
      if (result.data && result.data.length > 0) {
        console.log('✅ Cliente criado com sucesso!');

        // 3. Criar regras padrão para o novo cliente
        console.log('📋 Criando regras padrão...');
        const resultRegras = await supabase
          .from('regras')
          .insert([{
            pelada_id: peladaId,
            jogadores_por_time: 5,
            modelo_sorteio: 'aleatorio',
            duracao: 10,
            vitorias_consecutivas: 0,
            prioridade_retorno: 'mesclar',
            regra_empate: 'desempate',
            regra_apos_empate: 'desempate_decide',
            empate_conta_vitoria: false,
            tipo_fila: 'modo_prancheta',
            modo_sincronizacao: 'tempo_real'
          }]);

        if (resultRegras.error) {
          console.error('⚠️ Erro ao criar regras padrão:', resultRegras.error);
          // Não bloqueia o cadastro, apenas avisa
        } else {
          console.log('✅ Regras padrão criadas com sucesso!');
        }

        // 4. Salvar credenciais e mostrar modal
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
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px 0'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '24px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        width: '80%',
        maxWidth: '600px',
        padding: '40px',
        margin: '0 20px'
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

          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <a
              href="/login"
              style={{
                color: '#6b7280',
                fontSize: '0.9rem',
                textDecoration: 'none',
                transition: 'color 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.color = '#10b981'}
              onMouseOut={(e) => e.currentTarget.style.color = '#6b7280'}
            >
              ← Já tenho conta
            </a>
          </div>
        </form>
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
