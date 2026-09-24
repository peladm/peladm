'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { supabase, validarSenhaPelada } from '../../lib/supabase';
import { buscar_pelada_id } from '../../lib/credenciais';

export default function PeladaTradicionalPage() {
  const router = useRouter();
  const [sessaoAtiva, setSessaoAtiva] = useState(false);
  const [infoSessao, setInfoSessao] = useState<{
    data: string;
    jogadores: number;
    partidas: number;
    gols: number;
  } | null>(null);
  const [nomePelada, setNomePelada] = useState('Sua Pelada');
  const [dataCadastro, setDataCadastro] = useState('');
  const [coresPelada, setCoresPelada] = useState<string[]>(['#10b981', '#1f2937']);
  const [resumoExpandido, setResumoExpandido] = useState(false);
  const [resumoHistorico, setResumoHistorico] = useState({
    jogadores: 0,
    gols: 0,
    jogos: 0,
    sessoes: 0,
    assistencias: 0,
    mediaPresentesPorPelada: 0,
  });
  const [showModalEditarNome, setShowModalEditarNome] = useState(false);
  const [novoNomePelada, setNovoNomePelada] = useState('');
  const [senhaEditarNome, setSenhaEditarNome] = useState('');
  const [erroEditarNome, setErroEditarNome] = useState('');
  const [isSalvandoNome, setIsSalvandoNome] = useState(false);

  const [showModalExcluirSessao, setShowModalExcluirSessao] = useState(false);
  const [senhaExcluirSessao, setSenhaExcluirSessao] = useState('');
  const [erroExcluirSessao, setErroExcluirSessao] = useState('');
  const [isExcluindoSessao, setIsExcluindoSessao] = useState(false);
  const [showModalLista, setShowModalLista] = useState(false);
  const [dataLista, setDataLista] = useState('');
  const [numLinhas, setNumLinhas] = useState<number | ''>(30);
  const [observacao, setObservacao] = useState('');

  useEffect(() => {
    validarAcessoTela();
    verificarSessaoAtiva();
    carregarResumoPelada();
  }, []);

  const validarAcessoTela = async () => {
    try {
      const credenciaisStr = localStorage.getItem('credenciais');
      if (!credenciaisStr) return;

      const credenciais = JSON.parse(credenciaisStr);
      const peladaId = credenciais?.pelada_id;
      if (!peladaId) return;

      const response = await fetch('/api/auth/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pelada_id: peladaId }),
      });

      if (!response.ok) return;

      const data = await response.json();
      const status = String(data.status || '').toLowerCase();
      const acessoPeladaTradicional = data.acesso_pelada_tradicional !== false;

      if (status === 'bloqueado' || status === 'inativo') {
        alert(status === 'bloqueado'
          ? '🚫 Acesso bloqueado. Entre em contato com o administrador.'
          : '⏸️ Cliente inativo. Regularize seu acesso para continuar.');
        router.push('/login');
        return;
      }

      if (!acessoPeladaTradicional) {
        alert('🚫 Seu cliente não possui acesso ao Modo Pelada Tradicional.');
        router.push('/');
      }
    } catch (error) {
      console.warn('Falha ao validar acesso da tela Pelada Tradicional:', error);
    }
  };

  const navigateTo = (page: string) => {
    router.push(`/${page}`);
  };

  const formatarDataCadastro = (dataIso: string | null): string => {
    if (!dataIso) return '';
    const data = new Date(dataIso);
    if (Number.isNaN(data.getTime())) return '';
    return data.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatarMedia = (valor: number): string => {
    if (!Number.isFinite(valor)) return '0,0';
    return valor.toFixed(1).replace('.', ',');
  };

  const hexParaRgb = (hex: string): { r: number; g: number; b: number } | null => {
    const normalizado = hex.replace('#', '').trim();
    const valor = normalizado.length === 3
      ? normalizado.split('').map((c) => c + c).join('')
      : normalizado;

    if (!/^[0-9a-fA-F]{6}$/.test(valor)) return null;

    return {
      r: parseInt(valor.slice(0, 2), 16),
      g: parseInt(valor.slice(2, 4), 16),
      b: parseInt(valor.slice(4, 6), 16),
    };
  };

  const corComAlpha = (hex: string, alpha: number): string => {
    const rgb = hexParaRgb(hex);
    if (!rgb) return `rgba(0,0,0,${alpha})`;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  };

  const corTextoContraste = (hex: string): '#FFFFFF' | '#111827' => {
    const rgb = hexParaRgb(hex);
    if (!rgb) return '#FFFFFF';
    const luminancia = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luminancia > 0.62 ? '#111827' : '#FFFFFF';
  };

  const obterPaletaComandos = () => {
    const c1 = coresPelada[0] || '#10b981';
    const c2 = coresPelada[1] || c1;
    const c3 = coresPelada[2] || c1;
    const c4 = coresPelada[3] || c2;

    if (coresPelada.length >= 4) {
      return {
        cadastro: c1,
        iniciar: c2,
        estatisticaA: c3,
        estatisticaB: c4,
        presenca: c4,
      };
    }

    if (coresPelada.length === 3) {
      return {
        cadastro: c1,
        iniciar: c2,
        estatisticaA: c1,
        estatisticaB: c3,
        presenca: c3,
      };
    }

    return {
      cadastro: c1,
      iniciar: c2,
      estatisticaA: c1,
      estatisticaB: c2,
      presenca: c2,
    };
  };

  const carregarResumoPelada = async () => {
    try {
      const peladaId = buscar_pelada_id();
      if (!peladaId) return;

      const [
        clienteRes,
        regrasRes,
        jogadoresRes,
        golsRes,
        jogosRes,
        sessoesRes,
      ] = await Promise.all([
        supabase
          .from('clientes')
          .select('nome_pelada, created_at')
          .eq('pelada_id', peladaId)
          .maybeSingle(),
        supabase
          .from('regras')
          .select('cores_coletes')
          .eq('pelada_id', peladaId)
          .maybeSingle(),
        supabase
          .from('jogadores')
          .select('*', { count: 'exact', head: true })
          .eq('pelada_id', peladaId),
        supabase
          .from('gols')
          .select('*', { count: 'exact', head: true })
          .eq('pelada_id', peladaId),
        supabase
          .from('jogos')
          .select('*', { count: 'exact', head: true })
          .eq('pelada_id', peladaId)
          .eq('status', 'finalizado'),
        supabase
          .from('sessoes')
          .select('total_jogadores')
          .eq('pelada_id', peladaId),
      ]);

      let totalAssistencias = 0;
      const assistenciasRes = await supabase
        .from('gols')
        .select('*', { count: 'exact', head: true })
        .eq('pelada_id', peladaId)
        .not('assistencia', 'is', null);
      if (!assistenciasRes.error) {
        totalAssistencias = assistenciasRes.count || 0;
      }

      if (clienteRes.data) {
        setNomePelada(clienteRes.data.nome_pelada || 'Sua Pelada');
        setDataCadastro(formatarDataCadastro(clienteRes.data.created_at || null));
      }

      if (regrasRes.data?.cores_coletes && Array.isArray(regrasRes.data.cores_coletes)) {
        const coresValidas = (regrasRes.data.cores_coletes as string[]).filter((c) => typeof c === 'string' && c.trim().length > 0);
        if (coresValidas.length >= 1) {
          setCoresPelada(coresValidas.slice(0, 4));
        }
      }

      const sessoesData = Array.isArray(sessoesRes.data) ? sessoesRes.data : [];
      const totalSessoes = sessoesData.length;
      const somaPresentes = sessoesData.reduce((acc: number, sessao: any) => {
        const total = Number(sessao?.total_jogadores || 0);
        return total > 0 ? acc + total : acc;
      }, 0);
      const mediaPresentesPorPelada = totalSessoes > 0 ? somaPresentes / totalSessoes : 0;

      setResumoHistorico({
        jogadores: jogadoresRes.count || 0,
        gols: golsRes.count || 0,
        jogos: jogosRes.count || 0,
        sessoes: totalSessoes,
        assistencias: totalAssistencias,
        mediaPresentesPorPelada,
      });
    } catch (error) {
      console.warn('Falha ao carregar resumo da pelada tradicional:', error);
    }
  };

  const verificarSessaoAtiva = () => {
    try {
      const sessaoAtivaStr = localStorage.getItem('sessao_ativa');

      if (!sessaoAtivaStr) {
        setSessaoAtiva(false);
        setInfoSessao(null);
        return;
      }

      const sessao = JSON.parse(sessaoAtivaStr);
      if (sessao.status !== 'ativa') {
        setSessaoAtiva(false);
        setInfoSessao(null);
        return;
      }

      setSessaoAtiva(true);

      const filaAtivaStr = localStorage.getItem('fila_ativa');
      const filaAtiva = filaAtivaStr ? JSON.parse(filaAtivaStr) : [];

      const jogosKey = `jogos_${sessao.id}`;
      const jogosStr = localStorage.getItem(jogosKey);
      const jogos = jogosStr ? JSON.parse(jogosStr) : [];

      const totalJogadores = filaAtiva.filter((j: any) => {
        const status = String(j?.status || '').toLowerCase();
        const posicaoFila = Number(j?.posicao_fila ?? 999);
        return status !== 'reserva' && posicaoFila !== 999;
      }).length;

      const totalPartidas = jogos.filter((j: any) => j.status === 'finalizado').length;
      const totalGols = jogos
        .filter((j: any) => j.status === 'finalizado')
        .reduce((sum: number, jogo: any) => sum + (jogo.placar_a || 0) + (jogo.placar_b || 0), 0);

      const dataFormatada = new Date(sessao.data).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      });

      setInfoSessao({
        data: dataFormatada,
        jogadores: totalJogadores,
        partidas: totalPartidas,
        gols: totalGols,
      });
    } catch (err) {
      console.error('Erro ao verificar sessão:', err);
      setSessaoAtiva(false);
      setInfoSessao(null);
    }
  };

  const acessarSessaoAtiva = () => {
    router.push('/page-fila');
  };

  const abrirModalExcluirSessao = (e: React.MouseEvent) => {
    e.stopPropagation();
    setErroExcluirSessao('');
    setSenhaExcluirSessao('');
    setShowModalExcluirSessao(true);
  };

  const abrirModalEditarNome = () => {
    setErroEditarNome('');
    setSenhaEditarNome('');
    setNovoNomePelada(nomePelada);
    setShowModalEditarNome(true);
  };

  const salvarNomePelada = async () => {
    setErroEditarNome('');

    if (!novoNomePelada.trim()) {
      setErroEditarNome('Informe o nome da pelada.');
      return;
    }

    if (!senhaEditarNome.trim()) {
      setErroEditarNome('Digite sua senha para confirmar.');
      return;
    }

    const senhaValida = await validarSenhaPelada(senhaEditarNome);
    if (!senhaValida) {
      setErroEditarNome('Senha incorreta.');
      return;
    }

    const peladaId = buscar_pelada_id();
    if (!peladaId) {
      setErroEditarNome('Nao foi possivel identificar a pelada logada.');
      return;
    }

    setIsSalvandoNome(true);
    try {
      const { error } = await supabase
        .from('clientes')
        .update({ nome_pelada: novoNomePelada.trim() })
        .eq('pelada_id', peladaId);

      if (error) {
        throw error;
      }

      setNomePelada(novoNomePelada.trim());
      setShowModalEditarNome(false);
      setSenhaEditarNome('');
      setErroEditarNome('');
    } catch (error) {
      console.error('Erro ao atualizar nome da pelada:', error);
      setErroEditarNome('Nao foi possivel atualizar o nome da pelada.');
    } finally {
      setIsSalvandoNome(false);
    }
  };

  const excluirSessaoLocal = async () => {
    setErroExcluirSessao('');

    if (!senhaExcluirSessao.trim()) {
      setErroExcluirSessao('Digite sua senha para confirmar.');
      return;
    }

    const sessaoAtivaStr = localStorage.getItem('sessao_ativa');
    if (!sessaoAtivaStr) {
      setShowModalExcluirSessao(false);
      setSessaoAtiva(false);
      setInfoSessao(null);
      return;
    }

    const senhaValida = await validarSenhaPelada(senhaExcluirSessao);
    if (!senhaValida) {
      setErroExcluirSessao('Senha incorreta.');
      return;
    }

    setIsExcluindoSessao(true);

    try {
      const sessao = JSON.parse(sessaoAtivaStr);
      const sessaoId = sessao?.id;

      localStorage.removeItem('sessao_ativa');
      localStorage.removeItem('fila_ativa');
      localStorage.removeItem('partida_em_andamento');
      localStorage.removeItem('modo_partida_estado');
      localStorage.removeItem('modo_prancheta_ativo');
      localStorage.removeItem('cronometro_partida');

      if (sessaoId) {
        localStorage.removeItem(`jogos_${sessaoId}`);
        localStorage.removeItem(`gols_${sessaoId}`);
        localStorage.removeItem(`assistencias_${sessaoId}`);
        localStorage.removeItem(`fila_snapshot_${sessaoId}`);
      }

      setSessaoAtiva(false);
      setInfoSessao(null);
      setShowModalExcluirSessao(false);
      setSenhaExcluirSessao('');
      alert('🗑️ Pelada ativa local foi apagada com sucesso.');
    } catch (error) {
      console.error('Erro ao excluir dados da pelada ativa:', error);
      setErroExcluirSessao('Erro ao apagar dados da pelada ativa.');
    } finally {
      setIsExcluindoSessao(false);
    }
  };

  const gerarListaWhatsApp = () => {
    if (!dataLista.trim()) {
      alert('Por favor, preencha a data da pelada!');
      return;
    }

    if (!numLinhas || numLinhas < 1) {
      alert('Por favor, preencha o número de linhas (mínimo 1)!');
      return;
    }

    let texto = '*Lista de Presença*\n';
    texto += `Data: *${dataLista}*\n`;

    if (observacao.trim()) {
      const linhasObs = observacao.split('\n');
      const obsFormatada = linhasObs.map((linha) => `_${linha}_`).join('\n');
      texto += `${obsFormatada}\n`;
    }

    texto += '\n';

    for (let i = 1; i <= numLinhas; i++) {
      texto += `${i} - \n`;
    }

    const textoEncoded = encodeURIComponent(texto);
    const urlWhatsApp = `https://wa.me/?text=${textoEncoded}`;
    window.open(urlWhatsApp, '_blank');

    setShowModalLista(false);
    setDataLista('');
    setNumLinhas(10);
    setObservacao('');
  };

  const COR_VERDE = '#10b981';
  const COR_VERDE_ESCURO = '#059669';
  const COR_PRETO = '#111827';

  return (
    <Layout title="Pelada Tradicional">
      <section className="mb-6">
        <div
          className="rounded-2xl shadow-2xl p-6 sm:p-7 border border-white/20 relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${coresPelada[0]} 0%, ${coresPelada[1]} 100%)`,
          }}
        >
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full" aria-hidden="true"></div>
          <div className="absolute right-12 bottom-2 w-20 h-20 bg-white/10 rounded-full" aria-hidden="true"></div>

          <button
            type="button"
            onClick={() => setResumoExpandido((prev) => !prev)}
            className="absolute right-3 top-3 w-8 h-8 rounded-full bg-black/20 hover:bg-black/30 border border-white/20 text-white flex items-center justify-center"
            title={resumoExpandido ? 'Ocultar resumo' : 'Exibir resumo'}
          >
            <span className="text-base leading-none">{resumoExpandido ? '▴' : '▾'}</span>
          </button>

          <button
            type="button"
            onClick={abrirModalEditarNome}
            className="absolute right-12 top-3 w-8 h-8 rounded-full bg-black/20 hover:bg-black/30 border border-white/20 text-white flex items-center justify-center"
            title="Editar nome da pelada"
          >
            <span className="text-base leading-none">✏️</span>
          </button>

          <p className="text-xs uppercase tracking-[0.2em] text-white/80 font-semibold">Bem-vindo</p>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1 leading-tight">
            {nomePelada}
          </h2>

          {resumoExpandido && (
            <div className="mt-4 pt-3 border-t border-white/25 text-white">
              <p className="text-xs uppercase tracking-[0.14em] text-white/80 font-semibold mb-2">Resumo da pelada</p>
              <div className="grid grid-cols-3 gap-x-3 gap-y-3">
                <div>
                  <p className="text-[10px] text-white/75 font-semibold">Jogadores</p>
                  <p className="text-lg font-black leading-tight">{resumoHistorico.jogadores}</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/75 font-semibold">Gols</p>
                  <p className="text-lg font-black leading-tight">{resumoHistorico.gols}</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/75 font-semibold">Assistencias</p>
                  <p className="text-lg font-black leading-tight">{resumoHistorico.assistencias}</p>
                </div>

                <div>
                  <p className="text-[10px] text-white/75 font-semibold">Total de peladas</p>
                  <p className="text-lg font-black leading-tight">{resumoHistorico.sessoes}</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/75 font-semibold">Total de partidas</p>
                  <p className="text-lg font-black leading-tight">{resumoHistorico.jogos}</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/75 font-semibold">Média de jogos por pelada</p>
                  <p className="text-lg font-black leading-tight">
                    {resumoHistorico.sessoes > 0 ? formatarMedia(resumoHistorico.jogos / resumoHistorico.sessoes) : '0,0'}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] text-white/75 font-semibold">Media de presentes por pelada</p>
                  <p className="text-lg font-black leading-tight">{formatarMedia(resumoHistorico.mediaPresentesPorPelada)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/75 font-semibold">Media de gols por partida</p>
                  <p className="text-lg font-black leading-tight">
                    {resumoHistorico.jogos > 0 ? formatarMedia(resumoHistorico.gols / resumoHistorico.jogos) : '0,0'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-white/75 font-semibold">Media de gols por pelada</p>
                  <p className="text-lg font-black leading-tight">
                    {resumoHistorico.sessoes > 0 ? formatarMedia(resumoHistorico.gols / resumoHistorico.sessoes) : '0,0'}
                  </p>
                </div>
              </div>

              {dataCadastro && (
                <p className="mt-3 text-xs text-white/85">Desde {dataCadastro}</p>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="mb-5" aria-hidden="true">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
      </section>

      <section className="mb-5 grid grid-cols-2 gap-4">
        <button
          onClick={() => navigateTo('cadastro')}
          className="w-full rounded-xl shadow-md p-4 border transition-all duration-300 min-h-[5rem]"
          style={{
            background: COR_VERDE,
            borderColor: COR_VERDE,
            color: '#FFFFFF',
          }}
        >
          <div className="flex items-center space-x-3">
            <span className="text-3xl leading-none">🏃‍♂️</span>
            <div className="text-left">
              <h3 className="font-bold">Cadastro</h3>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.9)' }}>Peladeiros</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => navigateTo('regras')}
          className="w-full rounded-xl shadow-md p-4 border transition-all duration-300 min-h-[5rem]"
          style={{
            background: COR_VERDE,
            borderColor: COR_VERDE,
            color: '#FFFFFF',
          }}
        >
          <div className="flex items-center space-x-3">
            <span className="text-3xl leading-none">⚙️</span>
            <div className="text-left">
              <h3 className="font-bold">Regras</h3>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.9)' }}>da pelada</p>
            </div>
          </div>
        </button>

        {!sessaoAtiva ? (
          <button
            onClick={() => navigateTo('sorteio')}
            className="w-full rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-0.5 hover:scale-[1.01] active:scale-[0.99] p-5 sm:p-6 border-2 transition-all duration-300 min-h-[6.25rem] col-span-2 group animate-pulse"
            style={{
              background: COR_PRETO,
              borderColor: COR_VERDE,
              color: '#FFFFFF',
            }}
          >
            <div className="flex items-center space-x-3">
              <span className="text-4xl leading-none transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110 animate-bounce">🎲</span>
              <div className="text-left">
                <h3 className="font-black text-lg sm:text-xl">Iniciar Nova Pelada</h3>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.9)' }}>Realize o sorteio, confirme os times e bora jogar.</p>
              </div>
            </div>
          </button>
        ) : (
          <div
            onClick={acessarSessaoAtiva}
            className="w-full rounded-xl shadow-lg hover:shadow-xl p-4 sm:p-6 border-2 transition-all duration-300 min-h-[5rem] sm:h-20 group animate-pulse relative cursor-pointer col-span-2"
            style={{
              background: COR_PRETO,
              borderColor: COR_VERDE,
              color: '#FFFFFF',
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                acessarSessaoAtiva();
              }
            }}
          >
            <div className="flex items-center justify-between h-full">
              <div className="flex items-center space-x-3">
                <span className="text-3xl leading-none group-hover:scale-110 group-hover:rotate-12 transition-transform animate-bounce">⚡</span>
                <div className="text-left">
                  <h3 className="font-bold text-sm sm:text-base mb-0.5">Pelada Ativa</h3>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.9)' }}>Clique para acessar</p>
                </div>
              </div>

              {infoSessao && (
                <div className="flex items-center gap-2 sm:gap-3 ml-2">
                  <div className="text-center">
                    <div className="text-xs" style={{ color: 'rgba(255,255,255,0.9)' }}>Data</div>
                    <div className="text-sm sm:text-base font-bold">{infoSessao.data}</div>
                  </div>
                  <div className="h-8 w-px" style={{ background: 'rgba(255,255,255,0.35)' }}></div>
                  <div className="text-center">
                    <div className="text-xs" style={{ color: 'rgba(255,255,255,0.9)' }}>Jogadores</div>
                    <div className="text-sm sm:text-base font-bold">{infoSessao.jogadores}</div>
                  </div>
                  <div className="h-8 w-px hidden sm:block" style={{ background: 'rgba(255,255,255,0.35)' }}></div>
                  <div className="text-center hidden sm:block">
                    <div className="text-xs" style={{ color: 'rgba(255,255,255,0.9)' }}>Partidas</div>
                    <div className="text-sm sm:text-base font-bold">{infoSessao.partidas}</div>
                  </div>
                  <div className="h-8 w-px hidden sm:block" style={{ background: 'rgba(255,255,255,0.35)' }}></div>
                  <div className="text-center hidden sm:block">
                    <div className="text-xs" style={{ color: 'rgba(255,255,255,0.9)' }}>Gols</div>
                    <div className="text-sm sm:text-base font-bold">{infoSessao.gols}</div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  abrirModalExcluirSessao(e);
                }}
                className="ml-2 sm:ml-3 rounded-full w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-base sm:text-lg transition-colors shrink-0"
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  color: '#FFFFFF',
                }}
                title="Apagar pelada ativa local"
              >
                🗑️
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="mb-5" aria-hidden="true">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
      </section>

      <section className="mb-5">
        <button
          onClick={() => navigateTo('estatisticas')}
          className="w-full rounded-xl shadow-xl hover:shadow-2xl p-5 border-2 transition-all duration-300 min-h-[6rem]"
          style={{
            background: COR_VERDE_ESCURO,
            borderColor: COR_PRETO,
            color: '#FFFFFF',
          }}
        >
          <div className="flex items-center space-x-4">
            <span className="text-4xl leading-none">📊</span>
            <div className="text-left">
              <h3 className="font-black text-lg">Estatísticas Gerais</h3>
              <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.9)' }}>Estatísticas, resultados, tabelas e um X1 especial</p>
            </div>
          </div>
        </button>
      </section>

      <section className="mb-5">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <button
            onClick={() => setShowModalLista(true)}
            className="w-full rounded-xl shadow-md p-4 border transition-all duration-300 min-h-[5rem]"
            style={{
              background: COR_VERDE,
              borderColor: COR_VERDE,
              color: '#FFFFFF',
            }}
          >
            <div className="flex items-center space-x-3">
              <span className="flex items-center justify-center shrink-0" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="#FFFFFF">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </span>
              <div className="text-left">
                <h3 className="font-bold">Lista de Presença</h3>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigateTo('atividade')}
            className="w-full rounded-xl shadow-md p-4 border transition-all duration-300 min-h-[5rem]"
            style={{
              background: COR_VERDE,
              borderColor: COR_VERDE,
              color: '#FFFFFF',
            }}
          >
            <div className="flex items-center space-x-3">
              <span className="text-4xl leading-none">📋</span>
              <div className="text-left">
                <h3 className="font-bold">Controle de Presença</h3>
              </div>
            </div>
          </button>
        </div>
      </section>

      {showModalExcluirSessao && (
        <div
          className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-5"
          onClick={() => !isExcluindoSessao && setShowModalExcluirSessao(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-red-100 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-red-600">🗑️ Apagar Pelada Ativa Local</h2>
              <button
                onClick={() => !isExcluindoSessao && setShowModalExcluirSessao(false)}
                className="text-2xl text-gray-400 hover:text-gray-600"
                disabled={isExcluindoSessao}
              >
                ×
              </button>
            </div>

            <p className="text-sm text-gray-700 mb-4">
              Essa ação apaga os dados locais da pelada em andamento que ainda não foram sincronizados.
            </p>

            <div className="mb-4">
              <label className="block mb-2 text-sm font-semibold text-gray-900">
                Digite sua senha para confirmar
              </label>
              <input
                type="password"
                value={senhaExcluirSessao}
                onChange={(e) => setSenhaExcluirSessao(e.target.value)}
                placeholder="Sua senha"
                className="w-full px-3 py-3 rounded-lg border-2 border-gray-200 text-base outline-none focus:border-emerald-500"
                disabled={isExcluindoSessao}
              />
            </div>

            {erroExcluirSessao && (
              <div className="mb-4 text-sm font-semibold text-red-600">{erroExcluirSessao}</div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowModalExcluirSessao(false)}
                className="flex-1 py-3 rounded-lg border-2 border-gray-200 bg-white text-gray-600 font-semibold"
                disabled={isExcluindoSessao}
              >
                Cancelar
              </button>
              <button
                onClick={excluirSessaoLocal}
                className="flex-1 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold disabled:opacity-80 disabled:cursor-not-allowed"
                disabled={isExcluindoSessao}
              >
                {isExcluindoSessao ? 'Apagando...' : 'Apagar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showModalLista && (
        <div
          className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-5"
          onClick={() => setShowModalLista(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-emerald-100 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-emerald-700 flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center border border-green-200">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </span>
                <span>Gerar Lista de Presença</span>
              </h2>
              <button
                onClick={() => setShowModalLista(false)}
                className="text-2xl text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="mb-4">
              <label className="block mb-2 text-sm font-semibold text-gray-900">Data da pelada *</label>
              <input
                type="text"
                value={dataLista}
                onChange={(e) => setDataLista(e.target.value)}
                placeholder="Ex.: 25/12/2026"
                className="w-full px-3 py-3 rounded-lg border-2 border-gray-200 text-base outline-none focus:border-emerald-500"
              />
            </div>

            <div className="mb-4">
              <label className="block mb-2 text-sm font-semibold text-gray-900">Nº de linhas</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={numLinhas}
                  onChange={(e) => {
                    const valor = e.target.value;
                    if (valor === '') {
                      setNumLinhas('');
                      return;
                    }

                    const numero = parseInt(valor, 10);
                    if (Number.isFinite(numero) && numero >= 1 && numero <= 50) {
                      setNumLinhas(numero);
                    }
                  }}
                  min="1"
                  max="50"
                  className="flex-1 px-3 py-3 rounded-lg border-2 border-gray-200 text-base outline-none focus:border-emerald-500"
                  onBlur={() => {
                    if (numLinhas === '') setNumLinhas(1);
                  }}
                />
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const atual = numLinhas === '' ? 30 : numLinhas;
                      setNumLinhas(Math.min(50, atual + 1));
                    }}
                    className="h-6 w-7 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 text-xs font-bold"
                    aria-label="Aumentar número de linhas"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const atual = numLinhas === '' ? 30 : numLinhas;
                      setNumLinhas(Math.max(1, atual - 1));
                    }}
                    className="h-6 w-7 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 text-xs font-bold"
                    aria-label="Diminuir número de linhas"
                  >
                    ▼
                  </button>
                </div>
              </div>
            </div>

            <div className="mb-5">
              <label className="block mb-2 text-sm font-semibold text-gray-900">Observação (opcional)</label>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex.: Trazer colete e chuteira"
                rows={3}
                className="w-full px-3 py-3 rounded-lg border-2 border-gray-200 text-base outline-none focus:border-emerald-500 resize-y"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowModalLista(false)}
                className="flex-1 py-3 rounded-lg border-2 border-gray-200 bg-white text-gray-600 font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={gerarListaWhatsApp}
                disabled={!dataLista.trim()}
                className="flex-1 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Gerar WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {showModalEditarNome && (
        <div
          className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-5"
          onClick={() => !isSalvandoNome && setShowModalEditarNome(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-emerald-100 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-emerald-700">✏️ Editar nome da pelada</h2>
              <button
                onClick={() => !isSalvandoNome && setShowModalEditarNome(false)}
                className="text-2xl text-gray-400 hover:text-gray-600"
                disabled={isSalvandoNome}
              >
                ×
              </button>
            </div>

            <div className="mb-4">
              <label className="block mb-2 text-sm font-semibold text-gray-900">
                Nome da pelada
              </label>
              <input
                type="text"
                value={novoNomePelada}
                onChange={(e) => setNovoNomePelada(e.target.value)}
                placeholder="Ex.: Fluiminense FC"
                className="w-full px-3 py-3 rounded-lg border-2 border-gray-200 text-base outline-none focus:border-emerald-500"
                disabled={isSalvandoNome}
              />
            </div>

            <div className="mb-4">
              <label className="block mb-2 text-sm font-semibold text-gray-900">
                Senha para confirmar
              </label>
              <input
                type="password"
                value={senhaEditarNome}
                onChange={(e) => setSenhaEditarNome(e.target.value)}
                placeholder="Sua senha"
                className="w-full px-3 py-3 rounded-lg border-2 border-gray-200 text-base outline-none focus:border-emerald-500"
                disabled={isSalvandoNome}
              />
            </div>

            {erroEditarNome && (
              <div className="mb-4 text-sm font-semibold text-red-600">{erroEditarNome}</div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowModalEditarNome(false)}
                className="flex-1 py-3 rounded-lg border-2 border-gray-200 bg-white text-gray-600 font-semibold"
                disabled={isSalvandoNome}
              >
                Cancelar
              </button>
              <button
                onClick={salvarNomePelada}
                className="flex-1 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-80 disabled:cursor-not-allowed"
                disabled={isSalvandoNome}
              >
                {isSalvandoNome ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
