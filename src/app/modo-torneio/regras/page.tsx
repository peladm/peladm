'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../../components/Layout';
import {
  FormatoCompeticao,
  ModalidadeCompeticao,
  RegrasCompeticaoLocal,
  iniciarCompeticaoLocalAPartirSetup,
  limparSetupCompeticaoLocal,
  obterSetupCompeticaoLocal,
  salvarRegrasCompeticaoLocal,
} from '../../../lib/torneioLocalService';
import { buscar_pelada_id } from '../../../lib/credenciais';
import { MetodoChaveamento, obterLabelMetodo, obterDescricaoMetodo } from '../../../lib/bracketService';
import {
  NivelImportanciaTorneio,
  TorneioCatalogo,
  listarTorneiosCatalogo,
  migrarTorneiosVinculadosLegado,
} from '../../../lib/torneioVinculadoService';

const ESTRELAS_IMPORTANCIA: Record<NivelImportanciaTorneio, string> = {
  baixa_relevancia: '⭐',
  intermediario: '⭐⭐',
  alta_relevancia: '⭐⭐⭐',
  o_torneio: '⭐⭐⭐⭐',
  intertemporada_sem_classificacao: '⏸️',
};

const descricaoFormato: Record<FormatoCompeticao, string> = {
  grupos_mata_mata: 'Fase de grupos seguida de mata-mata.',
  mata_mata: 'Eliminacao direta do inicio ao fim.',
  pontos_corridos: 'Todos contra todos com classificacao por pontos.',
  pontos_corridos_mata_mata: 'Liga inicial + fase final em mata-mata.',
};

const tituloModalidade: Record<ModalidadeCompeticao, string> = {
  torneio: 'Torneio',
  campeonato: 'Campeonato',
};

type CriterioKey = 'vitorias' | 'saldo_gols' | 'gols_pro' | 'gols_contra' | 'total_cartoes';

interface CriterioOrdenavel {
  key: CriterioKey;
  label: string;
  enabled: boolean;
}

interface MetodoOpcaoUI {
  metodo: MetodoChaveamento;
  label: string;
  descricao: string;
}

const CRITERIOS_BASE: CriterioOrdenavel[] = [
  { key: 'vitorias', label: 'Vitorias', enabled: true },
  { key: 'saldo_gols', label: 'Saldo de gols', enabled: true },
  { key: 'gols_pro', label: 'Gols pro', enabled: true },
  { key: 'gols_contra', label: 'Gols contra (menos sofre, melhor)', enabled: true },
  { key: 'total_cartoes', label: 'Total de cartões (menos é melhor)', enabled: false },
];

export default function RegrasModoTorneioPage() {
  const router = useRouter();
  const [setupValido, setSetupValido] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [modalidade, setModalidade] = useState<ModalidadeCompeticao>('torneio');
  const [formato, setFormato] = useState<FormatoCompeticao>('grupos_mata_mata');

  const [nomeCompeticao, setNomeCompeticao] = useState('');
  const [usarTorneioVinculado, setUsarTorneioVinculado] = useState<'sim' | 'nao' | null>(null);
  const [torneiosVinculados, setTorneiosVinculados] = useState<TorneioCatalogo[]>([]);
  const [torneioVinculadoSelecionado, setTorneioVinculadoSelecionado] = useState('');
  const [temporadaCompeticao, setTemporadaCompeticao] = useState('');
  const [minJogadoresParticipantesPorTime, setMinJogadoresParticipantesPorTime] = useState(5);
  const [maxJogadoresParticipantesPorTime, setMaxJogadoresParticipantesPorTime] = useState(10);
  const [jogadoresPorTime, setJogadoresPorTime] = useState(5);
  const [quantidadeTimes, setQuantidadeTimes] = useState(6);
  const [incluirGoleiro, setIncluirGoleiro] = useState(false);
  const [tempoPartida, setTempoPartida] = useState(10);
  const [criteriosDesempate, setCriteriosDesempate] = useState<CriterioOrdenavel[]>(CRITERIOS_BASE);
  const [idaVolta, setIdaVolta] = useState(false);
  const [classificamGrupo, setClassificamGrupo] = useState(2);
  const [quantidadeGrupos, setQuantidadeGrupos] = useState(2);
  const [classificamLiga, setClassificamLiga] = useState(4);
  const [repescagem, setRepescagem] = useState(false);
  const [mataMataFormato, setMataMataFormato] = useState<'jogo_unico' | 'ida_e_volta'>('jogo_unico');
  const [finalFormato, setFinalFormato] = useState<'jogo_unico' | 'ida_e_volta'>('jogo_unico');
  const [disputaTerceiro, setDisputaTerceiro] = useState<'nao' | 'jogo_unico' | 'ida_e_volta'>('nao');
  const [empateDecisao, setEmpateDecisao] = useState<'prorrogacao' | 'penaltis'>('penaltis');
  const [temposPartida, setTemposPartida] = useState<1 | 2>(1);
  const [tempoProrrogacao, setTempoProrrogacao] = useState(5);
  const [temposProrrogacao, setTemposProrrogacao] = useState<1 | 2>(1);
  const [registrarCartoes, setRegistrarCartoes] = useState(false);
  const [cartoesAmarelos, setCartoesAmarelos] = useState(true);
  const [cartoesVermelhos, setCartoesVermelhos] = useState(true);
  const [cartoesAzuis, setCartoesAzuis] = useState(false);
  const [acumulacaoCartoesAmarelos, setAcumulacaoCartoesAmarelos] = useState<0 | 2 | 3>(0);
  const [acumulacaoCartoesAzuis, setAcumulacaoCartoesAzuis] = useState<0 | 2 | 3>(0);
  const [resetCartoesParaEliminatorias, setResetCartoesParaEliminatorias] = useState(false);
  const [efeitoCartaoVermelho, setEfeitoCartaoVermelho] = useState<'expulsao' | 'suspensao' | 'substituicao'>('expulsao');
  const [tempoCartaoAzul, setTempoCartaoAzul] = useState(2);
  const [expulsaoDoisCartoesAzuis, setExpulsaoDoisCartoesAzuis] = useState(false);
  const suporteSubstituicao = false;
  const [metodoChaveamento, setMetodoChaveamento] = useState<MetodoChaveamento>('melhor_vs_pior');
  const [showModalConfirmar, setShowModalConfirmar] = useState(false);

  useEffect(() => {
    if (!suporteSubstituicao && efeitoCartaoVermelho === 'substituicao') {
      setEfeitoCartaoVermelho('expulsao');
    }
  }, [efeitoCartaoVermelho, suporteSubstituicao]);

  useEffect(() => {
    const setup = obterSetupCompeticaoLocal();

    if (!setup) {
      setSetupValido(false);
      router.replace('/modo-torneio');
      return;
    }

    setSetupValido(true);
    setModalidade(setup.modalidade);
    setFormato(setup.formato);
    setNomeCompeticao('');
    setUsarTorneioVinculado(null);
    setTorneioVinculadoSelecionado('');
    setTemporadaCompeticao(`${new Date().getFullYear()}-01`);

    if (typeof window !== 'undefined') {
      const peladaId = buscar_pelada_id() || 'default';
      try {
        migrarTorneiosVinculadosLegado(peladaId);
        setTorneiosVinculados(listarTorneiosCatalogo(peladaId));
      } catch {
        setTorneiosVinculados([]);
      }
    }

    if (setup.formato === 'mata_mata') {
      setClassificamGrupo(0);
    }

    if (setup.formato === 'pontos_corridos') {
      setClassificamGrupo(0);
      setIdaVolta(false);
    }
  }, [router]);

  const selectedVinculado = useMemo(
    () => torneiosVinculados.find((item) => item.id === torneioVinculadoSelecionado),
    [torneioVinculadoSelecionado, torneiosVinculados],
  );

  const proximaTemporadaAutomatica = useMemo(() => {
    const anoAtual = new Date().getFullYear();

    if (usarTorneioVinculado !== 'sim' || !selectedVinculado || typeof window === 'undefined') {
      return `${anoAtual}-01`;
    }

    const peladaId = buscar_pelada_id() || 'default';
    const prefix = `regras_competicao_${peladaId}_`;
    let maiorSequencia = 0;

    // Pendente para próxima etapa: trocar leitura local por busca em Supabase (fonte oficial).
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;

      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;

        const regra = JSON.parse(raw) as {
          vinculado_torneio_slug?: string;
          vinculado_torneio_nome?: string;
          temporada_competicao?: string;
        };

        const mesmoTorneio =
          regra.vinculado_torneio_slug === selectedVinculado.id ||
          (regra.vinculado_torneio_nome || '').toLowerCase() === selectedVinculado.nome.toLowerCase();

        if (!mesmoTorneio || !regra.temporada_competicao) continue;

        const match = regra.temporada_competicao.match(/^(\d{4})-(\d{2})$/);
        if (!match) continue;

        const ano = Number(match[1]);
        const sequencia = Number(match[2]);
        if (ano === anoAtual && sequencia > maiorSequencia) {
          maiorSequencia = sequencia;
        }
      } catch {
        // Ignora entradas locais inválidas.
      }
    }

    const proximaSequencia = String(maiorSequencia + 1).padStart(2, '0');
    return `${anoAtual}-${proximaSequencia}`;
  }, [selectedVinculado, usarTorneioVinculado]);

  useEffect(() => {
    if (usarTorneioVinculado === 'sim') {
      setTemporadaCompeticao(proximaTemporadaAutomatica);
      return;
    }
    setTemporadaCompeticao('');
  }, [proximaTemporadaAutomatica, usarTorneioVinculado]);

  const aspectosPrincipais = useMemo(() => {
    const base = [
      `Modalidade: ${tituloModalidade[modalidade]}`,
      `Formato: ${descricaoFormato[formato]}`,
    ];

    if (formato === 'mata_mata') {
      base.push('Nao ha fase de grupos.');
      base.push('Cada confronto elimina um time.');
    }

    if (formato === 'pontos_corridos') {
      base.push('Classificacao geral por pontos.');
      base.push('Sem fase eliminatoria final.');
    }

    if (formato === 'pontos_corridos_mata_mata') {
      base.push('Primeira fase em liga (pontos corridos).');
      base.push('Fase final com os melhores em mata-mata.');
    }

    return base;
  }, [formato, modalidade]);

  const mostrarClassificados = formato === 'grupos_mata_mata';
  const mostrarMataMata = formato !== 'pontos_corridos';
  const classificacaoLigaImpar = classificamLiga % 2 !== 0;
  const deveMostrarRepescagemLiga = formato === 'pontos_corridos_mata_mata' && classificacaoLigaImpar;
  const repescagemLigaObrigatoria = deveMostrarRepescagemLiga;

  // Grupos possíveis: mínimo 2 grupos, mínimo 3 times por grupo
  const gruposPossiveis = useMemo(() => {
    const possiveis: number[] = [];
    for (let g = 2; g <= Math.floor(quantidadeTimes / 3); g++) {
      possiveis.push(g);
    }
    return possiveis;
  }, [quantidadeTimes]);

  const gruposIdeal = useMemo(() => {
    if (gruposPossiveis.length === 0) return 2;
    const potencias2 = gruposPossiveis.filter((g) => g > 1 && (g & (g - 1)) === 0);
    if (potencias2.length > 0) return potencias2[potencias2.length - 1];
    return gruposPossiveis[gruposPossiveis.length - 1];
  }, [gruposPossiveis]);

  const mostrarOpcaoResetCartoes = formato === 'grupos_mata_mata' || formato === 'pontos_corridos_mata_mata';

  const descricaoRepescagemLiga = useMemo(() => {
    if (!deveMostrarRepescagemLiga) return '';
    return 'Repescagem Detectada/Necessária';
  }, [classificamLiga, deveMostrarRepescagemLiga]);

  const jogadoresNecessariosMin = useMemo(() => {
    const base = minJogadoresParticipantesPorTime * quantidadeTimes;
    const goleiros = incluirGoleiro ? quantidadeTimes : 0;
    return base + goleiros;
  }, [minJogadoresParticipantesPorTime, quantidadeTimes, incluirGoleiro]);

  const jogadoresNecessariosMax = useMemo(() => {
    const base = maxJogadoresParticipantesPorTime * quantidadeTimes;
    const goleiros = incluirGoleiro ? quantidadeTimes : 0;
    return base + goleiros;
  }, [maxJogadoresParticipantesPorTime, quantidadeTimes, incluirGoleiro]);

  const metodosChaveamentoDisponiveis = useMemo<MetodoOpcaoUI[]>(() => {
    const padrao = (['aleatorio', 'cruzamento_grupos', 'melhor_vs_pior', 'classificacao_geral'] as MetodoChaveamento[])
      .filter((m) => (formato === 'pontos_corridos_mata_mata' ? m !== 'cruzamento_grupos' : true))
      .map((metodo) => ({
        metodo,
        label: obterLabelMetodo(metodo),
        descricao: obterDescricaoMetodo(metodo),
      }));

    if (formato !== 'pontos_corridos_mata_mata') {
      return padrao;
    }

    if (classificamLiga <= 2) {
      return [{
        metodo: 'melhor_vs_pior',
        label: 'Final direta: 1º vs 2º',
        descricao: 'Com 2 classificados existe apenas uma semifinal/final direta possível.',
      }];
    }

    if (classificamLiga === 3) {
      return [
        {
          metodo: 'classificacao_geral',
          label: '1º finalista, semifinal 2º vs 3º',
          descricao: 'Formato padrão: líder da liga espera na final e 2º enfrenta 3º.',
        },
        {
          metodo: 'melhor_vs_pior',
          label: '2º finalista, semifinal 1º vs 3º',
          descricao: 'O 2º colocado vai direto para a final; 1º e 3º disputam a vaga.',
        },
        {
          metodo: 'cruzamento_grupos',
          label: '3º finalista, semifinal 1º vs 2º',
          descricao: 'O 3º colocado vai direto para a final; 1º e 2º decidem a outra vaga.',
        },
        {
          metodo: 'aleatorio',
          label: 'Sorteio da ordem (finalista e semifinal)',
          descricao: 'Sorteia quem avança direto e quais dois times fazem a semifinal.',
        },
      ];
    }

    if (classificamLiga === 4) {
      return [
        {
          metodo: 'aleatorio',
          label: 'Sorteio das semifinais',
          descricao: 'Sorteia os dois confrontos de semifinal sem considerar posição na liga.',
        },
        {
          metodo: 'melhor_vs_pior',
          label: '1º vs 4º e 2º vs 3º',
          descricao: 'Semifinal clássica por ranking: melhor contra pior e miolo entre si.',
        },
        {
          metodo: 'cruzamento_grupos',
          label: '1º vs 3º e 2º vs 4º',
          descricao: 'Semifinal alternativa com cruzamento intermediário da classificação.',
        },
        {
          metodo: 'classificacao_geral',
          label: '1º vs 2º e 3º vs 4º',
          descricao: 'Semifinal por blocos consecutivos da tabela de classificação.',
        },
      ];
    }

    if (classificamLiga === 5) {
      return [
        {
          metodo: 'melhor_vs_pior',
          label: 'Repescagem 4º vs 5º, semis 1º vs V e 2º vs 3º',
          descricao: 'Repescagem elimina 1 time e completa a semifinal com vantagem ao líder.',
        },
        {
          metodo: 'classificacao_geral',
          label: 'Repescagem 1º vs 2º, semis 3º vs V e 4º vs 5º',
          descricao: 'Modelo alternativo com repescagem entre líderes antes da semifinal.',
        },
        {
          metodo: 'cruzamento_grupos',
          label: 'Repescagem 3º vs 5º, semis 1º vs 4º e 2º vs V',
          descricao: 'Repescagem no miolo da tabela e semifinal com cruzamento misto.',
        },
        {
          metodo: 'aleatorio',
          label: 'Sorteio completo (repescagem + semifinal)',
          descricao: 'Sorteia tanto o jogo de repescagem quanto os lados da semifinal.',
        },
      ];
    }

    if (classificamLiga % 2 === 0) {
      return [
        {
          metodo: 'aleatorio',
          label: 'Sorteio',
          descricao: `Sorteio livre dos confrontos para os ${classificamLiga} classificados.`,
        },
        {
          metodo: 'melhor_vs_pior',
          label: 'Melhor vs pior',
          descricao: 'Primeiros colocados enfrentam os últimos colocados no chaveamento inicial.',
        },
        {
          metodo: 'cruzamento_grupos',
          label: 'Cruzamento alternado',
          descricao: 'Cruza posições de forma alternada para equilibrar o lado da chave.',
        },
        {
          metodo: 'classificacao_geral',
          label: 'Classificação sequencial',
          descricao: 'Pareamento sequencial na ordem da tabela de classificação da liga.',
        },
      ];
    }

    return [
      {
        metodo: 'aleatorio',
        label: 'Sorteio com repescagem',
        descricao: 'Sorteia quais equipes disputam a repescagem e como ficam os confrontos seguintes.',
      },
      {
        metodo: 'melhor_vs_pior',
        label: 'Repescagem dos últimos colocados',
        descricao: `Repescagem entre ${classificamLiga - 1}º e ${classificamLiga}º; os melhores entram depois.`,
      },
      {
        metodo: 'cruzamento_grupos',
        label: 'Repescagem intermediária',
        descricao: 'Repescagem com posições intermediárias para redistribuir vantagem de tabela.',
      },
      {
        metodo: 'classificacao_geral',
        label: 'Repescagem central da tabela',
        descricao: 'Repescagem entre posições centrais e sequência por ordem de classificação.',
      },
    ];
  }, [formato, classificamLiga]);

  const metodoChaveamentoSelecionado = useMemo(
    () => metodosChaveamentoDisponiveis.find((item) => item.metodo === metodoChaveamento),
    [metodoChaveamento, metodosChaveamentoDisponiveis],
  );

  const repescagemLigaPosicoesSelecionadas = useMemo<number[] | undefined>(() => {
    if (formato !== 'pontos_corridos_mata_mata' || !classificacaoLigaImpar) return undefined;

    if (classificamLiga === 3) {
      if (metodoChaveamento === 'melhor_vs_pior') return [1, 3];
      if (metodoChaveamento === 'cruzamento_grupos') return [1, 2];
      if (metodoChaveamento === 'aleatorio') return undefined;
      return [2, 3];
    }

    if (classificamLiga === 5) {
      if (metodoChaveamento === 'classificacao_geral') return [1, 2];
      if (metodoChaveamento === 'cruzamento_grupos') return [3, 5];
      if (metodoChaveamento === 'aleatorio') return undefined;
      return [4, 5];
    }

    if (metodoChaveamento === 'aleatorio') return undefined;

    if (metodoChaveamento === 'classificacao_geral') {
      const meio = Math.floor(classificamLiga / 2);
      return [meio, meio + 1];
    }

    if (metodoChaveamento === 'cruzamento_grupos') {
      const meio = Math.floor(classificamLiga / 2);
      return [Math.max(2, meio), classificamLiga];
    }

    return [classificamLiga - 1, classificamLiga];
  }, [formato, classificacaoLigaImpar, classificamLiga, metodoChaveamento]);

  const timesPorGrupoAtual = useMemo(() => {
    if (!quantidadeGrupos) return 0;
    return Math.floor(quantidadeTimes / quantidadeGrupos);
  }, [quantidadeTimes, quantidadeGrupos]);

  const classificadosPossiveis = useMemo(() => {
    if (timesPorGrupoAtual < 2) return [];
    const possiveis: number[] = [];
    for (let c = 1; c < timesPorGrupoAtual; c++) possiveis.push(c);
    return possiveis;
  }, [timesPorGrupoAtual]);

  const classificadosIdeal = useMemo(() => {
    if (classificadosPossiveis.length === 0) return 1;
    if (classificadosPossiveis.includes(2)) return 2;
    return classificadosPossiveis[0];
  }, [classificadosPossiveis]);

  const faseEliminatoriaLabel = (total: number): string => {
    if (total === 2) return 'Final';
    if (total === 4) return 'Semi Finais';
    if (total === 8) return 'Quartas de Final';
    if (total === 16) return 'Oitavas de Final';
    return `Rodada de ${total}`;
  };

  const jogosPorFase = useMemo(() => {
    const fatorMM = mataMataFormato === 'ida_e_volta' ? 2 : 1;
    const fatorFinal = finalFormato === 'ida_e_volta' ? 2 : 1;
    const jogos3o = disputaTerceiro === 'nao' ? 0 : disputaTerceiro === 'ida_e_volta' ? 2 : 1;
    const fatorIda = idaVolta ? 2 : 1;

    if (formato === 'grupos_mata_mata') {
      const tpg = Math.floor(quantidadeTimes / quantidadeGrupos);
      const grupos = ((tpg * (tpg - 1)) / 2) * fatorIda * quantidadeGrupos;
      const timesEM = classificamGrupo * quantidadeGrupos;
      const mm = timesEM > 1 ? (timesEM - 2) * fatorMM + fatorFinal + jogos3o : 0;
      return { grupos, liga: 0, mm };
    }
    if (formato === 'mata_mata') {
      const mm = quantidadeTimes > 1 ? (quantidadeTimes - 2) * fatorMM + fatorFinal + jogos3o : 0;
      return { grupos: 0, liga: 0, mm };
    }
    if (formato === 'pontos_corridos') {
      const liga = ((quantidadeTimes * (quantidadeTimes - 1)) / 2) * fatorIda;
      return { grupos: 0, liga, mm: 0 };
    }
    if (formato === 'pontos_corridos_mata_mata') {
      const liga = ((quantidadeTimes * (quantidadeTimes - 1)) / 2) * fatorIda;
      const mm = classificamLiga > 1 ? (classificamLiga - 2) * fatorMM + fatorFinal + jogos3o : 0;
      return { grupos: 0, liga, mm };
    }
    return { grupos: 0, liga: 0, mm: 0 };
  }, [formato, quantidadeTimes, quantidadeGrupos, classificamGrupo, classificamLiga, idaVolta, mataMataFormato, finalFormato, disputaTerceiro]);

  const totalJogos = jogosPorFase.grupos + jogosPorFase.liga + jogosPorFase.mm;

  // Auto-selecionar ideal quando quantidadeTimes muda
  useEffect(() => {
    if (!mostrarClassificados || gruposPossiveis.length === 0) return;
    if (!gruposPossiveis.includes(quantidadeGrupos)) {
      setQuantidadeGrupos(gruposIdeal);
    }
  }, [gruposPossiveis, gruposIdeal, mostrarClassificados]);

  useEffect(() => {
    if (!mostrarClassificados || classificadosPossiveis.length === 0) return;
    if (!classificadosPossiveis.includes(classificamGrupo)) {
      setClassificamGrupo(classificadosIdeal);
    }
  }, [classificadosPossiveis, classificadosIdeal, mostrarClassificados]);

  useEffect(() => {
    if (formato !== 'pontos_corridos_mata_mata') return;
    const maxClassificam = quantidadeTimes;
    setClassificamLiga((curr) => {
      if (maxClassificam < 2) return 2;
      if (curr > maxClassificam || curr < 2) {
        return Math.min(4, maxClassificam);
      }
      return curr;
    });
  }, [quantidadeTimes, formato]);

  useEffect(() => {
    const metodosPermitidos = metodosChaveamentoDisponiveis.map((item) => item.metodo);
    if (!metodosPermitidos.includes(metodoChaveamento)) {
      setMetodoChaveamento(metodosChaveamentoDisponiveis[0].metodo);
    }
  }, [metodoChaveamento, metodosChaveamentoDisponiveis]);

  const criteriosDesempateVisiveis = useMemo(
    () => criteriosDesempate.filter((item) => item.key !== 'total_cartoes' || registrarCartoes),
    [criteriosDesempate, registrarCartoes],
  );

  const toggleCriterio = (key: CriterioKey) => {
    setCriteriosDesempate((prev) => prev.map((item) => (
      item.key === key ? { ...item, enabled: !item.enabled } : item
    )));
  };

  const moverCriterio = (index: number, direcao: 'up' | 'down') => {
    setCriteriosDesempate((prev) => {
      const next = [...prev];
      const alvo = direcao === 'up' ? index - 1 : index + 1;
      if (alvo < 0 || alvo >= next.length) return prev;
      const temp = next[index];
      next[index] = next[alvo];
      next[alvo] = temp;
      return next;
    });
  };

  const confirmarRegras = () => {
    if (!setupValido || salvando) return;

    if (usarTorneioVinculado === 'sim') {
      if (!torneioVinculadoSelecionado) {
        alert('Selecione um torneio vinculado.');
        return;
      }
    } else if (!nomeCompeticao.trim()) {
      alert('Informe o nome da competicao.');
      return;
    }

    if (!jogadoresPorTime || jogadoresPorTime < 1) {
      alert('Informe a quantidade de jogadores por time.');
      return;
    }
    if (!minJogadoresParticipantesPorTime || minJogadoresParticipantesPorTime < 1) {
      alert('Informe o mínimo de jogadores participantes por time.');
      return;
    }
    if (!maxJogadoresParticipantesPorTime || maxJogadoresParticipantesPorTime < 1) {
      alert('Informe o máximo de jogadores participantes por time.');
      return;
    }
    if (minJogadoresParticipantesPorTime > maxJogadoresParticipantesPorTime) {
      alert('O mínimo de participantes por time não pode ser maior que o máximo.');
      return;
    }
    if (jogadoresPorTime < minJogadoresParticipantesPorTime || jogadoresPorTime > maxJogadoresParticipantesPorTime) {
      alert('Jogadores em campo deve estar dentro do intervalo mínimo e máximo definido para participantes por time.');
      return;
    }
    if (!quantidadeTimes || quantidadeTimes < 2) {
      alert('Informe a quantidade de times (mínimo 2).');
      return;
    }
    if (!tempoPartida || tempoPartida < 1) {
      alert('Informe o tempo de partida.');
      return;
    }

    setSalvando(true);

    try {
      const setup = obterSetupCompeticaoLocal();
      if (!setup) {
        router.replace('/modo-torneio');
        return;
      }

      const nomeFinal = selectedVinculado?.nome ?? nomeCompeticao.trim();
      const torneio = iniciarCompeticaoLocalAPartirSetup(setup, nomeFinal);

      const peladaId = buscar_pelada_id() || 'default';
      const timestamp = new Date().toISOString();
      const criteriosAtivos = criteriosDesempate
        .filter((item) => item.enabled && (item.key !== 'total_cartoes' || registrarCartoes))
        .map((item) => item.key);

      const regras: RegrasCompeticaoLocal = {
        torneio_id: torneio.id,
        pelada_id: peladaId,
        modalidade,
        formato,
        jogadores_por_time: jogadoresPorTime,
        min_jogadores_participantes_por_time: minJogadoresParticipantesPorTime,
        max_jogadores_participantes_por_time: maxJogadoresParticipantesPorTime,
        quantidade_times: quantidadeTimes,
        temporada_competicao: usarTorneioVinculado === 'sim' ? proximaTemporadaAutomatica : undefined,
        vinculado_torneio_nome: selectedVinculado?.nome ?? (usarTorneioVinculado === 'sim' ? undefined : undefined),
        vinculado_torneio_slug: selectedVinculado?.id,
        incluir_goleiro: incluirGoleiro,
        tempo_partida: tempoPartida,
        tempos_partida: temposPartida,
        tempo_prorrogacao: mostrarMataMata && empateDecisao === 'prorrogacao' ? tempoProrrogacao : undefined,
        tempos_prorrogacao: mostrarMataMata && empateDecisao === 'prorrogacao' ? temposProrrogacao : undefined,
        pontos_vitoria: 3,
        pontos_empate: 1,
        pontos_derrota: 0,
        criterio_desempate: criteriosAtivos[0] || 'vitorias',
        criterios_desempate: criteriosAtivos,
        ida_e_volta: idaVolta,
        classificam_por_grupo: mostrarClassificados ? classificamGrupo : 0,
        classificam_liga: (formato === 'pontos_corridos' || formato === 'pontos_corridos_mata_mata') ? classificamLiga : undefined,
        repescagem_liga: formato === 'pontos_corridos_mata_mata' && classificacaoLigaImpar ? repescagemLigaObrigatoria : undefined,
        repescagem_liga_posicoes: formato === 'pontos_corridos_mata_mata' && classificacaoLigaImpar && repescagemLigaObrigatoria
          ? repescagemLigaPosicoesSelecionadas
          : undefined,
        jogos_mata_mata_unicos: mostrarMataMata ? mataMataFormato === 'jogo_unico' : false,
        final_jogo_unico: mostrarMataMata ? finalFormato === 'jogo_unico' : false,
        mata_mata_formato: mostrarMataMata ? mataMataFormato : undefined,
        final_formato: mostrarMataMata ? finalFormato : undefined,
        disputa_terceiro_lugar: mostrarMataMata ? disputaTerceiro : 'nao',
        empate_decisao: mostrarMataMata ? empateDecisao : undefined,
        metodo_chaveamento: mostrarMataMata ? metodoChaveamento : undefined,
        quantidade_grupos: mostrarClassificados ? quantidadeGrupos : undefined,
        repescagem: mostrarClassificados ? repescagem : undefined,
        registrar_cartoes: registrarCartoes,
        cartoes_amarelos: registrarCartoes ? cartoesAmarelos : false,
        cartoes_vermelhos: registrarCartoes ? cartoesVermelhos : false,
        cartoes_azuis: registrarCartoes ? cartoesAzuis : false,
        acumulacao_cartoes_amarelos: registrarCartoes && cartoesAmarelos ? acumulacaoCartoesAmarelos : 0,
        acumulacao_cartoes_azuis: registrarCartoes && cartoesAzuis ? acumulacaoCartoesAzuis : 0,
        reset_cartoes_para_eliminatorias: registrarCartoes && mostrarOpcaoResetCartoes ? resetCartoesParaEliminatorias : undefined,
        efeito_cartao_vermelho: registrarCartoes && cartoesVermelhos ? efeitoCartaoVermelho : undefined,
        tempo_cartao_azul: registrarCartoes && cartoesAzuis ? tempoCartaoAzul : undefined,
        expulsao_dois_cartoes_azuis: registrarCartoes && cartoesAzuis ? expulsaoDoisCartoesAzuis : false,
        created_at: timestamp,
        updated_at: timestamp,
        sync_status: 'local_only',
        version: 1,
      };

      salvarRegrasCompeticaoLocal(regras);

      // Redirecionar para participantes
      router.replace('/modo-torneio/participantes');
    } catch (error) {
      console.error('Erro ao salvar regras da competicao:', error);
      alert('❌ Nao foi possivel salvar as regras agora.');
    } finally {
      setSalvando(false);
    }
  };

  const cancelarFluxo = () => {
    limparSetupCompeticaoLocal();
    router.replace('/modo-torneio');
  };

  return (
    <Layout title="Regras do Torneio">
      <section className="mb-6">
        <div className="bg-gray-800 border-gray-700 rounded-2xl shadow-2xl p-5 sm:p-6 border-2">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            <span className="text-sky-400">Regras da</span>{' '}
            <span className="text-white">Competicao</span>
          </h2>
          <p className="text-sm sm:text-base mt-1 text-white">Tela unica para Torneio e Campeonato</p>
        </div>
      </section>

      <section className="mb-5">
        <div className="bg-white border border-sky-100 rounded-2xl shadow-md p-4 sm:p-5">
          <h3 className="font-black text-sky-800 mb-2">Aspectos pre-definidos</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            {aspectosPrincipais.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-sky-600">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mb-5">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-md p-4 sm:p-5">
          <div className="mb-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-sm font-semibold text-gray-700">Deseja iniciar um torneio vinculado à sua pelada?</p>
              <button
                type="button"
                onClick={() => router.push('/modo-torneio/meus-torneios')}
                className="text-[11px] sm:text-xs font-semibold text-sky-700 border border-sky-300 bg-sky-50 hover:bg-sky-100 px-2 py-1 rounded-lg transition-colors whitespace-nowrap"
              >
                Cadastrar Torneio
              </button>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setUsarTorneioVinculado('sim')}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${usarTorneioVinculado === 'sim' ? 'bg-sky-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Sim
              </button>
              <button
                type="button"
                onClick={() => setUsarTorneioVinculado('nao')}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${usarTorneioVinculado === 'nao' ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Não
              </button>
            </div>
          </div>
          {usarTorneioVinculado === 'sim' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Torneio vinculado</label>
                <select
                  value={torneioVinculadoSelecionado}
                  onChange={(e) => setTorneioVinculadoSelecionado(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none focus:border-sky-500"
                >
                  <option value="">Selecione o torneio vinculado</option>
                  {torneiosVinculados.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome} — {ESTRELAS_IMPORTANCIA[item.nivel_importancia]}
                    </option>
                  ))}
                </select>
                {torneiosVinculados.length === 0 && (
                  <p className="mt-2 text-xs text-gray-500">Nenhum torneio vinculado cadastrado. Crie um novo na tela inicial do modo torneio.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Temporada</label>
                <input
                  type="text"
                  value={temporadaCompeticao}
                  readOnly
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-gray-50 text-gray-700 outline-none"
                  placeholder="Gerado automaticamente"
                />
                <p className="mt-1 text-xs text-gray-500">Sequência automática no padrão AAAA-XX (ex.: 2026-01, 2026-02).</p>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nome da competicao</label>
              <input
                type="text"
                value={nomeCompeticao}
                onChange={(e) => setNomeCompeticao(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:border-sky-500"
                placeholder="Obrigatório"
                required
              />
            </div>
          )}
        </div>
      </section>

      <section className="mb-5">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-md p-4 sm:p-5">
          <h3 className="font-black text-gray-800 mb-4">Bloco 1 — Regras Gerais da Partida</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Quantidade jogadores participantes por time no torneio</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Minimo</label>
                  <input
                    type="number"
                    min={1}
                    value={minJogadoresParticipantesPorTime}
                    onChange={(e) => setMinJogadoresParticipantesPorTime(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Maximo</label>
                  <input
                    type="number"
                    min={1}
                    value={maxJogadoresParticipantesPorTime}
                    onChange={(e) => setMaxJogadoresParticipantesPorTime(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:border-sky-500"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">Esse intervalo define quantos participantes por time podem ser usados no torneio.</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Jogadores por time em campo</label>
              <input
                type="number"
                value={jogadoresPorTime}
                onChange={(e) => setJogadoresPorTime(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Quantidade de times
              </label>
              <input
                type="number"
                value={quantidadeTimes}
                onChange={(e) => setQuantidadeTimes(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:border-sky-500"
              />
              {jogadoresPorTime > 0 && quantidadeTimes > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Necessário entre{' '}
                  <span className="font-semibold text-sky-700">{jogadoresNecessariosMin}</span>
                  {' '}e{' '}
                  <span className="font-semibold text-sky-700">{jogadoresNecessariosMax}</span>
                  {' '}jogadores no total
                  {incluirGoleiro ? ' (incluindo goleiros)' : ''}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Incluir Goleiros na seleção de times?</label>
              <div className="flex gap-2">
                {(['Sim', 'Não'] as const).map((opcao) => (
                  <button
                    key={opcao}
                    type="button"
                    onClick={() => setIncluirGoleiro(opcao === 'Sim')}
                    className={`flex-1 py-2 rounded-lg border-2 font-semibold text-sm transition-all ${
                      (opcao === 'Sim' && incluirGoleiro) || (opcao === 'Não' && !incluirGoleiro)
                        ? 'border-sky-500 bg-sky-500 text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-sky-300'
                    }`}
                  >
                    {opcao}
                  </button>
                ))}
              </div>
              {incluirGoleiro && (
                <p className="text-xs text-sky-600 mt-1 font-medium">Goleiro não conta como jogador de linha</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Tempo de partida (minutos)</label>
              <input
                type="number"
                value={tempoPartida}
                onChange={(e) => setTempoPartida(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Estrutura do tempo</label>
              <div className="flex gap-2">
                {([1, 2] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setTemposPartida(n)}
                    className={`flex-1 py-2 rounded-lg border-2 font-semibold text-sm transition-all ${
                      temposPartida === n
                        ? 'border-sky-500 bg-sky-500 text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-sky-300'
                    }`}
                  >
                    {n === 1 ? 'Tempo único' : `2 tempos (${tempoPartida}min cada)`}
                  </button>
                ))}
              </div>
              {temposPartida === 2 && (
                <p className="text-xs text-sky-600 mt-1 font-medium">Total: {tempoPartida * 2} min por partida</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mb-5">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-md p-4 sm:p-5">
          <h3 className="font-black text-gray-800 mb-4">Bloco 2 — Cartões</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Registrar cartões?</label>
              <div className="flex gap-2">
                {(['Sim', 'Não'] as const).map((opcao) => (
                  <button
                    key={opcao}
                    type="button"
                    onClick={() => setRegistrarCartoes(opcao === 'Sim')}
                    className={`flex-1 py-2 rounded-lg border-2 font-semibold text-sm transition-all ${
                      (opcao === 'Sim' && registrarCartoes) || (opcao === 'Não' && !registrarCartoes)
                        ? 'border-sky-500 bg-sky-500 text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-sky-300'
                    }`}
                  >
                    {opcao}
                  </button>
                ))}
              </div>
            </div>

            {registrarCartoes ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Tipos de cartões habilitados</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Amarelo', value: cartoesAmarelos, onClick: () => setCartoesAmarelos((prev) => !prev) },
                      { label: 'Vermelho', value: cartoesVermelhos, onClick: () => setCartoesVermelhos((prev) => !prev) },
                      { label: 'Azul', value: cartoesAzuis, onClick: () => setCartoesAzuis((prev) => !prev) },
                    ].map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        onClick={option.onClick}
                        className={`w-full py-2 rounded-lg border-2 font-semibold text-sm transition-all ${
                          option.value
                            ? 'border-sky-500 bg-sky-500 text-white'
                            : 'border-gray-300 bg-white text-gray-700 hover:border-sky-300'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Acumulação de cartões amarelos</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Não', '2', '3'] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setAcumulacaoCartoesAmarelos(value === 'Não' ? 0 : Number(value) as 2 | 3)}
                        className={`w-full py-2 rounded-lg border-2 font-semibold text-sm transition-all ${
                          acumulacaoCartoesAmarelos === (value === 'Não' ? 0 : Number(value))
                            ? 'border-sky-500 bg-sky-500 text-white'
                            : 'border-gray-300 bg-white text-gray-700 hover:border-sky-300'
                        }`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Escolha quando o acúmulo de amarelos gera suspensão automática.</p>
                </div>

                {cartoesAzuis && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Duração do cartão azul (minutos)</label>
                      <input
                        type="number"
                        min={1}
                        value={tempoCartaoAzul}
                        onChange={(e) => setTempoCartaoAzul(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>
                )}

                {mostrarOpcaoResetCartoes && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Resetar cartões antes da fase eliminatória?</label>
                    <div className="flex gap-2">
                      {(['Sim', 'Não'] as const).map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setResetCartoesParaEliminatorias(value === 'Sim')}
                          className={`flex-1 py-2 rounded-lg border-2 font-semibold text-sm transition-all ${
                            (value === 'Sim' && resetCartoesParaEliminatorias) || (value === 'Não' && !resetCartoesParaEliminatorias)
                              ? 'border-sky-500 bg-sky-500 text-white'
                              : 'border-gray-300 bg-white text-gray-700 hover:border-sky-300'
                          }`}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Use quando a primeira fase termina e a segunda começa com um novo acúmulo de cartões.</p>
                  </div>
                )}

                {cartoesVermelhos && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Efeito do cartão vermelho</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {([
                        { label: 'Expulsão', value: 'expulsao', description: 'Remove do jogo atual.', disabled: false },
                        { label: 'Suspensão', value: 'suspensao', description: 'Remove do jogo atual + próximo jogo.', disabled: false },
                        { label: 'Substituição', value: 'substituicao', description: 'Entrada de reserva (não suportado ainda).', disabled: true },
                      ] as Array<{
                        label: string;
                        value: 'expulsao' | 'suspensao' | 'substituicao';
                        description: string;
                        disabled: boolean;
                      }>).map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            if (option.disabled) return;
                            setEfeitoCartaoVermelho(option.value);
                          }}
                          disabled={option.disabled}
                          className={`py-2 rounded-lg border-2 font-semibold text-sm transition-all ${
                            option.disabled
                              ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                              : efeitoCartaoVermelho === option.value
                                ? 'border-sky-500 bg-sky-500 text-white'
                                : 'border-gray-300 bg-white text-gray-700 hover:border-sky-300'
                          }`}
                        >
                          <div>{option.label}</div>
                          <div className="text-[10px] font-normal mt-1 text-gray-500">{option.description}</div>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Defina o tratamento do cartão vermelho na competição.</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Cartões não serão registrados na competição.</p>
            )}
          </div>
        </div>
      </section>

      {mostrarClassificados && (
      <section className="mb-5">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-md p-4 sm:p-5">
          <h3 className="font-black text-gray-800 mb-4">Bloco 3 — Fase de Grupos</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {mostrarClassificados && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Quantidade de grupos</label>
                {gruposPossiveis.length === 0 ? (
                  <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    Precisa de pelo menos 6 times para usar fase de grupos (min. 3 por grupo).
                  </p>
                ) : (
                  <>
                    <div className="flex gap-2 flex-wrap">
                      {gruposPossiveis.map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setQuantidadeGrupos(g)}
                          className={`w-10 h-10 rounded-lg border-2 font-bold text-sm transition-all ${
                            quantidadeGrupos === g
                              ? 'border-sky-500 bg-sky-500 text-white'
                              : 'border-gray-300 bg-white text-gray-700 hover:border-sky-300'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5">
                      {quantidadeTimes % quantidadeGrupos === 0
                        ? `${timesPorGrupoAtual} times por grupo`
                        : `${Math.floor(quantidadeTimes / quantidadeGrupos)}–${Math.ceil(quantidadeTimes / quantidadeGrupos)} times por grupo (distribuição desigual)`}
                    </p>
                  </>
                )}
              </div>
            )}

            {mostrarClassificados && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Classificam por grupo</label>
                {classificadosPossiveis.length === 0 ? (
                  <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    Defina a quantidade de grupos primeiro.
                  </p>
                ) : (
                  <>
                    <div className="flex gap-2 flex-wrap">
                      {classificadosPossiveis.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setClassificamGrupo(c)}
                          className={`w-10 h-10 rounded-lg border-2 font-bold text-sm transition-all ${
                            classificamGrupo === c
                              ? 'border-sky-500 bg-sky-500 text-white'
                              : 'border-gray-300 bg-white text-gray-700 hover:border-sky-300'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5">
                      {classificamGrupo * quantidadeGrupos} times avançam no total{classificamGrupo * quantidadeGrupos > 1 && <span className="ml-1 text-sky-600 font-medium">· Eliminatórias = {faseEliminatoriaLabel(classificamGrupo * quantidadeGrupos)}</span>}
                    </p>
                    {(() => { const t = classificamGrupo * quantidadeGrupos; return t > 1 && (t & (t - 1)) !== 0; })() && (
                      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mt-2">
                        ⚠️ {classificamGrupo * quantidadeGrupos} times não é potência de 2 — o chaveamento ficará irregular (alguns times entram direto em rodadas mais avançadas).
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Partidas de ida e volta</label>
              <select
                value={idaVolta ? 'sim' : 'nao'}
                onChange={(e) => setIdaVolta(e.target.value === 'sim')}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:border-sky-500 bg-white"
              >
                <option value="nao">Nao</option>
                <option value="sim">Sim</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Criterios de desempate (ordenacao manual)</label>
              <div className="space-y-2">
                {criteriosDesempate.map((criterioItem, index) => (
                  <div
                    key={criterioItem.key}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 flex items-center gap-2"
                  >
                    <input
                      type="checkbox"
                      checked={criterioItem.enabled}
                      onChange={() => toggleCriterio(criterioItem.key)}
                      className="h-4 w-4"
                    />
                    <span className={`text-sm flex-1 ${criterioItem.enabled ? 'text-gray-800' : 'text-gray-400'}`}>
                      {criterioItem.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => moverCriterio(index, 'up')}
                      disabled={index === 0}
                      className="px-2 py-1 rounded border border-gray-200 text-xs disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moverCriterio(index, 'down')}
                      disabled={index === criteriosDesempate.length - 1}
                      className="px-2 py-1 rounded border border-gray-200 text-xs disabled:opacity-40"
                    >
                      ↓
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>
      )}

      {(formato === 'pontos_corridos' || formato === 'pontos_corridos_mata_mata') && (
      <section className="mb-5">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-md p-4 sm:p-5">
          <h3 className="font-black text-gray-800 mb-4">Bloco 4 — Liga (Pontos Corridos)</h3>

          <div className="space-y-5">

            {/* 1 - Turno e Returno */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Rodadas</label>
              <div className="flex gap-2">
                {([false, true] as const).map((val) => (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => setIdaVolta(val)}
                    className={`flex-1 py-2 rounded-lg border-2 font-semibold text-sm transition-all ${
                      idaVolta === val
                        ? 'border-sky-500 bg-sky-500 text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-sky-300'
                    }`}
                  >
                    {val ? 'Turno e Returno' : 'Turno Único'}
                  </button>
                ))}
              </div>
            </div>

            {/* 2 - Quantos se classificam (só pontos_corridos_mata_mata) */}
            {formato === 'pontos_corridos_mata_mata' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Quantos se classificam</label>
                <div className="flex gap-2 flex-wrap">
                  {Array.from({ length: Math.max(0, quantidadeTimes - 1) }, (_, i) => i + 2).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setClassificamLiga(n)}
                      className={`w-10 h-10 rounded-lg border-2 font-bold text-sm transition-all ${
                        classificamLiga === n
                          ? 'border-sky-500 bg-sky-500 text-white'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-sky-300'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1.5">
                  {classificamLiga} times avançam para o mata-mata{classificamLiga > 1 && <span className="ml-1 text-sky-600 font-medium">· Eliminatórias = {faseEliminatoriaLabel(classificamLiga)}</span>}
                </p>
                {deveMostrarRepescagemLiga && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-semibold text-amber-800">{descricaoRepescagemLiga}</p>
                  </div>
                )}
              </div>
            )}

            {/* 3 - Critérios de desempate */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Critérios de desempate (ordem de prioridade)</label>
              <div className="space-y-2">
                {criteriosDesempateVisiveis.map((criterioItem, index) => (
                  <div
                    key={criterioItem.key}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 flex items-center gap-2"
                  >
                    <input
                      type="checkbox"
                      checked={criterioItem.enabled}
                      onChange={() => toggleCriterio(criterioItem.key)}
                      className="h-4 w-4"
                    />
                    <span className={`text-sm flex-1 ${criterioItem.enabled ? 'text-gray-800' : 'text-gray-400'}`}>
                      {criterioItem.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => moverCriterio(index, 'up')}
                      disabled={index === 0}
                      className="px-2 py-1 rounded border border-gray-200 text-xs disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moverCriterio(index, 'down')}
                      disabled={index === criteriosDesempate.length - 1}
                      className="px-2 py-1 rounded border border-gray-200 text-xs disabled:opacity-40"
                    >
                      ↓
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>
      )}

      {mostrarMataMata && (
        <section className="mb-5">
          <div className="bg-white border border-gray-200 rounded-2xl shadow-md p-4 sm:p-5">
            <h3 className="font-black text-gray-800 mb-4">Bloco 5 — Fase Eliminatória</h3>

            <div className="space-y-5">

              {/* 1 - Método de chaveamento */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Método de chaveamento</label>
                {formato === 'pontos_corridos_mata_mata' && classificacaoLigaImpar && (
                  <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="text-xs text-amber-700">Repescagem ativa. O confronto será definido pelo método selecionado abaixo.</p>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {metodosChaveamentoDisponiveis.map((opcao) => (
                    <button
                      key={`${opcao.metodo}-${opcao.label}`}
                      type="button"
                      onClick={() => setMetodoChaveamento(opcao.metodo)}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        metodoChaveamento === opcao.metodo
                          ? 'border-sky-500 bg-sky-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <p className={`font-semibold text-sm ${metodoChaveamento === opcao.metodo ? 'text-sky-700' : 'text-gray-800'}`}>
                        {opcao.label}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{opcao.descricao}</p>
                    </button>
                  ))}
                </div>
                {formato === 'pontos_corridos_mata_mata' && classificacaoLigaImpar && repescagemLigaPosicoesSelecionadas && (
                  <p className="text-xs text-gray-500 mt-2">
                    Repescagem definida: {repescagemLigaPosicoesSelecionadas[0]}º vs {repescagemLigaPosicoesSelecionadas[1]}º.
                  </p>
                )}
                {formato === 'pontos_corridos_mata_mata' && classificacaoLigaImpar && !repescagemLigaPosicoesSelecionadas && (
                  <p className="text-xs text-gray-500 mt-2">Repescagem definida por sorteio automático.</p>
                )}
              </div>

              {/* 2 - Mata-Mata */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Mata-Mata</label>
                <div className="flex gap-2">
                  {(['jogo_unico', 'ida_e_volta'] as const).map((op) => (
                    <button
                      key={op}
                      type="button"
                      onClick={() => setMataMataFormato(op)}
                      className={`flex-1 py-2 rounded-lg border-2 font-semibold text-sm transition-all ${
                        mataMataFormato === op
                          ? 'border-sky-500 bg-sky-500 text-white'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-sky-300'
                      }`}
                    >
                      {op === 'jogo_unico' ? 'Jogo Único' : 'Ida e Volta'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3 - Final */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Final</label>
                <div className="flex gap-2">
                  {(['jogo_unico', 'ida_e_volta'] as const).map((op) => (
                    <button
                      key={op}
                      type="button"
                      onClick={() => setFinalFormato(op)}
                      className={`flex-1 py-2 rounded-lg border-2 font-semibold text-sm transition-all ${
                        finalFormato === op
                          ? 'border-sky-500 bg-sky-500 text-white'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-sky-300'
                      }`}
                    >
                      {op === 'jogo_unico' ? 'Jogo Único' : 'Ida e Volta'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4 - Disputa do 3º lugar */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Disputa do 3º lugar</label>
                <div className="flex gap-2">
                  {(['nao', 'jogo_unico', 'ida_e_volta'] as const).map((op) => (
                    <button
                      key={op}
                      type="button"
                      onClick={() => setDisputaTerceiro(op)}
                      className={`flex-1 py-2 rounded-lg border-2 font-semibold text-sm transition-all ${
                        disputaTerceiro === op
                          ? 'border-sky-500 bg-sky-500 text-white'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-sky-300'
                      }`}
                    >
                      {op === 'nao' ? 'Não' : op === 'jogo_unico' ? 'Jogo Único' : 'Ida e Volta'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 5 - Em caso de empate */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Em caso de empate</label>
                <div className="flex gap-2">
                  {(['prorrogacao', 'penaltis'] as const).map((op) => (
                    <button
                      key={op}
                      type="button"
                      onClick={() => setEmpateDecisao(op)}
                      className={`flex-1 py-2 rounded-lg border-2 font-semibold text-sm transition-all ${
                        empateDecisao === op
                          ? 'border-sky-500 bg-sky-500 text-white'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-sky-300'
                      }`}
                    >
                      {op === 'prorrogacao' ? 'Prorrogação' : 'Pênaltis'}
                    </button>
                  ))}
                </div>
                {empateDecisao === 'prorrogacao' && (
                  <div className="mt-3 space-y-3 bg-gray-50 border border-gray-200 rounded-xl p-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Tempo da prorrogação (minutos)</label>
                      <input
                        type="number"
                        min={1}
                        value={tempoProrrogacao}
                        onChange={(e) => setTempoProrrogacao(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:border-sky-500 text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Estrutura da prorrogação</label>
                      <div className="flex gap-2">
                        {([1, 2] as const).map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setTemposProrrogacao(n)}
                            className={`flex-1 py-1.5 rounded-lg border-2 font-semibold text-xs transition-all ${
                              temposProrrogacao === n
                                ? 'border-sky-500 bg-sky-500 text-white'
                                : 'border-gray-300 bg-white text-gray-700 hover:border-sky-300'
                            }`}
                          >
                            {n === 1 ? 'Tempo único' : `2 tempos (${tempoProrrogacao}min cada)`}
                          </button>
                        ))}
                      </div>
                      {temposProrrogacao === 2 && (
                        <p className="text-xs text-sky-600 mt-1 font-medium">Total: {tempoProrrogacao * 2} min de prorrogação</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </section>
      )}

      <section className="mb-4">
        <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-semibold text-sky-800">Quantidade de jogos</p>
              <p className="text-xs text-sky-500 mt-0.5">Baseado nas regras configuradas</p>
            </div>
            <span className="text-4xl font-black text-sky-600">{totalJogos}</span>
          </div>
          <div className="flex gap-3 flex-wrap text-xs text-sky-700 border-t border-sky-200 pt-2">
            {jogosPorFase.grupos > 0 && <span>{jogosPorFase.grupos} de grupos</span>}
            {jogosPorFase.liga > 0 && <span>{jogosPorFase.liga} de liga</span>}
            {jogosPorFase.mm > 0 && <span className="font-semibold">{jogosPorFase.mm} de mata-mata</span>}
            {tempoPartida > 0 && totalJogos > 0 && (
              <span className="ml-auto font-semibold text-sky-600">≈ {totalJogos * tempoPartida} min no total</span>
            )}
          </div>
        </div>
      </section>

      <section className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={cancelarFluxo}
          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl shadow-md p-3 font-semibold transition-colors"
        >
          Cancelar
        </button>

        <button
          onClick={() => setShowModalConfirmar(true)}
          disabled={!setupValido || salvando}
          className={`w-full rounded-xl shadow-md p-3 font-semibold transition-colors ${
            !setupValido || salvando
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700'
          }`}
        >
          {salvando ? 'Salvando...' : 'Confirmar regras e iniciar'}
        </button>
      </section>

      {showModalConfirmar && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col">
            <div className="p-5 overflow-y-auto flex-1">
              <h3 className="font-black text-gray-800 text-lg mb-0.5">Resumo das Regras</h3>
              <p className="text-xs text-gray-400 mb-4">Revise antes de confirmar.</p>

              <div className="space-y-3 text-sm">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="font-bold text-gray-700 mb-1.5">Competição</p>
                  <div className="space-y-1 text-gray-600">
                    <p><span className="text-gray-400">Nome:</span> {nomeCompeticao}</p>
                    <p><span className="text-gray-400">Modalidade:</span> {tituloModalidade[modalidade]}</p>
                    <p><span className="text-gray-400">Formato:</span> {descricaoFormato[formato]}</p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="font-bold text-gray-700 mb-1.5">Partida</p>
                  <div className="space-y-1 text-gray-600">
                    <p><span className="text-gray-400">Times:</span> {quantidadeTimes} × {jogadoresPorTime} jogadores = <strong>{quantidadeTimes * jogadoresPorTime}</strong> no total</p>
                    <p><span className="text-gray-400">Elenco necessário:</span> <strong>{jogadoresNecessariosMin}</strong> a <strong>{jogadoresNecessariosMax}</strong> jogadores</p>
                    <p><span className="text-gray-400">Tempo:</span> {tempoPartida} min por jogo</p>
                  </div>
                </div>

                {mostrarClassificados && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="font-bold text-gray-700 mb-1.5">Fase de Grupos</p>
                    <div className="space-y-1 text-gray-600">
                      <p><span className="text-gray-400">Grupos:</span> {quantidadeGrupos} × {timesPorGrupoAtual} times</p>
                      <p><span className="text-gray-400">Classificam:</span> {classificamGrupo}/grupo → {classificamGrupo * quantidadeGrupos} times</p>
                      <p><span className="text-gray-400">Rodadas:</span> {idaVolta ? 'Turno e returno' : 'Turno único'}</p>
                    </div>
                  </div>
                )}

                {(formato === 'pontos_corridos' || formato === 'pontos_corridos_mata_mata') && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="font-bold text-gray-700 mb-1.5">Liga</p>
                    <div className="space-y-1 text-gray-600">
                      <p><span className="text-gray-400">Rodadas:</span> {idaVolta ? 'Turno e returno' : 'Turno único'}</p>
                      {formato === 'pontos_corridos_mata_mata' && (
                        <>
                          <p><span className="text-gray-400">Classificam:</span> {classificamLiga} times para o mata-mata</p>
                          {classificacaoLigaImpar && (
                            <p>
                              <span className="text-gray-400">Repescagem:</span>{' '}
                              {repescagemLigaPosicoesSelecionadas
                                ? `${repescagemLigaPosicoesSelecionadas[0]}º x ${repescagemLigaPosicoesSelecionadas[1]}º`
                                : 'Sorteio automático'}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {mostrarMataMata && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="font-bold text-gray-700 mb-1.5">Fase Eliminatória</p>
                    <div className="space-y-1 text-gray-600">
                      <p><span className="text-gray-400">Método:</span> {metodoChaveamentoSelecionado?.label || obterLabelMetodo(metodoChaveamento)}</p>
                      <p><span className="text-gray-400">Mata-mata:</span> {mataMataFormato === 'jogo_unico' ? 'Jogo único' : 'Ida e volta'}</p>
                      <p><span className="text-gray-400">Final:</span> {finalFormato === 'jogo_unico' ? 'Jogo único' : 'Ida e volta'}</p>
                      <p><span className="text-gray-400">3º lugar:</span> {disputaTerceiro === 'nao' ? 'Não' : disputaTerceiro === 'jogo_unico' ? 'Jogo único' : 'Ida e volta'}</p>
                      <p><span className="text-gray-400">Empate:</span> {empateDecisao === 'prorrogacao' ? 'Prorrogação' : 'Pênaltis'}</p>
                    </div>
                  </div>
                )}

                {registrarCartoes && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="font-bold text-gray-700 mb-1.5">Cartões</p>
                    <div className="space-y-1 text-gray-600">
                      <p><span className="text-gray-400">Registrados:</span> Sim</p>
                      <p><span className="text-gray-400">Tipos:</span> {cartoesAmarelos ? 'Amarelo ' : ''}{cartoesVermelhos ? 'Vermelho ' : ''}{cartoesAzuis ? 'Azul' : ''}</p>
                      {cartoesAmarelos && <p><span className="text-gray-400">Acúmulo amarelos:</span> {acumulacaoCartoesAmarelos === 0 ? 'Não' : acumulacaoCartoesAmarelos}</p>}
                      {cartoesAzuis && <p><span className="text-gray-400">Acúmulo azuis:</span> {acumulacaoCartoesAzuis === 0 ? 'Não' : acumulacaoCartoesAzuis}</p>}
                      {mostrarOpcaoResetCartoes && <p><span className="text-gray-400">Reset na eliminatória:</span> {resetCartoesParaEliminatorias ? 'Sim' : 'Não'}</p>}
                      {cartoesVermelhos && <p><span className="text-gray-400">Efeito vermelho:</span> {efeitoCartaoVermelho === 'expulsao' ? 'Expulsão' : efeitoCartaoVermelho === 'suspensao' ? 'Suspensão' : 'Substituição'}</p>}
                      {cartoesAzuis && <p><span className="text-gray-400">Duração azul:</span> {tempoCartaoAzul} min</p>}
                      {cartoesAzuis && <p><span className="text-gray-400">2 azuis expulsão:</span> {expulsaoDoisCartoesAzuis ? 'Sim' : 'Não'}</p>}
                    </div>
                  </div>
                )}

                <div className="bg-sky-50 border border-sky-200 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sky-700 mb-1">Total de Jogos</p>
                      <div className="space-y-0.5 text-xs text-sky-600">
                        {jogosPorFase.grupos > 0 && <p>{jogosPorFase.grupos} de grupos</p>}
                        {jogosPorFase.liga > 0 && <p>{jogosPorFase.liga} de liga</p>}
                        {jogosPorFase.mm > 0 && <p>{jogosPorFase.mm} de mata-mata</p>}
                        {tempoPartida > 0 && <p className="text-sky-500 pt-0.5">≈ {totalJogos * tempoPartida} min no total</p>}
                      </div>
                    </div>
                    <span className="text-4xl font-black text-sky-600">{totalJogos}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-4 border-t border-gray-100">
              <button
                onClick={() => setShowModalConfirmar(false)}
                className="flex-1 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={() => { setShowModalConfirmar(false); confirmarRegras(); }}
                disabled={salvando}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold text-sm hover:from-emerald-600 hover:to-teal-700 transition-colors disabled:opacity-50"
              >
                {salvando ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
