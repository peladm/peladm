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

const CORES_COLETES_DISPONIVEIS = [
  { hex: '#000000', nome: 'Preto' },
  { hex: '#10b981', nome: 'Verde' },
  { hex: '#dc3545', nome: 'Vermelho' },
  { hex: '#FFFFFF', nome: 'Branco' },
  { hex: '#fbbf24', nome: 'Amarelo' },
  { hex: '#3b82f6', nome: 'Azul' },
  { hex: '#f97316', nome: 'Laranja' },
  { hex: '#ec4899', nome: 'Rosa' },
  { hex: '#8b5cf6', nome: 'Roxo' },
  { hex: '#6b7280', nome: 'Cinza' },
];

const CORES_COLETES_PADRAO = ['#000000', '#10b981'];

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

const montarRegrasPadrao = (peladaId: string): Record<string, any> => ({
  pelada_id: peladaId,
  jogadores_por_time: 5,
  modelo_sorteio: 'equilibrado',
  duracao: 10,
  fila_automatizada: true,
  vitorias_consecutivas: 0,
  prioridade_retorno: 'prioridade',
  regra_empate: 'ambos_saem',
  regra_apos_empate: 'desempate_decide',
  empate_conta_vitoria: false,
  tipo_fila: 'modo_partida',
  modo_sincronizacao: 'tempo_real',
  cores_coletes: CORES_COLETES_PADRAO
});

const extrairColunaAusente = (error: { details?: string | null; message?: string | null }): string | null => {
  const detalhes = error.details || '';
  const mensagem = error.message || '';

  const matchDetails = detalhes.match(/column\s+'([^']+)'/i);
  if (matchDetails?.[1]) return matchDetails[1];

  const matchMessage = mensagem.match(/Could not find the '([^']+)' column/i);
  if (matchMessage?.[1]) return matchMessage[1];

  return null;
};

const upsertRegrasPadraoComFallback = async (peladaId: string): Promise<{ ok: boolean; ignoradas: string[]; error?: any }> => {
  const payload = montarRegrasPadrao(peladaId);
  const ignoradas: string[] = [];

  for (let tentativa = 0; tentativa < 12; tentativa++) {
    const { error } = await supabase
      .from('regras')
      .upsert(payload, { onConflict: 'pelada_id' });

    if (!error) {
      return { ok: true, ignoradas };
    }

    // Quando a tabela ainda não tem uma coluna do payload, removemos somente ela e tentamos de novo.
    if (error.code === 'PGRST204') {
      const colunaAusente = extrairColunaAusente({ details: error.details, message: error.message });
      if (colunaAusente && Object.prototype.hasOwnProperty.call(payload, colunaAusente)) {
        delete payload[colunaAusente];
        ignoradas.push(colunaAusente);
        continue;
      }
    }

    return { ok: false, ignoradas, error };
  }

  return { ok: false, ignoradas, error: new Error('Falha ao salvar regras padrão após múltiplas tentativas.') };
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
  const [credenciaisGeradas, setCredenciaisGeradas] = useState({
    peladaId: '',
    usuario: 'admin',
    senha: ''
  });
  const [formData, setFormData] = useState({
    telefone: '',
    nome: '',
    nomePelada: '',
    peladaId: '',
    cidade: '',
    uf: '',
    status: 'ativo',
    acesso_pelada_tradicional: true,
    acesso_modo_torneio: false,
    cores_coletes: CORES_COLETES_PADRAO,
    bloqueado: false,
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
          nomePelada: data.nome_pelada || '',
          peladaId: data.pelada_id || '',
          cidade: data.cidade || '',
          uf: data.uf || '',
          status: data.status || 'ativo',
          acesso_pelada_tradicional: data.acesso_pelada_tradicional ?? true,
          acesso_modo_torneio: data.acesso_modo_torneio ?? false,
          cores_coletes: CORES_COLETES_PADRAO,
          bloqueado: false,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const credenciais = JSON.parse(localStorage.getItem('credenciais') || '{}');
      if (!credenciais?.pelada_id || !credenciais?.username || !credenciais?.senha) {
        alert('❌ Credenciais inválidas. Faça login novamente.');
        router.push('/login');
        setLoading(false);
        return;
      }

      if (isEdicao) {
        const response = await fetch('/api/admin/clientes/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pelada_id: credenciais.pelada_id,
            username: credenciais.username,
            senha_hash: credenciais.senha,
            modo: 'update',
            clienteId,
            formData,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          console.error('Erro ao atualizar cliente:', data);
          alert(`Erro ao atualizar cliente: ${data.error || 'erro desconhecido'}`);
          setLoading(false);
          return;
        }

        alert('Cliente atualizado com sucesso!');
        router.push('/admin/clientes');
      } else {
        // Validar nome completo (mínimo 2 nomes)
        const nomes = formData.nome.trim().split(/\s+/);
        if (nomes.length < 2) {
          alert('❌ Por favor, informe o nome completo (Nome e Sobrenome)!');
          setLoading(false);
          return;
        }

        // Usar peladaId fornecido ou gerar automaticamente
        let peladaId = formData.peladaId.trim().toUpperCase();
        
        if (!peladaId) {
          // Se não preencheu, gera automaticamente
          peladaId = await gerarPeladaIdUnico(formData.nome, formData.telefone);
        } else {
          // Se preencheu, valida se já existe
          if (await verificarPeladaIdExiste(peladaId)) {
            alert('❌ Este código de pelada já existe! Digite outro código ou deixe em branco para gerar automaticamente.');
            setLoading(false);
            return;
          }
        }

        if (!Array.isArray(formData.cores_coletes) || formData.cores_coletes.length < 2) {
          alert('❌ Selecione ao menos 2 cores de colete para criar o cliente.');
          setLoading(false);
          return;
        }

        const response = await fetch('/api/admin/clientes/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pelada_id: credenciais.pelada_id,
            username: credenciais.username,
            senha_hash: credenciais.senha,
            modo: 'create',
            formData: {
              ...formData,
              cores_coletes: formData.cores_coletes,
              peladaId,
              status: 'ativo',
            },
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          console.error('Erro ao cadastrar cliente:', data);
          alert(`Erro ao cadastrar cliente: ${data.error || 'erro desconhecido'}`);
          setLoading(false);
          return;
        }

        if (data.regras?.ok === false) {
          console.error('⚠️ Falha ao atualizar regras:', data.regras?.error);
          alert('⚠️ Cliente cadastrado, mas houve falha ao criar regras padrão. Revise a tabela regras no Supabase.');
        } else if (Array.isArray(data.regras?.ignoradas) && data.regras.ignoradas.length > 0) {
          console.warn('⚠️ Regras padrão criadas com colunas ignoradas:', data.regras.ignoradas);
        }

        if (data.credenciaisGeradas) {
          setCredenciaisGeradas(data.credenciaisGeradas);
          setMostrarModalCredenciais(true);
        }
      }
    } catch (error) {
      console.error('Erro:', error);
      alert(`Erro ao ${isEdicao ? 'atualizar' : 'cadastrar'} cliente!`);
    } finally {
      setLoading(false);
    }
  };

  const sectionClass = 'pb-6 border-b border-gray-200';
  const labelClass = 'block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2';
  const fieldClass = 'w-full px-4 py-3 border border-gray-300 rounded-xl bg-white text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent';

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

      <div className="px-6 py-6">
        {carregandoCliente ? (
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200 text-center">
            <div className="text-4xl mb-4">⏳</div>
            <p className="text-gray-500">Carregando dados do cliente...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <section className={sectionClass}>
              <div className="mb-4">
                <h3 className="text-base font-bold text-gray-800">Dados principais</h3>
                <p className="text-sm text-gray-500">Informações básicas do responsável e da pelada.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className={labelClass}>Nome responsável *</label>
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className={fieldClass}
                    required
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className={labelClass}>Telefone *</label>
                  <input
                    type="tel"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    className={fieldClass}
                    placeholder="(22) 98127-8226"
                    required
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className={labelClass}>Nome da pelada *</label>
                  <input
                    type="text"
                    value={formData.nomePelada}
                    onChange={(e) => setFormData({ ...formData, nomePelada: e.target.value })}
                    className={fieldClass}
                    placeholder="Ex: Pelada do Parque"
                    required
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className={labelClass}>Código da pelada (ID) *</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.peladaId}
                      onChange={(e) => setFormData({ ...formData, peladaId: e.target.value.toUpperCase() })}
                      className={`${fieldClass} flex-1 uppercase`}
                      placeholder="Ex: GD3974"
                      maxLength={6}
                      required
                      disabled={loading || isEdicao}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const gerado = gerarPeladaId(formData.nome, formData.telefone);
                        setFormData({ ...formData, peladaId: gerado });
                      }}
                      disabled={loading || !formData.nome || !formData.telefone || isEdicao}
                      className="px-4 py-3 rounded-xl border border-blue-300 bg-blue-50 text-blue-700 font-semibold hover:bg-blue-100 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 transition-colors"
                      title="Gerar código automaticamente"
                    >
                      🔄
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className={sectionClass}>
              <div className="mb-4">
                <h3 className="text-base font-bold text-gray-800">Localização</h3>
                <p className="text-sm text-gray-500">Cidade e estado vinculados ao cliente.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className={labelClass}>Cidade *</label>
                  <input
                    type="text"
                    value={formData.cidade}
                    onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                    className={fieldClass}
                    placeholder="Ex: Rio de Janeiro"
                    required
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className={labelClass}>UF (estado) *</label>
                  <select
                    value={formData.uf}
                    onChange={(e) => setFormData({ ...formData, uf: e.target.value })}
                    className={fieldClass}
                    required
                    disabled={loading}
                  >
                    <option value="">Selecione o estado</option>
                    <option value="AC">Acre (AC)</option>
                    <option value="AL">Alagoas (AL)</option>
                    <option value="AP">Amapá (AP)</option>
                    <option value="AM">Amazonas (AM)</option>
                    <option value="BA">Bahia (BA)</option>
                    <option value="CE">Ceará (CE)</option>
                    <option value="DF">Distrito Federal (DF)</option>
                    <option value="ES">Espírito Santo (ES)</option>
                    <option value="GO">Goiás (GO)</option>
                    <option value="MA">Maranhão (MA)</option>
                    <option value="MT">Mato Grosso (MT)</option>
                    <option value="MS">Mato Grosso do Sul (MS)</option>
                    <option value="MG">Minas Gerais (MG)</option>
                    <option value="PA">Pará (PA)</option>
                    <option value="PB">Paraíba (PB)</option>
                    <option value="PR">Paraná (PR)</option>
                    <option value="PE">Pernambuco (PE)</option>
                    <option value="PI">Piauí (PI)</option>
                    <option value="RJ">Rio de Janeiro (RJ)</option>
                    <option value="RN">Rio Grande do Norte (RN)</option>
                    <option value="RS">Rio Grande do Sul (RS)</option>
                    <option value="RO">Rondônia (RO)</option>
                    <option value="RR">Roraima (RR)</option>
                    <option value="SC">Santa Catarina (SC)</option>
                    <option value="SP">São Paulo (SP)</option>
                    <option value="SE">Sergipe (SE)</option>
                    <option value="TO">Tocantins (TO)</option>
                  </select>
                </div>
              </div>
            </section>

            <section className={sectionClass}>
              <div className="mb-4">
                <h3 className="text-base font-bold text-gray-800">Acesso por modo</h3>
                <p className="text-sm text-gray-500">Defina quais modos ficarão habilitados para este cliente.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-start gap-3 bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:border-green-300 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.acesso_pelada_tradicional}
                    onChange={(e) => setFormData({ ...formData, acesso_pelada_tradicional: e.target.checked })}
                    className="w-4 h-4 mt-1"
                    disabled={loading}
                  />
                  <div>
                    <p className="text-sm font-bold text-gray-800">Pelada Tradicional</p>
                    <p className="text-xs text-gray-500 mt-1">Libera acesso às telas operacionais da pelada.</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:border-amber-300 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.acesso_modo_torneio}
                    onChange={(e) => setFormData({ ...formData, acesso_modo_torneio: e.target.checked })}
                    className="w-4 h-4 mt-1"
                    disabled={loading}
                  />
                  <div>
                    <p className="text-sm font-bold text-gray-800">Modo Torneio</p>
                    <p className="text-xs text-gray-500 mt-1">Permissão registrada; recurso permanece bloqueado durante desenvolvimento.</p>
                  </div>
                </label>
              </div>

              {isEdicao && (
                <div className="mt-4 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
                  Status atual: <span className="font-semibold uppercase">{formData.status}</span>
                </div>
              )}

              <div className="hidden">
                <input
                  type="checkbox"
                  checked={formData.bloqueado}
                  onChange={(e) => setFormData({ ...formData, bloqueado: e.target.checked })}
                />
              </div>
            </section>

            {!isEdicao && (
              <section className={sectionClass}>
                <div className="mb-4">
                  <h3 className="text-base font-bold text-gray-800">Cores padrão dos times</h3>
                  <p className="text-sm text-gray-500">Essas cores já serão gravadas nas regras iniciais do cliente.</p>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {CORES_COLETES_DISPONIVEIS.map(({ hex, nome }) => {
                    const selecionado = formData.cores_coletes.includes(hex);

                    return (
                      <button
                        key={hex}
                        type="button"
                        title={nome}
                        onClick={() => {
                          const novasCores = selecionado
                            ? formData.cores_coletes.filter((cor) => cor !== hex)
                            : [...formData.cores_coletes, hex];

                          if (novasCores.length === 0) return;
                          setFormData({ ...formData, cores_coletes: novasCores });
                        }}
                        className={`relative w-full aspect-square rounded-lg border-2 transition-all ${
                          selecionado ? 'border-green-500 scale-105 shadow-md' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: hex }}
                        disabled={loading}
                      >
                        {selecionado && (
                          <span
                            className="absolute inset-0 flex items-center justify-center text-lg font-bold"
                            style={{ color: hex === '#FFFFFF' || hex === '#fbbf24' ? '#374151' : 'white', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                          >
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {formData.cores_coletes.length < 2 && (
                  <p className="text-xs text-amber-600 mt-2 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    ⚠️ Selecione ao menos 2 cores para montar os times.
                  </p>
                )}
              </section>
            )}

            <section className="pb-2">
              <div className="mb-4">
                <h3 className="text-base font-bold text-gray-800">Acesso e cobrança</h3>
                <p className="text-sm text-gray-500">Defina o valor da mensalidade de acesso.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className={labelClass}>Valor do acesso (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.valor_plano || ''}
                    onChange={(e) => setFormData({ ...formData, valor_plano: e.target.value ? parseFloat(e.target.value) : null })}
                    className={fieldClass}
                    placeholder="19.90"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className={labelClass}>Data de vencimento</label>
                  <input
                    type="date"
                    value={formData.data_vencimento || ''}
                    onChange={(e) => setFormData({ ...formData, data_vencimento: e.target.value || null })}
                    className={fieldClass}
                    disabled={loading}
                  />
                </div>
              </div>
            </section>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-8 py-3 rounded-xl font-semibold transition-colors flex items-center justify-center space-x-2"
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