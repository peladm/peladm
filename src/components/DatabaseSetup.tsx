'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function DatabaseSetup() {
  const [isCreating, setIsCreating] = useState(false);
  const [status, setStatus] = useState<'idle' | 'creating' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const createTables = async () => {
    setIsCreating(true);
    setStatus('creating');
    setMessage('Criando tabelas...');

    try {
      // SQL para criar todas as tabelas
      const createTablesSQL = `
        -- Habilitar extensões
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

        -- Tabela users
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          phone VARCHAR(20),
          position VARCHAR(50) CHECK (position IN ('goleiro', 'linha')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Tabela clients
        CREATE TABLE IF NOT EXISTS clients (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          supabase_url VARCHAR(500) NOT NULL,
          supabase_anon_key TEXT NOT NULL,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Tabela peladas
        CREATE TABLE IF NOT EXISTS peladas (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name VARCHAR(255) NOT NULL,
          description TEXT,
          max_players INTEGER DEFAULT 20,
          current_players INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Tabela players
        CREATE TABLE IF NOT EXISTS players (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255),
          phone VARCHAR(20),
          skill_level INTEGER DEFAULT 5,
          position VARCHAR(50) CHECK (position IN ('goleiro', 'linha')),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Tabela matches
        CREATE TABLE IF NOT EXISTS matches (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          pelada_id UUID REFERENCES peladas(id) ON DELETE CASCADE,
          date TIMESTAMP WITH TIME ZONE NOT NULL,
          location TEXT,
          status VARCHAR(50) DEFAULT 'agendada',
          team_a_score INTEGER DEFAULT 0,
          team_b_score INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Tabela match_players
        CREATE TABLE IF NOT EXISTS match_players (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
          player_id UUID REFERENCES players(id) ON DELETE CASCADE,
          team VARCHAR(10) NOT NULL CHECK (team IN ('A', 'B')),
          position VARCHAR(50),
          goals INTEGER DEFAULT 0,
          assists INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(match_id, player_id)
        );

        -- Tabela queue
        CREATE TABLE IF NOT EXISTS queue (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          pelada_id UUID REFERENCES peladas(id) ON DELETE CASCADE,
          player_id UUID REFERENCES players(id) ON DELETE CASCADE,
          position_in_queue INTEGER NOT NULL,
          joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          is_confirmed BOOLEAN DEFAULT false,
          UNIQUE(pelada_id, player_id)
        );

        -- Inserir dados exemplo
        INSERT INTO peladas (name, description, max_players) 
        VALUES ('Pelada do Domingo', 'Futebol dominical no campo do bairro', 20)
        ON CONFLICT DO NOTHING;
      `;

      // Executar via RPC (se disponível) ou tentar criar uma por uma
      const { error } = await supabase.rpc('exec_sql', { sql: createTablesSQL });
      
      if (error) {
        throw error;
      }

      setStatus('success');
      setMessage('✅ Banco de dados criado com sucesso! Todas as tabelas foram criadas.');
      
    } catch (error: any) {
      console.error('Erro ao criar tabelas:', error);
      setStatus('error');
      setMessage(`❌ Erro: ${error.message || 'Falha ao criar tabelas'}`);
    } finally {
      setIsCreating(false);
    }
  };

  const checkTables = async () => {
    try {
      // Verificar se tabelas existem tentando fazer select
      const tables = ['users', 'clients', 'peladas', 'players', 'matches', 'match_players', 'queue'];
      const results = [];
      
      for (const table of tables) {
        try {
          const { error } = await supabase.from(table).select('*').limit(1);
          results.push({ table, exists: !error });
        } catch {
          results.push({ table, exists: false });
        }
      }
      
      const existingTables = results.filter(r => r.exists).map(r => r.table);
      const missingTables = results.filter(r => !r.exists).map(r => r.table);
      
      setMessage(`
        📊 Status das tabelas:
        ✅ Existem: ${existingTables.join(', ') || 'Nenhuma'}
        ❌ Faltam: ${missingTables.join(', ') || 'Nenhuma'}
      `);
      
    } catch (error: any) {
      setMessage(`❌ Erro ao verificar tabelas: ${error.message}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        🗄️ Setup do Banco de Dados
      </h2>
      
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-800 mb-2">O que será criado:</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• <strong>users</strong> - Usuários e perfis</li>
            <li>• <strong>clients</strong> - Clientes multi-tenant</li>
            <li>• <strong>peladas</strong> - Grupos de futebol</li>
            <li>• <strong>players</strong> - Jogadores cadastrados</li>
            <li>• <strong>matches</strong> - Partidas realizadas</li>
            <li>• <strong>match_players</strong> - Jogadores por partida</li>
            <li>• <strong>queue</strong> - Fila de espera</li>
          </ul>
        </div>

        <div className="flex gap-3">
          <button
            onClick={checkTables}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            🔍 Verificar Tabelas
          </button>
          
          <button
            onClick={createTables}
            disabled={isCreating}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            {isCreating ? '⏳ Criando...' : '🚀 Criar Tabelas'}
          </button>
        </div>

        {message && (
          <div className={`p-4 rounded-lg border ${
            status === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
            status === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
            'bg-gray-50 border-gray-200 text-gray-800'
          }`}>
            <pre className="whitespace-pre-wrap text-sm">{message}</pre>
          </div>
        )}

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-800 mb-2">⚠️ Alternativa Manual:</h3>
          <p className="text-sm text-yellow-700 mb-2">
            Se o botão não funcionar, você pode executar o SQL manualmente:
          </p>
          <ol className="text-sm text-yellow-700 space-y-1">
            <li>1. Acesse o <a href="https://app.supabase.com" className="underline" target="_blank">Supabase Dashboard</a></li>
            <li>2. Vá em <strong>SQL Editor</strong></li>
            <li>3. Cole o conteúdo do arquivo <code>database-setup.sql</code></li>
            <li>4. Execute o script</li>
          </ol>
        </div>
      </div>
    </div>
  );
}