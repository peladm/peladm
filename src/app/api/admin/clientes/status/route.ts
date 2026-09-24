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
    const { pelada_id, username, senha_hash, clienteId, novoStatus } = body;

    if (!pelada_id || !username || !senha_hash || !clienteId || !novoStatus) {
      return NextResponse.json({ error: 'Dados obrigatórios ausentes' }, { status: 400 });
    }

    const statusPermitidos = ['ativo', 'bloqueado'];
    if (!statusPermitidos.includes(String(novoStatus).toLowerCase())) {
      return NextResponse.json({ error: 'Status inválido' }, { status: 400 });
    }

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
      return NextResponse.json({ error: 'Usuário sem permissão para alterar status' }, { status: 403 });
    }

    const senhaCorreta = hashSenha(String(admin.senha || '')) === senha_hash;
    if (!senhaCorreta) {
      return NextResponse.json({ error: 'Senha inválida' }, { status: 401 });
    }

    if (admin.is_master !== true) {
      return NextResponse.json({ error: 'Acesso restrito ao master' }, { status: 403 });
    }

    const statusFinal = String(novoStatus).toLowerCase();

    const { data: clienteAtualizado, error: updateError } = await supabaseAdmin
      .from('clientes')
      .update({ status: statusFinal })
      .ilike('pelada_id', String(clienteId))
      .select('pelada_id, status')
      .maybeSingle();

    if (updateError || !clienteAtualizado) {
      return NextResponse.json({ error: 'Falha ao atualizar status do cliente' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      cliente: clienteAtualizado,
      status: statusFinal,
    });
  } catch (error) {
    console.error('Erro ao atualizar status do cliente:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
