'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ewcswczqvelhlwpbraea.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Y3N3Y3pxdmVsaGx3cGJyYWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2Mzc1MzksImV4cCI6MjA4MDIxMzUzOX0.DRzgAuj171lUG_7wMVCFhuDH71sGxlHHEB28qBN9wks'
);

export default function DashboardCliente() {
  const router = useRouter();
  const params = useParams();
  const clienteId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [showTableDetails, setShowTableDetails] = useState(false);
  const [editandoFinanceiro, setEditandoFinanceiro] = useState(false);
  const [valorPlano, setValorPlano] = useState('');
  const [dataVencimento, setDataVencimento] = useState('');
  const [cliente, setCliente] = useState<any>(null);
  const [usageData, setUsageData] = useState<any>(null);
  const [totalDatabaseSize, setTotalDatabaseSize] = useState<string>('');
  const [usuarios, setUsuarios] = useState<any[]>([]);

  useEffect(() => {
    carregarCliente();
    carregarUsuarios();
  }, [clienteId]);

  const carregarCliente = async () => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', clienteId)
        .single();

      if (error || !data) {
        alert('Cliente não encontrado!');
        router.push('/admin/clientes');
        return;
      }

      setCliente(data);

      // Não buscar automaticamente ao carregar - usuário clica no refresh
      // if (data.plano === 'Gold' || data.plano === 'Premium') {
      //   buscarUsoSupabase(data);
      // }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao carregar cliente!');
      router.push('/admin/clientes');
    } finally {
      setLoading(false);
    }
  };

  const buscarUsoSupabase = async (clienteData?: any) => {
    const dadosCliente = clienteData || cliente;

    setLoadingUsage(true);
    try {
      const { createClient } = await import('@supabase/supabase-js');
      
      // Se tiver banco dedicado, usa ele. Senão usa o principal
      const clienteSupabase = (dadosCliente?.supabase_url && dadosCliente?.supabase_anon_key)
        ? createClient(dadosCliente.supabase_url, dadosCliente.supabase_anon_key)
        : supabase; // Banco principal

      console.log('🔍 Buscando dados do banco...');

      // Buscar tamanho TOTAL do banco
      const { data: totalSizeData, error: totalSizeError } = await clienteSupabase
        .rpc('get_database_total_size');

      if (totalSizeError) {
        console.error('❌ Erro ao buscar tamanho total:', totalSizeError);
        throw new Error(`Função get_database_total_size() falhou: ${totalSizeError.message}`);
      }

      if (totalSizeData && totalSizeData.length > 0) {
        setTotalDatabaseSize(totalSizeData[0].total_size_formatted);
        console.log('✅ Tamanho total do banco:', totalSizeData[0].total_size_formatted);
      }

      // Buscar detalhamento por tabela
      const { data: tableSizeData, error: rpcError } = await clienteSupabase
        .rpc('get_tables_size');

      if (rpcError) {
        console.error('❌ Erro ao buscar tamanho das tabelas:', rpcError);
        throw new Error(`Função get_tables_size() falhou: ${rpcError.message}`);
      }

      if (tableSizeData && tableSizeData.length > 0) {
        const usageInfo = tableSizeData.map((table: any) => {
          const totalSize = parseInt(table.total_size) || 0;
          const rowCount = parseInt(table.row_count) || 0;
          const tableName = table.tablename.replace('public.', '');

          const size = totalSize > 1024 * 1024
            ? `${(totalSize / (1024 * 1024)).toFixed(2)} MB`
            : totalSize > 1024
            ? `${(totalSize / 1024).toFixed(2)} KB`
            : `${totalSize} bytes`;

          return {
            tablename: tableName,
            size: `${rowCount} reg (${size})`,
            size_bytes: totalSize,
            row_count: rowCount
          };
        });

        setUsageData(usageInfo);
        console.log('✅ Tamanho por tabela obtido com sucesso');
      } else {
        setUsageData(null);
      }
    } catch (error: any) {
      console.error('Erro:', error);
      alert(`Erro: ${error.message}`);
    } finally {
      setLoadingUsage(false);
    }
  };

  const carregarUsuarios = async () => {
    setLoadingUsuarios(true);
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('pelada_id', clienteId);

      if (error) throw error;

      setUsuarios(data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      setUsuarios([]);
    } finally {
      setLoadingUsuarios(false);
    }
  };

  const formatarDataUsuario = (dataISO: string) => {
    if (!dataISO) return 'N/A';
    const data = new Date(dataISO);
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    return `${dia}/${mes}/${ano}`;
  };

  const calcularTempoCadastro = () => {
    if (!cliente?.created_at) return 'Data desconhecida';
    
    const cadastro = new Date(cliente.created_at);
    const agora = new Date();
    const diffMs = agora.getTime() - cadastro.getTime();
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffMeses = Math.floor(diffDias / 30);
    const diffAnos = Math.floor(diffDias / 365);
    
    if (diffAnos > 0) return `${diffAnos} ano${diffAnos > 1 ? 's' : ''}`;
    if (diffMeses > 0) return `${diffMeses} ${diffMeses === 1 ? 'mês' : 'meses'}`;
    return `${diffDias} dia${diffDias !== 1 ? 's' : ''}`;
  };

  const formatarDataCadastro = () => {
    if (!cliente?.created_at) return '';
    const cadastro = new Date(cliente.created_at);
    const dia = String(cadastro.getDate()).padStart(2, '0');
    const mes = String(cadastro.getMonth() + 1).padStart(2, '0');
    const ano = cadastro.getFullYear();
    return `${dia}/${mes}/${ano}`;
  };

  const formatarUltimoAcesso = () => {
    if (!cliente?.last_access) return 'Nunca';
    
    const lastAccess = new Date(cliente.last_access);
    const agora = new Date();
    const diffMs = agora.getTime() - lastAccess.getTime();
    const diffMinutos = Math.floor(diffMs / (1000 * 60));
    const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    // Considera online se acessou nos últimos 5 minutos
    if (diffMinutos < 5) return 'Online';
    if (diffMinutos < 60) return `A ${diffMinutos} minuto${diffMinutos > 1 ? 's' : ''}`;
    if (diffHoras < 24) return `A ${diffHoras} hora${diffHoras > 1 ? 's' : ''}`;
    return `A ${diffDias} dia${diffDias > 1 ? 's' : ''}`;
  };

  const getPlanColor = (plano: string) => {
    switch (plano?.toLowerCase()) {
      case 'free': return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'gold': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'premium': return 'bg-purple-100 text-purple-800 border-purple-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const abrirWhatsApp = (mensagem: string) => {
    if (!cliente?.telefone) {
      alert('Cliente não tem telefone cadastrado!');
      return;
    }
    const numero = cliente.telefone.replace(/\D/g, '');
    const mensagemFormatada = encodeURIComponent(mensagem.replace('[Nome]', cliente.nome));
    window.open(`https://wa.me/55${numero}?text=${mensagemFormatada}`, '_blank');
  };

  const salvarDadosFinanceiros = async () => {
    try {
      const { error } = await supabase
        .from('clientes')
        .update({
          valor_plano: parseFloat(valorPlano) || 0,
          data_vencimento: dataVencimento || null
        })
        .eq('id', clienteId);

      if (error) throw error;
      
      alert('Dados financeiros atualizados com sucesso!');
      setEditandoFinanceiro(false);
      await carregarCliente();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar dados financeiros!');
    }
  };

  const templates = [
    {
      titulo: '🔔 Vencimento Próximo',
      mensagem: `Olá [Nome]! Seu plano está próximo do vencimento. Para evitar o bloqueio do acesso, faça a renovação o quanto antes. Qualquer dúvida, estamos à disposição!`
    },
    {
      titulo: '🎁 Propaganda/Oferta',
      mensagem: `Olá [Nome]! Temos uma oferta especial de upgrade para você! Entre em contato para saber mais e aproveitar condições exclusivas.`
    },
    {
      titulo: '👋 Boas-vindas',
      mensagem: `Olá [Nome]! Seja bem-vindo(a) ao PelADM! Seu acesso já está liberado. Qualquer dúvida, estamos à disposição para ajudar!`
    },
    {
      titulo: '✅ Pagamento Confirmado',
      mensagem: `Olá [Nome]! Seu pagamento foi confirmado com sucesso! Seu acesso está renovado. Obrigado pela confiança!`
    },
    {
      titulo: '💬 Suporte Técnico',
      mensagem: `Olá [Nome]! Identificamos que você pode estar com dúvidas. Estamos aqui para ajudar! Me conte como posso te auxiliar.`
    },
    {
      titulo: '⚠️ Lembrete de Atraso',
      mensagem: `Olá [Nome]! Identificamos que seu pagamento está em atraso. Para manter seu acesso ativo, regularize sua situação o quanto antes. Estamos à disposição!`
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-green-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!cliente) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <button
            onClick={() => router.push('/admin/clientes')}
            className="text-gray-600 hover:text-gray-800 transition-colors flex items-center space-x-2 font-medium"
          >
            <span className="text-xl">←</span>
            <span>Voltar</span>
          </button>

          <button
            onClick={() => router.push(`/admin/clientes/cadastrar?id=${clienteId}`)}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center space-x-2"
          >
            <span>✏️</span>
            <span>Editar Dados</span>
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Card de Resumo */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">📋 Resumo do Cliente</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Pelada ID:</span>
              <span className="text-lg font-bold text-gray-800">{cliente.id}</span>
            </div>

            <div className="p-3 bg-green-50 rounded-lg border border-green-200 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Nome:</span>
              <span className="text-lg font-bold text-gray-800">{cliente.nome}</span>
            </div>

            <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Telefone:</span>
              <span className="text-lg font-bold text-gray-800">{cliente.telefone || 'Não informado'}</span>
            </div>

            <div className={`p-3 rounded-lg border flex items-center justify-between ${getPlanColor(cliente.plano)}`}>
              <span className="text-sm font-medium opacity-75">Plano:</span>
              <span className="text-lg font-bold">{cliente.plano || 'Free'}</span>
            </div>
          </div>
        </div>

        {/* Cards de Tempo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 h-24 flex items-center">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center space-x-2">
                <span className="text-xl">📅</span>
                <h3 className="font-bold text-gray-800 text-sm">Tempo de Cadastro</h3>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-blue-600">{calcularTempoCadastro()}</p>
                <p className="text-xs text-gray-500">{formatarDataCadastro()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 h-24 flex items-center">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center space-x-2">
                <span className="text-xl">🕐</span>
                <h3 className="font-bold text-gray-800 text-sm">Último Acesso</h3>
              </div>
              <p className="text-lg font-bold text-green-600">{formatarUltimoAcesso()}</p>
            </div>
          </div>
        </div>

        {/* Uso do Supabase */}
        {(cliente.plano === 'Gold' || cliente.plano === 'Premium') && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-800">💾 Banco de Dados</h2>
                {!cliente.supabase_url && !cliente.supabase_anon_key && (
                  <p className="text-xs text-gray-500 mt-1">🏢 Usando banco compartilhado</p>
                )}
              </div>
              <button
                onClick={buscarUsoSupabase}
                disabled={loadingUsage}
                className="text-2xl hover:scale-110 disabled:opacity-50 transition-all"
                title="Atualizar dados"
              >
                {loadingUsage ? '⏳' : '🔄'}
              </button>
            </div>

            {loadingUsage && !usageData ? (
              <div className="text-center py-8 text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto mb-2"></div>
                <p className="text-sm">Carregando dados do banco...</p>
              </div>
            ) : usageData ? (
              <div className="space-y-3">
                {/* BANCO TOTAL */}
                {totalDatabaseSize && (
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border-2 border-purple-300">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-800 text-base">🗄️ Banco Total</span>
                      <span className="font-bold text-purple-700 text-2xl">{totalDatabaseSize}</span>
                    </div>
                  </div>
                )}
                
                {/* TABELAS (clicável para expandir) */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border-2 border-green-200">
                  <div 
                    onClick={() => setShowTableDetails(!showTableDetails)}
                    className="flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <span className="font-bold text-gray-800 text-base flex items-center space-x-2">
                      <span>📊 Tabelas</span>
                      <span className="text-xs text-gray-500">
                        {showTableDetails ? '▼' : '▶'}
                      </span>
                    </span>
                    <span className="font-bold text-green-700 text-xl">
                      {usageData.reduce((acc: number, t: any) => acc + (t.size_bytes || 0), 0) > 1024 * 1024
                        ? `${(usageData.reduce((acc: number, t: any) => acc + (t.size_bytes || 0), 0) / (1024 * 1024)).toFixed(2)} MB`
                        : `${(usageData.reduce((acc: number, t: any) => acc + (t.size_bytes || 0), 0) / 1024).toFixed(2)} KB`}
                    </span>
                  </div>

                  {/* Lista detalhada (recolhível) */}
                  {showTableDetails && (
                    <div className="mt-3 space-y-1.5">
                      {usageData.map((table: any, index: number) => (
                        <div key={index} className="bg-white px-3 py-2 rounded flex items-center justify-between">
                          <span className="text-sm text-gray-700">📁 {table.tablename}</span>
                          <span className="text-xs text-gray-600 font-mono">{table.size}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">Clique em 🔄 para carregar os dados</p>
              </div>
            )}
          </div>
        )}

        {/* Controle Financeiro */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-800 flex items-center space-x-2">
                <span>💰</span>
                <span>Controle Financeiro</span>
              </h2>
              <p className="text-sm text-gray-500 mt-1">Gerencie valores e vencimentos</p>
            </div>
            {!editandoFinanceiro && (
              <button
                onClick={() => {
                  setEditandoFinanceiro(true);
                  setValorPlano(cliente.valor_plano?.toString() || '0');
                  setDataVencimento(cliente.data_vencimento || '');
                }}
                className="text-2xl hover:scale-110 transition-all"
                title="Editar"
              >
                ✏️
              </button>
            )}
          </div>

          {editandoFinanceiro ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Valor do Plano (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={valorPlano}
                  onChange={(e) => setValorPlano(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data de Vencimento</label>
                <input
                  type="date"
                  value={dataVencimento}
                  onChange={(e) => setDataVencimento(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={salvarDadosFinanceiros}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                >
                  💾 Salvar
                </button>
                <button
                  onClick={() => setEditandoFinanceiro(false)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg font-semibold transition-colors"
                >
                  ✕ Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border-2 border-green-200">
                <div className="text-sm text-gray-600 mb-1">Valor do Plano</div>
                <div className="text-2xl font-bold text-green-700">
                  R$ {(cliente.valor_plano || 0).toFixed(2).replace('.', ',')}
                </div>
              </div>
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-4 rounded-lg border-2 border-blue-200">
                <div className="text-sm text-gray-600 mb-1">Vencimento</div>
                <div className="text-2xl font-bold text-blue-700">
                  {cliente.data_vencimento 
                    ? new Date(cliente.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')
                    : 'Não definido'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quadro de Avisos */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-800 flex items-center space-x-2">
              <span>📢</span>
              <span>Quadro de Avisos</span>
            </h2>
            <p className="text-sm text-gray-500 mt-1">Envie mensagens padronizadas via WhatsApp</p>
          </div>

          <div className="space-y-3">
            {templates.map((template, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 hover:border-green-300 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-gray-800 text-sm">{template.titulo}</h3>
                  <button
                    onClick={() => abrirWhatsApp(template.mensagem)}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1"
                  >
                    <span>💬</span>
                    <span>Enviar</span>
                  </button>
                </div>
                <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                  {template.mensagem.replace('[Nome]', cliente.nome)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Usuários do Cliente */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-800 flex items-center space-x-2">
                <span>👥</span>
                <span>Usuários Cadastrados</span>
              </h2>
              <p className="text-sm text-gray-500 mt-1">Usuários que podem fazer login nesta pelada</p>
            </div>
            <button
              onClick={carregarUsuarios}
              disabled={loadingUsuarios}
              className="text-2xl hover:scale-110 disabled:opacity-50 transition-all"
              title="Atualizar lista"
            >
              {loadingUsuarios ? '⏳' : '🔄'}
            </button>
          </div>

          {loadingUsuarios ? (
            <div className="text-center py-8 text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto mb-2"></div>
              <p className="text-sm">Carregando usuários...</p>
            </div>
          ) : usuarios.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">😴</div>
              <p className="text-sm">Nenhum usuário cadastrado ainda</p>
            </div>
          ) : (
            <div className="space-y-2">
              {usuarios.map((usuario, index) => (
                <div 
                  key={usuario.id || index} 
                  className="bg-gray-50 rounded-lg p-3 border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">{usuario.role === 'admin' ? '👑' : '👤'}</span>
                      <span className="font-bold text-gray-800 text-base">{usuario.username}</span>
                      {usuario.role === 'admin' && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full border border-purple-200">
                          Admin
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 font-medium">Total de usuários:</span>
                  <span className="text-green-600 font-bold text-lg">{usuarios.length}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Status */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-1">Status do Cliente</h2>
              <p className="text-sm text-gray-500">Controle de acesso ao sistema</p>
            </div>
            {cliente.is_master && (
              <div className="px-4 py-1.5 rounded-lg font-medium bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 border border-purple-300 flex items-center space-x-1.5">
                <span>👑</span>
                <span className="text-sm font-bold">Usuário Master</span>
              </div>
            )}
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-6 mb-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="status-ativo"
                  checked={cliente.status === 'ativo'}
                  onChange={async (e) => {
                    const novoStatus = e.target.checked ? 'ativo' : 'inativo';
                    if (confirm(`Deseja ${novoStatus === 'ativo' ? 'ATIVAR' : 'INATIVAR'} este cliente?`)) {
                      try {
                        await supabase.from('clientes').update({ status: novoStatus }).eq('id', clienteId);
                        alert(`Cliente ${novoStatus === 'ativo' ? 'ativado' : 'inativado'}!`);
                        await carregarCliente();
                      } catch (error) {
                        alert('Erro ao alterar status!');
                      }
                    }
                  }}
                  className="mr-2.5 w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500 cursor-pointer"
                />
                <label htmlFor="status-ativo" className="text-sm font-semibold text-green-700 cursor-pointer select-none">
                  ✅ Ativo
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="status-bloqueado"
                  checked={cliente.status === 'bloqueado'}
                  onChange={async (e) => {
                    const novoStatus = e.target.checked ? 'bloqueado' : 'inativo';
                    if (confirm(`Deseja ${novoStatus === 'bloqueado' ? 'BLOQUEAR' : 'desbloquear'} este cliente?`)) {
                      try {
                        await supabase.from('clientes').update({ status: novoStatus }).eq('id', clienteId);
                        alert(`Cliente ${novoStatus === 'bloqueado' ? 'bloqueado' : 'desbloqueado'}!`);
                        await carregarCliente();
                      } catch (error) {
                        alert('Erro ao alterar status!');
                      }
                    }
                  }}
                  className="mr-2.5 w-5 h-5 text-red-600 border-gray-300 rounded focus:ring-red-500 cursor-pointer"
                />
                <label htmlFor="status-bloqueado" className="text-sm font-semibold text-red-700 cursor-pointer select-none">
                  🚫 Bloqueado
                </label>
              </div>
            </div>

            <div className={`mt-3 px-3 py-2 rounded-md text-sm font-medium ${
              cliente.status === 'ativo' 
                ? 'bg-green-50 text-green-800 border border-green-200'
                : cliente.status === 'bloqueado'
                ? 'bg-red-50 text-red-800 border border-red-200'
                : 'bg-gray-100 text-gray-700 border border-gray-300'
            }`}>
              <span className="font-bold">Status atual:</span>{' '}
              {cliente.status === 'ativo' && "✅ Cliente com acesso liberado"}
              {cliente.status === 'inativo' && "⏸️ Cliente sem acesso (inativo)"}
              {cliente.status === 'bloqueado' && "🚫 Cliente bloqueado (acesso negado)"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
