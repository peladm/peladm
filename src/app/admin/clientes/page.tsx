'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { validarAcessoMaster } from '../../../lib/adminAuth';
import { obterCredenciais } from '../../../lib/credenciais';

interface Cliente {
  pelada_id: string;
  nome: string;
  nome_pelada?: string;
  cidade?: string;
  uf?: string;
  email?: string;
  telefone?: string;
  status: string;
  created_at?: string;
  data_vencimento?: string;
  valor_plano?: number;
  username?: string;
  is_master?: boolean;
  data_remocao_programada?: string | null;
  acesso_pelada_tradicional?: boolean;
  acesso_modo_torneio?: boolean;
}

interface ConsumoTabela {
  tablename: string;
  size: string;
  size_bytes: number;
  row_count: number;
}

const LIMITE_BANCO_BYTES = 500 * 1024 * 1024;

export default function AdminClientes() {
  const router = useRouter();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<'ativos' | 'bloqueados' | 'excluidos' | 'vencimento'>('ativos');
  const [loadingUsoBanco, setLoadingUsoBanco] = useState(false);
  const [mostrarDetalhesConsumo, setMostrarDetalhesConsumo] = useState(false);
  const [consumoTotalBanco, setConsumoTotalBanco] = useState('');
  const [consumoTotalBytes, setConsumoTotalBytes] = useState(0);
  const [percentualUsoBanco, setPercentualUsoBanco] = useState(0);
  const [consumoTabelas, setConsumoTabelas] = useState<ConsumoTabela[]>([]);
  const [setupConsumoPendente, setSetupConsumoPendente] = useState(false);
  const [mostrarVoltarTopo, setMostrarVoltarTopo] = useState(false);
  
  // Estados dos modais de cada template
  const [modalNovidades, setModalNovidades] = useState(false);
  const [modalOferta, setModalOferta] = useState(false);
  const [modalPromocao, setModalPromocao] = useState(false);
  const [modalDicas, setModalDicas] = useState(false);
  const [modalAvisos, setModalAvisos] = useState(false);
  const [modalAvisosSistema, setModalAvisosSistema] = useState(false);
  
  // Estados dos dados dos formulários
  const [novidades, setNovidades] = useState({ resumo: '' });
  const [oferta, setOferta] = useState({ valorOferta: '', beneficios: '' });
  const [promocao, setPromocao] = useState({ 
    valorOferta: '', 
    vencimento: '', 
    tipo: '', 
    observacao: '' 
  });
  const [dicas, setDicas] = useState({ texto: '' });
  const [avisos, setAvisos] = useState({ titulo: '', assunto: '' });
  const [avisoSistema, setAvisoSistema] = useState({
    mensagem: '',
    planoAlvo: 'todos',
    dataInicio: '',
    dataFim: ''
  });
  const [avisosAtivos, setAvisosAtivos] = useState<any[]>([]);

  useEffect(() => {
    const validarECarregar = async () => {
      const autorizado = await validarAcessoMaster();
      if (!autorizado) {
        alert('🚫 Acesso restrito ao perfil master.');
        router.push('/');
        return;
      }
      carregarClientes();
      carregarConsumoBanco();
    };

    validarECarregar();
  }, [router]);

  useEffect(() => {
    if (modalAvisosSistema) {
      carregarAvisosAtivos();
    }
  }, [modalAvisosSistema]);

  useEffect(() => {
    const onScroll = () => {
      setMostrarVoltarTopo(window.scrollY > 320);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const carregarAvisosAtivos = async () => {
    try {
      const credenciais = obterCredenciais();
      if (!credenciais?.pelada_id || !credenciais?.username || !credenciais?.senha) {
        throw new Error('Credenciais inválidas');
      }

      const response = await fetch('/api/admin/clientes/avisos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pelada_id: credenciais.pelada_id,
          username: credenciais.username,
          senha_hash: credenciais.senha,
          acao: 'listar',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao carregar avisos');
      }

      setAvisosAtivos(data.avisos || []);
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

  const carregarConsumoBanco = async () => {
    try {
      setLoadingUsoBanco(true);
      const credenciais = obterCredenciais();

      if (!credenciais?.pelada_id || !credenciais?.username || !credenciais?.senha) {
        throw new Error('Credenciais inválidas');
      }

      const response = await fetch('/api/admin/clientes/database-usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pelada_id: credenciais.pelada_id,
          username: credenciais.username,
          senha_hash: credenciais.senha,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao carregar consumo do banco');
      }

      setConsumoTotalBanco(data.totalSizeFormatted || 'Não configurado');
      setConsumoTotalBytes(Number(data.totalSizeBytes) || 0);
      setPercentualUsoBanco(Number(data.percentualUso) || 0);
      setConsumoTabelas(data.tables || []);
      setSetupConsumoPendente(Boolean(data.setupPendente));
    } catch (error) {
      console.error('Erro ao carregar consumo do banco:', error);
      setConsumoTotalBanco('Erro ao carregar');
      setConsumoTotalBytes(0);
      setPercentualUsoBanco(0);
      setConsumoTabelas([]);
      setSetupConsumoPendente(true);
    } finally {
      setLoadingUsoBanco(false);
    }
  };

  const getStatusEmoji = (status: string) => {
    switch (status) {
      case 'ativo': return '✅';
      case 'bloqueado': return '🚫';
      case 'excluido': return '🗑️';
      default: return '❓';
    }
  };

  const formatarDataVencimentoCurta = (dataVencimento?: string) => {
    if (!dataVencimento) return '--/--/--';
    return new Date(`${dataVencimento}T00:00:00`).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  const salvarAvisoSistema = async () => {
    if (!avisoSistema.mensagem || !avisoSistema.dataInicio || !avisoSistema.dataFim) {
      alert('Preencha todos os campos obrigatórios!');
      return;
    }

    try {
      const credenciais = obterCredenciais();
      if (!credenciais?.pelada_id || !credenciais?.username || !credenciais?.senha) {
        throw new Error('Credenciais inválidas');
      }

      const response = await fetch('/api/admin/clientes/avisos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pelada_id: credenciais.pelada_id,
          username: credenciais.username,
          senha_hash: credenciais.senha,
          acao: 'criar',
          aviso: avisoSistema,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao salvar aviso');
      }

      alert('Aviso salvo com sucesso!');
      setAvisoSistema({ mensagem: '', planoAlvo: 'todos', dataInicio: '', dataFim: '' });
      carregarAvisosAtivos();
    } catch (error) {
      console.error('Erro ao salvar aviso:', error);
      alert(`Erro ao salvar aviso: ${error}`);
    }
  };

  const excluirAviso = async (id: number) => {
    if (!confirm('Deseja realmente excluir este aviso? Esta ação não pode ser desfeita.')) return;

    try {
      const credenciais = obterCredenciais();
      if (!credenciais?.pelada_id || !credenciais?.username || !credenciais?.senha) {
        throw new Error('Credenciais inválidas');
      }

      const response = await fetch('/api/admin/clientes/avisos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pelada_id: credenciais.pelada_id,
          username: credenciais.username,
          senha_hash: credenciais.senha,
          acao: 'excluir',
          id,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao excluir aviso');
      }

      alert('Aviso excluído com sucesso!');
      carregarAvisosAtivos();
    } catch (error) {
      console.error('Erro:', error);
      alert(`Erro ao excluir aviso: ${error}`);
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
      titulo: '⬆️ Oferta Comercial',
      descricao: 'Envie uma oferta ou condicao especial para os clientes',
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

  const enviarMensagem = (mensagem: string) => {
    const clientesFiltrados = clientes.filter(c => c.status === 'ativo' && c.telefone);

    if (clientesFiltrados.length === 0) {
      alert('Nenhum cliente ativo com telefone cadastrado!');
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

    const valorTexto = oferta.valorOferta ? `\n💰 Valor especial: R$ ${oferta.valorOferta}` : '';
    const mensagem = `Olá [Nome]! ⬆️\n\nTemos uma condicao especial para seu acesso no PelADM.\n\n🎯 Benefícios:\n${oferta.beneficios}${valorTexto}\n\nFale conosco para saber mais!`;

    enviarMensagem(mensagem);
    setOferta({ valorOferta: '', beneficios: '' });
  };

  const enviarPromocao = () => {
    if (!promocao.tipo.trim() || !promocao.valorOferta.trim()) {
      alert('Preencha pelo menos o tipo e valor da oferta!');
      return;
    }
    
    const vencimentoTexto = promocao.vencimento ? `\n⏰ Válido até: ${new Date(promocao.vencimento).toLocaleDateString('pt-BR')}` : '';
    const observacaoTexto = promocao.observacao ? `\n\n📝 ${promocao.observacao}` : '';
    
    const mensagem = `Olá [Nome]! 🎁\n\n${promocao.tipo}\n\n💰 Oferta: R$ ${promocao.valorOferta}${vencimentoTexto}${observacaoTexto}\n\nNão perca essa oportunidade!`;
    
    enviarMensagem(mensagem);
    setPromocao({ valorOferta: '', vencimento: '', tipo: '', observacao: '' });
  };

  const enviarDicas = () => {
    if (!dicas.texto.trim()) {
      alert('Escreva a dica!');
      return;
    }
    const mensagem = `Olá [Nome]! 💡\n\nDica PelADM:\n\n${dicas.texto}\n\nAproveite para otimizar seu uso do sistema!`;
    enviarMensagem(mensagem);
    setDicas({ texto: '' });
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

  const clientesFiltradosPorAba = () => {
    const base = [...clientes];
    const normalizarStatus = (status?: string) => String(status || '').toLowerCase();
    const fixarMasterNoTopo = (lista: Cliente[]) => {
      const masters = lista.filter((c) => c.is_master === true);
      const demais = lista.filter((c) => c.is_master !== true);
      return [...masters, ...demais];
    };

    if (abaAtiva === 'ativos') {
      const lista = base
        .filter((c) => normalizarStatus(c.status) === 'ativo')
        .sort((a, b) => a.nome.localeCompare(b.nome));
      return fixarMasterNoTopo(lista);
    }

    if (abaAtiva === 'bloqueados') {
      const lista = base
        .filter((c) => normalizarStatus(c.status) === 'bloqueado')
        .sort((a, b) => a.nome.localeCompare(b.nome));
      return fixarMasterNoTopo(lista);
    }

    if (abaAtiva === 'excluidos') {
      const lista = base
        .filter((c) => normalizarStatus(c.status) === 'excluido')
        .sort((a, b) => a.nome.localeCompare(b.nome));
      return fixarMasterNoTopo(lista);
    }

    const lista = base
      .filter((c) => normalizarStatus(c.status) !== 'excluido')
      .sort((a, b) => {
        if (!a.data_vencimento) return 1;
        if (!b.data_vencimento) return -1;
        return new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime();
      });
    return fixarMasterNoTopo(lista);
  };

  const calcularStatusVencimento = (dataVencimento?: string) => {
    if (!dataVencimento) {
      return {
        label: 'Sem vencimento',
        classe: 'bg-gray-100 text-gray-700 border-gray-300',
      };
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const venc = new Date(`${dataVencimento}T00:00:00`);
    venc.setHours(0, 0, 0, 0);

    const diffDias = Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDias < 0) {
      return {
        label: `Vencido há ${Math.abs(diffDias)}d`,
        classe: 'bg-red-100 text-red-700 border-red-300',
      };
    }

    if (diffDias === 0) {
      return {
        label: 'Vence hoje',
        classe: 'bg-red-100 text-red-700 border-red-300',
      };
    }

    if (diffDias <= 7) {
      return {
        label: `Vence em ${diffDias}d`,
        classe: 'bg-orange-100 text-orange-700 border-orange-300',
      };
    }

    if (diffDias <= 15) {
      return {
        label: `Vence em ${diffDias}d`,
        classe: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      };
    }

    return {
      label: `Vence em ${diffDias}d`,
      classe: 'bg-green-100 text-green-700 border-green-300',
    };
  };

  const formatarDataCurta = (dataISO?: string | null) => {
    if (!dataISO) return 'Não informado';
    const data = new Date(dataISO.includes('T') ? dataISO : `${dataISO}T00:00:00`);
    if (Number.isNaN(data.getTime())) return 'Não informado';
    return data.toLocaleDateString('pt-BR');
  };

  const calcularMesesEDiasAte = (dataISO?: string | null) => {
    if (!dataISO) return 'Não informado';

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const alvo = new Date(dataISO.includes('T') ? dataISO : `${dataISO}T00:00:00`);
    alvo.setHours(0, 0, 0, 0);

    const diffMs = alvo.getTime() - hoje.getTime();
    const diffDias = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const meses = Math.floor(diffDias / 30);
    const dias = diffDias % 30;

    const partes = [];
    if (meses > 0) partes.push(`${meses} ${meses === 1 ? 'mês' : 'meses'}`);
    if (dias > 0 || partes.length === 0) partes.push(`${dias} ${dias === 1 ? 'dia' : 'dias'}`);
    return partes.join(' e ');
  };

  const calcularDiasBloqueado = (dataVencimento?: string) => {
    if (!dataVencimento) return 0;

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const venc = new Date(dataVencimento.includes('T') ? dataVencimento : `${dataVencimento}T00:00:00`);
    venc.setHours(0, 0, 0, 0);

    return Math.max(0, Math.ceil((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24)));
  };

  const calcularTempoCadastro = (dataISO?: string | null) => {
    if (!dataISO) return 'Não informado';

    const cadastro = new Date(dataISO.includes('T') ? dataISO : `${dataISO}T00:00:00`);
    if (Number.isNaN(cadastro.getTime())) return 'Não informado';

    const agora = new Date();
    agora.setHours(0, 0, 0, 0);
    cadastro.setHours(0, 0, 0, 0);

    const diffDias = Math.max(0, Math.floor((agora.getTime() - cadastro.getTime()) / (1000 * 60 * 60 * 24)));
    const meses = Math.floor(diffDias / 30);
    const dias = diffDias % 30;

    const partes = [];
    if (meses > 0) partes.push(`${meses} ${meses === 1 ? 'mês' : 'meses'}`);
    if (dias > 0 || partes.length === 0) partes.push(`${dias} ${dias === 1 ? 'dia' : 'dias'}`);
    return partes.join(' e ');
  };

  const calcularTempoAte = (dataISO?: string | null) => {
    if (!dataISO) return 'Não informado';

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const alvo = new Date(dataISO.includes('T') ? dataISO : `${dataISO}T00:00:00`);
    if (Number.isNaN(alvo.getTime())) return 'Não informado';
    alvo.setHours(0, 0, 0, 0);

    const diffDias = Math.max(0, Math.ceil((alvo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)));
    const meses = Math.floor(diffDias / 30);
    const dias = diffDias % 30;

    const partes = [];
    if (meses > 0) partes.push(`${meses} ${meses === 1 ? 'mês' : 'meses'}`);
    if (dias > 0 || partes.length === 0) partes.push(`${dias} ${dias === 1 ? 'dia' : 'dias'}`);
    return partes.join(' e ');
  };

  const getResumoListaPorAba = (cliente: Cliente, aba: 'ativos' | 'bloqueados' | 'excluidos' | 'vencimento') => {
    const nome = cliente.nome || 'Cliente sem nome';
    const peladaId = cliente.pelada_id || 'sem pelada_id';
    const nomePelada = cliente.nome_pelada || 'Pelada não informada';
    const cidadeUf = cliente.cidade
      ? `${cliente.cidade}${cliente.uf ? `/${String(cliente.uf).toUpperCase()}` : ''}`
      : 'Cidade/UF não informada';

    if (aba === 'bloqueados') {
      const diasBloqueado = calcularDiasBloqueado(cliente.data_vencimento);
      const bloqueioAutomatico = Boolean(cliente.data_vencimento && new Date(`${cliente.data_vencimento}T00:00:00`).getTime() < new Date().setHours(0, 0, 0, 0));
      return {
        linha1Nome: nome,
        linha1Usuario: peladaId,
        linha2: `${formatarDataCurta(cliente.data_vencimento)} • ${diasBloqueado} ${diasBloqueado === 1 ? 'dia' : 'dias'} bloqueado${diasBloqueado === 1 ? '' : 's'}`,
        linha3: bloqueioAutomatico ? 'Bloqueio automático pela data de vencimento' : 'Bloqueado manualmente na edição do cadastro',
      };
    }

    if (aba === 'excluidos') {
      const dataExclusao = formatarDataCurta(cliente.data_remocao_programada);
      const tempoFaltante = calcularMesesEDiasAte(cliente.data_remocao_programada);
      const dataSolicitacao = formatarDataCurta((cliente as Cliente & { updated_at?: string }).updated_at || null);

      return {
        linha1Nome: nome,
        linha1Usuario: peladaId,
        linha2: `${dataExclusao} • ${tempoFaltante} faltando`,
        linha3: `Solicitei a exclusão em ${dataSolicitacao}`,
      };
    }

    if (aba === 'vencimento') {
      const vencimento = formatarDataCurta(cliente.data_vencimento);
      const tempoAteVencer = calcularTempoAte(cliente.data_vencimento);

      return {
        linha1Nome: nome,
        linha1Usuario: peladaId,
        linha2: `${nomePelada} • Cliente desde ${formatarDataCurta(cliente.created_at)}`,
        linha3: `${vencimento} • ${tempoAteVencer}`,
      };
    }

    return {
      linha1Nome: nome,
      linha1Usuario: peladaId,
      linha2: `${nomePelada} • Cliente desde ${formatarDataCurta(cliente.created_at)}`,
      linha3: cidadeUf,
    };
  };

  const bloquearDragNativo = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
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
            Painel Administrativo
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

      <div className="w-[90%] mx-auto py-6">
        <div className="space-y-6">
        {/* Ações rápidas */}
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => router.push('/admin/clientes/cadastrar')}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors text-sm sm:text-base"
          >
            <span>➕</span>
            <span>Novo Cliente</span>
          </button>

          <button
            onClick={() => setShowTemplates(true)}
            title="Templates do WhatsApp"
            aria-label="Templates do WhatsApp"
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-xl font-bold text-lg flex items-center justify-center transition-all hover:scale-[1.02] shadow-md"
          >
            <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current" role="img">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
          </button>

          <button
            onClick={() => setModalAvisosSistema(true)}
            title="Avisos do sistema"
            aria-label="Avisos do sistema"
            className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-3 rounded-xl font-bold text-lg flex items-center justify-center transition-all hover:scale-[1.02] shadow-md"
          >
            <span className="text-2xl">📢</span>
          </button>
        </div>

        {/* Consumo do banco */}
        <div className="bg-white rounded-xl shadow border border-gray-200 p-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-[15px] font-bold text-gray-800">Consumo do banco (Supabase)</h3>
              <p className="text-[11px] text-gray-500">Visão consolidada do banco centralizado</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMostrarDetalhesConsumo((prev) => !prev)}
                className="text-sm px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
                title={mostrarDetalhesConsumo ? 'Recolher tabelas' : 'Expandir tabelas'}
              >
                {mostrarDetalhesConsumo ? '▼' : '▶'}
              </button>
              <button
                onClick={carregarConsumoBanco}
                className="text-sm px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
                title="Atualizar consumo"
              >
                {loadingUsoBanco ? '⏳' : '↻'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-2.5">
              <p className="text-[11px] text-purple-700 font-semibold mb-1">Banco total</p>
              <p className="text-base font-bold text-purple-900 leading-tight">{consumoTotalBanco || '--'}</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
              <p className="text-[11px] text-emerald-700 font-semibold mb-1">Tabelas monitoradas</p>
              <p className="text-base font-bold text-emerald-900 leading-tight">{consumoTabelas.length}</p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 mb-2">
            <div className="flex items-center justify-between text-[11px] text-blue-800 font-semibold mb-1">
              <span>Limite</span>
              <span>500 MB</span>
            </div>
            <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${percentualUsoBanco >= 90 ? 'bg-red-500' : percentualUsoBanco >= 70 ? 'bg-amber-500' : 'bg-blue-600'}`}
                style={{ width: `${Math.min(percentualUsoBanco, 100)}%` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-blue-900">
              <span>Uso atual: {consumoTotalBytes > 0 ? `${(consumoTotalBytes / (1024 * 1024)).toFixed(2)} MB` : '--'}</span>
              <span className="font-bold">{percentualUsoBanco.toFixed(2)}%</span>
            </div>
          </div>

          {mostrarDetalhesConsumo && consumoTabelas.length > 0 && (
            <div className="space-y-1.5 max-h-40 overflow-auto pr-1">
              {consumoTabelas
                .slice()
                .sort((a, b) => b.size_bytes - a.size_bytes)
                .map((item) => (
                  <div key={item.tablename} className="flex items-center justify-between bg-gray-50 rounded-md px-2.5 py-1.5">
                    <span className="text-xs text-gray-700 truncate pr-2">{item.tablename}</span>
                    <span className="text-[11px] text-gray-600 font-mono whitespace-nowrap">{item.size}</span>
                  </div>
                ))}
            </div>
          )}

          {setupConsumoPendente && (
            <p className="text-[11px] text-amber-700 mt-2">
              Funções RPC de monitoramento não estão 100% configuradas. Verifique SETUP-FUNCOES-RPC.sql.
            </p>
          )}
        </div>

        {/* Lista de Clientes */}
        <div>
          <div className="pb-4 border-b border-gray-200">
            <div className="flex items-center justify-center mb-3">
              <h2 className="text-xl font-bold text-gray-800">Clientes Cadastrados</h2>
            </div>
            <p className="text-gray-600 text-sm mt-1 text-center">
              Total: {clientes.length} clientes 
              {clientes.length > 0 && (
                <span className="ml-2 inline-block">
                  ✅ {clientes.filter(c => c.status === 'ativo').length} • 
                  🚫 {clientes.filter(c => c.status === 'bloqueado').length} •
                  🗑️ {clientes.filter(c => c.status === 'excluido').length}
                </span>
              )}
            </p>
            <div className="flex items-center justify-center gap-2 mt-4 overflow-x-auto whitespace-nowrap pb-1">
              <button
                onClick={() => setAbaAtiva('ativos')}
                title="Ativos"
                aria-label="Ativos"
                className={`w-11 h-11 flex items-center justify-center rounded-lg text-xl border transition-colors flex-shrink-0 ${abaAtiva === 'ativos' ? 'bg-green-600 border-green-700' : 'bg-white border-gray-300 hover:bg-gray-50'}`}
              >
                <span className={abaAtiva === 'ativos' ? 'grayscale-0' : 'opacity-80'}>✅</span>
              </button>
              <button
                onClick={() => setAbaAtiva('bloqueados')}
                title="Bloqueados"
                aria-label="Bloqueados"
                className={`w-11 h-11 flex items-center justify-center rounded-lg text-xl border transition-colors flex-shrink-0 ${abaAtiva === 'bloqueados' ? 'bg-red-600 border-red-700' : 'bg-white border-gray-300 hover:bg-gray-50'}`}
              >
                <span className={abaAtiva === 'bloqueados' ? 'grayscale-0' : 'opacity-80'}>🚫</span>
              </button>
              <button
                onClick={() => setAbaAtiva('excluidos')}
                title="Excluídos"
                aria-label="Excluídos"
                className={`w-11 h-11 flex items-center justify-center rounded-lg text-xl border transition-colors flex-shrink-0 ${abaAtiva === 'excluidos' ? 'bg-gray-700 border-gray-800' : 'bg-white border-gray-300 hover:bg-gray-50'}`}
              >
                <span className={abaAtiva === 'excluidos' ? 'grayscale-0' : 'opacity-80'}>🗑️</span>
              </button>
              <button
                onClick={() => setAbaAtiva('vencimento')}
                title="Vencimento"
                aria-label="Vencimento"
                className={`w-11 h-11 flex items-center justify-center rounded-lg text-xl border transition-colors flex-shrink-0 ${abaAtiva === 'vencimento' ? 'bg-amber-500 border-amber-600' : 'bg-white border-gray-300 hover:bg-gray-50'}`}
              >
                <span className={abaAtiva === 'vencimento' ? 'grayscale-0' : 'opacity-80'}>📅</span>
              </button>
            </div>
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
            <div className="pt-4 pb-2">
              <div className="space-y-3">
                {clientesFiltradosPorAba().map((cliente) => {
                  const isMaster = cliente.is_master === true;
                  const infoVencimento = calcularStatusVencimento(cliente.data_vencimento);
                  const status = String(cliente.status || '').toLowerCase();
                  const acessoTorneio = cliente.acesso_modo_torneio === true;
                  const resumo = getResumoListaPorAba(cliente, abaAtiva);
                  
                  // Definir classes completas (Tailwind precisa de classes completas)
                  let cardClasses = '';
                  
                  if (isMaster) {
                    cardClasses = 'border-2 border-black bg-gray-100';
                  } else if (status === 'bloqueado') {
                    cardClasses = 'border-2 border-red-400 bg-red-50';
                  } else if (status === 'excluido') {
                    cardClasses = 'border-2 border-gray-700 bg-gray-100';
                  } else if (acessoTorneio) {
                    cardClasses = 'border-2 border-sky-400 bg-sky-50';
                  } else {
                    cardClasses = 'border-2 border-green-300 bg-green-50';
                  }
                  
                  return (
                  <div 
                    key={cliente.pelada_id} 
                    onClick={() => router.push(`/admin/clientes/${cliente.pelada_id}`)}
                    onDragStart={bloquearDragNativo}
                    draggable={false}
                    className={`flex items-center justify-between p-4 rounded-lg ${cardClasses} transition-all cursor-pointer hover:shadow-lg hover:scale-[1.02] select-none`}
                  >
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <span className="font-semibold text-gray-800 truncate">{resumo.linha1Nome}</span>
                            <span className="text-xs text-gray-600 font-medium truncate">{resumo.linha1Usuario}</span>
                            {isMaster && <span className="text-xs bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full font-bold">MASTER</span>}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs text-gray-600 leading-tight">{resumo.linha2}</p>
                        {abaAtiva === 'vencimento' ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs text-gray-600 leading-tight">{resumo.linha3.split(' • ')[0]} •</span>
                            <span className={`text-xs font-bold leading-tight px-2 py-0.5 rounded-full border whitespace-nowrap ${infoVencimento.classe}`}>
                              {resumo.linha3.split(' • ')[1] || infoVencimento.label}
                            </span>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-600 leading-tight">{resumo.linha3}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getStatusEmoji(cliente.status)}</span>
                    </div>
                  </div>
                  );
                })}
                {clientesFiltradosPorAba().length === 0 && (
                  <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-5 text-center text-gray-600 text-sm">
                    {abaAtiva === 'excluidos'
                      ? 'Nenhum cliente excluído por enquanto.'
                      : 'Nenhum cliente encontrado nesta aba.'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        </div>
      </div>

      {mostrarVoltarTopo && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          title="Voltar ao topo"
          aria-label="Voltar ao topo"
          className="fixed bottom-5 right-5 z-40 h-9 w-9 rounded-full border border-gray-300 bg-white/90 text-gray-600 shadow-sm backdrop-blur-sm hover:bg-white hover:text-gray-900 transition-all"
        >
          ↑
        </button>
      )}

      {/* Modal Templates */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-6 py-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-none max-h-[90vh] overflow-y-auto">
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-6 py-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-none">
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

      {/* Modal Oferta Comercial */}
      {modalOferta && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-6 py-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-none">
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-6 rounded-t-2xl">
              <h2 className="text-2xl font-bold">⬆️ Oferta Comercial</h2>
            </div>
            <div className="p-6 space-y-4">
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
                  Benefícios da Oferta
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-6 py-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-none max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-pink-500 to-pink-600 text-white p-6 rounded-t-2xl sticky top-0">
              <h2 className="text-2xl font-bold">🎁 Promoção Sazonal</h2>
            </div>
            <div className="p-6 space-y-4">
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
                  placeholder="Ex: Válido até a data informada. Não acumulativo com outras promoções."
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-6 py-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-none">
            <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white p-6 rounded-t-2xl">
              <h2 className="text-2xl font-bold">💡 Dicas</h2>
            </div>
            <div className="p-6 space-y-4">
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-6 py-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-none">
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-6 py-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-none">
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
                  Público-alvo
                </label>
                <div className="w-full border border-gray-300 rounded-lg p-3 bg-gray-50 text-gray-700">
                  Todos os clientes (aviso geral)
                </div>
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
                                Aviso geral
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