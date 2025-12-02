// Configuração de clientes e seus respectivos Supabase
export interface ClientConfig {
  id: string;
  name: string;
  email: string;
  supabaseUrl: string;
  supabaseKey: string;
  responsible_name: string;
  phone: string;
  pelada_name: string;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: string;
}

// Configuração temporária para desenvolvimento
// TODO: Mover para banco de dados em produção
export const clients: Record<string, ClientConfig> = {
  // Cliente de desenvolvimento/teste com credenciais reais
  'admin@dev.local': {
    id: 'dev-001',
    name: 'Desenvolvimento Local',
    email: 'admin@dev.local',
    supabaseUrl: 'https://ewcswczqvelhlwpbraea.supabase.co',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Y3N3Y3pxdmVsaGx3cGJyYWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzMwODI5NDMsImV4cCI6MjA0ODY1ODk0M30.ehQzuCQaRgPG3poKGqmV_5gYLgoQ3k4ajRCnaHDX5-Q',
    responsible_name: 'Dev Admin',
    phone: '(11) 99999-0001',
    pelada_name: 'Pelada de Desenvolvimento',
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
    responsible_name: 'João Silva',
    phone: '(11) 98888-7777',
    pelada_name: 'Pelada do Fim de Semana',
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