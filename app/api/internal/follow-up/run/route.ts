// ============================================================================
// Endpoint interno: dispara o job de follow-up automático
//
// GET  /api/internal/follow-up/run   — chamado pelo Vercel Cron
//   Header: Authorization: Bearer <CRON_SECRET>
//
// POST /api/internal/follow-up/run   — chamado manualmente
//   Header: x-internal-key: <INTERNAL_API_KEY>
//   Body (opcional): { "storeId": "...", "limit": 20 }
//
// GET params: ?storeId=<id>&limit=<n>
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { runFollowUpJob } from "@/lib/follow-up";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

function safeEqual(a: string, b: string): boolean {
  try {
    const ha = createHash("sha256").update(a).digest();
    const hb = createHash("sha256").update(b).digest();
    return timingSafeEqual(ha, hb);
  } catch {
    return false;
  }
}

function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return false;
  return safeEqual(auth.slice(7), secret);
}

function isInternalAuthorized(req: NextRequest): boolean {
  const expected = process.env.INTERNAL_API_KEY;
  if (!expected) return false;
  const provided = req.headers.get("x-internal-key") ?? "";
  return safeEqual(provided, expected);
}

// ---------------------------------------------------------------------------
// GET — Vercel Cron
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    console.warn(JSON.stringify({ event: "followup_unauthorized", method: "GET" }));
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const opts: { storeId?: string; limit?: number } = {};
  const storeId = url.searchParams.get("storeId");
  const limitStr = url.searchParams.get("limit");
  if (storeId) opts.storeId = storeId;
  if (limitStr) opts.limit = parseInt(limitStr, 10);

  return runJob(opts);
}

// ---------------------------------------------------------------------------
// POST — manual / webhook externo
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  if (!isInternalAuthorized(req)) {
    console.warn(JSON.stringify({ event: "followup_unauthorized", method: "POST" }));
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { storeId?: string; limit?: number } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    // body vazio ou inválido — usa defaults
  }

  const opts: { storeId?: string; limit?: number } = {};
  if (body.storeId) opts.storeId = body.storeId;
  if (body.limit != null) opts.limit = body.limit;

  return runJob(opts);
}

// ---------------------------------------------------------------------------
// Shared runner
// ---------------------------------------------------------------------------

async function runJob(opts: { storeId?: string; limit?: number }) {
  const start = Date.now();
  try {
    const result = await runFollowUpJob(opts);
    console.log(
      JSON.stringify({ event: "followup_run", latency_ms: Date.now() - start, ...result })
    );
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "followup_run_error",
        latency_ms: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      })
    );
    return NextResponse.json({ ok: false, error: "job_failed" }, { status: 500 });
  }
}
