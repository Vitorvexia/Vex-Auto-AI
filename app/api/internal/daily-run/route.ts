// ============================================================================
// Endpoint interno: orquestrador diário — follow-up + reactivation + retry
//
// Chamado pelo Vercel Cron (plano Hobby: máx 1 execução/dia).
// Também pode ser chamado manualmente via POST.
//
// GET  /api/internal/daily-run
//   Header: Authorization: Bearer <CRON_SECRET>   (Vercel Cron — validado se CRON_SECRET configurado)
//   Header: x-internal-key: <INTERNAL_API_KEY>    (manual / fallback)
//   Fallback: se CRON_SECRET ausente, qualquer Bearer é aceito (Vercel envia token inconfirmável)
//
// POST /api/internal/daily-run
//   Header: x-internal-key: <INTERNAL_API_KEY>
//   Body (opcional): { "limit": 20 }
//
// Itera todas as stores com active=true sequencialmente.
// Falha em uma store não bloqueia as demais (try/catch por store).
// runRetryFailedJob roda 1x global (não por store — D4).
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { runFollowUpJob } from "@/lib/follow-up";
import { runReactivationJob } from "@/lib/reactivation";
import { runRetryFailedJob } from "@/lib/retry-failed";
import { supabaseAdmin } from "@/lib/supabase";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";

function verifyKey(provided: string, expected: string): boolean {
  try {
    const a = createHash("sha256").update(provided).digest();
    const b = createHash("sha256").update(expected).digest();
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function isAuthorized(req: NextRequest): boolean {
  const internalKey = process.env.INTERNAL_API_KEY;
  if (internalKey) {
    const provided = req.headers.get("x-internal-key") ?? "";
    if (verifyKey(provided, internalKey)) return true;
  }

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth.startsWith("Bearer ") && verifyKey(auth.slice(7), cronSecret)) return true;
    return false;
  }

  // CRON_SECRET ausente: Vercel Cron envia Bearer que não podemos validar — aceita GET com Bearer presente.
  // POST continua exigindo x-internal-key.
  if (req.method === "GET") {
    const auth = req.headers.get("authorization") ?? "";
    return auth.startsWith("Bearer ");
  }

  return false;
}

type StoreResult = {
  store_id: string;
  store_nome: string;
  follow_up: unknown;
  reactivation: unknown;
  error?: string;
};

async function executeDailyRun(limit?: number): Promise<NextResponse> {
  const startMs = Date.now();

  const { data: stores, error: storesError } = await supabaseAdmin
    .from("stores")
    .select("id, nome")
    .eq("active", true);

  if (storesError) {
    console.error(JSON.stringify({
      level: "error",
      event: "daily_run_stores_fetch_failed",
      error: storesError.message,
      ts: new Date().toISOString(),
    }));
    Sentry.captureException(storesError, { tags: { job: "daily_run_stores_fetch" } });
    return NextResponse.json({ error: "stores_fetch_failed" }, { status: 500 });
  }

  const activeStores = (stores ?? []) as { id: string; nome: string }[];
  const storeResults: StoreResult[] = [];

  // Itera sequencialmente por design (não paralelo).
  // Risco de escala: Vercel Hobby tem limite de 10s por serverless function.
  // Com N stores × 2 jobs sequenciais, risco real a partir de ~5 stores.
  // Mitigação futura (B2+): batch com limite de stores ou Vercel Pro (60s).
  // Não bloqueia MVP — lojas iniciais < 5.
  for (const store of activeStores) {
    const storeResult: StoreResult = {
      store_id: store.id,
      store_nome: store.nome,
      follow_up: null,
      reactivation: null,
    };

    try {
      storeResult.follow_up = await runFollowUpJob({ storeId: store.id, limit });
      storeResult.reactivation = await runReactivationJob({ storeId: store.id, limit });
    } catch (e) {
      storeResult.error = e instanceof Error ? e.message : String(e);
      console.error(JSON.stringify({
        level: "error",
        event: "daily_run_store_failed",
        store_id: store.id,
        error: storeResult.error,
        ts: new Date().toISOString(),
      }));
      Sentry.captureException(e, { tags: { job: "daily_run_store" }, extra: { store_id: store.id } });
    }

    storeResults.push(storeResult);
  }

  // runRetryFailedJob roda 1x global (não por store — D4).
  // Pulado se não há stores ativas.
  // Risco futuro: mensagens órfãs (store_id nulo ou store deletada) nunca
  // recebem retry nesse modelo. Reavaliar quando houver offboarding de lojas.
  let retryResult: unknown = null;
  if (activeStores.length > 0) {
    try {
      retryResult = await runRetryFailedJob({ limit });
    } catch (e) {
      retryResult = { error: e instanceof Error ? e.message : String(e) };
      Sentry.captureException(e, { tags: { job: "daily_run_retry_failed" } });
    }
  }

  const response = {
    ok: true,
    stores: storeResults,
    retry_failed: retryResult,
    latency_ms: Date.now() - startMs,
  };

  console.log(JSON.stringify({
    level: "info",
    event: "daily_run_complete",
    store_count: activeStores.length,
    latency_ms: response.latency_ms,
    ts: new Date().toISOString(),
  }));

  return NextResponse.json(response);
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    console.warn(JSON.stringify({
      level: "warn",
      event: "daily_run_unauthorized",
      method: "GET",
      ts: new Date().toISOString(),
    }));
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limitStr = url.searchParams.get("limit");
  const limit = limitStr ? parseInt(limitStr, 10) : undefined;

  return executeDailyRun(limit);
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    console.warn(JSON.stringify({
      level: "warn",
      event: "daily_run_unauthorized",
      method: "POST",
      ts: new Date().toISOString(),
    }));
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let limit: number | undefined;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (typeof body.limit === "number") limit = body.limit;
  } catch {
    // usa defaults
  }

  return executeDailyRun(limit);
}
