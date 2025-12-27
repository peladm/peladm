'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

// Configuração Supabase
const supabase = createClient(
  'https://ewcswczqvelhlwpbraea.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Y3N3Y3pxdmVsaGx3cGJyYWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2Mzc1MzksImV4cCI6MjA4MDIxMzUzOX0.DRzgAuj171lUG_7wMVCFhuDH71sGxlHHEB28qBN9wks'
);

interface Cliente {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  status: string;
}

export default function AdminClientes() {
  const router = useRouter();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    carregarClientes();
  }, []);

  const carregarClientes = async () => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nome');
      
      if (error) {
        console.error('Erro ao carregar clientes:', error);
      } else {
        setClientes(data || []);
      }
    } catch (error) {
      console.error('Erro:', error);
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

  const abrirWhatsApp = (telefone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const numero = telefone.replace(/\D/g, '');
    window.open(`https://wa.me/55${numero}`, '_blank');
  };

  const templates = [
    {
      titulo: '🔔 Vencimento Próximo',
      mensagem: (nome: string) => `Olá ${nome}! Seu plano está próximo do vencimento. Para evitar o bloqueio do acesso, faça a renovação o quanto antes. Qualquer dúvida, estamos à disposição!`
    },
    {
      titulo: '🎁 Propaganda/Oferta',
      mensagem: (nome: string) => `Olá ${nome}! Temos uma oferta especial de upgrade para você! Entre em contato para saber mais e aproveitar condições exclusivas.`
    },
    {
      titulo: '👋 Boas-vindas',
      mensagem: (nome: string) => `Olá ${nome}! Seja bem-vindo(a) ao PelADM! Seu acesso já está liberado. Qualquer dúvida, estamos à disposição para ajudar!`
    },
    {
      titulo: '✅ Pagamento Confirmado',
      mensagem: (nome: string) => `Olá ${nome}! Seu pagamento foi confirmado com sucesso! Seu acesso está renovado. Obrigado pela confiança!`
    },
    {
      titulo: '💬 Suporte Técnico',
      mensagem: (nome: string) => `Olá ${nome}! Identificamos que você pode estar com dúvidas. Estamos aqui para ajudar! Me conte como posso te auxiliar.`
    },
    {
      titulo: '⚠️ Lembrete de Atraso',
      mensagem: (nome: string) => `Olá ${nome}! Identificamos que seu pagamento está em atraso. Para manter seu acesso ativo, regularize sua situação o quanto antes. Estamos à disposição!`
    }
  ];

  const enviarTemplateMassivo = (templateIndex: number) => {
    const template = templates[templateIndex];
    const clientesAtivos = clientes.filter(c => c.status === 'ativo' && c.telefone);
    
    if (clientesAtivos.length === 0) {
      alert('Nenhum cliente ativo com telefone cadastrado!');
      return;
    }

    if (confirm(`Deseja enviar "${template.titulo}" para ${clientesAtivos.length} cliente(s)?`)) {
      clientesAtivos.forEach(cliente => {
        const mensagem = encodeURIComponent(template.mensagem(cliente.nome));
        const numero = cliente.telefone!.replace(/\D/g, '');
        window.open(`https://wa.me/55${numero}?text=${mensagem}`, '_blank');
      });
    }
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

        {/* Templates WhatsApp */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl shadow-md border-2 border-green-200 p-6">
          <button
            onClick={() => setShowTemplates(true)}
            className="w-full bg-green-600 hover:bg-green-700 text-white px-6 py-4 rounded-xl font-bold text-lg flex items-center justify-center space-x-3 transition-all hover:scale-[1.02]"
          >
            <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
            <span>TEMPLATES DE MENSAGENS WHATSAPP</span>
          </button>
        </div>

        {/* Lista de Clientes */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-800">Clientes Cadastrados</h2>
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
                {clientes.map((cliente) => (
                  <div 
                    key={cliente.id} 
                    onClick={() => router.push(`/admin/clientes/${cliente.id}`)}
                    className={`flex items-center justify-between p-4 rounded-lg border transition-all cursor-pointer hover:shadow-lg hover:scale-[1.02] ${getStatusColor(cliente.status)}`}
                  >
                    <div>
                      <span className="font-medium text-gray-800">{cliente.nome}</span>
                      <p className="text-sm text-gray-600">
                        {cliente.data_vencimento 
                          ? `Vencimento: ${new Date(cliente.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}`
                          : 'Sem vencimento definido'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{getStatusEmoji(cliente.status)}</span>
                    </div>
                  </div>
                ))}
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
                Envie mensagens padronizadas para todos os clientes ativos de uma vez.
              </p>
              
              {templates.map((template, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 hover:border-green-300 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-gray-800">{template.titulo}</h3>
                    <button
                      onClick={() => enviarTemplateMassivo(index)}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                    >
                      Enviar para Todos
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                    {template.mensagem('[Nome do Cliente]')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}