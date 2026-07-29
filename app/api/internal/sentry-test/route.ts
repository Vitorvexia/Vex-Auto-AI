// ============================================================================
// Endpoint interno: força um erro de teste pro Sentry (item 0.4)
//
// Não é feature de produto — ferramenta de validação de deploy/config.
// Protegido por INTERNAL_API_KEY (mesmo padrão de retry-failed) em vez de
// página pública (/sentry-example-page do wizard padrão) — este projeto só
// expõe ferramentas de teste sob /api/internal/*, nunca públicas sem auth.
//
// POST /api/internal/sentry-test
// Header: x-internal-key: <INTERNAL_API_KEY>
// Body (opcional): { "message"?: string }
//
// O erro de teste inclui CPF e telefone FALSOS de propósito — serve pra
// confirmar visualmente no dashboard do Sentry que o scrubbing (beforeSend,
// lib/sentry-scrub.ts) removeu esses padrões antes do evento sair daqui.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
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
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const eventId = Sentry.captureException(
    new Error(
      "[sentry-test] evento de teste — CPF fake 123.456.789-00, telefone fake +5511999998888, nome fake João da Silva"
    ),
    { tags: { source: "sentry_test_endpoint" } }
  );

  // Garante que o evento saia antes da function terminar (serverless).
  await Sentry.flush(2000);

  return NextResponse.json({ ok: true, sentry_event_id: eventId });
}
