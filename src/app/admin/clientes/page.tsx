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
                      <p className="text-sm text-gray-600">{cliente.email || cliente.telefone}</p>
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
    </div>
  );
}