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
      return NextResponse.json({ autorizado: false, error: 'Credenciais inválidas' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from('clientes')
      .select('pelada_id, username, senha, is_master, status')
      .eq('pelada_id', pelada_id)
      .eq('username', username)
      .single();

    if (error || !data) {
      return NextResponse.json({ autorizado: false, error: 'Usuário não encontrado' }, { status: 401 });
    }

    if (data.status !== 'ativo') {
      return NextResponse.json({ autorizado: false, error: 'Usuário inativo' }, { status: 403 });
    }

    const senhaCorreta = hashSenha(String(data.senha || '')) === senha_hash;
    if (!senhaCorreta) {
      return NextResponse.json({ autorizado: false, error: 'Senha inválida' }, { status: 401 });
    }

    if (data.is_master !== true) {
      return NextResponse.json({ autorizado: false, error: 'Acesso restrito ao master' }, { status: 403 });
    }

    return NextResponse.json({ autorizado: true });
  } catch {
    return NextResponse.json({ autorizado: false, error: 'Erro interno' }, { status: 500 });
  }
}
