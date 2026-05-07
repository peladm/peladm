'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { validarAcessoMaster } from '../../../lib/adminAuth';
import { obterCredenciais } from '../../../lib/credenciais';

// Configuração Supabase
const supabase = createClient(
  'https://ewcswczqvelhlwpbraea.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Y3N3Y3pxdmVsaGx3cGJyYWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2Mzc1MzksImV4cCI6MjA4MDIxMzUzOX0.DRzgAuj171lUG_7wMVCFhuDH71sGxlHHEB28qBN9wks'
);

interface Cliente {
  pelada_id: string;
  nome: string;
  email?: string;
  telefone?: string;
  status: string;
  plano?: string;
  data_vencimento?: string;
  valor_plano?: number;
  username?: string;
  is_master?: boolean;
}

export default function AdminClientes() {
  const router = useRouter();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);
  const [filtroOrdenacao, setFiltroOrdenacao] = useState<'nome' | 'vencimento' | 'status' | 'plano'>('nome');
  
  // Estados dos modais de cada template
  const [modalNovidades, setModalNovidades] = useState(false);
  const [modalOferta, setModalOferta] = useState(false);
  const [modalPromocao, setModalPromocao] = useState(false);
  const [modalDicas, setModalDicas] = useState(false);
  const [modalAvisos, setModalAvisos] = useState(false);
  const [modalAvisosSistema, setModalAvisosSistema] = useState(false);
  
  // Estados dos dados dos formulários
  const [novidades, setNovidades] = useState({ resumo: '' });
  const [oferta, setOferta] = useState({ planoAlvo: 'todos', valorOferta: '', beneficios: '' });
  const [promocao, setPromocao] = useState({ 
    planoAlvo: 'todos', 
    valorOferta: '', 
    vencimento: '', 
    tipo: '', 
    observacao: '' 
  });
  const [dicas, setDicas] = useState({ texto: '', planoAlvo: 'todos' });
  const [avisos, setAvisos] = useState({ titulo: '', assunto: '' });
  const [avisoSistema, setAvisoSistema] = useState({
    mensagem: '',
    planoAlvo: 'todos',
    dataInicio: '',
    dataFim: ''
  });
  const [avisosAtivos, setAvisosAtivos] = useState<any[]>([]);
  const [mostrarFiltro, setMostrarFiltro] = useState(false);

  useEffect(() => {
    const validarECarregar = async () => {
      const autorizado = await validarAcessoMaster();
      if (!autorizado) {
        alert('🚫 Acesso restrito ao perfil master.');
        router.push('/');
        return;
      }
      carregarClientes();
    };

    validarECarregar();
  }, [router]);

  useEffect(() => {
    if (modalAvisosSistema) {
      carregarAvisosAtivos();
    }
  }, [modalAvisosSistema]);

  const carregarAvisosAtivos = async () => {
    try {
      const { data, error } = await supabase
        .from('avisos_sistema')
        .select('*')
        .eq('ativo', true)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Erro ao carregar avisos:', error);
      } else {
        setAvisosAtivos(data || []);
      }
    } catch (error) {
      console.error('Erro:', error);
    }
  };

  const carregarClientes = async () => {
    try {
      const credenciais = obterCredenciais();
      
      if (!credenciais?.pelada_id || !credenciais?.username || !credenciais?.senha) {
        throw new Error('Credenciais inválidas');
      }

      const response = await fetch('/api/admin/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pelada_id: credenciais.pelada_id,
          username: credenciais.username,
          senha_hash: credenciais.senha,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao carregar clientes');
      }

      const data = await response.json();
      setClientes(data.clientes || []);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      alert(`Erro ao carregar clientes: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const editarCliente = (clienteId: string) => {
    router.push(`/admin/clientes/cadastrar?id=${clienteId}`);
  };

  const getStatusEmoji = (status: string) => {
    switch (status) {
      case 'ativo': return '✅';
      case 'inativo': return '⏸️';
      case 'bloqueado': return '🚫';
      default: return '❓';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ativo': return 'bg-green-50 border-green-200';
      case 'inativo': return 'bg-gray-100 border-gray-300';
      case 'bloqueado': return 'bg-red-50 border-red-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const getPlanoColor = (plano: string, isMaster: boolean) => {
    if (isMaster) return 'bg-gray-100 border-2 border-black';
    
    const planoLower = plano?.toLowerCase() || 'free';
    if (planoLower === 'premium') return 'bg-yellow-50 border-2 border-yellow-400';
    if (planoLower === 'gold') return 'bg-red-50 border-2 border-red-800';
    return 'bg-white border border-gray-200';
  };

  const salvarAvisoSistema = async () => {
    if (!avisoSistema.mensagem || !avisoSistema.dataInicio || !avisoSistema.dataFim) {
      alert('Preencha todos os campos obrigatórios!');
      return;
    }

    try {
      const { error } = await supabase
        .from('avisos_sistema')
        .insert([{
          mensagem: avisoSistema.mensagem,
          plano_alvo: avisoSistema.planoAlvo,
          data_inicio: avisoSistema.dataInicio,
          data_fim: avisoSistema.dataFim,
          ativo: true
        }]);
      
      if (error) {
        console.error('Erro ao salvar aviso:', error);
        alert('Erro ao salvar aviso: ' + error.message);
      } else {
        alert('Aviso salvo com sucesso!');
        setAvisoSistema({ mensagem: '', planoAlvo: 'todos', dataInicio: '', dataFim: '' });
        carregarAvisosAtivos();
      }
    } catch (error) {
      console.error('Erro ao salvar aviso:', error);
      alert('Erro ao salvar aviso!');
    }
  };

  const excluirAviso = async (id: number) => {
    if (!confirm('Deseja realmente excluir este aviso? Esta ação não pode ser desfeita.')) return;

    try {
      const { error } = await supabase
        .from('avisos_sistema')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Erro ao excluir aviso:', error);
        alert('Erro ao excluir aviso!');
      } else {
        alert('Aviso excluído com sucesso!');
        carregarAvisosAtivos();
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao excluir aviso!');
    }
  };

  const abrirWhatsApp = (telefone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const numero = telefone.replace(/\D/g, '');
    window.open(`https://wa.me/55${numero}`, '_blank');
  };

  const templates = [
    {
      titulo: '🆕 Novidades/Atualizações',
      descricao: 'Informe sobre atualizações e novidades do sistema',
      action: () => setModalNovidades(true)
    },
    {
      titulo: '⬆️ Oferta de Upgrade',
      descricao: 'Solicite upgrade mostrando benefícios do próximo plano',
      action: () => setModalOferta(true)
    },
    {
      titulo: '🎁 Promoção Sazonal',
      descricao: 'Envie promoções especiais e ofertas limitadas',
      action: () => setModalPromocao(true)
    },
    {
      titulo: '💡 Dicas',
      descricao: 'Compartilhe dicas úteis sobre o sistema',
      action: () => setModalDicas(true)
    },
    {
      titulo: '📢 Avisos Gerais',
      descricao: 'Envie comunicados gerais para os clientes',
      action: () => setModalAvisos(true)
    }
  ];

  const enviarMensagem = (mensagem: string, planoFiltro: string = 'todos') => {
    let clientesFiltrados = clientes.filter(c => c.status === 'ativo' && c.telefone);
    
    // Filtrar por plano se necessário
    if (planoFiltro !== 'todos') {
      clientesFiltrados = clientesFiltrados.filter(c => 
        c.plano?.toLowerCase() === planoFiltro.toLowerCase()
      );
    }
    
    if (clientesFiltrados.length === 0) {
      alert(`Nenhum cliente ativo ${planoFiltro !== 'todos' ? `no plano ${planoFiltro}` : ''} com telefone cadastrado!`);
      return;
    }

    if (confirm(`Deseja enviar para ${clientesFiltrados.length} cliente(s)?`)) {
      clientesFiltrados.forEach(cliente => {
        const mensagemFinal = mensagem.replace('[Nome]', cliente.nome);
        const mensagemEncoded = encodeURIComponent(mensagemFinal);
        const numero = cliente.telefone!.replace(/\D/g, '');
        window.open(`https://wa.me/55${numero}?text=${mensagemEncoded}`, '_blank');
      });
      
      // Fechar todos os modais
      setModalNovidades(false);
      setModalOferta(false);
      setModalPromocao(false);
      setModalDicas(false);
      setModalAvisos(false);
      setShowTemplates(false);
    }
  };

  const enviarNovidades = () => {
    if (!novidades.resumo.trim()) {
      alert('Preencha o resumo das atualizações!');
      return;
    }
    const mensagem = `Olá [Nome]! 🆕\n\nTemos novidades no PelADM!\n\n${novidades.resumo}\n\nAcesse agora e confira as melhorias!`;
    enviarMensagem(mensagem);
    setNovidades({ resumo: '' });
  };

  const enviarOferta = () => {
    if (!oferta.beneficios.trim()) {
      alert('Preencha os benefícios!');
      return;
    }
    
    let planoDestino = '';
    let planoOrigem = '';
    
    if (oferta.planoAlvo === 'Free') {
      planoDestino = 'Gold';
      planoOrigem = 'Free';
    } else if (oferta.planoAlvo === 'Gold') {
      planoDestino = 'Premium';
      planoOrigem = 'Gold';
    } else {
      planoDestino = 'Premium ou Gold';
      planoOrigem = 'todos';
    }
    
    const valorTexto = oferta.valorOferta ? `\n💰 Valor especial: R$ ${oferta.valorOferta}` : '';
    const mensagem = `Olá [Nome]! ⬆️\n\nQue tal dar um upgrade no seu plano?\n\n🎯 Benefícios do plano ${planoDestino}:\n${oferta.beneficios}${valorTexto}\n\nFale conosco para saber mais!`;
    
    enviarMensagem(mensagem, oferta.planoAlvo === 'todos' ? 'todos' : planoOrigem);
    setOferta({ planoAlvo: 'todos', valorOferta: '', beneficios: '' });
  };

  const enviarPromocao = () => {
    if (!promocao.tipo.trim() || !promocao.valorOferta.trim()) {
      alert('Preencha pelo menos o tipo e valor da oferta!');
      return;
    }
    
    const vencimentoTexto = promocao.vencimento ? `\n⏰ Válido até: ${new Date(promocao.vencimento).toLocaleDateString('pt-BR')}` : '';
    const observacaoTexto = promocao.observacao ? `\n\n📝 ${promocao.observacao}` : '';
    
    const mensagem = `Olá [Nome]! 🎁\n\n${promocao.tipo}\n\n💰 Oferta: R$ ${promocao.valorOferta}${vencimentoTexto}${observacaoTexto}\n\nNão perca essa oportunidade!`;
    
    enviarMensagem(mensagem, promocao.planoAlvo);
    setPromocao({ planoAlvo: 'todos', valorOferta: '', vencimento: '', tipo: '', observacao: '' });
  };

  const enviarDicas = () => {
    if (!dicas.texto.trim()) {
      alert('Escreva a dica!');
      return;
    }
    const mensagem = `Olá [Nome]! 💡\n\nDica PelADM:\n\n${dicas.texto}\n\nAproveite para otimizar seu uso do sistema!`;
    enviarMensagem(mensagem, dicas.planoAlvo);
    setDicas({ texto: '', planoAlvo: 'todos' });
  };

  const enviarAvisos = () => {
    if (!avisos.titulo.trim() || !avisos.assunto.trim()) {
      alert('Preencha o título e o assunto!');
      return;
    }
    const mensagem = `Olá [Nome]! 📢\n\n${avisos.titulo}\n\n${avisos.assunto}\n\nQualquer dúvida, estamos à disposição!`;
    enviarMensagem(mensagem);
    setAvisos({ titulo: '', assunto: '' });
  };

  const ordenarClientes = () => {
    const clientesOrdenados = [...clientes];
    
    // Separar o master (assumindo que é "Adm Matheus" ou o primeiro com email do admin)
    const masterIndex = clientesOrdenados.findIndex(c => 
      c.nome.toLowerCase().includes('adm') || c.email?.includes('matheus')
    );
    
    let master: Cliente | null = null;
    if (masterIndex !== -1) {
      master = clientesOrdenados.splice(masterIndex, 1)[0];
    }
    
    // Ordenar os demais
    switch (filtroOrdenacao) {
      case 'nome':
        clientesOrdenados.sort((a, b) => a.nome.localeCompare(b.nome));
        break;
      case 'vencimento':
        clientesOrdenados.sort((a, b) => {
          if (!a.data_vencimento) return 1;
          if (!b.data_vencimento) return -1;
          return new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime();
        });
        break;
      case 'status':
        const statusOrder = { 'ativo': 1, 'inativo': 2, 'bloqueado': 3 };
        clientesOrdenados.sort((a, b) => {
          const orderA = statusOrder[a.status as keyof typeof statusOrder] || 999;
          const orderB = statusOrder[b.status as keyof typeof statusOrder] || 999;
          return orderA - orderB;
        });
        break;
      case 'plano':
        const planoOrder = { 'premium': 1, 'gold': 2, 'free': 3 };
        clientesOrdenados.sort((a, b) => {
          const planoA = (a.plano || 'free').toLowerCase();
          const planoB = (b.plano || 'free').toLowerCase();
          const orderA = planoOrder[planoA as keyof typeof planoOrder] || 999;
          const orderB = planoOrder[planoB as keyof typeof planoOrder] || 999;
          return orderA - orderB;
        });
        break;
    }
    
    // Adicionar master no início
    if (master) {
      clientesOrdenados.unshift(master);
    }
    
    return clientesOrdenados;
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header exclusivo para esta página */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="text-gray-600 hover:text-gray-800 transition-colors"
          >
            ← Voltar
          </button>
          
          <h1 className="text-xl font-bold text-gray-800 absolute left-1/2 transform -translate-x-1/2">
            Clientes
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

      <div className="p-6">
        <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Gerenciar Clientes</h2>
          </div>
          <button
            onClick={() => router.push('/admin/clientes/cadastrar')}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-semibold flex items-center space-x-2 transition-colors"
          >
            <span>➕</span>
            <span>Novo Cliente</span>
          </button>
        </div>

        {/* Botões de Ação */}
        <div className="space-y-4">
          {/* Templates WhatsApp */}
          <button
            onClick={() => setShowTemplates(true)}
            className="w-full bg-green-600 hover:bg-green-700 text-white px-6 py-4 rounded-xl font-bold text-lg flex items-center justify-center space-x-3 transition-all hover:scale-[1.02] shadow-md"
          >
            <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
            <span>Templates</span>
          </button>

          {/* Avisos do Sistema */}
          <button
            onClick={() => setModalAvisosSistema(true)}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white px-6 py-4 rounded-xl font-bold text-lg flex items-center justify-center space-x-3 transition-all hover:scale-[1.02] shadow-md"
          >
            <span className="text-2xl">📢</span>
            <span>Avisos do Sistema</span>
          </button>
        </div>

        {/* Lista de Clientes */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold text-gray-800">Clientes Cadastrados</h2>
              <div className="relative">
                <button
                  onClick={() => setMostrarFiltro(!mostrarFiltro)}
                  className="text-2xl hover:scale-110 transition-transform"
                  title="Ordenar"
                >
                  🔽
                </button>
                {mostrarFiltro && (
                  <div className="absolute right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-10 py-1 w-48">
                    <button
                      onClick={() => { setFiltroOrdenacao('nome'); setMostrarFiltro(false); }}
                      className={`w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors ${filtroOrdenacao === 'nome' ? 'bg-green-50 font-semibold' : ''}`}
                    >
                      📝 Nome (A-Z)
                    </button>
                    <button
                      onClick={() => { setFiltroOrdenacao('vencimento'); setMostrarFiltro(false); }}
                      className={`w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors ${filtroOrdenacao === 'vencimento' ? 'bg-green-50 font-semibold' : ''}`}
                    >
                      📅 Vencimento
                    </button>
                    <button
                      onClick={() => { setFiltroOrdenacao('status'); setMostrarFiltro(false); }}
                      className={`w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors ${filtroOrdenacao === 'status' ? 'bg-green-50 font-semibold' : ''}`}
                    >
                      🔰 Status
                    </button>
                    <button
                      onClick={() => { setFiltroOrdenacao('plano'); setMostrarFiltro(false); }}
                      className={`w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors ${filtroOrdenacao === 'plano' ? 'bg-green-50 font-semibold' : ''}`}
                    >
                      💎 Plano
                    </button>
                  </div>
                )}
              </div>
            </div>
            <p className="text-gray-600 text-sm mt-1">
              Total: {clientes.length} clientes 
              {clientes.length > 0 && (
                <span className="ml-3">
                  ✅ {clientes.filter(c => c.status === 'ativo').length} • 
                  ⏸️ {clientes.filter(c => c.status === 'inativo').length} • 
                  🚫 {clientes.filter(c => c.status === 'bloqueado').length}
                </span>
              )}
            </p>
          </div>
          
          {loading ? (
            <div className="p-8 text-center">
              <div className="text-4xl mb-4">⏳</div>
              <p className="text-gray-500">Carregando clientes...</p>
            </div>
          ) : clientes.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-6xl mb-4">👥</div>
              <p className="text-gray-500">Nenhum cliente cadastrado ainda</p>
              <p className="text-gray-400 text-sm">Clique em "Novo Cliente" para começar</p>
            </div>
          ) : (
            <div className="p-6">
              <div className="space-y-3">
                {ordenarClientes().map((cliente) => {
                  const isMaster = cliente.is_master === true;
                  const planoLower = (cliente.plano || 'free').toLowerCase();
                  
                  // Definir classes completas (Tailwind precisa de classes completas)
                  let cardClasses = '';
                  
                  if (isMaster) {
                    cardClasses = 'border-2 border-black bg-gray-100';
                  } else if (planoLower === 'premium') {
                    cardClasses = 'border-2 border-yellow-400 bg-yellow-50';
                  } else if (planoLower === 'gold') {
                    cardClasses = 'border-2 border-red-800 bg-red-50';
                  } else {
                    cardClasses = 'border-2 border-gray-300 bg-white';
                  }
                  
                  return (
                  <div 
                    key={cliente.pelada_id} 
                    onClick={() => router.push(`/admin/clientes/${cliente.pelada_id}`)}
                    className={`flex items-center justify-between p-4 rounded-lg ${cardClasses} transition-all cursor-pointer hover:shadow-lg hover:scale-[1.02]`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-800">{cliente.nome}</span>
                        {isMaster && <span className="text-xs bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full font-bold">MASTER</span>}
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs text-gray-600">
                          <span className="font-medium">Plano:</span> {cliente.plano || 'Free'}
                        </p>
                        <p className="text-xs text-gray-600">
                          <span className="font-medium">Vencimento:</span>{' '}
                          {cliente.data_vencimento 
                            ? new Date(cliente.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')
                            : 'Sem vencimento definido'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getStatusEmoji(cliente.status)}</span>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Modal Templates */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <svg viewBox="0 0 24 24" className="w-8 h-8 fill-green-600">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                <h2 className="text-2xl font-bold text-gray-800">Templates</h2>
              </div>
              <button
                onClick={() => setShowTemplates(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600 mb-4">
                Escolha um template e preencha os dados para envio massivo.
              </p>
              
              {templates.map((template, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 hover:border-green-300 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-gray-800">{template.titulo}</h3>
                      <p className="text-sm text-gray-500 mt-1">{template.descricao}</p>
                    </div>
                    <button
                      onClick={template.action}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                    >
                      Abrir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Novidades */}
      {modalNovidades && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-t-2xl">
              <h2 className="text-2xl font-bold">🆕 Novidades/Atualizações</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Resumo das Atualizações
                </label>
                <textarea
                  value={novidades.resumo}
                  onChange={(e) => setNovidades({ resumo: e.target.value })}
                  placeholder="Ex: Adicionamos nova funcionalidade de relatórios avançados e melhoramos a performance do sistema..."
                  className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={5}
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setModalNovidades(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-3 rounded-lg font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={enviarNovidades}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-semibold transition-colors"
                >
                  Enviar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Oferta de Upgrade */}
      {modalOferta && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-6 rounded-t-2xl">
              <h2 className="text-2xl font-bold">⬆️ Oferta de Upgrade</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Plano Alvo (quem vai receber)
                </label>
                <select
                  value={oferta.planoAlvo}
                  onChange={(e) => setOferta({ ...oferta, planoAlvo: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="todos">Todos os Planos</option>
                  <option value="Free">Free → Gold</option>
                  <option value="Gold">Gold → Premium</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Valor da Oferta (opcional)
                </label>
                <input
                  type="text"
                  value={oferta.valorOferta}
                  onChange={(e) => setOferta({ ...oferta, valorOferta: e.target.value })}
                  placeholder="Ex: 79,90"
                  className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Benefícios do Próximo Plano
                </label>
                <textarea
                  value={oferta.beneficios}
                  onChange={(e) => setOferta({ ...oferta, beneficios: e.target.value })}
                  placeholder="Ex: ✅ Mais usuários simultâneos\n✅ Relatórios avançados\n✅ Suporte prioritário..."
                  className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={5}
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setModalOferta(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-3 rounded-lg font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={enviarOferta}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-lg font-semibold transition-colors"
                >
                  Enviar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Promoção Sazonal */}
      {modalPromocao && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-pink-500 to-pink-600 text-white p-6 rounded-t-2xl sticky top-0">
              <h2 className="text-2xl font-bold">🎁 Promoção Sazonal</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Plano Alvo
                </label>
                <select
                  value={promocao.planoAlvo}
                  onChange={(e) => setPromocao({ ...promocao, planoAlvo: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                >
                  <option value="todos">Todos os Planos</option>
                  <option value="Free">Apenas Free</option>
                  <option value="Gold">Apenas Gold</option>
                  <option value="Premium">Apenas Premium</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tipo da Promoção*
                </label>
                <input
                  type="text"
                  value={promocao.tipo}
                  onChange={(e) => setPromocao({ ...promocao, tipo: e.target.value })}
                  placeholder="Ex: Promoção de Fim de Ano - 30% OFF"
                  className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Valor da Oferta*
                </label>
                <input
                  type="text"
                  value={promocao.valorOferta}
                  onChange={(e) => setPromocao({ ...promocao, valorOferta: e.target.value })}
                  placeholder="Ex: 69,90"
                  className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Vencimento da Oferta
                </label>
                <input
                  type="date"
                  value={promocao.vencimento}
                  onChange={(e) => setPromocao({ ...promocao, vencimento: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Observação / Detalhes Adicionais
                </label>
                <textarea
                  value={promocao.observacao}
                  onChange={(e) => setPromocao({ ...promocao, observacao: e.target.value })}
                  placeholder="Ex: Válido apenas para novos upgrades. Não acumulativo com outras promoções."
                  className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  rows={3}
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setModalPromocao(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-3 rounded-lg font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={enviarPromocao}
                  className="flex-1 bg-pink-600 hover:bg-pink-700 text-white px-4 py-3 rounded-lg font-semibold transition-colors"
                >
                  Enviar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dicas */}
      {modalDicas && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white p-6 rounded-t-2xl">
              <h2 className="text-2xl font-bold">💡 Dicas</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Plano Alvo
                </label>
                <select
                  value={dicas.planoAlvo}
                  onChange={(e) => setDicas({ ...dicas, planoAlvo: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                >
                  <option value="todos">Todos os Planos</option>
                  <option value="Free">Apenas Free</option>
                  <option value="Gold">Apenas Gold</option>
                  <option value="Premium">Apenas Premium</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Texto da Dica
                </label>
                <textarea
                  value={dicas.texto}
                  onChange={(e) => setDicas({ ...dicas, texto: e.target.value })}
                  placeholder="Ex: Você sabia que pode exportar seus relatórios em PDF? Acesse a área de estatísticas e clique em 'Exportar'..."
                  className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  rows={5}
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setModalDicas(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-3 rounded-lg font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={enviarDicas}
                  className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-3 rounded-lg font-semibold transition-colors"
                >
                  Enviar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Avisos Gerais */}
      {modalAvisos && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-6 rounded-t-2xl">
              <h2 className="text-2xl font-bold">📢 Avisos Gerais</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Título do Aviso
                </label>
                <input
                  type="text"
                  value={avisos.titulo}
                  onChange={(e) => setAvisos({ ...avisos, titulo: e.target.value })}
                  placeholder="Ex: Manutenção Programada"
                  className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Assunto
                </label>
                <textarea
                  value={avisos.assunto}
                  onChange={(e) => setAvisos({ ...avisos, assunto: e.target.value })}
                  placeholder="Ex: Informamos que no dia 30/12 das 00h às 06h o sistema ficará indisponível para manutenção..."
                  className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  rows={5}
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setModalAvisos(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-3 rounded-lg font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={enviarAvisos}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg font-semibold transition-colors"
                >
                  Enviar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Avisos do Sistema */}
      {modalAvisosSistema && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-3xl">📢</span>
                <h2 className="text-2xl font-bold">Avisos do Sistema</h2>
              </div>
              <button
                onClick={() => setModalAvisosSistema(false)}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
              >
                <span className="text-2xl">✕</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Mensagem do Aviso *
                </label>
                <textarea
                  value={avisoSistema.mensagem}
                  onChange={(e) => setAvisoSistema({ ...avisoSistema, mensagem: e.target.value })}
                  placeholder="Digite a mensagem que aparecerá no quadro de avisos..."
                  className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  rows={4}
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {avisoSistema.mensagem.length}/500 caracteres
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Público-alvo *
                </label>
                <select
                  value={avisoSistema.planoAlvo}
                  onChange={(e) => setAvisoSistema({ ...avisoSistema, planoAlvo: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="todos">Todos os Planos</option>
                  <option value="Free">Free</option>
                  <option value="Gold">Gold</option>
                  <option value="Premium">Premium</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Data de Início *
                  </label>
                  <input
                    type="date"
                    value={avisoSistema.dataInicio}
                    onChange={(e) => setAvisoSistema({ ...avisoSistema, dataInicio: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Data de Fim *
                  </label>
                  <input
                    type="date"
                    value={avisoSistema.dataFim}
                    onChange={(e) => setAvisoSistema({ ...avisoSistema, dataFim: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  onClick={() => setModalAvisosSistema(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-3 rounded-lg font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={salvarAvisoSistema}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white px-4 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2"
                >
                  <span>💾</span>
                  <span>Salvar Aviso</span>
                </button>
              </div>

              {/* Lista de Avisos Ativos */}
              <div className="border-t border-gray-200 pt-6 mt-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center space-x-2">
                  <span>📋</span>
                  <span>Avisos Ativos</span>
                </h3>
                
                {/* TODO: Buscar do banco de dados */}
                <div className="space-y-3">
                  {avisosAtivos.length === 0 ? (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="text-sm text-gray-600 text-center">
                        Nenhum aviso ativo no momento.
                      </p>
                    </div>
                  ) : (
                    avisosAtivos.map((aviso) => (
                      <div key={aviso.id} className="bg-orange-50 border border-orange-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="text-xs font-semibold text-orange-700 bg-orange-100 px-2 py-1 rounded">
                                {aviso.plano_alvo === 'todos' ? 'Todos os Planos' : aviso.plano_alvo}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(aviso.data_inicio).toLocaleDateString('pt-BR')} - {new Date(aviso.data_fim).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                            <p className="text-sm text-gray-800">
                              {aviso.mensagem}
                            </p>
                          </div>
                          <button 
                            onClick={() => excluirAviso(aviso.id)}
                            className="ml-4 text-red-500 hover:text-red-700 font-bold text-lg"
                            title="Excluir aviso"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}