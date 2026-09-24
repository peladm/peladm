import { createHash, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

type RateWindow = {
  count: number;
  resetAt: number;
};

type MasterAuthContext = {
  peladaId: string;
  username: string;
};

type MasterAuthOk = {
  ok: true;
  admin: {
    pelada_id: string;
    username: string;
    is_master: boolean;
    status: string;
    senha_raw: string;
  };
};

type MasterAuthFail = {
  ok: false;
  status: number;
  error: string;
};

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX = 60;
const requestWindow = new Map<string, RateWindow>();

const hashSenha = (senha: string): string => {
  return createHash('sha256').update(senha).digest('hex');
};

const safeEquals = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
};

export function sanitizeInput(value: unknown, maxLength = 120): string {
  return String(value ?? '').trim().slice(0, maxLength);
}

const normalizeOrigin = (value: string): string => {
  try {
    const url = new URL(value.trim());
    return url.origin.toLowerCase();
  } catch {
    return '';
  }
};

function buildAllowedOrigins(request: NextRequest): Set<string> {
  const allowed = new Set<string>();

  const host = sanitizeInput(
    request.headers.get('x-forwarded-host') || request.headers.get('host'),
    120
  ).toLowerCase();
  const proto = sanitizeInput(request.headers.get('x-forwarded-proto') || 'https', 10).toLowerCase();

  if (host && (proto === 'http' || proto === 'https')) {
    allowed.add(`${proto}://${host}`);
  }

  const originFromEnv = sanitizeInput(process.env.ADMIN_ALLOWED_ORIGINS, 1000);
  if (originFromEnv) {
    originFromEnv
      .split(',')
      .map((item) => normalizeOrigin(item))
      .filter(Boolean)
      .forEach((item) => allowed.add(item));
  }

  const publicUrl = normalizeOrigin(String(process.env.NEXT_PUBLIC_SITE_URL || ''));
  if (publicUrl) {
    allowed.add(publicUrl);
  }

  const nextAuthUrl = normalizeOrigin(String(process.env.NEXTAUTH_URL || ''));
  if (nextAuthUrl) {
    allowed.add(nextAuthUrl);
  }

  const vercelUrl = sanitizeInput(process.env.VERCEL_URL, 200).toLowerCase();
  if (vercelUrl) {
    allowed.add(`https://${vercelUrl}`);
  }

  return allowed;
}

export function validarOrigemAdmin(request: NextRequest): { ok: true } | { ok: false; status: number; error: string } {
  const allowedOrigins = buildAllowedOrigins(request);
  if (allowedOrigins.size === 0) {
    return { ok: false, status: 403, error: 'Origem não autorizada' };
  }

  const origin = normalizeOrigin(request.headers.get('origin') || '');
  if (origin && allowedOrigins.has(origin)) {
    return { ok: true };
  }

  const refererRaw = sanitizeInput(request.headers.get('referer') || '', 500);
  const refererOrigin = normalizeOrigin(refererRaw);
  if (refererOrigin && allowedOrigins.has(refererOrigin)) {
    return { ok: true };
  }

  return { ok: false, status: 403, error: 'Origem não autorizada' };
}

export function enforceAdminRateLimit(ctx: MasterAuthContext) {
  const now = Date.now();
  const key = `${ctx.peladaId}:${ctx.username}`;
  const current = requestWindow.get(key);

  if (!current || now >= current.resetAt) {
    requestWindow.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { ok: true as const };
  }

  if (current.count >= RATE_LIMIT_MAX) {
    const retryAfterSeconds = Math.ceil((current.resetAt - now) / 1000);
    return {
      ok: false as const,
      status: 429,
      error: 'Muitas requisições administrativas. Tente novamente em instantes.',
      retryAfterSeconds,
    };
  }

  current.count += 1;
  requestWindow.set(key, current);
  return { ok: true as const };
}

export async function validarMaster(
  peladaIdRaw: unknown,
  usernameRaw: unknown,
  senhaHashRaw: unknown
): Promise<MasterAuthOk | MasterAuthFail> {
  const peladaId = sanitizeInput(peladaIdRaw, 40).toUpperCase();
  const username = sanitizeInput(usernameRaw, 60).toLowerCase();
  const senhaHash = sanitizeInput(senhaHashRaw, 140);

  if (!peladaId || !username || !senhaHash) {
    return { ok: false, status: 400, error: 'Dados de autenticação inválidos' };
  }

  const rateLimit = enforceAdminRateLimit({ peladaId, username });
  if (!rateLimit.ok) {
    return { ok: false, status: rateLimit.status, error: rateLimit.error };
  }

  const { data: admin, error: adminError } = await supabaseAdmin
    .from('clientes')
    .select('pelada_id, username, senha, is_master, status')
    .eq('pelada_id', peladaId)
    .eq('username', username)
    .single();

  if (adminError || !admin) {
    return { ok: false, status: 401, error: 'Usuário não encontrado' };
  }

  if (admin.status !== 'ativo') {
    return { ok: false, status: 403, error: 'Usuário inativo' };
  }

  const hashNoBanco = hashSenha(String(admin.senha ?? ''));
  if (!safeEquals(hashNoBanco, senhaHash)) {
    return { ok: false, status: 401, error: 'Senha inválida' };
  }

  if (admin.is_master !== true) {
    return { ok: false, status: 403, error: 'Acesso restrito ao master' };
  }

  return {
    ok: true,
    admin: {
      pelada_id: admin.pelada_id,
      username: admin.username,
      is_master: Boolean(admin.is_master),
      status: String(admin.status),
      senha_raw: String(admin.senha ?? ''),
    },
  };
}

export async function registrarAuditoriaAdmin(input: {
  actorPeladaId: string;
  actorUsername: string;
  acao: string;
  alvoPeladaId?: string;
  sucesso: boolean;
  detalhes?: Record<string, unknown>;
}) {
  try {
    const payload = {
      actor_pelada_id: input.actorPeladaId,
      actor_username: input.actorUsername,
      acao: input.acao,
      alvo_pelada_id: input.alvoPeladaId || null,
      sucesso: input.sucesso,
      detalhes: input.detalhes || null,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabaseAdmin.from('auditoria_admin').insert(payload);
    if (error) {
      console.info('[admin-audit:fallback]', payload);
    }
  } catch (error) {
    console.info('[admin-audit:exception]', {
      actor_pelada_id: input.actorPeladaId,
      actor_username: input.actorUsername,
      acao: input.acao,
      sucesso: input.sucesso,
      error: String(error),
    });
  }
}

const isMissingRelationError = (error: unknown): boolean => {
  const code = String((error as { code?: string } | null)?.code || '');
  const message = String((error as { message?: string } | null)?.message || '');
  return code === '42P01' || /relation .* does not exist/i.test(message);
};

async function deleteByPeladaId(table: string, peladaId: string) {
  const { error } = await supabaseAdmin.from(table).delete().ilike('pelada_id', peladaId);
  if (error && !isMissingRelationError(error)) {
    throw new Error(`[${table}] ${error.message || String(error)}`);
  }
}

async function deleteByIds(table: string, column: string, ids: string[]) {
  if (ids.length === 0) return;

  const { error } = await supabaseAdmin.from(table).delete().in(column, ids);
  if (error && !isMissingRelationError(error)) {
    throw new Error(`[${table}] ${error.message || String(error)}`);
  }
}

async function selectIds(table: string, column: string, filterColumn: string, filterValue: string): Promise<string[]> {
  const query = supabaseAdmin.from(table).select(column);
  const { data, error } = filterColumn === 'pelada_id'
    ? await query.ilike(filterColumn, filterValue)
    : await query.eq(filterColumn, filterValue);
  if (error) {
    if (isMissingRelationError(error)) {
      return [];
    }
    throw new Error(`[${table}] ${error.message || String(error)}`);
  }

  const rows = (data || []) as unknown[];

  return rows
    .map((item) => {
      if (!item || typeof item !== 'object') return '';
      const value = (item as Record<string, unknown>)[column];
      return String(value || '');
    })
    .filter(Boolean);
}

export async function excluirDadosClientePorPeladaId(
  peladaIdRaw: unknown,
  options?: { removerRegistroCliente?: boolean }
) {
  const peladaId = sanitizeInput(peladaIdRaw, 40).toUpperCase();
  if (!peladaId) {
    throw new Error('Pelada ID inválido para exclusão');
  }

  const removerRegistroCliente = options?.removerRegistroCliente !== false;

  try {
    const sessaoIds = await selectIds('sessoes', 'id', 'pelada_id', peladaId);
    const jogoIds = sessaoIds.length > 0
      ? await (async () => {
          const { data, error } = await supabaseAdmin.from('jogos').select('id').in('sessao_id', sessaoIds);
          if (error) {
            if (isMissingRelationError(error)) {
              return [];
            }
            throw new Error(`[jogos] ${error.message || String(error)}`);
          }

          return (data || []).map((item) => String(item.id || '')).filter(Boolean);
        })()
      : [];

    await deleteByIds('gols', 'jogo_id', jogoIds);
    await deleteByIds('jogos', 'sessao_id', sessaoIds);

    await deleteByPeladaId('regras', peladaId);
    await deleteByPeladaId('jogadores', peladaId);
    await deleteByPeladaId('sessoes', peladaId);

    if (removerRegistroCliente) {
      const { data: clienteRemovido, error } = await supabaseAdmin
        .from('clientes')
        .delete()
        .ilike('pelada_id', peladaId)
        .neq('is_master', true)
        .select('pelada_id')
        .maybeSingle();

      if (error) {
        throw new Error(`[clientes] ${error.message || String(error)}`);
      }

      if (!clienteRemovido) {
        throw new Error('[clientes] nenhum registro removido');
      }
    }

    return {
      peladaId,
      sessoesRemovidas: sessaoIds.length,
      jogosRemovidos: jogoIds.length,
      registroClienteRemovido: removerRegistroCliente,
    };
  } catch (error) {
    throw new Error(`Falha ao excluir dados do cliente ${peladaId}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function sincronizarStatusClientePorVencimento<T extends {
  pelada_id?: string;
  status?: string;
  data_vencimento?: string | null;
  is_master?: boolean | null;
}>(cliente: T): Promise<T> {
  const statusAtual = String(cliente.status || 'ativo').toLowerCase();
  if (cliente.is_master === true || statusAtual === 'excluido') {
    return cliente;
  }

  const dataVencimento = cliente.data_vencimento ? new Date(`${cliente.data_vencimento}T00:00:00`) : null;
  if (!dataVencimento) {
    return cliente;
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  dataVencimento.setHours(0, 0, 0, 0);

  if (dataVencimento < hoje && statusAtual !== 'bloqueado' && cliente.pelada_id) {
    await supabaseAdmin
      .from('clientes')
      .update({ status: 'bloqueado' })
      .eq('pelada_id', String(cliente.pelada_id).toUpperCase());

    return {
      ...cliente,
      status: 'bloqueado',
    };
  }

  return cliente;
}
