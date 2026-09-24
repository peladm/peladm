'use client';

import React from 'react';

type Filtro = 'atual' | 'mes' | 'ultimas' | 'ano' | 'historia';

interface Props {
  filtro: Filtro;
  setFiltro: (filtro: Filtro) => void;
  dataSelecionada: string;
  setDataSelecionada: (value: string) => void;
  periodoSelecionado: string;
  setPeriodoSelecionado: (value: string) => void;
  quantidadePeladas: string;
  setQuantidadePeladas: (value: string) => void;
  apenasAtivos: boolean;
  setApenasAtivos: (value: boolean) => void;
  datasDisponiveis: string[];
  mesesDisponiveis: string[];
  anosDisponiveis: string[];
}

export default function StatsFilterPanel({
  filtro,
  setFiltro,
  dataSelecionada,
  setDataSelecionada,
  periodoSelecionado,
  setPeriodoSelecionado,
  quantidadePeladas,
  setQuantidadePeladas,
  apenasAtivos,
  setApenasAtivos,
  datasDisponiveis,
  mesesDisponiveis,
  anosDisponiveis,
}: Props) {
  const handleFiltroChange = (novoFiltro: Filtro) => {
    setFiltro(novoFiltro);
    setDataSelecionada('');
    setPeriodoSelecionado('');
    if (novoFiltro === 'ultimas') {
      setQuantidadePeladas('5');
    }
  };

  return (
    <section className="bg-white rounded-xl shadow-md p-4 mb-4 border border-gray-300">
      <div className="mb-3 flex justify-center">
        <label className="inline-flex items-center justify-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={apenasAtivos}
            onChange={(event) => setApenasAtivos(event.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          Apenas jogadores ativos
        </label>
      </div>

      <div className="mb-3">
        <button
          onClick={() => handleFiltroChange('atual')}
          className={`w-full py-2 px-3 rounded-lg text-sm font-semibold transition-colors ${filtro === 'atual' ? 'bg-green-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'}`}
        >
          ⚡ Atual (Pelada mais recente)
        </button>
      </div>

      <div className="mb-3 grid grid-cols-4 gap-2">
        {(['mes', 'ultimas', 'ano', 'historia'] as const).map((opcao) => (
          <button
            key={opcao}
            onClick={() => handleFiltroChange(opcao)}
            className={`py-2 px-2 rounded-lg text-xs font-semibold transition-colors ${filtro === opcao ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'}`}
          >
            {opcao === 'mes' ? 'Mês' : opcao === 'ultimas' ? 'Últimas' : opcao === 'ano' ? 'Ano' : 'História'}
          </button>
        ))}
      </div>

      <div>
        {filtro === 'atual' && (
          <select
            value={dataSelecionada}
            onChange={(event) => setDataSelecionada(event.target.value)}
            className="w-full py-2 px-3 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="">🔍 Selecionar pelada específica</option>
            {datasDisponiveis.map((data) => (
              <option key={data} value={data}>{data}</option>
            ))}
          </select>
        )}

        {filtro === 'mes' && (
          <select
            value={periodoSelecionado}
            onChange={(event) => setPeriodoSelecionado(event.target.value)}
            className="w-full py-2 px-3 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">📅 Selecionar mês específico</option>
            {mesesDisponiveis.map((mes) => (
              <option key={mes} value={mes}>{mes}</option>
            ))}
          </select>
        )}

        {filtro === 'ultimas' && (
          <select
            value={quantidadePeladas}
            onChange={(event) => setQuantidadePeladas(event.target.value)}
            className="w-full py-2 px-3 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="5">📊 Últimas 5 peladas</option>
            <option value="10">📊 Últimas 10 peladas</option>
            <option value="15">📊 Últimas 15 peladas</option>
            <option value="20">📊 Últimas 20 peladas</option>
          </select>
        )}

        {filtro === 'ano' && (
          <select
            value={periodoSelecionado}
            onChange={(event) => setPeriodoSelecionado(event.target.value)}
            className="w-full py-2 px-3 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">📅 Selecionar ano específico</option>
            {anosDisponiveis.map((ano) => (
              <React.Fragment key={ano}>
                <option value={ano}>{ano}</option>
                <option value={`${ano}-q1`}>{ano} - 1º trimestre</option>
                <option value={`${ano}-q2`}>{ano} - 2º trimestre</option>
                <option value={`${ano}-q3`}>{ano} - 3º trimestre</option>
                <option value={`${ano}-q4`}>{ano} - 4º trimestre</option>
                <option value={`${ano}-s1`}>{ano} - 1º semestre</option>
                <option value={`${ano}-s2`}>{ano} - 2º semestre</option>
              </React.Fragment>
            ))}
          </select>
        )}

        {filtro === 'historia' && (
          <select
            value={dataSelecionada}
            onChange={(event) => setDataSelecionada(event.target.value)}
            className="w-full py-2 px-3 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">🔍 Selecionar pelada específica</option>
            {datasDisponiveis.map((data) => (
              <option key={data} value={data}>{data}</option>
            ))}
          </select>
        )}
      </div>
    </section>
  );
}
