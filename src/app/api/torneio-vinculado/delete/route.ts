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
    const { peladaId, slug, colocacaoCol, premiacoesCol, senha } = body;

    if (!peladaId || !slug || !colocacaoCol || !premiacoesCol || !senha) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 });
    }

    const { data: cliente, error: clienteError } = await supabaseAdmin
      .from('clientes')
      .select('pelada_id, senha, status')
      .eq('pelada_id', peladaId.toUpperCase())
      .single();

    if (clienteError || !cliente) {
      return NextResponse.json({ error: 'Senha inválida ou usuário não encontrado.' }, { status: 401 });
    }

    if (cliente.senha !== senha) {
      return NextResponse.json({ error: 'Senha inválida.' }, { status: 401 });
    }

    if (cliente.status === 'bloqueado' || cliente.status === 'inativo') {
      return NextResponse.json({ error: 'Conta bloqueada ou inativa.' }, { status: 403 });
    }

    let rows: any[] = [];
    try {
      const { data, error } = await supabaseAdmin
        .from('jogadores')
        .select(`${colocacaoCol}, ${premiacoesCol}`)
        .eq('pelada_id', peladaId)
        .limit(1000);

      if (error) {
        // Coluna pode não existir; nesse caso, não há conteúdo a impedir a remoção.
        rows = [];
      } else {
        rows = data || [];
      }
    } catch {
      rows = [];
    }

    const contemConteudo = rows.some((row) => {
      const valorColocacao = row?.[colocacaoCol];
      const valorPremiacoes = row?.[premiacoesCol];
      return [valorColocacao, valorPremiacoes].some((valor) => valor !== null && valor !== undefined && String(valor).trim() !== '');
    });

    if (contemConteudo) {
      return NextResponse.json({ error: 'Existem torneios desse tipo encerrados. Não é possível excluir, contate o administrador.' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro no endpoint de remoção de torneio vinculado:', error);
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 });
  }
}
