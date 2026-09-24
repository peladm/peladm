import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pelada_id } = body;

    if (!pelada_id) {
      return NextResponse.json({ error: 'Código da pelada obrigatório' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('clientes')
      .select('pelada_id, status, nome, acesso_pelada_tradicional, acesso_modo_torneio, data_vencimento, is_master')
      .eq('pelada_id', String(pelada_id).toUpperCase())
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'Erro ao consultar status' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    let status = String(data.status || 'inativo').toLowerCase();

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataVencimento = data.data_vencimento ? new Date(`${data.data_vencimento}T00:00:00`) : null;
    if (dataVencimento) dataVencimento.setHours(0, 0, 0, 0);
    const vencido = !!dataVencimento && dataVencimento < hoje;

    if (vencido && data.is_master !== true && status !== 'bloqueado') {
      await supabaseAdmin
        .from('clientes')
        .update({ status: 'bloqueado' })
        .eq('pelada_id', String(pelada_id).toUpperCase());

      status = 'bloqueado';
    }
    const acessoPeladaTradicional = data.acesso_pelada_tradicional ?? true;
    const acessoModoTorneio = data.acesso_modo_torneio ?? false;

    return NextResponse.json({
      pelada_id: data.pelada_id,
      nome: data.nome,
      status: status === 'excluido' ? 'bloqueado' : status,
      ativo: status === 'ativo',
      bloqueado: status === 'bloqueado' || status === 'excluido',
      inativo: status === 'inativo',
      acesso_pelada_tradicional: acessoPeladaTradicional,
      acesso_modo_torneio: acessoModoTorneio,
    });
  } catch {
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}
