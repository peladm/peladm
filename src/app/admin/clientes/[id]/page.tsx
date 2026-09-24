'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { validarAcessoMaster } from '../../../../lib/adminAuth';
import { hashSenha, obterCredenciais } from '../../../../lib/credenciais';

export default function DashboardCliente() {
  const router = useRouter();
  const params = useParams();
  const clienteId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [editandoFinanceiro, setEditandoFinanceiro] = useState(false);
  const [valorPlano, setValorPlano] = useState('');
  const [dataVencimento, setDataVencimento] = useState('');
  const [acessoPeladaTradicional, setAcessoPeladaTradicional] = useState(true);
  const [acessoModoTorneio, setAcessoModoTorneio] = useState(false);
  const [salvandoAcessos, setSalvandoAcessos] = useState(false);
  const [cliente, setCliente] = useState<any>(null);
  
  // Estados dos modais individuais
  const [modalVencimento, setModalVencimento] = useState(false);
  const [modalOferta, setModalOferta] = useState(false);
  const [modalBoasVindas, setModalBoasVindas] = useState(false);
  const [modalPagamento, setModalPagamento] = useState(false);
  const [modalAtraso, setModalAtraso] = useState(false);
  
  // Estados dos dados dos formulários individuais
  const [dadosVencimento, setDadosVencimento] = useState({ diasRestantes: '' });
  const [dadosOferta, setDadosOferta] = useState({ tipo: '', valor: '', beneficios: '' });
  const [dadosBoasVindas, setDadosBoasVindas] = useState({ mensagemAdicional: '' });
  const [dadosPagamento, setDadosPagamento] = useState({ novaDataVencimento: '', observacao: '' });
  const [dadosAtraso, setDadosAtraso] = useState({ diasAtraso: '', consequencia: '' });
  const [showModalConfirmarPagamento, setShowModalConfirmarPagamento] = useState(false);
  const [mesesPagamento, setMesesPagamento] = useState<number>(1);
  const [showModalExclusao, setShowModalExclusao] = useState(false);
  const [tipoExclusao, setTipoExclusao] = useState<'imediata' | 'agendada'>('imediata');
  const [dataRemocaoProgramada, setDataRemocaoProgramada] = useState('');
  const [senhaConfirmacao, setSenhaConfirmacao] = useState('');
  const [processandoExclusao, setProcessandoExclusao] = useState(false);

  useEffect(() => {
    const validarECarregar = async () => {
      const autorizado = await validarAcessoMaster();
      if (!autorizado) {
        alert('🚫 Acesso restrito ao perfil master.');
        router.push('/');
        return;
      }
      carregarCliente();
    };

    validarECarregar();
  }, [clienteId, router]);

  const carregarCliente = async () => {
    try {
      console.log('📥 Carregando cliente com ID:', clienteId);
      
      const credenciais = obterCredenciais();
      
      if (!credenciais?.pelada_id || !credenciais?.username || !credenciais?.senha) {
        throw new Error('Credenciais inválidas');
      }

      const response = await fetch('/api/admin/clientes/get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pelada_id: credenciais.pelada_id,
          username: credenciais.username,
          senha_hash: credenciais.senha,
          clienteId: clienteId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        alert('Cliente não encontrado!');
        router.push('/admin/clientes');
        return;
      }

      const data = await response.json();
      console.log('📦 Dados retornados:', data.cliente);

      setCliente(data.cliente);
      setAcessoPeladaTradicional(data.cliente?.acesso_pelada_tradicional ?? true);
      setAcessoModoTorneio(data.cliente?.acesso_modo_torneio ?? false);
      console.log('✅ Cliente salvo no state:', data.cliente);

      // Não buscar automaticamente ao carregar - usuário clica no refresh
    } catch (error) {
      console.error('💥 Erro ao carregar:', error);
      alert('Erro ao carregar cliente!');
      router.push('/admin/clientes');
    } finally {
      setLoading(false);
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

  const dataHojeInput = () => new Date().toISOString().split('T')[0];

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
      const credenciais = obterCredenciais();
      if (!credenciais?.pelada_id || !credenciais?.username || !credenciais?.senha) {
        alert('Credenciais inválidas. Faça login novamente.');
        router.push('/login');
        return;
      }

      const response = await fetch('/api/admin/clientes/financeiro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pelada_id: credenciais.pelada_id,
          username: credenciais.username,
          senha_hash: credenciais.senha,
          clienteId,
          acao: 'atualizar',
          valor_plano: parseFloat(valorPlano) || 0,
          data_vencimento: dataVencimento || null,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Falha ao salvar dados financeiros');
      }
      
      alert('Dados financeiros atualizados com sucesso!');
      setEditandoFinanceiro(false);
      await carregarCliente();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      alert(`Erro ao salvar dados financeiros: ${error.message || error}`);
    }
  };

  const salvarAcessosCliente = async () => {
    try {
      const credenciais = obterCredenciais();

      if (!credenciais?.pelada_id || !credenciais?.username || !credenciais?.senha) {
        alert('Credenciais inválidas. Faça login novamente.');
        router.push('/login');
        return;
      }

      setSalvandoAcessos(true);

      const response = await fetch('/api/admin/clientes/acesso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pelada_id: credenciais.pelada_id,
          username: credenciais.username,
          senha_hash: credenciais.senha,
          clienteId,
          acesso_pelada_tradicional: acessoPeladaTradicional,
          acesso_modo_torneio: acessoModoTorneio,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao salvar acessos');
      }

      setCliente((prev: any) => ({
        ...prev,
        acesso_pelada_tradicional: data.cliente?.acesso_pelada_tradicional ?? acessoPeladaTradicional,
        acesso_modo_torneio: data.cliente?.acesso_modo_torneio ?? acessoModoTorneio,
      }));

      alert('Acessos atualizados com sucesso!');
    } catch (error: any) {
      console.error('Erro ao salvar acessos:', error);
      alert(`Erro ao salvar acessos: ${error.message || 'falha desconhecida'}`);
    } finally {
      setSalvandoAcessos(false);
    }
  };

  const atualizarStatusCliente = async (novoStatus: 'ativo' | 'bloqueado') => {
    try {
      const credenciais = obterCredenciais();

      if (!credenciais?.pelada_id || !credenciais?.username || !credenciais?.senha) {
        alert('Credenciais inválidas. Faça login novamente.');
        router.push('/login');
        return false;
      }

      const response = await fetch('/api/admin/clientes/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pelada_id: credenciais.pelada_id,
          username: credenciais.username,
          senha_hash: credenciais.senha,
          clienteId,
          novoStatus,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao atualizar status');
      }

      await carregarCliente();
      return true;
    } catch (error: any) {
      console.error('Erro ao atualizar status do cliente:', error);
      alert(`Erro ao atualizar status: ${error.message || 'falha desconhecida'}`);
      return false;
    }
  };

  const abrirModalExclusao = () => {
    setTipoExclusao(cliente?.status === 'excluido' ? 'agendada' : 'imediata');
    setDataRemocaoProgramada(cliente?.data_remocao_programada || dataHojeInput());
    setSenhaConfirmacao('');
    setShowModalExclusao(true);
  };

  const statusAtualCliente = String(cliente?.status || 'ativo').toLowerCase();
  const acaoStatusPrimaria = statusAtualCliente === 'bloqueado' ? 'ativar' : 'bloquear';

  const executarExclusaoPerfil = async () => {
    if (tipoExclusao === 'agendada' && !dataRemocaoProgramada) {
      alert('Informe a data de remoção.');
      return;
    }

    if (!senhaConfirmacao.trim()) {
      alert('Digite a senha de confirmação.');
      return;
    }

    try {
      const credenciais = obterCredenciais();
      if (!credenciais?.pelada_id || !credenciais?.username || !credenciais?.senha) {
        alert('Credenciais inválidas. Faça login novamente.');
        router.push('/login');
        return;
      }

      const senhaConfirmacaoHash = await hashSenha(senhaConfirmacao);

      setProcessandoExclusao(true);

      const response = await fetch('/api/admin/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pelada_id: credenciais.pelada_id,
          username: credenciais.username,
          senha_hash: credenciais.senha,
          senha_confirmacao_hash: senhaConfirmacaoHash,
          clienteId,
          acao: tipoExclusao === 'imediata' ? 'remover_imediatamente' : 'programar_exclusao',
          dataRemocao: tipoExclusao === 'agendada' ? dataRemocaoProgramada : null,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Falha ao processar exclusão');
      }

      setShowModalExclusao(false);

      if (tipoExclusao === 'imediata') {
        alert('Perfil e dados vinculados removidos com sucesso.');
        router.push('/admin/clientes');
        return;
      }

      alert('Exclusão programada com sucesso.');
      setSenhaConfirmacao('');
      await carregarCliente();
    } catch (error: any) {
      console.error('Erro ao excluir perfil:', error);
      alert(`Erro ao excluir perfil: ${error.message || error}`);
    } finally {
      setProcessandoExclusao(false);
    }
  };

  const cancelarExclusaoProgramada = async () => {
    try {
      const credenciais = obterCredenciais();
      if (!credenciais?.pelada_id || !credenciais?.username || !credenciais?.senha) {
        alert('Credenciais inválidas. Faça login novamente.');
        router.push('/login');
        return;
      }

      setProcessandoExclusao(true);

      const response = await fetch('/api/admin/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pelada_id: credenciais.pelada_id,
          username: credenciais.username,
          senha_hash: credenciais.senha,
          clienteId,
          acao: 'cancelar_exclusao',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Falha ao cancelar exclusão');
      }

      alert('Exclusão programada cancelada.');
      await carregarCliente();
    } catch (error: any) {
      console.error('Erro ao cancelar exclusão:', error);
      alert(`Erro ao cancelar exclusão: ${error.message || error}`);
    } finally {
      setProcessandoExclusao(false);
    }
  };

  const confirmarPagamento = async () => {
    if (!cliente.data_vencimento) {
      alert('Defina uma data de vencimento primeiro!');
      return;
    }

    setMesesPagamento(1);
    setShowModalConfirmarPagamento(true);
  };

  const confirmarPagamentoComMeses = async () => {
    if (!cliente?.data_vencimento) {
      alert('Defina uma data de vencimento primeiro!');
      return;
    }

    if (!mesesPagamento || mesesPagamento < 1) {
      alert('Informe ao menos 1 mês.');
      return;
    }

    try {
      const credenciais = obterCredenciais();
      if (!credenciais?.pelada_id || !credenciais?.username || !credenciais?.senha) {
        alert('Credenciais inválidas. Faça login novamente.');
        router.push('/login');
        return;
      }

      const response = await fetch('/api/admin/clientes/financeiro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pelada_id: credenciais.pelada_id,
          username: credenciais.username,
          senha_hash: credenciais.senha,
          clienteId,
          acao: 'confirmar_pagamento',
          meses: mesesPagamento,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Falha ao confirmar pagamento');
      }

      const novaData = data.novaData;

      setShowModalConfirmarPagamento(false);
      alert(
        `Pagamento confirmado! Vencimento renovado por ${mesesPagamento} ${mesesPagamento > 1 ? 'meses' : 'mês'} para ` +
        new Date(novaData + 'T00:00:00').toLocaleDateString('pt-BR')
      );
      await carregarCliente();
    } catch (error: any) {
      console.error('Erro:', error);
      alert(`Erro ao confirmar pagamento: ${error.message || error}`);
    }
  };

  const templates = [
    {
      titulo: '🔔 Vencimento Próximo',
      descricao: 'Avisar sobre vencimento iminente',
      action: () => setModalVencimento(true)
    },
    {
      titulo: '🎁 Propaganda/Oferta',
      descricao: 'Enviar oferta personalizada',
      action: () => setModalOferta(true)
    },
    {
      titulo: '👋 Boas-vindas',
      descricao: 'Mensagem de boas-vindas',
      action: () => setModalBoasVindas(true)
    },
    {
      titulo: '✅ Pagamento Confirmado',
      descricao: 'Confirmar recebimento',
      action: () => setModalPagamento(true)
    },
    {
      titulo: '⚠️ Lembrete de Atraso',
      descricao: 'Notificar sobre atraso',
      action: () => setModalAtraso(true)
    }
  ];

  const enviarVencimento = () => {
    if (!dadosVencimento.diasRestantes) {
      alert('Informe quantos dias restam!');
      return;
    }
    const mensagem = `Olá ${cliente.nome}! 🔔\n\nSeu acesso vence em ${dadosVencimento.diasRestantes} dias.\n\nPara evitar o bloqueio do acesso, faça a renovação o quanto antes. Qualquer dúvida, estamos à disposição!`;
    abrirWhatsApp(mensagem);
    setModalVencimento(false);
    setDadosVencimento({ diasRestantes: '' });
  };

  const enviarOferta = () => {
    if (!dadosOferta.tipo || !dadosOferta.beneficios) {
      alert('Preencha o tipo de oferta e benefícios!');
      return;
    }
    const valorTexto = dadosOferta.valor ? `\n💰 Valor especial: R$ ${dadosOferta.valor}` : '';
    const mensagem = `Olá ${cliente.nome}! 🎁\n\n${dadosOferta.tipo}${valorTexto}\n\n🎯 Benefícios:\n${dadosOferta.beneficios}\n\nEntre em contato para aproveitar!`;
    abrirWhatsApp(mensagem);
    setModalOferta(false);
    setDadosOferta({ tipo: '', valor: '', beneficios: '' });
  };

  const enviarBoasVindas = () => {
    const adicional = dadosBoasVindas.mensagemAdicional ? `\n\n${dadosBoasVindas.mensagemAdicional}` : '';
    const mensagem = `Olá ${cliente.nome}! 👋\n\nSeja bem-vindo(a) ao PelADM!\n\nSeu acesso já está liberado e você pode começar a usar todas as funcionalidades do sistema.${adicional}\n\nQualquer dúvida, estamos à disposição para ajudar!`;
    abrirWhatsApp(mensagem);
    setModalBoasVindas(false);
    setDadosBoasVindas({ mensagemAdicional: '' });
  };

  const enviarPagamento = () => {
    if (!dadosPagamento.novaDataVencimento) {
      alert('Informe a nova data de vencimento!');
      return;
    }
    const dataFormatada = new Date(dadosPagamento.novaDataVencimento + 'T00:00:00').toLocaleDateString('pt-BR');
    const observacaoTexto = dadosPagamento.observacao ? `\n\n📝 ${dadosPagamento.observacao}` : '';
    const mensagem = `Olá ${cliente.nome}! ✅\n\nSeu pagamento foi confirmado com sucesso!\n\nSeu acesso está renovado até ${dataFormatada}.${observacaoTexto}\n\nObrigado pela confiança!`;
    abrirWhatsApp(mensagem);
    setModalPagamento(false);
    setDadosPagamento({ novaDataVencimento: '', observacao: '' });
  };

  const enviarAtraso = () => {
    if (!dadosAtraso.diasAtraso) {
      alert('Informe quantos dias de atraso!');
      return;
    }
    const consequenciaTexto = dadosAtraso.consequencia ? `\n\n⚠️ ${dadosAtraso.consequencia}` : '';
    const mensagem = `Olá ${cliente.nome}! ⚠️\n\nIdentificamos que seu pagamento está com ${dadosAtraso.diasAtraso} dias de atraso.${consequenciaTexto}\n\nPara manter seu acesso ativo, regularize sua situação o quanto antes.\n\nEstamos à disposição para ajudar!`;
    abrirWhatsApp(mensagem);
    setModalAtraso(false);
    setDadosAtraso({ diasAtraso: '', consequencia: '' });
  };

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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center space-x-2">
            <span>📋</span>
            <span>Resumo do Cliente</span>
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
            <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-200">
              <span className="text-xs text-gray-600 block mb-0.5">Pelada ID:</span>
              <span className="text-sm font-bold text-gray-800">{cliente.pelada_id}</span>
            </div>

            <div className="p-2.5 bg-green-50 rounded-lg border border-green-200">
              <span className="text-xs text-gray-600 block mb-0.5">Nome:</span>
              <span className="text-sm font-bold text-gray-800">{cliente.nome}</span>
            </div>

            <div className="p-2.5 bg-purple-50 rounded-lg border border-purple-200">
              <span className="text-xs text-gray-600 block mb-0.5">Telefone:</span>
              <span className="text-sm font-bold text-gray-800">{cliente.telefone || 'Não informado'}</span>
            </div>

            <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
              <span className="text-xs text-gray-600 block mb-0.5">Acessos:</span>
              <span className="text-sm font-bold text-emerald-700">
                {cliente.acesso_pelada_tradicional !== false ? 'Tradicional' : 'Sem Tradicional'}
                {' | '}
                {cliente.acesso_modo_torneio === true ? 'Torneio' : 'Sem Torneio'}
              </span>
            </div>

            <div className="p-2.5 bg-cyan-50 rounded-lg border border-cyan-200">
              <span className="text-xs text-gray-600 block mb-0.5">Usuário:</span>
              <span className="text-sm font-bold text-gray-800 font-mono">{cliente.username}</span>
            </div>

            <div className="p-2.5 bg-orange-50 rounded-lg border border-orange-200">
              <span className="text-xs text-gray-600 block mb-0.5">Senha:</span>
              <span className="text-sm font-bold text-gray-800 font-mono">{cliente.senha}</span>
            </div>

            <div className="p-2.5 bg-red-50 rounded-lg border border-red-200">
              <span className="text-xs text-gray-600 block mb-0.5">Nome da Pelada:</span>
              <span className="text-sm font-bold text-gray-800">{cliente.nome_pelada || 'Não informado'}</span>
            </div>

            <div className="p-2.5 bg-yellow-50 rounded-lg border border-yellow-200">
              <span className="text-xs text-gray-600 block mb-0.5">Cidade:</span>
              <span className="text-sm font-bold text-gray-800">{cliente.cidade || 'Não informado'}</span>
            </div>

            <div className="p-2.5 bg-indigo-50 rounded-lg border border-indigo-200">
              <span className="text-xs text-gray-600 block mb-0.5">UF:</span>
              <span className="text-sm font-bold text-gray-800">{cliente.uf || 'Não informado'}</span>
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

        {/* Controle Financeiro */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-800 flex items-center space-x-2">
                <span>💰</span>
                <span>Controle Financeiro e Status</span>
              </h2>
              <p className="text-sm text-gray-500 mt-1">Gerencie valores, vencimentos e bloqueio do cliente</p>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Valor do acesso (R$)</label>
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
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border-2 border-green-200">
                  <div className="text-sm text-gray-600 mb-1">Valor do acesso</div>
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
              
              {cliente.data_vencimento && (
                <button
                  onClick={confirmarPagamento}
                  className="w-full bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold transition-colors flex items-center justify-center space-x-2"
                >
                  <span>✅</span>
                  <span>Confirmar Pagamento?</span>
                </button>
              )}
            </div>
          )}

          <div className="mt-6 pt-5 border-t border-gray-200">
            <div className="mb-4">
              <h3 className="text-base font-bold text-gray-800 mb-1">Status do Cliente</h3>
              <p className="text-sm text-gray-500">Controle de acesso ao sistema</p>
            </div>

              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="mb-3">
                <button
                  onClick={async () => {
                    const novoStatus = acaoStatusPrimaria === 'ativar' ? 'ativo' : 'bloqueado';
                    const mensagemConfirmacao = acaoStatusPrimaria === 'ativar'
                      ? 'Deseja ATIVAR este cliente?'
                      : 'Deseja BLOQUEAR este cliente?';

                    if (!confirm(mensagemConfirmacao)) return;

                    const ok = await atualizarStatusCliente(novoStatus);
                    if (ok) {
                      alert(acaoStatusPrimaria === 'ativar' ? 'Cliente ativado!' : 'Cliente bloqueado!');
                    }
                  }}
                  className={`w-full px-4 py-3 rounded-lg font-bold transition-colors text-white ${acaoStatusPrimaria === 'ativar' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                >
                  {acaoStatusPrimaria === 'ativar' ? 'ATIVAR' : 'BLOQUEAR'}
                </button>
              </div>

              <div className={`mt-3 px-3 py-2 rounded-md text-sm font-medium ${
                cliente.status === 'ativo'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : cliente.status === 'bloqueado'
                  ? 'bg-red-50 text-red-800 border border-red-200'
                  : cliente.status === 'excluido'
                  ? 'bg-gray-900 text-white border border-gray-700'
                  : 'bg-gray-100 text-gray-700 border border-gray-300'
              }`}>
                <span className="font-bold">Status atual:</span>{' '}
                {cliente.status === 'ativo' && '✅ Cliente com acesso liberado'}
                {cliente.status === 'bloqueado' && '🚫 Cliente bloqueado (acesso negado)'}
                {cliente.status === 'excluido' && '🗑️ Cliente com exclusão programada'}
              </div>
            </div>
          </div>
        </div>

        {/* Controle de Acesso */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-1">Controle de Acesso por Modo</h2>
              <p className="text-sm text-gray-500">Escolha quais modos este cliente pode usar</p>
            </div>
            <button
              onClick={salvarAcessosCliente}
              disabled={salvandoAcessos}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2.5 rounded-lg font-semibold transition-colors"
            >
              {salvandoAcessos ? 'Salvando...' : 'Salvar Acessos'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4 cursor-pointer">
              <input
                type="checkbox"
                checked={acessoPeladaTradicional}
                onChange={(e) => setAcessoPeladaTradicional(e.target.checked)}
                className="w-5 h-5"
              />
              <div>
                <div className="font-semibold text-emerald-900">Pelada Tradicional</div>
                <div className="text-xs text-emerald-700">Libera acesso às telas da pelada tradicional.</div>
              </div>
            </label>

            <label className="flex items-center gap-3 bg-sky-50 border border-sky-200 rounded-xl p-4 cursor-pointer">
              <input
                type="checkbox"
                checked={acessoModoTorneio}
                onChange={(e) => setAcessoModoTorneio(e.target.checked)}
                className="w-5 h-5"
              />
              <div>
                <div className="font-semibold text-sky-900">Modo Torneio</div>
                <div className="text-xs text-sky-700">Permissão salva, mas o modo segue bloqueado para todos em desenvolvimento.</div>
              </div>
            </label>
          </div>
        </div>

        {/* Quadro de Avisos */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-800 flex items-center space-x-2">
              <span>📢</span>
              <span>Quadro de Avisos</span>
            </h2>
            <p className="text-sm text-gray-500 mt-1">Envie mensagens personalizadas via WhatsApp</p>
          </div>

          <div className="space-y-3">
            {templates.map((template, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 hover:border-green-300 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-gray-800 text-sm">{template.titulo}</h3>
                    <p className="text-xs text-gray-500 mt-1">{template.descricao}</p>
                  </div>
                  <button
                    onClick={template.action}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Abrir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {cliente.is_master !== true && (
          <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
            <button
              onClick={abrirModalExclusao}
              disabled={processandoExclusao}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white px-4 py-3 rounded-lg font-semibold transition-colors"
            >
              Excluir Perfil
            </button>

            {cliente.status === 'excluido' && cliente.data_remocao_programada && (
              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <div className="flex-1 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800 font-medium">
                  Perfil nos excluídos até {formatarDataUsuario(cliente.data_remocao_programada + 'T00:00:00')}
                </div>
                <button
                  onClick={cancelarExclusaoProgramada}
                  disabled={processandoExclusao}
                  className="bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-60 text-gray-800 px-4 py-3 rounded-lg font-semibold transition-colors"
                >
                  Cancelar exclusão agendada
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Confirmar Pagamento por Meses */}
      {showModalConfirmarPagamento && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-5 rounded-t-2xl">
              <h2 className="text-xl font-bold">✅ Confirmar Pagamento</h2>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600">
                Quantos meses deseja adicionar ao vencimento deste cliente?
              </p>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Meses</label>
                <input
                  type="number"
                  min={1}
                  value={mesesPagamento}
                  onChange={(e) => setMesesPagamento(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowModalConfirmarPagamento(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-3 rounded-lg font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarPagamentoComMeses}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg font-semibold transition-colors"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModalExclusao && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-red-600 to-rose-600 text-white p-5 rounded-t-2xl">
              <h2 className="text-xl font-bold">Excluir perfil</h2>
            </div>
            <div className="p-5 space-y-4">
              <label className="flex items-center gap-3 border border-gray-200 rounded-xl p-4 cursor-pointer">
                <input
                  type="radio"
                  name="tipo-exclusao"
                  checked={tipoExclusao === 'imediata'}
                  onChange={() => setTipoExclusao('imediata')}
                />
                <span className="font-semibold text-gray-800">Remover o perfil imediatamente</span>
              </label>

              <label className="flex items-start gap-3 border border-gray-200 rounded-xl p-4 cursor-pointer">
                <input
                  type="radio"
                  name="tipo-exclusao"
                  className="mt-1"
                  checked={tipoExclusao === 'agendada'}
                  onChange={() => setTipoExclusao('agendada')}
                />
                <div className="flex-1 space-y-3">
                  <span className="font-semibold text-gray-800 block">Programar remoção para</span>
                  <input
                    type="date"
                    value={dataRemocaoProgramada}
                    min={dataHojeInput()}
                    onChange={(e) => setDataRemocaoProgramada(e.target.value)}
                    disabled={tipoExclusao !== 'agendada'}
                    className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-100"
                  />
                </div>
              </label>

              <div>
                <input
                  type="password"
                  value={senhaConfirmacao}
                  onChange={(e) => setSenhaConfirmacao(e.target.value)}
                  placeholder="Senha de confirmação"
                  className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowModalExclusao(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-3 rounded-lg font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={executarExclusaoPerfil}
                  disabled={processandoExclusao}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white px-4 py-3 rounded-lg font-semibold transition-colors"
                >
                  {processandoExclusao ? 'Processando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Vencimento Próximo */}
      {modalVencimento && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-6 rounded-t-2xl">
              <h2 className="text-2xl font-bold">🔔 Vencimento Próximo</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Quantos dias restam até o vencimento?
                </label>
                <input
                  type="number"
                  value={dadosVencimento.diasRestantes}
                  onChange={(e) => setDadosVencimento({ diasRestantes: e.target.value })}
                  placeholder="Ex: 3"
                  className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setModalVencimento(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-3 rounded-lg font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={enviarVencimento}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg font-semibold transition-colors"
                >
                  Enviar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Oferta */}
      {modalOferta && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="bg-gradient-to-r from-pink-500 to-pink-600 text-white p-6 rounded-t-2xl">
              <h2 className="text-2xl font-bold">🎁 Propaganda/Oferta</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tipo de Oferta*
                </label>
                <input
                  type="text"
                  value={dadosOferta.tipo}
                  onChange={(e) => setDadosOferta({ ...dadosOferta, tipo: e.target.value })}
                  placeholder="Ex: Renovação sem taxa de adesão"
                  className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Valor (opcional)
                </label>
                <input
                  type="text"
                  value={dadosOferta.valor}
                  onChange={(e) => setDadosOferta({ ...dadosOferta, valor: e.target.value })}
                  placeholder="Ex: 79,90"
                  className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Benefícios*
                </label>
                <textarea
                  value={dadosOferta.beneficios}
                  onChange={(e) => setDadosOferta({ ...dadosOferta, beneficios: e.target.value })}
                  placeholder="Ex: ✅ Usuários ilimitados\n✅ Relatórios avançados\n✅ Suporte prioritário"
                  className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  rows={4}
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
                  className="flex-1 bg-pink-600 hover:bg-pink-700 text-white px-4 py-3 rounded-lg font-semibold transition-colors"
                >
                  Enviar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Boas-vindas */}
      {modalBoasVindas && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-t-2xl">
              <h2 className="text-2xl font-bold">👋 Boas-vindas</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Mensagem Adicional (opcional)
                </label>
                <textarea
                  value={dadosBoasVindas.mensagemAdicional}
                  onChange={(e) => setDadosBoasVindas({ mensagemAdicional: e.target.value })}
                  placeholder="Ex: Aproveite para conhecer nossa área de relatórios!"
                  className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  rows={3}
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setModalBoasVindas(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-3 rounded-lg font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={enviarBoasVindas}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg font-semibold transition-colors"
                >
                  Enviar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pagamento Confirmado */}
      {modalPagamento && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-t-2xl">
              <h2 className="text-2xl font-bold">✅ Pagamento Confirmado</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nova Data de Vencimento*
                </label>
                <input
                  type="date"
                  value={dadosPagamento.novaDataVencimento}
                  onChange={(e) => setDadosPagamento({ ...dadosPagamento, novaDataVencimento: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Observação (opcional)
                </label>
                <textarea
                  value={dadosPagamento.observacao}
                  onChange={(e) => setDadosPagamento({ ...dadosPagamento, observacao: e.target.value })}
                  placeholder="Ex: Pagamento recebido via PIX"
                  className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={2}
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setModalPagamento(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-3 rounded-lg font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={enviarPagamento}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-semibold transition-colors"
                >
                  Enviar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Atraso */}
      {modalAtraso && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 rounded-t-2xl">
              <h2 className="text-2xl font-bold">⚠️ Lembrete de Atraso</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Dias de Atraso*
                </label>
                <input
                  type="number"
                  value={dadosAtraso.diasAtraso}
                  onChange={(e) => setDadosAtraso({ ...dadosAtraso, diasAtraso: e.target.value })}
                  placeholder="Ex: 5"
                  className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Consequência (opcional)
                </label>
                <textarea
                  value={dadosAtraso.consequencia}
                  onChange={(e) => setDadosAtraso({ ...dadosAtraso, consequencia: e.target.value })}
                  placeholder="Ex: Seu acesso será bloqueado em 2 dias caso não regularize"
                  className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  rows={3}
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setModalAtraso(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-3 rounded-lg font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={enviarAtraso}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white px-4 py-3 rounded-lg font-semibold transition-colors"
                >
                  Enviar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
