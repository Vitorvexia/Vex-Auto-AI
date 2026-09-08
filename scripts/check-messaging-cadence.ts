// ============================================================================
// Checkpoint de cadência — follow-up + reativação (BL-0040/DL-0021, Camada 2)
//
// Mostra a linha do tempo real de envios business-initiated de 1 lead
// (follow_up_logs + reactivation_logs, ordenados) e sinaliza automaticamente
// as duas violações que essa entrega existe pra prevenir:
//   - gap < 48h entre duas mensagens business-initiated seguidas
//     (trava de frequência, lib/messaging-eligibility.ts)
//   - reativação #1 disparando antes de follow_up_completed_at + 7 dias
//     (âncora sequencial, migration 044)
//
// Não precisa rodar toda hora — pensado pra 1x/semana (ou perto dos marcos
// esperados: ~20h, dia 3, dia 7, dia 14 desde a última mensagem do lead)
// enquanto BL-0040 estiver em validação de Camada 2.
//
// Uso:
//   npx tsx --env-file=.env.local scripts/check-messaging-cadence.ts --lead-id <uuid>
//   npx tsx --env-file=.env.local scripts/check-messaging-cadence.ts --phone +55...
// ============================================================================

import { createClient } from "@supabase/supabase-js";

const FREQUENCY_CAP_HOURS = 48;
const REACTIVATION_ANCHOR_DAYS = 7;

interface Args {
  leadId?: string;
  phone?: string;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const idx = argv.indexOf(flag);
    return idx >= 0 ? argv[idx + 1] : undefined;
  };
  return { leadId: get("--lead-id"), phone: get("--phone") };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.leadId && !args.phone) {
    throw new Error("Passe --lead-id <uuid> ou --phone +55...");
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  let leadId = args.leadId;
  if (!leadId && args.phone) {
    const { data: leads, error } = await supabase
      .from("leads")
      .select("id, nome, store_id, phone_normalized")
      .eq("phone_normalized", args.phone);
    if (error) throw new Error(error.message);
    if (!leads || leads.length === 0) throw new Error(`Nenhum lead com phone_normalized=${args.phone}`);
    if (leads.length > 1) {
      console.log(`⚠ ${leads.length} leads com esse telefone (ver KI-0010) — especifique --lead-id:`);
      for (const l of leads) console.log(`  ${l.id}  store=${l.store_id}  nome=${l.nome}`);
      throw new Error("Ambíguo, use --lead-id.");
    }
    leadId = leads[0].id;
    console.log(`Lead resolvido por telefone: ${leadId} (${leads[0].nome})`);
  }

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id, nome, marketing_opt_out, last_marketing_sent_at, follow_up_completed_at, lead_status")
    .eq("id", leadId)
    .single();
  if (leadError) throw new Error(`lead: ${leadError.message}`);
  console.log("\n=== Lead ===");
  console.log(JSON.stringify(lead, null, 2));

  const { data: followUps, error: fuError } = await supabase
    .from("follow_up_logs")
    .select("attempt_number, status, logged_at, error_message")
    .eq("lead_id", leadId)
    .order("logged_at", { ascending: true });
  if (fuError) throw new Error(`follow_up_logs: ${fuError.message}`);

  const { data: reactivations, error: raError } = await supabase
    .from("reactivation_logs")
    .select("attempt_number, status, logged_at, error_message")
    .eq("lead_id", leadId)
    .order("logged_at", { ascending: true });
  if (raError) throw new Error(`reactivation_logs: ${raError.message}`);

  type Event = { kind: "follow_up" | "reactivation"; attempt: number; status: string; at: string };
  const timeline: Event[] = [
    ...(followUps ?? []).map((f) => ({ kind: "follow_up" as const, attempt: f.attempt_number, status: f.status, at: f.logged_at })),
    ...(reactivations ?? []).map((r) => ({ kind: "reactivation" as const, attempt: r.attempt_number, status: r.status, at: r.logged_at })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  console.log(`\n=== Linha do tempo (${timeline.length} evento(s), só status='sent' conta pra trava de frequência) ===`);

  let lastSentAt: Date | null = null;
  let violations = 0;

  for (const ev of timeline) {
    const at = new Date(ev.at);
    let gapNote = "";
    if (ev.status === "sent") {
      if (lastSentAt) {
        const gapHours = (at.getTime() - lastSentAt.getTime()) / (60 * 60 * 1000);
        gapNote = ` — gap desde o envio anterior: ${gapHours.toFixed(1)}h`;
        if (gapHours < FREQUENCY_CAP_HOURS) {
          gapNote += " ⚠️ VIOLAÇÃO: < 48h (trava de frequência furada)";
          violations++;
        }
      }
      lastSentAt = at;
    }
    console.log(`${ev.at}  [${ev.kind} #${ev.attempt}]  status=${ev.status}${gapNote}`);
  }

  // Checagem da âncora sequencial: 1ª reativação 'sent' vs follow_up_completed_at + 7d
  const firstReactivationSent = (reactivations ?? []).find((r) => r.status === "sent" && r.attempt_number === 1);
  if (firstReactivationSent) {
    console.log(`\n=== Checagem da âncora sequencial (reativação #1) ===`);
    if (!lead.follow_up_completed_at) {
      console.log("⚠️ Reativação #1 disparou SEM follow_up_completed_at preenchido — só é normal se caiu no fallback (lead nunca ativo em follow-up). Investigar se não for o caso.");
      violations++;
    } else {
      const anchor = new Date(lead.follow_up_completed_at).getTime();
      const expectedEarliest = anchor + REACTIVATION_ANCHOR_DAYS * 24 * 60 * 60 * 1000;
      const actual = new Date(firstReactivationSent.logged_at).getTime();
      const daysEarly = (expectedEarliest - actual) / (24 * 60 * 60 * 1000);
      if (actual < expectedEarliest) {
        console.log(`⚠️ VIOLAÇÃO: reativação #1 disparou ${daysEarly.toFixed(1)} dia(s) ANTES do esperado (follow_up_completed_at + 7d)`);
        violations++;
      } else {
        console.log(`✔ Reativação #1 disparou ${((actual - expectedEarliest) / (60 * 60 * 1000)).toFixed(1)}h depois do mínimo esperado (follow_up_completed_at + 7d) — correto.`);
      }
    }
  } else {
    console.log("\n(Reativação #1 ainda não disparou — nada a checar ainda.)");
  }

  console.log(`\n=== Resultado: ${violations === 0 ? "✔ nenhuma violação encontrada" : `⚠️ ${violations} violação(ões) encontrada(s)`} ===`);
}

main().catch((e) => {
  console.error("FALHOU:", e instanceof Error ? e.message : e);
  process.exit(1);
});
