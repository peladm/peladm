import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';

// Cliente com service_role — roda APENAS no servidor, nunca exposto ao browser
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const hashSenha = (senha: string): string => createHash('sha256').update(senha).digest('hex');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pelada_id, username, senha } = body;

    if (!pelada_id || !username || !senha) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('clientes')
      .select('pelada_id, username, senha, status, is_master, data_vencimento, acesso_pelada_tradicional, acesso_modo_torneio')
      .eq('pelada_id', pelada_id.toUpperCase())
      .ilike('username', String(username))
      .maybeSingle();

    if (error || !data) {
      // Retorna mensagem genérica para não vazar qual campo está errado
      return NextResponse.json({ error: 'Código, usuário ou senha inválidos' }, { status: 401 });
    }

    const senhaBanco = String(data.senha || '');
    const senhaHashDigitada = hashSenha(String(senha));
    const senhaValida = senhaBanco === String(senha) || senhaBanco === senhaHashDigitada;

    if (!senhaValida) {
      return NextResponse.json({ error: 'Código, usuário ou senha inválidos' }, { status: 401 });
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataVencimento = data.data_vencimento ? new Date(`${data.data_vencimento}T00:00:00`) : null;
    if (dataVencimento) dataVencimento.setHours(0, 0, 0, 0);
    const vencido = !!dataVencimento && dataVencimento < hoje;

    if (vencido && data.is_master !== true && data.status !== 'bloqueado') {
      await supabaseAdmin
        .from('clientes')
        .update({ status: 'bloqueado' })
        .eq('pelada_id', pelada_id.toUpperCase())
        .ilike('username', String(username));

      return NextResponse.json({ error: 'bloqueado', pelada_id: data.pelada_id }, { status: 403 });
    }

    if (data.status === 'bloqueado' || data.status === 'excluido') {
      return NextResponse.json({ error: 'bloqueado', pelada_id: data.pelada_id }, { status: 403 });
    }

    if (data.status === 'inativo') {
      return NextResponse.json({ error: 'inativo' }, { status: 403 });
    }

    // Atualizar last_access com a data/hora atual
    await supabaseAdmin
      .from('clientes')
      .update({ last_access: new Date().toISOString() })
      .eq('pelada_id', pelada_id.toUpperCase())
      .ilike('username', String(username));

    // Retorna apenas o necessário — email_supabase e senha_supabase nunca saem do servidor
    return NextResponse.json({
      pelada_id: data.pelada_id,
      username: data.username,
      senha: data.senha,
      is_master: data.is_master === true,
      acesso_pelada_tradicional: data.acesso_pelada_tradicional ?? true,
      acesso_modo_torneio: data.acesso_modo_torneio ?? false,
    });

  } catch {
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}
