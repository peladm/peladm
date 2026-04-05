import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cliente com service_role — roda APENAS no servidor, nunca exposto ao browser
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pelada_id, username, senha } = body;

    if (!pelada_id || !username || !senha) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('clientes')
      .select('pelada_id, username, senha, plano, supabase_url, supabase_anon_key, status, is_master')
      .eq('pelada_id', pelada_id.toUpperCase())
      .eq('username', username)
      .eq('senha', senha)
      .single();

    if (error || !data) {
      // Retorna mensagem genérica para não vazar qual campo está errado
      return NextResponse.json({ error: 'Código, usuário ou senha inválidos' }, { status: 401 });
    }

    if (data.status === 'bloqueado') {
      return NextResponse.json({ error: 'bloqueado', pelada_id: data.pelada_id }, { status: 403 });
    }

    if (data.status === 'inativo') {
      return NextResponse.json({ error: 'inativo' }, { status: 403 });
    }

    // Retorna apenas o necessário — email_supabase e senha_supabase nunca saem do servidor
    return NextResponse.json({
      pelada_id: data.pelada_id,
      username: data.username,
      senha: data.senha,
      plano: (data.plano || 'free').toLowerCase(),
      supabase_url: data.supabase_url,
      supabase_anon_key: data.supabase_anon_key,
      is_master: data.is_master === true,
    });

  } catch {
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}
