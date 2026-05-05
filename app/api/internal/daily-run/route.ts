// ============================================================================
// Endpoint interno: orquestrador diário — follow-up + reactivation + retry
//
// Chamado pelo Vercel Cron (plano Hobby: máx 1 execução/dia).
// Também pode ser chamado manualmente via POST.
//
// POST /api/internal/daily-run
// Header: x-internal-key: <INTERNAL_API_KEY>
// Body (opcional): { "limit": 20 }
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

type StoreResult = {
  store_id: string;
  store_nome: string;
  follow_up: unknown;
  reactivation: unknown;
  error?: string;
};

export async function POST(req: NextRequest) {
  const startMs = Date.now();

  const expectedKey = process.env.INTERNAL_API_KEY;
  const providedKey = req.headers.get("x-internal-key") ?? "";

  if (!expectedKey || !verifyKey(providedKey, expectedKey)) {
    console.warn(JSON.stringify({
      level: "warn",
      event: "daily_run_unauthorized",
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

  // Busca stores ativas
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
