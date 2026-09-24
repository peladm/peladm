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
      .select('pelada_id, nome, status, data_vencimento, is_master')
      .eq('pelada_id', pelada_id.toUpperCase())
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'Erro ao conectar ao banco' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Código inválido' }, { status: 404 });
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
        .eq('pelada_id', pelada_id.toUpperCase());

      return NextResponse.json({ error: 'bloqueado' }, { status: 403 });
    }

    if (data.status === 'bloqueado' || data.status === 'excluido') {
      return NextResponse.json({ error: 'bloqueado' }, { status: 403 });
    }

    if (data.status === 'inativo') {
      return NextResponse.json({ error: 'inativo' }, { status: 403 });
    }

    // Atualizar last_access com a data/hora atual
    await supabaseAdmin
      .from('clientes')
      .update({ last_access: new Date().toISOString() })
      .eq('pelada_id', pelada_id.toUpperCase());

    return NextResponse.json({
      pelada_id: data.pelada_id,
      nome: data.nome,
    });

  } catch {
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}
