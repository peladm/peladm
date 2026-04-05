'use client';

import { useEffect, useMemo, useState } from 'react';

type DumpData = Record<string, string | null>;

const CHAVES_FIXAS = [
  'credenciais',
  'user',
  'sessao_ativa',
  'fila_ativa',
  'partida_em_andamento',
  'modo_partida_estado',
  'modo_prancheta_ativo',
  'fila_sincronizacao'
];

function coletarDump(): DumpData {
  if (typeof window === 'undefined') return {};

  const dump: DumpData = {};
  const visitadas = new Set<string>();

  CHAVES_FIXAS.forEach((chave) => {
    dump[chave] = localStorage.getItem(chave);
    visitadas.add(chave);
  });

  for (let indice = 0; indice < localStorage.length; indice += 1) {
    const chave = localStorage.key(indice);
    if (!chave || visitadas.has(chave)) continue;

    if (
      chave.startsWith('jogadores_') ||
      chave.startsWith('regras_') ||
      chave.startsWith('jogos_') ||
      chave.startsWith('gols_') ||
      chave.startsWith('assistencias_') ||
      chave.startsWith('fila_') ||
      chave.startsWith('sessao_ativa_')
    ) {
      dump[chave] = localStorage.getItem(chave);
    }
  }

  return dump;
}

function parseDumpInput(input: string): { dump: DumpData | null; error: string | null } {
  try {
    const textoNormalizado = input
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '');

    if (!textoNormalizado) {
      return { dump: null, error: 'Cole o JSON antes de importar.' };
    }

    const primeiro = textoNormalizado.indexOf('{');
    const ultimo = textoNormalizado.lastIndexOf('}');

    if (primeiro === -1 || ultimo === -1 || ultimo < primeiro) {
      return { dump: null, error: 'Nao encontrei um objeto JSON valido no texto colado.' };
    }

    const objetoBruto = textoNormalizado.slice(primeiro, ultimo + 1);
    const dump = JSON.parse(objetoBruto) as DumpData;
    return { dump, error: null };
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Erro desconhecido ao interpretar o JSON.';
    return { dump: null, error: mensagem };
  }
}

export default function ResgatePage() {
  const [jsonDump, setJsonDump] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [origem, setOrigem] = useState('');

  const resumo = useMemo(() => {
    if (!jsonDump) return [] as string[];

    const { dump } = parseDumpInput(jsonDump);
    if (!dump) {
      return [] as string[];

    }

    return Object.entries(dump)
      .filter(([, valor]) => valor)
      .map(([chave]) => chave)
      .sort();
  }, [jsonDump]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setOrigem(window.location.origin);

    try {
      const dumpAtual = coletarDump();
      setJsonDump(JSON.stringify(dumpAtual, null, 2));
    } catch {
      setErro('Nao foi possivel ler os dados locais deste app.');
    }
  }, []);

  const atualizarDump = () => {
    setErro('');
    setMensagem('');

    try {
      const dumpAtual = coletarDump();
      setJsonDump(JSON.stringify(dumpAtual, null, 2));
      setMensagem('Estado local atualizado com sucesso.');
    } catch {
      setErro('Falha ao atualizar a leitura do armazenamento local.');
    }
  };

  const copiarDump = async () => {
    setErro('');
    setMensagem('');

    try {
      await navigator.clipboard.writeText(jsonDump);
      setMensagem('JSON copiado. Cole em um bloco de notas ou no outro dominio.');
    } catch {
      setMensagem('Nao foi possivel copiar automaticamente. Selecione o texto e copie manualmente.');
    }
  };

  const importarDump = () => {
    setErro('');
    setMensagem('');

    const { dump, error } = parseDumpInput(jsonDump);

    if (!dump) {
      setErro(error || 'O JSON esta invalido. Corrija antes de importar.');
      return;
    }

    try {
      Object.entries(dump).forEach(([chave, valor]) => {
        if (valor === null) {
          localStorage.removeItem(chave);
          return;
        }

        localStorage.setItem(chave, valor);
      });

      setMensagem('Dados importados neste dominio. Recarregue a pagina principal e confira a pelada ativa.');
    } catch {
      setErro('O JSON foi lido, mas houve falha ao gravar os dados locais neste aparelho.');
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-green-50 px-4 py-6">
      <div className="mx-auto max-w-3xl rounded-3xl border border-amber-200 bg-white p-5 shadow-xl sm:p-8">
        <div className="mb-6">
          <div className="mb-3 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
            Resgate local
          </div>
          <h1 className="text-2xl font-black text-gray-900 sm:text-3xl">Transferir pelada ativa entre app e dominio</h1>
          <p className="mt-2 text-sm text-gray-600 sm:text-base">
            Esta tela le e grava o armazenamento local do celular. Use aqui para copiar o estado do PWA e colar no dominio correto, ou vice-versa.
          </p>
        </div>

        <div className="mb-6 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <p><strong>Origem atual:</strong> {origem || 'carregando...'}</p>
          <p className="mt-2"><strong>Fluxo seguro:</strong> abra esta mesma rota na origem que tem a pelada, copie o JSON, depois abra a mesma rota na outra origem e importe o mesmo JSON.</p>
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={atualizarDump}
            className="rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            Atualizar leitura local
          </button>
          <button
            onClick={copiarDump}
            className="rounded-2xl bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
          >
            Copiar JSON
          </button>
          <button
            onClick={importarDump}
            className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-600"
          >
            Importar neste dominio
          </button>
        </div>

        {mensagem && (
          <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {mensagem}
          </div>
        )}

        {erro && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {erro}
          </div>
        )}

        <label className="mb-2 block text-sm font-semibold text-gray-800">JSON de resgate</label>
        <textarea
          value={jsonDump}
          onChange={(event) => setJsonDump(event.target.value)}
          className="min-h-[320px] w-full rounded-2xl border border-gray-300 bg-gray-950 p-4 font-mono text-xs text-green-200 outline-none ring-0 placeholder:text-gray-500 focus:border-green-500"
          spellCheck={false}
        />

        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700">Chaves detectadas</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {resumo.length > 0 ? resumo.map((chave) => (
              <span key={chave} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                {chave}
              </span>
            )) : (
              <span className="text-sm text-gray-500">Nenhuma chave local encontrada nesta origem.</span>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}