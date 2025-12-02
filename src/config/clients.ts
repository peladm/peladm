// Configuração de clientes e seus respectivos Supabase
export interface ClientConfig {
  id: string;
  name: string;
  email: string;
  supabaseUrl: string;
  supabaseKey: string;
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'inactive' | 'suspended';
  createdAt: string;
}

// Configuração temporária para desenvolvimento
// TODO: Mover para banco de dados em produção
export const clients: Record<string, ClientConfig> = {
  // Cliente de desenvolvimento/teste
  'admin@dev.local': {
    id: 'dev-001',
    name: 'Desenvolvimento Local',
    email: 'admin@dev.local',
    supabaseUrl: 'https://placeholder.supabase.co',
    supabaseKey: 'placeholder-key-will-be-replaced',
    plan: 'free',
    status: 'active',
    createdAt: new Date().toISOString(),
  },
  
  // Exemplo de cliente real (remover em produção)
  'admin@exemplo.com': {
    id: 'client-001', 
    name: 'Pelada FC',
    email: 'admin@exemplo.com',
    supabaseUrl: 'https://exemplo123.supabase.co',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    plan: 'free',
    status: 'active',
    createdAt: '2025-12-01T10:00:00Z',
  }
};

// Função para obter configuração do cliente
export function getClientConfig(email: string): ClientConfig | null {
  return clients[email.toLowerCase()] || null;
}

// Função para adicionar novo cliente (temporária)
export function addClient(config: Omit<ClientConfig, 'id' | 'createdAt'>): ClientConfig {
  const newClient: ClientConfig = {
    ...config,
    id: `client-${Date.now()}`,
    email: config.email.toLowerCase(),
    createdAt: new Date().toISOString(),
  };
  
  clients[newClient.email] = newClient;
  return newClient;
}

// Função para listar todos os clientes
export function getAllClients(): ClientConfig[] {
  return Object.values(clients);
}