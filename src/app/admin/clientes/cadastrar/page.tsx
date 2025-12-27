'use client';

import { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

// Configuração Supabase
const supabase = createClient(
  'https://ewcswczqvelhlwpbraea.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Y3N3Y3pxdmVsaGx3cGJyYWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2Mzc1MzksImV4cCI6MjA4MDIxMzUzOX0.DRzgAuj171lUG_7wMVCFhuDH71sGxlHHEB28qBN9wks'
);

// Função para gerar pelada_id de 6 caracteres (2 letras + 4 números)
const gerarPeladaId = (): string => {
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numeros = '0123456789';
  
  let codigo = '';
  // 2 letras
  codigo += letras[Math.floor(Math.random() * letras.length)];
  codigo += letras[Math.floor(Math.random() * letras.length)];
  // 4 números
  codigo += numeros[Math.floor(Math.random() * numeros.length)];
  codigo += numeros[Math.floor(Math.random() * numeros.length)];
  codigo += numeros[Math.floor(Math.random() * numeros.length)];
  codigo += numeros[Math.floor(Math.random() * numeros.length)];
  
  return codigo;
};

// Função para gerar senha de 4 números
const gerarSenhaAdmin = (): string => {
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
const gerarPeladaIdUnico = async (): Promise<string> => {
  let tentativas = 0;
  let peladaId = gerarPeladaId();
  
  while (await verificarPeladaIdExiste(peladaId)) {
    tentativas++;
    if (tentativas > 10) {
      throw new Error('Erro ao gerar código único. Tente novamente.');
    }
    peladaId = gerarPeladaId();
  }
  
  return peladaId;
};

export default function CadastrarCliente() {
  return (
    <Suspense fallback={<div style={{ padding: '50px', textAlign: 'center' }}>Carregando...</div>}>
      <CadastrarClienteContent />
    </Suspense>
  );
}

function CadastrarClienteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clienteId = searchParams.get('id');
  const isEdicao = !!clienteId;
  
  const [loading, setLoading] = useState(false);
  const [carregandoCliente, setCarregandoCliente] = useState(isEdicao);
  const [mostrarModalCredenciais, setMostrarModalCredenciais] = useState(false);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [usageData, setUsageData] = useState<any>(null);
  const [credenciaisGeradas, setCredenciaisGeradas] = useState({
    peladaId: '',
    usuario: 'admin',
    senha: ''
  });
  const [formData, setFormData] = useState({
    telefone: '',
    nome: '',
    plano: 'Free',
    status: 'ativo',
    bloqueado: false,
    supabase_url: '',
    supabase_anon_key: '',
    email_supabase: '',
    senha_supabase: ''
  });

  // Carregar dados do cliente para edição
  useEffect(() => {
    if (isEdicao && clienteId) {
      carregarCliente(clienteId);
    }
  }, [isEdicao, clienteId]);

  const carregarCliente = async (id: string) => {
    setCarregandoCliente(true);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Erro ao carregar cliente:', error);
        alert('Cliente não encontrado!');
        router.push('/admin/clientes');
        return;
      }

      if (data) {
        setFormData({
          telefone: data.telefone || '',
          nome: data.nome || '',
          plano: data.plano || 'Free',
          status: data.status || 'ativo',
          bloqueado: false,
          supabase_url: data.supabase_url || '',
          supabase_anon_key: data.supabase_anon_key || '',
          email_supabase: data.email_supabase || '',
          senha_supabase: data.senha_supabase || ''
        });
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao carregar cliente!');
      router.push('/admin/clientes');
    } finally {
      setCarregandoCliente(false);
    }
  };

  const buscarUsoSupabase = async () => {
    if (!formData.supabase_url || !formData.supabase_anon_key) {
      alert('Configure as credenciais Supabase primeiro!');
      return;
    }

    setLoadingUsage(true);
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const clienteSupabase = createClient(formData.supabase_url, formData.supabase_anon_key);

      // Buscar lista de tabelas e contar registros
      const tables = ['clientes', 'jogadores', 'usuarios', 'sessoes', 'fila', 'jogos', 'gols', 'regras'];
      const usageInfo = [];

      for (const tableName of tables) {
        try {
          const { count, error } = await clienteSupabase
            .from(tableName)
            .select('*', { count: 'exact', head: true });

          if (!error && count !== null) {
            // Estimativa: ~1KB por registro
            const estimatedBytes = count * 1024;
            const size = estimatedBytes > 1024 * 1024
              ? `${(estimatedBytes / (1024 * 1024)).toFixed(2)} MB`
              : estimatedBytes > 1024
              ? `${(estimatedBytes / 1024).toFixed(2)} KB`
              : `${estimatedBytes} bytes`;

            usageInfo.push({
              tablename: tableName,
              size: `${count} registros (~${size})`,
              size_bytes: estimatedBytes
            });
          }
        } catch (err) {
          console.log(`Tabela ${tableName} não existe ou não tem permissão`);
        }
      }

      if (usageInfo.length > 0) {
        setUsageData(usageInfo);
      } else {
        alert('Nenhuma tabela encontrada. Verifique as permissões.');
      }
    } catch (error: any) {
      console.error('Erro:', error);
      alert(`Erro ao conectar: ${error.message}`);
    } finally {
      setLoadingUsage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const dadosCliente = {
        telefone: formData.telefone,
        nome: formData.nome,
        plano: formData.plano,
        is_master: false,
        status: formData.status,
        supabase_url: formData.supabase_url || null,
        supabase_anon_key: formData.supabase_anon_key || null,
        email_supabase: formData.email_supabase || null,
        senha_supabase: formData.senha_supabase || null
      };

      let result;
      if (isEdicao) {
        // Update
        result = await supabase
          .from('clientes')
          .update(dadosCliente)
          .eq('id', clienteId)
          .select();
      } else {
        // Insert com pelada_id customizado
        const peladaId = await gerarPeladaIdUnico();
        const senhaAdmin = gerarSenhaAdmin();
        console.log('🆔 Gerando pelada_id:', peladaId);
        console.log('🔑 Gerando senha admin:', senhaAdmin);
        
        result = await supabase
          .from('clientes')
          .insert([{
            id: peladaId,  // Usar pelada_id customizado
            ...dadosCliente
          }])
          .select();

        // Se cliente criado com sucesso, criar usuário admin
        if (!result.error && result.data && result.data.length > 0) {
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
            alert('Cliente criado, mas erro ao criar usuário admin! Crie manualmente.');
          } else {
            console.log('✅ Usuário admin criado com sucesso!');
            // Salvar credenciais para exibir no modal
            setCredenciaisGeradas({
              peladaId: peladaId,
              usuario: 'admin',
              senha: senhaAdmin
            });
            setMostrarModalCredenciais(true);
          }
        }
      }

      if (result.error) {
        console.error(`Erro ao ${isEdicao ? 'atualizar' : 'inserir'} cliente:`, result.error);
        alert(`Erro ao ${isEdicao ? 'atualizar' : 'cadastrar'} cliente!`);
      } else {
        if (isEdicao) {
          alert('Cliente atualizado com sucesso!');
          router.push('/admin/clientes');
        }
        // Para novo cliente, o modal será exibido automaticamente
      }
    } catch (error) {
      console.error('Erro:', error);
      alert(`Erro ao ${isEdicao ? 'atualizar' : 'cadastrar'} cliente!`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/admin/clientes')}
            className="text-gray-600 hover:text-gray-800 transition-colors"
          >
            ← Voltar
          </button>
          
          <h1 className="text-xl font-bold text-gray-800 absolute left-1/2 transform -translate-x-1/2">
            {isEdicao ? 'Editar Cliente' : 'Cadastrar Cliente'}
          </h1>
          
          <Image
            src="/logo.png"
            alt="PelADM"
            width={120}
            height={40}
            className="h-8 w-auto"
          />
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6">
        {carregandoCliente ? (
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200 text-center">
            <div className="text-4xl mb-4">⏳</div>
            <p className="text-gray-500">Carregando dados do cliente...</p>
          </div>
        ) : (
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Telefone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefone *
                </label>
                <input
                  type="tel"
                  value={formData.telefone}
                  onChange={(e) => setFormData({...formData, telefone: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="(22) 98127-8226"
                  required
                  disabled={loading}
                />
              </div>

              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome *
                </label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({...formData, nome: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                  disabled={loading}
                />
              </div>

              {/* Plano */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Plano *
                </label>
                <select
                  value={formData.plano}
                  onChange={(e) => setFormData({...formData, plano: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  disabled={loading}
                  required
                >
                  <option value="Free">Free (R$ 0,00)</option>
                  <option value="Gold">Gold (R$ 19,90)</option>
                  <option value="Premium">Premium (R$ 39,90)</option>
                </select>
              </div>

              {/* Campo Bloqueado apenas para compatibilidade (pode ser removido futuramente) */}
              <div className="hidden">
                <input
                  type="checkbox"
                  checked={formData.bloqueado}
                  onChange={(e) => setFormData({...formData, bloqueado: e.target.checked})}
                />
              </div>
            </div>

            {/* Configurações Supabase para Premium */}
            {formData.plano === 'Premium' && (
              <div className="space-y-4 p-6 bg-purple-50 rounded-xl">
                <h3 className="font-semibold text-gray-800 mb-1">🔐 Credenciais de Acesso Supabase</h3>
                <p className="text-xs text-gray-600 mb-4">Email e senha para criar a conta no Supabase (você pedirá o código de confirmação ao cliente)</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Supabase *
                    </label>
                    <input
                      type="email"
                      value={formData.email_supabase}
                      onChange={(e) => setFormData({...formData, email_supabase: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="email@exemplo.com"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Senha Supabase *
                    </label>
                    <input
                      type="text"
                      value={formData.senha_supabase}
                      onChange={(e) => setFormData({...formData, senha_supabase: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Senha para criar a conta"
                      disabled={loading}
                    />
                  </div>
                </div>

                <hr className="my-4 border-purple-200" />
                
                <h3 className="font-semibold text-gray-800 mb-1">🗄️ Configurações do Banco Dedicado</h3>
                <p className="text-xs text-gray-600 mb-4">Após criar o projeto Supabase, cole as credenciais abaixo</p>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Supabase URL
                    </label>
                    <input
                      type="url"
                      value={formData.supabase_url}
                      onChange={(e) => setFormData({...formData, supabase_url: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="https://xxx.supabase.co"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Supabase Anon Key
                    </label>
                    <input
                      type="text"
                      value={formData.supabase_anon_key}
                      onChange={(e) => setFormData({...formData, supabase_anon_key: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Dashboard de Uso do Supabase - Apenas para edição com credenciais */}
            {isEdicao && (formData.plano === 'Gold' || formData.plano === 'Premium') && (
              <div className="space-y-4 p-6 bg-blue-50 rounded-xl border-2 border-blue-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-800">📊 Uso do Banco de Dados</h3>
                    <p className="text-xs text-gray-600">
                      {formData.supabase_url && formData.supabase_anon_key 
                        ? 'Consulte o espaço utilizado por este cliente'
                        : '⚠️ Configure as credenciais Supabase primeiro para ver o uso'}
                    </p>
                  </div>
                  {formData.supabase_url && formData.supabase_anon_key && (
                    <button
                      type="button"
                      onClick={buscarUsoSupabase}
                      disabled={loadingUsage}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
                    >
                      {loadingUsage ? '⏳ Carregando...' : '🔄 Atualizar'}
                    </button>
                  )}
                </div>

                {!formData.supabase_url || !formData.supabase_anon_key ? (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">Configure a URL e a Anon Key do Supabase acima para consultar o uso</p>
                  </div>
                ) : usageData && usageData.length > 0 ? (
                  <div className="space-y-2">
                    {usageData.map((table: any, index: number) => (
                      <div key={index} className="bg-white p-3 rounded-lg flex items-center justify-between">
                        <span className="font-medium text-gray-700">{table.tablename}</span>
                        <span className="text-sm text-gray-600">{table.size}</span>
                      </div>
                    ))}
                    <div className="bg-green-100 p-3 rounded-lg flex items-center justify-between border-2 border-green-300 mt-4">
                      <span className="font-bold text-gray-800">💾 TOTAL</span>
                      <span className="font-bold text-green-700">
                        {usageData.reduce((acc: number, t: any) => acc + (t.size_bytes || 0), 0) > 1024 * 1024
                          ? `${(usageData.reduce((acc: number, t: any) => acc + (t.size_bytes || 0), 0) / (1024 * 1024)).toFixed(2)} MB`
                          : `${(usageData.reduce((acc: number, t: any) => acc + (t.size_bytes || 0), 0) / 1024).toFixed(2)} KB`}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">Clique em "Atualizar" para consultar o uso do banco</p>
                  </div>
                )}
              </div>
            )}

            {/* Botões */}
            <div className="flex space-x-4 pt-6">
              <button
                type="submit"
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-8 py-3 rounded-xl font-semibold transition-colors flex items-center space-x-2"
              >
                {loading && <span className="animate-spin">⏳</span>}
                <span>{loading ? (isEdicao ? 'Salvando...' : 'Salvando...') : (isEdicao ? 'Salvar Alterações' : 'Salvar Cliente')}</span>
              </button>
              
              <button
                type="button"
                onClick={() => router.push('/admin/clientes')}
                disabled={loading}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-8 py-3 rounded-xl font-medium transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
        )}
      </div>

      {/* Modal de Credenciais */}
      {mostrarModalCredenciais && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">✅</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Cliente Cadastrado!</h2>
              <p className="text-gray-600">Repasse estas credenciais para o cliente</p>
            </div>

            <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6 mb-6 border border-green-200">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-600 block mb-1">Pelada ID:</label>
                  <div className="bg-white px-4 py-3 rounded-lg border border-gray-300">
                    <span className="text-2xl font-bold text-green-600 tracking-wider">{credenciaisGeradas.peladaId}</span>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-600 block mb-1">Usuário:</label>
                  <div className="bg-white px-4 py-3 rounded-lg border border-gray-300">
                    <span className="text-lg font-semibold text-gray-800">{credenciaisGeradas.usuario}</span>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-600 block mb-1">Senha:</label>
                  <div className="bg-white px-4 py-3 rounded-lg border border-gray-300">
                    <span className="text-2xl font-bold text-blue-600 tracking-widest">{credenciaisGeradas.senha}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  const texto = `🎯 Credenciais PelADM\n\nPelada ID: ${credenciaisGeradas.peladaId}\nUsuário: ${credenciaisGeradas.usuario}\nSenha: ${credenciaisGeradas.senha}\n\nAcesse: [URL do sistema]`;
                  navigator.clipboard.writeText(texto);
                  alert('📋 Credenciais copiadas!');
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-xl font-semibold transition-colors flex items-center justify-center space-x-2"
              >
                <span>📋</span>
                <span>Copiar Credenciais</span>
              </button>

              <button
                onClick={() => {
                  setMostrarModalCredenciais(false);
                  router.push('/admin/clientes');
                }}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-xl font-semibold transition-colors"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}