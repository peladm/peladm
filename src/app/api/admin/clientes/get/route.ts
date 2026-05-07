import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const hashSenha = (senha: string): string => {
  return createHash('sha256').update(senha).digest('hex');
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pelada_id, username, senha_hash, clienteId } = body;

    if (!pelada_id || !username || !senha_hash) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    }

    // Verifica se é admin/master
    const { data: admin, error: adminError } = await supabaseAdmin
      .from('clientes')
      .select('pelada_id, username, senha, is_master, status')
      .eq('pelada_id', pelada_id)
      .eq('username', username)
      .single();

    if (adminError || !admin) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 401 });
    }

    if (admin.status !== 'ativo') {
      return NextResponse.json({ error: 'Usuário inativo' }, { status: 403 });
    }

    const senhaCorreta = hashSenha(String(admin.senha || '')) === senha_hash;
    if (!senhaCorreta) {
      return NextResponse.json({ error: 'Senha inválida' }, { status: 401 });
    }

    if (admin.is_master !== true) {
      return NextResponse.json({ error: 'Acesso restrito ao master' }, { status: 403 });
    }

    // Se chegou aqui, é admin. Busca o cliente específico
    if (!clienteId) {
      return NextResponse.json({ error: 'ID do cliente não fornecido' }, { status: 400 });
    }

    const { data: cliente, error: clienteError } = await supabaseAdmin
      .from('clientes')
      .select('*')
      .eq('pelada_id', clienteId)
      .single();

    if (clienteError || !cliente) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ cliente });
  } catch (error) {
    console.error('Erro na API:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
