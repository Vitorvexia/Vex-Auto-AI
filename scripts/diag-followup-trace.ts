// Ferramenta de suporte — trace dos gates de elegibilidade de follow-up pra 1 lead.
//
// Reproduz, na mesma ordem de runFollowUpJob (lib/follow-up.ts), cada gate que
// um lead precisa passar antes do insert em follow_up_logs — sem inserir nem
// enviar nada de verdade. Usa a RPC get_followup_eligible_conversations real
// (filtrada pelo store_id do lead) e a função canSendMarketingMessage real.
// Útil pra descobrir em qual gate um lead específico está travado, sem
// reconstruir a investigação do zero (origem: diagnóstico do BL-0040/DL-0021,
// caso 68067c0a — bloqueio por WHATSAPP_TEMPLATE_SEND_ENABLED ausente).
//
// Uso: npx tsx --env-file=.env.local scripts/diag-followup-trace.ts --lead-id <uuid>

import { createClient } from "@supabase/supabase-js";
import { canSendMarketingMessage } from "../lib/messaging-eligibility";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl!, serviceKey!);

// Mesma leitura de env que lib/follow-up.ts faz no topo do módulo.
const TEMPLATE_SEND_ENABLED = process.env.WHATSAPP_TEMPLATE_SEND_ENABLED === "true";
const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const leadId = getArg("--lead-id") ?? "68067c0a-da0a-452a-83c7-1e6bb38fbb53";
  const now = new Date();

  console.log("=== ENV (local .env.local — pode divergir de produção!) ===");
  console.log(`WHATSAPP_TEMPLATE_SEND_ENABLED (raw) = ${JSON.stringify(process.env.WHATSAPP_TEMPLATE_SEND_ENABLED)}`);
  console.log(`TEMPLATE_SEND_ENABLED (computed)     = ${TEMPLATE_SEND_ENABLED}`);
  console.log(`now (server clock deste processo)    = ${now.toISOString()}`);

  console.log("\n=== RPC get_followup_eligible_conversations (filtrado pelo store do lead) ===");
  const { data: leadRow } = await supabase
    .from("leads")
    .select("id, store_id")
    .eq("id", leadId)
    .single();

  const { data: eligible, error: rpcErr } = await supabase.rpc(
    "get_followup_eligible_conversations",
    { p_store_id: leadRow?.store_id ?? null, p_limit: 50 }
  );

  if (rpcErr) {
    console.log("RPC ERROR:", rpcErr.message);
    return;
  }

  const conv = (eligible as Array<Record<string, unknown>> | null)?.find(
    (c) => c.lead_id === leadId
  );

  if (!conv) {
    console.log(`Lead ${leadId} NÃO está no retorno da RPC agora — pare aqui, é outro tipo de bug.`);
    return;
  }

  console.log("Conversa elegível encontrada:");
  console.log(JSON.stringify(conv, null, 2));

  console.log("\n=== TRACE DOS GATES (mesma ordem de lib/follow-up.ts) ===");

  const attemptNumber = (conv.attempt_count as number) + 1;
  console.log(`\n[1] attemptNumber = attempt_count(${conv.attempt_count}) + 1 = ${attemptNumber}`);
  console.log("    (sem switch/lookup separado — cálculo direto, null/0 tratado como tentativa 1)");

  console.log("\n[2] canSendMarketingMessage(...)");
  const eligibility = canSendMarketingMessage(
    { marketing_opt_out: false, last_marketing_sent_at: conv.last_marketing_sent_at as string | null },
    {
      business_hours_start: conv.business_hours_start as string | null,
      business_hours_end: conv.business_hours_end as string | null,
    },
    now
  );
  console.log(`    resultado: ${JSON.stringify(eligibility)}`);
  if (!eligibility.allowed) {
    console.log(`    >>> PARA AQUI. reason=${eligibility.reason}. Nunca chega no insert de follow_up_logs.`);
    return;
  }
  console.log("    passou.");

  console.log("\n[3] withinSessionWindow (last_inbound_at dentro de 24h)");
  const lastInbound = conv.last_inbound_at as string | null;
  const withinSessionWindow =
    !!lastInbound && now.getTime() - new Date(lastInbound).getTime() < SESSION_WINDOW_MS;
  const hoursSinceInbound = lastInbound
    ? (now.getTime() - new Date(lastInbound).getTime()) / (60 * 60 * 1000)
    : null;
  console.log(`    last_inbound_at = ${lastInbound}`);
  console.log(`    horas desde last_inbound_at = ${hoursSinceInbound?.toFixed(1)}`);
  console.log(`    withinSessionWindow = ${withinSessionWindow}`);
  console.log(`    TEMPLATE_SEND_ENABLED = ${TEMPLATE_SEND_ENABLED}`);

  if (!withinSessionWindow && !TEMPLATE_SEND_ENABLED) {
    console.log(
      `    >>> PARA AQUI. reason=template_required_not_enabled. skip silencioso (console.log só), ` +
      `NUNCA chega no insert de follow_up_logs. Isso é só console.log — sem Sentry, sem persistência.`
    );
    return;
  }
  console.log("    passou — chegaria no insert de follow_up_logs (não executado neste diagnóstico).");

  console.log("\n=== Todos os gates passaram — insert em follow_up_logs seria tentado aqui. ===");
  console.log("Este script não insere nem envia. Se chegou até aqui, o bug está depois do insert (não simulado).");
}

main().catch((e) => {
  console.error("EXCEPTION:", e);
  process.exit(1);
});
