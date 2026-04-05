'use client';

import { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { validarAcessoMaster } from '../../../../lib/adminAuth';

// Configuração Supabase
const supabase = createClient(
  'https://ewcswczqvelhlwpbraea.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Y3N3Y3pxdmVsaGx3cGJyYWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2Mzc1MzksImV4cCI6MjA4MDIxMzUzOX0.DRzgAuj171lUG_7wMVCFhuDH71sGxlHHEB28qBN9wks'
);

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
  const [acessoValidado, setAcessoValidado] = useState(false);
  const [carregandoCliente, setCarregandoCliente] = useState(isEdicao);
  const [mostrarModalCredenciais, setMostrarModalCredenciais] = useState(false);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [usageData, setUsageData] = useState<any>(null);
  const [loadingSetup, setLoadingSetup] = useState(false);
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
    senha_supabase: '',
    valor_plano: null as number | null,
    data_vencimento: null as string | null
  });

  useEffect(() => {
    const validarAcesso = async () => {
      const autorizado = await validarAcessoMaster();
      if (!autorizado) {
        alert('🚫 Acesso restrito ao perfil master.');
        router.push('/');
        return;
      }
      setAcessoValidado(true);
    };

    validarAcesso();
  }, [router]);

  // Carregar dados do cliente para edição
  useEffect(() => {
    if (acessoValidado && isEdicao && clienteId) {
      carregarCliente(clienteId);
    }

    if (acessoValidado && !isEdicao) {
      setCarregandoCliente(false);
    }
  }, [acessoValidado, isEdicao, clienteId]);

  const carregarCliente = async (id: string) => {
    setCarregandoCliente(true);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('pelada_id', id)
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
          senha_supabase: data.senha_supabase || '',
          valor_plano: data.valor_plano || null,
          data_vencimento: data.data_vencimento || null
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
      console.log('🔑 Anon Key (primeiros 20 caracteres):', formData.supabase_anon_key?.substring(0, 20) + '...');
      
      const { createClient } = await import('@supabase/supabase-js');
      const clienteSupabase = createClient(formData.supabase_url, formData.supabase_anon_key);

      // Para clientes Premium com banco dedicado, buscar APENAS tabelas dedicadas
      // (jogadores, sessoes, fila, jogos, gols, fila_snapshot)
      const tables = formData.plano === 'Premium' 
        ? ['jogadores', 'sessoes', 'fila', 'jogos', 'gols', 'fila_snapshot']
        : ['jogadores', 'sessoes', 'fila', 'jogos', 'gols'];
      
      const usageInfo = [];

      for (const tableName of tables) {
        try {
          const { count, error } = await clienteSupabase
            .from(tableName)
            .select('*', { count: 'exact', head: true });

          if (error) {
            console.error(`❌ Erro na tabela ${tableName}:`, error);
          } else if (count !== null) {
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
        }
      }

      if (usageInfo.length > 0) {
        setUsageData(usageInfo);
      } else {
        alert('Nenhuma tabela encontrada. Verifique as permissões ou se o banco foi configurado.');
      }
    } catch (error: any) {
      console.error('❌ Erro:', error);
      alert(`Erro ao conectar: ${error.message}`);
    } finally {
      setLoadingUsage(false);
    }
  };

  const configurarBancoDedicado = async () => {
    if (!formData.supabase_url || !formData.supabase_anon_key) {
      alert('❌ Preencha a URL e Anon Key do Supabase primeiro!');
      return;
    }

    const confirmacao = confirm(
      '🗄️ Configurar Banco Dedicado\n\n' +
      'Esta ação irá criar AUTOMATICAMENTE todas as tabelas necessárias:\n\n' +
      '✅ jogadores\n' +
      '✅ sessoes\n' +
      '✅ fila\n' +
      '✅ jogos\n' +
      '✅ gols\n\n' +
      'Incluindo índices, constraints e políticas RLS.\n\n' +
      'Deseja continuar?'
    );

    if (!confirmacao) return;

    setLoadingSetup(true);
    
    try {

      // SQL completo para executar
      const sqlStatements = [
        // Criar tabelas
        `CREATE TABLE IF NOT EXISTS jogadores (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          nome TEXT NOT NULL,
          nivel INTEGER DEFAULT 3 CHECK (nivel >= 1 AND nivel <= 5),
          status TEXT CHECK (status IN ('ativo', 'inativo')) DEFAULT 'ativo',
          pelada_id UUID NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )`,
        `CREATE TABLE IF NOT EXISTS sessoes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          pelada_id UUID NOT NULL,
          status TEXT CHECK (status IN ('ativa', 'finalizada')) DEFAULT 'ativa',
          data_inicio TIMESTAMPTZ DEFAULT NOW(),
          data_fim TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`,
        `CREATE TABLE IF NOT EXISTS fila (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          pelada_id UUID NOT NULL,
          sessao_id UUID REFERENCES sessoes(id) ON DELETE CASCADE,
          jogador_id UUID REFERENCES jogadores(id) ON DELETE CASCADE,
          status TEXT CHECK (status IN ('fila', 'reserva')) DEFAULT 'fila',
          posicao_fila INTEGER DEFAULT 999,
          vitorias_consecutivas INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`,
        `CREATE TABLE IF NOT EXISTS jogos (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          sessao_id UUID REFERENCES sessoes(id) ON DELETE CASCADE,
          time_a_jogadores TEXT[] NOT NULL,
          time_b_jogadores TEXT[] NOT NULL,
          gols_time_a INTEGER DEFAULT 0,
          gols_time_b INTEGER DEFAULT 0,
          time_vencedor TEXT CHECK (time_vencedor IN ('A', 'B', 'empate')),
          duracao INTEGER,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`,
        `CREATE TABLE IF NOT EXISTS gols (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          jogo_id UUID REFERENCES jogos(id) ON DELETE CASCADE,
          jogador_id UUID REFERENCES jogadores(id) ON DELETE CASCADE,
          pelada_id UUID NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`,
        // Criar índices
        `CREATE INDEX IF NOT EXISTS idx_jogadores_pelada ON jogadores(pelada_id)`,
        `CREATE INDEX IF NOT EXISTS idx_sessoes_pelada ON sessoes(pelada_id)`,
        `CREATE INDEX IF NOT EXISTS idx_fila_sessao ON fila(sessao_id)`,
        `CREATE INDEX IF NOT EXISTS idx_jogos_sessao ON jogos(sessao_id)`,
        `CREATE INDEX IF NOT EXISTS idx_gols_jogador ON gols(jogador_id)`,
        // Habilitar RLS
        `ALTER TABLE jogadores ENABLE ROW LEVEL SECURITY`,
        `ALTER TABLE sessoes ENABLE ROW LEVEL SECURITY`,
        `ALTER TABLE fila ENABLE ROW LEVEL SECURITY`,
        `ALTER TABLE jogos ENABLE ROW LEVEL SECURITY`,
        `ALTER TABLE gols ENABLE ROW LEVEL SECURITY`,
        // Criar policies
        `DROP POLICY IF EXISTS "Acesso público jogadores" ON jogadores`,
        `DROP POLICY IF EXISTS "Acesso público sessoes" ON sessoes`,
        `DROP POLICY IF EXISTS "Acesso público fila" ON fila`,
        `DROP POLICY IF EXISTS "Acesso público jogos" ON jogos`,
        `DROP POLICY IF EXISTS "Acesso público gols" ON gols`,
        `CREATE POLICY "Acesso público jogadores" ON jogadores FOR ALL USING (true)`,
        `CREATE POLICY "Acesso público sessoes" ON sessoes FOR ALL USING (true)`,
        `CREATE POLICY "Acesso público fila" ON fila FOR ALL USING (true)`,
        `CREATE POLICY "Acesso público jogos" ON jogos FOR ALL USING (true)`,
        `CREATE POLICY "Acesso público gols" ON gols FOR ALL USING (true)`
      ];

      // Executar SQL via HTTP POST direto na API do Supabase
      const apiUrl = formData.supabase_url.replace('https://', '').split('.')[0];
      const postgrestUrl = `https://${apiUrl}.supabase.co/rest/v1/rpc/exec_sql`;

      let sucessos = 0;
      let falhas = 0;
      const erros: string[] = [];

      // Tentar executar cada statement
      for (const sql of sqlStatements) {
        try {
          const response = await fetch(postgrestUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': formData.supabase_anon_key,
              'Authorization': `Bearer ${formData.supabase_anon_key}`
            },
            body: JSON.stringify({ query: sql })
          });

          if (response.ok) {
            sucessos++;
            console.log('✅ SQL executado:', sql.substring(0, 50) + '...');
          } else {
            falhas++;
            const error = await response.text();
            console.error('❌ Erro:', error);
            erros.push(sql.substring(0, 30) + '...');
          }
        } catch (error: any) {
          falhas++;
          erros.push(sql.substring(0, 30) + '...');
        }
      }

      if (falhas === 0) {
        alert(
          '✅ CONFIGURAÇÃO CONCLUÍDA!\n\n' +
          `${sucessos} operações executadas com sucesso!\n\n` +
          'Estrutura completa criada:\n' +
          '✅ Tabelas: jogadores, sessoes, fila, jogos, gols\n' +
          '✅ Índices otimizados\n' +
          '✅ Políticas RLS configuradas\n\n' +
          'Banco dedicado pronto para uso!'
        );
      } else {
        alert(
          '⚠️ CONFIGURAÇÃO COM ERROS\n\n' +
          `Sucessos: ${sucessos}\n` +
          `Falhas: ${falhas}\n\n` +
          '❌ ATENÇÃO: A Anon Key não tem permissão para executar DDL.\n\n' +
          '📋 SOLUÇÃO:\n' +
          '1. Acesse o Dashboard do Supabase\n' +
          '2. Vá em SQL Editor → New Query\n' +
          '3. Copie e execute: setup-banco-dedicado-premium.sql\n\n' +
          'OU use a Service Role Key com mais permissões.'
        );
      }
    } catch (error: any) {
      console.error('❌ Erro ao configurar banco:', error);
      alert(
        '❌ Erro ao Configurar Banco\n\n' +
        `Erro: ${error.message}\n\n` +
        '🔧 MOTIVO PROVÁVEL:\n' +
        'A Anon Key não tem permissão para executar SQL DDL (CREATE TABLE).\n\n' +
        '📋 SOLUÇÃO MANUAL:\n' +
        '1. Acesse: ' + formData.supabase_url.replace('/rest/v1', '') + '\n' +
        '2. Vá em SQL Editor\n' +
        '3. Execute o arquivo: setup-banco-dedicado-premium.sql\n\n' +
        'Isso criará todas as tabelas automaticamente!'
      );
    } finally {
      setLoadingSetup(false);
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
        senha_supabase: formData.senha_supabase || null,
        valor_plano: formData.valor_plano || null,
        data_vencimento: formData.data_vencimento || null
      };

      let result;
      if (isEdicao) {
        // Update
        result = await supabase
          .from('clientes')
          .update(dadosCliente)
          .eq('pelada_id', clienteId)
          .select();
      } else {
        // Validar nome completo (mínimo 2 nomes)
        const nomes = formData.nome.trim().split(/\s+/);
        if (nomes.length < 2) {
          alert('❌ Por favor, informe o nome completo (Nome e Sobrenome)!');
          setLoading(false);
          return;
        }

        // Insert com pelada_id customizado
        const peladaId = await gerarPeladaIdUnico(formData.nome, formData.telefone);
        const username = gerarUsername(formData.nome);
        const senhaAdmin = gerarSenhaAdmin();
        
        result = await supabase
          .from('clientes')
          .insert([{
            pelada_id: peladaId,  // Usar pelada_id customizado
            username: username,    // Incluir username direto (primeiro nome)
            senha: senhaAdmin,     // Incluir senha direto
            ...dadosCliente
          }])
          .select();

        // Se cliente criado com sucesso, salvar credenciais
        if (!result.error && result.data && result.data.length > 0) {
          const { error: regrasError } = await supabase
            .from('regras')
            .upsert({
              pelada_id: peladaId,
              jogadores_por_time: 5,
              modelo_sorteio: 'equilibrado',
              duracao: 10,
              vitorias_consecutivas: 0,
              prioridade_retorno: 'prioridade',
              regra_empate: 'ambos_saem',
              regra_apos_empate: 'desempate_decide',
              empate_conta_vitoria: false,
              tipo_fila: 'modo_prancheta',
              modo_sincronizacao: 'tempo_real',
              cores_coletes: ['#dc3545', '#000000', '#FFFFFF', '#fbbf24', '#3b82f6', '#10b981']
            }, { onConflict: 'pelada_id' });

          if (regrasError) {
            console.error('⚠️ Cliente criado, mas falhou ao criar regras padrão:', regrasError);
            alert('⚠️ Cliente criado, mas não foi possível inicializar as regras padrão.');
          }

          // Salvar credenciais para exibir no modal
          setCredenciaisGeradas({
            peladaId: peladaId,
            usuario: username,
            senha: senhaAdmin
          });
          setMostrarModalCredenciais(true);
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
                  onChange={(e) => {
                    const novoPlano = e.target.value;
                    const updates: any = { plano: novoPlano };
                    
                    // Se Gold, auto-preencher credenciais do banco principal
                    if (novoPlano === 'Gold') {
                      updates.supabase_url = 'https://ewcswczqvelhlwpbraea.supabase.co';
                      updates.supabase_anon_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Y3N3Y3pxdmVsaGx3cGJyYWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2Mzc1MzksImV4cCI6MjA4MDIxMzUzOX0.DRzgAuj171lUG_7wMVCFhuDH71sGxlHHEB28qBN9wks';
                    }
                    
                    setFormData({...formData, ...updates});
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  disabled={loading}
                  required
                >
                  <option value="Free">Free</option>
                  <option value="Gold">Gold</option>
                  <option value="Premium">Premium</option>
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

            {/* Campos Valor e Vencimento para Gold/Premium */}
            {(formData.plano === 'Gold' || formData.plano === 'Premium') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-blue-50 rounded-xl">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Valor do Plano (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.valor_plano || ''}
                    onChange={(e) => setFormData({...formData, valor_plano: e.target.value ? parseFloat(e.target.value) : null})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="19.90"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data de Vencimento
                  </label>
                  <input
                    type="date"
                    value={formData.data_vencimento || ''}
                    onChange={(e) => setFormData({...formData, data_vencimento: e.target.value || null})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loading}
                  />
                </div>
              </div>
            )}

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