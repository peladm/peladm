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
    const { pelada_id, username, senha_hash } = body;

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

    // Se chegou aqui, é admin. Busca os clientes
    const { data: clientes, error: clientesError } = await supabaseAdmin
      .from('clientes')
      .select('*')
      .order('nome');

    if (clientesError) {
      console.error('Erro ao carregar clientes:', clientesError);
      return NextResponse.json({ error: 'Erro ao carregar clientes' }, { status: 500 });
    }

    return NextResponse.json({ clientes: clientes || [] });
  } catch (error) {
    console.error('Erro na API:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
