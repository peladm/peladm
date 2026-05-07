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
      .select('pelada_id, nome, plano, status, supabase_url, supabase_anon_key')
      .eq('pelada_id', pelada_id.toUpperCase())
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'Erro ao conectar ao banco' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Código inválido' }, { status: 404 });
    }

    const plano = String(data.plano || '').trim().toLowerCase();
    if (plano !== 'premium') {
      return NextResponse.json({ error: 'somente_premium' }, { status: 403 });
    }

    if (data.status === 'bloqueado') {
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
      plano,
      supabase_url: data.supabase_url,
      supabase_anon_key: data.supabase_anon_key,
    });

  } catch {
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}
