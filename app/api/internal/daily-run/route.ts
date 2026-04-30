// ============================================================================
// Endpoint interno: orquestrador diário — follow-up + reactivation + retry
//
// Chamado pelo Vercel Cron (plano Hobby: máx 1 execução/dia).
// Também pode ser chamado manualmente via POST.
//
// POST /api/internal/daily-run
// Header: x-internal-key: <INTERNAL_API_KEY>
// Body (opcional): { "storeId": "...", "limit": 20 }
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { runFollowUpJob } from "@/lib/follow-up";
import { runReactivationJob } from "@/lib/reactivation";
import { POST as runRetryFailed } from "@/app/api/internal/retry-failed/route";

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

  let storeId: string | undefined;
  let limit: number | undefined;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (typeof body.storeId === "string") storeId = body.storeId;
    if (typeof body.limit === "number") limit = body.limit;
  } catch {
    // usa defaults
  }

  const results: Record<string, unknown> = {};

  // 1. Follow-up
  try {
    results.follow_up = await runFollowUpJob({ storeId, limit });
  } catch (e) {
    results.follow_up = { error: e instanceof Error ? e.message : String(e) };
  }

  // 2. Reactivation
  try {
    results.reactivation = await runReactivationJob({ storeId, limit });
  } catch (e) {
    results.reactivation = { error: e instanceof Error ? e.message : String(e) };
  }

  // 3. Retry WhatsApp send failures — chama POST handler com request sintético
  try {
    const syntheticReq = new NextRequest(
      "http://localhost/api/internal/retry-failed",
      {
        method: "POST",
        headers: { "x-internal-key": expectedKey },
      }
    );
    const retryRes = await runRetryFailed(syntheticReq);
    results.retry_failed = await retryRes.json();
  } catch (e) {
    results.retry_failed = { error: e instanceof Error ? e.message : String(e) };
  }

  console.log(JSON.stringify({
    level: "info",
    event: "daily_run_complete",
    results,
    latency_ms: Date.now() - startMs,
    ts: new Date().toISOString(),
  }));

  return NextResponse.json({ ok: true, results, latency_ms: Date.now() - startMs });
}
