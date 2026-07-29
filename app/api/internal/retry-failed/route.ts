// ============================================================================
// Endpoint interno: retenta mensagens com status ok_send_failed
//
// Chamada manual ou por cron externo (ex: GitHub Actions scheduled).
// Protegido por INTERNAL_API_KEY — nunca expor sem autenticação.
//
// POST /api/internal/retry-failed
// Header: x-internal-key: <INTERNAL_API_KEY>
// Body (opcional): { "window_hours": 24, "limit": 50 }
//
// Segurança:
//   - comparação de chave com timingSafeEqual (resistente a timing attack)
//   - claim atômico antes do envio — previne double-send em chamadas concorrentes
//   - audit log estruturado sem PII
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { runRetryFailedJob } from "@/lib/retry-failed";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";

function verifyApiKey(provided: string, expected: string): boolean {
  try {
    const a = createHash("sha256").update(provided).digest();
    const b = createHash("sha256").update(expected).digest();
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const expectedKey = process.env.INTERNAL_API_KEY;
  const providedKey = req.headers.get("x-internal-key") ?? "";

  if (!expectedKey || !verifyApiKey(providedKey, expectedKey)) {
    console.warn(JSON.stringify({
      level: "warn",
      event: "retry_failed_unauthorized",
      ts: new Date().toISOString(),
    }));
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let windowHours: number | undefined;
  let limit: number | undefined;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (typeof body.window_hours === "number") windowHours = body.window_hours;
    if (typeof body.limit === "number") limit = body.limit;
  } catch {
    // usa defaults
  }

  try {
    const result = await runRetryFailedJob({ windowHours, limit });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "internal_error";
    const status = msg === "query_failed" || msg === "claim_failed" ? 500 : 500;
    Sentry.captureException(e, { tags: { job: "retry_failed_run" } });
    return NextResponse.json({ error: msg }, { status });
  }
}
